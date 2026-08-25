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
  };
};

const DEFAULTS: SeoSettings = {
  meta: {
    titleTemplate: "%s | Dromocob",
    defaultTitle: "Dromocob",
    defaultDescription:
      "tasarım ve yaşam ürünleri. Güncel kurla hesaplanan fiyatlar, hızlı teslimat, güvenli alışveriş.",
    defaultOgImage: "https://demo.dromocob.com/og-default.jpg",
    twitterHandle: "",
    themeColor: "#0b0b0b",
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
  },
  site: {
    primaryUrl: "https://demo.dromocob.com",
    fallbackUrl: "https://dromocob-web--dromocob-demo.europe-west4.hosted.app",
    canonicalMode: "auto",
  },
  openGraph: {
    defaultType: "website",
    locale: "tr_TR",
  },
  jsonld: {
    enabled: true,
    organizationName: "Dromocob",
    organizationLogo: "https://demo.dromocob.com/dromocob-mark.svg",
    sameAs: [],
  },
};

function s(v: any) {
  return String(v ?? "").trim();
}

function b(v: any, d = false) {
  return typeof v === "boolean" ? v : d;
}

function arr(v: any) {
  if (Array.isArray(v)) return v.map((x) => s(x)).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((x) => s(x)).filter(Boolean);
  return [];
}

function cleanUrl(u: string) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function normalize(raw?: Partial<SeoSettings>): SeoSettings {
  const x = raw || {};
  return {
    meta: {
      titleTemplate: s(x.meta?.titleTemplate) || DEFAULTS.meta.titleTemplate,
      defaultTitle: s(x.meta?.defaultTitle) || DEFAULTS.meta.defaultTitle,
      defaultDescription: s(x.meta?.defaultDescription) || DEFAULTS.meta.defaultDescription,
      defaultOgImage: s(x.meta?.defaultOgImage) || DEFAULTS.meta.defaultOgImage,
      twitterHandle: s(x.meta?.twitterHandle) || "",
      themeColor: s(x.meta?.themeColor) || DEFAULTS.meta.themeColor,
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
    },
    site: {
      primaryUrl: s(x.site?.primaryUrl) || DEFAULTS.site.primaryUrl,
      fallbackUrl: s(x.site?.fallbackUrl) || DEFAULTS.site.fallbackUrl,
      canonicalMode: x.site?.canonicalMode === "primary" ? "primary" : "auto",
    },
    openGraph: {
      defaultType: x.openGraph?.defaultType === "product" ? "product" : "website",
      locale: x.openGraph?.locale === "en_US" ? "en_US" : "tr_TR",
    },
    jsonld: {
      enabled: b(x.jsonld?.enabled, true),
      organizationName: s(x.jsonld?.organizationName) || DEFAULTS.jsonld.organizationName,
      organizationLogo: s(x.jsonld?.organizationLogo) || DEFAULTS.jsonld.organizationLogo,
      sameAs: arr(x.jsonld?.sameAs),
    },
  };
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const snap = await adminDb().doc("site_options/seo_settings").get();
  if (!snap.exists) return DEFAULTS;

  const data = snap.data() as any;
  return normalize(data?.seo);
}

export function resolveBaseUrl(seo: SeoSettings) {
  const primary = cleanUrl(seo.site.primaryUrl);
  const fallback = cleanUrl(seo.site.fallbackUrl);

  if (seo.site.canonicalMode === "primary" && primary) return primary;
  return primary || fallback || "";
}

export function absUrl(base: string, path: string) {
  const b = cleanUrl(base);
  const p = String(path || "/").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}