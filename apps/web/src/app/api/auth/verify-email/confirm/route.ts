import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase.admin";
import { AuthCodeError, consumeAuthCode } from "@/lib/authCode.server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!token) return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    const decoded = await adminAuth().verifyIdToken(token, true);
    const body = await request.json();
    const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return NextResponse.json({ error: "6 haneli kodu girin." }, { status: 400 });

    await consumeAuthCode({ purpose: "verify-email", identity: decoded.uid, code });
    await adminAuth().updateUser(decoded.uid, { emailVerified: true });
    await adminDb().collection("users").doc(decoded.uid).set({ emailVerified: true, emailVerifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthCodeError) {
      const messages = { invalid: "Kod hatalı.", expired: "Kodun süresi doldu.", attempts: "Deneme sınırı aşıldı. Yeni kod isteyin.", missing: "Aktif kod bulunamadı. Yeni kod isteyin.", cooldown: "Biraz bekleyin." };
      return NextResponse.json({ error: messages[error.code] }, { status: 400 });
    }
    console.error("verify-email-confirm", error);
    return NextResponse.json({ error: "E-posta doğrulanamadı." }, { status: 500 });
  }
}
