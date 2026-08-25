import { NextRequest, NextResponse } from "next/server";
import { proxyTestToken } from "@/lib/shipping/proxy";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(_req: NextRequest) {
  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(_req);
    if (caller instanceof NextResponse) return caller;

    const result = await proxyTestToken();
    const jwt = safeStr(result?.jwt || result?.raw?.jwt);

    return NextResponse.json({
      ok: true,
      stage: "success",
      provider: "mng",
      message: "MNG bağlantısı başarılı. Token alındı.",
      jwtPreview: jwt ? `${jwt.slice(0, 16)}...` : "",
      raw: result?.raw || null,
    });
  } catch (error: any) {
    console.error("[shipping/test-connection] ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        stage: "catch",
        error: safeStr(error?.message) || "Bağlantı testi başarısız.",
      },
      { status: 500 }
    );
  }
}