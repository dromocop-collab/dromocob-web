"use client";

/**
 * Sayfa görüntüleme, ürün inceleme, sepete ekleme ve satın alma olaylarını
 * /api/analytics/track endpoint'ine gönderir.
 *
 * Filtreler:
 *  - Admin sayfaları hariç
 *  - Bot / headless tarayıcı hariç
 *  - Localhost / preview hariç
 *  - Ürün görüntüleme: oturum başına ürün bazında dedupe
 *
 * Export'lar:
 *  - <AnalyticsTracker /> → layout'a koy, her route'ta pageview
 *  - trackProductView(id, title) → ürün detayında çağır
 *  - trackCartAdd(productId) → sepete eklemede çağır
 *  - trackPurchase(orderValue) → başarılı siparişte çağır
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* ──────── Visitor ID (cookie-based tekil ziyaretçi) ──────── */

const VID_KEY = "nci_vid";

function getVisitorId(): string {
  if (typeof document === "undefined") return "";

  // Cookie'den oku
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${VID_KEY}=([^;]+)`)
  );
  if (match) return match[1];

  // Yoksa oluştur ve 1 yıllık cookie yaz
  const vid = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${VID_KEY}=${vid};path=/;expires=${expires};SameSite=Lax`;
  return vid;
}

/* ──────── Client-Side Filtreler ──────── */

function isClientBot(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /bot|crawl|spider|headlesschrome|lighthouse|pagespeed/i.test(ua) ||
    !ua // UA boş → muhtemelen bot
  );
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

function shouldTrack(): boolean {
  return !isClientBot() && !isLocalhost();
}

/* ──────── sendTrack ──────── */

function sendTrack(data: Record<string, string | number>) {
  if (!shouldTrack()) return;

  try {
    const payload = {
      ...data,
      visitorId: getVisitorId(),
    };

    const ok = navigator.sendBeacon(
      "/api/analytics/track",
      new Blob([JSON.stringify(payload)], { type: "application/json" })
    );

    if (!ok) {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Sessiz hata
  }
}

/* ──────── Ürün Görüntüleme (oturum başına dedupe) ──────── */

const PRODUCT_VIEW_PREFIX = "nci_pv_";

export function trackProductView(productId: string, productTitle?: string) {
  if (!productId || !shouldTrack()) return;

  // Oturum içinde aynı ürünü tekrar sayma
  const key = `${PRODUCT_VIEW_PREFIX}${productId}`;
  if (typeof sessionStorage !== "undefined") {
    if (sessionStorage.getItem(key)) return; // Zaten izlendi
    sessionStorage.setItem(key, "1");
  }

  sendTrack({
    type: "product_view",
    path: typeof window !== "undefined" ? window.location.pathname : "",
    productId,
    productTitle: productTitle || "",
  });
}

/* ──────── Sepete Ekleme ──────── */

export function trackCartAdd(productId?: string) {
  if (!shouldTrack()) return;

  sendTrack({
    type: "add_to_cart",
    path: typeof window !== "undefined" ? window.location.pathname : "",
    ...(productId ? { productId } : {}),
  });
}

/* ──────── Satın Alma ──────── */

export function trackPurchase(orderValue?: number) {
  if (!shouldTrack()) return;

  sendTrack({
    type: "purchase",
    path: typeof window !== "undefined" ? window.location.pathname : "",
    ...(orderValue && orderValue > 0 ? { orderValue } : {}),
  });
}

export function trackAppDownload(source: string) {
  sendTrack({ type: "app_download", path: typeof window !== "undefined" ? window.location.pathname : "", source: String(source || "unknown").slice(0, 40) });
}

export function trackAppointmentRequest() {
  sendTrack({ type: "appointment_request", path: typeof window !== "undefined" ? window.location.pathname : "" });
}

/* ──────── Otomatik Pageview Bileşeni ──────── */

/**
 * Her route değişiminde otomatik pageview gönderen bileşen.
 * Root layout'a bir kez ekle.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    // Admin sayfalarını ve API'leri takip etme
    if (
      !pathname ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api")
    ) {
      return;
    }

    // Aynı path'i tekrar gönderme (SPA navigasyonlarında)
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    sendTrack({ type: "pageview", path: pathname });
  }, [pathname]);

  return null;
}
