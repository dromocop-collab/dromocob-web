"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./heroSlider.module.css";

type LocaleText = { tr?: string; en?: string };
type I18n = string | LocaleText;

type HeroTheme = "light" | "dark";
type HeroVariant = "classic" | "visual" | "split" | "editorial" | "immersive";

export type HeroSlide = {
  id?: string;
  title?: I18n;
  subtitle?: I18n;
  priceLabel?: I18n;
  priceText?: I18n;

  primaryLabel?: I18n;
  primaryUrl?: string;
  secondaryLabel?: I18n;
  secondaryUrl?: string;

  noteSmall?: I18n;
  noteLine1?: I18n;
  noteLine2?: I18n;

  image?: string;
  image2?: string;

  sideText?: I18n;
  badgeText?: I18n;
  eyebrow?: I18n;

  theme?: HeroTheme;
  variant?: HeroVariant;

  align?: "left" | "center" | "media";
  imageFit?: "cover" | "contain" | "auto";
  overlayStrength?: "soft" | "medium" | "strong";
};

export type PromoBanner = {
  id?: string;
  isActive?: boolean;
  order?: number;

  title?: I18n;
  subtitle?: I18n;
  startLabel?: I18n;
  priceText?: I18n;

  bullets?: { tr?: string[]; en?: string[] } | string[];

  primaryCta?: { label?: I18n; href?: string };
  secondaryCta?: { label?: I18n; href?: string };

  image?: { url?: string; alt?: I18n; badgeText?: I18n } | string;
  image2?: string;

  theme?: HeroTheme;
  variant?: HeroVariant;
  align?: "left" | "center" | "media";
  imageFit?: "cover" | "contain" | "auto";
  overlayStrength?: "soft" | "medium" | "strong";
  eyebrow?: I18n;
  subtitleText?: I18n;
};

function str(v: any) {
  return String(v ?? "").trim();
}

function pick(loc: Locale, v: any, fbTR = "", fbEN = ""): string {
  if (typeof v === "string") return str(v);
  const tr = str(v?.tr) || fbTR;
  const en = str(v?.en) || fbEN;
  return loc === "en" ? en : tr;
}

function safeUrl(u: any, fallback = "/shop") {
  const x = str(u);
  if (!x) return fallback;
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

function asArr<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function pickBulletArr(bullets: any, loc: "tr" | "en"): string[] {
  if (!bullets) return [];
  if (Array.isArray(bullets)) return bullets.map(str).filter(Boolean);

  if (typeof bullets === "object") {
    const arr = bullets?.[loc] ?? bullets?.tr ?? bullets?.en;
    if (Array.isArray(arr)) return arr.map(str).filter(Boolean);
  }
  return [];
}

function mapPromoToSlides(promos: PromoBanner[]): HeroSlide[] {
  const active = asArr<PromoBanner>(promos)
    .filter((x) => x && x.isActive !== false)
    .sort((a, b) => Number((a as any)?.order ?? 0) - Number((b as any)?.order ?? 0));

  return active.map((b, idx) => {
    const bulletsTR = pickBulletArr((b as any)?.bullets, "tr");
    const bulletsEN = pickBulletArr((b as any)?.bullets, "en");

    const img =
      typeof b?.image === "string"
        ? str(b.image)
        : str((b?.image as any)?.url);

    const badge =
      typeof b?.image === "string"
        ? undefined
        : (b?.image as any)?.badgeText;

    return {
      id: str(b?.id) || `promo_${idx + 1}`,
      title: b?.title,
      subtitle: (b as any)?.subtitleText || b?.subtitle,
      eyebrow: (b as any)?.eyebrow,
      priceLabel: b?.startLabel,
      priceText: b?.priceText,
      primaryLabel: b?.primaryCta?.label,
      primaryUrl: b?.primaryCta?.href,
      secondaryLabel: b?.secondaryCta?.label,
      secondaryUrl: b?.secondaryCta?.href,
      noteSmall: { tr: str(bulletsTR[0]), en: str(bulletsEN[0]) },
      noteLine1: { tr: str(bulletsTR[1]), en: str(bulletsEN[1]) },
      noteLine2: { tr: str(bulletsTR[2]), en: str(bulletsEN[2]) },
      image: img,
      image2: str((b as any)?.image2),
      sideText: badge,
      badgeText: badge,
      theme: b?.theme === "dark" ? "dark" : "light",
      variant: (b?.variant as HeroVariant) || "classic",
      align: (b?.align as "left" | "center" | "media") || "left",
      imageFit: (b?.imageFit as "cover" | "contain") || "cover",
      overlayStrength: (b?.overlayStrength as "soft" | "medium" | "strong") || "medium",
    };
  });
}

export default function HeroSlider({
  slides,
  promoBanners,
}: {
  slides?: HeroSlide[];
  promoBanners?: PromoBanner[];
}) {
  const [loc, setLoc] = useState<Locale>("tr");
  const [i, setI] = useState(0);
  const [anim, setAnim] = useState<"next" | "prev">("next");
  const [paused, setPaused] = useState(false);
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setLoc(((ce?.detail as Locale) || "tr") as Locale);
    };

    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  const data = useMemo<HeroSlide[]>(() => {
    const promoSlides = mapPromoToSlides(asArr<PromoBanner>(promoBanners));
    if (promoSlides.length) return promoSlides;

    const arr = asArr<HeroSlide>(slides).filter(Boolean);
    if (arr.length) return arr;

    return [];
  }, [slides, promoBanners]);

const total = data.length;

useEffect(() => {
  setI((prev) => {
    if (total <= 0) return 0;
    return prev >= total ? 0 : prev;
  });
}, [total]);

const slide = data[i] || data[0];

  function go(nextIndex: number, direction: "next" | "prev") {
    if (!total) return;
    setAnim(direction);
    setI(nextIndex);
  }

  function next() {
    if (!total) return;
    go((i + 1) % total, "next");
  }

  function prev() {
    if (!total) return;
    go((i - 1 + total) % total, "prev");
  }

const touch = useRef<{ x: number; y: number } | null>(null);

useEffect(() => {
  if (tRef.current) {
    clearInterval(tRef.current);
    tRef.current = null;
  }

  if (total <= 1 || paused) return;

  tRef.current = setInterval(() => {
    setAnim("next");
    setI((x) => (x + 1) % total);
  }, 6500);

  return () => {
    if (tRef.current) clearInterval(tRef.current);
    tRef.current = null;
  };
}, [total, paused]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) < 40) return;
    if (Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) next();
    else prev();
  }
if (!total || !slide) return null;
const title = pick(loc, slide?.title);
const subtitle = pick(loc, slide?.subtitle);
const eyebrow = pick(loc, slide?.eyebrow);

const priceLabel = pick(loc, slide?.priceLabel);
const priceText = pick(loc, slide?.priceText);

const primaryLabel = pick(loc, slide?.primaryLabel);
const primaryUrl = safeUrl(slide?.primaryUrl, "/shop");

const secondaryLabel = pick(loc, slide?.secondaryLabel);
const secondaryUrl = safeUrl(slide?.secondaryUrl, "/shop");

const noteSmall = pick(loc, slide?.noteSmall);
const noteLine1 = pick(loc, slide?.noteLine1);
const noteLine2 = pick(loc, slide?.noteLine2);

const sideText = pick(loc, slide?.sideText);

const img = str(slide?.image);
const img2 = str(slide?.image2);

const isDark = slide?.theme === "dark";
const variant = (slide?.variant || "classic") as HeroVariant;
const align = slide?.align || "left";

const imageFit = slide?.imageFit || "cover";
const overlayStrength = slide?.overlayStrength || "medium";

const hasHeading = !!(eyebrow || title || subtitle);
const hasPrice = !!(priceLabel || priceText);
const hasActions = !!(primaryLabel || secondaryLabel);
const hasNotes = !!(noteSmall || noteLine1 || noteLine2);
const showLeftMeta = total > 1 && variant !== "split" && align !== "media";
const hasLeftContent = hasHeading || hasPrice || hasActions || hasNotes || showLeftMeta;
const effectiveAlign =
  !hasLeftContent ? "media" : align;
  return (
   <section
 className={[
  s.wrap,
  isDark ? s.wrapDark : "",
  s[`variant_${variant}`],
  effectiveAlign === "center" ? s.alignCenter : "",
  effectiveAlign === "media" ? s.alignMedia : "",
  imageFit === "contain" ? s.fitContain : imageFit === "auto" ? s.fitAuto : s.fitCover,
  overlayStrength === "soft"
    ? s.overlaySoft
    : overlayStrength === "strong"
    ? s.overlayStrong
    : s.overlayMedium,
].join(" ")}
  onMouseEnter={() => setPaused(true)}
  onMouseLeave={() => setPaused(false)}
>
      <div
        className={s.container}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label="Hero slider"
      >
 {hasLeftContent ? (
  <div className={s.left}>
    <div
      className={`${s.copy} ${anim === "next" ? s.inNext : s.inPrev}`}
      key={`copy-${i}-${loc}`}
    >
      {eyebrow ? (
        <div className={s.kicker}>
          <span className={s.kickerLine} />
          <span>{eyebrow}</span>
        </div>
      ) : null}

      {title ? (
        <h1 className={s.title} style={{ whiteSpace: "pre-line" }}>
          {title}
        </h1>
      ) : null}

      {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}

      {priceLabel || priceText ? (
        <div className={s.priceBlock}>
          {priceLabel ? <div className={s.priceLabel}>{priceLabel}</div> : null}
          {priceText ? <div className={s.priceText}>{priceText}</div> : null}
        </div>
      ) : null}

      {primaryLabel || secondaryLabel ? (
        <div className={s.actions}>
          {primaryLabel ? (
            <Link className={s.primaryBtn} href={primaryUrl}>
              {primaryLabel}
            </Link>
          ) : null}

          {secondaryLabel ? (
            <Link className={s.secondaryBtn} href={secondaryUrl}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      {noteSmall || noteLine1 || noteLine2 ? (
        <div className={s.notes}>
          {noteSmall ? <div className={s.noteSmall}>{noteSmall}</div> : null}
          <div className={s.noteList}>
            {noteLine1 ? <div className={s.noteStrong}>{noteLine1}</div> : null}
            {noteLine2 ? <div className={s.noteStrong}>{noteLine2}</div> : null}
          </div>
        </div>
      ) : null}

     {showLeftMeta ? (
  <div className={s.bottomMeta}>
    <div className={s.dots} role="tablist" aria-label="Slides">
      {data.map((_, idx) => (
        <button
          key={String((data[idx] as any)?.id ?? idx)}
          className={`${s.dot} ${idx === i ? s.dotActive : ""}`}
          onClick={() => go(idx, idx > i ? "next" : "prev")}
          aria-label={`slide ${idx + 1}`}
          aria-selected={idx === i}
          role="tab"
          type="button"
        />
      ))}
    </div>

    <div className={s.counter}>
      <span>{String(i + 1).padStart(2, "0")}</span>
      <em>/</em>
      <span>{String(total).padStart(2, "0")}</span>
    </div>
  </div>
) : null}
    </div>
  </div>
) : null}

        <div className={`${s.right} ${!hasLeftContent ? s.rightFull : ""}`}>
 <div
  className={[
    s.frame,
    anim === "next" ? s.imgInNext : s.imgInPrev,
    !hasLeftContent ? s.frameUltra : "",
  ].join(" ")}
  key={`img-${i}`}
>
    <div className={s.visualGlow} />

    {variant === "visual" ? (
      <>
        {img ? (
          <img src={img} alt={title || "hero"} className={s.image} />
        ) : (
          <div className={s.imgPh} />
        )}
        <div className={s.imageShade} />
      </>
    ) : variant === "split" ? (
      <div className={s.splitMedia}>
        <div className={s.splitMain}>
          {img ? (
            <img src={img} alt={title || "hero"} className={s.image} />
          ) : (
            <div className={s.imgPh} />
          )}
        </div>

        <div className={s.splitSide}>
          {img2 ? (
            <img src={img2} alt={title || "hero"} className={s.imageSmall} />
          ) : (
            <div className={s.imgPhSmall} />
          )}
        </div>
      </div>
    ) : variant === "editorial" ? (
      <>
        {img ? (
          <img src={img} alt={title || "hero"} className={s.image} />
        ) : (
          <div className={s.imgPh} />
        )}

        <div className={s.editorialPanel}>
          <div className={s.editorialEyebrow}>{eyebrow}</div>
          <div className={s.editorialTitle}>{title}</div>
        </div>
      </>
    ) : variant === "immersive" ? (
      <>
        {img ? (
          <img src={img} alt={title || "hero"} className={s.image} />
        ) : (
          <div className={s.imgPh} />
        )}

        <div className={s.imageShade} />

        <div className={s.immersiveOverlay}>
          <div className={s.immersiveTitle}>{title}</div>
          {subtitle ? <div className={s.immersiveSub}>{subtitle}</div> : null}
        </div>
      </>
    ) : (
      <>
        {img ? (
          <img src={img} alt={title || "hero"} className={s.image} />
        ) : (
          <div className={s.imgPh} />
        )}
        <div className={s.imageShade} />
      </>
    )}

    {sideText ? (
      <div className={s.sideBadge}>
        <span>{sideText}</span>
      </div>
    ) : null}


    {total > 1 ? (
      <div className={s.navCluster}>
        <button className={s.prevBtn} onClick={prev} type="button" aria-label="Prev">
          ←
        </button>
        <button className={s.nextBtn} onClick={next} type="button" aria-label="Next">
          →
        </button>
      </div>
    ) : (
      <Link className={s.nextBtn} href={primaryUrl} aria-label="Go">
        →
      </Link>
    )}
  </div>
</div>
      </div>
    </section>
  );
}