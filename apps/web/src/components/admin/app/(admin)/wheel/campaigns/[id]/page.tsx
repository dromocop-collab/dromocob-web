"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./wheel-campaign-detail.module.css";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "archived";

type CampaignForm = {
  title: string;
  slug: string;
  description: string;
  heroTitle: string;
  heroText: string;
  buttonLabel: string;
  status: CampaignStatus;
  popupEnabled: boolean;
  isActive: boolean;
  requireConsent: boolean;
  requirePhone: boolean;
  requireEmail: boolean;
  maxSpinsPerUser: number;
  cooldownHours: number;

  startsAt: string;
  endsAt: string;

  uiHeadline: string;
  uiSubheadline: string;
  uiBgImage: string;

  ruleMinOrderTry: string;
  ruleCouponExpireDays: number;
  ruleRequireLogin: boolean;
  ruleOneSpinPerUser: boolean;
  ruleOneSpinPerEmail: boolean;
  ruleOneSpinPerPhone: boolean;
  ruleOneSpinPerDevice: boolean;

  themePrimary: string;
  themeSecondary: string;
  themeTertiary: string;
  themeNeutral: string;
};

const DEFAULT_FORM: CampaignForm = {
  title: "",
  slug: "",
  description: "",
  heroTitle: "",
  heroText: "",
  buttonLabel: "Çevir ve Kazan",
  status: "draft",
  popupEnabled: true,
  isActive: false,
  requireConsent: true,
  requirePhone: true,
  requireEmail: true,
  maxSpinsPerUser: 1,
  cooldownHours: 720,

  startsAt: "",
  endsAt: "",

  uiHeadline: "Anneler Günü Özel Çarkı!",
  uiSubheadline: "Kuponunu hemen kullan",
  uiBgImage: "",

  ruleMinOrderTry: "0",
  ruleCouponExpireDays: 7,
  ruleRequireLogin: false,
  ruleOneSpinPerUser: true,
  ruleOneSpinPerEmail: true,
  ruleOneSpinPerPhone: true,
  ruleOneSpinPerDevice: true,

  themePrimary: "#182a8f",
  themeSecondary: "#ead447",
  themeTertiary: "#b7d7c8",
  themeNeutral: "#f4efef",
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeBool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function safeNum(v: unknown, fallback: number, min = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function normalizeStatus(v: unknown): CampaignStatus {
  const x = safeStr(v);
  if (
    x === "draft" ||
    x === "scheduled" ||
    x === "active" ||
    x === "paused" ||
    x === "archived"
  ) {
    return x;
  }
  return "draft";
}

function slugify(v: string) {
  return String(v || "")
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDateTimeLocal(v: any): string {
  try {
    if (!v) return "";
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : v instanceof Date
        ? v
        : new Date(v);

    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}

function fromDateTimeLocal(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function normalizeDoc(x: any): CampaignForm {
  return {
    title: safeStr(x?.title),
    slug: safeStr(x?.slug),
    description: safeStr(x?.description),
    heroTitle: safeStr(x?.heroTitle),
    heroText: safeStr(x?.heroText),
    buttonLabel: safeStr(x?.buttonLabel || x?.ui?.buttonLabel) || "Çevir ve Kazan",
    status: normalizeStatus(x?.status),
    popupEnabled: x?.popupEnabled !== false,
    isActive: x?.isActive === true,
    requireConsent: x?.requireConsent !== false,
    requirePhone: x?.requirePhone !== false,
    requireEmail: x?.requireEmail !== false,
    maxSpinsPerUser: safeNum(x?.maxSpinsPerUser, 1, 1),
    cooldownHours: safeNum(x?.cooldownHours, 720, 0),

    startsAt: toDateTimeLocal(x?.startsAt),
    endsAt: toDateTimeLocal(x?.endsAt),

    uiHeadline: safeStr(x?.ui?.headline) || DEFAULT_FORM.uiHeadline,
    uiSubheadline: safeStr(x?.ui?.subheadline) || DEFAULT_FORM.uiSubheadline,
    uiBgImage: safeStr(x?.ui?.bgImage),

    ruleMinOrderTry: safeStr(x?.rules?.minOrderTry) || "0",
    ruleCouponExpireDays: safeNum(x?.rules?.couponExpireDays, 7, 1),
    ruleRequireLogin: safeBool(x?.rules?.requireLogin, false),
    ruleOneSpinPerUser: safeBool(x?.rules?.oneSpinPerUser, true),
    ruleOneSpinPerEmail: safeBool(x?.rules?.oneSpinPerEmail, true),
    ruleOneSpinPerPhone: safeBool(x?.rules?.oneSpinPerPhone, true),
    ruleOneSpinPerDevice: safeBool(x?.rules?.oneSpinPerDevice, true),

    themePrimary: safeStr(x?.wheelTheme?.primary) || DEFAULT_FORM.themePrimary,
    themeSecondary: safeStr(x?.wheelTheme?.secondary) || DEFAULT_FORM.themeSecondary,
    themeTertiary: safeStr(x?.wheelTheme?.tertiary) || DEFAULT_FORM.themeTertiary,
    themeNeutral: safeStr(x?.wheelTheme?.neutral) || DEFAULT_FORM.themeNeutral,
  };
}

function WheelCampaignDetailPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const params = useParams();
  const id = safeStr(params?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<CampaignForm>(DEFAULT_FORM);

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setNote("");

        const snap = await getDoc(doc(db, "wheel_campaigns", id));
        if (!mounted) return;

        if (!snap.exists()) {
          setExists(false);
          setLoading(false);
          return;
        }

        const next = normalizeDoc(snap.data());
        setForm(next);
        setInitialForm(next);
        setExists(true);
      } catch (err) {
        console.error("wheel campaign detail load error:", err);
        if (!mounted) return;
        setExists(false);
        setError("Kampanya verisi yüklenemedi.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [db, id]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  const statItems = useMemo(
    () => [
      { label: "Durum", value: form.status },
      { label: "Popup", value: form.popupEnabled ? "Açık" : "Kapalı" },
      { label: "Yayın", value: form.isActive ? "Aktif" : "Pasif" },
      { label: "Max Spin", value: String(form.maxSpinsPerUser) },
    ],
    [form]
  );

  function updateField<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAutoSlug() {
    updateField("slug", slugify(form.title));
  }

  function handleReset() {
    setForm(initialForm);
    setError("");
    setNote("");
  }

  function validate() {
    if (!form.title.trim()) return "Kampanya başlığı zorunlu.";
    if (!form.slug.trim()) return "Slug zorunlu.";
    if (!form.heroTitle.trim()) return "Popup başlığı zorunlu.";
    if (!form.buttonLabel.trim()) return "Buton metni zorunlu.";
    if (form.maxSpinsPerUser < 1) return "Kişi başı max spin en az 1 olmalı.";
    if (form.cooldownHours < 0) return "Cooldown eksi olamaz.";
    if (form.ruleCouponExpireDays < 1) return "Kupon geçerlilik günü en az 1 olmalı.";
    return "";
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setNote("");
      return;
    }

    setSaving(true);
    setError("");
    setNote("");

    try {
     await updateDoc(doc(db, "wheel_campaigns", id), {
  title: form.title.trim(),
  slug: form.slug.trim(),
  description: form.description.trim(),
  heroTitle: form.heroTitle.trim(),
  heroText: form.heroText.trim(),
  buttonLabel: form.buttonLabel.trim(),

  status: form.status,
  popupEnabled: form.popupEnabled,
  isActive: form.isActive,
  published: form.popupEnabled && form.isActive && form.status === "active",

  requireConsent: form.requireConsent,
  requirePhone: form.requirePhone,
  requireEmail: form.requireEmail,
  maxSpinsPerUser: Math.max(1, Number(form.maxSpinsPerUser || 1)),
  cooldownHours: Math.max(0, Number(form.cooldownHours || 0)),

  startsAt: fromDateTimeLocal(form.startsAt),
  endsAt: fromDateTimeLocal(form.endsAt),

  ui: {
    headline: form.uiHeadline.trim(),
    subheadline: form.uiSubheadline.trim(),
    bgImage: form.uiBgImage.trim(),
    buttonLabel: form.buttonLabel.trim(),
  },

  rules: {
    minOrderTry: form.ruleMinOrderTry.trim(),
    couponExpireDays: Math.max(1, Number(form.ruleCouponExpireDays || 7)),
    oneSpinPerUser: form.ruleOneSpinPerUser,
    oneSpinPerEmail: form.ruleOneSpinPerEmail,
    oneSpinPerPhone: form.ruleOneSpinPerPhone,
    oneSpinPerDevice: form.ruleOneSpinPerDevice,
    requireConsent: form.requireConsent,
    requireLogin: form.ruleRequireLogin,
  },

  wheelTheme: {
    primary: form.themePrimary.trim(),
    secondary: form.themeSecondary.trim(),
    tertiary: form.themeTertiary.trim(),
    neutral: form.themeNeutral.trim(),
  },

  updatedAt: serverTimestamp(),
});

      setInitialForm(form);
      setNote("Kampanya başarıyla güncellendi.");
    } catch (err) {
      console.error("wheel campaign detail save error:", err);
      setError("Kaydetme sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Wheel • Campaign Detail</div>
          <h1 className={styles.h1}>Kampanya Düzenle</h1>
          <p className={styles.sub}>
            Popup metni, tarih aralığı, kurallar, tema ve spin limitlerini buradan yönet.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel/campaigns" className={styles.ghostBtn}>
            ← Kampanyalara Dön
          </Link>

          <button
            type="button"
            className={styles.ghostBtn}
            onClick={handleReset}
            disabled={loading || saving || !dirty || !exists}
          >
            Geri Al
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={loading || saving || !exists}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </section>

      {error ? <div className={styles.noteBar}>{error}</div> : null}
      {note ? <div className={styles.noteBar}>{note}</div> : null}

      {loading ? (
        <section className={styles.card}>
          <div className={styles.empty}>Yükleniyor...</div>
        </section>
      ) : !exists ? (
        <section className={styles.card}>
          <div className={styles.empty}>Kampanya bulunamadı.</div>
        </section>
      ) : (
        <>
          <section className={styles.statsGrid}>
            {statItems.map((item) => (
              <div key={item.label} className={styles.statCard}>
                <span className={styles.statLabel}>{item.label}</span>
                <strong className={styles.statValue}>{item.value}</strong>
              </div>
            ))}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Temel Bilgiler</h2>
                <p className={styles.cardDesc}>
                  Kampanyanın storefront ve popup içinde görünen ana metinleri.
                </p>
              </div>

              <span className={`${styles.badge} ${form.isActive ? styles.badgeOk : styles.badgeMuted}`}>
                {form.isActive ? "Yayında" : "Taslak / Pasif"}
              </span>
            </div>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>Başlık</span>
                <input
                  className={styles.input}
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Anneler Günü 2026 Çarkı"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Slug</span>
                <div className={styles.slugRow}>
                  <input
                    className={styles.input}
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="anneler-gunu-2026-carki"
                  />
                  <button type="button" className={styles.softBtn} onClick={handleAutoSlug}>
                    Otomatik Üret
                  </button>
                </div>
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Kısa Açıklama</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Kampanyanın kısa açıklaması..."
              />
            </label>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>Popup Başlık</span>
                <input
                  className={styles.input}
                  value={form.heroTitle}
                  onChange={(e) => updateField("heroTitle", e.target.value)}
                  placeholder="Şansını Çevir, İndirimini Kap"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Buton Metni</span>
                <input
                  className={styles.input}
                  value={form.buttonLabel}
                  onChange={(e) => updateField("buttonLabel", e.target.value)}
                  placeholder="Çevir ve Kazan"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Popup Alt Metni</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={form.heroText}
                onChange={(e) => updateField("heroText", e.target.value)}
                placeholder="Formu doldur, çarkı çevir, anında kuponunu kazan."
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Tarih ve UI</h2>
                <p className={styles.cardDesc}>
                  Kampanyanın aktif olacağı tarih aralığı ve popup üst metinleri.
                </p>
              </div>
            </div>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>Başlangıç Tarihi</span>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => updateField("startsAt", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Bitiş Tarihi</span>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => updateField("endsAt", e.target.value)}
                />
              </label>
            </div>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>UI Headline</span>
                <input
                  className={styles.input}
                  value={form.uiHeadline}
                  onChange={(e) => updateField("uiHeadline", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>UI Subheadline</span>
                <input
                  className={styles.input}
                  value={form.uiSubheadline}
                  onChange={(e) => updateField("uiSubheadline", e.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Arka Plan Görseli</span>
              <input
                className={styles.input}
                value={form.uiBgImage}
                onChange={(e) => updateField("uiBgImage", e.target.value)}
                placeholder="https://..."
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Kurallar ve Limitler</h2>
                <p className={styles.cardDesc}>
                  Çarkın kaç kez döneceği, cooldown, minimum sipariş ve giriş kuralları.
                </p>
              </div>
            </div>

            <div className={styles.formGrid3}>
              <label className={styles.field}>
                <span className={styles.label}>Durum</span>
                <select
                  className={styles.select}
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value as CampaignStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Kişi Başı Max Spin</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.maxSpinsPerUser}
                  onChange={(e) =>
                    updateField("maxSpinsPerUser", Math.max(1, Number(e.target.value || 1)))
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Cooldown (Saat)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={form.cooldownHours}
                  onChange={(e) =>
                    updateField("cooldownHours", Math.max(0, Number(e.target.value || 0)))
                  }
                />
              </label>
            </div>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>Min Sipariş Tutarı (TRY)</span>
                <input
                  className={styles.input}
                  value={form.ruleMinOrderTry}
                  onChange={(e) => updateField("ruleMinOrderTry", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Kupon Geçerlilik Günü</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.ruleCouponExpireDays}
                  onChange={(e) =>
                    updateField("ruleCouponExpireDays", Math.max(1, Number(e.target.value || 1)))
                  }
                />
              </label>
            </div>

            <div className={styles.checkGrid}>
              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.popupEnabled}
                  onChange={(e) => updateField("popupEnabled", e.target.checked)}
                />
                <span>Popup aktif</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                />
                <span>Kampanya yayında</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.requireConsent}
                  onChange={(e) => updateField("requireConsent", e.target.checked)}
                />
                <span>Açık rıza zorunlu</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.requirePhone}
                  onChange={(e) => updateField("requirePhone", e.target.checked)}
                />
                <span>Telefon zorunlu</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.requireEmail}
                  onChange={(e) => updateField("requireEmail", e.target.checked)}
                />
                <span>E-posta zorunlu</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.ruleRequireLogin}
                  onChange={(e) => updateField("ruleRequireLogin", e.target.checked)}
                />
                <span>Login zorunlu</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.ruleOneSpinPerUser}
                  onChange={(e) => updateField("ruleOneSpinPerUser", e.target.checked)}
                />
                <span>1 spin / user</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.ruleOneSpinPerEmail}
                  onChange={(e) => updateField("ruleOneSpinPerEmail", e.target.checked)}
                />
                <span>1 spin / email</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.ruleOneSpinPerPhone}
                  onChange={(e) => updateField("ruleOneSpinPerPhone", e.target.checked)}
                />
                <span>1 spin / phone</span>
              </label>

              <label className={styles.checkCard}>
                <input
                  type="checkbox"
                  checked={form.ruleOneSpinPerDevice}
                  onChange={(e) => updateField("ruleOneSpinPerDevice", e.target.checked)}
                />
                <span>1 spin / device</span>
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Wheel Theme</h2>
                <p className={styles.cardDesc}>
                  Çark renklerini burada yönet. Frontend bu renklerle premium görünür.
                </p>
              </div>
            </div>

            <div className={styles.formGrid2}>
              <label className={styles.field}>
                <span className={styles.label}>Primary</span>
                <input
                  className={styles.input}
                  value={form.themePrimary}
                  onChange={(e) => updateField("themePrimary", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Secondary</span>
                <input
                  className={styles.input}
                  value={form.themeSecondary}
                  onChange={(e) => updateField("themeSecondary", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Tertiary</span>
                <input
                  className={styles.input}
                  value={form.themeTertiary}
                  onChange={(e) => updateField("themeTertiary", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Neutral</span>
                <input
                  className={styles.input}
                  value={form.themeNeutral}
                  onChange={(e) => updateField("themeNeutral", e.target.value)}
                />
              </label>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default function WheelCampaignDetailPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <WheelCampaignDetailPageInner />
      </PermissionGate>
    </AdminGate>
  );
}