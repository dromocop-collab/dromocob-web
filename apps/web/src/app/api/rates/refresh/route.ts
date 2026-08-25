import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

function s(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const db = adminDb();

    const publicSnap = await db.collection("settings").doc("public").get();
    const publicCfg = publicSnap.exists ? publicSnap.data() || {} : {};

    const ratesEnabled = publicCfg?.ratesEnabled !== false;
    const freezeRates = publicCfg?.freezeRates === true;

    if (!ratesEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kur sistemi kapalı.",
          code: "RATES_DISABLED",
        },
        { status: 403 }
      );
    }

    if (freezeRates) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kur sistemi dondurulmuş.",
          code: "RATES_FROZEN",
        },
        { status: 403 }
      );
    }

    const fnUrl = process.env.RATES_REFRESH_FUNCTION_URL;
    const secret = process.env.RATES_REFRESH_SECRET;

    if (!fnUrl || !secret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing env",
          hasFnUrl: !!fnUrl,
          hasSecret: !!secret,
        },
        { status: 500 }
      );
    }

    let source = "web_refresh_route";
    try {
      const body = await req.json();
      source = s(body?.source) || source;
    } catch {
      // body yoksa sorun değil
    }

    const r = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-refresh-secret": secret,
      },
      body: JSON.stringify({ source }),
      cache: "no-store",
    });

    const text = await r.text().catch(() => "");
    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(
      {
        ok: r.ok,
        upstreamStatus: r.status,
        ratesEnabled,
        freezeRates,
        ...data,
      },
      { status: r.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "server error",
      },
      { status: 500 }
    );
  }
}