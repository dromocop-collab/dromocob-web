import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase.admin";
import { AuthCodeError, issueAuthCode, queueAuthMail, requestIp } from "@/lib/authCode.server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!token) return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    const decoded = await adminAuth().verifyIdToken(token, true);
    const user = await adminAuth().getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: "Hesaba bağlı e-posta bulunamadı." }, { status: 400 });
    if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

    const issued = await issueAuthCode({
      purpose: "verify-email",
      identity: user.uid,
      email: user.email.toLowerCase(),
      uid: user.uid,
      ip: requestIp(request),
    });
    await queueAuthMail({ email: user.email, code: issued.code, purpose: "verify-email", expiresInMinutes: issued.expiresInMinutes });
    return NextResponse.json({ ok: true, cooldown: 60 });
  } catch (error) {
    if (error instanceof AuthCodeError && error.code === "cooldown") {
      return NextResponse.json({ error: "Yeni kod için 60 saniye bekleyin." }, { status: 429 });
    }
    console.error("verify-email-request", error);
    return NextResponse.json({ error: "Doğrulama kodu şu an gönderilemedi." }, { status: 500 });
  }
}
