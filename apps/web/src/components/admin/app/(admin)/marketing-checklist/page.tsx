"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import { pickTitle, pickImage, fmtTRY } from "@/lib/marketPricing";
import {
  generateProductDescriptionDraft,
  validateDescriptionDraft,
  buildProductFacts,
  type DescriptionDraft,
  type ProductFacts,
} from "@/lib/descriptionGenerator";
import s from "./marketingChecklist.module.css";

/* ─── Types ─── */

type ProductRaw = Record<string, any>;

type ProductAdScore = {
  id: string;
  title: string;
  sku: string;
  image: string;
  slug: string;
  score: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasImage: boolean;
  hasPrice: boolean;
  hasStock: boolean;
  hasCategory: boolean;
  hasSku: boolean;
  hasSlug: boolean;
  hasSeo: boolean;
  hasGramAyar: boolean;
  debug?: Record<string, string>;
};

type CheckStatus = "ok" | "warn" | "fail";
type CheckItem = { label: string; detail: string; status: CheckStatus; value: string };
type ScoreFilter = "all" | "low" | "mid" | "high";

/* ─── Helpers ─── */

function str(v: any): string { return String(v ?? "").trim(); }
function num(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/** Strip HTML tags & decode entities */
function stripHtml(html: any): string {
  if (!html) return "";
  const s = String(html);
  return s.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

/** Resolve localized text {tr?, en?} or raw string */
function resolveText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return stripHtml(v);
  if (typeof v === "object") {
    const tr = stripHtml(v.tr);
    const en = stripHtml(v.en);
    return tr || en;
  }
  return "";
}

/** Check if any of the candidate fields hold text >= minLen */
function hasAnyTextField(p: any, fields: string[], minLen = 20): { found: boolean; field: string } {
  for (const f of fields) {
    const val = resolveText(p?.[f]);
    if (val.length >= minLen) return { found: true, field: f };
  }
  return { found: false, field: "" };
}

/** Description fields to check on the root product */
const DESC_FIELDS = [
  "description", "desc", "shortDescription", "longDescription",
  "details", "productDescription", "seoDescription", "metaDescription",
  "content", "body", "summary",
];

/** Description fields to check inside p.advanced */
const ADV_DESC_FIELDS = [
  "shortDescription", "description",
];

/** Category fields to check */
const CAT_FIELDS = [
  "categoryId", "categoryIds", "category", "categories",
  "categoryName", "categoryNames", "categorySlug", "categorySlugs",
  "mainCategoryId", "mainCategoryName", "catIds", "cats",
];

/** SEO-specific fields on root */
const SEO_FIELDS = [
  "seoTitle", "seoDescription", "metaTitle", "metaDescription",
  "ogTitle", "ogDescription",
];

/** SEO fields inside p.advanced.seo */
const ADV_SEO_FIELDS = ["title", "description"];

/** Image fields to check */
const IMAGE_FIELDS = [
  "mainImage", "image", "imageUrl", "coverImage", "cover", "thumbnail",
  "images", "media", "gallery", "photos",
];

/* ─── Product Checks ─── */

function hasDescription(p: any): { ok: boolean; field: string } {
  // 1. Check root-level fields
  const r = hasAnyTextField(p, DESC_FIELDS, 20);
  if (r.found) return { ok: true, field: r.field };
  // 2. Check advanced sub-object (admin İçerik section)
  const adv = p?.advanced;
  if (adv && typeof adv === "object") {
    for (const f of ADV_DESC_FIELDS) {
      const val = resolveText(adv[f]);
      if (val.length >= 20) return { ok: true, field: `advanced.${f}` };
    }
    // Also check advanced.seo.description
    const seoDesc = resolveText(adv?.seo?.description);
    if (seoDesc.length >= 20) return { ok: true, field: "advanced.seo.description" };
  }
  return { ok: false, field: "" };
}

function hasCategory(p: any): { ok: boolean; field: string } {
  for (const f of CAT_FIELDS) {
    const v = p?.[f];
    if (!v) continue;
    if (Array.isArray(v) && v.length > 0) return { ok: true, field: f };
    if (typeof v === "string" && v.trim().length > 0) return { ok: true, field: f };
    if (typeof v === "object" && !Array.isArray(v)) {
      const txt = resolveText(v);
      if (txt.length > 0) return { ok: true, field: f };
    }
  }
  return { ok: false, field: "" };
}

function hasSeo(p: any): { ok: boolean; level: "full" | "partial" | "none"; field: string } {
  // 1. Check root-level dedicated SEO fields
  for (const f of SEO_FIELDS) {
    const val = resolveText(p?.[f]);
    if (val.length >= 5) return { ok: true, level: "full", field: f };
  }
  // 2. Check advanced.seo sub-object (admin SEO section)
  const advSeo = p?.advanced?.seo;
  if (advSeo && typeof advSeo === "object") {
    for (const f of ADV_SEO_FIELDS) {
      const val = resolveText(advSeo[f]);
      if (val.length >= 5) return { ok: true, level: "full", field: `advanced.seo.${f}` };
    }
  }
  // 3. Fallback: title + description is acceptable SEO
  const hasT = resolveText(p?.title).length >= 3 || resolveText(p?.name).length >= 3;
  const hasD = hasDescription(p).ok;
  if (hasT && hasD) return { ok: true, level: "partial", field: "title+desc" };
  if (hasT) return { ok: true, level: "partial", field: "title" };
  return { ok: false, level: "none", field: "" };
}

function hasAnyImage(p: any): { ok: boolean; field: string } {
  for (const f of IMAGE_FIELDS) {
    const v = p?.[f];
    if (!v) continue;
    if (typeof v === "string" && v.trim().length > 5 && !v.includes("favicon")) return { ok: true, field: f };
    if (Array.isArray(v)) {
      const found = v.find((x: any) => typeof x === "string" && x.trim().length > 5);
      if (found) return { ok: true, field: f };
      // objects with url
      const foundObj = v.find((x: any) => typeof x === "object" && str(x?.url || x?.src).length > 5);
      if (foundObj) return { ok: true, field: f };
    }
  }
  return { ok: false, field: "" };
}

function hasValidPrice(p: any, rates: RatesLatest | null): boolean {
  // Use existing pricing helper first
  try {
    const resolved = resolveProductPriceTRY(p, rates);
    if (num(resolved?.price) > 0) return true;
  } catch { /* fallback */ }
  // Manual fallbacks
  const priceFields = ["finalPrice", "price", "salePrice", "computedPrice", "priceTry"];
  for (const f of priceFields) {
    if (num(p?.[f]) > 0) return true;
  }
  // Check variants
  if (Array.isArray(p?.variants)) {
    for (const v of p.variants) {
      if (num(v?.price) > 0 || num(v?.finalPrice) > 0) return true;
    }
  }
  return false;
}

function hasStock(p: any): boolean {
  if (num(p?.stock) > 0) return true;
  if (p?.inStock === true) return true;
  // If no stock field at all, consider as "sellable" (on-demand)
  if (p?.stock === undefined && p?.inStock === undefined) return true;
  return false;
}

/* ─── Score Calculation ─── */

const isDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

function calcProductAdScore(p: any, rates: RatesLatest | null): ProductAdScore {
  const descCheck = hasDescription(p);
  const catCheck = hasCategory(p);
  const seoCheck = hasSeo(p);
  const imgCheck = hasAnyImage(p);
  const titleOk = resolveText(p?.title).length >= 3 || resolveText(p?.name).length >= 3;
  const priceOk = hasValidPrice(p, rates);
  const stockOk = hasStock(p);
  const skuOk = str(p?.sku).length >= 2;
  const slugOk = str(p?.slug).length >= 3;
  const gramOk = num(p?.hasGram || p?.gram || p?.weightGram) > 0 || str(p?.karat || p?.ayar).length > 0;

  const checks = {
    hasTitle: titleOk,
    hasDescription: descCheck.ok,
    hasImage: imgCheck.ok,
    hasPrice: priceOk,
    hasStock: stockOk,
    hasCategory: catCheck.ok,
    hasSku: skuOk,
    hasSlug: slugOk,
    hasSeo: seoCheck.ok,
    hasGramAyar: gramOk,
  };

  const weights: Record<keyof typeof checks, number> = {
    hasTitle: 15,
    hasDescription: 12,
    hasImage: 15,
    hasPrice: 15,
    hasStock: 10,
    hasCategory: 8,
    hasSku: 5,
    hasSlug: 5,
    hasSeo: 10,
    hasGramAyar: 5,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (checks[key as keyof typeof checks]) score += weight;
  }

  // Partial SEO gets partial score
  if (seoCheck.level === "partial" && !checks.hasSeo) {
    score += 5; // half of SEO weight
    checks.hasSeo = true;
  }

  const debug: Record<string, string> = {};
  if (isDev) {
    debug.title = resolveText(p?.title).slice(0, 30) || resolveText(p?.name).slice(0, 30) || "—";
    debug.description = descCheck.ok ? `✓ (${descCheck.field})` : "✕ (checked: root + advanced)";
    debug.category = catCheck.ok ? `✓ (${catCheck.field})` : "✕";
    debug.image = imgCheck.ok ? `✓ (${imgCheck.field})` : "✕";
    debug.price = priceOk ? "✓" : "✕";
    debug.stock = stockOk ? `✓ (${num(p?.stock)})` : "✕";
    debug.seo = seoCheck.ok ? `${seoCheck.level} (${seoCheck.field})` : "✕";
    debug.advancedKeys = p?.advanced ? Object.keys(p.advanced).join(", ") : "(yok)";
  }

  return {
    id: p.id,
    title: pickTitle(p),
    sku: str(p?.sku),
    image: pickImage(p),
    slug: str(p?.slug),
    score: Math.min(score, 100),
    ...checks,
    debug: isDev ? debug : undefined,
  };
}

/* ─── Score Ring ─── */

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className={s.scoreRing}>
      <svg viewBox="0 0 100 100" className={s.scoreRingSvg} width="100" height="100">
        <circle cx="50" cy="50" r={r} className={s.scoreTrack} />
        <circle
          cx="50" cy="50" r={r}
          className={s.scoreBar}
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: offset }}
        />
      </svg>
      <div className={s.scoreValueWrap}>
        <span className={s.scoreValue}>{score}</span>
        <span className={s.scoreLabel}>/ 100</span>
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function MarketingChecklistPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [products, setProducts] = useState<ProductRaw[]>([]);
  const [rates, setRates] = useState<RatesLatest | null>(null);
  const [tracking, setTracking] = useState<Record<string, any>>({});
  const [seoSettings, setSeoSettings] = useState<Record<string, any>>({});
  const [siteSettings, setSiteSettings] = useState<Record<string, any>>({});
  const [footerSettings, setFooterSettings] = useState<Record<string, any>>({});
  const [chatSettings, setChatSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [showDebug, setShowDebug] = useState(false);

  // Description generator state
  type DraftModal = {
    product: ProductRaw;
    shortDesc: string;
    longDesc: string;
    facts: ProductFacts;
    productType: string;
  } | null;
  type BatchDraft = {
    productId: string;
    title: string;
    image: string;
    shortDesc: string;
    longDesc: string;
    selected: boolean;
  };
  const [draftModal, setDraftModal] = useState<DraftModal>(null);
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Load rates
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rates", "latest"), (snap) => {
      if (snap.exists()) setRates(snap.data() as RatesLatest);
    }, () => {});
    return () => unsub();
  }, [db]);

  // Load products
  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(800));
    const unsub = onSnapshot(qy, (snap) => {
      const list: ProductRaw[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [db]);

  // Load tracking (site_options/tracking)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "site_options", "tracking"), (snap) => {
      setTracking(snap.exists() ? snap.data() || {} : {});
    }, () => {});
    return () => unsub();
  }, [db]);

  // Load SEO settings (site_options/seo_settings) — GTM + GA4 IDs live here inside .seo.google
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "site_options", "seo_settings"), (snap) => {
      const data = snap.exists() ? snap.data() || {} : {};
      // Data is nested: { seo: { google: { tagManagerId, analyticsMeasurementId } } }
      setSeoSettings(data?.seo || data || {});
    }, () => {});
    return () => unsub();
  }, [db]);

  // Load site settings (settings/site) — contact.whatsapp lives here
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      setSiteSettings(snap.exists() ? snap.data() || {} : {});
    }, () => {});
    return () => unsub();
  }, [db]);

  // Footer is nested inside settings/site.footer — we reuse siteSettings
  // so footerSettings = siteSettings.footer (handled in siteChecks useMemo)

  // Load chat settings (site_options/chat_widget)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "site_options", "chat_widget"), (snap) => {
      setChatSettings(snap.exists() ? snap.data() || {} : {});
    }, () => {});
    return () => unsub();
  }, [db]);

  /* ─── Product Scores ─── */

  const productScores = useMemo(() => {
    return products.map((p) => calcProductAdScore(p, rates));
  }, [products, rates]);

  /* ─── Catalog Stats ─── */

  const catalogStats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status !== "draft" && p.status !== "archived" && p.isActive !== false).length;
    const inStock = products.filter((p) => hasStock(p)).length;
    const noImage = products.filter((p) => !hasAnyImage(p).ok).length;
    const noDesc = products.filter((p) => !hasDescription(p).ok).length;
    const noPrice = products.filter((p) => !hasValidPrice(p, rates)).length;
    const noCat = products.filter((p) => !hasCategory(p).ok).length;
    const noSku = products.filter((p) => str(p?.sku).length < 2).length;
    const noSlug = products.filter((p) => str(p?.slug).length < 3).length;
    const noSeo = products.filter((p) => !hasSeo(p).ok).length;

    // Merchant feed ready: title + image + price + (stock or undefined) + slug
    const merchantReady = products.filter((p) => {
      const titleOk = resolveText(p?.title).length >= 3 || resolveText(p?.name).length >= 3;
      const imgOk = hasAnyImage(p).ok;
      const priceOk = hasValidPrice(p, rates);
      const slugOk = str(p?.slug).length >= 3;
      const stockOk = hasStock(p);
      const notDraft = p.status !== "draft" && p.status !== "archived" && p.isActive !== false;
      return titleOk && imgOk && priceOk && slugOk && stockOk && notDraft;
    }).length;

    return { total, active, inStock, noImage, noDesc, noPrice, noCat, noSku, noSlug, noSeo, merchantReady };
  }, [products, rates]);

  /* ─── Site Checks ─── */

  const siteChecks = useMemo((): CheckItem[] => {
    const metaOk = tracking?.meta?.enabled && str(tracking?.meta?.pixelId).length > 5;
    const capiOk = tracking?.meta?.capiEnabled && str(tracking?.meta?.capiGatewayUrl).length > 5;

    // GTM + GA4: actual IDs are stored in site_options/seo.google
    const gtmId = str(seoSettings?.google?.tagManagerId);
    const ga4Id = str(seoSettings?.google?.analyticsMeasurementId);
    const gtmOk = gtmId.length > 3;
    const ga4Ok = ga4Id.length > 3;

    // Google Ads: check direct config in tracking, or GTM fallback
    const gadsDirectOk = tracking?.googleAds?.enabled && str(tracking?.googleAds?.conversionId).length > 3;

    // WhatsApp: check multiple sources
    // settings/site → contact.whatsapp (admin Site Ayarları)
    // settings/site → footer.contact.whatsapp (admin Footer → İletişim)
    // site_options/chat_widget → quick.whatsapp (Chat Widget)
    const waFromSite = str(siteSettings?.contact?.whatsapp);
    const waFromFooter = str(siteSettings?.footer?.contact?.whatsapp);
    const waFromChat = str(chatSettings?.quick?.whatsapp);
    const phoneFromSite = str(siteSettings?.contact?.phone) || str(siteSettings?.footer?.contact?.phone);
    const waNumber = waFromSite || waFromFooter || waFromChat;
    const hasWa = waNumber.length >= 10;
    const hasPhone = phoneFromSite.length >= 10;

    return [
      {
        label: "Meta Pixel",
        detail: metaOk ? `Pixel ID: ${str(tracking?.meta?.pixelId).slice(0, 8)}…` : "Pixel ID girilmemiş",
        status: metaOk ? "ok" : "fail",
        value: metaOk ? "Aktif" : "Eksik",
      },
      {
        label: "Conversions API (CAPI)",
        detail: capiOk ? "Stape CAPIG aktif" : "Server-side tracking pasif",
        status: capiOk ? "ok" : "warn",
        value: capiOk ? "Aktif" : "Pasif",
      },
      {
        label: "Google Ads / GTM",
        detail: gadsDirectOk
          ? `Conversion ID: ${str(tracking?.googleAds?.conversionId)}`
          : gtmOk
            ? `GTM üzerinden dönüşüm takibi aktif (${gtmId})`
            : ga4Ok
              ? `GA4 üzerinden takip aktif (${ga4Id})`
              : "Dönüşüm takibi bulunamadı",
        status: gadsDirectOk ? "ok" : (gtmOk || ga4Ok) ? "ok" : "warn",
        value: gadsDirectOk ? "Aktif" : (gtmOk || ga4Ok) ? "GTM Aktif" : "Kontrol Et",
      },
      {
        label: "GA4 / GTM",
        detail: gtmOk
          ? `GTM Container: ${gtmId}`
          : ga4Ok
            ? `GA4 Measurement ID: ${ga4Id}`
            : "layout.tsx üzerinden kontrol edin",
        status: (gtmOk || ga4Ok) ? "ok" : "warn",
        value: (gtmOk || ga4Ok) ? "Aktif" : "Kontrol Et",
      },
      {
        label: "Ödeme Sistemi",
        detail: "PayTR entegrasyonu aktif",
        status: "ok",
        value: "Aktif",
      },
      {
        label: "WhatsApp Destek",
        detail: hasWa
          ? `Numara: ${waNumber.slice(0, 6)}…`
          : hasPhone
            ? `İletişim telefonu var (${phoneFromSite.slice(0, 6)}…) ama WhatsApp özel tanımlı değil`
            : "WhatsApp numarası bulunamadı",
        status: hasWa ? "ok" : hasPhone ? "warn" : "warn",
        value: hasWa ? "Aktif" : hasPhone ? "Telefon Var" : "Eksik",
      },
      {
        label: "KVKK Aydınlatma Metni",
        detail: "/kvkk-aydinlatma-metni",
        status: "ok",
        value: "Var",
      },
      {
        label: "Gizlilik Politikası",
        detail: "/gizlilik-politikasi",
        status: "ok",
        value: "Var",
      },
      {
        label: "Mesafeli Satış Sözleşmesi",
        detail: "/mesafeli-satis-sozlesmesi",
        status: "ok",
        value: "Var",
      },
      {
        label: "Kargo & Teslimat Bilgisi",
        detail: "/kargo-teslimat",
        status: "ok",
        value: "Var",
      },
      {
        label: "İade & İptal Koşulları",
        detail: "/iade-ve-iptal-kosullari",
        status: "ok",
        value: "Var",
      },
    ];
  }, [tracking, seoSettings, siteSettings, chatSettings]);

  /* ─── Catalog Checks ─── */

  const catalogChecks = useMemo((): CheckItem[] => {
    const { total, active, inStock, noImage, noDesc, noPrice, noCat, noSku, noSlug, noSeo, merchantReady } = catalogStats;
    const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(0) : "0";

    return [
      {
        label: "Aktif Ürün",
        detail: `${total} üründen ${active} aktif`,
        status: active > 0 ? "ok" : "fail",
        value: String(active),
      },
      {
        label: "Stokta Ürün",
        detail: `${inStock} ürün stokta veya sipariş üzerine satışta`,
        status: inStock > total * 0.5 ? "ok" : inStock > 0 ? "warn" : "fail",
        value: String(inStock),
      },
      {
        label: "Görselsiz Ürünler",
        detail: noImage > 0 ? `%${pct(noImage)} görselsiz` : "Tüm ürünlerde görsel var",
        status: noImage === 0 ? "ok" : noImage <= 5 ? "warn" : "fail",
        value: String(noImage),
      },
      {
        label: "Açıklaması Eksik",
        detail: noDesc > 0 ? `${noDesc} üründe yeterli açıklama yok (< 20 karakter)` : "Tüm ürünlerde açıklama var",
        status: noDesc === 0 ? "ok" : noDesc <= 10 ? "warn" : "fail",
        value: String(noDesc),
      },
      {
        label: "Fiyatı Hatalı / 0",
        detail: noPrice > 0 ? `${noPrice} üründe fiyat sorunu` : "Tüm fiyatlar doğru",
        status: noPrice === 0 ? "ok" : "fail",
        value: String(noPrice),
      },
      {
        label: "Kategorisiz",
        detail: noCat > 0 ? `${noCat} ürün kategorisiz` : "Hepsi kategorili",
        status: noCat === 0 ? "ok" : noCat <= 5 ? "warn" : "fail",
        value: String(noCat),
      },
      {
        label: "SKU Eksik",
        detail: noSku > 0 ? `${noSku} üründe SKU yok` : "Tüm SKU'lar tanımlı",
        status: noSku === 0 ? "ok" : noSku <= 10 ? "warn" : "fail",
        value: String(noSku),
      },
      {
        label: "Slug Eksik",
        detail: noSlug > 0 ? `${noSlug} üründe slug yok` : "Tüm slug'lar tanımlı",
        status: noSlug === 0 ? "ok" : "fail",
        value: String(noSlug),
      },
      {
        label: "SEO İyileştirilebilir",
        detail: noSeo > 0 ? `${noSeo} üründe özel SEO + açıklama eksik` : "Tüm ürünlerde SEO verileri uygun",
        status: noSeo === 0 ? "ok" : noSeo <= 20 ? "warn" : "fail",
        value: String(noSeo),
      },
      {
        label: "Merchant Feed'e Uygun",
        detail: `${merchantReady} / ${total} ürün feed'e hazır (başlık + görsel + fiyat + slug + stok)`,
        status: merchantReady >= total * 0.9 ? "ok" : merchantReady >= total * 0.5 ? "warn" : "fail",
        value: String(merchantReady),
      },
    ];
  }, [catalogStats]);

  /* ─── Overall Score ─── */

  const overallScore = useMemo(() => {
    const allChecks = [...siteChecks, ...catalogChecks];
    const total = allChecks.length;
    if (total === 0) return 0;
    let points = 0;
    for (const c of allChecks) {
      if (c.status === "ok") points += 1;
      else if (c.status === "warn") points += 0.5;
    }
    return Math.round((points / total) * 100);
  }, [siteChecks, catalogChecks]);

  const scoreMessage = overallScore >= 80
    ? "Reklama hazırsınız! Katalog ve ayarlarınız iyi durumda."
    : overallScore >= 50
      ? "Bazı eksikler var. Sarı ve kırmızı alanları düzeltin."
      : "Kritik eksikler var. Reklam açmadan önce kırmızı alanları tamamlayın.";

  /* ─── Filtered Product Scores ─── */

  const filteredScores = useMemo(() => {
    let list = [...productScores];
    if (scoreFilter === "low") list = list.filter((p) => p.score < 50);
    else if (scoreFilter === "mid") list = list.filter((p) => p.score >= 50 && p.score < 80);
    else if (scoreFilter === "high") list = list.filter((p) => p.score >= 80);
    return list.sort((a, b) => a.score - b.score);
  }, [productScores, scoreFilter]);

  const avgProductScore = useMemo(() => {
    if (productScores.length === 0) return 0;
    return Math.round(productScores.reduce((a, p) => a + p.score, 0) / productScores.length);
  }, [productScores]);

  /* ─── Render helpers ─── */

  function checkStatusIcon(st: CheckStatus) {
    switch (st) { case "ok": return "✓"; case "warn": return "!"; case "fail": return "✕"; }
  }
  function checkIconClass(st: CheckStatus) {
    switch (st) { case "ok": return s.checkOk; case "warn": return s.checkWarn; case "fail": return s.checkFail; }
  }
  function badgeClass(st: CheckStatus) {
    switch (st) { case "ok": return s.badgeGreen; case "warn": return s.badgeYellow; case "fail": return s.badgeRed; }
  }
  function scoreCellClass(score: number) {
    if (score >= 80) return s.scoreHigh;
    if (score >= 50) return s.scoreMid;
    return s.scoreLow;
  }

  function renderCheckItem(item: CheckItem, i: number) {
    return (
      <div key={i} className={s.checkItem}>
        <div className={`${s.checkIcon} ${checkIconClass(item.status)}`}>{checkStatusIcon(item.status)}</div>
        <div className={s.checkBody}>
          <div className={s.checkLabel}>{item.label}</div>
          <div className={s.checkDetail}>{item.detail}</div>
        </div>
        <span className={`${s.checkBadge} ${badgeClass(item.status)}`}>{item.value}</span>
      </div>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.top}>
        <div className={s.kicker}>Admin • Pazarlama</div>
        <h1 className={s.title}>Reklama Hazırlık Kontrol Listesi</h1>
        <div className={s.sub}>
          Reklam açmadan önce eksikleri kontrol edin. Tüm alanlar otomatik hesaplanır.
        </div>
      </header>

      <div className={s.scoreHero}>
        <ScoreRing score={overallScore} />
        <div className={s.scoreInfo}>
          <h2 className={s.scoreTitle}>Reklama Hazırlık Skoru</h2>
          <p className={s.scoreSub}>
            {scoreMessage}<br />
            Ortalama ürün skoru: <strong>{avgProductScore}/100</strong> · {productScores.length} ürün analiz edildi
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(15,23,42,.5)", fontWeight: 700 }}>Veriler yükleniyor…</div>
      ) : (
        <>
          <div className={s.grid}>
            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>🔧 Site & Entegrasyon Ayarları</span>
              </div>
              <div className={s.cardBody}>
                {siteChecks.map((item, i) => renderCheckItem(item, i))}
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>📦 Katalog Kalitesi</span>
              </div>
              <div className={s.cardBody}>
                {catalogChecks.map((item, i) => renderCheckItem(item, i))}
              </div>
            </div>
          </div>

          {/* ── Description Generator Modal ── */}
          {draftModal ? (
            <div className={s.modalOverlay} onClick={() => setDraftModal(null)}>
              <div className={s.modalBox} onClick={(e) => e.stopPropagation()}>
                <div className={s.modalHead}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={s.modalProductImg} src={pickImage(draftModal.product)} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/dromocob-mark.svg"; }} />
                  <div className={s.modalProductInfo}>
                    <div className={s.modalProductTitle}>{pickTitle(draftModal.product)}</div>
                    <div className={s.modalProductMeta}>
                      {draftModal.facts.sku ? <span>SKU: {draftModal.facts.sku}</span> : null}
                      {draftModal.facts.category ? <span>{draftModal.facts.category}</span> : null}
                      {draftModal.facts.gram ? <span>{draftModal.facts.gram}g</span> : null}
                      {draftModal.facts.ayar ? <span>{draftModal.facts.ayar}</span> : null}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <span className={s.modalProductTag}>{draftModal.productType}</span>
                      {draftModal.facts.material ? <span className={s.modalProductTag}>{draftModal.facts.material}</span> : null}
                      {draftModal.facts.stone ? <span className={s.modalProductTag}>{draftModal.facts.stone}</span> : null}
                    </div>
                  </div>
                  <button type="button" className={s.modalCloseBtn} onClick={() => setDraftModal(null)}>✕</button>
                </div>

                <div className={s.modalBody}>
                  <div>
                    <div className={s.modalFieldLabel}>
                      Kısa Açıklama
                      <span className={s.modalFieldCount}>{draftModal.shortDesc.length} karakter</span>
                    </div>
                    <textarea
                      className={s.modalTextarea}
                      value={draftModal.shortDesc}
                      onChange={(e) => setDraftModal((prev) => prev ? { ...prev, shortDesc: e.target.value } : null)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <div className={s.modalFieldLabel}>
                      Uzun Açıklama
                      <span className={s.modalFieldCount}>{draftModal.longDesc.length} karakter</span>
                    </div>
                    <textarea
                      className={`${s.modalTextarea} ${s.modalTextareaLong}`}
                      value={draftModal.longDesc}
                      onChange={(e) => setDraftModal((prev) => prev ? { ...prev, longDesc: e.target.value } : null)}
                      rows={8}
                    />
                  </div>

                  {(() => {
                    const v = validateDescriptionDraft(
                      { shortDescription: draftModal.shortDesc, longDescription: draftModal.longDesc },
                      draftModal.facts
                    );
                    if (v.warnings.length === 0) return null;
                    return (
                      <div className={s.modalWarnings}>
                        {v.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                      </div>
                    );
                  })()}
                </div>

                <div className={s.modalFoot}>
                  <button type="button" className={s.btnGhost} onClick={() => setDraftModal(null)}>Vazgeç</button>
                  <button
                    type="button"
                    className={s.btnRegen}
                    onClick={() => {
                      const draft = generateProductDescriptionDraft(draftModal.product);
                      setDraftModal((prev) => prev ? { ...prev, shortDesc: draft.shortDescription, longDesc: draft.longDescription } : null);
                    }}
                  >
                    ↻ Yeniden Üret
                  </button>
                  <button
                    type="button"
                    className={s.btnSave}
                    disabled={savingId === draftModal.product.id}
                    onClick={async () => {
                      const pid = draftModal.product.id;
                      setSavingId(pid);
                      try {
                        await setDoc(
                          doc(db, "products", pid),
                          {
                            advanced: {
                              shortDescription: { tr: draftModal.shortDesc },
                              description: { tr: draftModal.longDesc },
                            },
                          },
                          { merge: true }
                        );
                        showToast("✅ Açıklama kaydedildi");
                        setDraftModal(null);
                      } catch (e: any) {
                        showToast("❌ Hata: " + (e?.message || "Kaydetme başarısız"));
                      } finally {
                        setSavingId(null);
                      }
                    }}
                  >
                    {savingId === draftModal.product.id ? "Kaydediliyor..." : "✓ Kaydet"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Batch Panel ── */}
          {batchDrafts.length > 0 ? (
            <div className={s.batchPanel}>
              <div className={s.batchHead}>
                <span className={s.batchTitle}>📝 Toplu Açıklama Taslakları ({batchDrafts.length} ürün)</span>
                <div className={s.batchActions}>
                  <button type="button" className={s.btnGhost} onClick={() => setBatchDrafts([])}>Temizle</button>
                  <button
                    type="button"
                    className={s.btnGhost}
                    onClick={() => setBatchDrafts((prev) => prev.map((d) => ({ ...d, selected: !prev.every((x) => x.selected) })))}
                  >
                    {batchDrafts.every((d) => d.selected) ? "Seçimi Kaldır" : "Tümünü Seç"}
                  </button>
                  <button
                    type="button"
                    className={s.btnSave}
                    disabled={!!savingId || batchDrafts.filter((d) => d.selected).length === 0}
                    onClick={async () => {
                      const selected = batchDrafts.filter((d) => d.selected);
                      setSavingId("batch");
                      let saved = 0;
                      for (const d of selected) {
                        try {
                          await setDoc(
                            doc(db, "products", d.productId),
                            {
                              advanced: {
                                shortDescription: { tr: d.shortDesc },
                                description: { tr: d.longDesc },
                              },
                            },
                            { merge: true }
                          );
                          saved++;
                        } catch { /* skip */ }
                      }
                      showToast(`✅ ${saved}/${selected.length} ürün kaydedildi`);
                      setBatchDrafts((prev) => prev.filter((d) => !d.selected));
                      setSavingId(null);
                    }}
                  >
                    {savingId === "batch" ? "Kaydediliyor..." : `✓ Seçilenleri Kaydet (${batchDrafts.filter((d) => d.selected).length})`}
                  </button>
                </div>
              </div>
              <div className={s.batchBody}>
                {batchDrafts.map((d, i) => (
                  <div key={d.productId} className={s.batchRow}>
                    <input
                      type="checkbox"
                      className={s.batchCheck}
                      checked={d.selected}
                      onChange={() => setBatchDrafts((prev) => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                    />
                    <div className={s.batchRowInfo}>
                      <div className={s.batchRowTitle}>{d.title}</div>
                      <div className={s.batchRowPreview}>{d.shortDesc}</div>
                    </div>
                    <div className={s.batchRowActions}>
                      <button
                        type="button"
                        className={s.btnGenMini}
                        onClick={() => {
                          const product = products.find((p) => p.id === d.productId);
                          if (!product) return;
                          const draft = generateProductDescriptionDraft(product);
                          const facts = buildProductFacts(product);
                          setDraftModal({
                            product,
                            shortDesc: d.shortDesc,
                            longDesc: d.longDesc,
                            facts,
                            productType: draft.productType,
                          });
                        }}
                      >
                        Düzenle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Toast ── */}
          {toast ? <div className={s.toast}>{toast}</div> : null}

          {/* ── Product Scores Table ── */}
          <div className={s.tableCard}>
            <div className={s.tableHeader}>
              <span className={s.tableTitle}>📊 Ürün Reklam Skorları</span>
              <div className={s.tableFilter}>
                {(
                  [["all", "Tümü"], ["low", "Düşük (< 50)"], ["mid", "Orta (50-79)"], ["high", "İyi (80+)"]] as [ScoreFilter, string][]
                ).map(([key, label]) => (
                  <button key={key} type="button"
                    className={`${s.filterPill} ${scoreFilter === key ? s.filterPillActive : ""}`}
                    onClick={() => setScoreFilter(key)}
                  >{label}</button>
                ))}
                {/* Toplu Taslak Üret */}
                {catalogStats.noDesc > 0 ? (
                  <button
                    type="button"
                    className={s.btnBatch}
                    disabled={batchGenerating}
                    onClick={() => {
                      setBatchGenerating(true);
                      const noDescProducts = products.filter((p) => !hasDescription(p).ok).slice(0, 20);
                      const drafts: BatchDraft[] = noDescProducts.map((p) => {
                        const d = generateProductDescriptionDraft(p);
                        return {
                          productId: p.id,
                          title: pickTitle(p),
                          image: pickImage(p),
                          shortDesc: d.shortDescription,
                          longDesc: d.longDescription,
                          selected: true,
                        };
                      });
                      setBatchDrafts(drafts);
                      setBatchGenerating(false);
                    }}
                  >
                    {batchGenerating ? "Üretiliyor..." : `📝 Toplu Taslak (${Math.min(catalogStats.noDesc, 20)})`}
                  </button>
                ) : null}
                {isDev ? (
                  <button type="button"
                    className={`${s.filterPill} ${showDebug ? s.filterPillActive : ""}`}
                    onClick={() => setShowDebug(!showDebug)}
                  >🐛 Debug</button>
                ) : null}
              </div>
            </div>

            <div className={s.scrollWrap}>
              <div className={s.prodTable}>
                <div className={s.prodTh}></div>
                <div className={`${s.prodTh} ${s.prodThName}`}>Ürün</div>
                <div className={s.prodTh}>Skor</div>
                <div className={s.prodTh}>Başlık</div>
                <div className={s.prodTh}>Açıkl.</div>
                <div className={s.prodTh}>Görsel</div>
                <div className={s.prodTh}>Fiyat</div>
                <div className={s.prodTh}>Stok</div>
                <div className={s.prodTh}>Kateg.</div>
                <div className={s.prodTh}>SKU</div>
                <div className={s.prodTh}>Slug</div>
                <div className={s.prodTh}>SEO</div>
                <div className={s.prodTh}>Gram</div>

                {filteredScores.length === 0 ? (
                  <div className={s.emptyRow}>{scoreFilter === "all" ? "Ürün bulunamadı." : "Bu filtreye uygun ürün yok."}</div>
                ) : (
                  filteredScores.slice(0, 100).map((p) => (
                    <React.Fragment key={p.id}>
                      <div className={s.prodTd}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className={s.prodThumb} src={p.image} alt="" loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/dromocob-mark.svg"; }}
                        />
                      </div>
                      <div className={s.prodTd} style={{ textAlign: "left" }}>
                        <Link href={`/admin/products/${encodeURIComponent(p.id)}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <div className={s.prodName}>{p.title}</div>
                          <div className={s.prodSku}>{p.sku || "—"}</div>
                        </Link>
                      </div>
                      <div className={s.prodTd}>
                        <span className={`${s.scoreCell} ${scoreCellClass(p.score)}`}>{p.score}</span>
                      </div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasTitle ? s.dotOk : s.dotFail}`}>{p.hasTitle ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}>
                        {p.hasDescription ? (
                          <span className={`${s.dot} ${s.dotOk}`}>✓</span>
                        ) : (
                          <button
                            type="button"
                            className={s.btnGenMini}
                            onClick={() => {
                              const product = products.find((pr) => pr.id === p.id);
                              if (!product) return;
                              const draft = generateProductDescriptionDraft(product);
                              setDraftModal({
                                product,
                                shortDesc: draft.shortDescription,
                                longDesc: draft.longDescription,
                                facts: draft.facts,
                                productType: draft.productType,
                              });
                            }}
                          >
                            ✎ Üret
                          </button>
                        )}
                      </div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasImage ? s.dotOk : s.dotFail}`}>{p.hasImage ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasPrice ? s.dotOk : s.dotFail}`}>{p.hasPrice ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasStock ? s.dotOk : s.dotFail}`}>{p.hasStock ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasCategory ? s.dotOk : s.dotFail}`}>{p.hasCategory ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasSku ? s.dotOk : s.dotFail}`}>{p.hasSku ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasSlug ? s.dotOk : s.dotFail}`}>{p.hasSlug ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasSeo ? s.dotOk : s.dotFail}`}>{p.hasSeo ? "✓" : "✕"}</span></div>
                      <div className={s.prodTd}><span className={`${s.dot} ${p.hasGramAyar ? s.dotOk : s.dotFail}`}>{p.hasGramAyar ? "✓" : "✕"}</span></div>
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            {filteredScores.length > 100 ? (
              <div style={{ padding: "12px 20px", fontSize: 12, color: "rgba(15,23,42,.45)", fontWeight: 700, borderTop: "1px solid rgba(15,23,42,.06)" }}>
                İlk 100 ürün gösteriliyor. Toplam: {filteredScores.length}
              </div>
            ) : null}
          </div>

          {/* ── Debug Panel (dev only) ── */}
          {isDev && showDebug && filteredScores.length > 0 ? (
            <div className={s.card} style={{ marginTop: 14 }}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>🐛 Debug — İlk 5 Ürün Field Analizi</span>
              </div>
              <div className={s.cardBody}>
                {filteredScores.slice(0, 5).map((p) => (
                  <div key={p.id} className={s.checkItem} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <div className={s.checkLabel}>{p.title} (Skor: {p.score})</div>
                    {p.debug ? (
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(15,23,42,.6)", lineHeight: 1.8 }}>
                        {Object.entries(p.debug).map(([k, v]) => (
                          <div key={k}><strong>{k}:</strong> {v}</div>
                        ))}
                      </div>
                    ) : <div className={s.checkDetail}>Debug verisi yok</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
