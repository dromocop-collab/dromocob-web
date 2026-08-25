import { NextRequest, NextResponse } from "next/server";

/**
 * API rate limiter — brute force ve DDoS koruması.
 *
 * In-memory sliding window: her IP + path pattern için
 * belirli sürede max istek sayısı.
 *
 * Admin panelden gelen istekler (Bearer token taşıyanlar) rate
 * limit'ten muaftır — verifyAdmin zaten onları doğruluyor.
 *
 * NOT: Serverless ortamda her instance kendi Map'ini tutar.
 * Tam koruma için Cloudflare/Vercel WAF önerilir, ama bu katman
 * büyük çoğunluk saldırıyı durdurur.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// ── Temizlik (bellek taşmasını önle) ──
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000; // 1 dakika
const MAX_ENTRIES = 10_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && store.size < MAX_ENTRIES) return;
  lastCleanup = now;

  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}

// ── Limitler ──
// pattern: yol eşleştirme, limit: max istek, windowMs: pencere süresi
const LIMITS: { pattern: string; limit: number; windowMs: number }[] = [
  // 🔒 Admin auth — en katı (token'sız istekler için)
  { pattern: "/api/admin/set-claim", limit: 5, windowMs: 60_000 },

  // 🔒 Fiyat güncelleme
  { pattern: "/api/admin/categories/apply-pricing", limit: 60, windowMs: 60_000 },

  // 🔒 Kargo — orta
  { pattern: "/api/shipping/", limit: 30, windowMs: 60_000 },

  // 🔒 İade
  { pattern: "/api/returns/", limit: 30, windowMs: 60_000 },

  // 🔒 Kur güncelleme
  { pattern: "/api/rates/refresh", limit: 10, windowMs: 60_000 },

  // 💳 Ödeme başlatma — dikkatli
  { pattern: "/api/payments/start", limit: 15, windowMs: 60_000 },

  // Genel API fallback
  { pattern: "/api/", limit: 60, windowMs: 60_000 },
];

function getClientIp(req: NextRequest): string {
  // Cloudflare / Vercel / load balancer header'ları
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.ip ||
    "unknown"
  );
}

function findLimit(path: string) {
  return LIMITS.find((l) => path.startsWith(l.pattern)) || null;
}

function checkLimit(key: string, limit: number, windowMs: number): boolean {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  // Yeni pencere
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  // Limit aşıldı
  if (entry.count >= limit) return false;

  // Sayacı artır
  entry.count++;
  return true;
}

/**
 * Bearer token taşıyan admin isteklerini tespit et.
 * Bu istekler verifyAdmin tarafından zaten doğrulanıyor,
 * rate limit'e gerek yok.
 */
function hasAdminToken(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.length > 20;
}

// ── Middleware ──

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Sadece API route'larını kontrol et
  if (!path.startsWith("/api/")) return NextResponse.next();

  // ⚠️ PayTR callback'i HARİÇ TUT — ödeme bildirimlerini engelleme
  if (path.startsWith("/api/payments/paytr/callback")) {
    return NextResponse.next();
  }

  // ✅ Admin token taşıyan istekler rate limit'ten muaf
  // (verifyAdmin zaten kimlik doğrulaması yapıyor)
  if (hasAdminToken(req)) {
    return NextResponse.next();
  }

  const rule = findLimit(path);
  if (!rule) return NextResponse.next();

  const ip = getClientIp(req);
  const key = `${ip}::${rule.pattern}`;
  const allowed = checkLimit(key, rule.limit, rule.windowMs);

  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Çok fazla istek. Lütfen biraz bekleyip tekrar deneyin.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rule.windowMs / 1000)),
        },
      }
    );
  }

  return NextResponse.next();
}

// Sadece API route'larında çalış — sayfalara, static dosyalara dokunma
export const config = {
  matcher: "/api/:path*",
};
