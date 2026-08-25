import type { MetadataRoute } from "next";
import { adminDb } from "@/lib/firebase.admin";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";
import { sectors } from "@/data/studioCatalog";
import { mobileApps } from "@/data/mobileApps";

type AnyMap = Record<string, unknown>;

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function cleanUrl(url: string): string {
  return s(url).replace(/\/+$/, "");
}

function ensureLeadingSlash(path: string): string {
  const x = s(path);
  if (!x) return "/";
  return x.startsWith("/") ? x : `/${x}`;
}

function joinUrl(base: string, path: string): string {
  return `${cleanUrl(base)}${ensureLeadingSlash(path)}`;
}


function toDate(value: unknown, fallback = new Date()): Date {
  try {
    if (!value) return fallback;

    if (value instanceof Date) return value;

    if (typeof (value as any)?.toDate === "function") {
      const d = (value as any).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : fallback;
    }

    if (typeof (value as any)?.seconds === "number") {
      const d = new Date((value as any).seconds * 1000);
      return !Number.isNaN(d.getTime()) ? d : fallback;
    }

    const d = new Date(String(value));
    return !Number.isNaN(d.getTime()) ? d : fallback;
  } catch {
    return fallback;
  }
}

function clampPriority(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pushUnique(
  list: MetadataRoute.Sitemap,
  seen: Set<string>,
  entry: MetadataRoute.Sitemap[number]
) {
  const url = cleanUrl(entry.url);
  if (!url || seen.has(url)) return;

  seen.add(url);

  list.push({
    ...entry,
    url,
    priority:
      typeof entry.priority === "number"
        ? clampPriority(entry.priority)
        : entry.priority,
  });
}

function pickText(value: unknown): string {
  if (typeof value === "string") return s(value);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return s(v.tr || v.en || v.title || v.name || "");
  }
  return "";
}

function pickSlug(doc: AnyMap): string {
  return s(doc.slug || doc.handle || doc.path || "");
}

function isActiveDoc(doc: AnyMap): boolean {
  const a = doc.isActive;
  const b = doc.active;

  if (typeof a === "boolean") return a;
  if (typeof b === "boolean") return b;

  return true;
}

function isNoindexDoc(doc: AnyMap): boolean {
  if (typeof doc.noindex === "boolean") return doc.noindex;
  if (typeof doc.index === "boolean") return !doc.index;
  return false;
}

function detectUpdatedAt(doc: AnyMap): Date {
  return toDate(
    doc.updatedAt ||
      doc.lastModified ||
      doc.modifiedAt ||
      doc.createdAt ||
      doc.publishedAt,
    new Date()
  );
}

function normalizePath(path: string): string {
  const raw = ensureLeadingSlash(path);
  return raw === "/" ? raw : raw.replace(/\/+$/, "");
}

/* ────────────────────────────────────────
 *  Sitemap Filtreleme — Şüpheli / Test / Dummy URL'leri engelle
 * ──────────────────────────────────────── */

/** Kesinlikle sitemap'a girmemesi gereken slug değerleri */
const SUSPICIOUS_SLUGS = new Set([
  "d", "a1", "test", "demo", "deneme", "undefined", "null",
  "asdf", "asd", "abc", "xxx", "temp", "tmp", "draft",
  "dummy", "example", "ornek", "yeni", "new", "zzz",
]);

/** Sitemap'tan hariç tutulacak URL prefix'leri (tüm sectionlarda geçerli) */
const BLOCKED_URL_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot",
  "/verify-email",
  "/cart",
  "/checkout",
  "/search",
  "/api",
  "/hesabim",
  "/account",
  "/new",
  "/test",
  "/deneme",
  "/products/id",
  "/products",
  "/shop",
  "/demo",
  "/sertifika-guvence",
  "/olcu-rehberi",
  "/hediye-danismanligi",
  "/randevu-magaza-deneyimi",
  "/rates",
  "/kargo-teslimat",
];

/**
 * Slug değeri sitemap için geçersiz mi?
 * - Boş veya çok kısa (≤1 karakter)
 * - Bilinen şüpheli/test değer
 * - Sadece rakamlardan oluşan (ör. "1", "23")
 */
function isSuspiciousSlug(slug: string): boolean {
  const clean = s(slug).toLowerCase();
  if (!clean || clean.length <= 1) return true;
  if (SUSPICIOUS_SLUGS.has(clean)) return true;
  // Sadece rakam olan slug'lar (ör. "1", "23", "456")
  if (/^\d+$/.test(clean)) return true;
  return false;
}

/** URL path engelli prefix'lerden birine denk geliyor mu? */
function isBlockedUrl(urlPath: string): boolean {
  return BLOCKED_URL_PREFIXES.some(
    (prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`)
  );
}

function pageUrlFromDoc(doc: AnyMap): string {
  const directPath = s(doc.path || doc.urlPath || "");
  if (directPath) return normalizePath(directPath);

  const group = s(doc.group || doc.groupSlug || "");
  const slug = pickSlug(doc);

  if (group && slug) {
    return normalizePath(`/${encodeURIComponent(group)}/${encodeURIComponent(slug)}`);
  }

  if (slug) {
    return normalizePath(`/${encodeURIComponent(slug)}`);
  }

  return "";
}

function categoryUrlFromDoc(doc: AnyMap): string {
  const directPath = s(doc.path || doc.urlPath || "");
  if (directPath) return normalizePath(directPath);

  const slug = pickSlug(doc);
  if (!slug) return "";

  // Kategori grubunu kontrol et — varsa group/slug formatında URL üret
  const group = s(doc.group || doc.groupSlug || doc.parentSlug || "");
  if (group) {
    return normalizePath(`/${encodeURIComponent(group)}/${encodeURIComponent(slug)}`);
  }

  // Eğer grup yoksa doğrudan slug-bazlı URL (ör. /bileklik, /kupe)
  return normalizePath(`/${encodeURIComponent(slug)}`);
}

function productUrlFromDoc(doc: AnyMap): string {
  const directPath = s(doc.path || doc.urlPath || "");
  if (directPath) return normalizePath(directPath);

  const slug = pickSlug(doc);
  if (!slug) return "";

  return normalizePath(`/products/${encodeURIComponent(slug)}`);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeoSettings();
  const base = cleanUrl(resolveBaseUrl(seo) || "https://dromocob.com");

  const sitemap: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  const now = new Date();

  // 1) Sabit ve vitrinsel sayfalar
  const staticRoutes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/iletisim", changeFrequency: "monthly", priority: 0.75 },
    { path: "/sektorler", changeFrequency: "weekly", priority: 0.92 },
    ...sectors.map((sector) => ({ path: `/sektorler/${sector.slug}`, changeFrequency: "weekly" as const, priority: 0.88 })),
    { path: "/mobil-uygulama-gelistirme", changeFrequency: "weekly", priority: 0.94 },
    { path: "/projelerimiz", changeFrequency: "weekly", priority: 0.96 },
    ...mobileApps.map((app) => ({ path: `/mobil-uygulama/${app.slug}`, changeFrequency: "weekly" as const, priority: 0.90 })),
    { path: "/sss", changeFrequency: "monthly", priority: 0.70 },
    { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.72 },
    // Yasal sayfalar
    { path: "/gizlilik-politikasi", changeFrequency: "yearly", priority: 0.40 },
    { path: "/kullanim-kosullari", changeFrequency: "yearly", priority: 0.40 },
    { path: "/cerez-politikasi", changeFrequency: "yearly", priority: 0.35 },
    { path: "/kvkk-aydinlatma-metni", changeFrequency: "yearly", priority: 0.35 },
    { path: "/iade-ve-iptal-kosullari", changeFrequency: "yearly", priority: 0.45 },
    { path: "/mesafeli-satis-sozlesmesi", changeFrequency: "yearly", priority: 0.40 },
    { path: "/on-bilgilendirme-formu", changeFrequency: "yearly", priority: 0.35 },
  ];

  for (const route of staticRoutes) {
    pushUnique(sitemap, seen, {
      url: joinUrl(base, route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  // 2) Ürünler
  try {
    const snap = await adminDb().collection("products").get();

    snap.forEach((docSnap) => {
      const doc = (docSnap.data() || {}) as AnyMap;

      if (!isActiveDoc(doc)) return;
      if (isNoindexDoc(doc)) return;

      const slug = pickSlug(doc);
      if (isSuspiciousSlug(slug)) return;

      const title = pickText(doc.title || doc.name);
      const urlPath = productUrlFromDoc(doc);

      if (!urlPath || !title) return;
      if (isBlockedUrl(urlPath)) return;

      pushUnique(sitemap, seen, {
        url: joinUrl(base, urlPath),
        lastModified: detectUpdatedAt(doc),
        changeFrequency: "weekly",
        priority: 0.88,
      });
    });
  } catch (error) {
    console.error("sitemap products error:", error);
  }

  // 3) Kategoriler
  try {
    const snap = await adminDb().collection("categories").get();

    snap.forEach((docSnap) => {
      const doc = (docSnap.data() || {}) as AnyMap;

      if (!isActiveDoc(doc)) return;
      if (isNoindexDoc(doc)) return;

      const slug = pickSlug(doc);
      if (isSuspiciousSlug(slug)) return;

      const title = pickText(doc.title || doc.name);
      const urlPath = categoryUrlFromDoc(doc);

      if (!urlPath || !title) return;
      if (isBlockedUrl(urlPath)) return;

      pushUnique(sitemap, seen, {
        url: joinUrl(base, urlPath),
        lastModified: detectUpdatedAt(doc),
        changeFrequency: "weekly",
        priority: 0.74,
      });
    });
  } catch (error) {
    console.error("sitemap categories error:", error);
  }

  // 4) CMS / Sayfalar
  try {
    const snap = await adminDb().collection("pages").get();

    snap.forEach((docSnap) => {
      const doc = (docSnap.data() || {}) as AnyMap;

      if (!isActiveDoc(doc)) return;
      if (isNoindexDoc(doc)) return;

      const slug = pickSlug(doc);
      if (isSuspiciousSlug(slug)) return;

      const title = pickText(doc.title || doc.name);
      const urlPath = pageUrlFromDoc(doc);

      if (!urlPath || !title) return;
      if (isBlockedUrl(urlPath)) return;

      pushUnique(sitemap, seen, {
        url: joinUrl(base, urlPath),
        lastModified: detectUpdatedAt(doc),
        changeFrequency: "monthly",
        priority: 0.62,
      });
    });
  } catch (error) {
    console.error("sitemap pages error:", error);
  }

  // 5) Son temizlik ve sıralama
  return sitemap
    .filter((item) => {
      const url = cleanUrl(item.url);
      return !!url && url.startsWith(base);
    })
    .sort((a, b) => a.url.localeCompare(b.url, "tr"));
}
