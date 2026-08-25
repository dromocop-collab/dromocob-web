"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchHomeCategories } from "@/lib/categories";
import s from "./FeaturedCategoriesSlider.module.css";

type Item = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  showOnHome?: boolean;
};

function firstLetter(name?: string) {
  const v = String(name || "").trim();
  return (v ? v[0] : "?").toUpperCase();
}

function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

function CatCard({ c }: { c: Item }) {
  const href = `/shop?cat=${encodeURIComponent(c.slug)}`;
  const img = String(c.image || "").trim();
  const initialHasImg = !!img && isHttpUrl(img);
  const [imgOk, setImgOk] = useState(initialHasImg);

  useEffect(() => {
    setImgOk(initialHasImg);
  }, [initialHasImg]);

  return (
    <Link
      href={href}
      prefetch={false}
      className={s.card}
      aria-label={`${c.name} kategorisini incele`}
      title={c.name}
    >
      <div className={s.media}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={s.img}
            src={img}
            alt={c.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className={s.initial} aria-hidden="true">
            {firstLetter(c.name)}
          </div>
        )}

        <div className={s.glow} aria-hidden="true" />
        <div className={s.sheen} aria-hidden="true" />
      </div>

      <div className={s.body}>
        <div className={s.name}>{c.name}</div>

        <div className={s.meta}>
          <span className={s.slug} title={c.slug}>
            {c.slug}
          </span>

          <span className={s.pill}>
            İncele <span className={s.arrow}>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function FeaturedCategoriesSlider({
  items,
  title,
  desc,
  max = 20,
}: {
  items?: Item[];
  title?: string;
  desc?: string;
  max?: number;
}) {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      const hasItemsProp = Array.isArray(items);
      const hasUsefulItems =
        hasItemsProp &&
        items!.some((x) => x && (x as any).slug && (x as any).name && ((x as any).showOnHome ?? true));

      if (hasUsefulItems) {
        const normalized = items!
          .filter(Boolean)
          .filter((x) => (x as any).slug && (x as any).name)
          .filter((x) => (typeof (x as any).showOnHome === "boolean" ? (x as any).showOnHome : true))
          .slice(0, Math.max(1, Math.min(50, max)));

        if (alive) setData(normalized as any);
        return;
      }

      setLoading(true);
      try {
        const rows = await fetchHomeCategories({ onlyRoot: true, max });
        const mapped = rows
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            image: (c as any).image,
            showOnHome: (c as any).showOnHome,
          }))
          .filter((x) => x.slug && x.name);

        if (alive) setData(mapped);
      } catch (e) {
        console.error("FeaturedCategoriesSlider fetchHomeCategories error:", e);
        if (alive) setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [items, max]);

  const list = useMemo(() => data.slice(0, Math.max(1, Math.min(50, max))), [data, max]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Wheel -> yatay scroll (sadece gerek varsa)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const canScrollX = el.scrollWidth > el.clientWidth + 2;
      if (!canScrollX) return;

      const mostlyVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
      if (mostlyVertical) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const el = scrollerRef.current;
    if (!el) return;

    const step = 320;
    if (e.key === "ArrowRight") {
      el.scrollBy({ left: step, behavior: "smooth" });
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      el.scrollBy({ left: -step, behavior: "smooth" });
      e.preventDefault();
    }
  };

  return (
    <section className={`px-container ${s.wrap}`}>
      <div className={s.head}>
        <div>
          <h2 className={s.title}>{title || "Öne Çıkan Kategoriler"}</h2>
          <div className={s.desc}>{desc || "En trend ürünleri keşfet."}</div>
        </div>

        {loading && list.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Yükleniyor…</div>
        ) : list.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Kategori yok</div>
        ) : (
          <div
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className={s.scroller}
            aria-label="Öne çıkan kategoriler kaydırıcı"
          >
            {list.map((c) => (
              <CatCard key={c.id || c.slug} c={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}