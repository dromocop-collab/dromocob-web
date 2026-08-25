import { NextRequest, NextResponse } from "next/server";
import { getApps, cert, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";
import {
  buildCreateOrderProxyPayload,
  buildCreateBarcodeProxyPayload,
  proxyCreateOrder,
  proxyCreateBarcode,
} from "@/lib/shipping/proxy";
import { buildReturnShipmentInputFromRefund } from "@/lib/shipping/return-input";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

type LoadedRefundDoc = {
  refundRef: DocumentReference;
  refundSnap: DocumentSnapshot;
  sourceCollection: "refund_requests" | "returns";
};

type ResolvedOrderDoc = {
  orderRef: DocumentReference;
  orderSnap: DocumentSnapshot;
  resolvedOrderId: string;
  resolveMode:
    | "direct_doc_id"
    | "orderId_field"
    | "invoiceId_field"
    | "payment_ref"
    | "payment_session";
};

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

async function loadRefundDoc(db: Firestore, refundId: string): Promise<LoadedRefundDoc> {
  const primaryRef = db.collection("refund_requests").doc(refundId);
  const primarySnap = await primaryRef.get();

  if (primarySnap.exists) {
    return {
      refundRef: primaryRef,
      refundSnap: primarySnap,
      sourceCollection: "refund_requests",
    };
  }

  const legacyRef = db.collection("returns").doc(refundId);
  const legacySnap = await legacyRef.get();

  if (legacySnap.exists) {
    return {
      refundRef: legacyRef,
      refundSnap: legacySnap,
      sourceCollection: "returns",
    };
  }

  return {
    refundRef: primaryRef,
    refundSnap: primarySnap,
    sourceCollection: "refund_requests",
  };
}

async function resolveOrderDoc(params: {
  db: Firestore;
  orderId: string;
  merchantOid?: string;
}): Promise<ResolvedOrderDoc | null> {
  const { db } = params;
  const orderId = safeStr(params.orderId);
  const merchantOid = safeStr(params.merchantOid);

  if (orderId) {
    const directRef = db.collection("orders").doc(orderId);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
      return {
        orderRef: directRef,
        orderSnap: directSnap,
        resolvedOrderId: directSnap.id,
        resolveMode: "direct_doc_id",
      };
    }

    const byVisibleOrderId = await db
      .collection("orders")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (!byVisibleOrderId.empty) {
      const found = byVisibleOrderId.docs[0];

      return {
        orderRef: found.ref,
        orderSnap: found,
        resolvedOrderId: found.id,
        resolveMode: "orderId_field",
      };
    }

    const byInvoiceId = await db
      .collection("orders")
      .where("invoiceId", "==", orderId)
      .limit(1)
      .get();

    if (!byInvoiceId.empty) {
      const found = byInvoiceId.docs[0];

      return {
        orderRef: found.ref,
        orderSnap: found,
        resolvedOrderId: found.id,
        resolveMode: "invoiceId_field",
      };
    }
  }

  if (merchantOid) {
    const byPaymentRef = await db
      .collection("orders")
      .where("payment.ref", "==", merchantOid)
      .limit(1)
      .get();

    if (!byPaymentRef.empty) {
      const found = byPaymentRef.docs[0];

      return {
        orderRef: found.ref,
        orderSnap: found,
        resolvedOrderId: found.id,
        resolveMode: "payment_ref",
      };
    }

    const bySession = await db
      .collection("orders")
      .where("meta.paymentSessionId", "==", merchantOid)
      .limit(1)
      .get();

    if (!bySession.empty) {
      const found = bySession.docs[0];

      return {
        orderRef: found.ref,
        orderSnap: found,
        resolvedOrderId: found.id,
        resolveMode: "payment_session",
      };
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: any = null;
  let refundId = "";

  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    body = await req.json().catch(() => null);
    refundId = safeStr(body?.refundId);

    console.log("[returns/create-shipment] HIT", {
      at: new Date().toISOString(),
      refundId,
      hasBody: Boolean(body),
    });

    if (!refundId) {
      return NextResponse.json(
        {
          ok: false,
          error: "refundId zorunlu.",
          stage: "validate_request",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const { refundRef, refundSnap, sourceCollection } = await loadRefundDoc(db, refundId);

    console.log("[returns/create-shipment] REFUND_SOURCE", {
      refundId,
      sourceCollection,
    });

    if (!refundSnap.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "İade talebi bulunamadı.",
          stage: "load_refund",
          refundId,
        },
        { status: 404 }
      );
    }

    const refundData = refundSnap.data() || {};

    const requestedOrderId = safeStr(
      refundData?.orderDocId ||
        refundData?.orderId ||
        body?.orderId
    );

    const merchantOid = safeStr(refundData?.merchantOid || body?.merchantOid);

    if (!requestedOrderId && !merchantOid) {
      return NextResponse.json(
        {
          ok: false,
          error: "İade talebinde orderId veya merchantOid bulunamadı.",
          stage: "validate_order_id",
        },
        { status: 400 }
      );
    }

    const settingsRef = db.collection("settings").doc("shipping");

    const [resolvedOrder, settingsSnap] = await Promise.all([
      resolveOrderDoc({
        db,
        orderId: requestedOrderId,
        merchantOid,
      }),
      settingsRef.get(),
    ]);

    if (!resolvedOrder?.orderSnap?.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sipariş bulunamadı.",
          stage: "load_order",
          orderId: requestedOrderId,
          merchantOid,
        },
        { status: 404 }
      );
    }

    const orderRef = resolvedOrder.orderRef;
    const orderSnap = resolvedOrder.orderSnap;
    const resolvedOrderId = resolvedOrder.resolvedOrderId;

    console.log("[returns/create-shipment] ORDER_RESOLVED", {
      refundId,
      requestedOrderId,
      resolvedOrderId,
      resolveMode: resolvedOrder.resolveMode,
    });

    const orderData = orderSnap.data() || {};
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};

    const refundStatus = safeStr(refundData?.status);

    if (!["approved", "return_approved", "return_label_failed", "return_label_error"].includes(refundStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: "İade kargo kodu için iade talebi admin tarafından onaylanmış olmalıdır.",
          stage: "validate_refund_status",
          refundStatus,
        },
        { status: 400 }
      );
    }

    const existingShipmentId = safeStr(refundData?.returnShipping?.shipmentId);
    const existingTrackingNumber =
      safeStr(refundData?.returnShipping?.trackingNumber) ||
      safeStr(refundData?.returnShipment?.trackingNumber) ||
      safeStr(refundData?.returnShipment?.trackingNo);

    if (existingShipmentId || existingTrackingNumber) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "already_exists",
        provider: safeStr(refundData?.returnShipping?.provider || "mng"),
        status: safeStr(refundData?.returnShipping?.status || "barcode_created"),
        refundId,
        orderId: resolvedOrderId,
        returnShipping: refundData?.returnShipping || null,
        returnShipment: refundData?.returnShipment || null,
        durationMs: Date.now() - startedAt,
      });
    }

    const shippingEnabled =
      settingsData?.activeProvider === "mng" &&
      settingsData?.features?.createShipment !== false &&
      settingsData?.providers?.mng?.isActive !== false;

    if (!shippingEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: "MNG iade kargo oluşturma şu anda pasif.",
          stage: "validate_shipping_settings",
        },
        { status: 400 }
      );
    }

    await refundRef.set(
      {
        orderId: resolvedOrderId,
        orderDocId: resolvedOrderId,
        returnShipping: {
          ...(refundData?.returnShipping || {}),
          provider: "mng",
          status: "creating",
          lastError: "",
          updatedAt: FieldValue.serverTimestamp(),
        },
        returnShipment: {
          ...(refundData?.returnShipment || {}),
          provider: "mng",
          carrier: "MNG Kargo",
          status: "creating",
          systemGenerated: true,
          lastError: "",
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    const shipmentInput = buildReturnShipmentInputFromRefund(
      refundId,
      {
        ...refundData,
        orderId: resolvedOrderId,
        orderDocId: resolvedOrderId,
      },
      orderData,
      settingsData
    );

    console.log("[returns/create-shipment] RETURN_SHIPMENT_INPUT", {
      refundId,
      orderId: resolvedOrderId,
      recipient: shipmentInput.recipient,
      address: shipmentInput.address,
      parcels: shipmentInput.parcels,
      items: shipmentInput.items,
      notes: shipmentInput.notes,
    });

    const orderPayload = buildCreateOrderProxyPayload(shipmentInput);

    console.log("[returns/create-shipment] CREATE_ORDER_PAYLOAD", orderPayload);

    const orderResult = await proxyCreateOrder(orderPayload);

    console.log("[returns/create-shipment] CREATE_ORDER_RESULT", orderResult);

    const orderRaw = extractRawObject((orderResult as any)?.raw);

    const referenceId = safeStr(orderRaw?.referenceId || shipmentInput.orderId);
    const orderInvoiceId = safeStr(orderRaw?.orderInvoiceId);
    const orderInvoiceDetailId = safeStr(orderRaw?.orderInvoiceDetailId);
    const shipperBranchCode = safeStr(orderRaw?.shipperBranchCode);

    if (!referenceId) {
      throw new Error("MNG iade create-order referenceId döndürmedi.");
    }

    await refundRef.set(
      {
        status: "return_order_created",
        orderId: resolvedOrderId,
        orderDocId: resolvedOrderId,
        returnShipping: {
          provider: "mng",
          status: "order_created",
          referenceId,
          orderInvoiceId,
          orderInvoiceDetailId,
          shipperBranchCode,
          orderRaw,
          updatedAt: FieldValue.serverTimestamp(),
          lastError: "",
        },
        returnShipment: {
          provider: "mng",
          carrier: "MNG Kargo",
          status: "order_created",
          systemGenerated: true,
          referenceId,
          updatedAt: FieldValue.serverTimestamp(),
          lastError: "",
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    const barcodePayload = buildCreateBarcodeProxyPayload(referenceId, shipmentInput);

    console.log("[returns/create-shipment] CREATE_BARCODE_PAYLOAD", barcodePayload);

    const barcodeResult = await proxyCreateBarcode(barcodePayload);

    console.log("[returns/create-shipment] CREATE_BARCODE_RESULT", barcodeResult);

    const barcodeRaw = Array.isArray((barcodeResult as any)?.raw)
      ? (barcodeResult as any).raw[0] || {}
      : (barcodeResult as any)?.raw || {};

    const mngShipmentId = safeStr(barcodeRaw?.shipmentId);
    const invoiceId = safeStr(barcodeRaw?.invoiceId);
    const responseReferenceId = safeStr(barcodeRaw?.referenceId || referenceId);
    const referenceBarcodeOnError = safeStr(barcodeRaw?.referenceBarcodeOnError);

    const labelZpl =
      safeStr(barcodeRaw?.labelZpl) ||
      safeStr(barcodeRaw?.zpl) ||
      firstZplValue(barcodeRaw);

    const trackingNumber =
      firstBarcodeValue(barcodeRaw) ||
      mngShipmentId ||
      responseReferenceId;

    const trackingUrl = trackingNumber
      ? `https://www.mngkargo.com.tr/gonderitakip?takipno=${encodeURIComponent(trackingNumber)}`
      : "";

    const finalStatus =
      referenceBarcodeOnError
        ? "barcode_error"
        : safeStr((barcodeResult as any)?.status) || "barcode_created";

    const finalRefundStatus = referenceBarcodeOnError
      ? "return_label_error"
      : "return_label_created";

    const returnShipmentDocRef = db.collection("return_shipments").doc();

    const returnShipping = {
      provider: "mng",
      status: finalStatus,

      shipmentDocId: returnShipmentDocRef.id,

      shipmentId: mngShipmentId,
      shipmentRef: mngShipmentId,
      referenceId: responseReferenceId,

      orderInvoiceId,
      orderInvoiceDetailId,
      shipperBranchCode,
      invoiceId,

      trackingNumber,
      trackingUrl,
      labelUrl: "",
      labelZpl,

      orderRaw,
      barcodeRaw,
      referenceBarcodeOnError,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: referenceBarcodeOnError || "",
    };

    const returnShipmentMirror = {
      provider: "mng",
      carrier: "MNG Kargo",

      status: referenceBarcodeOnError ? "label_error" : "waiting_customer",
      systemGenerated: true,

      shipmentId: mngShipmentId,
      shipmentRef: mngShipmentId,
      referenceId: responseReferenceId,
      invoiceId,

      trackingNo: trackingNumber,
      trackingNumber,
      trackingUrl,

      labelUrl: "",
      labelZpl,

      code: trackingNumber,
      returnCode: trackingNumber,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: referenceBarcodeOnError || "",
    };

    await returnShipmentDocRef.set({
      refundId,
      orderId: resolvedOrderId,
      orderDocId: resolvedOrderId,
      uid: safeStr(refundData?.uid || orderData?.uid),

      provider: "mng",
      carrier: "MNG Kargo",
      status: finalStatus,

      shipmentDocId: returnShipmentDocRef.id,
      shipmentId: mngShipmentId,
      shipmentRef: mngShipmentId,
      referenceId: responseReferenceId,
      invoiceId,

      trackingNumber,
      trackingNo: trackingNumber,
      trackingUrl,
      returnCode: trackingNumber,

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

      raw: barcodeRaw || null,
      orderRaw: orderRaw || null,
      referenceBarcodeOnError,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "return_api",
      lastError: referenceBarcodeOnError || "",
    });

    await refundRef.set(
      {
        status: finalRefundStatus,

        orderId: resolvedOrderId,
        orderDocId: resolvedOrderId,

        returnShipping,
        returnShipment: returnShipmentMirror,

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    await orderRef.set(
      {
        hasReturnRequest: true,
        lastReturnRequestId: refundId,
        lastReturnShippingStatus: finalStatus,
        lastReturnTrackingNumber: trackingNumber,

        returnInfo: {
          status: finalRefundStatus,
          refundId,
          provider: "mng",
          carrier: "MNG Kargo",
          returnCode: trackingNumber,
          trackingNumber,
          trackingNo: trackingNumber,
          trackingUrl,
          shipmentId: mngShipmentId,
          shipmentDocId: returnShipmentDocRef.id,
          referenceId: responseReferenceId,
          invoiceId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),
        },

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("[returns/create-shipment] SUCCESS", {
      refundId,
      orderId: resolvedOrderId,
      returnShipmentDocId: returnShipmentDocRef.id,
      mngShipmentId,
      responseReferenceId,
      invoiceId,
      trackingNumber,
      finalStatus,
      finalRefundStatus,
      referenceBarcodeOnError,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      status: finalStatus,
      refundStatus: finalRefundStatus,

      refundId,
      orderId: resolvedOrderId,

      shipmentId: mngShipmentId,
      shipmentDocId: returnShipmentDocRef.id,
      shipmentRef: mngShipmentId,

      referenceId: responseReferenceId,
      invoiceId,

      trackingNumber,
      trackingNo: trackingNumber,
      trackingUrl,

      returnCode: trackingNumber,

      labelUrl: "",
      labelZpl,

      referenceBarcodeOnError,
      returnShipping,
      returnShipment: returnShipmentMirror,

      raw: barcodeRaw,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    const message = safeStr(error?.message) || "İade kargo oluşturulamadı.";

    console.error("[returns/create-shipment] ERROR", {
      refundId,
      message,
      stack: error?.stack || null,
      durationMs: Date.now() - startedAt,
    });

    try {
      if (refundId) {
        const db = getAdminDb();

        await db.collection("refund_requests").doc(refundId).set(
          {
            status: "return_label_failed",

            returnShipping: {
              provider: "mng",
              status: "failed",
              lastError: message,
              updatedAt: FieldValue.serverTimestamp(),
            },

            returnShipment: {
              provider: "mng",
              carrier: "MNG Kargo",
              status: "failed",
              lastError: message,
              updatedAt: FieldValue.serverTimestamp(),
            },

            updatedAt: FieldValue.serverTimestamp(),
            updatedAtIso: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (innerError: any) {
      console.error("[returns/create-shipment] CATCH_WRITE_ERROR", {
        refundId,
        message: safeStr(innerError?.message),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        stage: "catch",
        error: message,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}