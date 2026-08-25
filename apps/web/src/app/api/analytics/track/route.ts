/**
 * POST /api/analytics/track
 *
 * Sayfa görüntüleme, ürün inceleme, sepete ekleme ve satın alma tracker.
 * Firestore'da analytics_daily/{YYYY-MM-DD} dökümanına gün gün veri yazar.
 *
 * Filtreler:
 *  - Bot/crawler User-Agent → 204 (sessiz)
 *  - Admin path → atla
 *  - Localhost / preview → atla
 *
 * Body: {
 *   type: "pageview" | "product_view" | "add_to_cart" | "purchase",
 *   path?: string,
 *   productId?: string,
 *   productTitle?: string,
 *   visitorId?: string,    // cookie-based tekil ziyaretçi ID
 *   orderValue?: number,   // purchase event için sipariş tutarı
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";
import { FieldValue } from "firebase-admin/firestore";

/* ──────── Helpers ──────── */

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Bilinen bot/crawler User-Agent kalıpları */
const BOT_PATTERNS = [
  /bot\b/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /mediapartners/i,
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
  /headlesschrome/i,
  /lighthouse/i,
  /pagespeed/i,
  /gtmetrix/i,
  /pingdom/i,
  /uptimerobot/i,
];

function isBot(ua: string): boolean {
  if (!ua) return true; // UA yok → muhtemelen bot
  return BOT_PATTERNS.some((p) => p.test(ua));
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("localhost") ||
    h.includes("127.0.0.1") ||
    h.includes("0.0.0.0") ||
    h.endsWith(".vercel.app") // preview deploy
  );
}

function isAdminPath(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/api");
}

/** Firestore dot-notation güvenli visitor ID */
function sanitizeVid(vid: string): string {
  return vid
    .replace(/[.\/\[\]~*]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

/* ──────── Route Handler ──────── */

export async function POST(req: NextRequest) {
  try {
    // ── Filtreler ──
    const ua = req.headers.get("user-agent") || "";
    const host = req.headers.get("host") || "";

    // Bot filtresi
    if (isBot(ua)) {
      return new NextResponse(null, { status: 204 });
    }

    // Localhost / preview filtresi
    if (isBlockedHost(host)) {
      return new NextResponse(null, { status: 204 });
    }

    const body = await req.json();
    const type = String(body?.type || "pageview").trim();
    const path = String(body?.path || "/").trim();
    const productId = String(body?.productId || "").trim();
    const productTitle = String(body?.productTitle || "").trim();
    const visitorId = String(body?.visitorId || "").trim();
    const orderValue = Number(body?.orderValue || 0);
    const source = sanitizeVid(String(body?.source || "unknown").trim()) || "unknown";

    // Admin path filtresi
    if (isAdminPath(path)) {
      return NextResponse.json({ ok: true });
    }

    const db = adminDb();
    const dateKey = todayKey();
    const docRef = db.collection("analytics_daily").doc(dateKey);

    // ── Tekil ziyaretçi takibi (cookie-based visitor ID) ──
    const visitorUpdate: Record<string, any> = {};
    const cleanVid = visitorId ? sanitizeVid(visitorId) : "";
    if (cleanVid) {
      // Firestore'da visitors map'ine ekle (dot-notation güvenli)
      visitorUpdate[`visitors.${cleanVid}`] = true;

    }

    if (type === "product_view" && productId) {
      // ── Ürün görüntüleme ──
      await docRef.set(
        {
          date: dateKey,
          productViews: FieldValue.increment(1),
          [`viewedProducts.${productId}`]: FieldValue.increment(1),
          [`productTitles.${productId}`]: productTitle || productId,
          ...visitorUpdate,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (type === "add_to_cart") {
      // ── Sepete ekleme ──
      await docRef.set(
        {
          date: dateKey,
          addToCartCount: FieldValue.increment(1),
          ...visitorUpdate,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (type === "purchase") {
      // ── Satın alma ──
      await docRef.set(
        {
          date: dateKey,
          purchaseCount: FieldValue.increment(1),
          ...(orderValue > 0
            ? { purchaseRevenue: FieldValue.increment(orderValue) }
            : {}),
          ...visitorUpdate,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (type === "app_download") {
      await docRef.set({ date: dateKey, appDownloadCount: FieldValue.increment(1), [`appDownloadSources.${source}`]: FieldValue.increment(1), ...visitorUpdate, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else if (type === "appointment_request") {
      await docRef.set({ date: dateKey, appointmentRequestCount: FieldValue.increment(1), ...visitorUpdate, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      // ── Sayfa görüntüleme (varsayılan) ──
      await docRef.set(
        {
          date: dateKey,
          pageViews: FieldValue.increment(1),
          [`topPages.${path}`]: FieldValue.increment(1),
          ...visitorUpdate,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Tekil ziyaretçi sayısını hesapla
    // visitors map'inin key sayısı = tekil ziyaretçi
    // Bu alan her event'te güncellenmez, günlük rapor okunurken hesaplanır

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[analytics/track] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
