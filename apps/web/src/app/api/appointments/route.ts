import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase.admin";
import { verifyAdmin } from "@/lib/apiAuth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\s-]{10,22}$/;
const STATUSES = new Set(["new", "contacted", "confirmed", "completed", "cancelled"]);

function text(value: unknown, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function html(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function clientIp(req: NextRequest) {
  return text(req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown", 80);
}

async function optionalUser(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, email: String(decoded.email || "").toLowerCase() };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (text(body?.website, 100)) return NextResponse.json({ ok: true });

    const fullName = text(body?.fullName, 90);
    const email = text(body?.email, 140).toLowerCase();
    const phone = text(body?.phone, 24);
    const appointmentDate = text(body?.appointmentDate, 10);
    const timeSlot = text(body?.timeSlot, 20);
    const meetingType = text(body?.meetingType, 20) === "online" ? "online" : "store";
    const interest = text(body?.interest, 80);
    const budget = text(body?.budget, 60);
    const note = text(body?.note, 900);
    const locale = text(body?.locale, 2) === "en" ? "en" : "tr";

    if (fullName.length < 3 || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "İletişim bilgilerini kontrol edin." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return NextResponse.json({ error: "Geçerli tarih ve saat seçin." }, { status: 400 });
    }
    const requested = new Date(`${appointmentDate}T${timeSlot}:00+03:00`);
    const now = new Date();
    const maxDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(requested.getTime()) || requested.getTime() < now.getTime() - 60_000 || requested > maxDate) {
      return NextResponse.json({ error: "Randevu tarihi uygun aralıkta değil." }, { status: 400 });
    }
    if (body?.consent !== true) {
      return NextResponse.json({ error: "KVKK iletişim onayı gerekli." }, { status: 400 });
    }

    const db = adminDb();
    const ipHash = createHash("sha256").update(`${clientIp(req)}:${process.env.APPOINTMENT_RATE_SALT || "Dromocob"}`).digest("hex");
    const dayKey = new Date().toISOString().slice(0, 10);
    const rateRef = db.collection("appointment_rate_limits").doc(`${dayKey}_${ipHash}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const count = Number(snap.data()?.count || 0);
      if (count >= 5) throw new Error("RATE_LIMIT");
      tx.set(rateRef, { count: count + 1, dayKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    const user = await optionalUser(req);
    if (user?.email && user.email !== email) {
      return NextResponse.json({ error: "E-posta, giriş yaptığınız hesapla eşleşmeli." }, { status: 403 });
    }

    const createdAt = FieldValue.serverTimestamp();
    const ref = db.collection("appointments").doc();
    await ref.set({
      fullName, email, phone, appointmentDate, timeSlot, meetingType, interest, budget, note, locale,
      requestedAt: Timestamp.fromDate(requested),
      status: "new",
      uid: user?.uid || null,
      source: "homepage_hero",
      consentAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      statusHistory: [{ status: "new", at: new Date().toISOString(), actor: "customer" }],
    });

    await db.collection("mail").add({
      to: process.env.APPOINTMENT_NOTIFICATION_EMAIL || "info@dromocob.tr",
      message: {
        subject: `Yeni özel randevu talebi • ${fullName}`,
        html: `<h2>Yeni özel randevu talebi</h2><p><strong>Müşteri:</strong> ${html(fullName)}</p><p><strong>İletişim:</strong> ${html(email)} • ${html(phone)}</p><p><strong>Tarih:</strong> ${html(appointmentDate)} ${html(timeSlot)}</p><p><strong>Görüşme:</strong> ${meetingType === "online" ? "Online" : "Mağaza"}</p><p><strong>İlgi:</strong> ${html(interest || "Belirtilmedi")}</p><p><strong>Bütçe:</strong> ${html(budget || "Belirtilmedi")}</p><p><strong>Not:</strong> ${html(note || "—")}</p>`,
      },
    });

    return NextResponse.json({ ok: true, appointmentId: ref.id }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "RATE_LIMIT") return NextResponse.json({ error: "Bugün çok fazla talep gönderdiniz." }, { status: 429 });
    console.error("appointment create error", error);
    return NextResponse.json({ error: "Randevu talebi kaydedilemedi." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("scope") === "mine") {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    try {
      const user = await adminAuth().verifyIdToken(token, true);
      const db = adminDb();
      const queries = [db.collection("appointments").where("uid", "==", user.uid).limit(100).get()];
      const accountEmail = String(user.email || "").trim().toLowerCase();
      if (accountEmail) queries.push(db.collection("appointments").where("email", "==", accountEmail).limit(100).get());
      const snapshots = await Promise.all(queries);
      const uniqueDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      snapshots.forEach((snapshot) => snapshot.docs.forEach((entry) => uniqueDocs.set(entry.id, entry)));
      const items = Array.from(uniqueDocs.values()).map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          appointmentDate: data.appointmentDate || "",
          timeSlot: data.timeSlot || "",
          meetingType: data.meetingType || "store",
          interest: data.interest || "",
          budget: data.budget || "",
          note: data.note || "",
          status: data.status || "new",
          customerMessage: data.customerMessage || "",
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
          statusHistory: Array.isArray(data.statusHistory)
            ? data.statusHistory.map((row: any) => ({ status: row?.status || "new", at: row?.at || null }))
            : [],
        };
      }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return NextResponse.json({ items });
    } catch {
      return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
    }
  }
  const admin = await verifyAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const snap = await adminDb().collection("appointments").orderBy("createdAt", "desc").limit(300).get();
  return NextResponse.json({ items: snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null })) });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await req.json();
    const id = text(body?.id, 100);
    const status = text(body?.status, 20);
    const adminNote = text(body?.adminNote, 1000);
    const customerMessage = text(body?.customerMessage, 700);
    if (!id || !STATUSES.has(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    await adminDb().collection("appointments").doc(id).set({
      status,
      adminNote,
      customerMessage,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.email || admin.uid,
      statusHistory: FieldValue.arrayUnion({ status, at: new Date().toISOString(), actor: admin.email || admin.uid }),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("appointment update error", error);
    return NextResponse.json({ error: "Randevu güncellenemedi." }, { status: 500 });
  }
}
