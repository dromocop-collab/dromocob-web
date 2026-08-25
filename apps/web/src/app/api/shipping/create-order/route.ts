import { NextRequest, NextResponse } from "next/server";
import { getApps, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  buildCreateOrderProxyPayload,
  proxyCreateOrder,
} from "@/lib/shipping/proxy";
import { buildShipmentInputFromOrder, normalizeUpper } from "@/lib/shipping/order-input";
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

function makeDebugSummary(orderId: string, orderData: any, settingsData: any) {
  return {
    orderId,
    orderStatus: safeStr(orderData?.status),
    hasItems: Array.isArray(orderData?.items),
    itemsCount: Array.isArray(orderData?.items) ? orderData.items.length : 0,
    hasShippingAddress: Boolean(orderData?.shippingAddress || orderData?.address),
    activeProvider: safeStr(settingsData?.activeProvider),
    createShipmentEnabled: settingsData?.features?.createShipment !== false,
    mngIsActive: settingsData?.providers?.mng?.isActive !== false,
    hasExistingReferenceId: Boolean(safeStr(orderData?.shippingReferenceId)),
    existingReferenceId: safeStr(orderData?.shippingReferenceId),
  };
}

function extractRawObject(v: unknown): Record<string, any> {
  if (Array.isArray(v)) {
    const first = v[0];
    return first && typeof first === "object" ? (first as Record<string, any>) : {};
  }

  if (v && typeof v === "object") {
    return v as Record<string, any>;
  }

  return {};
}

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();

  let orderId = "";
  let orderData: any = null;
  let db: FirebaseFirestore.Firestore | null = null;

  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json().catch(() => null);
    orderId = safeStr(body?.orderId);

    console.log("[shipping/create-order] HIT", {
      at: new Date().toISOString(),
      orderId,
      hasBody: Boolean(body),
    });

    if (!orderId) {
      return NextResponse.json(
        {
          ok: false,
          error: "orderId zorunlu.",
          stage: "validate_request",
        },
        { status: 400 }
      );
    }

    db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const settingsRef = db.collection("settings").doc("shipping");

    const [orderSnap, settingsSnap] = await Promise.all([
      orderRef.get(),
      settingsRef.get(),
    ]);

    if (!orderSnap.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sipariş bulunamadı.",
          stage: "load_order",
          orderId,
        },
        { status: 404 }
      );
    }

    orderData = orderSnap.data() || {};
    const settingsData = settingsSnap.exists ? settingsSnap.data() : {};

    console.log(
      "[shipping/create-order] CONTEXT",
      makeDebugSummary(orderId, orderData, settingsData)
    );

    const orderStatus = safeStr(orderData?.status);
    if (!["paid", "preparing"].includes(orderStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: "CreateOrder için sipariş durumu paid veya preparing olmalıdır.",
          stage: "validate_order_status",
          orderId,
          orderStatus,
        },
        { status: 400 }
      );
    }

    const shippingEnabled =
      settingsData?.activeProvider === "mng" &&
      settingsData?.features?.createShipment !== false &&
      settingsData?.providers?.mng?.isActive !== false;

    if (!shippingEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: "MNG create-order şu anda pasif.",
          stage: "validate_shipping_settings",
          orderId,
          activeProvider: safeStr(settingsData?.activeProvider),
          createShipmentEnabled: settingsData?.features?.createShipment !== false,
          mngIsActive: settingsData?.providers?.mng?.isActive !== false,
        },
        { status: 400 }
      );
    }

    if (safeStr(orderData?.shippingReferenceId)) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "already_exists",
        provider: safeStr(orderData?.shippingProvider || "mng"),
        status: safeStr(orderData?.shippingStatus || "order_created"),
        referenceId: safeStr(orderData?.shippingReferenceId),
        orderInvoiceId: safeStr(orderData?.shippingOrderInvoiceId),
        orderInvoiceDetailId: safeStr(orderData?.shippingOrderInvoiceDetailId),
        shipperBranchCode: safeStr(orderData?.shippingShipperBranchCode),
        durationMs: Date.now() - requestStartedAt,
      });
    }

    const shipmentInput = buildShipmentInputFromOrder(orderId, orderData);

    console.log("[shipping/create-order] SHIPMENT_INPUT", {
      orderId: shipmentInput.orderId,
      currency: shipmentInput.currency,
      recipient: shipmentInput.recipient,
      address: shipmentInput.address,
      parcels: shipmentInput.parcels,
      items: shipmentInput.items,
      notes: shipmentInput.notes,
    });

    const proxyPayload = buildCreateOrderProxyPayload(shipmentInput);

    console.log("[shipping/create-order] PROXY_PAYLOAD", proxyPayload);

    const proxyResult = await proxyCreateOrder(proxyPayload);

    console.log("[shipping/create-order] PROXY_RESULT", proxyResult);

    const raw = extractRawObject((proxyResult as any)?.raw);
    const referenceId = safeStr(raw?.referenceId || shipmentInput.orderId);
    const orderInvoiceId = safeStr(raw?.orderInvoiceId);
    const orderInvoiceDetailId = safeStr(raw?.orderInvoiceDetailId);
    const shipperBranchCode = safeStr(raw?.shipperBranchCode);
    const resultStatus = safeStr((proxyResult as any)?.status) || "order_created";

    await orderRef.set(
      {
        shippingProvider: "mng",
        shippingStatus: resultStatus,
        shippingReferenceId: referenceId,
        shippingOrderInvoiceId: orderInvoiceId,
        shippingOrderInvoiceDetailId: orderInvoiceDetailId,
        shippingShipperBranchCode: shipperBranchCode,
        shippingOrderRaw: raw || null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("[shipping/create-order] SUCCESS", {
      orderId,
      referenceId,
      orderInvoiceId,
      orderInvoiceDetailId,
      shipperBranchCode,
      durationMs: Date.now() - requestStartedAt,
    });

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      status: resultStatus,
      referenceId,
      orderInvoiceId,
      orderInvoiceDetailId,
      shipperBranchCode,
      raw,
      durationMs: Date.now() - requestStartedAt,
    });
  } catch (error: any) {
    const message = safeStr(error?.message) || "CreateOrder başarısız.";
    const upperMsg = message.toUpperCase();

    // MNG duplicate sipariş hatası: "BU SİPARİŞ NUMARASINA AİT KAYIT ZATEN VAR"
    const isDuplicate =
      upperMsg.includes("ZATEN VAR") || upperMsg.includes("KAYIT ZATEN VAR");

    if (isDuplicate && orderId && db) {
      const referenceId =
        safeStr(orderData?.shippingReferenceId) ||
        normalizeUpper(orderId).replace(/[^A-Z0-9]/g, "").slice(0, 30);

      console.log("[shipping/create-order] MNG_DUPLICATE_EXISTING_ORDER", {
        orderId,
        referenceId,
        message,
        durationMs: Date.now() - requestStartedAt,
      });

      try {
        const orderRef = db.collection("orders").doc(orderId);
        await orderRef.set(
          {
            shippingProvider: "mng",
            shippingStatus: "order_created",
            shippingReferenceId: referenceId,
            shippingOrderAlreadyExists: true,
            shippingOrderDuplicateAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtIso: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.error("[shipping/create-order] DUPLICATE_DB_WRITE_ERROR", {
          orderId,
          dbError: safeStr(dbErr?.message),
        });
      }

      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "mng_duplicate_existing_order",
        provider: "mng",
        status: "order_created",
        referenceId,
        durationMs: Date.now() - requestStartedAt,
      });
    }

    console.error("[shipping/create-order] ERROR", {
      message,
      stack: error?.stack || null,
      durationMs: Date.now() - requestStartedAt,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        stage: "catch",
        durationMs: Date.now() - requestStartedAt,
      },
      { status: 500 }
    );
  }
}