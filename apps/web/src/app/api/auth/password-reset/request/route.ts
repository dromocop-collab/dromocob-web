import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase.admin";
import { AuthCodeError, cleanEmail, issueAuthCode, queueAuthMail, requestIp } from "@/lib/authCode.server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = cleanEmail(body.email);
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });

    try {
      const user = await adminAuth().getUserByEmail(email);
      const issued = await issueAuthCode({ purpose: "reset-password", identity: email, email, uid: user.uid, ip: requestIp(request) });
      await queueAuthMail({ email, code: issued.code, purpose: "reset-password", expiresInMinutes: issued.expiresInMinutes });
    } catch (error: any) {
      if (error instanceof AuthCodeError) throw error;
      if (!String(error?.code || "").includes("user-not-found")) throw error;
    }

    // Hesap varlığını dışarı sızdırmamak için her durumda aynı yanıt.
    return NextResponse.json({ ok: true, cooldown: 60 });
  } catch (error) {
    if (error instanceof AuthCodeError && error.code === "cooldown") {
      return NextResponse.json({ error: "Yeni kod için 60 saniye bekleyin." }, { status: 429 });
    }
    console.error("password-reset-request", error);
    return NextResponse.json({ error: "Kod şu an gönderilemedi." }, { status: 500 });
  }
}
