"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./promoDealSlider.module.css";
import { getLocale, type Locale } from "@/lib/i18n";

type LocaleText = { tr: string; en: string };

export type PromoDealSlide = {
  id: string;
  imageUrl: string;
  title: LocaleText;
  subtitle?: LocaleText;
  priceBig?: LocaleText;
  badge?: LocaleText;
  href?: string;
  thumbUrl?: string;
};

function L(loc: Locale, t?: LocaleText, fallback = "") {
  if (!t) return fallback;
  return loc === "en" ? (t.en || fallback) : (t.tr || fallback);
}

function safeHref(u: any) {
  const x = String(u ?? "").trim();
  if (!x) return "#";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

function normalizeSlides(raw: any): PromoDealSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) => ({
      id: String(x?.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)),
      imageUrl: String(x?.imageUrl || "").trim(),
      thumbUrl: String(x?.thumbUrl || "").trim(),
      title: { tr: String(x?.title?.tr || "").trim(), en: String(x?.title?.en || "").trim() },
      subtitle: x?.subtitle
        ? { tr: String(x.subtitle.tr || "").trim(), en: String(x.subtitle.en || "").trim() }
        : undefined,
      priceBig: x?.priceBig
        ? { tr: String(x.priceBig.tr || "").trim(), en: String(x.priceBig.en || "").trim() }
        : undefined,
      badge: x?.badge ? { tr: String(x.badge.tr || "").trim(), en: String(x.badge.en || "").trim() } : undefined,
      href: String(x?.href || "").trim(),
    }))
    .filter((x: PromoDealSlide) => x.imageUrl && (x.title?.tr || x.title?.en));
}

/** ✅ active slide’a göre thumb penceresi */
function getThumbWindow(total: number, active: number, size = 6) {
  if (total <= size) return { start: 0, end: total };
  const half = Math.floor(size / 2);
  let start = active - half;
  start = Math.max(0, Math.min(start, total - size));
  return { start, end: start + size };
}

export default function PromoDealSlider({
  slides: slidesProp,
  autoplayMs = 5200,
}: {
  slides?: PromoDealSlide[];
  autoplayMs?: number;
}) {
  const [loc, setLoc] = useState<Locale>("tr");
  const [slides, setSlides] = useState<PromoDealSlide[]>(() => normalizeSlides(slidesProp));
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  // locale listen
  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setLoc(((ce?.detail as Locale) || "tr") as Locale);
    };
    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  // props -> state
  useEffect(() => {
    const list = normalizeSlides(slidesProp);
    setSlides(list);
    setActive((a) => (list.length ? Math.min(a, list.length - 1) : 0));
    setProgressKey((k) => k + 1);
  }, [slidesProp]);

  // autoplay
  useEffect(() => {
    if (!slides.length) return;

    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      if (paused) return;
      setActive((a) => {
        const n = (a + 1) % slides.length;
        return n;
      });
      setProgressKey((k) => k + 1);
    }, Math.max(2200, autoplayMs));

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [slides.length, paused, autoplayMs]);

  const go = (i: number) => {
    if (!slides.length) return;
    const n = ((i % slides.length) + slides.length) % slides.length;
    setActive(n);
    setProgressKey((k) => k + 1);
  };

  const next = () => go(active + 1);
  const prev = () => go(active - 1);

  // swipe
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchX.current = t.clientX;
    touchY.current = t.clientY;
    setPaused(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchX.current;
    const sy = touchY.current;
    touchX.current = null;
    touchY.current = null;

    const t = e.changedTouches?.[0];
    if (!t || sx == null || sy == null) {
      setPaused(false);
      return;
    }

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) next();
      else prev();
    }
    setPaused(false);
  };

    // ✅ thumb slice - Hook return null'dan önce çalışmalı
  const thumbWindow = useMemo(() => {
    return getThumbWindow(slides.length, active, 6);
  }, [slides.length, active]);

  const thumbSlice = useMemo(() => {
    return slides.slice(thumbWindow.start, thumbWindow.end);
  }, [slides, thumbWindow.start, thumbWindow.end]);

  const cur = slides[active];

  if (!cur) return null;

  const href = safeHref(cur.href);
  const title = L(loc, cur.title);
  const subtitle = L(loc, cur.subtitle, "");
  const badge = L(loc, cur.badge, loc === "en" ? "Limited" : "Özel");
  const priceBig = L(loc, cur.priceBig, "");

  const dur = Math.max(2200, autoplayMs);

  return (
   <section
  className={s.wrap}
  onMouseEnter={() => setPaused(true)}
  onMouseLeave={() => setPaused(false)}
  onTouchStart={onTouchStart}
  onTouchEnd={onTouchEnd}
>
  <div className={s.inner}>
    <div className={s.shell}>
      <div className={s.stage} style={{ ["--bg" as any]: `url(${cur.imageUrl})` }}>
        <div className={s.bg} />
        <div className={s.vignette} />

        <div className={s.overlay}>
          <div className={s.topRow}>
            <span className={s.badge}>
              <span className={s.badgeDot} />
              {badge}
            </span>

            <div className={s.controls}>
              <button
                className={s.navBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  prev();
                }}
                type="button"
                aria-label={loc === "en" ? "Previous" : "Geri"}
              >
                ‹
              </button>
              <button
                className={s.navBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  next();
                }}
                type="button"
                aria-label={loc === "en" ? "Next" : "İleri"}
              >
                ›
              </button>
            </div>
          </div>

          <div className={s.textBlock}>
            <div className={s.h1}>{title}</div>
            {subtitle ? <div className={s.sub}>{subtitle}</div> : null}

            {priceBig ? (
              <div className={s.priceRow}>
                <div className={s.price}>{priceBig}</div>
              </div>
            ) : null}

            {href !== "#" ? (
              <Link className={s.cta} href={href} onClick={(e) => e.stopPropagation()}>
                {loc === "en" ? "View details" : "Detaylı Bilgi"} <span className={s.arr}>→</span>
              </Link>
            ) : (
              <div className={s.ctaGhost}>
                {loc === "en" ? "View details" : "Detaylı Bilgi"} <span className={s.arr}>→</span>
              </div>
            )}
          </div>

          <div className={s.bottomUi}>
            <div className={s.dots} aria-label={loc === "en" ? "Slider dots" : "Slider noktaları"}>
              {slides.map((it, i) => (
                <button
                  key={it.id}
                  className={`${s.dot} ${i === active ? s.dotActive : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    go(i);
                  }}
                  type="button"
                  aria-label={(loc === "en" ? "Go to slide " : "Slayta git: ") + (i + 1)}
                />
              ))}
            </div>

            <div className={s.thumbs} aria-label={loc === "en" ? "Thumbnails" : "Küçük görseller"}>
              {thumbSlice.map((it, i) => {
                const realIdx = thumbWindow.start + i;
                const isOn = realIdx === active;
                const tUrl = (it.thumbUrl || "").trim() || (it.imageUrl || "").trim();

                return (
                  <button
                    key={it.id}
                    className={`${s.thumb} ${isOn ? s.thumbOn : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      go(realIdx);
                    }}
                    type="button"
                    aria-label={L(loc, it.title)}
                    style={{ ["--tbg" as any]: `url(${tUrl})` }}
                  >
                    <span className={s.thumbBg} />
                    <span className={s.thumbShade} />
                    {isOn ? (
                      <span
                        key={progressKey}
                        className={s.thumbProg}
                        style={{ ["--dur" as any]: `${dur}ms` }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {href !== "#" ? <Link className={s.hit} href={href} aria-label={title} /> : null}
      </div>
    </div>
  </div>
</section>
  );
}