"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { uploadSettingsImage } from "@/lib/uploadProductImage";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./siteSettingsAdmin.module.css";

type Locale = "tr" | "en";
type LocaleText = { tr: string; en: string };

type SocialType =
  | "instagram"
  | "whatsapp"
  | "youtube"
  | "tiktok"
  | "x"
  | "facebook"
  | "telegram";

type SocialItem = { type: SocialType; url: string };

type ContactSettings = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: LocaleText;
  mapUrl?: string;
};

type ShippingSettings = {
  enabled?: boolean;
  freeOver?: number | null;
  flatFee?: number | null;
  note?: LocaleText;
};

type SeoSettings = {
  title?: LocaleText;
  description?: LocaleText;
  ogImageUrl?: string;
};

type MaintenanceSettings = {
  enabled?: boolean;
  message?: LocaleText;
};

type BrandSettings = {
  title?: LocaleText;
  tagline?: LocaleText;
  logoUrl?: string;
  logoLink?: string;
  faviconUrl?: string;
};

type SiteSettings = {
  envLabel?: "prod" | "staging" | "dev";
  theme?: { variant?: "auto" | "light" | "dark" };
  brand?: BrandSettings;
  announcement?: { enabled?: boolean; text?: LocaleText };
  contact?: ContactSettings;
  shipping?: ShippingSettings;
  payment?: {
    enabled?: boolean;
    note?: LocaleText;
  };
  social?: SocialItem[];
  seo?: SeoSettings;
  maintenance?: MaintenanceSettings;
};

type CartExpirySettings = {
  enabled?: boolean;
  hours?: number;
  moveToFavorites?: boolean;
  message?: string;
};

type MobileAppSettings = {
  enabled?: boolean;
  appStoreUrl?: string;
  googlePlayUrl?: string;
};

type PublicSettings = {
  ratesEnabled?: boolean;
  cartRatesAutoRefresh?: boolean;
  cartRefreshMinutes?: number;
  checkoutEnabled?: boolean;
  cartExpiry?: CartExpirySettings;
  mobileApp?: MobileAppSettings;
};

type SettingsDoc = { site?: SiteSettings };

const emptyLT = (): LocaleText => ({ tr: "", en: "" });

function toNumberOrNull(v: any) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSite(x: any): SiteSettings {
  const out: SiteSettings = typeof x === "object" && x ? x : {};

  out.envLabel = (out.envLabel as any) || "prod";
  out.theme = out.theme || { variant: "auto" };

  out.brand = out.brand || {};
  out.brand.title = out.brand.title && typeof out.brand.title === "object" ? out.brand.title : emptyLT();
  out.brand.tagline = out.brand.tagline && typeof out.brand.tagline === "object" ? out.brand.tagline : emptyLT();
  out.brand.logoUrl = String(out.brand.logoUrl || "");
  out.brand.logoLink = String(out.brand.logoLink || "/");
  out.brand.faviconUrl = String(out.brand.faviconUrl || "");

  out.announcement = out.announcement || {};
  out.announcement.enabled = Boolean(out.announcement.enabled);
  out.announcement.text = out.announcement.text && typeof out.announcement.text === "object" ? out.announcement.text : emptyLT();

  out.contact = out.contact || {};
  out.contact.phone = String(out.contact.phone || "");
  out.contact.whatsapp = String(out.contact.whatsapp || "");
  out.contact.email = String(out.contact.email || "");
  out.contact.mapUrl = String(out.contact.mapUrl || "");
  out.contact.address = out.contact.address && typeof out.contact.address === "object" ? out.contact.address : emptyLT();

  out.shipping = out.shipping || {};
  out.shipping.enabled = out.shipping.enabled !== false;
  out.shipping.freeOver = toNumberOrNull(out.shipping.freeOver);
  out.shipping.flatFee = toNumberOrNull(out.shipping.flatFee);
  out.shipping.note = out.shipping.note && typeof out.shipping.note === "object" ? out.shipping.note : emptyLT();

  out.payment = out.payment || {};
  out.payment.enabled = out.payment.enabled !== false;
  out.payment.note = out.payment.note && typeof out.payment.note === "object" ? out.payment.note : emptyLT();

  const socRaw = (out as any).social;
  let soc: any[] = [];
  if (Array.isArray(socRaw)) soc = socRaw;
  else if (socRaw && typeof socRaw === "object") soc = Object.values(socRaw);

  out.social = soc
    .map((a: any) => ({
      type: String(a?.type || "instagram") as SocialType,
      url: String(a?.url || "").trim(),
    }))
    .filter((a: SocialItem) => a.type && a.url);

  out.seo = out.seo || {};
  out.seo.title = out.seo.title && typeof out.seo.title === "object" ? out.seo.title : emptyLT();
  out.seo.description = out.seo.description && typeof out.seo.description === "object" ? out.seo.description : emptyLT();
  out.seo.ogImageUrl = String(out.seo.ogImageUrl || "");

  out.maintenance = out.maintenance || {};
  out.maintenance.enabled = Boolean(out.maintenance.enabled);
  out.maintenance.message = out.maintenance.message && typeof out.maintenance.message === "object" ? out.maintenance.message : emptyLT();

  return out;
}

function normalizePublic(x: any): PublicSettings {
  const out: PublicSettings = typeof x === "object" && x ? x : {};

  const ce = out.cartExpiry && typeof out.cartExpiry === "object" ? out.cartExpiry : {};
  const ma = out.mobileApp && typeof out.mobileApp === "object" ? out.mobileApp : {};

  return {
    ratesEnabled: out.ratesEnabled !== false,
    cartRatesAutoRefresh: out.cartRatesAutoRefresh !== false,
    cartRefreshMinutes:
      Number.isFinite(Number(out.cartRefreshMinutes)) && Number(out.cartRefreshMinutes) > 0
        ? Number(out.cartRefreshMinutes)
        : 4,
    checkoutEnabled: out.checkoutEnabled !== false,
    cartExpiry: {
      enabled: ce.enabled !== false,
      hours:
        Number.isFinite(Number(ce.hours)) && Number(ce.hours) > 0
          ? Number(ce.hours)
          : 24,
      moveToFavorites: ce.moveToFavorites !== false,
      message: String(ce.message || ""),
    },
    mobileApp: {
      enabled: Boolean(ma.enabled),
      appStoreUrl: String(ma.appStoreUrl || ""),
      googlePlayUrl: String(ma.googlePlayUrl || ""),
    },
  };
}

type TabKey =
  | "general"
  | "brand"
  | "contact"
  | "shipping"
  | "seo"
  | "ops";

type RealMaintenanceState = {
  enabled: boolean;
  launchActive: boolean;
};

function SiteSettingsAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const siteRef = useMemo(() => doc(db, "settings", "site"), [db]);
  const publicRef = useMemo(() => doc(db, "settings", "public"), [db]);
  const maintenanceRef = useMemo(() => doc(db, "site_options", "maintenance_settings"), [db]);

  const [tab, setTab] = useState<TabKey>("general");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [cfg, setCfg] = useState<SiteSettings>(() =>
    normalizeSite({
      envLabel: "prod",
      theme: { variant: "auto" },
      brand: {
        title: { tr: "Dromocob", en: "Dromocob" },
        tagline: emptyLT(),
        logoUrl: "",
        faviconUrl: "",
        logoLink: "/",
      },
      announcement: { enabled: false, text: emptyLT() },
      contact: { phone: "", whatsapp: "", email: "", mapUrl: "", address: emptyLT() },
      shipping: { enabled: true, freeOver: 0, flatFee: 0, note: emptyLT() },
      payment: { enabled: true, note: emptyLT() },
      social: [],
      seo: { title: emptyLT(), description: emptyLT(), ogImageUrl: "" },
      maintenance: { enabled: false, message: emptyLT() },
    })
  );

  const [pub, setPub] = useState<PublicSettings>(() =>
    normalizePublic({
      ratesEnabled: true,
      cartRatesAutoRefresh: true,
      cartRefreshMinutes: 4,
      checkoutEnabled: true,
    })
  );

  /* Gerçek bakım modu state — site_options/maintenance_settings */
  const [realMaintenance, setRealMaintenance] = useState<RealMaintenanceState>({
    enabled: false,
    launchActive: false,
  });

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1600);
  }

  useEffect(() => {
    const unsub = onSnapshot(
      siteRef,
      (snap) => {
        const data = (snap.data() as SettingsDoc) || {};
        setCfg(normalizeSite(data.site || {}));
      },
      () => showToast("settings/site okunamadı")
    );
    return () => unsub();
  }, [siteRef]);

  useEffect(() => {
    const unsub = onSnapshot(
      publicRef,
      (snap) => {
        setPub(normalizePublic(snap.exists() ? snap.data() : {}));
      },
      () => showToast("settings/public okunamadı")
    );
    return () => unsub();
  }, [publicRef]);

  /* site_options/maintenance_settings dinle (gerçek bakım modu kaynağı) */
  useEffect(() => {
    const unsub = onSnapshot(
      maintenanceRef,
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setRealMaintenance({
          enabled: d?.enabled === true,
          launchActive: d?.launchActive === true,
        });
      },
      () => showToast("maintenance_settings okunamadı")
    );
    return () => unsub();
  }, [maintenanceRef]);

  async function saveSite(next: SiteSettings) {
    setCfg(next);
    setSaving(true);
    try {
      await setDoc(
        siteRef,
        {
          site: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Site ayarları kaydedildi ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function savePublic(next: PublicSettings) {
    setPub(next);
    setSaving(true);
    try {
      await setDoc(
        publicRef,
        {
          ...next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Operasyon ayarları kaydedildi ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  function setField(path: string, value: any) {
    const next = structuredClone(cfg) as any;
    const parts = path.split(".");
    let cur = next;

    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }

    cur[parts[parts.length - 1]] = value;
    void saveSite(next);
  }

  function setLT(path: string, loc: Locale, value: string) {
    const next = structuredClone(cfg) as any;
    const parts = path.split(".");
    let cur = next;

    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }

    const last = parts[parts.length - 1];
    cur[last] = cur[last] && typeof cur[last] === "object" ? cur[last] : emptyLT();
    cur[last][loc] = value;
    void saveSite(next);
  }

  function setPublicField<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    const next = { ...pub, [key]: value };
    void savePublic(next);
  }

  async function uploadAndSet(path: string, file: File, key: string) {
    showToast("Yükleniyor…");
    try {
      const url = await uploadSettingsImage(file, key);
      setField(path, url);
    } catch (e: any) {
      showToast(e?.message || "Upload hatası");
    }
  }

  function addSocial() {
    const next = structuredClone(cfg) as SiteSettings;
    next.social = Array.isArray(next.social) ? next.social : [];
    next.social.push({ type: "instagram", url: "" });
    void saveSite(next);
  }

  function removeSocial(i: number) {
    const next = structuredClone(cfg) as SiteSettings;
    next.social = (next.social || []).filter((_, idx) => idx !== i);
    void saveSite(next);
  }

  function setSocial(i: number, field: "type" | "url", val: string) {
    const next = structuredClone(cfg) as SiteSettings;
    next.social = next.social || [];
    (next.social[i] as any)[field] = val;
    void saveSite(next);
  }

  /* ═══════════════════════════════════════
     Tab tanımları — ikon + label
     ═══════════════════════════════════════ */
  const tabs: Array<{ key: TabKey; icon: string; label: string }> = [
    { key: "general", icon: "⚙️", label: "Genel" },
    { key: "brand", icon: "🏷️", label: "Marka" },
    { key: "contact", icon: "📞", label: "İletişim & Sosyal" },
    { key: "shipping", icon: "🚚", label: "Kargo / Ödeme" },
    { key: "seo", icon: "🔍", label: "SEO" },
    { key: "ops", icon: "🛠️", label: "Operasyon" },
  ];

  /* ═══════════════════════════════════════
     Hero stat kartları tanımları
     ═══════════════════════════════════════ */
  const envLabels: Record<string, string> = { prod: "Production", staging: "Staging", dev: "Development" };

  const statCards: Array<{
    icon: string;
    label: string;
    value: string;
    tone: "ok" | "bad" | "warn" | "neutral";
    hint: string;
    goTab: TabKey;
  }> = [
    {
      icon: "🛒",
      label: "Satış",
      value: pub.checkoutEnabled ? "Açık" : "Kapalı",
      tone: pub.checkoutEnabled ? "ok" : "bad",
      hint: "Checkout durumu",
      goTab: "ops",
    },
    {
      icon: "💱",
      label: "Kur Sistemi",
      value: pub.ratesEnabled ? "Aktif" : "Pasif",
      tone: pub.ratesEnabled ? "ok" : "warn",
      hint: "Canlı kur fiyatlama",
      goTab: "ops",
    },
    {
      icon: "🔧",
      label: "Bakım Modu",
      value: realMaintenance.enabled
        ? realMaintenance.launchActive
          ? "Açılış Geri Sayımı"
          : "Aktif"
        : "Kapalı",
      tone: realMaintenance.enabled ? "bad" : "ok",
      hint: realMaintenance.enabled ? "Ziyaretçiler göremez" : "Site yayında",
      goTab: "general",
    },
    {
      icon: "📢",
      label: "Duyuru Barı",
      value: cfg.announcement?.enabled ? "Açık" : "Kapalı",
      tone: cfg.announcement?.enabled ? "ok" : "neutral",
      hint: "Üst banner",
      goTab: "general",
    },
    {
      icon: "💬",
      label: "WhatsApp",
      value: cfg.contact?.whatsapp
        ? cfg.contact.whatsapp.replace(/^90/, "0 ").replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4")
        : "—",
      tone: cfg.contact?.whatsapp ? "ok" : "warn",
      hint: "Tüm sitede kullanılır",
      goTab: "contact",
    },
    {
      icon: "🌐",
      label: "Ortam",
      value: envLabels[cfg.envLabel || "prod"] || cfg.envLabel || "prod",
      tone: cfg.envLabel === "prod" ? "ok" : "warn",
      hint: cfg.envLabel || "prod",
      goTab: "general",
    },
  ];

  /* ═══════════════════════════════════════
     Tab intro açıklamaları
     ═══════════════════════════════════════ */
  const tabIntros: Record<TabKey, { icon: string; text: React.ReactNode }> = {
    general: {
      icon: "⚙️",
      text: (
        <>
          <strong>Genel Ayarlar</strong> — Sitenin ortam bilgisi, tema, duyuru barı ve bakım modu.
          Bu değişiklikler anında siteye yansır.
        </>
      ),
    },
    brand: {
      icon: "🏷️",
      text: (
        <>
          <strong>Marka Kimliği</strong> — Logo, favicon, site başlığı ve slogan.
          Tüm sayfaların header ve meta bilgilerini etkiler.
        </>
      ),
    },
    contact: {
      icon: "📞",
      text: (
        <>
          <strong>İletişim & Sosyal Medya</strong> — Telefon, WhatsApp, e-posta, adres ve sosyal medya hesapları.
          Buradaki <strong>WhatsApp numarası tüm site genelinde</strong> (footer, floating butonlar, iletişim sayfası, checkout vb.) kullanılır.
        </>
      ),
    },
    shipping: {
      icon: "🚚",
      text: (
        <>
          <strong>Kargo & Ödeme</strong> — Kargo ücreti ayarları, ücretsiz kargo limiti ve ödeme bilgilendirme notu.
          Checkout sürecini doğrudan etkiler.
        </>
      ),
    },
    seo: {
      icon: "🔍",
      text: (
        <>
          <strong>SEO Ayarları</strong> — Arama motoru optimizasyonu için meta title, description ve OG Image.
          Google arama sonuçlarında ve sosyal medya paylaşımlarında görünür.
        </>
      ),
    },
    ops: {
      icon: "🛠️",
      text: (
        <>
          <strong>Satış Operasyonu</strong> — Checkout açık/kapalı, kur sistemi ve sepet otomatik yenileme ayarları.
          Bu alanlar <code className={s.mono}>settings/public</code> altında tutulur.
        </>
      ),
    },
  };

  const toneClass = (tone: string) => {
    if (tone === "ok") return s.statCardValueOk;
    if (tone === "bad") return s.statCardValueBad;
    if (tone === "warn") return s.statCardValueWarn;
    return "";
  };

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      {/* ═══ HERO ═══ */}
      <section className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.kicker}>Admin • Merkezi Kontrol</div>
          <h1 className={s.title}>Site Ayarları</h1>
          <p className={s.sub}>
            Vitrin, marka, iletişim, kargo, SEO ve satış operasyonunu tek panelden yönet.
            Tüm değişiklikler anında siteye yansır.
          </p>

          <div className={s.badges}>
            <span className={s.badge}>settings/site</span>
            <span className={s.badge}>settings/public</span>
            <span className={`${s.badge} ${saving ? s.badgeWarn : s.badgeOk}`}>
              {saving ? "Kaydediliyor…" : "Hazır"}
            </span>
          </div>
        </div>

        <div className={s.heroRight}>
          {statCards.map((card) => (
            <div
              key={card.label}
              className={s.statCard}
              onClick={() => setTab(card.goTab)}
              title={`${card.label} → ${card.goTab} sekmesine git`}
            >
              <div className={s.statCardLabel}>
                <span className={s.statCardIcon}>{card.icon}</span>
                {card.label}
              </div>
              <div className={`${s.statCardValue} ${toneClass(card.tone)}`}>
                {card.value}
              </div>
              <div className={s.statCardHint}>{card.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TAB BAR ═══ */}
      <section className={s.tabBar}>
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            className={`${s.tabBtn} ${tab === x.key ? s.tabBtnActive : ""}`}
            onClick={() => setTab(x.key)}
          >
            <span className={s.tabIcon}>{x.icon}</span>
            {x.label}
          </button>
        ))}
      </section>

      {/* ═══ TAB: GENEL ═══ */}
      {tab === "general" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.general.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.general.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>🌐</span>
              Ortam & Tema
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Ortam</label>
                <select
                  className={s.input}
                  value={cfg.envLabel || "prod"}
                  onChange={(e) => setField("envLabel", e.target.value)}
                >
                  <option value="prod">prod</option>
                  <option value="staging">staging</option>
                  <option value="dev">dev</option>
                </select>
                <div className={s.inputHint}>
                  Production dışı ortamlarda debug bar gösterilir.
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label}>Tema</label>
                <select
                  className={s.input}
                  value={cfg.theme?.variant || "auto"}
                  onChange={(e) => setField("theme.variant", e.target.value)}
                >
                  <option value="auto">auto</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
                <div className={s.inputHint}>
                  auto: kullanıcı sistem tercihine göre.
                </div>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>📢</span>
                Duyuru Barı
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.announcement?.enabled)}
                  onChange={(e) => setField("announcement.enabled", e.target.checked)}
                />
                <span />
              </label>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>🇹🇷 Türkçe</label>
                <input
                  className={s.input}
                  value={cfg.announcement?.text?.tr || ""}
                  onChange={(e) => setLT("announcement.text", "tr", e.target.value)}
                  placeholder="Örn: Kargo tüm siparişlerde ücretsiz! 🎉"
                />
              </div>
              <div className={s.field}>
                <label className={s.label}>🇬🇧 English</label>
                <input
                  className={s.input}
                  value={cfg.announcement?.text?.en || ""}
                  onChange={(e) => setLT("announcement.text", "en", e.target.value)}
                  placeholder="E.g.: Free shipping on all orders! 🎉"
                />
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>🔧</span>
                Bakım Modu
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={realMaintenance.enabled}
                  onChange={async (e) => {
                    const nextEnabled = e.target.checked;
                    try {
                      setSaving(true);
                      await setDoc(
                        maintenanceRef,
                        {
                          enabled: nextEnabled,
                          ...(nextEnabled
                            ? {}
                            : { launchActive: false, launchStartedAt: null, launchEndsAt: null }),
                          updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                      );
                      showToast(
                        nextEnabled
                          ? "Bakım modu aktif edildi ⚠️"
                          : "Bakım modu kapatıldı ✅"
                      );
                    } catch (err: any) {
                      showToast(err?.message || "Bakım modu değiştirilemedi");
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
                <span />
              </label>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Durum</div>
                <div className={s.settingDesc}>
                  {realMaintenance.enabled
                    ? realMaintenance.launchActive
                      ? "Açılış geri sayımı aktif — site açılmak üzere."
                      : "Bakım modu aktif — ziyaretçiler bakım sayfasını görüyor."
                    : "Site yayında — ziyaretçiler normal erişebiliyor."}
                </div>
              </div>
              <span
                className={
                  realMaintenance.enabled ? s.stateOff : s.stateOn
                }
              >
                {realMaintenance.enabled ? "Bakım Aktif" : "Yayında"}
              </span>
            </div>

            <div className={s.infoNote}>
              <span className={s.infoNoteIcon}>💡</span>
              <div className={s.infoNoteText}>
                Bakım sayfası metinleri, açılış geri sayımı ve admin önizleme gibi
                detaylı ayarlar için{" "}
                <a
                  href="/admin/maintenance"
                  style={{ color: "#4f46e5", fontWeight: 900, textDecoration: "underline" }}
                >
                  Bakım Modu Yönetim Paneli
                </a>
                &apos;ni kullan.
              </div>
            </div>

            <div className={s.hint}>
              Bu switch <b className={s.mono}>site_options/maintenance_settings</b> dokümanını günceller.
              MaintenanceGate ve admin/maintenance sayfasıyla tam senkronize çalışır.
            </div>
          </div>

          {/* ── Mobil Uygulama ── */}
          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>📱</span>
                Mobil Uygulama
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.mobileApp?.enabled)}
                  onChange={(e) =>
                    setPublicField("mobileApp", {
                      ...(pub.mobileApp || {}),
                      enabled: e.target.checked,
                    })
                  }
                />
                <span />
              </label>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Mobil Uygulama Tanıtım Bandı</div>
                <div className={s.settingDesc}>
                  Aktifken, mobil kullanıcılara sayfanın altında yapışkan bir &ldquo;Uygulamayı İndir&rdquo; bandı gösterilir.
                  Footer&apos;da da App Store badge&apos;i yer alır.
                </div>
              </div>
              <span className={pub.mobileApp?.enabled ? s.stateOn : s.stateOff}>
                {pub.mobileApp?.enabled ? "Aktif" : "Pasif"}
              </span>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>App Store URL</label>
                <input
                  className={s.input}
                  type="url"
                  placeholder="https://apps.apple.com/..."
                  value={pub.mobileApp?.appStoreUrl || ""}
                  onChange={(e) =>
                    setPublicField("mobileApp", {
                      ...(pub.mobileApp || {}),
                      appStoreUrl: e.target.value,
                    })
                  }
                />
              </div>
              <div className={s.field}>
                <label className={s.label}>Google Play URL (Opsiyonel)</label>
                <input
                  className={s.input}
                  type="url"
                  placeholder="https://play.google.com/store/apps/..."
                  value={pub.mobileApp?.googlePlayUrl || ""}
                  onChange={(e) =>
                    setPublicField("mobileApp", {
                      ...(pub.mobileApp || {}),
                      googlePlayUrl: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className={s.hint}>
              URL&apos;ler <b className={s.mono}>settings/public → mobileApp</b> altında tutulur.
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ TAB: MARKA ═══ */}
      {tab === "brand" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.brand.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.brand.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>✏️</span>
              Marka Metinleri
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Site Başlığı</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.brand?.title?.tr || ""}
                    onChange={(e) => setLT("brand.title", "tr", e.target.value)}
                    placeholder="Örn: Dromocob"
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.brand?.title?.en || ""}
                    onChange={(e) => setLT("brand.title", "en", e.target.value)}
                    placeholder="E.g.: Dromocob"
                  />
                </div>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Slogan / Tagline</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.brand?.tagline?.tr || ""}
                    onChange={(e) => setLT("brand.tagline", "tr", e.target.value)}
                    placeholder="Örn: Altın ve tasarım ürünleri"
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.brand?.tagline?.en || ""}
                    onChange={(e) => setLT("brand.tagline", "en", e.target.value)}
                    placeholder="E.g.: Gold & lifestyle"
                  />
                </div>
              </div>
            </div>

            <hr className={s.separator} />

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Logo Link</label>
                <input
                  className={s.input}
                  value={cfg.brand?.logoLink || ""}
                  onChange={(e) => setField("brand.logoLink", e.target.value)}
                  placeholder="/"
                />
                <div className={s.inputHint}>
                  Logo tıklandığında yönlendirilecek URL.
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label}>Logo URL</label>
                <input
                  className={s.input}
                  value={cfg.brand?.logoUrl || ""}
                  onChange={(e) => setField("brand.logoUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Favicon URL</label>
                <input
                  className={s.input}
                  value={cfg.brand?.faviconUrl || ""}
                  onChange={(e) => setField("brand.faviconUrl", e.target.value)}
                  placeholder="https://..."
                />
                <div className={s.inputHint}>
                  Tarayıcı sekmesinde görünen küçük ikon.
                </div>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>📤</span>
              Görsel Yükleme
            </div>

            <div className={s.uploadGrid}>
              <div className={s.uploadRow}>
                <div>
                  <div className={s.miniTitle}>Logo</div>
                  <div className={s.miniHint}>Storage key: site-logo</div>
                </div>
                <label className={s.btn}>
                  📁 Logo seç
                  <input
                    className={s.file}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAndSet("brand.logoUrl", f, "site-logo");
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className={s.uploadRow}>
                <div>
                  <div className={s.miniTitle}>Favicon</div>
                  <div className={s.miniHint}>Storage key: site-favicon</div>
                </div>
                <label className={s.btn}>
                  📁 Favicon seç
                  <input
                    className={s.file}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAndSet("brand.faviconUrl", f, "site-favicon");
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className={s.previewRow}>
              {cfg.brand?.logoUrl ? (
                <div className={s.previewBox}>
                  <div className={s.previewTitle}>Logo Preview</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={s.previewImg} src={cfg.brand.logoUrl} alt="logo" />
                </div>
              ) : null}

              {cfg.brand?.faviconUrl ? (
                <div className={s.previewBox}>
                  <div className={s.previewTitle}>Favicon Preview</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={s.previewImgSmall} src={cfg.brand.faviconUrl} alt="favicon" />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ TAB: İLETİŞİM & SOSYAL ═══ */}
      {tab === "contact" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.contact.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.contact.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>📱</span>
              İletişim Bilgileri
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Telefon</label>
                <input
                  className={s.input}
                  value={cfg.contact?.phone || ""}
                  onChange={(e) => setField("contact.phone", e.target.value)}
                  placeholder="+90 530 478 82 98"
                />
                <div className={s.inputHint}>
                  Footer ve iletişim sayfasında görünür.
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label}>💬 WhatsApp Numarası</label>
                <input
                  className={s.input}
                  value={cfg.contact?.whatsapp || ""}
                  onChange={(e) => setField("contact.whatsapp", e.target.value)}
                  placeholder="905304788298"
                />
                <div className={s.inputHint}>
                  Ülke kodu ile, boşluksuz. Örn: 905304788298
                </div>
              </div>
            </div>

            {/* WhatsApp bilgi notu */}
            <div className={s.infoNote}>
              <span className={s.infoNoteIcon}>ℹ️</span>
              <div className={s.infoNoteText}>
                Bu WhatsApp numarası <strong>tüm site genelinde</strong> tek kaynak olarak kullanılır:
                Footer, floating butonlar, iletişim sayfası, checkout başarı sayfası, hakkımızda ve newsletter e-postaları.
                Numarayı buradan değiştirdiğinde tüm sayfalar otomatik güncellenir.
              </div>
            </div>

            <hr className={s.separator} />

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>E-posta</label>
                <input
                  className={s.input}
                  value={cfg.contact?.email || ""}
                  onChange={(e) => setField("contact.email", e.target.value)}
                  placeholder="info@dromocob.tr"
                />
              </div>

              <div className={s.field}>
                <label className={s.label}>Harita URL</label>
                <input
                  className={s.input}
                  value={cfg.contact?.mapUrl || ""}
                  onChange={(e) => setField("contact.mapUrl", e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
                <div className={s.inputHint}>
                  Google Maps embed veya paylaşım linki.
                </div>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Adres</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.contact?.address?.tr || ""}
                    onChange={(e) => setLT("contact.address", "tr", e.target.value)}
                    placeholder="İstanbul · Demo Showroom"
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.contact?.address?.en || ""}
                    onChange={(e) => setLT("contact.address", "en", e.target.value)}
                    placeholder="İstanbul · Demo Showroom"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sosyal Medya — birleşik section */}
          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>🔗</span>
                Sosyal Medya Hesapları
              </div>
              <button className={s.btnDark} type="button" onClick={addSocial}>
                + Sosyal ekle
              </button>
            </div>

            {(cfg.social || []).length === 0 ? (
              <div className={s.empty}>
                Henüz sosyal medya linki eklenmedi. Yukarıdaki butonla ekleyebilirsin.
              </div>
            ) : (
              <div className={s.socialGrid}>
                {(cfg.social || []).map((x, i) => (
                  <div key={i} className={s.socialRow}>
                    <select
                      className={s.input}
                      value={x.type}
                      onChange={(e) => setSocial(i, "type", e.target.value)}
                    >
                      {["instagram", "whatsapp", "youtube", "tiktok", "x", "facebook", "telegram"].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>

                    <input
                      className={s.input}
                      value={x.url}
                      onChange={(e) => setSocial(i, "url", e.target.value)}
                      placeholder="https://instagram.com/..."
                    />

                    <button className={s.iconBtn} type="button" onClick={() => removeSocial(i)}>
                      🗑 Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ═══ TAB: KARGO & ÖDEME ═══ */}
      {tab === "shipping" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.shipping.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.shipping.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>📦</span>
                Kargo Ayarları
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.shipping?.enabled)}
                  onChange={(e) => setField("shipping.enabled", e.target.checked)}
                />
                <span />
              </label>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Ücretsiz Kargo Üstü (₺)</label>
                <input
                  className={s.input}
                  inputMode="numeric"
                  value={cfg.shipping?.freeOver ?? ""}
                  onChange={(e) => setField("shipping.freeOver", toNumberOrNull(e.target.value))}
                  placeholder="0"
                />
                <div className={s.inputHint}>
                  Bu tutarın üzerindeki siparişlerde kargo ücretsiz olur.
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label}>Sabit Kargo Ücreti (₺)</label>
                <input
                  className={s.input}
                  inputMode="numeric"
                  value={cfg.shipping?.flatFee ?? ""}
                  onChange={(e) => setField("shipping.flatFee", toNumberOrNull(e.target.value))}
                  placeholder="0"
                />
                <div className={s.inputHint}>
                  Ücretsiz kargo limitinin altındaki siparişlere uygulanır.
                </div>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Kargo Notu</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.shipping?.note?.tr || ""}
                    onChange={(e) => setLT("shipping.note", "tr", e.target.value)}
                    placeholder="Örn: Kargo 1-3 iş günü içinde teslim edilir."
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.shipping?.note?.en || ""}
                    onChange={(e) => setLT("shipping.note", "en", e.target.value)}
                    placeholder="E.g.: Delivery within 1-3 business days."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>💳</span>
                Ödeme Bilgilendirmesi
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.payment?.enabled)}
                  onChange={(e) => setField("payment.enabled", e.target.checked)}
                />
                <span />
              </label>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>🇹🇷 Türkçe</label>
                <input
                  className={s.input}
                  value={cfg.payment?.note?.tr || ""}
                  onChange={(e) => setLT("payment.note", "tr", e.target.value)}
                  placeholder="Checkout'ta görünecek ödeme notu"
                />
              </div>
              <div className={s.field}>
                <label className={s.label}>🇬🇧 English</label>
                <input
                  className={s.input}
                  value={cfg.payment?.note?.en || ""}
                  onChange={(e) => setLT("payment.note", "en", e.target.value)}
                  placeholder="Payment note displayed at checkout"
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ TAB: SEO ═══ */}
      {tab === "seo" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.seo.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.seo.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>🔍</span>
              Meta Bilgileri
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Title (Sayfa Başlığı)</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.seo?.title?.tr || ""}
                    onChange={(e) => setLT("seo.title", "tr", e.target.value)}
                    placeholder="Örn: Dromocob | Altın & tasarım ürünleri"
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.seo?.title?.en || ""}
                    onChange={(e) => setLT("seo.title", "en", e.target.value)}
                    placeholder="E.g.: Dromocob | Gold & lifestyle"
                  />
                </div>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Description (Açıklama)</div>
              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.label}>🇹🇷 Türkçe</label>
                  <input
                    className={s.input}
                    value={cfg.seo?.description?.tr || ""}
                    onChange={(e) => setLT("seo.description", "tr", e.target.value)}
                    placeholder="Arama sonuçlarında görünen kısa açıklama"
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>🇬🇧 English</label>
                  <input
                    className={s.input}
                    value={cfg.seo?.description?.en || ""}
                    onChange={(e) => setLT("seo.description", "en", e.target.value)}
                    placeholder="Short description for search results"
                  />
                </div>
              </div>
            </div>

            <hr className={s.separator} />

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>OG Image URL</label>
                <input
                  className={s.input}
                  value={cfg.seo?.ogImageUrl || ""}
                  onChange={(e) => setField("seo.ogImageUrl", e.target.value)}
                  placeholder="https://..."
                />
                <div className={s.inputHint}>
                  Sosyal medyada paylaşıldığında görünen görsel. Önerilen boyut: 1200×630px.
                </div>
              </div>

              <div className={s.uploadRow}>
                <div>
                  <div className={s.miniTitle}>OG Image</div>
                  <div className={s.miniHint}>Storage key: site-og</div>
                </div>
                <label className={s.btn}>
                  📁 OG seç
                  <input
                    className={s.file}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAndSet("seo.ogImageUrl", f, "site-og");
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {cfg.seo?.ogImageUrl ? (
              <div className={s.previewBox}>
                <div className={s.previewTitle}>OG Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={s.previewImgWide} src={cfg.seo.ogImageUrl} alt="og" />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ═══ TAB: OPERASYON ═══ */}
      {tab === "ops" ? (
        <section className={s.panelGrid}>
          <div className={s.sectionIntro}>
            <span className={s.sectionIntroIcon}>{tabIntros.ops.icon}</span>
            <div className={s.sectionIntroText}>{tabIntros.ops.text}</div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>
              <span className={s.cardTitleIcon}>🛒</span>
              Satış Operasyonu
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Checkout / Satış Durumu</div>
                <div className={s.settingDesc}>
                  Kapalıysa checkout&apos;taki &ldquo;Siparişi Oluştur&rdquo; butonu pasif olur. Müşteriler alışveriş yapamaz.
                </div>
              </div>
              <label className={s.switchRow}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.checkoutEnabled)}
                  onChange={(e) => setPublicField("checkoutEnabled", e.target.checked)}
                />
                <span className={pub.checkoutEnabled ? s.stateOn : s.stateOff}>
                  {pub.checkoutEnabled ? "Satış Açık" : "Satış Kapalı"}
                </span>
              </label>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Kur Sistemi</div>
                <div className={s.settingDesc}>
                  Canlı kur bazlı fiyat hesaplamasını genel olarak aç / kapat.
                  Kapalıyken tüm fiyatlar sabit TRY olarak gösterilir.
                </div>
              </div>
              <label className={s.switchRow}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.ratesEnabled)}
                  onChange={(e) => setPublicField("ratesEnabled", e.target.checked)}
                />
                <span className={pub.ratesEnabled ? s.stateOn : s.stateOff}>
                  {pub.ratesEnabled ? "Kur Açık" : "Kur Kapalı"}
                </span>
              </label>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Sepette Otomatik Kur Yenileme</div>
                <div className={s.settingDesc}>
                  Sayaç dolunca sepetteki fiyatlar güncel kura göre otomatik güncellenir.
                </div>
              </div>
              <label className={s.switchRow}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.cartRatesAutoRefresh)}
                  onChange={(e) => setPublicField("cartRatesAutoRefresh", e.target.checked)}
                />
                <span className={pub.cartRatesAutoRefresh ? s.stateOn : s.stateOff}>
                  {pub.cartRatesAutoRefresh ? "Auto Refresh Açık" : "Auto Refresh Kapalı"}
                </span>
              </label>
            </div>

            <hr className={s.separator} />

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Sepet Yenileme Süresi (dakika)</label>
                <input
                  className={s.input}
                  type="number"
                  min={1}
                  max={60}
                  value={pub.cartRefreshMinutes ?? 4}
                  onChange={(e) =>
                    setPublicField(
                      "cartRefreshMinutes",
                      Math.max(1, Math.min(60, Number(e.target.value || 4)))
                    )
                  }
                />
                <div className={s.inputHint}>
                  1-60 dakika arası. Varsayılan: 4 dakika.
                </div>
              </div>
            </div>

            <div className={s.hint}>
              Bu alanlar <b className={s.mono}>settings/public</b> altında tutulur ve tüm kullanıcılar tarafından okunabilir.
            </div>
          </div>

          {/* ── Sepet Kuralları ── */}
          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitle}>
                <span className={s.cardTitleIcon}>⏰</span>
                Sepet Kuralları (24 Saat)
              </div>
              <label className={s.switch}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.cartExpiry?.enabled)}
                  onChange={(e) =>
                    setPublicField("cartExpiry", {
                      ...(pub.cartExpiry || {}),
                      enabled: e.target.checked,
                    })
                  }
                />
                <span />
              </label>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Sepet Süre Limiti</div>
                <div className={s.settingDesc}>
                  Aktifken, sepetteki ürünler belirlenen süre sonunda otomatik kaldırılır.
                  Altın kuru değiştiği için eski sepet fiyatı korunmamalıdır.
                </div>
              </div>
              <span className={pub.cartExpiry?.enabled ? s.stateOn : s.stateOff}>
                {pub.cartExpiry?.enabled ? "Aktif" : "Pasif"}
              </span>
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.label}>Süre (Saat)</label>
                <input
                  className={s.input}
                  type="number"
                  min={1}
                  max={168}
                  value={pub.cartExpiry?.hours ?? 24}
                  onChange={(e) =>
                    setPublicField("cartExpiry", {
                      ...(pub.cartExpiry || {}),
                      hours: Math.max(1, Math.min(168, Number(e.target.value || 24))),
                    })
                  }
                />
                <div className={s.inputHint}>
                  1-168 saat arası (1 saat – 1 hafta). Varsayılan: 24 saat.
                </div>
              </div>
            </div>

            <div className={s.settingCard}>
              <div>
                <div className={s.settingTitle}>Favorilere Taşı</div>
                <div className={s.settingDesc}>
                  Süresi dolan ürünler silinmek yerine otomatik olarak favorilere taşınsın mı?
                </div>
              </div>
              <label className={s.switchRow}>
                <input
                  type="checkbox"
                  checked={Boolean(pub.cartExpiry?.moveToFavorites)}
                  onChange={(e) =>
                    setPublicField("cartExpiry", {
                      ...(pub.cartExpiry || {}),
                      moveToFavorites: e.target.checked,
                    })
                  }
                />
                <span className={pub.cartExpiry?.moveToFavorites ? s.stateOn : s.stateOff}>
                  {pub.cartExpiry?.moveToFavorites ? "Favorilere Taşı" : "Sadece Sil"}
                </span>
              </label>
            </div>

            <div className={s.field} style={{ marginTop: 8 }}>
              <label className={s.label}>Bilgilendirme Mesajı (Sepette Gösterilir)</label>
              <textarea
                className={s.textarea}
                rows={2}
                placeholder="Örn: Sepetteki ürünler 24 saat sonra kaldırılır. Altın fiyatları sürekli değiştiği için sepet süresi sınırlıdır."
                value={pub.cartExpiry?.message || ""}
                onChange={(e) =>
                  setPublicField("cartExpiry", {
                    ...(pub.cartExpiry || {}),
                    message: e.target.value,
                  })
                }
              />
              <div className={s.inputHint}>
                Boş bırakırsanız varsayılan mesaj gösterilir.
              </div>
            </div>

            <div className={s.hint}>
              Sepet süre limiti <b className={s.mono}>settings/public → cartExpiry</b> altında tutulur.
              Cart sayfası ve checkout bu değerleri okur.
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function SiteSettingsAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <SiteSettingsAdminPageInner />
      </PermissionGate>
    </AdminGate>
  );
}