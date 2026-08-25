"use client";

import { useMemo, useState, useEffect } from "react";
import s from "./homeSocialSection.module.css";
import type { Locale } from "@/lib/i18n";

type LocaleText = { tr?: string; en?: string };

type SocialItem = {
  type: "video" | "image";
  href?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  alt?: LocaleText | string;
};

export type HomeSocialConfig = {
  enabled?: boolean;
  title?: LocaleText | string;
  subtitle?: LocaleText | string;
  profileUrl?: string;
  profileText?: LocaleText | string;
  items?: SocialItem[];
};

function pickText(v: any, loc: Locale, fb = ""): string {
  if (!v) return fb;
  if (typeof v === "string") return v.trim() || fb;
  const tr = String(v?.tr ?? "").trim();
  const en = String(v?.en ?? "").trim();
  return loc === "en" ? (en || tr || fb) : (tr || en || fb);
}

function safeUrl(u: any) {
  const x = String(u ?? "").trim();
  if (!x) return "";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

function isInstagramUrl(u: string) {
  return (u || "").toLowerCase().includes("instagram.com/");
}

function getInstagramEmbedUrl(u: string) {
  const m = (u || "").match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
  if (!m) return "";
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
}

function isDirectVideo(u: string) {
  const x = (u || "").toLowerCase().split("?")[0];
  return x.endsWith(".mp4") || x.endsWith(".webm") || x.endsWith(".mov");
}

function isDirectImage(u: string) {
  const x = (u || "").toLowerCase().split("?")[0];
  return x.endsWith(".jpg") || x.endsWith(".jpeg") || x.endsWith(".png") || x.endsWith(".webp") || x.endsWith(".gif");
}

export default function HomeSocialSection({
  loc,
  cfg,
}: {
  loc: Locale;
  cfg: HomeSocialConfig | null | undefined;
}) {
  const enabled = cfg?.enabled !== false;

  const title = pickText(cfg?.title, loc, loc === "en" ? "Social" : "Sosyal");
  const subtitle = pickText(cfg?.subtitle, loc, loc === "en" ? "Selected from Instagram" : "Instagram’dan seçtiklerimiz");

  const profileUrl = safeUrl(cfg?.profileUrl);
  const profileText = pickText(cfg?.profileText, loc, "@instagram");

  const items = useMemo(() => {
    const raw = Array.isArray(cfg?.items) ? cfg!.items! : [];
    return raw
      .map((x, idx) => {
        const href = safeUrl(x?.href);
        const mediaUrl = safeUrl(x?.mediaUrl);
        const thumbUrl = safeUrl(x?.thumbUrl);

        const type: "video" | "image" = x?.type === "video" ? "video" : "image";
        const alt = pickText(x?.alt, loc, loc === "en" ? "Social media" : "Sosyal medya");

        const poster =
          (thumbUrl && isDirectImage(thumbUrl)) ? thumbUrl :
          (mediaUrl && isDirectImage(mediaUrl)) ? mediaUrl :
          "";

        const playableVideo = type === "video" && mediaUrl && isDirectVideo(mediaUrl);

        const instaBase = (mediaUrl && isInstagramUrl(mediaUrl)) ? mediaUrl : (href && isInstagramUrl(href)) ? href : "";
        const embedUrl = instaBase ? getInstagramEmbedUrl(instaBase) : "";

        const imageSrc =
          (mediaUrl && isDirectImage(mediaUrl)) ? mediaUrl :
          (poster ? poster : "");

        return {
          id: `${idx}-${href || mediaUrl || thumbUrl || "x"}`,
          type,
          href,
          mediaUrl,
          thumbUrl,
          alt,
          poster,
          playableVideo,
          embedUrl,
          imageSrc,
        };
      })
      .filter((x) => x.mediaUrl || x.thumbUrl || x.href)
      .slice(0, 12);
  }, [cfg, loc]);

  const [openId, setOpenId] = useState<string>("");

  // ✅ AUTO OPEN: ilk render’da “poster’ı olan ilk item” otomatik açık gelsin
  useEffect(() => {
    if (!items.length) return;
    setOpenId((prev) => {
      if (prev) return prev;
      const firstGood = items.find((x) => x.poster || x.imageSrc || x.embedUrl) || items[0];
      return firstGood?.id || "";
    });
  }, [items]);

  if (!enabled || items.length === 0) return null;

  return (
    <section className={s.section} aria-label={title}>
      <div className={s.inner}>
        <div className={s.head}>
          <div className={s.headLeft}>
            <div className={s.kicker}>{loc === "en" ? "SOCIAL" : "SOSYAL"}</div>
            <h2 className={s.h2}>{title}</h2>
            <p className={s.sub}>{subtitle}</p>
          </div>

          {profileUrl ? (
            <a className={s.profileBtn} href={profileUrl} target="_blank" rel="noreferrer">
              {profileText} <span aria-hidden>↗</span>
            </a>
          ) : null}
        </div>

        <div className={s.grid}>
          {items.map((it) => {
            const isOpen = openId === it.id;

            const canInlinePlay = it.type === "video" && it.playableVideo;
            const canInlineImage = it.type === "image" && !!it.imageSrc;
            const canEmbed = !canInlinePlay && !!it.embedUrl;

            const onToggle = () => setOpenId((p) => (p === it.id ? "" : it.id));

            return (
              <article key={it.id} className={`${s.card} ${isOpen ? s.cardOpen : ""}`}>
                <button type="button" className={s.cardTap} onClick={onToggle} aria-label={it.alt}>
                  <div className={s.media}>
                    {!isOpen ? (
                      it.poster || it.imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={s.img} src={it.poster || it.imageSrc} alt={it.alt} loading="lazy" />
                      ) : (
                        <div className={s.ph} aria-hidden="true">
                          <div className={s.phMark}>IG</div>
                          <div className={s.phSub}>Preview</div>
                        </div>
                      )
                    ) : (
                      <div className={s.mediaOpen}>
                        {canInlinePlay ? (
                          <video
                            className={s.video}
                            src={it.mediaUrl}
                            poster={it.poster || undefined}
                            controls
                            playsInline
                            autoPlay
                            preload="metadata"
                          />
                        ) : canInlineImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={s.imgOpen} src={it.imageSrc} alt={it.alt} loading="lazy" />
                        ) : canEmbed ? (
                            <iframe
                            className={s.ig}
                            src={it.embedUrl}
                            title={it.alt}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allow="encrypted-media; picture-in-picture; autoplay"
                            allowFullScreen
                            scrolling="no"
                          />
                        ) : (
                          <div className={s.ph} aria-hidden="true">
                            <div className={s.phMark}>IG</div>
                            <div className={s.phSub}>No media</div>
                          </div>
                        )}

                      
                      </div>
                    )}

                    {!isOpen ? (
                      <div className={s.overlay} aria-hidden="true">
                        <div className={s.badgeRow}>
                          <div className={s.badge}>{it.type === "video" ? "REEL" : "POST"}</div>
                          <div className={s.iconBtn}>{it.type === "video" ? "▶" : "↗"}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}