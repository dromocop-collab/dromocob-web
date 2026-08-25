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
  buildCancelShipmentProxyPayload,
  proxyCancelShipment,
} from "@/lib/shipping/proxy";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

type LoadedRefundDoc = {
  refundRef: DocumentReference;
  refundSnap: DocumentSnapshot;
  sourceCollection: "refund_requests" | "returns";
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

function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    const s = safeStr(value);
    if (s) return s;
  }

  return "";
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

    console.log("[returns/cancel-shipment] HIT", {
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

    console.log("[returns/cancel-shipment] REFUND_SOURCE", {
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
    const rs = refundData?.returnShipping || {};
    const mirror = refundData?.returnShipment || {};

    const referenceId = firstFilled(
      body?.referenceId,
      rs?.referenceId,
      mirror?.referenceId,
      rs?.shipmentRef,
      mirror?.shipmentRef
    );

    const shipmentId = firstFilled(
      body?.shipmentId,
      rs?.shipmentId,
      mirror?.shipmentId,
      rs?.shipmentRef,
      mirror?.shipmentRef
    );

    const trackingNumber = firstFilled(
      body?.trackingNumber,
      body?.trackingNo,
      rs?.trackingNumber,
      mirror?.trackingNumber,
      mirror?.trackingNo
    );

    const trackingUrl = firstFilled(
      rs?.trackingUrl,
      mirror?.trackingUrl
    );

    const shipmentDocId = firstFilled(
      rs?.shipmentDocId,
      mirror?.shipmentDocId
    );

    const orderId = firstFilled(
      refundData?.orderDocId,
      refundData?.orderId,
      body?.orderId
    );

    console.log("[returns/cancel-shipment] CONTEXT", {
      refundId,
      orderId,
      referenceId,
      shipmentId,
      shipmentDocId,
      trackingNumber,
      returnShippingStatus: safeStr(rs?.status),
      returnShipmentStatus: safeStr(mirror?.status),
      refundStatus: safeStr(refundData?.status),
    });

    if (!referenceId || !shipmentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "İade kargo iptali için referenceId ve shipmentId zorunlu.",
          stage: "validate_cancel_key",
          referenceId,
          shipmentId,
        },
        { status: 400 }
      );
    }

    const alreadyCancelled =
      safeStr(rs?.status) === "cancelled" ||
      safeStr(mirror?.status) === "cancelled" ||
      safeStr(refundData?.status) === "return_label_cancelled";

    if (alreadyCancelled) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "already_cancelled",
        provider: "mng",
        status: "cancelled",
        refundId,
        orderId,
        referenceId,
        shipmentId,
        durationMs: Date.now() - startedAt,
      });
    }

    const proxyPayload = buildCancelShipmentProxyPayload(referenceId, shipmentId);

    console.log("[returns/cancel-shipment] CALL_PROXY", {
      expectedProxyMethod: "PUT",
      expectedProxyPath: "/cancel-shipment",
      proxyPayload,
    });

    const proxyResult = await proxyCancelShipment(proxyPayload);

    console.log("[returns/cancel-shipment] PROXY_RESULT", proxyResult);

    const nowIso = new Date().toISOString();
    const cancelRaw = (proxyResult as any)?.raw || null;

    await refundRef.set(
      {
        status: "return_label_cancelled",

        returnShipping: {
          ...rs,
          provider: "mng",
          status: "cancelled",

          shipmentId,
          shipmentRef: shipmentId,
          referenceId,

          trackingNumber,
          trackingUrl,

          cancelledAt: FieldValue.serverTimestamp(),
          cancelledAtIso: nowIso,

          cancelRaw,
          updatedAt: FieldValue.serverTimestamp(),
          lastError: "",
        },

        returnShipment: {
          ...mirror,
          provider: "mng",
          carrier: "MNG Kargo",
          status: "cancelled",
          systemGenerated: true,

          shipmentId,
          shipmentRef: shipmentId,
          referenceId,

          trackingNo: trackingNumber,
          trackingNumber,
          trackingUrl,

          code: trackingNumber,
          returnCode: trackingNumber,

          cancelledAt: FieldValue.serverTimestamp(),
          cancelledAtIso: nowIso,

          updatedAt: FieldValue.serverTimestamp(),
          lastError: "",
        },

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      },
      { merge: true }
    );

    if (shipmentDocId) {
      await db.collection("return_shipments").doc(shipmentDocId).set(
        {
          status: "cancelled",

          shipmentId,
          shipmentRef: shipmentId,
          referenceId,

          trackingNumber,
          trackingNo: trackingNumber,
          trackingUrl,

          cancelRaw,

          cancelledAt: FieldValue.serverTimestamp(),
          cancelledAtIso: nowIso,

          updatedAt: FieldValue.serverTimestamp(),
          lastError: "",
        },
        { merge: true }
      );
    }

    if (orderId) {
      await db.collection("orders").doc(orderId).set(
        {
          lastReturnRequestId: refundId,
          lastReturnShippingStatus: "cancelled",
          lastReturnTrackingNumber: trackingNumber,

          returnInfo: {
            status: "return_label_cancelled",
            refundId,

            provider: "mng",
            carrier: "MNG Kargo",

            returnCode: trackingNumber,
            trackingNumber,
            trackingNo: trackingNumber,
            trackingUrl,

            shipmentId,
            shipmentRef: shipmentId,
            shipmentDocId: shipmentDocId || "",

            referenceId,

            cancelledAt: FieldValue.serverTimestamp(),
            cancelledAtIso: nowIso,

            updatedAt: FieldValue.serverTimestamp(),
            updatedAtIso: nowIso,
          },

          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: nowIso,
        },
        { merge: true }
      );
    }

    console.log("[returns/cancel-shipment] SUCCESS", {
      refundId,
      orderId,
      referenceId,
      shipmentId,
      shipmentDocId,
      trackingNumber,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      status: "cancelled",

      refundId,
      orderId,

      referenceId,
      shipmentId,
      shipmentRef: shipmentId,
      shipmentDocId: shipmentDocId || "",

      trackingNumber,
      trackingNo: trackingNumber,
      trackingUrl,

      raw: cancelRaw,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    const message = safeStr(error?.message) || "İade kargo iptali başarısız.";

    console.error("[returns/cancel-shipment] ERROR", {
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
            returnShipping: {
              provider: "mng",
              status: "cancel_failed",
              lastError: message,
              updatedAt: FieldValue.serverTimestamp(),
            },

            returnShipment: {
              provider: "mng",
              carrier: "MNG Kargo",
              status: "cancel_failed",
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
      console.error("[returns/cancel-shipment] CATCH_WRITE_ERROR", {
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