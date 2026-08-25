"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { useT } from "@/lib/useT";
import { pickText } from "@/lib/homeApi";
import { useFavorites } from "@/lib/favorites";
import { addToCart, getCart } from "@/lib/cart";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { RatesLatest, resolveProductPriceTRY, formatTRY } from "@/lib/pricing";
import { onIdTokenChanged, type User } from "firebase/auth";
import styles from "./ProductGrid.module.css";

function asArr<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function s(v: any) {
  return String(v ?? "").trim();
}

function imgList(p: any): string[] {
  const arr = asArr<string>(p?.images);
  const m = [p?.mainImage, p?.image, p?.cover, p?.thumbnail, ...arr]
    .filter((x) => typeof x === "string")
    .map((x) => s(x))
    .filter(Boolean);
  return Array.from(new Set(m));
}

function slugOf(p: any) {
  return s(p?.slug) || s(p?.id) || "";
}
function productIdOf(p: any) {
  return s(p?.id) || s(p?.productId) || s(p?.slug) || "";
}
function safePickText(val: any, loc?: any) {
  try {
    return (pickText as any)(val, loc);
  } catch {
    try {
      return (pickText as any)(val);
    } catch {
      return "";
    }
  }
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.8 4.6c-1.5-1.4-3.9-1.4-5.4 0L12 8l-3.4-3.4c-1.5-1.4-3.9-1.4-5.4 0-1.6 1.6-1.6 4.1 0 5.7L12 21l8.8-10.7c1.6-1.6 1.6-4.1 0-5.7z" />
    </svg>
  );
}

function clampQty(n: any) {
  const x = Math.floor(Number(n ?? 1));
  if (!Number.isFinite(x)) return 1;
  return Math.max(1, Math.min(99, x));
}

function SkelCard() {
  return (
    <div className={styles.skel}>
      <div className={styles.skelMedia} />
      <div className={styles.skelBody}>
        <div className={styles.skelLine} style={{ width: "78%" }} />
        <div className={styles.skelLine} style={{ width: "56%" }} />
        <div className={styles.skelLine} style={{ width: "42%", height: 18 }} />
        <div className={styles.skelBtns}>
          <div className={styles.skelBtn} />
          <div className={styles.skelBtn} />
        </div>
      </div>
    </div>
  );
}

function needsHydrate(p: any) {
  return (
    p?.finalPrice == null ||
    p?.dynamicPricing == null ||
    p?.priceMode == null ||
    p?.priceRateCode == null ||
    p?.weightGram == null ||
    p?.stock == null
  );
}

type Props = {
  items: any[];
  loading?: boolean;
  mode?: "grid" | "carousel";
  cardClassName?: string;
};

export default function ProductGrid({
  items,
  loading,
  mode = "grid",
  cardClassName = "",
}: Props) {
  const { t, loc } = useT();
const rows = useMemo(() => {
  const base = asArr<any>(items).filter(Boolean);

  if (mode !== "carousel") return base;

  return interleaveProductsByCategory(base);
}, [items, mode]);

  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const fav = useFavorites(user && !user.isAnonymous ? user.uid : null);
  const [rates, setRates] = useState<RatesLatest | null>(null);
  const [toast, setToast] = useState("");
  const carouselRef = useRef<HTMLDivElement | null>(null);
const [canScrollLeft, setCanScrollLeft] = useState(false);
const [canScrollRight, setCanScrollRight] = useState(false);
  const [fullMap, setFullMap] = useState<Record<string, any>>({});
  const [alertBusyId, setAlertBusyId] = useState<string>("");
  const [alertMap, setAlertMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRates(snap.exists() ? (snap.data() as any) : null),
      () => setRates(null)
    );
    return () => unsub();
  }, [db]);
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setAlertMap({});
      return;
    }
  
    const qy = query(
      collection(db, "stock_alerts"),
      where("uid", "==", user.uid)
    );
  
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next: Record<string, boolean> = {};
        snap.forEach((d) => {
          const x: any = d.data();
          const pid = String(x?.productId || "").trim();
          const status = String(x?.status || "active").trim();
  
          if (pid && status === "active") {
            next[pid] = true;
          }
        });
        setAlertMap(next);
      },
      () => setAlertMap({})
    );
  
    return () => unsub();
  }, [db, user]);
  function updateCarouselNav() {
  const el = carouselRef.current;
  if (!el) return;

  const maxLeft = el.scrollWidth - el.clientWidth;
  setCanScrollLeft(el.scrollLeft > 8);
  setCanScrollRight(el.scrollLeft < maxLeft - 8);
}
function productCategoryKey(p: any) {
  const candidates = [
    p?.categoryId,
    p?.categorySlug,
    p?.categoryKey,
    p?.mainCategory,
    p?.mainCategorySlug,
    Array.isArray(p?.categoryIds) ? p.categoryIds[0] : "",
    Array.isArray(p?.categorySlugs) ? p.categorySlugs[0] : "",
    p?.category?.id,
    p?.category?.slug,
  ];

  const found = candidates.map(s).find(Boolean);
  return found || "uncategorized";
}

function interleaveProductsByCategory(list: any[]) {
  if (!Array.isArray(list) || list.length <= 1) return list;

  const buckets = new Map<string, any[]>();

  for (const item of list) {
    const key = productCategoryKey(item);

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key)!.push(item);
  }

  const bucketList = Array.from(buckets.values());

  if (bucketList.length <= 1) return list;

  bucketList.sort((a, b) => b.length - a.length);

  const mixed: any[] = [];
  let index = 0;

  while (bucketList.some((bucket) => bucket.length > 0)) {
    const bucket = bucketList[index % bucketList.length];

    if (bucket.length > 0) {
      mixed.push(bucket.shift());
    }

    index += 1;
  }

  return mixed;
}
function scrollCarousel(dir: "left" | "right") {
  const el = carouselRef.current;
  if (!el) return;

  const step = Math.max(280, Math.floor(el.clientWidth * 0.82));
  el.scrollBy({
    left: dir === "left" ? -step : step,
    behavior: "smooth",
  });
}
  function fireToast(msg: string) {
    setToast(msg);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 2200);
  }
  useEffect(() => {
    let alive = true;

    (async () => {
      const targets = rows
        .map((p) => ({ p, slug: s(p?.slug) }))
        .filter(({ p, slug }) => slug && needsHydrate(p) && !fullMap[slug])
        .slice(0, 24);

      if (!targets.length) return;

      const next: Record<string, any> = {};
      for (const { slug } of targets) {
        try {
          const qs = await getDocs(
            query(collection(db, "products"), where("slug", "==", slug), limit(1))
          );
          if (!alive) return;
          if (!qs.empty) {
            const d = qs.docs[0];
            next[slug] = { id: d.id, ...(d.data() as any) };
          }
        } catch {
          //
        }
      }

      if (!alive) return;
      if (Object.keys(next).length) setFullMap((m) => ({ ...m, ...next }));
    })();

    return () => {
      alive = false;
    };
  }, [db, rows, fullMap]);
useEffect(() => {
  if (mode !== "carousel") return;

  const el = carouselRef.current;
  if (!el) return;

  updateCarouselNav();

  const onScroll = () => updateCarouselNav();
  const onResize = () => updateCarouselNav();

  el.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  return () => {
    el.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
  };
}, [mode, rows.length]);
 if (loading) {
  return (
    <div className={mode === "carousel" ? styles.carousel : styles.grid}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkelCard key={i} />
      ))}
    </div>
  );
}

  if (!rows.length) {
    return <div className={styles.empty}>{t("no_products") || "Ürün bulunamadı."}</div>;
  }
  function getCurrentCartQty(productId: string, uid?: string | null) {
    try {
      const items = getCart(uid || null);
      return items
        .filter((it) => String(it?.id || "").trim() === String(productId || "").trim())
        .reduce((sum, it) => sum + Math.max(1, Number(it?.qty || 1)), 0);
    } catch {
      return 0;
    }
  }
  function addToLocalCart(pRaw: any, qty = 1) {
    const slug = slugOf(pRaw);
    const p = fullMap[slug] ?? pRaw;
  
    const key = productIdOf(p);
    const slugKey = slugOf(p);
    const title =
      safePickText(p?.title, loc) ||
      p?.title?.tr ||
      p?.title ||
      p?.name ||
      "Ürün";
  
    const imgs = imgList(p);
    const img1 = imgs[0] || "";
  
    const { price, compareAtPrice } = resolveProductPriceTRY(p, rates); // eslint-disable-line @typescript-eslint/no-unused-vars
  
    const stock = Math.max(0, Number(p?.stock ?? 0));
    if (stock <= 0) {
      fireToast(loc === "en" ? "Out of stock" : "Stokta yok");
      return;
    }
  
    const currentQty = getCurrentCartQty(
      key,
      user && !user.isAnonymous ? user.uid : null
    );
  
    const wantedQty = Math.max(1, Number(qty || 1));
    const nextQty = currentQty + wantedQty; // eslint-disable-line @typescript-eslint/no-unused-vars
  
    if (currentQty >= stock) {
      fireToast(
        loc === "en"
          ? `Maximum stock reached (${stock})`
          : `Maksimum stok adedine ulaşıldı (${stock})`
      );
      return;
    }
  
    const addableQty = Math.min(wantedQty, stock - currentQty);
  
    addToCart(
      {
        id: key,
        title: String(title),
        priceTry: Number(price ?? 0),
        qty: clampQty(addableQty),
        image: img1 || undefined,
        slug: slugKey || key,
      },
      user && !user.isAnonymous ? user.uid : null
    );
  }
  async function createStockAlert(pRaw: any) {
    const slug = slugOf(pRaw);
    const p = fullMap[slug] ?? pRaw;
  
    const productId = productIdOf(p);
    const productSlug = slugOf(p) || productId;
  
    if (!productId) {
      fireToast(loc === "en" ? "Product ID missing." : "Ürün kimliği bulunamadı.");
      return;
    }
  
    if (!user || user.isAnonymous) {
      fireToast(loc === "en" ? "Please login first." : "Önce giriş yapman gerekiyor.");
      return;
    }
  
    if (alertMap[productId]) {
      fireToast(loc === "en" ? "Alert already active." : "Bildirim zaten aktif.");
      return;
    }
  
    const title = // eslint-disable-line @typescript-eslint/no-unused-vars
      safePickText(p?.title, loc) ||
      p?.title?.tr ||
      p?.title ||
      p?.name ||
      "Ürün";
  
    const imgs = imgList(p);
    const img1 = imgs[0] || "";
  
 const { price, compareAtPrice } = resolveProductPriceTRY(p, rates); // eslint-disable-line @typescript-eslint/no-unused-vars
  
    setAlertBusyId(productId);
  
    try {
      await addDoc(collection(db, "stock_alerts"), {
        uid: user.uid,
        email: String(user.email || "").trim(),
        phone: "",
        productId,
        productSlug,
        productSku: String(p?.sku || p?.code || p?.productCode || "").trim(),
        productImage: img1,
        productTitle: {
          tr: String(p?.title?.tr || p?.title || p?.name || "Ürün").trim(),
          en: String(p?.title?.en || p?.title || p?.name || "Product").trim(),
        },
        lastKnownStock: Number(p?.stock ?? 0),
        lastKnownPriceTry: Number(price ?? 0),
        locale: [loc === "en" ? "en" : "tr"],
        source: ["product", "grid"],
        status: "active",
        notifiedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  
      fireToast(loc === "en" ? "Stock alert created ✅" : "Stok bildirimi oluşturuldu ✅");
    } catch (e: any) {
      console.error("stock alert create error:", e);
      fireToast(
        e?.message ||
          (loc === "en"
            ? "Stock alert could not be created."
            : "Stok bildirimi oluşturulamadı.")
      );
    } finally {
      setAlertBusyId("");
    }
  }
  return (
  <>
    {toast ? (
      <div className={styles.toast} role="status" aria-live="polite">
        <div className={styles.toastInner}>
          <span className={styles.toastDot} />
          <span>{toast}</span>
        </div>
      </div>
    ) : null}

    {mode === "carousel" ? (
      <div className={styles.carouselShell}>
        <button
          type="button"
          className={`${styles.carouselArrow} ${styles.carouselArrowLeft} ${!canScrollLeft ? styles.carouselArrowHidden : ""}`}
          onClick={() => scrollCarousel("left")}
          aria-label={loc === "en" ? "Scroll left" : "Sola kaydır"}
        >
          <span>‹</span>
        </button>

        <div ref={carouselRef} className={styles.carousel}>
          {rows.map((pRaw: any) => {
            const slug = slugOf(pRaw);
            const p = fullMap[slug] ?? pRaw;

            const productId = productIdOf(p);
            const slugKey = slugOf(p) || productId;
            const href = `/products/${encodeURIComponent(slugKey)}`;

            const title =
              safePickText(p?.title, loc) ||
              p?.title?.tr ||
              p?.title ||
              p?.name ||
              "-";

            const imgs = imgList(p);
            const img1 = imgs[0] || "";
            const img2 = imgs[1] || imgs[0] || "";

            const stock = typeof p?.stock === "number" ? p.stock : Number(p?.stock ?? 0);
            const canBuy = stock > 0;

            const skuText = s(p?.sku || p?.code || p?.productCode || "");
            const badgeIconUrl = s(p?.badgeIconUrl);
           const { price, compareAtPrice } = resolveProductPriceTRY(p, rates);

            const hasRates = !!rates?.items?.length;
            const isDynamic =
              hasRates &&
              !p?.priceOverrideEnabled &&
              (p?.priceMode === "rate_plus" || p?.priceMode === "rate_plus_fixed") &&
              !!p?.priceRateCode;

            const favOn = productId ? fav.has(productId) : false;
            const alertOn = productId ? !!alertMap[productId] : false;
            const alertBusy = productId ? alertBusyId === productId : false;

            return (
              <article
                key={productId || href}
                className={`${styles.card} ${cardClassName} ${!canBuy ? styles.cardOutOfStock : ""}`}
              >
                <Link href={href} className={`${styles.media} ${!canBuy ? styles.mediaOutOfStock : ""}`}>
                  {skuText ? <div className={styles.skuPill}>{skuText}</div> : null}

                  {isDynamic ? (
                    <div className={styles.dynamicPill}>
                      {loc === "en" ? "Dynamic" : "Dinamik"}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className={`${styles.fav} ${favOn ? styles.favOn : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!productId) return;
                      fav.toggle(productId, {
                        title: String(title),
                        image: img1 || undefined,
                        price: Number(price ?? 0),
                        currency: "TRY",
                      });
                    }}
                    aria-label={loc === "en" ? "Favorite" : "Favori"}
                    title={loc === "en" ? "Favorite" : "Favori"}
                  >
                    <HeartIcon filled={favOn} />
                  </button>

                  {badgeIconUrl ? (
                    <div className={styles.badgeIcon} title={loc === "en" ? "Badge" : "Etiket"}>
                      <img src={badgeIconUrl} alt="" loading="lazy" />
                    </div>
                  ) : null}

                  {img1 ? (
                    <>
                      <img className={styles.img1} src={img1} alt={String(title)} loading="lazy" />
                      <img className={styles.img2} src={img2 || img1} alt={String(title)} loading="lazy" />
                    </>
                  ) : (
                    <div className={styles.noImg}>
                      {loc === "en" ? "No image" : "Görsel yok"}
                    </div>
                  )}
                </Link>

                <div className={styles.body}>
                  <div className={styles.topMeta}>
                    <span className={`${styles.stockPill} ${canBuy ? styles.stockOk : styles.stockNo}`}>
                      {canBuy
                        ? loc === "en"
                          ? `Stock: ${stock}`
                          : `Stok: ${stock}`
                        : loc === "en"
                        ? "Out of stock"
                        : "Stok yok"}
                    </span>

                    <span className={styles.currencyPill}>TRY</span>
                  </div>

                  <Link href={href} className={styles.titleLink}>
                    <h3 className={styles.title}>{title}</h3>
                  </Link>

                <div className={styles.priceRow}>
  {compareAtPrice ? (
    <div className={styles.comparePrice}>{formatTRY(compareAtPrice, 2)}</div>
  ) : null}

  <div className={styles.price}>{formatTRY(price, 2)}</div>
</div>

                  <div className={styles.bottomRow}>
                    {canBuy ? (
                      <button
                        className={styles.btnCart}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addToLocalCart(pRaw, 1);
                        }}
                      >
                        {loc === "en" ? "Add to Cart" : "Sepete Ekle"}
                      </button>
                    ) : (
                      <button
                        className={`${styles.btnCart} ${styles.btnNotify} ${alertOn ? styles.btnNotifyActive : ""}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          createStockAlert(pRaw);
                        }}
                        disabled={alertBusy || alertOn}
                      >
                        {alertBusy
                          ? loc === "en"
                            ? "Saving..."
                            : "Kaydediliyor..."
                          : alertOn
                          ? loc === "en"
                            ? "Alert Active"
                            : "Bildirim Aktif"
                          : loc === "en"
                          ? "Notify Me"
                          : "Gelince Haber Ver"}
                      </button>
                    )}

                    <Link href={href} className={styles.btnDetail}>
                      {loc === "en" ? "Detail" : "Detay"}
                    </Link>
                  </div>

                  <div className={styles.hint}>
                    {!canBuy
                      ? loc === "en"
                        ? "Get notified when it is back in stock"
                        : "Stoğa gelince bildirim al"
                      : isDynamic
                      ? loc === "en"
                        ? "Live rate pricing"
                        : "Canlı kur fiyatlaması"
                      : loc === "en"
                      ? "Fast shipping"
                      : "Hızlı kargo"}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className={`${styles.carouselArrow} ${styles.carouselArrowRight} ${!canScrollRight ? styles.carouselArrowHidden : ""}`}
          onClick={() => scrollCarousel("right")}
          aria-label={loc === "en" ? "Scroll right" : "Sağa kaydır"}
        >
          <span>›</span>
        </button>
      </div>
    ) : (
      <div className={styles.grid}>
        {rows.map((pRaw: any) => {
          const slug = slugOf(pRaw);
          const p = fullMap[slug] ?? pRaw;

          const productId = productIdOf(p);
          const slugKey = slugOf(p) || productId;
          const href = `/products/${encodeURIComponent(slugKey)}`;

          const title =
            safePickText(p?.title, loc) ||
            p?.title?.tr ||
            p?.title ||
            p?.name ||
            "-";

          const imgs = imgList(p);
          const img1 = imgs[0] || "";
          const img2 = imgs[1] || imgs[0] || "";

          const stock = typeof p?.stock === "number" ? p.stock : Number(p?.stock ?? 0);
          const canBuy = stock > 0;

          const skuText = s(p?.sku || p?.code || p?.productCode || "");
          const badgeIconUrl = s(p?.badgeIconUrl);
          const { price, compareAtPrice } = resolveProductPriceTRY(p, rates);

          const hasRates = !!rates?.items?.length;
          const isDynamic =
            hasRates &&
            !p?.priceOverrideEnabled &&
            (p?.priceMode === "rate_plus" || p?.priceMode === "rate_plus_fixed") &&
            !!p?.priceRateCode;

          const favOn = productId ? fav.has(productId) : false;
          const alertOn = productId ? !!alertMap[productId] : false;
          const alertBusy = productId ? alertBusyId === productId : false;

          return (
            <article
  key={productId || href}
  className={`${styles.card} ${cardClassName} ${!canBuy ? styles.cardOutOfStock : ""}`}
>
  <Link href={href} className={`${styles.media} ${!canBuy ? styles.mediaOutOfStock : ""}`}>
    {skuText ? <div className={styles.skuPill}>{skuText}</div> : null}

    {isDynamic ? (
      <div className={styles.dynamicPill}>
        {loc === "en" ? "Dynamic" : "Dinamik"}
      </div>
    ) : null}

    <button
      type="button"
      className={`${styles.fav} ${favOn ? styles.favOn : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!productId) return;
        fav.toggle(productId, {
          title: String(title),
          image: img1 || undefined,
          price: Number(price ?? 0),
          currency: "TRY",
        });
      }}
      aria-label={loc === "en" ? "Favorite" : "Favori"}
      title={loc === "en" ? "Favorite" : "Favori"}
    >
      <HeartIcon filled={favOn} />
    </button>

    {badgeIconUrl ? (
      <div className={styles.badgeIcon} title={loc === "en" ? "Badge" : "Etiket"}>
        <img src={badgeIconUrl} alt="" loading="lazy" />
      </div>
    ) : null}

    {img1 ? (
      <>
        <img className={styles.img1} src={img1} alt={String(title)} loading="lazy" />
        <img className={styles.img2} src={img2 || img1} alt={String(title)} loading="lazy" />
      </>
    ) : (
      <div className={styles.noImg}>
        {loc === "en" ? "No image" : "Görsel yok"}
      </div>
    )}
  </Link>

  <div className={styles.body}>
    <div className={styles.topMeta}>
      <span className={`${styles.stockPill} ${canBuy ? styles.stockOk : styles.stockNo}`}>
        {canBuy
          ? loc === "en"
            ? `Stock: ${stock}`
            : `Stok: ${stock}`
          : loc === "en"
          ? "Out of stock"
          : "Stok yok"}
      </span>

      <span className={styles.currencyPill}>TRY</span>
    </div>

    <Link href={href} className={styles.titleLink}>
      <h3 className={styles.title}>{title}</h3>
    </Link>

    <div className={styles.priceRow}>
      {compareAtPrice ? (
        <div className={styles.comparePrice}>{formatTRY(compareAtPrice, 2)}</div>
      ) : null}

      <div className={styles.price}>{formatTRY(price, 2)}</div>
    </div>

    <div className={styles.bottomRow}>
      {canBuy ? (
        <button
          className={styles.btnCart}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToLocalCart(pRaw, 1);
          }}
        >
          {loc === "en" ? "Add to Cart" : "Sepete Ekle"}
        </button>
      ) : (
        <button
          className={`${styles.btnCart} ${styles.btnNotify} ${alertOn ? styles.btnNotifyActive : ""}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            createStockAlert(pRaw);
          }}
          disabled={alertBusy || alertOn}
        >
          {alertBusy
            ? loc === "en"
              ? "Saving..."
              : "Kaydediliyor..."
            : alertOn
            ? loc === "en"
              ? "Alert Active"
              : "Bildirim Aktif"
            : loc === "en"
            ? "Notify Me"
            : "Gelince Haber Ver"}
        </button>
      )}

      <Link href={href} className={styles.btnDetail}>
        {loc === "en" ? "Detail" : "Detay"}
      </Link>
    </div>

    <div className={styles.hint}>
      {!canBuy
        ? loc === "en"
          ? "Get notified when it is back in stock"
          : "Stoğa gelince bildirim al"
        : isDynamic
        ? loc === "en"
          ? "Live rate pricing"
          : "Canlı kur fiyatlaması"
        : loc === "en"
        ? "Fast shipping"
        : "Hızlı kargo"}
    </div>
  </div>
</article>
          );
        })}
      </div>
    )}
  </>
);
}