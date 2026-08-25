"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./premiumTrustStrip.module.css";

type LocaleText = { tr: string; en: string };

export type TrustCard = {
  id: string;
  title: LocaleText;
  desc?: LocaleText;
  icon?: "shield" | "truck" | "cert" | "return" | "gift" | "spark";
  href?: string;
};

type HomeSettingsDoc = {
  premiumTrustStrip?: {
    isActive?: boolean;
    eyebrow?: LocaleText;
    title?: LocaleText;
    subtitle?: LocaleText;
    ctaText?: LocaleText;
    ctaHref?: string;
    cards?: TrustCard[];
    stats?: Array<{ label: LocaleText; value: string }>;
  };
};

function L(loc: Locale, t?: LocaleText, fallback = "") {
  if (!t) return fallback;
  const v = loc === "en" ? t.en : t.tr;
  return (v || fallback || "").trim();
}

function safeHref(u: any) {
  const x = String(u ?? "").trim();
  if (!x) return "#";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}
function resolvePageHref(raw: any, pageMap: Record<string, string>) {
  const x = String(raw ?? "").trim();
  if (!x) return "#";

  // direkt tam url / absolute path
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  if (x.startsWith("/")) return x;

  // map denemeleri
  if (pageMap[x]) return pageMap[x];

  // group/slug şeklinde geldiyse
  if (pageMap[x.replace(/^\/+/, "")]) return pageMap[x.replace(/^\/+/, "")];

  // olası gruplar için fallback
  const guesses = [
    `kurumsal/${x}`,
    `yardim/${x}`,
    `yeni/${x}`,
    `groups/${x}`,
  ];

  for (const key of guesses) {
    if (pageMap[key]) return pageMap[key];
  }

  // hiçbir şey bulunamazsa 404 üretmek yerine # dön
  return "#";
}
function Icon({ name }: { name: NonNullable<TrustCard["icon"]> }) {
  // minimal, premium line icons (inline)
  const common = "h-5 w-5";
  switch (name) {
    case "shield":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2 20 6v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "truck":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7h11v10H3V7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M14 10h4l3 3v4h-7v-7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" />
          <path d="M18 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" />
        </svg>
      );
    case "cert":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M7 3h10v14H7V3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9 7h6M9 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M10 17l-1 4 3-2 3 2-1-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "return":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M9 10H4V5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 10c2-4 6-6 10-6 4.4 0 8 3.6 8 8s-3.6 8-8 8c-3.2 0-6.1-1.9-7.4-4.7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "gift":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path d="M3 10h18v4H3v-4Z" stroke="currentColor" strokeWidth="2" />
          <path d="M5 14v7h14v-7" stroke="currentColor" strokeWidth="2" />
          <path d="M12 10v11" stroke="currentColor" strokeWidth="2" />
          <path
            d="M7.5 6.5c0-1.4 1.1-2.5 2.5-2.5 1.9 0 2 3 2 3s-3 .4-4.5-.5c-.3-.2-.5-.5-.5-1Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M16.5 6.5c0-1.4-1.1-2.5-2.5-2.5-1.9 0-2 3-2 3s3 .4 4.5-.5c.3-.2.5-.5.5-1Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "spark":
    default:
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l1.3 6.2L20 10l-6.7 1.8L12 18l-1.3-6.2L4 10l6.7-1.8L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M19 2l.7 3.1L23 6l-3.3.9L19 10l-.7-3.1L15 6l3.3-.9L19 2Z" fill="currentColor" opacity=".8" />
        </svg>
      );
  }
}

export default function PremiumTrustStrip() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [loc, setLoc] = useState<Locale>("tr");

  const [cfg, setCfg] = useState<HomeSettingsDoc["premiumTrustStrip"] | null>(null);
  const [pageMap, setPageMap] = useState<Record<string, string>>({});
  // parallax glow follow
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const ref = collection(db, "pages");
    return onSnapshot(ref, (snap) => {
      const m: Record<string, string> = {};
      snap.forEach((d) => {
        const x: any = d.data();
        const group = String(x?.group || "").trim();
        const slug = String(x?.slug || "").trim();
  
        // admin’de path alanın varsa onu kullan
        const pathRaw = String(x?.path || "").trim();
        const path = pathRaw
          ? safeHref(pathRaw)
          : (group && slug ? `/${group}/${slug}` : "");
  
        if (slug && path) {
          // ✅ tek slug ile gelenleri de yakala
          m[slug] = path;
  
          // ✅ group/slug key ile de yakala
          if (group) m[`${group}/${slug}`] = path;
        }
      });
      setPageMap(m);
    });
  }, [db]);
  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setLoc(((ce?.detail as Locale) || "tr") as Locale);
    };
    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");
    return onSnapshot(
      
      ref,
      (snap) => {
        const data = (snap.data() as HomeSettingsDoc) || {};
        setCfg(data.premiumTrustStrip ?? null);
      },
      () => setCfg(null)
      
    );
  }, [db]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / Math.max(1, r.width)) * 100;
      const y = ((e.clientY - r.top) / Math.max(1, r.height)) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    };

    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  const isActive = cfg?.isActive ?? true;

  const fallbackCards: TrustCard[] = [
    {
      id: "safe",
      icon: "shield",
      title: { tr: "Güvenli Alışveriş", en: "Secure Shopping" },
      desc: { tr: "Korunaklı ödeme & doğrulama.", en: "Protected checkout & verification." },
      href: "sss",
    },
    {
      id: "ship",
      icon: "truck",
      title: { tr: "Sigortalı Gönderim", en: "Insured Shipping" },
      desc: { tr: "Hasarsız teslimat odaklı.", en: "Delivery focused on safety." },
      href: "kargo",
    },
    {
      id: "cert",
      icon: "cert",
      title: { tr: "Sertifika", en: "Certificate" },
      desc: { tr: "Ürün doğrulama & belge.", en: "Verification & documentation." },
      href: "sss",
    },
    {
      id: "return",
      icon: "return",
      title: { tr: "İade Kolaylığı", en: "Easy Returns" },
      desc: { tr: "Şeffaf süreç, net iletişim.", en: "Clear process, fast support." },
      href: "iade",
    },
  ];

  const fallbackStats = [
    { value: "4.9/5", label: { tr: "Müşteri memnuniyeti", en: "Customer rating" } },
    { value: "24/7", label: { tr: "Destek kanalları", en: "Support channels" } },
    { value: "2Y", label: { tr: "Bakım garantisi", en: "Service warranty" } },
  ];

  const cards = (cfg?.cards?.length ? cfg.cards : fallbackCards).slice(0, 6);
  const stats = (cfg?.stats?.length ? cfg.stats : fallbackStats).slice(0, 4);

  const eyebrow = L(loc, cfg?.eyebrow, loc === "en" ? "Premium Service" : "Premium Hizmet");
  const title = L(loc, cfg?.title, loc === "en" ? "Your lifestyle, our responsibility." : "Takın, biz arkasındayız.");
  const subtitle = L(
    loc,
    cfg?.subtitle,
    loc === "en"
      ? "Transparent policies, fast support, premium packaging."
      : "Şeffaf süreç, hızlı destek, özenli paketleme."
  );

  const ctaText = L(loc, cfg?.ctaText, loc === "en" ? "Learn more" : "Detaylı Bilgi");
  const ctaHref = safeHref(cfg?.ctaHref || "/kurumsal/hakkimizda");

  if (!isActive) return null;

  return (
    <section className="px-container" style={{ padding: "18px 18px 8px" }}>
      <div
        ref={rootRef}
        className={[
          "relative overflow-hidden rounded-[26px]",
          "bg-white/70 backdrop-blur",
          "ring-1 ring-black/5",
          "shadow-[0_30px_120px_rgba(0,0,0,.10)]",
          "p-5 sm:p-7",
          s.root,
        ].join(" ")}
      >
        {/* background layers */}
        <div className={s.noise} aria-hidden="true" />
        <div className={s.glow} aria-hidden="true" />
        <div className={s.sheen} aria-hidden="true" />

        <div className="relative z-[2] grid gap-5">
          {/* header */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-extrabold text-black/70 ring-1 ring-black/5">
              <span className={s.pulseDot} aria-hidden="true" />
              {eyebrow}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="min-w-0">
                <h3 className="m-0 text-[22px] sm:text-[28px] font-black tracking-[-0.03em] text-black/90">
                  {title}
                </h3>
                <p className="m-0 text-black/60 text-[13px] sm:text-[14px] max-w-[70ch]">
                  {subtitle}
                </p>
              </div>

              <Link
                href={ctaHref}
                className={[
                  "mt-2 sm:mt-0 inline-flex w-fit items-center gap-2",
                  "rounded-full px-4 py-2 text-[13px] font-extrabold",
                  "bg-black text-white",
                  "shadow-[0_18px_55px_rgba(0,0,0,.18)]",
                  "transition-transform duration-200 hover:-translate-y-[1px]",
                  s.cta,
                ].join(" ")}
              >
                {ctaText} <span className="translate-y-[-1px]">→</span>
              </Link>
            </div>
          </div>

          {/* cards */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => {
          const rawHref = String(c.href || "").trim();
          const href = resolvePageHref(rawHref, pageMap);
              const t = L(loc, c.title, "");
              const d = L(loc, c.desc, "");
              const icon = c.icon || "spark";

              const CardInner = (
                <div
                  className={[
                    "group relative overflow-hidden rounded-2xl",
                    "bg-white/70 backdrop-blur",
                    "ring-1 ring-black/5",
                    "p-4",
                    "shadow-[0_16px_45px_rgba(0,0,0,.06)]",
                    "transition-all duration-200",
                    "hover:-translate-y-[2px] hover:shadow-[0_26px_70px_rgba(0,0,0,.10)] hover:ring-black/10",
                    s.card,
                  ].join(" ")}
                >
                  <div className={s.cardSheen} aria-hidden="true" />
                  <div className="flex items-start gap-3">
                    <div className={s.iconWrap} aria-hidden="true">
                      <Icon name={icon} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-black tracking-[-0.02em] text-[16px] text-black/90">
                        {t}
                      </div>
                      {d ? (
                        <div className="mt-1 text-[12px] text-black/60 line-clamp-2">
                          {d}
                        </div>
                      ) : null}
                      <div className="mt-3 inline-flex items-center gap-2 text-[12px] font-extrabold text-black/70">
                        {loc === "en" ? "View" : "Gör"}{" "}
                        <span className="transition-transform duration-200 group-hover:translate-x-[2px]">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              return href === "#"
  ? <div key={c.id}>{CardInner}</div>
  : <Link key={c.id} href={href} prefetch={false}>{CardInner}</Link>;
            })}
          </div>

          {/* stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((st, i) => (
              <div
                key={`${st.value}-${i}`}
                className={[
                  "rounded-2xl bg-black/[0.03] ring-1 ring-black/5",
                  "px-4 py-3",
                  "flex items-center justify-between",
                  s.stat,
                ].join(" ")}
              >
                <div className="text-[12px] font-semibold text-black/60">{L(loc, st.label)}</div>
                <div className="text-[16px] font-black tracking-[-0.02em] text-black/85">{st.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}