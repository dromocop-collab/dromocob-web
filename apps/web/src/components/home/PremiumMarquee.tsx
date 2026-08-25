"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import s from "./premiumMarquee.module.css";
import { getLocale, type Locale } from "@/lib/i18n";

type LocaleText = { tr: string; en: string };

export type PremiumMarqueeItem = {
  id: string;
  text: LocaleText;
  href?: string;
  strong?: boolean;
};

export type PremiumMarqueeConfig = {
  enabled?: boolean;

  // ✅ Custom CSS (admin’den geliyor)
  customCssEnabled?: boolean;
  customCss?: string;

  items?: PremiumMarqueeItem[];

  heightPx?: number;
  radiusPx?: number;
  paddingX?: number;
  gapPx?: number;
  textSizePx?: number;
  fontWeight?: number;
  letterSpacingEm?: number;

  separator?: "dot" | "bullet" | "icon" | "none";
  dotSizePx?: number;

  speedPxPerSec?: number; // px/s
  direction?: "left" | "right";
  pauseOnHover?: boolean;

  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  accentColor?: string;

  edgeFade?: boolean;
  edgeFadePx?: number;
  edgeFadeColor?: string;

  iconUrl?: string;
  iconSizePx?: number;

  bgImageUrl?: string;
  bgImageOpacity?: number;
};

function L(loc: Locale, t?: LocaleText, fallback = "") {
  if (!t) return fallback;
  return loc === "en" ? (t.en || fallback) : (t.tr || fallback);
}

function safeHref(u?: string) {
  const x = String(u ?? "").trim();
  if (!x) return "";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

function safeId(x: any, fallback: string) {
  const v = String(x ?? "").trim();
  if (v) return v;
  // crypto.randomUUID bazı ortamlarda yok → fallback
  try {
    return crypto.randomUUID();
  } catch {
    return fallback;
  }
}

function clampNum(v: any, a: number, b: number, d: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.max(a, Math.min(b, n));
}

function defaultItems(): PremiumMarqueeItem[] {
  return [
    { id: "d1", text: { tr: "Sertifikalı ürün", en: "Certified products" } },
    { id: "d2", text: { tr: "Güvenli ödeme", en: "Secure payment" } },
    { id: "d3", text: { tr: "Aynı gün kargo", en: "Same-day shipping" } },
    { id: "d4", text: { tr: "İstanbul içi hızlı teslimat", en: "Fast delivery in Istanbul" } },
    { id: "d5", text: { tr: "Ücretsiz hediye paketi", en: "Free gift wrap" } },
    { id: "d6", text: { tr: "Kolay iade", en: "Easy returns" } },
  ];
}

/**
 * Admin’den gelen custom CSS’i bu component içinde “scoped” hale getirir.
 * Kullanım: `.pm` yazarsa bile sadece #pm-<id> altında çalışır.
 */
function scopeCss(css: string, scopeId: string) {
  const input = String(css || "").trim();
  if (!input) return "";

  // çok basit ama etkili bir “scope” yaklaşımı:
  // Her CSS rule başlangıcına `#scopeId ` ekler.
  // @keyframes gibi bloklara dokunmaz (basit koruma).
  const lines = input.split("\n");
  const out: string[] = [];
  let inKeyframes = false;

  for (const rawLine of lines) {
    const line = rawLine;

    const t = line.trim();
    if (t.startsWith("@keyframes")) inKeyframes = true;
    if (inKeyframes) {
      out.push(line);
      if (t.endsWith("}")) inKeyframes = false;
      continue;
    }

    // @media, @supports gibi wrapper’larda selector satırlarını scope’lamak zor.
    // Yine de hızlı güvenli yaklaşım: wrapper satırlarını aynen geç.
    if (t.startsWith("@media") || t.startsWith("@supports") || t.startsWith("@layer")) {
      out.push(line);
      continue;
    }

    // selector satırları için kaba “scope”:
    // ör: `.a, .b {` -> `#id .a, #id .b {`
    if (line.includes("{")) {
      const idx = line.indexOf("{");
      const sel = line.slice(0, idx).trim();
      const rest = line.slice(idx);

      // boş veya yorum satırı
      if (!sel || sel.startsWith("/*")) {
        out.push(line);
        continue;
      }

      
      const scopedSel = sel
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `#${scopeId} ${p}`)
        .join(", ");

      out.push(`${scopedSel} ${rest}`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

export default function PremiumMarquee({ config }: { config?: PremiumMarqueeConfig }) {
  const [loc, setLoc] = useState<Locale>("tr");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // anim duration (s)
  const [duration, setDuration] = useState<number>(18);

  // stable scope id
  const reactId = useId();
  const scopeId = useMemo(() => `pm_${reactId.replace(/[:]/g, "_")}`, [reactId]);

  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => setLoc(((e as CustomEvent)?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  const c = useMemo(() => {
    const x = config || {};

    const enabled = x.enabled ?? true;

    const itemsRaw = (x.items?.filter(Boolean) || []).length ? (x.items as PremiumMarqueeItem[]) : defaultItems();

    // numeric clamp
    const heightPx = clampNum(x.heightPx, 28, 88, 44);
    const radiusPx = clampNum(x.radiusPx, 0, 40, 14);
    const paddingX = clampNum(x.paddingX, 0, 60, 18);
    const gapPx = clampNum(x.gapPx, 6, 60, 18);
    const textSizePx = clampNum(x.textSizePx, 10, 22, 14);
    const fontWeight = clampNum(x.fontWeight, 400, 950, 750);
    const letterSpacingEm = clampNum(x.letterSpacingEm, -0.08, 0.08, -0.01);

    const separator = x.separator ?? "dot";
    const dotSizePx = clampNum(x.dotSizePx, 2, 14, 6);

    const speedPxPerSec = Math.max(30, Number(x.speedPxPerSec ?? 90));
    const direction = x.direction ?? "left";
    const pauseOnHover = x.pauseOnHover ?? true;

    const bgColor = x.bgColor ?? "rgba(255,255,255,0.86)";
    const textColor = x.textColor ?? "rgba(0,0,0,0.82)";
    const borderColor = x.borderColor ?? "rgba(0,0,0,0.08)";
    const accentColor = x.accentColor ?? "rgba(0,0,0,0.35)";

    const edgeFade = x.edgeFade ?? true;
    const edgeFadePx = clampNum(x.edgeFadePx, 0, 80, 28);
    const edgeFadeColor = x.edgeFadeColor ?? "rgba(255,255,255,1)";

    const iconUrl = String(x.iconUrl ?? "").trim();
    const iconSizePx = clampNum(x.iconSizePx, 10, 30, 16);

    const bgImageUrl = String(x.bgImageUrl ?? "").trim();
    const bgImageOpacity = clampNum(x.bgImageOpacity, 0, 0.6, 0.10);

    const customCssEnabled = !!x.customCssEnabled;
    const customCss = String(x.customCss ?? "").slice(0, 20000);

    return {
      enabled,
      items: itemsRaw,
      heightPx,
      radiusPx,
      paddingX,
      gapPx,
      textSizePx,
      fontWeight,
      letterSpacingEm,
      separator,
      dotSizePx,
      speedPxPerSec,
      direction,
      pauseOnHover,
      bgColor,
      textColor,
      borderColor,
      accentColor,
      edgeFade,
      edgeFadePx,
      edgeFadeColor,
      iconUrl,
      iconSizePx,
      bgImageUrl,
      bgImageOpacity,
      customCssEnabled,
      customCss,
    };
  }, [config]);

  const items = useMemo(() => {
    const base = (c.items || [])
      .map((it, i) => ({
        ...it,
        id: safeId(it?.id, `pm_item_${i}`),
        href: safeHref(it?.href),
      }))
      .filter((it) => L(loc, it.text).trim().length > 0);

    return base;
  }, [c.items, loc]);

  // sonsuz loop için 2x (en az 2 item yoksa loop çok çirkin olur)
  const doubled = useMemo(() => {
    if (items.length <= 1) return items;
    return [...items, ...items];
  }, [items]);

  // track width ölç → duration hesapla (px/s)
  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    let raf = 0;

    const calc = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track.scrollWidth || 1;
        const dur = Math.max(8, w / Math.max(30, c.speedPxPerSec));
        setDuration(dur);
      });
    };

    calc();

    const ro = new ResizeObserver(calc);
    ro.observe(wrap);
    ro.observe(track);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [c.speedPxPerSec, doubled.length]);

const cssVars = useMemo<React.CSSProperties & Record<string, any>>(() => {
  return {
    "--pm-h": `${c.heightPx}px`,
    "--pm-r": `${c.radiusPx}px`,
    "--pm-px": `${c.paddingX}px`,
    "--pm-gap": `${c.gapPx}px`,
    "--pm-fs": `${c.textSizePx}px`,
    "--pm-fw": `${c.fontWeight}`,
    "--pm-ls": `${c.letterSpacingEm}em`,
    "--pm-bg": c.bgColor,
    "--pm-tx": c.textColor,
    "--pm-br": c.borderColor,
    "--pm-ac": c.accentColor,
    "--pm-edge": `${c.edgeFadePx}px`,
    "--pm-edgeColor": c.edgeFadeColor,
    "--pm-dot": `${c.dotSizePx}px`,
    "--pm-icon": `${c.iconSizePx}px`,
    "--pm-dur": `${duration}s`,
    "--pm-dir": c.direction === "right" ? "reverse" : "normal",
    "--pm-bgimg": c.bgImageUrl ? `url(${c.bgImageUrl})` : "none",
    "--pm-bgimgOp": `${Math.min(0.6, Math.max(0, c.bgImageOpacity))}`,
  };
}, [
  c.heightPx,
  c.radiusPx,
  c.paddingX,
  c.gapPx,
  c.textSizePx,
  c.fontWeight,
  c.letterSpacingEm,
  c.bgColor,
  c.textColor,
  c.borderColor,
  c.accentColor,
  c.edgeFadePx,
  c.edgeFadeColor,
  c.dotSizePx,
  c.iconSizePx,
  duration,
  c.direction,
  c.bgImageUrl,
  c.bgImageOpacity,
]);

const scopedCss = useMemo(() => {
  if (!c.customCssEnabled) return "";
  return scopeCss(c.customCss || "", scopeId);
}, [c.customCssEnabled, c.customCss, scopeId]);

if (!c.enabled || items.length === 0) return null;

  return (
    <div
      id={scopeId}
      className={`${s.wrap} ${c.pauseOnHover ? s.pauseOnHover : ""}`}
      style={cssVars}
      ref={wrapRef}
      aria-label="Premium marquee"
    >
      {/* ✅ scoped custom css */}
      {scopedCss ? <style dangerouslySetInnerHTML={{ __html: scopedCss }} /> : null}

      {c.edgeFade ? <div className={s.edge} aria-hidden="true" /> : null}

      <div className={s.inner}>
      <div className={s.track} ref={trackRef} aria-hidden="true">
  <div className={s.group}>
    {items.map((it, idx) => {
      const label = L(loc, it.text);
      const strong = !!it.strong;

      const sep =
        c.separator === "none" ? null : c.separator === "bullet" ? (
          <span className={s.bullet} aria-hidden="true">•</span>
        ) : c.separator === "icon" ? (
          <span className={s.icon} aria-hidden="true">
            {c.iconUrl ? <img src={c.iconUrl} alt="" /> : <span className={s.dot} />}
          </span>
        ) : (
          <span className={s.dot} aria-hidden="true" />
        );

      const content = <span className={`${s.text} ${strong ? s.strong : ""}`}>{label}</span>;

      return (
        <div className={s.item} key={`${it.id}_a_${idx}`}>
          {sep}
          {it.href ? (
            <Link className={s.link} href={it.href} prefetch={false}>
              {content}
            </Link>
          ) : (
            content
          )}
        </div>
      );
    })}
  </div>

  <div className={s.group} aria-hidden="true">
    {items.map((it, idx) => {
      const label = L(loc, it.text);
      const strong = !!it.strong;

      const sep =
        c.separator === "none" ? null : c.separator === "bullet" ? (
          <span className={s.bullet} aria-hidden="true">•</span>
        ) : c.separator === "icon" ? (
          <span className={s.icon} aria-hidden="true">
            {c.iconUrl ? <img src={c.iconUrl} alt="" /> : <span className={s.dot} />}
          </span>
        ) : (
          <span className={s.dot} aria-hidden="true" />
        );

      const content = <span className={`${s.text} ${strong ? s.strong : ""}`}>{label}</span>;

      return (
        <div className={s.item} key={`${it.id}_b_${idx}`}>
          {sep}
          {it.href ? (
            <Link className={s.link} href={it.href} prefetch={false}>
              {content}
            </Link>
          ) : (
            content
          )}
        </div>
      );
    })}
  </div>
</div>
    </div>
    </div>
  );
}