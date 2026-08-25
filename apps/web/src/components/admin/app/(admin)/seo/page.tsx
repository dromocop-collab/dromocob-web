"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminSeoSettingsPage.module.css";

type SeoSettings = {
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

type DocShape = { seo?: Partial<SeoSettings> };

function s(v: any) {
  return String(v ?? "").trim();
}
function b(v: any, d = false) {
  return typeof v === "boolean" ? v : d;
}
function arr(v: any) {
  return Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : [];
}

const DEFAULTS: SeoSettings = {

  meta: {

    titleTemplate: "%s | Dromocob",

    defaultTitle: "Dromocob",

    defaultDescription:

      "Altın ve özel ürün ürünleri. Güncel kurla hesaplanan fiyatlar, hızlı teslimat, güvenli alışveriş.",

    defaultOgImage: "https://dromocob.tr/og-default.jpg",

    twitterHandle: "",

    themeColor: "#0b0b0b",

    defaultKeywords: "e-ticaret, yaşam, aksesuar, teknoloji, tasarım",

    author: "Dromocob",

    publisher: "Dromocob",

    appName: "Dromocob",

  },

  google: {

    searchConsoleVerification: "",

    tagManagerId: "",

    analyticsMeasurementId: "",

  },

  robots: {

    index: false,

    follow: true,

    noindexReason: "Domain bağlanana kadar index kapalı.",

    maxSnippet: -1,

    maxImagePreview: "large",

    maxVideoPreview: -1,

    googlebot: "",

  },

  site: {

    primaryUrl: "https://dromocob.tr",

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

    organizationLogo: "https://dromocob.tr/dromocob-mark.svg",

    sameAs: [],

    phone: "",

    email: "",

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
function n(v: any, d = 0) {
  const num = Number(v);
  return Number.isFinite(num) ? num : d;
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
      defaultKeywords: s(x.meta?.defaultKeywords) || DEFAULTS.meta.defaultKeywords || "",
      author: s(x.meta?.author) || DEFAULTS.meta.author || "",
      publisher: s(x.meta?.publisher) || DEFAULTS.meta.publisher || "",
      appName: s(x.meta?.appName) || DEFAULTS.meta.appName || "",
    },

    google: {
      searchConsoleVerification: s(x.google?.searchConsoleVerification),
      tagManagerId: s(x.google?.tagManagerId),
      analyticsMeasurementId: s(x.google?.analyticsMeasurementId),
    },

    robots: {
      index: b(x.robots?.index, DEFAULTS.robots.index),
      follow: b(x.robots?.follow, DEFAULTS.robots.follow),
      noindexReason: s(x.robots?.noindexReason) || DEFAULTS.robots.noindexReason || "",
      maxSnippet: n(x.robots?.maxSnippet, DEFAULTS.robots.maxSnippet ?? -1),
      maxImagePreview:
        x.robots?.maxImagePreview === "none" ||
        x.robots?.maxImagePreview === "standard" ||
        x.robots?.maxImagePreview === "large"
          ? x.robots.maxImagePreview
          : DEFAULTS.robots.maxImagePreview || "large",
      maxVideoPreview: n(x.robots?.maxVideoPreview, DEFAULTS.robots.maxVideoPreview ?? -1),
      googlebot: s(x.robots?.googlebot),
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
      enabled: b(x.jsonld?.enabled, DEFAULTS.jsonld.enabled),
      organizationName: s(x.jsonld?.organizationName) || DEFAULTS.jsonld.organizationName,
      organizationLogo: s(x.jsonld?.organizationLogo) || DEFAULTS.jsonld.organizationLogo,
      sameAs: arr(x.jsonld?.sameAs),
      phone: s(x.jsonld?.phone),
      email: s(x.jsonld?.email),
      addressLocality: s(x.jsonld?.addressLocality) || DEFAULTS.jsonld.addressLocality || "",
      addressCountry: s(x.jsonld?.addressCountry) || DEFAULTS.jsonld.addressCountry || "",
      priceRange: s(x.jsonld?.priceRange) || DEFAULTS.jsonld.priceRange || "",
    },

    sitemap: {
      enabled: b(x.sitemap?.enabled, DEFAULTS.sitemap.enabled),
      productFeedEnabled: b(x.sitemap?.productFeedEnabled, DEFAULTS.sitemap.productFeedEnabled),
      splitSize: n(x.sitemap?.splitSize, DEFAULTS.sitemap.splitSize),
    },

    productSeo: {
      currency: s(x.productSeo?.currency) || DEFAULTS.productSeo.currency,
      condition:
        x.productSeo?.condition === "UsedCondition" ||
        x.productSeo?.condition === "RefurbishedCondition"
          ? x.productSeo.condition
          : DEFAULTS.productSeo.condition,
      availabilityInStockLabel:
        s(x.productSeo?.availabilityInStockLabel) ||
        DEFAULTS.productSeo.availabilityInStockLabel,
      availabilityOutOfStockLabel:
        s(x.productSeo?.availabilityOutOfStockLabel) ||
        DEFAULTS.productSeo.availabilityOutOfStockLabel,
      returnPolicyLabel:
        s(x.productSeo?.returnPolicyLabel) ||
        DEFAULTS.productSeo.returnPolicyLabel,
    },
  };
}
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function AdminSeoSettingsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "seo_settings"), [db]);

  const [cfg, setCfg] = useState<SeoSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as DocShape) || {};
        setCfg(normalize(data.seo));
      },
      (e) => {
        console.error(e);
        setCfg(DEFAULTS);
      }
    );
  }, [ref]);

  const canonicalBase =
    cfg.site.canonicalMode === "primary"
      ? cfg.site.primaryUrl
      : cfg.site.primaryUrl || cfg.site.fallbackUrl;

  const preview = {
    title: cfg.meta.titleTemplate.replace("%s", "Ürün Adı / Sayfa"),
    desc: cfg.meta.defaultDescription,
    og: cfg.meta.defaultOgImage,
    robots: `${cfg.robots.index ? "index" : "noindex"},${cfg.robots.follow ? "follow" : "nofollow"}`,
    canonical: canonicalBase,
  };
const titleLen = cfg.meta.defaultTitle.length;
const descLen = cfg.meta.defaultDescription.length;

const seoChecks = [
  {
    label: "Title uzunluğu uygun",
    ok: titleLen >= 20 && titleLen <= 60,
  },
  {
    label: "Description uzunluğu uygun",
    ok: descLen >= 120 && descLen <= 170,
  },
  {
    label: "Primary URL HTTPS",
    ok: cfg.site.primaryUrl.startsWith("https://"),
  },
  {
    label: "OG image tanımlı",
    ok: !!s(cfg.meta.defaultOgImage),
  },
  {
    label: "JSON-LD aktif",
    ok: cfg.jsonld.enabled,
  },
  {
    label: "Index açık",
    ok: cfg.robots.index,
  },
];
  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await setDoc(
        ref,
        stripUndefined({
          seo: cfg,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
      setMsg("Kaydedildi ✅");
      setTimeout(() => setMsg(null), 1800);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Kaydetme hatası");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (!confirm("Varsayılan SEO ayarları yüklensin mi?")) return;
    setCfg(DEFAULTS);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.kicker}>Admin • SEO Yönetimi</div>
          <h1 className={styles.title}>SEO Ayarları</h1>
          <p className={styles.sub}>
            Title, meta description, canonical, robots, Google doğrulama ve JSON-LD ayarlarını tek merkezden yönet.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={() =>
              setCfg((p) => ({
                ...p,
                robots: { ...p.robots, index: !p.robots.index },
              }))
            }
            className={styles.btnGhost}
          >
            {cfg.robots.index ? "Index Açık" : "Noindex Aktif"}
          </button>

          <button type="button" onClick={resetDefaults} className={styles.btnSoft}>
            Varsayılanları Yükle
          </button>

          <button type="button" onClick={save} disabled={saving} className={styles.btnPrimary}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </section>

      {err ? <div className={`${styles.alert} ${styles.alertErr}`}>{err}</div> : null}
      {msg ? <div className={`${styles.alert} ${styles.alertOk}`}>{msg}</div> : null}

      <section className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Meta</div>

            <div className={styles.grid2}>
              <Field
                label="Title Template"
                value={cfg.meta.titleTemplate}
                onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, titleTemplate: v } })}
              />
              <Field
                label="Default Title"
                value={cfg.meta.defaultTitle}
                onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, defaultTitle: v } })}
              />
            </div>

            <FieldArea
              label="Default Description"
              value={cfg.meta.defaultDescription}
              onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, defaultDescription: v } })}
              rows={4}
            />

            <div className={styles.grid2}>
              <Field
                label="Default OG Image"
                value={cfg.meta.defaultOgImage}
                onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, defaultOgImage: v } })}
              />
              <Field
                label="Twitter Handle"
                value={cfg.meta.twitterHandle || ""}
                onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, twitterHandle: v } })}
              />
            </div>

            <div className={styles.grid2}>
              <Field
                label="Theme Color"
                value={cfg.meta.themeColor || ""}
                onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, themeColor: v } })}
              />

              <div className={styles.field}>
                <label className={styles.label}>OpenGraph</label>
                <div className={styles.grid2Compact}>
                  <select
                    className={styles.input}
                    value={cfg.openGraph.defaultType}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        openGraph: { ...cfg.openGraph, defaultType: e.target.value as "website" | "product" },
                      })
                    }
                  >
                    <option value="website">website</option>
                    <option value="product">product</option>
                  </select>

                  <select
                    className={styles.input}
                    value={cfg.openGraph.locale}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        openGraph: { ...cfg.openGraph, locale: e.target.value as "tr_TR" | "en_US" },
                      })
                    }
                  >
                    <option value="tr_TR">tr_TR</option>
                    <option value="en_US">en_US</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
<div className={styles.grid2}>
  <Field
    label="Default Keywords"
    value={cfg.meta.defaultKeywords || ""}
    onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, defaultKeywords: v } })}
  />
  <Field
    label="App Name"
    value={cfg.meta.appName || ""}
    onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, appName: v } })}
  />
</div>

<div className={styles.grid2}>
  <Field
    label="Author"
    value={cfg.meta.author || ""}
    onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, author: v } })}
  />
  <Field
    label="Publisher"
    value={cfg.meta.publisher || ""}
    onChange={(v) => setCfg({ ...cfg, meta: { ...cfg.meta, publisher: v } })}
  />
</div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Robots / Canonical</div>

            <div className={styles.grid2}>
              <ToggleCard
                title="Index"
                desc="Domain bağlanana kadar kapalı tutmak mantıklı."
                checked={cfg.robots.index}
                onChange={(v) => setCfg({ ...cfg, robots: { ...cfg.robots, index: v } })}
              />

              <ToggleCard
                title="Follow"
                desc="Linkleri takip etmeyi kapatmak çoğu senaryoda gereksiz."
                checked={cfg.robots.follow}
                onChange={(v) => setCfg({ ...cfg, robots: { ...cfg.robots, follow: v } })}
              />
            </div>

            <Field
              label="Noindex Notu"
              value={cfg.robots.noindexReason || ""}
              onChange={(v) => setCfg({ ...cfg, robots: { ...cfg.robots, noindexReason: v } })}
            />

            <div className={styles.grid2}>
              <Field
                label="Primary URL"
                value={cfg.site.primaryUrl}
                onChange={(v) => setCfg({ ...cfg, site: { ...cfg.site, primaryUrl: v } })}
              />
              <Field
                label="Fallback URL"
                value={cfg.site.fallbackUrl}
                onChange={(v) => setCfg({ ...cfg, site: { ...cfg.site, fallbackUrl: v } })}
              />
            </div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Canonical Mode</label>
                <select
                  className={styles.input}
                  value={cfg.site.canonicalMode}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      site: { ...cfg.site, canonicalMode: e.target.value as "primary" | "auto" },
                    })
                  }
                >
                  <option value="auto">auto</option>
                  <option value="primary">force primary</option>
                </select>
                <div className={styles.helpText}>
                  Canonical base: <b>{canonicalBase}</b>
                </div>
              </div>
            </div>
          </div>
<div className={styles.grid2}>
  <Field
    label="max-snippet"
    value={String(cfg.robots.maxSnippet ?? -1)}
    onChange={(v) =>
      setCfg({ ...cfg, robots: { ...cfg.robots, maxSnippet: Number(v || -1) } })
    }
  />
  <Field
    label="max-video-preview"
    value={String(cfg.robots.maxVideoPreview ?? -1)}
    onChange={(v) =>
      setCfg({ ...cfg, robots: { ...cfg.robots, maxVideoPreview: Number(v || -1) } })
    }
  />
</div>

<div className={styles.grid2}>
  <div className={styles.field}>
    <label className={styles.label}>max-image-preview</label>
    <select
      className={styles.input}
      value={cfg.robots.maxImagePreview || "large"}
      onChange={(e) =>
        setCfg({
          ...cfg,
          robots: {
            ...cfg.robots,
            maxImagePreview: e.target.value as "none" | "standard" | "large",
          },
        })
      }
    >
      <option value="none">none</option>
      <option value="standard">standard</option>
      <option value="large">large</option>
    </select>
  </div>

  <Field
    label="Googlebot Override"
    value={cfg.robots.googlebot || ""}
    onChange={(v) => setCfg({ ...cfg, robots: { ...cfg.robots, googlebot: v } })}
  />
</div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Google</div>

            <div className={styles.grid2}>
              <Field
                label="Search Console Verification"
                value={cfg.google.searchConsoleVerification}
                onChange={(v) => setCfg({ ...cfg, google: { ...cfg.google, searchConsoleVerification: v } })}
              />
              <Field
                label="GTM ID"
                value={cfg.google.tagManagerId}
                onChange={(v) => setCfg({ ...cfg, google: { ...cfg.google, tagManagerId: v } })}
              />
            </div>

            <Field
              label="GA4 Measurement ID"
              value={cfg.google.analyticsMeasurementId}
              onChange={(v) => setCfg({ ...cfg, google: { ...cfg.google, analyticsMeasurementId: v } })}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>JSON-LD</div>

            <ToggleCard
              title="Organization JSON-LD aktif"
              desc="Marka güveni ve rich results için iyi."
              checked={cfg.jsonld.enabled}
              onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, enabled: v } })}
            />

            <div className={styles.grid2}>
              <Field
                label="Organization Name"
                value={cfg.jsonld.organizationName}
                onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, organizationName: v } })}
              />
              <Field
                label="Organization Logo"
                value={cfg.jsonld.organizationLogo}
                onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, organizationLogo: v } })}
              />
            </div>

            <FieldArea
              label="SameAs (satır satır)"
              value={(cfg.jsonld.sameAs || []).join("\n")}
              onChange={(v) =>
                setCfg({
                  ...cfg,
                  jsonld: { ...cfg.jsonld, sameAs: v.split("\n").map(s).filter(Boolean) },
                })
              }
              rows={4}
            />
          </div>
        </div>
<div className={styles.card}>
  <div className={styles.cardTitle}>Sitemap / Feed</div>

  <div className={styles.grid2}>
    <ToggleCard
      title="Sitemap aktif"
      desc="Arama motorları için sitemap üretimi açık olsun."
      checked={cfg.sitemap.enabled}
      onChange={(v) => setCfg({ ...cfg, sitemap: { ...cfg.sitemap, enabled: v } })}
    />

    <ToggleCard
      title="Product feed aktif"
      desc="Merchant ve feed bazlı entegrasyonlar için faydalı."
      checked={cfg.sitemap.productFeedEnabled}
      onChange={(v) => setCfg({ ...cfg, sitemap: { ...cfg.sitemap, productFeedEnabled: v } })}
    />
  </div>

  <Field
    label="Sitemap Split Size"
    value={String(cfg.sitemap.splitSize)}
    onChange={(v) => setCfg({ ...cfg, sitemap: { ...cfg.sitemap, splitSize: Number(v || 5000) } })}
  />
</div>
<div className={styles.card}>
  <div className={styles.cardTitle}>Brand / Local SEO</div>

  <div className={styles.grid2}>
    <Field
      label="Telefon"
      value={cfg.jsonld.phone || ""}
      onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, phone: v } })}
    />
    <Field
      label="E-posta"
      value={cfg.jsonld.email || ""}
      onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, email: v } })}
    />
  </div>

  <div className={styles.grid2}>
    <Field
      label="Şehir"
      value={cfg.jsonld.addressLocality || ""}
      onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, addressLocality: v } })}
    />
    <Field
      label="Ülke"
      value={cfg.jsonld.addressCountry || ""}
      onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, addressCountry: v } })}
    />
  </div>

  <Field
    label="Price Range"
    value={cfg.jsonld.priceRange || ""}
    onChange={(v) => setCfg({ ...cfg, jsonld: { ...cfg.jsonld, priceRange: v } })}
  />
</div>
<div className={styles.card}>
  <div className={styles.cardTitle}>Product SEO Varsayılanları</div>

  <div className={styles.grid2}>
    <Field
      label="Currency"
      value={cfg.productSeo.currency}
      onChange={(v) => setCfg({ ...cfg, productSeo: { ...cfg.productSeo, currency: v } })}
    />

    <div className={styles.field}>
      <label className={styles.label}>Condition</label>
      <select
        className={styles.input}
        value={cfg.productSeo.condition}
        onChange={(e) =>
          setCfg({
            ...cfg,
            productSeo: {
              ...cfg.productSeo,
              condition: e.target.value as
                | "NewCondition"
                | "UsedCondition"
                | "RefurbishedCondition",
            },
          })
        }
      >
        <option value="NewCondition">NewCondition</option>
        <option value="UsedCondition">UsedCondition</option>
        <option value="RefurbishedCondition">RefurbishedCondition</option>
      </select>
    </div>
  </div>

  <div className={styles.grid2}>
    <Field
      label="InStock Label"
      value={cfg.productSeo.availabilityInStockLabel}
      onChange={(v) =>
        setCfg({
          ...cfg,
          productSeo: { ...cfg.productSeo, availabilityInStockLabel: v },
        })
      }
    />
    <Field
      label="OutOfStock Label"
      value={cfg.productSeo.availabilityOutOfStockLabel}
      onChange={(v) =>
        setCfg({
          ...cfg,
          productSeo: { ...cfg.productSeo, availabilityOutOfStockLabel: v },
        })
      }
    />
  </div>

  <FieldArea
    label="Return Policy Label"
    value={cfg.productSeo.returnPolicyLabel}
    onChange={(v) =>
      setCfg({
        ...cfg,
        productSeo: { ...cfg.productSeo, returnPolicyLabel: v },
      })
    }
    rows={3}
  />
</div>
        <aside className={styles.rightCol}>
          <div className={`${styles.card} ${styles.stickyCard}`}>
            <div className={styles.cardTitle}>Live Preview</div>

            <PreviewBlock label="Title" value={preview.title} />
            <PreviewBlock label="Description" value={preview.desc} />
            <PreviewBlock label="Robots" value={preview.robots} code />
            <PreviewBlock label="Canonical Base" value={preview.canonical} code />

            <div className={styles.previewBlock}>
              <div className={styles.previewLabel}>OG Image</div>
              <div className={styles.previewValueUrl}>{preview.og}</div>
              <div className={styles.imagePreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.og}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.25";
                  }}
                />
              </div>
            </div>
<div className={styles.cardTitle} style={{ marginTop: 18 }}>SEO Health</div>

<div className={styles.checkList}>
  {seoChecks.map((item) => (
    <div key={item.label} className={styles.checkItem}>
      <span className={item.ok ? styles.checkOk : styles.checkBad}>
        ●
      </span>
      <span>{item.label}</span>
    </div>
  ))}
</div>

<div className={styles.infoNote}>
  Title: <b>{titleLen}</b> karakter · Description: <b>{descLen}</b> karakter
</div>
            {!cfg.robots.index && cfg.robots.noindexReason ? (
              <div className={styles.infoNote}>
                <b>Not:</b> {cfg.robots.noindexReason}
              </div>
            ) : null}

            <div className={styles.infoNote}>
              Domain tam oturmadan <b>NOINDEX</b> açık tutmak doğru hamle.
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <textarea
        className={styles.textarea}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ToggleCard({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={styles.toggleCard}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div className={styles.toggleTitle}>{title}</div>
        <div className={styles.toggleDesc}>{desc}</div>
      </div>
    </label>
  );
}

function PreviewBlock({
  label,
  value,
  code = false,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <div className={styles.previewBlock}>
      <div className={styles.previewLabel}>{label}</div>
      <div className={code ? styles.previewCode : styles.previewValue}>{value}</div>
    </div>
  );
}

export default function AdminSeoSettingsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <AdminSeoSettingsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}