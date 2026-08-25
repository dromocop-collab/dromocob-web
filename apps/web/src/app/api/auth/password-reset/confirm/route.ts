import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase.admin";
import { AuthCodeError, cleanEmail, consumeAuthCode } from "@/lib/authCode.server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = cleanEmail(body.email);
    const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
    const newPassword = String(body.newPassword || "");
    if (!email.includes("@") || code.length !== 6) return NextResponse.json({ error: "E-posta veya kod geçersiz." }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ error: "Yeni şifre en az 8 karakter olmalı." }, { status: 400 });

    const result = await consumeAuthCode({ purpose: "reset-password", identity: email, code });
    await adminAuth().updateUser(result.uid, { password: newPassword });
    await adminAuth().revokeRefreshTokens(result.uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthCodeError) {
      const messages = { invalid: "Kod hatalı.", expired: "Kodun süresi doldu.", attempts: "Deneme sınırı aşıldı. Yeni kod isteyin.", missing: "Aktif kod bulunamadı. Yeni kod isteyin.", cooldown: "Biraz bekleyin." };
      return NextResponse.json({ error: messages[error.code] }, { status: 400 });
    }
    console.error("password-reset-confirm", error);
    return NextResponse.json({ error: "Şifre yenilenemedi." }, { status: 500 });
  }
}
