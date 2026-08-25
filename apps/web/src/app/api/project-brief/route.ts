import { createHash, randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

export const dynamic = "force-dynamic";

const text = (value: unknown, max = 300) => String(value || "").trim().slice(0, max);
const allowedTypes = new Set(["E-Ticaret", "Rent a Car", "Kurumsal", "Gayrimenkul", "Otel & Turizm", "Restoran", "Sağlık", "Özel Proje"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (text(body.website, 100)) return NextResponse.json({ ok: true, reference: "DROMOCOB" });

    const siteType = text(body.siteType, 60);
    const name = text(body.name, 100);
    const email = text(body.email, 180).toLowerCase();
    const phone = text(body.phone, 50);
    if (!allowedTypes.has(siteType) || !name || !email.includes("@") || !phone || body.consent !== true) {
      return NextResponse.json({ error: "Lütfen zorunlu alanları doğru biçimde tamamlayın." }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`${forwarded}:dromocob-project`).digest("hex");
    const day = new Date().toISOString().slice(0, 10);
    const db = adminDb();
    const limitRef = db.collection("project_brief_rate_limits").doc(`${day}_${ipHash}`);
    const allowed = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(limitRef);
      const count = Number(snapshot.data()?.count || 0);
      if (count >= 5) return false;
      transaction.set(limitRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: "Bugünkü talep sınırına ulaştınız. Lütfen yarın tekrar deneyin." }, { status: 429 });

    const reference = `DRM-${day.replace(/-/g, "").slice(2)}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const features = Array.isArray(body.features) ? body.features.slice(0, 12).map((item: unknown) => text(item, 60)) : [];
    await db.collection("project_briefs").add({
      reference,
      siteType,
      design: text(body.design, 100),
      features,
      budget: text(body.budget, 80),
      timeline: text(body.timeline, 80),
      message: text(body.message, 2000),
      contact: { name, company: text(body.company, 140), email, phone },
      status: "new",
      source: "website-project-builder",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, reference });
  } catch (error) {
    console.error("project-brief", error);
    return NextResponse.json({ error: "Talebiniz şu an kaydedilemedi. Lütfen iletişim sayfasından bize ulaşın." }, { status: 500 });
  }
}
