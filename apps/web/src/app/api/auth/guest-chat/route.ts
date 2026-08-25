import { createHash, randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase.admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`${forwarded}:guest-chat`).digest("hex");
    const day = new Date().toISOString().slice(0, 10);
    const limitRef = adminDb().collection("guest_chat_rate_limits").doc(`${day}_${ipHash}`);
    const allowed = await adminDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(limitRef);
      const count = Number(snapshot.data()?.count || 0);
      if (count >= 20) return false;
      transaction.set(limitRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: "Bugünkü misafir sohbet sınırına ulaşıldı." }, { status: 429 });

    const uid = `guest_${randomBytes(16).toString("hex")}`;
    const token = await adminAuth().createCustomToken(uid, { guest: true });
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("guest chat token", error);
    return NextResponse.json({ error: "Misafir sohbet oturumu başlatılamadı." }, { status: 500 });
  }
}
