/**
 * POST /api/meta/event
 *
 * Client-side'dan çağrılır. Aynı event'i server-side'dan
 * Meta Conversions API'ye (CAPI) gönderir.
 *
 * Client-side pixel event'i ayrıca çalışmaya devam eder (dedup: event_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { sendCAPIEvent, type CAPIEventData } from "@/lib/metaCAPI.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const eventName = String(body?.eventName || "").trim();
    const eventId = String(body?.eventId || "").trim();

    if (!eventName || !eventId) {
      return NextResponse.json(
        { error: "eventName and eventId required" },
        { status: 400 }
      );
    }

    // Client IP ve User-Agent header'dan al
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    const userAgent = req.headers.get("user-agent") || "";

    // Facebook click ID ve browser ID (cookie'den)
    const fbc = extractCookie(req, "_fbc");
    const fbp = extractCookie(req, "_fbp");

    const eventData: CAPIEventData = {
      eventName,
      eventId,
      eventSourceUrl: String(body?.eventSourceUrl || "").trim() || undefined,
      actionSource: "website",
      userData: {
        ...(body?.userData || {}),
        clientIpAddress: clientIp,
        clientUserAgent: userAgent,
        fbc: fbc || body?.userData?.fbc || undefined,
        fbp: fbp || body?.userData?.fbp || undefined,
      },
      customData: body?.customData || undefined,
    };

    const result = await sendCAPIEvent(eventData);

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e: any) {
    console.error("[/api/meta/event] error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

function extractCookie(req: NextRequest, name: string): string {
  const cookie = req.cookies.get(name);
  return cookie?.value || "";
}
