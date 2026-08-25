import { NextRequest, NextResponse } from "next/server";
import { getApps, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  buildCreateRecipientProxyPayload,
  proxyCreateRecipient,
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

export async function POST(req: NextRequest) {
  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json().catch(() => null);
    const orderId = safeStr(body?.orderId);

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId zorunlu.", stage: "validate_request" }, { status: 400 });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const settingsRef = db.collection("settings").doc("shipping");

    const [orderSnap, settingsSnap] = await Promise.all([orderRef.get(), settingsRef.get()]);

    if (!orderSnap.exists) {
      return NextResponse.json({ ok: false, error: "Sipariş bulunamadı.", stage: "load_order" }, { status: 404 });
    }

    const orderData = orderSnap.data() || {};
    const settingsData = settingsSnap.exists ? settingsSnap.data() : {};

    const shippingEnabled =
      settingsData?.activeProvider === "mng" &&
      settingsData?.features?.createShipment !== false &&
      settingsData?.providers?.mng?.isActive !== false;

    if (!shippingEnabled) {
      return NextResponse.json({ ok: false, error: "MNG create-recipient şu anda pasif.", stage: "validate_shipping_settings" }, { status: 400 });
    }

    if (safeStr(orderData?.shippingRecipientCreatedAtIso)) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        stage: "already_exists",
        recipientCreatedAtIso: safeStr(orderData?.shippingRecipientCreatedAtIso),
      });
    }

    const shipmentInput = buildShipmentInputFromOrder(orderId, orderData);
    const proxyPayload = buildCreateRecipientProxyPayload(shipmentInput);
    const proxyResult = await proxyCreateRecipient(proxyPayload);
    const raw = proxyResult?.raw || null;

    await orderRef.set(
      {
        shippingRecipientCreated: true,
        shippingRecipientRaw: raw,
        shippingRecipientCreatedAt: FieldValue.serverTimestamp(),
        shippingRecipientCreatedAtIso: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      status: "recipient_created",
      raw,
    });
  } catch (error: any) {
    console.error("[shipping/create-recipient] ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        stage: "catch",
        error: safeStr(error?.message) || "CreateRecipient başarısız.",
      },
      { status: 500 }
    );
  }
}