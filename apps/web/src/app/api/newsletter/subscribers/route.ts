import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

/**
 * GET  /api/newsletter/subscribers — Tüm aboneleri listele
 * POST /api/newsletter/subscribers — Yeni abone ekle (public, frontend'den)
 * DELETE /api/newsletter/subscribers?id=xxx — Abone sil
 */

export async function GET() {
  try {
    const db = adminDb();
    const snap = await db
      .collection("newsletter_subscribers")
      .orderBy("subscribedAt", "desc")
      .get();

    const subs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      subscribedAt: d.data().subscribedAt?.toDate?.()?.toISOString?.() || null,
    }));

    return NextResponse.json({ subs });
  } catch (err: any) {
    console.error("newsletter subscribers GET error:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id gereklidir" }, { status: 400 });
    }

    const db = adminDb();
    await db.collection("newsletter_subscribers").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("newsletter subscribers DELETE error:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
