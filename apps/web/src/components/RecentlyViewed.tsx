"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { doc, onSnapshot, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { resolveProductPriceTRY } from "@/lib/pricing";
import styles from "./RecentlyViewed.module.css";

const STORAGE_KEY = "nci_recently_viewed_v1";
const MAX_ITEMS = 12;
const FALLBACK_IMG = "/dromocob-mark.svg";

type RecentProduct = {
  id: string;
  slug: string;
  title: string;
  image: string;
  priceTry?: number;
  compareAtPrice?: number;
  viewedAt: number;
};

function loadRecent(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentProduct[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota vs. */
  }
}

/** Ürün sayfasında çağrılır — ürünü listeye kaydeder */
export function trackRecentlyViewed(product: {
  id: string;
  slug: string;
  title: string;
  image: string;
  priceTry?: number;
}) {
  if (!product.id && !product.slug) return;

  const current = loadRecent();

  const filtered = current.filter(
    (item) =>
      item.id !== product.id &&
      item.slug !== product.slug
  );

  const entry: RecentProduct = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    image: product.image,
    priceTry: product.priceTry,
    viewedAt: Date.now(),
  };

  const next = [entry, ...filtered].slice(0, MAX_ITEMS);
  saveRecent(next);

  window.dispatchEvent(new Event("nci:recently-viewed-updated"));
}

function fmtTRY(n: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₺${n.toFixed(2)}`;
  }
}

function s(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Ürün objesinden en iyi resmi seçer */
function pickBestImage(p: any): string {
  const candidates = [
    p?.mainImage,
    p?.image,
    p?.cover,
    p?.thumbnail,
    ...(Array.isArray(p?.images) ? p.images : []),
    ...(Array.isArray(p?.gallery) ? p.gallery : []),
  ];
  for (const c of candidates) {
    const v = s(c);
    if (v && !v.includes("favicon") && !v.includes("logo.png")) return v;
  }
  return FALLBACK_IMG;
}

function pickText(v: any, loc = "tr"): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v?.[loc] || v?.tr || v?.en || "");
}

/**
 * Son görüntülenen ürünler bileşeni.
 * excludeSlug: Mevcut ürün sayfasının slug'ı (kendisini gösterme)
 */
export default function RecentlyViewed({
  excludeSlug,
}: {
  excludeSlug?: string;
}) {
  const [items, setItems] = useState<RecentProduct[]>([]);
  const [rates, setRates] = useState<Record<string, any> | null>(null);
  const [liveProducts, setLiveProducts] = useState<Record<string, any>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const db = useMemo(() => {
    try { return getFirebaseDb(); } catch { return null; }
  }, []);

  const refresh = useCallback(() => {
    const all = loadRecent();
    const filtered = excludeSlug
      ? all.filter((item) => item.slug !== excludeSlug)
      : all;
    setItems(filtered.slice(0, 8));
  }, [excludeSlug]);

  useEffect(() => {
    refresh();

    const onChange = () => refresh();
    window.addEventListener("nci:recently-viewed-updated", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("nci:recently-viewed-updated", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  // Rates realtime
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRates(snap.exists() ? (snap.data() as any) : null),
      () => setRates(null)
    );
    return () => unsub();
  }, [db]);

  // Firestore'dan ürün verilerini çek (resim + fiyat)
  useEffect(() => {
    if (!db || !items.length) return;
    let alive = true;

    (async () => {
      const products: Record<string, any> = {};

      for (const item of items) {
        try {
          const dref = doc(db, "products", item.id);
          const dsnap = await getDoc(dref);

          if (dsnap.exists()) {
            products[item.id] = { id: dsnap.id, ...dsnap.data() };
          } else {
            const qref = query(
              collection(db, "products"),
              where("slug", "==", item.slug),
              limit(1)
            );
            const qsnap = await getDocs(qref);
            if (!qsnap.empty) {
              const d = qsnap.docs[0];
              products[item.id] = { id: d.id, ...d.data() };
            }
          }
        } catch {
          // skip
        }
      }

      if (alive) setLiveProducts(products);
    })();

    return () => { alive = false; };
  }, [db, items]);

  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const liveP = liveProducts[item.id];
      if (!liveP) return item;

      const bestImage = pickBestImage(liveP);
      const resolved = resolveProductPriceTRY(liveP, rates);
      const livePrice = Number(resolved?.price || 0);
      const compareAtPrice = Number(resolved?.compareAtPrice || 0);

      return {
        ...item,
        image: bestImage,
        priceTry: livePrice > 0 ? livePrice : item.priceTry,
        compareAtPrice: compareAtPrice > 0 ? compareAtPrice : undefined,
        title: pickText(liveP?.title) || pickText(liveP?.name) || item.title,
      };
    });
  }, [items, liveProducts, rates]);

  const scrollByDir = (dir: number) => {
    if (!scrollRef.current) return;
    const w = scrollRef.current.offsetWidth;
    scrollRef.current.scrollBy({ left: dir * w * 0.6, behavior: "smooth" });
  };

  if (!enrichedItems.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Son Görüntülenen Ürünler</h2>
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scrollByDir(-1)}
            aria-label="Önceki"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scrollByDir(1)}
            aria-label="Sonraki"
          >
            ›
          </button>
        </div>
      </div>

      <div className={styles.sliderWrap}>
        <div ref={scrollRef} className={styles.scroller}>
          {enrichedItems.map((item) => (
            <Link
              key={item.slug || item.id}
              href={`/products/${encodeURIComponent(item.slug || item.id)}`}
              className={styles.card}
            >
              <div className={styles.media}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image || FALLBACK_IMG}
                  alt={item.title}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                  }}
                />
              </div>
              <div className={styles.body}>
                <div className={styles.name}>{item.title}</div>
                {item.priceTry && item.priceTry > 0 ? (
                  <div className={styles.priceWrap}>
                    {item.compareAtPrice ? (
                      <span className={styles.compare}>{fmtTRY(item.compareAtPrice)}</span>
                    ) : null}
                    <span className={styles.price}>{fmtTRY(item.priceTry)}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
