/**
 * GEÇİCİ — Dromocob Control env doğrulama endpoint'i.
 *
 * Yalnızca env değişkenlerinin set edilip edilmediğini
 * boolean olarak döndürür.
 *
 * ⚠️  Secret'ın kendisi ASLA response'a dahil edilmez.
 * ⚠️  Bu dosya doğrulama tamamlandıktan sonra SİLİNMELİDİR.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const siteId = process.env.DROMOCOB_CONTROL_SITE_ID || "";
  const secret = process.env.DROMOCOB_CONTROL_SECRET || "";

  return NextResponse.json(
    {
      siteIdConfigured: siteId.length > 0,
      secretConfigured: secret.length >= 40,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
