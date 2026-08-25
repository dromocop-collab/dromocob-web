import "server-only";
import { adminDb } from "@/lib/firebase.admin";

export type SeoSettings = {
  meta: {
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage: string;
    twitterHandle?: string;
    themeColor?: string;
    defaultKeywords?: string;
    author?: string;
    publisher?: string;
    appName?: string;
    brandAliases?: string;
  };
  google: {
    searchConsoleVerification: string;
    tagManagerId: string;
    analyticsMeasurementId: string;
  };
  robots: {
    index: boolean;
    follow: boolean;
    noindexReason?: string;
    maxSnippet?: number;
    maxImagePreview?: "none" | "standard" | "large";
    maxVideoPreview?: number;
    googlebot?: string;
  };
  site: {
    primaryUrl: string;
    fallbackUrl: string;
    canonicalMode: "primary" | "auto";
  };
  openGraph: {
    defaultType: "website" | "product";
    locale: "tr_TR" | "en_US";
  };
  jsonld: {
    enabled: boolean;
    organizationName: string;
    organizationLogo: string;
    sameAs: string[];
    phone?: string;
    email?: string;
    addressLocality?: string;
    addressCountry?: string;
    priceRange?: string;
  };
  sitemap: {
    enabled: boolean;
    productFeedEnabled: boolean;
    splitSize: number;
  };
  productSeo: {
    currency: string;
    condition: "NewCondition" | "UsedCondition" | "RefurbishedCondition";
    availabilityInStockLabel: string;
    availabilityOutOfStockLabel: string;
    returnPolicyLabel: string;
  };
};

const DEFAULTS: SeoSettings = {
  meta: {
    titleTemplate: "%s | Dromocob",
    defaultTitle: "Dromocob",
    defaultDescription:
      "Dromocob; sektörünüze özel, SEO uyumlu, yüksek performanslı ve yönetim panelli web siteleri tasarlar ve geliştirir.",
    defaultOgImage: "https://dromocob.tr/home/dromocob-studio-hero-v1.jpg",
    twitterHandle: "",
    themeColor: "#0b0b0b",
    defaultKeywords: "web tasarım, kurumsal web sitesi, e-ticaret sitesi, SEO uyumlu web sitesi, İstanbul web tasarım ajansı",
    author: "Dromocob",
    publisher: "Dromocob",
    appName: "Dromocob",
    brandAliases: "Dromocob, Dromocob Studio",
  },
  google: {
    searchConsoleVerification: "",
    tagManagerId: "",
    analyticsMeasurementId: "",
  },
  robots: {
    index: true,
    follow: true,
    noindexReason: "",
    maxSnippet: -1,
    maxImagePreview: "large",
    maxVideoPreview: -1,
    googlebot: "",
  },
  site: {
    primaryUrl: "https://dromocob.tr",
    fallbackUrl: "https://dromocob.tr",
    canonicalMode: "auto",
  },
  openGraph: {
    defaultType: "website",
    locale: "tr_TR",
  },
  jsonld: {
    enabled: true,
    organizationName: "Dromocob",
    organizationLogo: "https://dromocob.tr/dromocob-mark.svg",
    sameAs: [],
    phone: "+90 530 478 82 98",
    email: "info@dromocob.tr",
    addressLocality: "İstanbul",
    addressCountry: "TR",
    priceRange: "₺₺₺",
  },
  sitemap: {
    enabled: true,
    productFeedEnabled: true,
    splitSize: 5000,
  },
  productSeo: {
    currency: "TRY",
    condition: "NewCondition",
    availabilityInStockLabel: "InStock",
    availabilityOutOfStockLabel: "OutOfStock",
    returnPolicyLabel: "Standart iade koşulları geçerlidir.",
  },
};

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function b(v: unknown, d = false): boolean {
  return typeof v === "boolean" ? v : d;
}

function n(v: unknown, d = 0): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : d;
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => s(x)).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((x) => s(x)).filter(Boolean);
  return [];
}

function cleanUrl(u: string): string {
  return s(u).replace(/\/+$/, "");
}

function ensureHttps(url: string): string {
  const value = s(url);
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (value.toLowerCase().startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }
  return value;
}

function safeCanonicalMode(v: unknown): "primary" | "auto" {
  return v === "primary" ? "primary" : "auto";
}

function safeOgType(v: unknown): "website" | "product" {
  return v === "product" ? "product" : "website";
}

function safeLocale(v: unknown): "tr_TR" | "en_US" {
  return v === "en_US" ? "en_US" : "tr_TR";
}

function safeImagePreview(v: unknown): "none" | "standard" | "large" {
  return v === "none" || v === "standard" ? v : "large";
}

function safeCondition(
  v: unknown
): "NewCondition" | "UsedCondition" | "RefurbishedCondition" {
  if (v === "UsedCondition") return "UsedCondition";
  if (v === "RefurbishedCondition") return "RefurbishedCondition";
  return "NewCondition";
}

function normalize(raw?: Partial<SeoSettings>): SeoSettings {
  const x = raw || {};

  return {
    meta: {
      titleTemplate: s(x.meta?.titleTemplate) || DEFAULTS.meta.titleTemplate,
      defaultTitle: s(x.meta?.defaultTitle) || DEFAULTS.meta.defaultTitle,
      defaultDescription: s(x.meta?.defaultDescription) || DEFAULTS.meta.defaultDescription,
      defaultOgImage: ensureHttps(s(x.meta?.defaultOgImage) || DEFAULTS.meta.defaultOgImage),
      twitterHandle: s(x.meta?.twitterHandle) || "",
      themeColor: s(x.meta?.themeColor) || DEFAULTS.meta.themeColor,
      defaultKeywords: s(x.meta?.defaultKeywords) || DEFAULTS.meta.defaultKeywords,
      author: s(x.meta?.author) || DEFAULTS.meta.author,
      publisher: s(x.meta?.publisher) || DEFAULTS.meta.publisher,
      appName: s(x.meta?.appName) || DEFAULTS.meta.appName,
      brandAliases: s(x.meta?.brandAliases) || DEFAULTS.meta.brandAliases,
    },
    google: {
      searchConsoleVerification: s(x.google?.searchConsoleVerification),
      tagManagerId: s(x.google?.tagManagerId),
      analyticsMeasurementId: s(x.google?.analyticsMeasurementId),
    },
    robots: {
      index: b(x.robots?.index, DEFAULTS.robots.index),
      follow: b(x.robots?.follow, DEFAULTS.robots.follow),
      noindexReason: s(x.robots?.noindexReason),
      maxSnippet: n(x.robots?.maxSnippet, -1),
      maxImagePreview: safeImagePreview(x.robots?.maxImagePreview),
      maxVideoPreview: n(x.robots?.maxVideoPreview, -1),
      googlebot: s(x.robots?.googlebot),
    },
    site: {
      primaryUrl: ensureHttps(s(x.site?.primaryUrl) || DEFAULTS.site.primaryUrl),
      fallbackUrl: ensureHttps(s(x.site?.fallbackUrl) || DEFAULTS.site.fallbackUrl),
      canonicalMode: safeCanonicalMode(x.site?.canonicalMode),
    },
    openGraph: {
      defaultType: safeOgType(x.openGraph?.defaultType),
      locale: safeLocale(x.openGraph?.locale),
    },
    jsonld: {
      enabled: b(x.jsonld?.enabled, true),
      organizationName: s(x.jsonld?.organizationName) || DEFAULTS.jsonld.organizationName,
      organizationLogo:
        ensureHttps(s(x.jsonld?.organizationLogo) || DEFAULTS.jsonld.organizationLogo),
      sameAs: arr(x.jsonld?.sameAs),
      phone: s(x.jsonld?.phone),
      email: s(x.jsonld?.email),
      addressLocality: s(x.jsonld?.addressLocality) || DEFAULTS.jsonld.addressLocality,
      addressCountry: s(x.jsonld?.addressCountry) || DEFAULTS.jsonld.addressCountry,
      priceRange: s(x.jsonld?.priceRange) || DEFAULTS.jsonld.priceRange,
    },
    sitemap: {
      enabled: b(x.sitemap?.enabled, true),
      productFeedEnabled: b(x.sitemap?.productFeedEnabled, true),
      splitSize: n(x.sitemap?.splitSize, 5000),
    },
    productSeo: {
      currency: s(x.productSeo?.currency) || DEFAULTS.productSeo.currency,
      condition: safeCondition(x.productSeo?.condition),
      availabilityInStockLabel:
        s(x.productSeo?.availabilityInStockLabel) ||
        DEFAULTS.productSeo.availabilityInStockLabel,
      availabilityOutOfStockLabel:
        s(x.productSeo?.availabilityOutOfStockLabel) ||
        DEFAULTS.productSeo.availabilityOutOfStockLabel,
      returnPolicyLabel:
        s(x.productSeo?.returnPolicyLabel) || DEFAULTS.productSeo.returnPolicyLabel,
    },
  };
}

export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const snap = await adminDb().doc("site_options/seo_settings").get();
    if (!snap.exists) return DEFAULTS;

    const data = snap.data() as { seo?: Partial<SeoSettings> } | undefined;
    return normalize(data?.seo);
  } catch (error) {
    console.error("getSeoSettings error:", error);
    return DEFAULTS;
  }
}

export function resolveBaseUrl(seo: SeoSettings): string {
  const primary = cleanUrl(ensureHttps(seo.site.primaryUrl));
  const fallback = cleanUrl(ensureHttps(seo.site.fallbackUrl));
  const liveApp = "https://dromocob.tr";
  const legacyHosts = ["demo.dromocob.com", "dromocob-web--dromocob-demo.europe-west4.hosted.app", "dromocob-web--dromocob-web-edit.europe-west4.hosted.app"];
  const usable = (value: string) => value && !legacyHosts.some((host) => value.includes(host));

  if (seo.site.canonicalMode === "primary" && usable(primary)) return primary;
  return (usable(primary) && primary) || (usable(fallback) && fallback) || liveApp;
}

export function absUrl(base: string, path: string): string {

  const b = cleanUrl(base);

  const rawPath = s(path || "/");

  const p = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  return `${b}${p}`;

}

export function resolveCanonicalUrl(
  seo: SeoSettings,
  path: string,
  overrideBase?: string
): string {
  const base = cleanUrl(overrideBase || resolveBaseUrl(seo));
  return absUrl(base, path || "/");
}

export function applyTitleTemplate(
  seo: SeoSettings,
  pageTitle?: string,
  fallbackToDefault = true
): string {
  const raw = s(pageTitle);
  const template = s(seo.meta.titleTemplate) || DEFAULTS.meta.titleTemplate;

  if (!raw) {
    return fallbackToDefault ? seo.meta.defaultTitle : "";
  }

  return template.includes("%s")
    ? template.replace("%s", raw)
    : `${raw} | ${seo.meta.defaultTitle}`;
}

export function buildRobotsContent(seo: SeoSettings): string {
  const parts: string[] = [
    seo.robots.index ? "index" : "noindex",
    seo.robots.follow ? "follow" : "nofollow",
  ];

  if (typeof seo.robots.maxSnippet === "number") {
    parts.push(`max-snippet:${seo.robots.maxSnippet}`);
  }

  if (seo.robots.maxImagePreview) {
    parts.push(`max-image-preview:${seo.robots.maxImagePreview}`);
  }

  if (typeof seo.robots.maxVideoPreview === "number") {
    parts.push(`max-video-preview:${seo.robots.maxVideoPreview}`);
  }

  return parts.join(", ");
}

export function buildGooglebotContent(seo: SeoSettings): string {
  const custom = s(seo.robots.googlebot);
  if (custom) return custom;
  return buildRobotsContent(seo);
}

export function buildOrganizationJsonLd(seo: SeoSettings) {
  if (!seo.jsonld.enabled) return null;

  const sameAs = (seo.jsonld.sameAs || []).filter(Boolean);

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.jsonld.organizationName,
    url: resolveBaseUrl(seo),
    logo: seo.jsonld.organizationLogo,
  };

  if (sameAs.length) json.sameAs = sameAs;
  if (seo.jsonld.phone) json.telephone = seo.jsonld.phone;
  if (seo.jsonld.email) json.email = seo.jsonld.email;
  if (seo.jsonld.priceRange) json.priceRange = seo.jsonld.priceRange;

  if (seo.jsonld.addressLocality || seo.jsonld.addressCountry) {
    json.address = {
      "@type": "PostalAddress",
      addressLocality: seo.jsonld.addressLocality || undefined,
      addressCountry: seo.jsonld.addressCountry || undefined,
    };
  }

  return json;
}

export function getSeoHealthFlags(seo: SeoSettings) {
  const titleLen = seo.meta.defaultTitle.length;
  const descLen = seo.meta.defaultDescription.length;
  const baseUrl = resolveBaseUrl(seo);

  return {
    hasHttpsBase: baseUrl.startsWith("https://"),
    hasOgImage: !!s(seo.meta.defaultOgImage),
    hasJsonLd: seo.jsonld.enabled,
    hasIndexing: seo.robots.index,
    titleLengthGood: titleLen >= 20 && titleLen <= 60,
    descriptionLengthGood: descLen >= 120 && descLen <= 170,
    hasPrimaryUrl: !!s(seo.site.primaryUrl),
    hasOrganizationName: !!s(seo.jsonld.organizationName),
  };
}

export { DEFAULTS as SEO_DEFAULTS };
