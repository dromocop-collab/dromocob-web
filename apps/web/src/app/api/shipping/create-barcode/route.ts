import { NextRequest, NextResponse } from "next/server";
import { getApps, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  buildCreateBarcodeProxyPayload,
  proxyCreateBarcode,
} from "@/lib/shipping/proxy";
import { buildShipmentInputFromOrder } from "@/lib/shipping/order-input";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function firstBarcodeValue(raw: any): string {
  if (!Array.isArray(raw?.barcodes)) return "";
  return safeStr(raw.barcodes?.[0]?.barcode);
}

function firstZplValue(raw: any): string {
  if (!Array.isArray(raw?.barcodes)) return "";
  return safeStr(raw.barcodes?.[0]?.value);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json().catch(() => null);
    const orderId = safeStr(body?.orderId);

    console.log("[shipping/create-barcode] HIT", {
      at: new Date().toISOString(),
      orderId,
      hasBody: Boolean(body),
    });

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId zorunlu.", stage: "validate_request" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Sipariş bulunamadı.", stage: "load_order" },
        { status: 404 }
      );
    }

    const orderData = orderSnap.data() || {};
    const referenceId = safeStr(body?.referenceId || orderData?.shippingReferenceId);

    console.log("[shipping/create-barcode] CONTEXT", {
      orderId,
      referenceId,
      existingShipmentId: safeStr(orderData?.shipmentId),
      existingShipmentDocId: safeStr(orderData?.shipmentDocId),
      existingTrackingNumber: safeStr(orderData?.trackingNumber),
      existingShipmentRef: safeStr(orderData?.shipmentRef),
      orderStatus: safeStr(orderData?.status),
    });

    if (!referenceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Önce create-order çalışmalı. referenceId bulunamadı.",
          stage: "validate_reference",
        },
        { status: 400 }
      );
    }

    // Burada gerçek MNG shipmentId varsa tekrar barkod üretmeyelim
    if (safeStr(orderData?.shipmentId)) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "already_exists",
        shipmentId: safeStr(orderData?.shipmentId), // MNG shipmentId
        shipmentDocId: safeStr(orderData?.shipmentDocId), // Firestore doc id
        shipmentRef: safeStr(orderData?.shipmentRef),
        trackingNumber: safeStr(orderData?.trackingNumber),
        trackingUrl: safeStr(orderData?.trackingUrl),
        labelUrl: safeStr(orderData?.labelUrl),
        labelZpl: safeStr(orderData?.labelZpl),
      });
    }

    const shipmentInput = buildShipmentInputFromOrder(orderId, orderData);
    const proxyPayload = buildCreateBarcodeProxyPayload(referenceId, shipmentInput);

    console.log("[shipping/create-barcode] PROXY_PAYLOAD", proxyPayload);

    const proxyResult = await proxyCreateBarcode(proxyPayload);

    console.log("[shipping/create-barcode] PROXY_RESULT", proxyResult);

    const raw = Array.isArray(proxyResult?.raw)
      ? proxyResult.raw[0] || {}
      : proxyResult?.raw || {};

    const mngShipmentId = safeStr(raw?.shipmentId);
    const invoiceId = safeStr(raw?.invoiceId);
    const responseReferenceId = safeStr(raw?.referenceId || referenceId);
    const referenceBarcodeOnError = safeStr(raw?.referenceBarcodeOnError);

    const labelZpl =
      safeStr(raw?.labelZpl) ||
      safeStr(raw?.zpl) ||
      firstZplValue(raw);

    const trackingNumber = firstBarcodeValue(raw);

    const trackingUrl = trackingNumber
      ? `https://www.mngkargo.com.tr/gonderitakip?takipno=${encodeURIComponent(trackingNumber)}`
      : "";

    const shipmentDocRef = db.collection("shipments").doc();

    // MNG iş kuralı hatası dönmüşse (ör: VARIŞ ŞUBESİ BULANAMADI)
    if (referenceBarcodeOnError) {
      // Hatayı kaydet ama ok: false dön
      await orderRef.set(
        {
          shippingProvider: "mng",
          shippingStatus: "barcode_error",
          shippingBarcodeError: referenceBarcodeOnError,
          shippingBarcodeRaw: raw || null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log("[shipping/create-barcode] MNG_BUSINESS_ERROR", {
        orderId,
        referenceBarcodeOnError,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        {
          ok: false,
          stage: "mng_business_error",
          error: referenceBarcodeOnError,
          status: "barcode_error",
          referenceId: responseReferenceId,
          raw,
          durationMs: Date.now() - startedAt,
        },
        { status: 422 }
      );
    }

    const finalStatus = safeStr(proxyResult?.status) || "created";

    await shipmentDocRef.set({
      orderId,
      provider: "mng",
      status: finalStatus,

      // Firestore internal kayıt id
      shipmentDocId: shipmentDocRef.id,

      // MNG gerçek değerler
      shipmentId: mngShipmentId,
      shipmentRef: mngShipmentId,
      referenceId: responseReferenceId,
      invoiceId,

      trackingNumber,
      trackingUrl,
      labelUrl: "",
      labelZpl,

      recipient: shipmentInput.recipient,
      address: shipmentInput.address,
      parcelSummary: {
        count: shipmentInput.parcels.length,
        totalWeight: shipmentInput.parcels.reduce(
          (acc, p) => acc + (Number(p.weight) || 0),
          0
        ),
        totalDesi: shipmentInput.parcels.reduce(
          (acc, p) => acc + (Number(p.desi) || 0),
          0
        ),
      },
      items: shipmentInput.items,
      raw: raw || null,
      referenceBarcodeOnError: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "admin_api",
      lastError: "",
    });

    // Sipariş "paid" durumundaysa kargo oluşturulunca otomatik "preparing" yap
    const currentOrderStatus = safeStr(orderData?.status).toLowerCase();
    const shouldUpdateStatus = currentOrderStatus === "paid";

    await orderRef.set(
      {
        shippingProvider: "mng",
        shippingStatus: finalStatus,

        shipmentId: mngShipmentId,
        shipmentDocId: shipmentDocRef.id,
        shipmentRef: mngShipmentId,
        trackingNumber,
        trackingUrl,
        labelUrl: "",
        labelZpl,
        shippingReferenceId: responseReferenceId,
        shippingInvoiceId: invoiceId,
        shippingOrderInvoiceId: invoiceId || safeStr(orderData?.shippingOrderInvoiceId),
        shippingBarcodeInvoiceId: invoiceId,
        shippingBarcodeRaw: raw || null,
        shippingBarcodeError: "",

        // Kargo oluşturulunca önceki iptal flag'ini temizle
        shippingCancelled: false,

        // Sipariş durumunu otomatik güncelle
        ...(shouldUpdateStatus
          ? {
              status: "preparing",
              statusUpdatedAt: FieldValue.serverTimestamp(),
              statusUpdatedAtIso: new Date().toISOString(),
              statusUpdatedBy: "shipping_auto",
            }
          : {}),

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("[shipping/create-barcode] SUCCESS", {
      orderId,
      shipmentDocId: shipmentDocRef.id,
      mngShipmentId,
      responseReferenceId,
      invoiceId,
      trackingNumber,
      finalStatus,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      stage: "success",
      shipmentId: mngShipmentId,
      shipmentDocId: shipmentDocRef.id,
      shipmentRef: mngShipmentId,
      trackingNumber,
      trackingUrl,
      labelUrl: "",
      labelZpl,
      provider: "mng",
      status: finalStatus,
      referenceId: responseReferenceId,
      invoiceId,
      raw,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    console.error("[shipping/create-barcode] ERROR", {
      message: safeStr(error?.message) || "CreateBarcode başarısız.",
      stack: error?.stack || null,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: false,
        stage: "catch",
        error: safeStr(error?.message) || "CreateBarcode başarısız.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}