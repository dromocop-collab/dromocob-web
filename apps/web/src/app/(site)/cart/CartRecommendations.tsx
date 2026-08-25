"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./CartRecommendations.module.css";

type ProductDoc = {
  id: string;
  slug?: string;
  title?: any;
  name?: any;
  image?: string;
  mainImage?: string;
  images?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
  price?: number;
  finalPrice?: number;
};

function asArr<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function str(v: any) {
  return String(v ?? "").trim();
}

function pickTitle(p: any) {
  return str(p?.title?.tr ?? p?.title ?? p?.name?.tr ?? p?.name ?? "Ürün");
}

function pickImg(p: any) {
  const imgs = asArr<string>(p?.images);
  return str(p?.mainImage ?? p?.image ?? imgs[0] ?? "");
}

function pickSlug(p: any) {
  return str(p?.slug ?? p?.id ?? "");
}

function pickPrice(p: any) {
  const v =
    typeof p?.finalPrice === "number"
      ? p.finalPrice
      : typeof p?.price === "number"
      ? p.price
      : Number(p?.price ?? 0);

  return Number.isFinite(v) && v > 0 ? v : 0;
}

function fmtTRY(v?: number) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₺${n}`;
  }
}

export default function CartRecommendations() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [items, setItems] = useState<ProductDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const qref = query(
          collection(db, "products"),
          where("isActive", "==", true),
          limit(16)
        );

        const snap = await getDocs(qref);
        if (!alive) return;

        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));

        setItems(list);
      } catch (e) {
        console.error("cart recommendations err:", e);
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  const scrollByCards = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;

    const card = el.querySelector(`.${s.cardWrap}`) as HTMLElement | null;
    const step = card ? card.offsetWidth * 1.05 : 320;

    el.scrollBy({
      left: dir * step * 2,
      behavior: "smooth",
    });
  };

  return (
    <section className={s.section} aria-label="Benzer ürünler">
      <div className={s.head}>
        <div className={s.headText}>
          <div className={s.kicker}>Önerilen</div>
          <h2 className={s.title}>Benzer Ürünler</h2>
          <p className={s.sub}>Sepetine uyum sağlayabilecek alternatifler.</p>
        </div>

        <div className={s.headActions}>
          <button
            type="button"
            className={s.arrowBtn}
            onClick={() => scrollByCards(-1)}
            aria-label="Geri"
          >
            ←
          </button>

          <button
            type="button"
            className={s.arrowBtn}
            onClick={() => scrollByCards(1)}
            aria-label="İleri"
          >
            →
          </button>

          <Link href="/shop" className={s.headLink}>
            Tümünü gör →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className={s.scroller}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.cardWrap}>
              <div className={s.skeletonCard}>
                <div className={s.skeletonMedia} />
                <div className={s.skeletonBody}>
                  <div className={s.skeletonLineLg} />
                  <div className={s.skeletonLineSm} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyTitle}>Şu an öneri bulunamadı</div>
          <div className={s.emptyText}>Yeni ürünler eklendiğinde burada görünecek.</div>
        </div>
      ) : (
        <div ref={scrollerRef} className={s.scroller}>
          {items.map((p) => {
            const slug = pickSlug(p);
            const img = pickImg(p);
            const title = pickTitle(p);
            const price = pickPrice(p);

            return (
              <div key={p.id} className={s.cardWrap}>
                <Link
                  href={`/products/${encodeURIComponent(slug)}`}
                  className={s.card}
                >
                  <div className={s.media}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={title} />
                    ) : (
                      <div className={s.mediaPh}>Görsel yok</div>
                    )}
                  </div>

                  <div className={s.body}>
                    <div className={s.metaRow}>
                      {p.isFeatured ? (
                        <span className={s.badge}>Öne çıkan</span>
                      ) : (
                        <span className={s.badgeSoft}>Öneri</span>
                      )}
                    </div>

                    <div className={s.name}>{title}</div>

                    {price ? (
                      <div className={s.price}>{fmtTRY(price)}</div>
                    ) : (
                      <div className={s.priceMuted}>Fiyat için detay</div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}