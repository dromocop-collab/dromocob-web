"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./AdminTrackingPage.module.css";

/* ── Types ── */

type TrackingConfig = {
  meta: {
    pixelId: string;
    enabled: boolean;
    domainVerification: string;
    conversionsApiToken: string;
    capiGatewayUrl: string;
    capiApiKey: string;
    capiEnabled: boolean;
  };
  googleAds: {
    conversionId: string;
    conversionLabel: string;
    remarketingId: string;
    enabled: boolean;
  };
};

/* ── Helpers ── */

function str(v: unknown) {
  return String(v ?? "").trim();
}

function bool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

const DEFAULTS: TrackingConfig = {
  meta: {
    pixelId: "",
    enabled: true,
    domainVerification: "",
    conversionsApiToken: "",
    capiGatewayUrl: "",
    capiApiKey: "",
    capiEnabled: false,
  },
  googleAds: {
    conversionId: "",
    conversionLabel: "",
    remarketingId: "",
    enabled: false,
  },
};

function normalize(raw?: any): TrackingConfig {
  const x = raw || {};
  return {
    meta: {
      pixelId: str(x.meta?.pixelId),
      enabled: bool(x.meta?.enabled, true),
      domainVerification: str(x.meta?.domainVerification),
      conversionsApiToken: str(x.meta?.conversionsApiToken),
      capiGatewayUrl: str(x.meta?.capiGatewayUrl),
      capiApiKey: str(x.meta?.capiApiKey),
      capiEnabled: bool(x.meta?.capiEnabled, false),
    },
    googleAds: {
      conversionId: str(x.googleAds?.conversionId),
      conversionLabel: str(x.googleAds?.conversionLabel),
      remarketingId: str(x.googleAds?.remarketingId),
      enabled: bool(x.googleAds?.enabled, false),
    },
  };
}

/* ── Sub-components ── */

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  help?: string;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      <input
        className={`${s.input} ${mono ? s.inputMono : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {help ? <div className={s.helpText}>{help}</div> : null}
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
    <label className={s.toggleCard}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <div className={s.toggleTitle}>{title}</div>
        <div className={s.toggleDesc}>{desc}</div>
      </div>
    </label>
  );
}

/* ── Meta Events Bilgi Kartı ── */

const META_EVENTS = [
  { name: "PageView", where: "Tüm sayfalar (otomatik)" },
  { name: "ViewContent", where: "Ürün detay sayfası" },
  { name: "AddToCart", where: "Sepete ekle butonu" },
  { name: "InitiateCheckout", where: "Ödeme sayfası" },
  { name: "Purchase", where: "Sipariş tamamlandığında" },
];

const GOOGLE_ADS_EVENTS = [
  { name: "conversion", where: "Sipariş tamamlandığında" },
  { name: "page_view", where: "Tüm sayfalar (otomatik)" },
];

/* ── Main ── */

function AdminTrackingPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "tracking"), [db]);

  const [cfg, setCfg] = useState<TrackingConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setCfg(normalize(data));
      },
      (e) => {
        console.error("tracking config load error:", e);
        setCfg(DEFAULTS);
      }
    );
  }, [ref]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      await setDoc(
        ref,
        {
          meta: cfg.meta,
          googleAds: cfg.googleAds,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMsg("Kaydedildi ✅");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Kaydetme hatası");
    } finally {
      setSaving(false);
    }
  }

  const metaStatus = cfg.meta.enabled && cfg.meta.pixelId;
  const gadsStatus = cfg.googleAds.enabled && cfg.googleAds.conversionId;

  return (
    <main className={s.page}>
      {/* ── Hero ── */}
      <section className={s.hero}>
        <div>
          <div className={s.kicker}>Admin • Pazarlama</div>
          <h1 className={s.title}>Reklam & Takip Kodları</h1>
          <p className={s.sub}>
            Meta (Facebook) Pixel ve Google Ads entegrasyonlarını tek merkezden yönet.
            Kodları gir, aktif et — gerisini sistem halleder.
          </p>
        </div>

        <div className={s.heroActions}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={s.btnPrimary}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </section>

      {err ? <div className={`${s.alert} ${s.alertErr}`}>{err}</div> : null}
      {msg ? <div className={`${s.alert} ${s.alertOk}`}>{msg}</div> : null}

      {/* ── Layout ── */}
      <div className={s.layout}>
        {/* ── META PIXEL CARD ── */}
        <div>
          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitleRow}>
                <div className={`${s.cardIcon} ${s.cardIconMeta}`}>📘</div>
                <div>
                  <div className={s.cardTitle}>Meta (Facebook) Pixel</div>
                  <div className={s.cardSub}>Conversion tracking & remarketing</div>
                </div>
              </div>
              <div className={`${s.statusPill} ${metaStatus ? s.statusOn : s.statusOff}`}>
                <span className={s.statusDot} />
                {metaStatus ? "Aktif" : "Pasif"}
              </div>
            </div>

            <ToggleCard
              title="Meta Pixel aktif"
              desc="Pixel ID girildiğinde otomatik olarak tüm sayfalara eklenir."
              checked={cfg.meta.enabled}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, enabled: v } })
              }
            />

            <Field
              label="Pixel ID"
              value={cfg.meta.pixelId}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, pixelId: v } })
              }
              placeholder="1316354849966192"
              mono
              help="Facebook Business Manager → Events Manager → Pixel ID"
            />

            <Field
              label="Domain Verification"
              value={cfg.meta.domainVerification}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, domainVerification: v } })
              }
              placeholder="ef3uxvbjae85z47h456x0v5dlwvxsr"
              mono
              help="Facebook Business → Brand Safety → Domain verification meta tag değeri"
            />

            <Field
              label="Conversions API Token"
              value={cfg.meta.conversionsApiToken}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, conversionsApiToken: v } })
              }
              placeholder="EAAxxxxxx..."
              mono
              help="Meta Events Manager → Settings → Conversions API → Access Token"
            />

            <hr className={s.sep} />

            <div className={s.infoCard}>
              <div className={s.infoTitle}>🔗 Stape CAPIG (Conversions API Gateway)</div>
              <div className={s.helpText} style={{ marginBottom: 12 }}>
                Server-side event tracking için Stape CAPIG entegrasyonu.
                CAPIG, piksel event'lerini hem client hem server tarafından göndererek
                Meta'nın Conversions API kapsamını artırır.
              </div>
            </div>

            <ToggleCard
              title="CAPI Gateway aktif"
              desc="CAPIG URL ve API Key girildiğinde server-side event'ler otomatik gönderilir."
              checked={cfg.meta.capiEnabled}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, capiEnabled: v } })
              }
            />

            <Field
              label="CAPIG Gateway URL"
              value={cfg.meta.capiGatewayUrl}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, capiGatewayUrl: v } })
              }
              placeholder="https://capig.stape.de"
              mono
              help="Stape → CAPIG Settings → URL alanı"
            />

            <Field
              label="CAPIG API Key"
              value={cfg.meta.capiApiKey}
              onChange={(v) =>
                setCfg({ ...cfg, meta: { ...cfg.meta, capiApiKey: v } })
              }
              placeholder="capig_xxxxx..."
              mono
              help="Stape → CAPIG Settings → Show CAPIG API key"
            />

            <hr className={s.sep} />

            {/* Event Listesi */}
            <div className={s.infoCard}>
              <div className={s.infoTitle}>📊 Otomatik Tetiklenen Event'ler</div>
              <div className={s.eventList}>
                {META_EVENTS.map((ev) => (
                  <div key={ev.name} className={s.eventRow}>
                    <span className={s.eventName}>{ev.name}</span>
                    <span className={s.eventWhere}>{ev.where}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── GOOGLE ADS CARD ── */}
        <div>
          <div className={s.card}>
            <div className={s.cardHead}>
              <div className={s.cardTitleRow}>
                <div className={`${s.cardIcon} ${s.cardIconGoogle}`}>📢</div>
                <div>
                  <div className={s.cardTitle}>Google Ads</div>
                  <div className={s.cardSub}>Conversion & remarketing tracking</div>
                </div>
              </div>
              <div className={`${s.statusPill} ${gadsStatus ? s.statusOn : s.statusOff}`}>
                <span className={s.statusDot} />
                {gadsStatus ? "Aktif" : "Pasif"}
              </div>
            </div>

            <ToggleCard
              title="Google Ads tracking aktif"
              desc="Conversion ID girildiğinde gtag.js otomatik yüklenir."
              checked={cfg.googleAds.enabled}
              onChange={(v) =>
                setCfg({ ...cfg, googleAds: { ...cfg.googleAds, enabled: v } })
              }
            />

            <Field
              label="Conversion ID"
              value={cfg.googleAds.conversionId}
              onChange={(v) =>
                setCfg({ ...cfg, googleAds: { ...cfg.googleAds, conversionId: v } })
              }
              placeholder="AW-XXXXXXXXX"
              mono
              help="Google Ads → Araçlar → Dönüşümler → Etiket ayarları → Conversion ID"
            />

            <Field
              label="Conversion Label"
              value={cfg.googleAds.conversionLabel}
              onChange={(v) =>
                setCfg({ ...cfg, googleAds: { ...cfg.googleAds, conversionLabel: v } })
              }
              placeholder="AbCdEfGhIjK"
              mono
              help="Satın alma dönüşümü için conversion label. Her event için ayrı olabilir."
            />

            <Field
              label="Remarketing ID (opsiyonel)"
              value={cfg.googleAds.remarketingId}
              onChange={(v) =>
                setCfg({ ...cfg, googleAds: { ...cfg.googleAds, remarketingId: v } })
              }
              placeholder="AW-XXXXXXXXX veya DC-XXXXXXXXX"
              mono
              help="Remarketing tag'i için ayrı bir ID kullanıyorsanız buraya girin."
            />

            <hr className={s.sep} />

            {/* Event Listesi */}
            <div className={s.infoCard}>
              <div className={s.infoTitle}>📊 Tetiklenecek Event'ler</div>
              <div className={s.eventList}>
                {GOOGLE_ADS_EVENTS.map((ev) => (
                  <div key={ev.name} className={s.eventRow}>
                    <span className={s.eventName}>{ev.name}</span>
                    <span className={s.eventWhere}>{ev.where}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kurulum Rehberi */}
            <div className={s.guideBox}>
              <div className={s.guideTitle}>🛠 Kurulum Rehberi</div>
              <ol className={s.guideList}>
                <li>Google Ads hesabınıza girin</li>
                <li>Araçlar → Dönüşümler → Yeni dönüşüm</li>
                <li>Web sitesi → Satın alma seçin</li>
                <li>Etiket ayarlarından <b>Conversion ID</b> ve <b>Label</b>'ı kopyalayın</li>
                <li>Yukarıdaki alanlara yapıştırıp kaydedin</li>
                <li>Sistem otomatik olarak gtag.js yükleyip dönüşüm takibini başlatır</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AdminTrackingPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <AdminTrackingPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
