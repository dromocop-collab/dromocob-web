"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/admin/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "../adminDashboard.module.css";

type LocaleText = { tr: string; en: string };
type FooterLink = { label: LocaleText; url: string };
type FooterColumn = { title: LocaleText; links: FooterLink[] };
type SocialItem = { type: string; url: string };
type CtaSettings = { title?: LocaleText; description?: LocaleText; primaryLabel?: LocaleText; primaryUrl?: string; secondaryLabel?: LocaleText; secondaryUrl?: string };
type ContactSettings = { phone?: string; email?: string; address?: string; whatsapp?: string };
type EtbisSettings = { url?: string; badge?: LocaleText; note?: LocaleText; linkLabel?: LocaleText };
type TrustSettings = { payment?: string[]; security?: string[]; shipping?: string[] };

type FooterSettings = {
  theme?: { variant?: string };
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
  bottom?: { left?: LocaleText; right?: LocaleText };
};

const SOCIAL_TYPES = [
  { type: "instagram", label: "Instagram", icon: "📷" },
  { type: "whatsapp", label: "WhatsApp", icon: "💬" },
  { type: "youtube", label: "YouTube", icon: "🎬" },
  { type: "tiktok", label: "TikTok", icon: "🎵" },
  { type: "x", label: "X (Twitter)", icon: "✕" },
  { type: "facebook", label: "Facebook", icon: "📘" },
  { type: "telegram", label: "Telegram", icon: "✈️" },
];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function emptyLocale(): LocaleText {
  return { tr: "", en: "" };
}

function emptyLink(): FooterLink {
  return { label: emptyLocale(), url: "" };
}

function emptyColumn(): FooterColumn {
  return { title: emptyLocale(), links: [emptyLink()] };
}

function emptySocial(): SocialItem {
  return { type: "instagram", url: "" };
}

// ─── Shared inline styles ───
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "0 14px",
  border: "1px solid rgba(15,23,42,.10)",
  borderRadius: 14,
  background: "#f8fbff",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const miniBtn: React.CSSProperties = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  transition: "background .18s ease",
};

const dangerBtn: React.CSSProperties = {
  ...miniBtn,
  background: "rgba(239,68,68,.06)",
  color: "#b91c1c",
  border: "1px solid rgba(239,68,68,.14)",
};

const saveBtn: React.CSSProperties = {
  minHeight: 48,
  padding: "0 28px",
  borderRadius: 16,
  border: 0,
  background: "linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(29,78,216,.24)",
  transition: "transform .18s ease,box-shadow .18s ease",
};

function AdminFooterPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [_cfg, setCfg] = useState<FooterSettings | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<string>("brand");

  // Live form state
  const [brandTitle, setBrandTitle] = useState<LocaleText>({ tr: "", en: "" });
  const [brandTagline, setBrandTagline] = useState<LocaleText>({ tr: "", en: "" });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoLink, setLogoLink] = useState("/");
  const [columns, setColumns] = useState<FooterColumn[]>([]);
  const [socials, setSocials] = useState<SocialItem[]>([]);
  const [bottomLeft, setBottomLeft] = useState<LocaleText>({ tr: "", en: "" });
  const [bottomRight, setBottomRight] = useState<LocaleText>({ tr: "", en: "" });

  // New state
  const [ctaTitle, setCtaTitle] = useState<LocaleText>({ tr: "", en: "" });
  const [ctaDesc, setCtaDesc] = useState<LocaleText>({ tr: "", en: "" });
  const [ctaPrimaryLabel, setCtaPrimaryLabel] = useState<LocaleText>({ tr: "", en: "" });
  const [ctaPrimaryUrl, setCtaPrimaryUrl] = useState("");
  const [ctaSecondaryLabel, setCtaSecondaryLabel] = useState<LocaleText>({ tr: "", en: "" });
  const [ctaSecondaryUrl, setCtaSecondaryUrl] = useState("");

  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");

  const [chips, setChips] = useState<LocaleText[]>([]);

  const [etbisUrl, setEtbisUrl] = useState("");
  const [etbisBadge, setEtbisBadge] = useState<LocaleText>({ tr: "", en: "" });
  const [etbisNote, setEtbisNote] = useState<LocaleText>({ tr: "", en: "" });
  const [etbisLinkLabel, setEtbisLinkLabel] = useState<LocaleText>({ tr: "", en: "" });

  const [trustPayment, setTrustPayment] = useState("");
  const [trustSecurity, setTrustSecurity] = useState("");
  const [trustShipping, setTrustShipping] = useState("");

  // Load from Firestore
  useEffect(() => {
    const ref = doc(db, "settings", "site");

    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || {};
        const footer = (data.footer || {}) as FooterSettings;
        setCfg(footer);

        setBrandTitle({
          tr: safeStr(footer.brand?.title?.tr) || "Dromocob",
          en: safeStr(footer.brand?.title?.en) || "Dromocob",
        });
        setBrandTagline({
          tr: safeStr(footer.brand?.tagline?.tr) || "Sertifikalı ürün • Güvenli ödeme • Hızlı kargo",
          en: safeStr(footer.brand?.tagline?.en) || "Certified products • Secure payment • Fast shipping",
        });
        setLogoUrl(safeStr(footer.brand?.logoUrl));
        setLogoLink(safeStr(footer.brand?.logoLink) || "/");

        if (Array.isArray(footer.columns) && footer.columns.length) {
          setColumns(
            footer.columns.map((col) => ({
              title: { tr: safeStr(col.title?.tr), en: safeStr(col.title?.en) },
              links: Array.isArray(col.links)
                ? col.links.map((lnk) => ({
                  label: { tr: safeStr(lnk.label?.tr), en: safeStr(lnk.label?.en) },
                  url: safeStr(lnk.url),
                }))
                : [emptyLink()],
            }))
          );
        } else {
          setColumns([]);
        }

        if (Array.isArray(footer.social) && footer.social.length) {
          setSocials(
            footer.social.map((x) => ({
              type: safeStr(x.type) || "instagram",
              url: safeStr(x.url),
            }))
          );
        } else {
          setSocials([]);
        }

        setBottomLeft({
          tr: safeStr(footer.bottom?.left?.tr),
          en: safeStr(footer.bottom?.left?.en),
        });
        setBottomRight({
          tr: safeStr(footer.bottom?.right?.tr),
          en: safeStr(footer.bottom?.right?.en),
        });

        // CTA
        setCtaTitle({ tr: safeStr(footer.cta?.title?.tr), en: safeStr(footer.cta?.title?.en) });
        setCtaDesc({ tr: safeStr(footer.cta?.description?.tr), en: safeStr(footer.cta?.description?.en) });
        setCtaPrimaryLabel({ tr: safeStr(footer.cta?.primaryLabel?.tr), en: safeStr(footer.cta?.primaryLabel?.en) });
        setCtaPrimaryUrl(safeStr(footer.cta?.primaryUrl));
        setCtaSecondaryLabel({ tr: safeStr(footer.cta?.secondaryLabel?.tr), en: safeStr(footer.cta?.secondaryLabel?.en) });
        setCtaSecondaryUrl(safeStr(footer.cta?.secondaryUrl));

        // Contact
        setContactPhone(safeStr(footer.contact?.phone));
        setContactEmail(safeStr(footer.contact?.email));
        setContactAddress(safeStr(footer.contact?.address));
        setContactWhatsapp(safeStr(footer.contact?.whatsapp));

        // Chips
        if (Array.isArray(footer.chips) && footer.chips.length) {
          setChips(footer.chips.map((c: any) => ({ tr: safeStr(c?.tr), en: safeStr(c?.en) })));
        } else {
          setChips([]);
        }

        // ETBIS
        setEtbisUrl(safeStr(footer.etbis?.url));
        setEtbisBadge({ tr: safeStr(footer.etbis?.badge?.tr), en: safeStr(footer.etbis?.badge?.en) });
        setEtbisNote({ tr: safeStr(footer.etbis?.note?.tr), en: safeStr(footer.etbis?.note?.en) });
        setEtbisLinkLabel({ tr: safeStr(footer.etbis?.linkLabel?.tr), en: safeStr(footer.etbis?.linkLabel?.en) });

        // Trust
        setTrustPayment((footer.trust?.payment || []).join(", "));
        setTrustSecurity((footer.trust?.security || []).join(", "));
        setTrustShipping((footer.trust?.shipping || []).join(", "));

        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [db]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const ref = doc(db, "settings", "site");
      const payload: FooterSettings = {
        brand: {
          title: brandTitle,
          tagline: brandTagline,
          logoUrl,
          logoLink,
        },
        cta: {
          title: ctaTitle,
          description: ctaDesc,
          primaryLabel: ctaPrimaryLabel,
          primaryUrl: ctaPrimaryUrl,
          secondaryLabel: ctaSecondaryLabel,
          secondaryUrl: ctaSecondaryUrl,
        },
        contact: {
          phone: contactPhone,
          email: contactEmail,
          address: contactAddress,
          whatsapp: contactWhatsapp,
        },
        chips: chips.filter((c) => safeStr(c.tr) || safeStr(c.en)),
        etbis: {
          url: etbisUrl,
          badge: etbisBadge,
          note: etbisNote,
          linkLabel: etbisLinkLabel,
        },
        trust: {
          payment: trustPayment.split(",").map((x) => x.trim()).filter(Boolean),
          security: trustSecurity.split(",").map((x) => x.trim()).filter(Boolean),
          shipping: trustShipping.split(",").map((x) => x.trim()).filter(Boolean),
        },
        columns: columns.filter(
          (col) => safeStr(col.title.tr) || col.links.some((l) => safeStr(l.url))
        ),
        social: socials.filter((x) => safeStr(x.url)),
        bottom: {
          left: bottomLeft,
          right: bottomRight,
        },
      };

      await setDoc(ref, { footer: payload }, { merge: true });
      showToast("✅ Footer ayarları kaydedildi!");
    } catch (e: any) {
      showToast("❌ Hata: " + (e?.message || "Kaydedilemedi"));
    } finally {
      setSaving(false);
    }
  }

  // ─── Column helpers ───
  function updateColumn(ci: number, field: "title", lang: "tr" | "en", value: string) {
    setColumns((prev) => {
      const next = [...prev];
      next[ci] = { ...next[ci], title: { ...next[ci].title, [lang]: value } };
      return next;
    });
  }

  function updateLink(ci: number, li: number, field: "label" | "url", lang: "tr" | "en" | null, value: string) {
    setColumns((prev) => {
      const next = [...prev];
      const col = { ...next[ci], links: [...next[ci].links] };
      const lnk = { ...col.links[li] };

      if (field === "url") {
        lnk.url = value;
      } else if (lang) {
        lnk.label = { ...lnk.label, [lang]: value };
      }

      col.links[li] = lnk;
      next[ci] = col;
      return next;
    });
  }

  function addLink(ci: number) {
    setColumns((prev) => {
      const next = [...prev];
      next[ci] = { ...next[ci], links: [...next[ci].links, emptyLink()] };
      return next;
    });
  }

  function removeLink(ci: number, li: number) {
    setColumns((prev) => {
      const next = [...prev];
      next[ci] = {
        ...next[ci],
        links: next[ci].links.filter((_, i) => i !== li),
      };
      return next;
    });
  }

  function addColumn() {
    setColumns((prev) => [...prev, emptyColumn()]);
  }

  function removeColumn(ci: number) {
    setColumns((prev) => prev.filter((_, i) => i !== ci));
  }

  // ─── Social helpers ───
  function updateSocial(i: number, field: "type" | "url", value: string) {
    setSocials((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function addSocial() {
    setSocials((prev) => [...prev, emptySocial()]);
  }

  function removeSocial(i: number) {
    setSocials((prev) => prev.filter((_, idx) => idx !== i));
  }

  const tabs = [
    { key: "brand" as const, label: "Marka & Logo", icon: "◈" },
    { key: "cta" as const, label: "CTA Band", icon: "📣" },
    { key: "contact" as const, label: "İletişim", icon: "📞" },
    { key: "columns" as const, label: "Menü Kolonları", icon: "▤" },
    { key: "social" as const, label: "Sosyal Medya", icon: "◎" },
    { key: "chips" as const, label: "Güvence Chip", icon: "🛡️" },
    { key: "etbis" as const, label: "ETBİS", icon: "📋" },
    { key: "trust" as const, label: "Trust Band", icon: "🔒" },
    { key: "bottom" as const, label: "Alt Bilgi", icon: "▭" },
  ];

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 700 }}>
        Footer ayarları yükleniyor...
      </div>
    );
  }

  return (
    <div className={s.page}>
      {/* Toast */}
      {toast ? (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: "14px 22px",
            borderRadius: 16,
            background: "rgba(15,23,42,.94)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            boxShadow: "0 16px 40px rgba(0,0,0,.20)",
            animation: "fadeIn .2s ease",
          }}
        >
          {toast}
        </div>
      ) : null}

      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.eyebrow}>Footer Yönetimi</div>
          <h1 className={s.heroTitle}>Footer Ayarları</h1>
          <p className={s.heroText}>
            Web sitesinin alt bölümünü buradan yönetebilirsin. Marka bilgileri,
            menü kolonları, sosyal medya linkleri ve alt bilgi metnini düzenle.
          </p>
          <div className={s.heroActions}>
            <button
              type="button"
              style={saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        <div className={s.heroRight}>
          <div className={s.quickGrid}>
            <div className={s.miniStat}>
              <span>Kolon Sayısı</span>
              <b>{columns.length}</b>
            </div>
            <div className={s.miniStat}>
              <span>Toplam Link</span>
              <b>{columns.reduce((sum, col) => sum + col.links.length, 0)}</b>
            </div>
            <div className={s.miniStat}>
              <span>Sosyal Medya</span>
              <b>{socials.filter((x) => safeStr(x.url)).length}</b>
            </div>
            <div className={s.miniStat}>
              <span>Logo</span>
              <b>{logoUrl ? "Var" : "Yok"}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${s.tabBtn} ${activeTab === tab.key ? s.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Brand Tab ═══ */}
      {activeTab === "brand" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Marka & Logo</div>
              <div className={s.cardSub}>Footer'da görünen marka adı, slogan ve logo.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Marka Adı (TR)</label>
              <input
                style={inputStyle}
                value={brandTitle.tr}
                onChange={(e) => setBrandTitle((p) => ({ ...p, tr: e.target.value }))}
                placeholder="Dromocob"
              />
            </div>
            <div>
              <label style={labelStyle}>Brand Name (EN)</label>
              <input
                style={inputStyle}
                value={brandTitle.en}
                onChange={(e) => setBrandTitle((p) => ({ ...p, en: e.target.value }))}
                placeholder="Dromocob"
              />
            </div>
            <div>
              <label style={labelStyle}>Slogan (TR)</label>
              <input
                style={inputStyle}
                value={brandTagline.tr}
                onChange={(e) => setBrandTagline((p) => ({ ...p, tr: e.target.value }))}
                placeholder="Sertifikalı ürün • Güvenli ödeme • Hızlı kargo"
              />
            </div>
            <div>
              <label style={labelStyle}>Tagline (EN)</label>
              <input
                style={inputStyle}
                value={brandTagline.en}
                onChange={(e) => setBrandTagline((p) => ({ ...p, en: e.target.value }))}
                placeholder="Certified products • Secure payment"
              />
            </div>
            <div>
              <label style={labelStyle}>Logo URL</label>
              <input
                style={inputStyle}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://... veya /dromocob-mark.svg"
              />
            </div>
            <div>
              <label style={labelStyle}>Logo Link</label>
              <input
                style={inputStyle}
                value={logoLink}
                onChange={(e) => setLogoLink(e.target.value)}
                placeholder="/"
              />
            </div>
          </div>

          {logoUrl ? (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 16,
                background: "#0f172a",
                display: "inline-block",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo önizleme"
                style={{ height: 60, objectFit: "contain", display: "block" }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ═══ Columns Tab ═══ */}
      {activeTab === "columns" ? (
        <div style={{ display: "grid", gap: 18 }}>
          {columns.map((col, ci) => (
            <div key={ci} className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>
                    Kolon {ci + 1}: {safeStr(col.title.tr) || "Başlıksız"}
                  </div>
                  <div className={s.cardSub}>{col.links.length} link</div>
                </div>
                <button
                  type="button"
                  style={dangerBtn}
                  onClick={() => removeColumn(ci)}
                >
                  Kolonu Sil
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={labelStyle}>Kolon Başlığı (TR)</label>
                  <input
                    style={inputStyle}
                    value={col.title.tr}
                    onChange={(e) => updateColumn(ci, "title", "tr", e.target.value)}
                    placeholder="Kurumsal"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Column Title (EN)</label>
                  <input
                    style={inputStyle}
                    value={col.title.en}
                    onChange={(e) => updateColumn(ci, "title", "en", e.target.value)}
                    placeholder="Company"
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                Linkler
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {col.links.map((lnk, li) => (
                  <div
                    key={li}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      gap: 10,
                      alignItems: "end",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "#f8fbff",
                      border: "1px solid rgba(15,23,42,.05)",
                    }}
                  >
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Etiket (TR)</label>
                      <input
                        style={{ ...inputStyle, minHeight: 36, fontSize: 13 }}
                        value={lnk.label.tr}
                        onChange={(e) => updateLink(ci, li, "label", "tr", e.target.value)}
                        placeholder="Hakkımızda"
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Label (EN)</label>
                      <input
                        style={{ ...inputStyle, minHeight: 36, fontSize: 13 }}
                        value={lnk.label.en}
                        onChange={(e) => updateLink(ci, li, "label", "en", e.target.value)}
                        placeholder="About"
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>URL</label>
                      <input
                        style={{ ...inputStyle, minHeight: 36, fontSize: 13, fontFamily: "monospace" }}
                        value={lnk.url}
                        onChange={(e) => updateLink(ci, li, "url", null, e.target.value)}
                        placeholder="/hakkimizda"
                      />
                    </div>
                    <button
                      type="button"
                      style={{ ...dangerBtn, minHeight: 36, padding: "0 10px", fontSize: 11 }}
                      onClick={() => removeLink(ci, li)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <button type="button" style={miniBtn} onClick={() => addLink(ci)}>
                  + Link Ekle
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            style={{
              ...saveBtn,
              background: "#fff",
              color: "#1d4ed8",
              border: "1px solid rgba(29,78,216,.12)",
              boxShadow: "0 8px 20px rgba(15,23,42,.06)",
            }}
            onClick={addColumn}
          >
            + Yeni Kolon Ekle
          </button>
        </div>
      ) : null}

      {/* ═══ Social Tab ═══ */}
      {activeTab === "social" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Sosyal Medya</div>
              <div className={s.cardSub}>Footer'da görünen sosyal medya ikonları ve linkleri.</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {socials.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr auto",
                  gap: 12,
                  alignItems: "end",
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "#f8fbff",
                  border: "1px solid rgba(15,23,42,.05)",
                }}
              >
                <div>
                  <label style={labelStyle}>Platform</label>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={item.type}
                    onChange={(e) => updateSocial(i, "type", e.target.value)}
                  >
                    {SOCIAL_TYPES.map((st) => (
                      <option key={st.type} value={st.type}>
                        {st.icon} {st.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>URL</label>
                  <input
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                    value={item.url}
                    onChange={(e) => updateSocial(i, "url", e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <button
                  type="button"
                  style={{ ...dangerBtn, minHeight: 42 }}
                  onClick={() => removeSocial(i)}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" style={miniBtn} onClick={addSocial}>
              + Sosyal Medya Ekle
            </button>
          </div>
        </div>
      ) : null}

      {/* ═══ CTA Band Tab ═══ */}
      {activeTab === "cta" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>CTA Band</div>
              <div className={s.cardSub}>Footer üstündeki çağrı bandı — başlık, açıklama ve butonlar.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Başlık (TR)</label>
              <input
                style={inputStyle}
                value={ctaTitle.tr}
                onChange={(e) => setCtaTitle((p) => ({ ...p, tr: e.target.value }))}
                placeholder="Mükemmel hediyeyi seçmekte yardıma mı ihtiyacın var?"
              />
            </div>
            <div>
              <label style={labelStyle}>Title (EN)</label>
              <input
                style={inputStyle}
                value={ctaTitle.en}
                onChange={(e) => setCtaTitle((p) => ({ ...p, en: e.target.value }))}
                placeholder="Need help choosing the perfect gift?"
              />
            </div>
            <div>
              <label style={labelStyle}>Açıklama (TR)</label>
              <input
                style={inputStyle}
                value={ctaDesc.tr}
                onChange={(e) => setCtaDesc((p) => ({ ...p, tr: e.target.value }))}
                placeholder="özel ürün uzmanlarımız..."
              />
            </div>
            <div>
              <label style={labelStyle}>Description (EN)</label>
              <input
                style={inputStyle}
                value={ctaDesc.en}
                onChange={(e) => setCtaDesc((p) => ({ ...p, en: e.target.value }))}
                placeholder="Our lifestyle experts..."
              />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 10px" }}>
            Butonlar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Birincil Buton (TR)</label>
              <input
                style={inputStyle}
                value={ctaPrimaryLabel.tr}
                onChange={(e) => setCtaPrimaryLabel((p) => ({ ...p, tr: e.target.value }))}
                placeholder="WhatsApp"
              />
            </div>
            <div>
              <label style={labelStyle}>Primary Button (EN)</label>
              <input
                style={inputStyle}
                value={ctaPrimaryLabel.en}
                onChange={(e) => setCtaPrimaryLabel((p) => ({ ...p, en: e.target.value }))}
                placeholder="WhatsApp"
              />
            </div>
            <div>
              <label style={labelStyle}>Birincil Buton URL</label>
              <input
                style={{ ...inputStyle, fontFamily: "monospace" }}
                value={ctaPrimaryUrl}
                onChange={(e) => setCtaPrimaryUrl(e.target.value)}
                placeholder="Boş bırakılırsa WhatsApp linki kullanılır"
              />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <label style={labelStyle}>İkincil Buton (TR)</label>
                <input
                  style={inputStyle}
                  value={ctaSecondaryLabel.tr}
                  onChange={(e) => setCtaSecondaryLabel((p) => ({ ...p, tr: e.target.value }))}
                  placeholder="İletişim"
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Secondary Button (EN)</label>
              <input
                style={inputStyle}
                value={ctaSecondaryLabel.en}
                onChange={(e) => setCtaSecondaryLabel((p) => ({ ...p, en: e.target.value }))}
                placeholder="Contact"
              />
            </div>
            <div>
              <label style={labelStyle}>İkincil Buton URL</label>
              <input
                style={{ ...inputStyle, fontFamily: "monospace" }}
                value={ctaSecondaryUrl}
                onChange={(e) => setCtaSecondaryUrl(e.target.value)}
                placeholder="/iletisim"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Contact Tab ═══ */}
      {activeTab === "contact" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>İletişim Bilgileri</div>
              <div className={s.cardSub}>Footer'da görünen telefon, e-posta, adres ve WhatsApp numarası.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input
                style={inputStyle}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+90 555 000 00 00"
              />
            </div>
            <div>
              <label style={labelStyle}>E-posta</label>
              <input
                style={inputStyle}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@dromocob.com"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Adres</label>
              <input
                style={inputStyle}
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
                placeholder="İstanbul · Demo Showroom"
              />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp Numarası</label>
              <input
                style={inputStyle}
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                placeholder="905078482448"
              />
            </div>
          </div>

          <div className={s.noteBox}>
            <div className={s.noteTitle}>💡 İpucu</div>
            <div className={s.noteText}>
              WhatsApp numarasını başında 0 olmadan, ülke koduyla birlikte yazın. Örneğin: 905078482448
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Chips Tab ═══ */}
      {activeTab === "chips" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Güvence Chip&apos;leri</div>
              <div className={s.cardSub}>Footer marka bloğundaki küçük etiketler (Sertifikalı, Sigortalı Kargo vb.)</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {chips.map((chip, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: 12,
                  alignItems: "end",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "#f8fbff",
                  border: "1px solid rgba(15,23,42,.05)",
                }}
              >
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Etiket (TR)</label>
                  <input
                    style={{ ...inputStyle, minHeight: 36, fontSize: 13 }}
                    value={chip.tr}
                    onChange={(e) => {
                      setChips((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], tr: e.target.value };
                        return next;
                      });
                    }}
                    placeholder="Sertifikalı"
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Label (EN)</label>
                  <input
                    style={{ ...inputStyle, minHeight: 36, fontSize: 13 }}
                    value={chip.en}
                    onChange={(e) => {
                      setChips((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], en: e.target.value };
                        return next;
                      });
                    }}
                    placeholder="Certified"
                  />
                </div>
                <button
                  type="button"
                  style={{ ...dangerBtn, minHeight: 36, padding: "0 10px", fontSize: 11 }}
                  onClick={() => setChips((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              style={miniBtn}
              onClick={() => setChips((prev) => [...prev, { tr: "", en: "" }])}
            >
              + Chip Ekle
            </button>
          </div>
        </div>
      ) : null}

      {/* ═══ ETBIS Tab ═══ */}
      {activeTab === "etbis" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>ETBİS Ayarları</div>
              <div className={s.cardSub}>Footer'daki ETBİS doğrulama kartının içeriği.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>ETBİS Doğrulama URL</label>
              <input
                style={{ ...inputStyle, fontFamily: "monospace" }}
                value={etbisUrl}
                onChange={(e) => setEtbisUrl(e.target.value)}
                placeholder="https://etbis.ticaret.gov.tr/..."
              />
            </div>
            <div>
              <label style={labelStyle}>Badge Metni (TR)</label>
              <input
                style={inputStyle}
                value={etbisBadge.tr}
                onChange={(e) => setEtbisBadge((p) => ({ ...p, tr: e.target.value }))}
                placeholder="Resmi Kayıt"
              />
            </div>
            <div>
              <label style={labelStyle}>Badge Text (EN)</label>
              <input
                style={inputStyle}
                value={etbisBadge.en}
                onChange={(e) => setEtbisBadge((p) => ({ ...p, en: e.target.value }))}
                placeholder="Official Record"
              />
            </div>
            <div>
              <label style={labelStyle}>Açıklama (TR)</label>
              <input
                style={inputStyle}
                value={etbisNote.tr}
                onChange={(e) => setEtbisNote((p) => ({ ...p, tr: e.target.value }))}
                placeholder="E-ticaret kaydımızı resmi ETBİS sistemi üzerinden..."
              />
            </div>
            <div>
              <label style={labelStyle}>Description (EN)</label>
              <input
                style={inputStyle}
                value={etbisNote.en}
                onChange={(e) => setEtbisNote((p) => ({ ...p, en: e.target.value }))}
                placeholder="Verify our e-commerce registration..."
              />
            </div>
            <div>
              <label style={labelStyle}>Link Metni (TR)</label>
              <input
                style={inputStyle}
                value={etbisLinkLabel.tr}
                onChange={(e) => setEtbisLinkLabel((p) => ({ ...p, tr: e.target.value }))}
                placeholder="ETBİS Doğrula"
              />
            </div>
            <div>
              <label style={labelStyle}>Link Text (EN)</label>
              <input
                style={inputStyle}
                value={etbisLinkLabel.en}
                onChange={(e) => setEtbisLinkLabel((p) => ({ ...p, en: e.target.value }))}
                placeholder="Verify ETBIS"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Trust Band Tab ═══ */}
      {activeTab === "trust" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Trust Band (Güven Bandı)</div>
              <div className={s.cardSub}>Footer alt kısmındaki ödeme, güvenlik ve kargo badge&apos;leri. Virgülle ayırarak yazın.</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <label style={labelStyle}>💳 Ödeme Yöntemleri</label>
              <input
                style={inputStyle}
                value={trustPayment}
                onChange={(e) => setTrustPayment(e.target.value)}
                placeholder="Visa, Mastercard, Troy, PayTR"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Virgülle ayırın: Visa, Mastercard, Troy, PayTR</div>
            </div>
            <div>
              <label style={labelStyle}>🔒 Güvenlik</label>
              <input
                style={inputStyle}
                value={trustSecurity}
                onChange={(e) => setTrustSecurity(e.target.value)}
                placeholder="SSL, 3D Secure, KVKK"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Virgülle ayırın: SSL, 3D Secure, KVKK</div>
            </div>
            <div>
              <label style={labelStyle}>📦 Kargo</label>
              <input
                style={inputStyle}
                value={trustShipping}
                onChange={(e) => setTrustShipping(e.target.value)}
                placeholder="DHL Kargo, Sigortalı"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Virgülle ayırın: DHL Kargo, Sigortalı</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Bottom Tab ═══ */}
      {activeTab === "bottom" ? (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Alt Bilgi</div>
              <div className={s.cardSub}>Footer'ın en alt satırında görünen telif ve bilgi metinleri.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Sol Metin (TR)</label>
              <input
                style={inputStyle}
                value={bottomLeft.tr}
                onChange={(e) => setBottomLeft((p) => ({ ...p, tr: e.target.value }))}
                placeholder="© {{year}} Dromocob — Tüm hakları saklıdır."
              />
            </div>
            <div>
              <label style={labelStyle}>Left Text (EN)</label>
              <input
                style={inputStyle}
                value={bottomLeft.en}
                onChange={(e) => setBottomLeft((p) => ({ ...p, en: e.target.value }))}
                placeholder="© {{year}} Dromocob — All rights reserved."
              />
            </div>
            <div>
              <label style={labelStyle}>Sağ Metin (TR)</label>
              <input
                style={inputStyle}
                value={bottomRight.tr}
                onChange={(e) => setBottomRight((p) => ({ ...p, tr: e.target.value }))}
                placeholder="Güvenli alışveriş deneyimi"
              />
            </div>
            <div>
              <label style={labelStyle}>Right Text (EN)</label>
              <input
                style={inputStyle}
                value={bottomRight.en}
                onChange={(e) => setBottomRight((p) => ({ ...p, en: e.target.value }))}
                placeholder="Secure shopping experience"
              />
            </div>
          </div>

          <div className={s.noteBox}>
            <div className={s.noteTitle}>💡 İpucu</div>
            <div className={s.noteText}>
              Sol metinde <code style={{ background: "rgba(0,0,0,.06)", padding: "2px 6px", borderRadius: 6 }}>{"{{year}}"}</code> yazarsan
              otomatik olarak güncel yıl ile değiştirilir.
            </div>
          </div>
        </div>
      ) : null}

      {/* Save bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          paddingTop: 8,
        }}
      >
        <button
          type="button"
          style={saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Kaydediliyor..." : "💾 Kaydet"}
        </button>
      </div>
    </div>
  );
}

export default function AdminFooterPage() {
  return (
    <AdminGate>
      <PermissionGate permission="footer_settings">
        <AdminFooterPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
