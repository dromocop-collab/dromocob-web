"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";

import f from "./appFooter.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type FooterLink = {
  label: LocaleText;
  url: string;
};

type FooterColumn = {
  title: LocaleText;
  links: FooterLink[];
};

type SocialType =
  | "instagram"
  | "whatsapp"
  | "youtube"
  | "tiktok"
  | "x"
  | "facebook"
  | "telegram";

type SocialItem = {
  type: SocialType;
  url: string;
};

type CtaSettings = {
  title?: LocaleText;
  description?: LocaleText;
  primaryLabel?: LocaleText;
  primaryUrl?: string;
  secondaryLabel?: LocaleText;
  secondaryUrl?: string;
};

type ContactSettings = {
  phone?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
};

type EtbisSettings = {
  url?: string;
  badge?: LocaleText;
  note?: LocaleText;
  linkLabel?: LocaleText;
};

type TrustSettings = {
  payment?: string[];
  security?: string[];
  shipping?: string[];
};

type FooterSettings = {
  theme?: {
    variant?: "auto" | "light" | "dark";
  };

  brand?: {
    title?: LocaleText;
    tagline?: LocaleText;
    logoUrl?: string;
    logoLink?: string;
  };

  cta?: CtaSettings;
  contact?: ContactSettings;
  chips?: LocaleText[];
  etbis?: EtbisSettings;
  trust?: TrustSettings;

  columns?: FooterColumn[];

  social?: SocialItem[];

  bottom?: {
    left?: LocaleText;
    right?: LocaleText;
  };
};

type SiteSettingsDoc = {
  footer?: FooterSettings;
};

function safeStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function localeText(loc: Locale, v: any, fallbackTR: string, fallbackEN: string) {
  const tr = safeStr(v?.tr) || fallbackTR;
  const en = safeStr(v?.en) || fallbackEN;

  return loc === "en" ? en : tr;
}

function safeUrl(v: unknown) {
  const raw = safeStr(v);

  if (!raw) return "/";
  if (raw.startsWith("http://")) return raw;
  if (raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return raw;
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("/")) return raw;

  return `/${raw.replace(/^\/+/, "")}`;
}

function isExternalUrl(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//")
  );
}

function resolvePageHref(raw: unknown, pageMap: Record<string, string>) {
  const value = safeStr(raw);

  if (!value) return "#";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("#")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  const normalizedKey = value.replace(/^\/+/, "");
  return pageMap[normalizedKey] || `/${normalizedKey}`;
}

function applyThemeVariant(variant: "auto" | "light" | "dark") {
  if (typeof document === "undefined") return;

  document.body.classList.remove("theme-light", "theme-dark");

  if (variant === "light") {
    document.body.classList.add("theme-light");
  }

  if (variant === "dark") {
    document.body.classList.add("theme-dark");
  }
}

function Icon({ type }: { type: SocialType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (type) {
    case "instagram":
      return (
        <svg {...common}>
          <path
            d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M17.5 6.5h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );

    case "whatsapp":
      return (
        <svg {...common}>
          <path
            d="M20 12a8 8 0 0 1-12.7 6.3L4 19l.8-3.2A8 8 0 1 1 20 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 9.3c.2-.5.4-.5.7-.5h.6c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .5l-.4.5c-.1.1-.1.3 0 .4.5.9 1.3 1.6 2.2 2.1.1.1.3.1.4 0l.5-.4c.1-.1.3-.1.5 0l1.6.7c.3.1.4.3.4.5v.6c0 .3 0 .5-.5.7-.6.3-1.9.4-3.5-.4-1.6-.8-3.2-2.4-4.1-4-.8-1.6-.7-2.9-.4-3.5Z"
            fill="currentColor"
            opacity=".9"
          />
        </svg>
      );

    case "youtube":
      return (
        <svg {...common}>
          <path
            d="M21 8.5s0-2-1.3-2.9C18.4 4.8 12 4.8 12 4.8s-6.4 0-7.7.8C3 6.5 3 8.5 3 8.5v7s0 2 1.3 2.9c1.3.8 7.7.8 7.7.8s6.4 0 7.7-.8C21 17.5 21 15.5 21 15.5v-7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M10.5 9.5 15 12l-4.5 2.5v-5Z" fill="currentColor" />
        </svg>
      );

    case "tiktok":
      return (
        <svg {...common}>
          <path
            d="M14 3v10.2a3.8 3.8 0 1 1-3-3.7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 6c1.2 1.8 2.8 2.7 5 2.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "x":
      return (
        <svg {...common}>
          <path
            d="M4 4l16 16M20 4 4 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "facebook":
      return (
        <svg {...common}>
          <path
            d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v3H8v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1Z"
            fill="currentColor"
          />
        </svg>
      );

    case "telegram":
    default:
      return (
        <svg {...common}>
          <path
            d="M21 5 3 12l7 2 2 7 3-5 5-11Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M10 14 21 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

const SITE_COLUMNS: FooterColumn[] = [
  {
    title: { tr: "Hızlı Erişim", en: "Quick Access" },
    links: [
      { label: { tr: "Mağaza", en: "Shop" }, url: "/shop" },
      { label: { tr: "Kurlar", en: "Rates" }, url: "/rates" },
      { label: { tr: "Ara", en: "Search" }, url: "/search" },
      { label: { tr: "Ölçü Rehberi", en: "Size Guide" }, url: "/olcu-rehberi" },
      { label: { tr: "Hediye Danışmanlığı", en: "Gift Advisor" }, url: "/hediye-danismanligi" },
      { label: { tr: "Randevu", en: "Appointment" }, url: "/randevu-magaza-deneyimi" },
    ],
  },
  {
    title: { tr: "Kurumsal", en: "Company" },
    links: [
      { label: { tr: "Hakkımızda", en: "About" }, url: "/hakkimizda" },
      { label: { tr: "İletişim", en: "Contact" }, url: "/iletisim" },
      { label: { tr: "Sertifika & Güvence", en: "Certificates" }, url: "/sertifika-guvence" },
    ],
  },
  {
    title: { tr: "Yardım", en: "Help" },
    links: [
      { label: { tr: "Sıkça Sorulan Sorular", en: "FAQ" }, url: "/sss" },
      { label: { tr: "Kargo & Teslimat", en: "Shipping" }, url: "/kargo-teslimat" },
      { label: { tr: "İade & İptal Koşulları", en: "Returns" }, url: "/iade-ve-iptal-kosullari" },
    ],
  },
  {
    title: { tr: "Yasal", en: "Legal" },
    links: [
      { label: { tr: "Gizlilik Politikası", en: "Privacy" }, url: "/gizlilik-politikasi" },
      { label: { tr: "Kullanım Koşulları", en: "Terms" }, url: "/kullanim-kosullari" },
      { label: { tr: "KVKK Aydınlatma", en: "GDPR" }, url: "/kvkk-aydinlatma-metni" },
      { label: { tr: "Mesafeli Satış Sözleşmesi", en: "Distance Sales" }, url: "/mesafeli-satis-sozlesmesi" },
      { label: { tr: "Ön Bilgilendirme Formu", en: "Pre-Info" }, url: "/on-bilgilendirme-formu" },
      { label: { tr: "Çerez Politikası", en: "Cookie Policy" }, url: "/cerez-politikasi" },
    ],
  },
];

const DEFAULT_ETBIS_LINK =
  "https://etbis.ticaret.gov.tr/tr/SiteSorgulamaSonuc?siteId=c8bc0d26-be30-4592-9f26-4cd94b475a40";

const DEFAULT_CONTACT: ContactSettings = {
  phone: "+90 530 478 82 98",
  email: "info@dromocob.tr",
  address: "İstanbul · Demo Showroom",
  whatsapp: "905304788298",
};

const DEFAULT_CHIPS: LocaleText[] = [
  { tr: "Sertifikalı", en: "Certified" },
  { tr: "Sigortalı Kargo", en: "Insured Shipping" },
  { tr: "3D Secure", en: "3D Secure" },
];

const DEFAULT_TRUST: TrustSettings = {
  payment: ["Visa", "Mastercard", "Troy", "PayTR"],
  security: ["SSL", "3D Secure", "KVKK"],
  shipping: ["DHL Kargo", "Sigortalı"],
};

export default function AppFooter() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [cfg, setCfg] = useState<FooterSettings | null>(null);
  const [pageMap, setPageMap] = useState<Record<string, string>>({});
  const [mobileAppCfg, setMobileAppCfg] = useState<{
    enabled: boolean;
    appStoreUrl: string;
    googlePlayUrl: string;
  }>({ enabled: false, appStoreUrl: "", googlePlayUrl: "" });

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setLoc(((ce.detail as Locale) || "tr") as Locale);
    };

    window.addEventListener("locale-changed", handler as EventListener);

    return () => {
      window.removeEventListener("locale-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const ref = collection(db, "pages");

    return onSnapshot(
      ref,
      (snap) => {
        const nextMap: Record<string, string> = {};

        snap.forEach((d) => {
          const data = d.data() as any;

          const group = safeStr(data?.group).replace(/^\/+|\/+$/g, "");
          const slug = safeStr(data?.slug).replace(/^\/+|\/+$/g, "");
          const pathRaw = safeStr(data?.path);

          const path = pathRaw
            ? safeUrl(pathRaw)
            : group && slug
            ? `/${group}/${slug}`
            : slug
            ? `/${slug}`
            : "";

          if (slug && path) {
            nextMap[slug] = path;

            if (group) {
              nextMap[`${group}/${slug}`] = path;
            }
          }
        });

        setPageMap(nextMap);
      },
      () => {
        setPageMap({});
      }
    );
  }, [db]);

  useEffect(() => {
    const ref = doc(db, "settings", "site");

    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as SiteSettingsDoc) || {};
        const footer = data.footer || null;

        setCfg(footer);

        const variant = footer?.theme?.variant || "auto";
        applyThemeVariant(variant);
      },
      () => {
        setCfg(null);
        applyThemeVariant("auto");
      }
    );
  }, [db]);

  /* settings/public → mobileApp dinle */
  useEffect(() => {
    const pubRef = doc(db, "settings", "public");
    return onSnapshot(
      pubRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const ma = d?.mobileApp && typeof d.mobileApp === "object" ? d.mobileApp : {};
          setMobileAppCfg({
            enabled: Boolean(ma.enabled),
            appStoreUrl: String(ma.appStoreUrl || ""),
            googlePlayUrl: String(ma.googlePlayUrl || ""),
          });
        }
      },
      () => { /* ignore */ }
    );
  }, [db]);

  const year = new Date().getFullYear();

  const brandTitle = localeText(
    loc,
    cfg?.brand?.title,
    "Dromocob",
    "Dromocob"
  );

  const brandTagline = localeText(
    loc,
    cfg?.brand?.tagline,
    "Sertifikalı ürün • Güvenli ödeme • Hızlı kargo",
    "Certified products • Secure payment • Fast shipping"
  );

  const logoUrl = safeStr(cfg?.brand?.logoUrl);
  const logoLink = safeUrl(cfg?.brand?.logoLink || "/");

  // Firestore'dan geliyorsa onu kullan, yoksa hardcoded fallback
  const columns = (Array.isArray(cfg?.columns) && cfg!.columns.length > 0)
    ? cfg!.columns
    : SITE_COLUMNS;

  // CTA
  const ctaTitle = localeText(
    loc, cfg?.cta?.title,
    "Mükemmel hediyeyi seçmekte yardıma mı ihtiyacın var?",
    "Need help choosing the perfect gift?"
  );
  const ctaDesc = localeText(
    loc, cfg?.cta?.description,
    "özel ürün uzmanlarımız sana en uygun parçayı bulmak için burada.",
    "Our lifestyle experts are here to help you find the perfect piece."
  );
  const ctaPrimaryLabel = localeText(loc, cfg?.cta?.primaryLabel, "WhatsApp", "WhatsApp");
  const ctaPrimaryUrl = safeStr(cfg?.cta?.primaryUrl);
  const ctaSecondaryLabel = localeText(loc, cfg?.cta?.secondaryLabel, "İletişim", "Contact");
  const ctaSecondaryUrl = safeStr(cfg?.cta?.secondaryUrl) || "/iletisim";

  // İletişim
  const contact: ContactSettings = {
    phone: safeStr(cfg?.contact?.phone) || DEFAULT_CONTACT.phone,
    email: safeStr(cfg?.contact?.email) || DEFAULT_CONTACT.email,
    address: safeStr(cfg?.contact?.address) || DEFAULT_CONTACT.address,
    whatsapp: safeStr(cfg?.contact?.whatsapp) || DEFAULT_CONTACT.whatsapp,
  };

  // Güvence Chip'leri
  const chips: LocaleText[] = (Array.isArray(cfg?.chips) && cfg!.chips.length > 0)
    ? cfg!.chips
    : DEFAULT_CHIPS;

  // ETBİS
  const etbisUrl = safeStr(cfg?.etbis?.url) || DEFAULT_ETBIS_LINK;
  const etbisBadge = localeText(loc, cfg?.etbis?.badge, "Resmi Kayıt", "Official Record");
  const etbisNote = localeText(
    loc, cfg?.etbis?.note,
    "E-ticaret kaydımızı resmi ETBİS sistemi üzerinden doğrulayabilirsiniz.",
    "Verify our e-commerce registration through the official ETBIS system."
  );
  const etbisLinkLabel = localeText(loc, cfg?.etbis?.linkLabel, "ETBİS Doğrula", "Verify ETBIS");

  // Trust Band
  const trust: TrustSettings = {
    payment: (Array.isArray(cfg?.trust?.payment) && cfg!.trust!.payment.length > 0)
      ? cfg!.trust!.payment : DEFAULT_TRUST.payment,
    security: (Array.isArray(cfg?.trust?.security) && cfg!.trust!.security.length > 0)
      ? cfg!.trust!.security : DEFAULT_TRUST.security,
    shipping: (Array.isArray(cfg?.trust?.shipping) && cfg!.trust!.shipping.length > 0)
      ? cfg!.trust!.shipping : DEFAULT_TRUST.shipping,
  };

  const socials: SocialItem[] = Array.isArray(cfg?.social) ? cfg.social : [];

  const socialOrder: SocialType[] = [
    "instagram",
    "whatsapp",
    "youtube",
    "tiktok",
    "x",
    "facebook",
    "telegram",
  ];

  const socialSorted = socials
    .filter((x): x is SocialItem => {
      return Boolean(x?.type && x?.url);
    })
    .sort((a, b) => socialOrder.indexOf(a.type) - socialOrder.indexOf(b.type))
    .slice(0, 6);

  const bottomLeft = localeText(
    loc,
    cfg?.bottom?.left,
    "© {{year}} Dromocob — Tüm hakları saklıdır.",
    "© {{year}} Dromocob — All rights reserved."
  ).replace("{{year}}", String(year));

  const bottomRight = localeText(
    loc,
    cfg?.bottom?.right,
    "Güvenli alışveriş deneyimi",
    "Secure shopping experience"
  );

  return (
    <footer className={f.footer}>
      <div className={f.inner}>
        {/* ─── CTA Band ─── */}
        <div className={f.ctaBand}>
          <div className={f.ctaLeft}>
            <h2 className={f.ctaTitle}>{ctaTitle}</h2>
            <p className={f.ctaDesc}>{ctaDesc}</p>
          </div>
          <div className={f.ctaActions}>
            <a
              href={ctaPrimaryUrl ? ctaPrimaryUrl : `https://wa.me/${contact.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className={`${f.ctaBtn} ${f.ctaBtnPrimary}`}
            >
              {ctaPrimaryLabel}
            </a>
            <Link href={ctaSecondaryUrl} className={`${f.ctaBtn} ${f.ctaBtnSecondary}`}>
              {ctaSecondaryLabel}
            </Link>
          </div>
        </div>

        {/* ─── Main Grid ─── */}
        <div className={f.topRow}>
          {/* Brand */}
          <div className={f.brandBlock}>
            <Link href={logoLink} className={f.brandLink} aria-label={brandTitle}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={f.logo} src={logoUrl} alt={brandTitle} />
              ) : (
                <div className={f.brandMark} aria-hidden="true">
                  6
                </div>
              )}

              <div className={f.brandText}>
                <div className={f.brandTitle}>{brandTitle}</div>
                <div className={f.tagline}>{brandTagline}</div>
              </div>
            </Link>

            <div className={f.brandChips}>
              {chips.map((chip, i) => (
                <span key={i} className={f.brandChip}>
                  {localeText(loc, chip, chip.tr || "", chip.en || "")}
                </span>
              ))}
            </div>

            {/* İletişim bilgileri */}
            <div className={f.contactInfo}>
              <div className={f.contactRow}>
                <span className={f.contactIcon}>📍</span>
                <span>{contact.address}</span>
              </div>
              <div className={f.contactRow}>
                <span className={f.contactIcon}>📞</span>
                <a href={`tel:${(contact.phone || "").replace(/\s+/g, "")}`} className={f.contactLink}>
                  {contact.phone}
                </a>
              </div>
              <div className={f.contactRow}>
                <span className={f.contactIcon}>✉️</span>
                <a href={`mailto:${contact.email}`} className={f.contactLink}>
                  {contact.email}
                </a>
              </div>
            </div>

            {socialSorted.length ? (
              <div className={f.socialRow} aria-label="Sosyal medya linkleri">
                {socialSorted.map((x, i) => {
                  const href = safeStr(x.url);

                  if (!href) return null;

                  return (
                    <a
                      key={`${x.type}-${i}`}
                      className={f.socialBtn}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={x.type}
                      title={x.type}
                    >
                      <Icon type={x.type} />
                    </a>
                  );
                })}
              </div>
            ) : null}

            {/* App Store / Google Play badge'leri */}
            {mobileAppCfg.enabled && (mobileAppCfg.appStoreUrl || mobileAppCfg.googlePlayUrl) ? (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {mobileAppCfg.appStoreUrl ? (
                  <a
                    href={mobileAppCfg.appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="App Store'dan İndir"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 10,
                      background: "#000",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      lineHeight: 1.3,
                      transition: "transform 0.15s",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <span>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 400, opacity: 0.8 }}>
                        {loc === "en" ? "Download on the" : "İndirmek için"}
                      </span>
                      App Store
                    </span>
                  </a>
                ) : null}
                {mobileAppCfg.googlePlayUrl ? (
                  <a
                    href={mobileAppCfg.googlePlayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Google Play'den İndir"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 10,
                      background: "#000",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      lineHeight: 1.3,
                      transition: "transform 0.15s",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.707l2.108 1.222a1 1 0 010 1.74l-2.108 1.222-2.536-2.536 2.536-2.648zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" />
                    </svg>
                    <span>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 400, opacity: 0.8 }}>
                        {loc === "en" ? "Get it on" : "İndirmek için"}
                      </span>
                      Google Play
                    </span>
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Columns */}
          <div className={f.cols}>
            {columns.slice(0, 4).map((col, idx) => (
              <div key={idx} className={f.col}>
                <div className={f.colTitle}>
                  {localeText(loc, col.title, "Başlık", "Title")}
                </div>

                <div className={f.links}>
                  {(Array.isArray(col.links) ? col.links : [])
                    .slice(0, 8)
                    .map((lnk, i) => {
                      const href = resolvePageHref(lnk.url, pageMap);
                      const text = localeText(loc, lnk.label, "Link", "Link");

                      if (href === "#") {
                        return (
                          <span key={i} className={`${f.link} ${f.linkDisabled}`}>
                            {text}
                          </span>
                        );
                      }

                      if (isExternalUrl(href)) {
                        return (
                          <a
                            key={i}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className={f.link}
                          >
                            {text}
                            <span className={f.externalIcon} aria-hidden="true">
                              ↗
                            </span>
                          </a>
                        );
                      }

                      return (
                        <Link
                          key={i}
                          href={href}
                          className={f.link}
                          prefetch={false}
                        >
                          {text}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* ETBIS */}
          <div className={f.etbis}>
            <div className={f.colTitle}>ETBİS</div>

            <div className={f.etbisCard}>
              <div className={f.etbisBadge}>{etbisBadge}</div>

              <div className={f.etbisNote}>{etbisNote}</div>

              <a
                href={etbisUrl}
                target="_blank"
                rel="noreferrer"
                className={f.etbisLink}
              >
                {etbisLinkLabel}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* ─── Ödeme & Güvenlik Trust Band ─── */}
        <div className={f.trustBand}>
          <div className={f.trustGroup}>
            <span className={f.trustLabel}>
              {loc === "en" ? "Payment" : "Ödeme"}
            </span>
            {(trust.payment || []).map((b, i) => (
              <span key={i} className={f.trustBadge}>{b}</span>
            ))}
          </div>

          <div className={f.trustDot} />

          <div className={f.trustGroup}>
            <span className={f.trustLabel}>
              {loc === "en" ? "Security" : "Güvenlik"}
            </span>
            {(trust.security || []).map((b, i) => (
              <span key={i} className={f.trustBadge}>{b}</span>
            ))}
          </div>

          <div className={f.trustDot} />

          <div className={f.trustGroup}>
            <span className={f.trustLabel}>
              {loc === "en" ? "Shipping" : "Kargo"}
            </span>
            {(trust.shipping || []).map((b, i) => (
              <span key={i} className={f.trustBadge}>{b}</span>
            ))}
          </div>
        </div>

        {/* ─── Bottom ─── */}
        <div className={f.bottom}>
          <span className={f.bottomLeft}>{bottomLeft}</span>
          <span className={f.bottomRight}>{bottomRight}</span>
        </div>
      </div>
    </footer>
  );
}