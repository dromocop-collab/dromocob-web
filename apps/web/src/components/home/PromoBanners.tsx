"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useT } from "@/lib/useT";

function s(v: any) {
  return String(v ?? "").trim();
}

function pickText(val: any, loc: "tr" | "en") {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (val && typeof val === "object") {
    const v = s(val?.[loc] ?? val?.tr ?? val?.en);
    return v;
  }
  return "";
}

function pickStrArr(val: any, loc: "tr" | "en"): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s).filter(Boolean);
  if (val && typeof val === "object") {
    const arr = val?.[loc] ?? val?.tr ?? val?.en;
    if (Array.isArray(arr)) return arr.map(s).filter(Boolean);
  }
  return [];
}

export default function PromoBanners({ items }: { items?: any[] }) {
  const { loc } = useT();
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const active = useMemo(() => {
    return list
      .filter((x) => x && x.isActive !== false)
      .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  }, [list]);

  if (active.length === 0) return null;

  return (
    <section
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      {active.map((b, i) => {
        const title = pickText(b?.title, loc) || pickText(b?.title?.tr, "tr") || "Kampanya";
        const subtitle =
          pickText(b?.subtitle, loc) ||
          pickText(b?.desc, loc) ||
          pickText(b?.desc?.tr, "tr") ||
          "";

        const startLabel = pickText(b?.startLabel, loc) || "Başlangıç";
        const priceText = pickText(b?.priceText, loc) || "₺—";

        const bulletsPrimary = pickStrArr(b?.bullets, loc);
const bulletsFallback = pickStrArr(b?.features, loc);
const bullets =
  bulletsPrimary.length ? bulletsPrimary :
  bulletsFallback.length ? bulletsFallback :
  (Array.isArray(b?.bullets) ? b.bullets.map(s).filter(Boolean) : []);

        const imgUrl = s(b?.image?.url ?? b?.image ?? "");
        const imgAlt = pickText(b?.image?.alt, loc) || title;
        const badgeText = pickText(b?.image?.badgeText, loc) || "";

        const pCtaLabel = pickText(b?.primaryCta?.label, loc) || "Mağaza";
        const pCtaHref = s(b?.primaryCta?.href) || "/shop";

        const sCtaLabel = pickText(b?.secondaryCta?.label, loc) || "Kategoriler";
        const sCtaHref = s(b?.secondaryCta?.href) || "/shop";

        const to = (href: string) => (href?.startsWith("/") ? href : `/${href}`);

        return (
          <div
            key={b?.id || i}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 26,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#fff",
              boxShadow: "0 18px 60px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                gap: 18,
                padding: 24,
                alignItems: "center",
              }}
            >
              {/* LEFT */}
              <div style={{ padding: "6px 8px" }}>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 54,
                    lineHeight: 1.0,
                    letterSpacing: "-1px",
                    marginBottom: 10,
                  }}
                >
                  {title}
                </div>

                {!!subtitle && (
                  <div style={{ opacity: 0.78, fontWeight: 650, marginBottom: 16 }}>
                    {subtitle}
                  </div>
                )}

                <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 800 }}>
                    {startLabel}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: "-0.6px" }}>
                    {priceText}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <Link
                    href={to(pCtaHref)}
                    className="px-pill isActive"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    {pCtaLabel}
                  </Link>
                  <Link
                    href={to(sCtaHref)}
                    className="px-pill"
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    {sCtaLabel}
                  </Link>
                </div>

                {bullets?.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {bullets.slice(0, 6).map((it: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontWeight: 800,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: "rgba(0,0,0,0.85)",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ opacity: 0.9 }}>{it}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* RIGHT */}
              <div
                style={{
                  position: "relative",
                  borderRadius: 26,
                  overflow: "hidden",
                  background: "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02))",
                  minHeight: 320,
                }}
              >
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt={imgAlt}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ height: 320, display: "grid", placeItems: "center", opacity: 0.6, fontWeight: 800 }}>
                    Görsel yok
                  </div>
                )}

                {/* badge text (vertical like screenshot) */}
                {!!badgeText && (
                  <div
                    style={{
                      position: "absolute",
                      right: 18,
                      top: "50%",
                      transform: "translateY(-50%)",
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      fontWeight: 950,
                      letterSpacing: "10px",
                      opacity: 0.18,
                      fontSize: 46,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {badgeText}
                  </div>
                )}

                {/* arrow button */}
                <Link
                  href={to(pCtaHref)}
                  aria-label="Git"
                  style={{
                    position: "absolute",
                    right: 18,
                    bottom: 18,
                    width: 54,
                    height: 54,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.9)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    textDecoration: "none",
                    boxShadow: "0 16px 30px rgba(0,0,0,0.25)",
                  }}
                >
                  →
                </Link>
              </div>
            </div>

            {/* responsive fallback */}
            <style jsx>{`
              @media (max-width: 980px) {
                div[style*="grid-template-columns: 1.1fr 1fr"] {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>
          </div>
        );
      })}
    </section>
  );
}