import { NextRequest, NextResponse } from "next/server";
import { getApps, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  buildCancelShipmentProxyPayload,
  proxyCancelShipment,
} from "@/lib/shipping/proxy";
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

function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    const s = safeStr(value);
    if (s) return s;
  }
  return "";
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json().catch(() => null);
    const orderId = safeStr(body?.orderId);

    console.log("[shipping/cancel-shipment] HIT", {
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

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

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

    const orderData = orderSnap.data() || {};

    const referenceId = firstFilled(
      body?.referenceId,
      orderData?.shippingReferenceId,
      orderData?.shipmentRef
    );

    const shipmentId = firstFilled(
      body?.shipmentId,
      orderData?.shipmentId
    );

    console.log("[shipping/cancel-shipment] CONTEXT", {
      orderId,
      referenceId,
      shipmentId,
      shippingStatus: safeStr(orderData?.shippingStatus),
      orderStatus: safeStr(orderData?.status),
    });

    if (!referenceId || !shipmentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "İptal için referenceId ve shipmentId zorunlu.",
          stage: "validate_cancel_key",
        },
        { status: 400 }
      );
    }

    const proxyPayload = buildCancelShipmentProxyPayload(referenceId, shipmentId);

    console.log("[shipping/cancel-shipment] CALL_PROXY", {
      expectedProxyMethod: "PUT",
      expectedProxyPath: "/cancel-shipment",
      proxyPayload,
    });

    const proxyResult = await proxyCancelShipment(proxyPayload);

    console.log("[shipping/cancel-shipment] PROXY_RESULT", proxyResult);

    await orderRef.set(
      {
        shippingCancelled: true,
        shippingCancelledAt: FieldValue.serverTimestamp(),
        shippingCancelledAtIso: new Date().toISOString(),
        shippingStatus: "cancelled",
        shippingCancelRaw: (proxyResult as any)?.raw || null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      status: "cancelled",
      referenceId,
      shipmentId,
      raw: (proxyResult as any)?.raw || null,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    const message = safeStr(error?.message) || "CancelShipment başarısız.";

    console.error("[shipping/cancel-shipment] ERROR", {
      message,
      stack: error?.stack || null,
      durationMs: Date.now() - startedAt,
    });

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