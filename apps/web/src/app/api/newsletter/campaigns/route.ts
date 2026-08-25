import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

/**
 * GET /api/newsletter/campaigns — Kampanya listesi
 */
export async function GET() {
  try {
    const db = adminDb();
    const snap = await db
      .collection("newsletter_campaigns")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const campaigns = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
      sentAt: d.data().sentAt?.toDate?.()?.toISOString?.() || null,
    }));

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error("newsletter campaigns GET error:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
