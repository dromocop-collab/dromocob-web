"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { uploadSettingsImage } from "@/lib/uploadProductImage";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./premiumMarqueeEditor.module.css";

import IconPackPicker from "@/components/admin/ui/IconPackPicker";
import PalettePicker from "@/components/admin/ui/PalettePicker";

type LocaleText = { tr: string; en: string };

type PremiumMarqueeItem = {
  id: string;
  text: LocaleText;
  href?: string;
  strong?: boolean;
};

type PremiumMarqueeConfig = {
  enabled: boolean;

  // ✅ Custom CSS
  customCssEnabled?: boolean;
  customCss?: string;

  items: PremiumMarqueeItem[];

  heightPx: number;
  radiusPx: number;
  paddingX: number;
  gapPx: number;
  textSizePx: number;
  fontWeight: number;
  letterSpacingEm: number;

  separator: "dot" | "bullet" | "icon" | "none";
  dotSizePx: number;

  speedPxPerSec: number;
  direction: "left" | "right";
  pauseOnHover: boolean;

  bgColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;

  edgeFade: boolean;
  edgeFadePx: number;
  edgeFadeColor: string;

  iconUrl: string;
  iconSizePx: number;

  bgImageUrl: string;
  bgImageOpacity: number;
};

type HomeSettingsDoc = { premiumMarquee?: Partial<PremiumMarqueeConfig> };

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function clamp(n: any, a: number, b: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

const defaults: PremiumMarqueeConfig = {
  enabled: true,

  customCssEnabled: false,
  customCss: "",

  items: [
    { id: "m1", text: { tr: "Sertifikalı ürün", en: "Certified products" } },
    { id: "m2", text: { tr: "Güvenli ödeme", en: "Secure payment" } },
    { id: "m3", text: { tr: "Aynı gün kargo", en: "Same-day shipping" } },
    { id: "m4", text: { tr: "Ücretsiz hediye paketi", en: "Free gift wrap" } },
  ],

  heightPx: 46,
  radiusPx: 0,
  paddingX: 24,
  gapPx: 24,
  textSizePx: 14,
  fontWeight: 800,
  letterSpacingEm: 0.02,

  separator: "dot",
  dotSizePx: 5,

  speedPxPerSec: 82,
  direction: "left",
  pauseOnHover: true,

  bgColor: "rgba(255,255,255,0.96)",
  textColor: "rgba(17,24,39,0.94)",
  borderColor: "rgba(15,23,42,0.10)",
  accentColor: "rgba(180,145,64,0.95)",

  edgeFade: true,
  edgeFadePx: 34,
  edgeFadeColor: "rgba(255,255,255,1)",

  iconUrl: "",
  iconSizePx: 16,

  bgImageUrl: "",
  bgImageOpacity: 0.04,
};
type PresetKey = "luxuryGold" | "darkPremium" | "minimalWhite" | "editorialStrip";

const marqueePresets: Record<PresetKey, Partial<PremiumMarqueeConfig>> = {
  luxuryGold: {
    enabled: true,
    heightPx: 46,
    radiusPx: 0,
    paddingX: 28,
    gapPx: 26,
    textSizePx: 14,
    fontWeight: 850,
    letterSpacingEm: 0.03,
    separator: "dot",
    dotSizePx: 5,
    speedPxPerSec: 82,
    direction: "left",
    pauseOnHover: true,
    bgColor: "rgba(255,255,255,0.98)",
    textColor: "rgba(17,24,39,0.96)",
    borderColor: "rgba(180,145,64,0.22)",
    accentColor: "rgba(180,145,64,0.96)",
    edgeFade: true,
    edgeFadePx: 34,
    edgeFadeColor: "rgba(255,255,255,1)",
  },
  darkPremium: {
    enabled: true,
    heightPx: 48,
    radiusPx: 0,
    paddingX: 28,
    gapPx: 24,
    textSizePx: 14,
    fontWeight: 800,
    letterSpacingEm: 0.025,
    separator: "bullet",
    dotSizePx: 5,
    speedPxPerSec: 88,
    direction: "left",
    pauseOnHover: true,
    bgColor: "rgba(2,6,23,0.96)",
    textColor: "rgba(248,250,252,0.94)",
    borderColor: "rgba(255,255,255,0.08)",
    accentColor: "rgba(251,191,36,0.95)",
    edgeFade: true,
    edgeFadePx: 34,
    edgeFadeColor: "rgba(2,6,23,1)",
  },
  minimalWhite: {
    enabled: true,
    heightPx: 42,
    radiusPx: 18,
    paddingX: 18,
    gapPx: 18,
    textSizePx: 13,
    fontWeight: 700,
    letterSpacingEm: 0.01,
    separator: "dot",
    dotSizePx: 4,
    speedPxPerSec: 74,
    direction: "left",
    pauseOnHover: true,
    bgColor: "rgba(255,255,255,0.96)",
    textColor: "rgba(31,41,55,0.9)",
    borderColor: "rgba(15,23,42,0.08)",
    accentColor: "rgba(29,78,216,0.95)",
    edgeFade: true,
    edgeFadePx: 24,
    edgeFadeColor: "rgba(255,255,255,1)",
  },
  editorialStrip: {
    enabled: true,
    heightPx: 52,
    radiusPx: 0,
    paddingX: 32,
    gapPx: 32,
    textSizePx: 15,
    fontWeight: 900,
    letterSpacingEm: 0.045,
    separator: "none",
    dotSizePx: 5,
    speedPxPerSec: 96,
    direction: "left",
    pauseOnHover: false,
    bgColor: "rgba(245,247,250,0.98)",
    textColor: "rgba(10,15,28,0.96)",
    borderColor: "rgba(15,23,42,0.06)",
    accentColor: "rgba(220,38,38,0.92)",
    edgeFade: true,
    edgeFadePx: 38,
    edgeFadeColor: "rgba(245,247,250,1)",
  },
};
function normalize(raw?: Partial<PremiumMarqueeConfig>): PremiumMarqueeConfig {
  const x = raw || {};

  const base: PremiumMarqueeConfig = {
    ...defaults,
    ...x,
  };

  // ✅ items normalize
  base.items =
    Array.isArray(x.items) && x.items.length
      ? x.items
          .map((it) => ({
            id: String(it?.id || uid()),
            text: {
              tr: String(it?.text?.tr || "").trim(),
              en: String(it?.text?.en || "").trim(),
            },
            href: String(it?.href || "").trim() || "",
            strong: !!it?.strong,
          }))
          .filter((it) => it.text.tr || it.text.en)
      : defaults.items;

  // ✅ clamp numeric
  base.heightPx = clamp(base.heightPx, 28, 88);
  base.radiusPx = clamp(base.radiusPx, 0, 40);
  base.paddingX = clamp(base.paddingX, 0, 60);
  base.gapPx = clamp(base.gapPx, 6, 60);
  base.textSizePx = clamp(base.textSizePx, 10, 22);
  base.fontWeight = clamp(base.fontWeight, 400, 950);
  base.letterSpacingEm = clamp(base.letterSpacingEm, -0.08, 0.08);
  base.dotSizePx = clamp(base.dotSizePx, 2, 14);
  base.speedPxPerSec = clamp(base.speedPxPerSec, 30, 220);
  base.edgeFadePx = clamp(base.edgeFadePx, 0, 80);
  base.iconSizePx = clamp(base.iconSizePx, 10, 30);
  base.bgImageOpacity = clamp(base.bgImageOpacity, 0, 0.6);

  // ✅ custom css safety
  base.customCssEnabled = typeof x.customCssEnabled === "boolean" ? x.customCssEnabled : defaults.customCssEnabled;
  base.customCss = String(x.customCss ?? defaults.customCss).slice(0, 20000);

  return base;
}

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
function ColorField({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) {
    const [open, setOpen] = useState(false);
  
    return (
      <div className={s.colorField}>
        <div className={s.colorTop}>
          <div className={s.colorLabel}>{label}</div>
  
          <button
            type="button"
            className={s.swatchBtn}
            onClick={() => setOpen((x) => !x)}
            style={{ ["--sw" as any]: value }}
            aria-label={`${label} seç`}
          >
            <span className={s.swatch} />
          </button>
        </div>
  
        <div className={s.colorInputRow}>
          <input
            className={s.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="rgba(...) veya #hex"
          />
  
          <button type="button" className={s.ghost} onClick={() => setOpen(true)}>
            Palette
          </button>
        </div>
  
        {open ? (
          <div className={s.colorPopover}>
            <div className={s.colorPopoverHead}>
              <div className={s.monoMini}>{label}</div>
              <button type="button" className={s.closeMini} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
  
            <PalettePicker label={label} value={value} onChange={(v) => onChange(v)} />
  
            
          </div>
        ) : null}
      </div>
    );
  }
function PremiumMarqueeEditorInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "home_settings"), [db]);

  const [cfg, setCfg] = useState<PremiumMarqueeConfig>(defaults);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState<null | "icon" | "bg">(null);

  // modal
  const [cssOpen, setCssOpen] = useState(false);
  const [cssDraft, setCssDraft] = useState("");

  useEffect(() => {
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as HomeSettingsDoc) || {};
        const next = normalize(data.premiumMarquee);
        setCfg(next);
        setCssDraft(next.customCss || "");
      },
      (e) => {
        console.error(e);
        setCfg(defaults);
        setCssDraft("");
      }
    );
  }, [ref]);
const isDirty = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  return JSON.stringify(stripUndefined(cfg)) !== JSON.stringify(stripUndefined(normalize(cfg)));
}, [cfg]);
  // ESC + scroll lock
  useEffect(() => {
    if (!cssOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCssOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [cssOpen]);

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        premiumMarquee: {
          ...cfg,
          // istersen burada extra güvenlik: customCss max vs
          customCss: String(cfg.customCss || "").slice(0, 20000),
        },
        updatedAt: serverTimestamp(),
      };
  
      await setDoc(ref, payload as any, { merge: true });
  
      console.log("✅ SAVED", payload);
    } catch (e: any) {
      console.error("SAVE_ERR", e);
      setErr(`${e?.code || ""} ${e?.message || "Kaydetme hatası"}`.trim());
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setCfg((p) => ({
      ...p,
      items: [...p.items, { id: `m_${uid()}`, text: { tr: "Yeni metin", en: "New text" }, href: "", strong: false }],
    }));
  };

  const removeItem = (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    setCfg((p) => ({ ...p, items: p.items.filter((x) => x.id !== id) }));
  };

  const updateItem = (id: string, patch: Partial<PremiumMarqueeItem>) => {
    setCfg((p) => ({ ...p, items: p.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  };
function moveItem(id: string, dir: "up" | "down") {
  setCfg((p) => {
    const list = [...p.items];
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return p;

    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return p;

    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    return { ...p, items: list };
  });
}
function duplicateItem(id: string) {
  setCfg((p) => {
    const found = p.items.find((x) => x.id === id);
    if (!found) return p;

    const clone = {
      ...found,
      id: `m_${uid()}`,
      text: {
        tr: `${found.text.tr} Kopya`,
        en: `${found.text.en} Copy`,
      },
    };

    const idx = p.items.findIndex((x) => x.id === id);
    const next = [...p.items];
    next.splice(idx + 1, 0, clone);

    return { ...p, items: next };
  });
}
function applyPreset(key: PresetKey) {
  const preset = marqueePresets[key];
  setCfg((p) => normalize({ ...p, ...preset }));
}

function resetAllToDefaults() {
  const ok = confirm("Tüm marquee ayarları varsayılana dönsün mü?");
  if (!ok) return;
  setCfg(defaults);
  setCssDraft(defaults.customCss || "");
}
  const doUpload = async (kind: "icon" | "bg", file?: File | null) => {
    if (!file) return;
    setUploading(kind);
    setErr("");
    try {
      const url = await uploadSettingsImage(file, kind === "icon" ? "premiumMarquee_icon" : "premiumMarquee_bg");
      setCfg((p) => (kind === "icon" ? { ...p, iconUrl: url } : { ...p, bgImageUrl: url }));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Upload hatası");
    } finally {
      setUploading(null);
    }
  };
const previewItems = cfg.items.length ? cfg.items : defaults.items;

const previewStyle = {
  ["--pm-height" as any]: `${cfg.heightPx}px`,
  ["--pm-radius" as any]: `${cfg.radiusPx}px`,
  ["--pm-px" as any]: `${cfg.paddingX}px`,
  ["--pm-gap" as any]: `${cfg.gapPx}px`,
  ["--pm-text" as any]: `${cfg.textSizePx}px`,
  ["--pm-weight" as any]: cfg.fontWeight,
  ["--pm-letter" as any]: `${cfg.letterSpacingEm}em`,
  ["--pm-bg" as any]: cfg.bgColor,
  ["--pm-color" as any]: cfg.textColor,
  ["--pm-border" as any]: cfg.borderColor,
  ["--pm-accent" as any]: cfg.accentColor,
  ["--pm-dot" as any]: `${cfg.dotSizePx}px`,
  ["--pm-icon" as any]: `${cfg.iconSizePx}px`,
  ["--pm-fade" as any]: `${cfg.edgeFadePx}px`,
  ["--pm-fade-color" as any]: cfg.edgeFadeColor,
  ["--pm-bg-image" as any]: cfg.bgImageUrl ? `url(${cfg.bgImageUrl})` : "none",
  ["--pm-bg-image-opacity" as any]: cfg.bgImageOpacity,
} as React.CSSProperties;
  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <div className={s.h1}>Premium Marquee</div>
          <div className={s.p}>Metinler, hız, yön, renkler, ikon/görsel… hepsi burada.</div>
        </div>

        <div className={s.headActions}>
          <label className={s.toggle}>
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
            Aktif
          </label>

          <button className={s.primary} onClick={save} type="button" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
<section className={s.presetBar}>
  <div className={s.presetBarLeft}>
    <div className={s.presetTitle}>Hazır Presetler</div>
    <div className={s.presetSub}>Tek tıkla görünüm uygula, sonra ince ayar yap.</div>
  </div>

  <div className={s.presetActions}>
    <button type="button" className={s.presetBtn} onClick={() => applyPreset("luxuryGold")}>
      Luxury Gold
    </button>
    <button type="button" className={s.presetBtn} onClick={() => applyPreset("darkPremium")}>
      Dark Premium
    </button>
    <button type="button" className={s.presetBtn} onClick={() => applyPreset("minimalWhite")}>
      Minimal White
    </button>
    <button type="button" className={s.presetBtn} onClick={() => applyPreset("editorialStrip")}>
      Editorial Strip
    </button>
    <button type="button" className={s.presetBtnDanger} onClick={resetAllToDefaults}>
      Reset
    </button>
  </div>
</section>
      {err ? <div className={s.err}>{err}</div> : null}

      <div className={s.grid}>
        {/* CONTENT */}
        <div className={s.card}>
          <div className={s.cardTitle}>İçerik</div>
<div className={s.miniHint}>{cfg.items.length} item aktif</div>
          <div className={s.items}>
            {cfg.items.map((it) => (
              <div key={it.id} className={s.itemRow}>
                <div className={s.itemTop}>
  <div className={s.itemTopLeft}>
    <div className={s.mono}>{it.id}</div>
  </div>

  <div className={s.itemTopActions}>
    <button className={s.iconBtn} type="button" onClick={() => moveItem(it.id, "up")}>
      ↑
    </button>

    <button className={s.iconBtn} type="button" onClick={() => moveItem(it.id, "down")}>
      ↓
    </button>
    <button className={s.iconBtn} type="button" onClick={() => duplicateItem(it.id)}>
  ⧉
</button>
    <button className={s.danger} type="button" onClick={() => removeItem(it.id)}>
      Sil
    </button>
  </div>
</div>

                <div className={s.twoCol}>
                  <label className={s.label}>
                    <span>TR</span>
                    <input
                      className={s.input}
                      value={it.text.tr}
                      onChange={(e) => updateItem(it.id, { text: { ...it.text, tr: e.target.value } })}
                    />
                  </label>

                  <label className={s.label}>
                    <span>EN</span>
                    <input
                      className={s.input}
                      value={it.text.en}
                      onChange={(e) => updateItem(it.id, { text: { ...it.text, en: e.target.value } })}
                    />
                  </label>
                </div>

                <div className={s.twoCol}>
                  <label className={s.label}>
                    <span>href (opsiyonel)</span>
                    <input
                      className={s.input}
                      value={it.href || ""}
                      onChange={(e) => updateItem(it.id, { href: e.target.value })}
                      placeholder="/shop veya https://..."
                    />
                  </label>

                  <label className={s.check}>
                    <input type="checkbox" checked={!!it.strong} onChange={(e) => updateItem(it.id, { strong: e.target.checked })} />
                    Vurgulu (bold)
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button className={s.ghost} onClick={addItem} type="button">
            + Yeni Item
          </button>
        </div>

        {/* STYLE */}
        <div className={s.card}>
          <div className={s.cardTitle}>Görünüm</div>

          <div className={s.form}>
            <div className={s.row4}>
              <label className={s.label}>
                <span>Height</span>
                <input className={s.input} type="number" value={cfg.heightPx} onChange={(e) => setCfg({ ...cfg, heightPx: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>Radius</span>
                <input className={s.input} type="number" value={cfg.radiusPx} onChange={(e) => setCfg({ ...cfg, radiusPx: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>PaddingX</span>
                <input className={s.input} type="number" value={cfg.paddingX} onChange={(e) => setCfg({ ...cfg, paddingX: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>Gap</span>
                <input className={s.input} type="number" value={cfg.gapPx} onChange={(e) => setCfg({ ...cfg, gapPx: Number(e.target.value) })} />
              </label>
            </div>

            <div className={s.row4}>
              <label className={s.label}>
                <span>Text size</span>
                <input className={s.input} type="number" value={cfg.textSizePx} onChange={(e) => setCfg({ ...cfg, textSizePx: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>Weight</span>
                <input className={s.input} type="number" value={cfg.fontWeight} onChange={(e) => setCfg({ ...cfg, fontWeight: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>LetterSpacing (em)</span>
                <input
                  className={s.input}
                  type="number"
                  step="0.01"
                  value={cfg.letterSpacingEm}
                  onChange={(e) => setCfg({ ...cfg, letterSpacingEm: Number(e.target.value) })}
                />
              </label>

              <label className={s.label}>
                <span>Dot size</span>
                <input className={s.input} type="number" value={cfg.dotSizePx} onChange={(e) => setCfg({ ...cfg, dotSizePx: Number(e.target.value) })} />
              </label>
            </div>

            <div className={s.row4}>
              <label className={s.label}>
                <span>Speed (px/s)</span>
                <input
                  className={s.input}
                  type="number"
                  value={cfg.speedPxPerSec}
                  onChange={(e) => setCfg({ ...cfg, speedPxPerSec: Number(e.target.value) })}
                />
              </label>

              <label className={s.label}>
                <span>Direction</span>
                <select className={s.select} value={cfg.direction} onChange={(e) => setCfg({ ...cfg, direction: e.target.value as any })}>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className={s.check}>
                <input type="checkbox" checked={cfg.pauseOnHover} onChange={(e) => setCfg({ ...cfg, pauseOnHover: e.target.checked })} />
                Hover’da durdur
              </label>

              <label className={s.label}>
                <span>Separator</span>
                <select className={s.select} value={cfg.separator} onChange={(e) => setCfg({ ...cfg, separator: e.target.value as any })}>
                  <option value="dot">Dot</option>
                  <option value="bullet">Bullet</option>
                  <option value="icon">Icon</option>
                  <option value="none">None</option>
                </select>
              </label>
            </div>

           {/* COLORS */}
<div className={s.colorsGrid}>
  <ColorField label="bgColor" value={cfg.bgColor} onChange={(v) => setCfg({ ...cfg, bgColor: v })} />
  <ColorField label="textColor" value={cfg.textColor} onChange={(v) => setCfg({ ...cfg, textColor: v })} />
  <ColorField label="borderColor" value={cfg.borderColor} onChange={(v) => setCfg({ ...cfg, borderColor: v })} />
  <ColorField label="accentColor" value={cfg.accentColor} onChange={(v) => setCfg({ ...cfg, accentColor: v })} />
  <ColorField label="edgeFadeColor" value={cfg.edgeFadeColor} onChange={(v) => setCfg({ ...cfg, edgeFadeColor: v })} />
</div>
            {/* EDGE FADE */}
            <div className={s.row4}>
              <label className={s.check}>
                <input type="checkbox" checked={cfg.edgeFade} onChange={(e) => setCfg({ ...cfg, edgeFade: e.target.checked })} />
                Edge Fade
              </label>

              <label className={s.label}>
                <span>edgeFadePx</span>
                <input className={s.input} type="number" value={cfg.edgeFadePx} onChange={(e) => setCfg({ ...cfg, edgeFadePx: Number(e.target.value) })} />
              </label>

              <label className={s.label}>
                <span>edgeFadeColor</span>
                <input className={s.input} value={cfg.edgeFadeColor} onChange={(e) => setCfg({ ...cfg, edgeFadeColor: e.target.value })} />
              </label>

              <div />
            </div>

            {/* ✅ Custom CSS + Preview (row4 içine gömülü değil!) */}
            <div className={s.row2}>
              <div className={s.block}>
                <div className={s.blockTitle}>Custom CSS</div>

                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={!!cfg.customCssEnabled}
                    onChange={(e) => setCfg({ ...cfg, customCssEnabled: e.target.checked })}
                  />
                  Custom CSS aktif
                </label>

                <div className={s.uploadRow}>
                  <button
                    type="button"
                    className={s.ghost}
                    onClick={() => {
                      setCssDraft(cfg.customCss || "");
                      setCssOpen(true);
                    }}
                  >
                    ✍️ CSS Düzenle (Modal)
                  </button>

                  <button
                    type="button"
                    className={s.ghost}
                    onClick={() => {
                      setCfg({ ...cfg, customCss: "" });
                      setCssDraft("");
                    }}
                  >
                    🧼 Temizle
                  </button>
                </div>

                <div className={s.miniHelp}>Not: CSS sadece PremiumMarquee içinde uygulanır. (Scoped)</div>
              </div>

             <div className={s.block}>
  <div className={s.blockTitle}>Canlı Preview</div>

  <div className={s.previewStage}>
    <div className={s.previewMarquee} style={previewStyle}>
      {cfg.bgImageUrl ? <div className={s.previewBg} /> : null}
      {cfg.edgeFade ? (
        <>
          <div className={`${s.previewFade} ${s.previewFadeLeft}`} />
          <div className={`${s.previewFade} ${s.previewFadeRight}`} />
        </>
      ) : null}

      <div
        className={`${s.previewTrack} ${cfg.pauseOnHover ? s.previewPauseOnHover : ""}`}
        style={{
          animationDuration: `${Math.max(8, 1600 / Math.max(30, cfg.speedPxPerSec))}s`,
          animationDirection: cfg.direction === "right" ? "reverse" : "normal",
        }}
      >
        {[...previewItems, ...previewItems].map((x, i) => (
          <div
            key={`${x.id}-${i}`}
            className={`${s.previewItem} ${x.strong ? s.previewStrong : ""}`}
          >
            {cfg.separator !== "none" ? (
              <span className={s.previewSep}>
                {cfg.separator === "dot" && <span className={s.previewDot} />}
                {cfg.separator === "bullet" && <span className={s.previewBullet}>•</span>}
                {cfg.separator === "icon" &&
                  (cfg.iconUrl ? (
                    <img src={cfg.iconUrl} alt="" className={s.previewIcon} />
                  ) : (
                    <span className={s.previewDot} />
                  ))}
              </span>
            ) : null}

            <span>{x.text.tr || x.text.en}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
            </div>

            <div className={s.sep} />

            {/* ICON + BG */}
            <div className={s.row2}>
              <div className={s.block}>
                <div className={s.blockTitle}>Icon (separator=icon)</div>

                <IconPackPicker value={cfg.iconUrl || ""} onChange={(url) => setCfg({ ...cfg, iconUrl: url })} />

                <div className={s.uploadRow}>
                  <input className={s.input} value={cfg.iconUrl} onChange={(e) => setCfg({ ...cfg, iconUrl: e.target.value })} placeholder="https://..." />
                  <label className={s.uploadBtn}>
                    {uploading === "icon" ? "Yükleniyor..." : "📤 Upload"}
                    <input type="file" accept="image/*" hidden onChange={(e) => doUpload("icon", e.target.files?.[0] || null)} />
                  </label>
                </div>

                <label className={s.label}>
                  <span>iconSizePx</span>
                  <input className={s.input} type="number" value={cfg.iconSizePx} onChange={(e) => setCfg({ ...cfg, iconSizePx: Number(e.target.value) })} />
                </label>
              </div>

              <div className={s.block}>
                <div className={s.blockTitle}>Background Image</div>

                <div className={s.uploadRow}>
                  <input className={s.input} value={cfg.bgImageUrl} onChange={(e) => setCfg({ ...cfg, bgImageUrl: e.target.value })} placeholder="https://..." />
                  <label className={s.uploadBtn}>
                    {uploading === "bg" ? "Yükleniyor..." : "🖼️ Upload"}
                    <input type="file" accept="image/*" hidden onChange={(e) => doUpload("bg", e.target.files?.[0] || null)} />
                  </label>
                </div>

                <label className={s.label}>
                  <span>bgImageOpacity (0..0.6)</span>
                  <input
                    className={s.input}
                    type="number"
                    step="0.01"
                    value={cfg.bgImageOpacity}
                    onChange={(e) => setCfg({ ...cfg, bgImageOpacity: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.footer}>
        <button className={s.primary} onClick={save} type="button" disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {/* ✅ MODAL */}
      {cssOpen ? (
        <div className={s.modalBackdrop} onMouseDown={() => setCssOpen(false)} role="dialog" aria-modal="true">
          <div className={s.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <div>
                <div className={s.modalTitle}>Custom CSS</div>
                <div className={s.modalDesc}>Sadece PremiumMarquee alanında geçerli (scoped).</div>
              </div>

              <button className={s.close} type="button" onClick={() => setCssOpen(false)} aria-label="Kapat">
                ✕
              </button>
            </div>

            <textarea
              className={s.cssArea}
              value={cssDraft}
              onChange={(e) => setCssDraft(e.target.value)}
              placeholder={`/* örnek */
.px-marquee { filter: saturate(1.1); }
.px-marqueeItem { opacity: .95; }`}
            />

            <div className={s.modalActions}>
              <button className={s.ghost} type="button" onClick={() => setCssOpen(false)}>
                İptal
              </button>
              <button
                className={s.primary}
                type="button"
                onClick={() => {
                  setCfg({ ...cfg, customCss: cssDraft });
                  setCssOpen(false);
                }}
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export default function PremiumMarqueeEditorPage() {
  return (
    <PermissionGate permission="home_settings">
      <PremiumMarqueeEditorInner />
    </PermissionGate>
  );
}