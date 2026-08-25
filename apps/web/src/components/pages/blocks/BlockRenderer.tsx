"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import s from "./blocks.module.css";

function LT(v: any, loc: "tr" | "en") {
  if (!v) return "";
  if (typeof v === "string") return v;
  const tr = String(v?.tr ?? "").trim();
  const en = String(v?.en ?? "").trim();
  return loc === "en" ? en || tr : tr || en;
}

function safeHref(h: any) {
  const x = String(h ?? "").trim();
  if (!x) return "";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

/** mini-sanitize: script/style + inline on* + javascript: */
function safeHtml(html: string) {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\son\w+='[^']*'/gi, "");
  out = out.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
  out = out.replace(/src\s*=\s*["']\s*javascript:[^"']*["']/gi, 'src=""');
  return out;
}

export default function BlockRenderer({ blocks, loc }: { blocks: any[]; loc: "tr" | "en" }) {
  const list = useMemo(
    () => (Array.isArray(blocks) ? blocks : []).filter((b) => b && b.isActive !== false),
    [blocks]
  );

  return (
    <div className={s.stack}>
      {list.map((b, idx) => {
        const key = String(b?.id || `${b?.type || "block"}-${idx}`);
        const type = String(b?.type || "");

        switch (type) {
          case "heading": {
            const align = b?.align === "center" ? s.center : b?.align === "right" ? s.right : "";
            const title = LT(b?.title, loc);
            const sub = LT(b?.subtitle, loc);
            if (!title && !sub) return null;

            return (
              <section key={key} className={s.block}>
                <div className={s.container}>
                  <div className={`${s.heading} ${align}`}>
                    {title ? <h2 className={s.hTitle}>{title}</h2> : null}
                    {sub ? <p className={s.hSub}>{sub}</p> : null}
                  </div>
                </div>
              </section>
            );
          }

          case "richText": {
            const html = safeHtml(LT(b?.html, loc));
            if (!html.trim()) return null;

            return (
              <section key={key} className={s.block}>
                <div className={s.container}>
                  <div className={s.rich} dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              </section>
            );
          }

          case "image": {
            const href = safeHref(b?.link);
            const alt = LT(b?.alt, loc) || "";
            const img = String(b?.src || "").trim();
            if (!img) return null;

            const Img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={s.mediaImg} src={img} alt={alt || "image"} loading="lazy" decoding="async" />
            );

            return (
              <section key={key} className={s.block}>
                <div className={s.container}>
                  <div className={s.mediaCard}>
                    {href ? (
                      <Link href={href} className={s.mediaLink}>
                        {Img}
                      </Link>
                    ) : (
                      Img
                    )}
                  </div>
                </div>
              </section>
            );
          }

          case "cards": {
            const cols = Math.min(4, Math.max(1, Number(b?.columns || 3)));
            const items = Array.isArray(b?.items) ? b.items : [];
            if (!items.length) return null;

            return (
              <section key={key} className={s.block}>
                <div className={s.container}>
                  <div className={s.cardsGrid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {items.map((it: any, i: number) => {
                      const t = LT(it?.title, loc);
                      const d = LT(it?.desc, loc);
                      if (!t && !d) return null;

                      return (
                        <div key={`${key}-i-${i}`} className={s.card}>
                          {t ? <div className={s.cardT}>{t}</div> : null}
                          {d ? <div className={s.cardD}>{d}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }

          case "slider": {
            const slides = Array.isArray(b?.slides) ? b.slides.filter((x: any) => x && x.isActive !== false) : [];
            if (!slides.length) return null;

            return (
              <section key={key} className={s.block}>
                <div className={s.container}>
                  <HeroSlider slides={slides} loc={loc} />
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}

/* ---------------- Slider (smooth + resize safe) ---------------- */

function HeroSlider({ slides, loc }: { slides: any[]; loc: "tr" | "en" }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);

  const go = (n: number) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, n));
    setIdx(next);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  // resize -> aktif slide’da kal
  useEffect(() => {
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ left: idx * el.clientWidth, behavior: "auto" as any });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [idx]);

  return (
    <div className={s.slider}>
      <div className={s.sliderTop}>
        <div className={s.dots}>
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              className={`${s.dot} ${i === idx ? s.dotOn : ""}`}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <div className={s.navBtns}>
          <button className={s.navBtn} type="button" onClick={() => go(idx - 1)} aria-label="Prev">
            ‹
          </button>
          <button className={s.navBtn} type="button" onClick={() => go(idx + 1)} aria-label="Next">
            ›
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className={s.track}
        onScroll={() => {
          const el = ref.current;
          if (!el) return;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== idx) setIdx(i);
        }}
      >
        {slides.map((sl: any, i: number) => {
          const img = String(sl?.image || "").trim();
          const title = LT(sl?.title, loc);
          const sub = LT(sl?.subtitle, loc);
          const ctaLabel = LT(sl?.cta?.label, loc);
          const href = safeHref(sl?.cta?.href);

          return (
            <div key={i} className={s.slide}>
              <div className={s.slideMedia}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={title || "slide"} className={s.slideImg} />
                ) : (
                  <div className={s.slidePh} />
                )}
                <div className={s.slideShade} />
              </div>

              <div className={s.slideBody}>
                {sub ? <div className={s.slideSub}>{sub}</div> : null}
                {title ? <div className={s.slideTitle}>{title}</div> : null}

                {href && ctaLabel ? (
                  <Link href={href} className={s.slideBtn}>
                    {ctaLabel} →
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}