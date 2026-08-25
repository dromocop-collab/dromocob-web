"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Gem, Quote, ShieldCheck, Sparkles } from "lucide-react";
import s from "./customerTestimonials.module.css";

type TestimonialItem = {
  name?: string;
  city?: string;
  text?: string;
  rating?: number;
  avatar?: string;
  product?: string;
  verified?: boolean;
  source?: "google" | "site";
  relativeTime?: string;
};

type TestimonialsConfig = {
  enabled?: boolean;
  title?: { tr?: string; en?: string } | string;
  subtitle?: { tr?: string; en?: string } | string;
  items?: TestimonialItem[];
};

function pickT(v: any, loc: string, fallback = "") {
  if (!v) return fallback;
  if (typeof v === "string") return v.trim() || fallback;
  return String(loc === "en" ? v?.en || v?.tr || fallback : v?.tr || v?.en || fallback).trim();
}

function ratingOf(item: TestimonialItem) {
  return Math.min(5, Math.max(1, Number(item.rating) || 5));
}

function Stars({ count, label }: { count: number; label: string }) {
  return (
    <div className={s.stars} aria-label={`${count} ${label}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < count ? s.starFull : s.starEmpty} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

function GoogleMark() {
  return <span className={s.googleMark} aria-label="Google"><i>G</i><b>Google</b></span>;
}

export default function CustomerTestimonials({ loc = "tr", cfg }: { loc?: string; cfg?: TestimonialsConfig | null }) {
  const fallbackItems = useMemo(
    () => (Array.isArray(cfg?.items) ? cfg.items : []).filter((item) => item?.text?.trim()),
    [cfg]
  );
  const [google, setGoogle] = useState<{ items: TestimonialItem[]; rating: number; userRatingCount: number; googleMapsUri?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/google-reviews", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (alive && Array.isArray(data?.items) && data.items.length) setGoogle({ items: data.items, rating: Number(data.rating || 0), userRatingCount: Number(data.userRatingCount || 0), googleMapsUri: data.googleMapsUri || "" });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const items = google?.items?.length ? google.items : fallbackItems;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [active, items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % items.length), 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (cfg?.enabled === false || !items.length) return null;

  const current = items[active];
  const average = google?.rating || items.reduce((sum, item) => sum + ratingOf(item), 0) / items.length;
  const fiveStarRate = Math.round((items.filter((item) => ratingOf(item) === 5).length / items.length) * 100);
  const title = pickT(cfg?.title, loc, loc === "en" ? "lifestyle chosen with confidence" : "Güvenle seçilen özel ürünler");
  const subtitle = pickT(cfg?.subtitle, loc, loc === "en" ? "Genuine experiences shared by our customers." : "Müşterilerimizin paylaştığı gerçek alışveriş deneyimleri.");
  const previous = () => setActive((active - 1 + items.length) % items.length);
  const next = () => setActive((active + 1) % items.length);

  return (
    <section className={s.section} aria-labelledby="customer-testimonials-title">
      <div className={s.ambientOne} /><div className={s.ambientTwo} />
      <div className={s.inner}>
        <header className={s.head}>
          <div className={s.headingCopy}>
            <span className={s.kicker}><Sparkles size={13} />{loc === "en" ? "Customer Stories" : "Müşteri Hikâyeleri"}</span>
            <h2 id="customer-testimonials-title" className={s.h2}>{title}</h2>
            <p className={s.sub}>{subtitle}</p>
          </div>

          <div className={s.scoreCard}>
            <strong>{average.toFixed(1)}</strong>
            <div><Stars count={Math.round(average)} label={loc === "en" ? "stars" : "yıldız"} /><span>{google ? `${google.userRatingCount} Google yorumu` : `${items.length} ${loc === "en" ? "featured reviews" : "öne çıkan yorum"}`}</span></div>
          </div>
        </header>

        <div className={s.stage}>
          <article className={s.featureCard} aria-live="polite">
            <div className={s.cardGlow} />
            <div className={s.featureTop}>
              <span className={s.quoteMark}><Quote size={26} fill="currentColor" /></span>
              <Stars count={ratingOf(current)} label={loc === "en" ? "stars" : "yıldız"} />
            </div>

            <blockquote className={s.quoteText}>“{current.text}”</blockquote>

            <footer className={s.authorRow}>
              <div className={s.avatar}>
                {current.avatar ? <img src={current.avatar} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<span>{(current.name || "M").slice(0, 1).toUpperCase()}</span>
              </div>
              <div className={s.authorInfo}>
                <strong>{current.name || (loc === "en" ? "Our customer" : "Müşterimiz")}</strong>
                <span>{current.source === "google" ? `Google yorumu${current.relativeTime ? ` · ${current.relativeTime}` : ""}` : [current.city, current.product].filter(Boolean).join(" · ")}</span>
              </div>
              {current.source === "google" ? <GoogleMark /> : current.verified ? (
                <span className={s.verified}><BadgeCheck size={16} />{loc === "en" ? "Verified purchase" : "Doğrulanmış alışveriş"}</span>
              ) : null}
            </footer>

            {items.length > 1 ? (
              <div className={s.controls}>
                <button type="button" onClick={previous} aria-label={loc === "en" ? "Previous review" : "Önceki yorum"}><ChevronLeft /></button>
                <span><b>{String(active + 1).padStart(2, "0")}</b> / {String(items.length).padStart(2, "0")}</span>
                <button type="button" onClick={next} aria-label={loc === "en" ? "Next review" : "Sonraki yorum"}><ChevronRight /></button>
              </div>
            ) : null}
          </article>

          <aside className={s.sidePanel} aria-label={loc === "en" ? "Review highlights" : "Yorum özeti"}>
            <div className={s.metric}>
              <span className={s.metricIcon}><Gem size={21} /></span>
              <div><strong>%{fiveStarRate}</strong><span>{loc === "en" ? "five-star experience" : "5 yıldızlı deneyim"}</span></div>
            </div>
            <div className={s.metric}>
              <span className={s.metricIcon}><ShieldCheck size={21} /></span>
              <div><strong>{loc === "en" ? "Secure" : "Güvenli"}</strong><span>{loc === "en" ? "certified shopping" : "sertifikalı alışveriş"}</span></div>
            </div>

            {items.length > 1 ? (
              <div className={s.reviewNav}>
                {items.slice(0, 5).map((item, index) => (
                  <button key={`${item.name}-${index}`} type="button" className={index === active ? s.reviewNavActive : ""} onClick={() => setActive(index)}>
                    <span>{item.avatar ? <img src={item.avatar} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<i>{(item.name || "M").slice(0, 1).toUpperCase()}</i></span>
                    <div><strong>{item.name || (loc === "en" ? "Customer" : "Müşteri")}</strong><small>{item.source === "google" ? item.relativeTime || "Google yorumu" : item.product || item.city || (loc === "en" ? "Shopping experience" : "Alışveriş deneyimi")}</small></div>
                    <b><span>★</span>{ratingOf(item).toFixed(1)}</b>
                  </button>
                ))}
              </div>
            ) : null}
            {google?.googleMapsUri ? <a className={s.googleLink} href={google.googleMapsUri} target="_blank" rel="noopener noreferrer"><GoogleMark /><span>Tüm yorumları Google&apos;da gör</span><ExternalLink /></a> : null}
          </aside>
        </div>

        <div className={s.promiseBar}>
          <span><ShieldCheck size={17} />{loc === "en" ? "Secure payment" : "Güvenli ödeme"}</span>
          <span><Gem size={17} />{loc === "en" ? "Certified lifestyle" : "Sertifikalı özel ürün"}</span>
          <span><BadgeCheck size={17} />{loc === "en" ? "Customer-first support" : "Müşteri odaklı destek"}</span>
        </div>
      </div>
    </section>
  );
}
