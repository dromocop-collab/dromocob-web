"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchHomeCategories } from "@/lib/categories";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./featuredCategoriesV2.module.css";

type Item = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  showOnHome?: boolean;
};

function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

function firstLetter(name?: string) {
  const x = String(name || "").trim();
  return (x ? x[0] : "?").toUpperCase();
}

function CatCard({
  c,
  blockClickRef,
  loc,
}: {
  c: Item;
  blockClickRef: React.MutableRefObject<boolean>;
  loc: "tr" | "en";
}) {
  const href = `/shop?cat=${encodeURIComponent(c.slug)}`;
  const img = String(c.image || "").trim();
  const initialHasImg = !!img && isHttpUrl(img);
  const [imgOk, setImgOk] = useState(initialHasImg);

  useEffect(() => {
    setImgOk(initialHasImg);
  }, [initialHasImg]);

  const t = {
    cat: loc === "en" ? "Category" : "Kategori",
    view: loc === "en" ? "View products" : "Ürünleri incele",
  };

  return (
    <Link
      href={href}
      prefetch={false}
      className={s.fcCard}
      aria-label={`${c.name} ${t.view}`}
      title={c.name}
      draggable={false}
      onClick={(e) => {
        if (blockClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className={s.media}>
        {imgOk ? (
          <img
            src={img}
            alt={c.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={s.img}
            onError={() => setImgOk(false)}
            draggable={false}
          />
        ) : (
          <div className={s.imgFallback} aria-hidden="true">
            {firstLetter(c.name)}
          </div>
        )}

        <div className={s.mediaGlow} />
      </div>

      <div className={s.body}>
        <div className={s.code}>
          {t.cat} • {c.slug}
        </div>
        <h3 className={s.title}>{c.name}</h3>
        <div className={s.ctaRow}>
          <span className={s.cta}>{t.view}</span>
          <span className={s.ctaArrow}>→</span>
        </div>
      </div>
    </Link>
  );
}

export default function FeaturedCategoriesSliderV2({
  items,
  loc,
  title,
  desc,
  max = 20,
}: {
  items?: Item[];
  loc?: "tr" | "en";
  title?: string;
  desc?: string;
  max?: number;
}) {
  const [uiLoc, setUiLoc] = useState<Locale>("tr");
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // sadece drag sonrası click engellemek için
  const blockClickRef = useRef(false);

  const dragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    pointerId: -1,
  });

  useEffect(() => {
    setUiLoc(getLocale());

    const handler = (e: Event) => {
      const next = (e as CustomEvent<Locale>)?.detail || getLocale() || "tr";
      setUiLoc(next);
    };

    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  const activeLoc = (loc ?? uiLoc) as "tr" | "en";

  const T = {
    title: title ?? (activeLoc === "en" ? "Featured Categories" : "Öne Çıkan Kategoriler"),
    desc: desc ?? (activeLoc === "en" ? "Discover trending items." : "En trend ürünleri keşfet."),
    empty: activeLoc === "en" ? "No categories found." : "Kategori yok",
    loading: activeLoc === "en" ? "Loading..." : "Yükleniyor…",
    prev: activeLoc === "en" ? "Previous" : "Geri",
    next: activeLoc === "en" ? "Next" : "İleri",
  };

  useEffect(() => {
    let alive = true;

    async function run() {
      const hasItemsProp = Array.isArray(items);
      const hasUsefulItems =
        hasItemsProp &&
        items!.some((x) => x && x.slug && x.name && (x.showOnHome ?? true));

      if (hasUsefulItems) {
        const normalized = items!
          .filter(Boolean)
          .filter((x) => x.slug && x.name)
          .filter((x) => (typeof x.showOnHome === "boolean" ? x.showOnHome : true))
          .slice(0, Math.max(1, Math.min(50, max)));

        if (alive) setData(normalized);
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
            image: c.image,
            showOnHome: c.showOnHome,
          }))
          .filter((x) => x.slug && x.name);

        if (alive) setData(mapped);
      } catch (e) {
        console.error("FeaturedCategoriesSliderV2 fetchHomeCategories error:", e);
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

  const list = useMemo(() => {
    return data.slice(0, Math.max(1, Math.min(50, max)));
  }, [data, max]);

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

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;

    const firstCard = el.querySelector(`.${s.itemWrap}`) as HTMLElement | null;
    const gap = 20;
    const step = firstCard
      ? firstCard.offsetWidth + gap
      : Math.min(420, Math.max(280, el.clientWidth * 0.8));

    el.scrollBy({
      left: dir * step,
      behavior: "smooth",
    });
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const el = scrollerRef.current;
    if (!el) return;

    // mobilde native scroll kalsın
    if (window.innerWidth <= 768) return;
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;

    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = el.scrollLeft;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.moved = false;

    blockClickRef.current = false;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {}

    el.classList.add(s.dragging);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const el = scrollerRef.current;
    if (!el || !dragRef.current.active) return;

    const dx = e.clientX - dragRef.current.startX;

    if (Math.abs(dx) > 8) {
      dragRef.current.moved = true;
      blockClickRef.current = true;
    }

    el.scrollLeft = dragRef.current.startScrollLeft - dx;
  };

  const endDrag = () => {
    const el = scrollerRef.current;
    dragRef.current.active = false;

    el?.classList.remove(s.dragging);

    if (dragRef.current.moved) {
      window.setTimeout(() => {
        blockClickRef.current = false;
        dragRef.current.moved = false;
      }, 80);
    } else {
      blockClickRef.current = false;
      dragRef.current.moved = false;
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = () => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const el = scrollerRef.current;
    if (!el) return;

    try {
      el.releasePointerCapture(dragRef.current.pointerId);
    } catch {}

    endDrag();
  };

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = () => { // eslint-disable-line @typescript-eslint/no-unused-vars
    endDrag();
  };

  return (
   <section className={s.section}>
  <div className={s.inner}>
    <div className={s.head}>
      <div className={s.headText}>
        <h2 className={s.headTitle}>{T.title}</h2>
        <p className={s.headDesc}>{T.desc}</p>
      </div>

      <div className={s.arrows}>
        <button
          className={s.arrowBtn}
          type="button"
          aria-label={T.prev}
          onClick={() => scrollByCard(-1)}
        >
          ‹
        </button>
        <button
          className={s.arrowBtn}
          type="button"
          aria-label={T.next}
          onClick={() => scrollByCard(1)}
        >
          ›
        </button>
      </div>
    </div>

    {loading && list.length === 0 ? (
      <div className={s.empty}>{T.loading}</div>
    ) : list.length === 0 ? (
      <div className={s.empty}>{T.empty}</div>
    ) : (
      <div className={s.shell}>
       <div
  ref={scrollerRef}
  className={s.scroller}
  aria-label={activeLoc === "en" ? "Featured categories" : "Öne çıkan kategoriler"}
>
          {list.map((c) => (
            <div key={c.id || c.slug} className={s.itemWrap}>
              <CatCard c={c} blockClickRef={blockClickRef} loc={activeLoc} />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
</section>
  );
}