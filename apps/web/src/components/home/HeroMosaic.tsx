"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./heroMosaic.module.css";

type LocaleText = { tr: string; en: string };

export type HeroSlide = {
  id: string;
  imageUrl: string;
  title: LocaleText;
  subtitle?: LocaleText;
  cta?: LocaleText;
  href?: string;
};

type HomeSettingsDoc = { heroSlides?: HeroSlide[] };

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

function normalizeSlides(raw: any): HeroSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({
      id: String(x?.id || crypto.randomUUID()),
      imageUrl: String(x?.imageUrl || "").trim(),
      title: { tr: String(x?.title?.tr || "").trim(), en: String(x?.title?.en || "").trim() },
      subtitle: x?.subtitle
        ? { tr: String(x.subtitle.tr || "").trim(), en: String(x.subtitle.en || "").trim() }
        : undefined,
      cta: x?.cta ? { tr: String(x.cta.tr || "").trim(), en: String(x.cta.en || "").trim() } : undefined,
      href: String(x?.href || "").trim(),
    }))
    .filter((x) => x.imageUrl && (x.title.tr || x.title.en));
}

export default function HeroMosaic() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [loc, setLoc] = useState<Locale>("tr");
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<number | null>(null);
const railRef = useRef<HTMLDivElement | null>(null);
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

  // firestore listen
  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as HomeSettingsDoc) || {};
        const list = normalizeSlides(data.heroSlides);
        setSlides(list);
        setActive((a) => (list.length ? Math.min(a, list.length - 1) : 0));
      },
      () => setSlides([])
    );
  }, [db]);

  // auto-advance
  useEffect(() => {
    if (!slides.length) return;

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (hovering) return;
      setActive((a) => (a + 1) % slides.length);
    }, 4200);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [slides.length, hovering]);
useEffect(() => {
  const el = railRef.current;
  if (!el) return;

  if (window.innerWidth > 980) return;

  const card = el.children[active] as HTMLElement | undefined;
  if (!card) return;

  el.scrollTo({
    left: card.offsetLeft,
    behavior: "smooth",
  });
}, [active]);
  if (!slides.length) {
    return (
      <div style={{ padding: 16, opacity: 0.7 }}>
        HeroMosaic: heroSlides boş geliyor. (site_options/home_settings)
      </div>
    );
  }

  return (
    <section
  className={s.wrap}
  onMouseEnter={() => setHovering(true)}
  onMouseLeave={() => setHovering(false)}
>
  <div className={s.inner}>
    <div className={s.indicators} aria-label={loc === "en" ? "Slides" : "Slaytlar"}>
      {slides.map((it, i) => (
        <button
          key={it.id}
          type="button"
          className={`${s.dot} ${i === active ? s.dotActive : ""}`}
          onClick={() => setActive(i)}
          aria-label={`${loc === "en" ? "Slide" : "Slayt"} ${i + 1}`}
          aria-pressed={i === active}
        />
      ))}
    </div>

   <div ref={railRef} className={s.rail}>
      {slides.map((it, i) => {
        const isActive = i === active;
        const href = safeHref(it.href);
        const title = L(loc, it.title);
        const subtitle = L(loc, it.subtitle, "");
        const cta = L(loc, it.cta, loc === "en" ? "Learn more" : "Detaylı Bilgi");

        return (
          <article
            key={it.id}
            className={`${s.card} ${isActive ? s.active : ""}`}
            style={{ ["--bg" as any]: `url(${it.imageUrl})` }}
            onPointerDown={() => setActive(i)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActive(i);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={title}
            aria-pressed={isActive}
          >
            <div className={s.bg} />
            <div className={s.shade} />

            <div className={s.content}>
  {isActive ? (
    <div className={s.copy}>
      <h3 className={s.h3}>{title}</h3>
      {subtitle ? <p className={s.p}>{subtitle}</p> : null}

      {href !== "#" ? (
        <Link className={s.cta} href={href} onClick={(e) => e.stopPropagation()}>
          {cta} <span className={s.arrow}>→</span>
        </Link>
      ) : (
        <div className={s.ctaGhost}>
          {cta} <span className={s.arrow}>→</span>
        </div>
      )}
    </div>
  ) : null}
</div>
          </article>
        );
      })}
    </div>

    <div className={s.controls}>
      <button
        type="button"
        className={s.ctrlBtn}
        aria-label={loc === "en" ? "Previous slide" : "Önceki görsel"}
        onClick={() => setActive((a) => (a - 1 + slides.length) % slides.length)}
      >
        ←
      </button>

      <button
        type="button"
        className={s.ctrlBtn}
        aria-label={loc === "en" ? "Next slide" : "Sonraki görsel"}
        onClick={() => setActive((a) => (a + 1) % slides.length)}
      >
        →
      </button>
    </div>
  </div>
</section>
  );
}