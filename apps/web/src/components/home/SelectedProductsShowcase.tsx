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
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";

import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { addToCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { resolveProductPriceTRY, type RatesLatest, formatTRY } from "@/lib/pricing";
import { useT } from "@/lib/useT";
import styles from "./SelectedProductsShowcase.module.css";

type ProductItem = {
  id: string;
  title?: string | { tr?: string; en?: string };
  brand?: string;
  slug?: string;
  image?: string;
  images?: string[];
  mainImage?: string;
  cover?: string;
  thumbnail?: string;

  price?: number;
  priceTry?: number;
  unitPriceTry?: number;

  stock?: number;
  sku?: string;
  isActive?: boolean;

  dynamicPricing?: boolean;
  rateKey?: string;
  priceRateCode?: string;
  pricing?: {
    enabled?: boolean;
    dynamic?: boolean;
    mode?: string;
    type?: string;
    model?: string;
    useLiveRates?: boolean;
    rateKey?: string;
    rateCode?: string;
  };

  categoryPricing?: any;
  resolvedCategoryPricing?: any;

  homeGroup?: string;
  homeGroupLabel?: string;
  isFeaturedHome?: boolean;
  order?: number;
  updatedAt?: any;
};

function asArr<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function s(v: any) {
  return String(v ?? "").trim();
}

function pickText(v: any, loc: "tr" | "en" = "tr") {
  if (!v) return "";
  if (typeof v === "string") return String(v).trim();

  if (typeof v === "object") {
    const tr = String(v?.tr ?? "").trim();
    const en = String(v?.en ?? "").trim();
    return loc === "en" ? (en || tr) : (tr || en);
  }

  return "";
}

function imgList(p: any): string[] {
  const arr = asArr<string>(p?.images);
  const merged = [p?.mainImage, p?.image, p?.cover, p?.thumbnail, ...arr]
    .filter((x) => typeof x === "string")
    .map((x) => s(x))
    .filter(Boolean);

  return Array.from(new Set(merged));
}

function pickImage(p: any) {
  return imgList(p)[0] || "";
}

function fallbackPrice(p: any) {
  return Number(
    p?.finalPrice ??
      p?.unitPriceTry ??
      p?.priceTry ??
      p?.price ??
      p?.salePrice ??
      p?.pricing?.finalPrice ??
      0
  ) || 0;
}

function slugOf(p: any) {
  return s(p?.slug) || s(p?.id) || "";
}

function productIdOf(p: any) {
  return s(p?.id) || s(p?.slug) || "";
}


function getSafeStock(stock: any) {
  const n = Math.floor(Number(stock ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function groupLabel(key: string, loc: "tr" | "en" = "tr") {

  switch (key) {

    case "new":

      return loc === "en" ? "New Models" : "Yeni Modeller";

    case "elegance":

      return "Elegance";

    case "lifestyle":

      return loc === "en" ? "lifestyle Selection" : "Takı Seçkisi";

    default:

      return key || (loc === "en" ? "Selections" : "Seçkiler");

  }

}

function needsHydrate(p: any) {
  return (
    p?.price == null ||
    p?.priceTry == null ||
    p?.unitPriceTry == null ||
    p?.dynamicPricing == null ||
    p?.pricing == null ||
    p?.stock == null
  );
}

function productUsesRates(p: any) {
  const pricing = p?.pricing || {};
  const catPricing = p?.categoryPricing || p?.resolvedCategoryPricing || {};

  const ownDynamic =
    p?.dynamicPricing === true ||
    p?.priceMode === "dynamic" ||
    p?.pricingMode === "dynamic" ||
    pricing?.dynamic === true ||
    pricing?.mode === "dynamic" ||
    pricing?.type === "dynamic";

  const ownRateEnabled =
    pricing?.enabled === true &&
    (pricing?.model === "gram" ||
      pricing?.useLiveRates === true ||
      !!pricing?.rateKey ||
      !!pricing?.rateCode);

  const categoryRateEnabled =
    catPricing?.enabled === true &&
    (catPricing?.dynamic === true ||
      catPricing?.mode === "dynamic" ||
      catPricing?.type === "dynamic" ||
      catPricing?.model === "gram" ||
      !!catPricing?.rateKey ||
      !!catPricing?.rateCode);

  return ownDynamic || ownRateEnabled || categoryRateEnabled;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M20.8 4.6c-1.5-1.4-3.9-1.4-5.4 0L12 8l-3.4-3.4c-1.5-1.4-3.9-1.4-5.4 0-1.6 1.6-1.6 4.1 0 5.7L12 21l8.8-10.7c1.6-1.6 1.6-4.1 0-5.7z" />
    </svg>
  );
}



function SkelCard() {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`}>
      <div className={styles.skeletonImage} />
      <div className={styles.meta}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineWide} />
        <div className={styles.skeletonLineShort} />
      </div>
      <div className={styles.actionRow}>
        <div className={styles.skeletonBtn} />
        <div className={styles.skeletonBtn} />
      </div>
    </div>
  );
}
function ProductMedia({
  item,
  title,
  visualLabel,
}: {
  item: any;
  title: string;
  visualLabel: string;
}) {
  const imgs = imgList(item);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    setActiveImg(0);
  }, [item?.id]);

  const current = imgs[activeImg] || "";

  return (
    <div
      className={styles.imageWrap}
      onMouseEnter={() => {
        if (imgs.length > 1) setActiveImg(1);
      }}
      onMouseLeave={() => setActiveImg(0)}
    >
      {current ? (
        <img src={current} alt={title} className={styles.image} loading="lazy" />
      ) : (
        <div className={styles.imageFallback}>DROMOCOB</div>
      )}

      {imgs.length > 1 ? (
        <div className={styles.mediaDots}>
          {imgs.slice(0, 4).map((_: string, i: number) => (
            <button
              key={i}
              type="button"
              className={`${styles.mediaDot} ${i === activeImg ? styles.mediaDotActive : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImg(i);
              }}
              aria-label={`${visualLabel} ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
export default function SelectedProductsShowcase() {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);
  const railRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [ratesDoc, setRatesDoc] = useState<RatesLatest | null>(null);
  const [fullMap, setFullMap] = useState<Record<string, any>>({});
const [activeSlide, setActiveSlide] = useState(0);
  const [toast, setToast] = useState("");
  const [alertBusyId, setAlertBusyId] = useState("");
  const [alertMap, setAlertMap] = useState<Record<string, boolean>>({});
  const { loc } = useT();
    const ui = useMemo(
    () => ({
      product: loc === "en" ? "Product" : "Ürün",
      brand: loc === "en" ? "Dromocob" : "Dromocob",
      newModels: loc === "en" ? "New Models" : "Yeni Modeller",
      lifestyleSelection: loc === "en" ? "lifestyle Selection" : "Takı Seçkisi",
      selections: loc === "en" ? "Selections" : "Seçkiler",

      visualLabel: loc === "en" ? "Image" : "Görsel",
      previous: loc === "en" ? "Previous" : "Önceki",
      next: loc === "en" ? "Next" : "Sonraki",

      favorite: loc === "en" ? "Favorite" : "Favori",
      addToFavorites: loc === "en" ? "Add to favorites" : "Favorilere ekle",

      soldOut: loc === "en" ? "SOLD OUT" : "TÜKENDİ",
      specialPrice: loc === "en" ? "Special Price" : "Özel Fiyat",
      live: loc === "en" ? "Live" : "Canlı",

      addToCart: loc === "en" ? "Add to Cart" : "Sepete Ekle",
      saving: loc === "en" ? "Saving..." : "Kaydediliyor...",
      alertActive: loc === "en" ? "Alert Active" : "Bildirim Aktif",
     notifyMe: loc === "en" ? "Notify Me" : "Haber Ver",

      notifyHint: loc === "en" ? "Get notified when back in stock" : "Stoğa gelince bildirim al",
      livePricingHint: loc === "en" ? "Live rate pricing" : "Canlı kur fiyatlaması",
      fastShipping: loc === "en" ? "Fast shipping" : "Hızlı kargo",

      noStock: loc === "en" ? "Out of stock" : "Stok yok",
      addedToCart: loc === "en" ? "Added to cart ✅" : "Sepete eklendi ✅",
      addToCartError: loc === "en" ? "Could not add to cart" : "Sepete eklenemedi",

      missingProductInfo: loc === "en" ? "Missing product info" : "Ürün bilgisi eksik",
      loginRequired: loc === "en" ? "You need to sign in first" : "Önce giriş yapman gerekiyor",
      alertAlreadyActive: loc === "en" ? "Alert already active" : "Bildirim zaten aktif",
      alertCreated: loc === "en" ? "Stock alert created ✅" : "Stok bildirimi oluşturuldu ✅",
      alertCreateError: loc === "en" ? "Could not create stock alert" : "Stok bildirimi oluşturulamadı",

      emptyTab: loc === "en" ? "No products to show in this tab." : "Bu sekmede gösterilecek ürün yok.",
    }),
    [loc]
  );
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const fav = useFavorites(user && !user.isAnonymous ? user.uid : null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRatesDoc(snap.exists() ? (snap.data() as RatesLatest) : null),
      () => setRatesDoc(null)
    );
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setAlertMap({});
      return;
    }

    const qy = query(collection(db, "stock_alerts"), where("uid", "==", user.uid));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next: Record<string, boolean> = {};
        snap.forEach((d) => {
          const x: any = d.data();
          const pid = String(x?.productId || "").trim();
          const status = String(x?.status || "active").trim();
          if (pid && status === "active") next[pid] = true;
        });
        setAlertMap(next);
      },
      () => setAlertMap({})
    );

    return () => unsub();
  }, [db, user]);

  function fireToast(msg: string) {
    setToast(msg);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 2400);
  }

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      setLoading(true);

      const ref = collection(db, "products");
      const qs = await getDocs(
        query(
          ref,
          where("isActive", "==", true),
          where("showcase.enabled", "==", true),
          orderBy("showcase.order", "asc"),
          limit(40)
        )
      );

      if (!alive) return;

      const base = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      const expanded: ProductItem[] = [];

      base.forEach((p: any) => {
        const groups = Array.isArray(p?.showcase?.groups) ? p.showcase.groups : [];
        const cleanGroups = groups.map((x: any) => String(x || "").trim()).filter(Boolean);

        cleanGroups.forEach((groupKey: string) => {
          expanded.push({
            ...p,
            homeGroup: groupKey,
            homeGroupLabel: groupLabel(groupKey, loc),
            order: Number(p?.showcase?.order ?? p?.order ?? 9999),
          });
        });
      });

      expanded.sort((a, b) => {
        const ao = Number(a?.order ?? 9999);
        const bo = Number(b?.order ?? 9999);
        if (ao !== bo) return ao - bo;
        return String(pickText(a?.title, loc)).localeCompare(String(pickText(b?.title, loc)), loc === "en" ? "en" : "tr");
      });

      setItems(expanded);
    } catch (err) {
      console.error("selected products load error:", err);
      if (alive) setItems([]);
    } finally {
      if (alive) setLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [db, loc]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const targets = items
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
  }, [db, items, fullMap]);

const tabs = useMemo(() => {
  const preferred = [
    { key: "new", label: ui.newModels },
    { key: "elegance", label: "Elegance" },
  ];
  const existing = new Set(items.map((x) => String(x.homeGroup || "").trim()).filter(Boolean));
  const result = preferred.filter((x) => existing.has(x.key));

  return result.length ? result : preferred;
}, [items, ui.newModels]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  const filtered = useMemo(() => {
    return items.filter((x) => String(x.homeGroup) === activeTab);
  }, [items, activeTab]);

const pricedItems = useMemo(() => {
  return filtered.map((item) => {
    const hydrated = fullMap[s(item.slug)] ?? item;
    const resolved = resolveProductPriceTRY(hydrated, ratesDoc);

    const resolvedPrice = Number(resolved?.price ?? 0);
    const basePrice = fallbackPrice(hydrated);
    const usesRates = productUsesRates(hydrated);

    const finalPrice =
      resolvedPrice > 0
        ? resolvedPrice
        : usesRates && !ratesDoc
        ? 0
        : basePrice;

    return {
      ...hydrated,
      finalPrice,
      compareAtPrice: Number(resolved?.compareAtPrice ?? 0) || 0,
      dynamicResolved: usesRates && resolvedPrice > 0,
      pricePending: usesRates && finalPrice <= 0,
    };
  });
}, [filtered, fullMap, ratesDoc]);
useEffect(() => {
  const el = railRef.current;
  if (!el) return;

  const onScroll = () => {
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;

    const scrollLeft = el.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Infinity;

    children.forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - scrollLeft);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = i;
      }
    });

    setActiveSlide(closestIndex);
  };

  onScroll();
  el.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    el.removeEventListener("scroll", onScroll);
  };
}, [pricedItems.length, activeTab]);
  function scrollRail(dir: "left" | "right") {
  const el = railRef.current;
  if (!el) return;

  const amount = window.innerWidth <= 768
    ? el.clientWidth
    : Math.round(el.clientWidth * 0.82);

  el.scrollBy({
    left: dir === "right" ? amount : -amount,
    behavior: "smooth",
  });
}

  function handleAddToCart(item: any) {
    try {
      const slugKey = slugOf(item);
      const productId = productIdOf(item);
      const title = pickText(item.title, loc) || ui.product;
      const image = pickImage(item);
const stock = getSafeStock(item?.stock);

if (stock <= 0) {
  fireToast(ui.noStock);
  return;
}

if (Number(item.finalPrice ?? 0) <= 0) {
  fireToast(loc === "en" ? "Price is being updated." : "Fiyat güncelleniyor.");
  return;
}
      if (stock <= 0) {
       fireToast(ui.noStock);
        return;
      }
  
      addToCart(
        {
          id: productId || slugKey,
          title: String(title),
          priceTry: Number(item.finalPrice ?? 0),
          qty: 1,
          stock,
          image: image || undefined,
          slug: slugKey || productId,
        },
        user && !user.isAnonymous ? user.uid : null
      );
  
      window.dispatchEvent(new Event("cart:changed"));
      window.dispatchEvent(new Event("storage"));
      fireToast(ui.addedToCart);
    } catch (err) {
      console.error("selected showcase addToCart error:", err);
      fireToast(ui.addToCartError);
    }
  }

  async function createStockAlert(item: any) {
    const productId = productIdOf(item);
    const slugKey = slugOf(item);

    if (!productId) {
      fireToast(ui.missingProductInfo);
      return;
    }

    if (!user || user.isAnonymous) {
      fireToast(ui.loginRequired);
      return;
    }

    if (alertMap[productId]) {
      fireToast(ui.alertAlreadyActive);
      return;
    }

  
    const image = pickImage(item);
    const price = Number(item?.finalPrice ?? fallbackPrice(item) ?? 0);

    setAlertBusyId(productId);

    try {
      await addDoc(collection(db, "stock_alerts"), {
        uid: user.uid,
        email: String(user.email || "").trim(),
        phone: "",
        productId,
        productSlug: slugKey || productId,
        productSku: String(item?.sku || "").trim(),
        productImage: image || "",
       productTitle: {

  tr: pickText(item?.title, "tr") || String(item?.name || "Ürün").trim(),

  en: pickText(item?.title, "en") || String(item?.name || "Product").trim(),

},
        lastKnownStock: Number(item?.stock ?? 0),
        lastKnownPriceTry: price,
        locale: [loc === "en" ? "en" : "tr"],
        source: ["home", "showcase"],
        status: "active",
        notifiedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      fireToast(ui.alertCreated);
    } catch (e: any) {
      console.error("showcase stock alert create error:", e);
      fireToast(e?.message || ui.alertCreateError);
    } finally {
      setAlertBusyId("");
    }
  }

  return (
    <section className={styles.section}>
      <div className="px-container">
        <div className={styles.wrap}>
          {toast ? (
            <div className={styles.toast} role="status" aria-live="polite">
              <div className={styles.toastInner}>
                <span className={styles.toastDot} />
                <span>{toast}</span>
              </div>
            </div>
          ) : null}

          <div className={styles.head}>
            <div className={styles.tabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.sliderArea}>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navLeft}`}
              onClick={() => scrollRail("left")}
              aria-label={ui.previous}
            >
              ‹
            </button>

            <div ref={railRef} className={styles.rail}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkelCard key={i} />)
              ) : pricedItems.length ? (
                pricedItems.map((item) => {
                  const slugKey = slugOf(item);
                  const productId = productIdOf(item);
                  const href = slugKey ? `/products/${encodeURIComponent(slugKey)}` : "#";
                  const image = pickImage(item);
                  const title = pickText(item.title, loc) || ui.product;
                  const brand = s(item.brand) || ui.brand;
                  const favOn = productId ? fav.has(productId) : false;

                  const stock = getSafeStock(item?.stock);
                  const canBuy = stock > 0;

                  const alertOn = productId ? !!alertMap[productId] : false;
                  const alertBusy = productId ? alertBusyId === productId : false;

                  return (
                    <article
                      key={item.id || slugKey}
                      className={`${styles.card} ${!canBuy ? styles.cardOutOfStock : ""}`}
                    >
                      <Link href={href} className={`${styles.cardLink} ${!canBuy ? styles.mediaOutOfStock : ""}`}>
                     <div className={canBuy ? "" : styles.mediaOutOfStock}>
<ProductMedia item={item} title={title} visualLabel={ui.visualLabel} />

  <button
    type="button"
    className={`${styles.favFloat} ${favOn ? styles.favFloatActive : ""}`}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!productId) return;

      fav.toggle(productId, {
        title: String(title),
        image: image || undefined,
        price: Number(item.finalPrice ?? 0),
        currency: "TRY",
      });
    }}
    aria-label={ui.favorite}
    title={ui.favorite}
  >
    <HeartIcon filled={favOn} />
  </button>
</div>

                        <div className={styles.meta}>
  <div className={styles.brandRow}>
    <div className={styles.brand}>{brand}</div>

    {!canBuy ? (
     <span className={styles.stockMiniBadge}>{ui.soldOut}</span>
    ) : null}
  </div>

  <h3 className={styles.title}>{title}</h3>

  <div className={styles.priceBlock}>
    <div className={styles.priceTop}>
      <span className={styles.priceLabel}>{ui.specialPrice}</span>
      {item.dynamicResolved ? (
        <span className={styles.liveBadge}>{ui.live}</span>
      ) : null}
    </div>

   <div className={styles.priceRow}>
  {Number(item.compareAtPrice ?? 0) > Number(item.finalPrice ?? 0) ? (
    <div className={styles.comparePrice}>
      {formatTRY(Number(item.compareAtPrice ?? 0), 2)}
    </div>
  ) : null}

 <div className={styles.price}>
  {Number(item.finalPrice ?? 0) > 0
    ? formatTRY(Number(item.finalPrice ?? 0), 2)
    : loc === "en"
    ? "Rate pending"
    : "Kur bekleniyor"}
</div>
</div>
  </div>
</div>
                      </Link>

                      <div className={styles.actionRow}>
                        {canBuy ? (
                          <button
                            type="button"
                            className={styles.cartBtn}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddToCart(item);
                            }}
                          >
                           {ui.addToCart}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.cartBtn} ${styles.notifyBtn} ${alertOn ? styles.notifyBtnActive : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              createStockAlert(item);
                            }}
                            disabled={alertBusy || alertOn}
                          >
                           {alertBusy
                            ? ui.saving
                            : alertOn
                            ? ui.alertActive
                            : ui.notifyMe}
                          </button>
                        )}

                        <button
                          type="button"
                          className={`${styles.favBtn} ${favOn ? styles.favBtnActive : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!productId) return;

                            fav.toggle(productId, {
                              title: String(title),
                              image: image || undefined,
                              price: Number(item.finalPrice ?? 0),
                              currency: "TRY",
                            });
                          }}
                         aria-label={ui.addToFavorites}
                          title={ui.addToFavorites}
                        >
                          <HeartIcon filled={favOn} />
                        </button>
                      </div>

                      <div className={styles.hint}>
                        {!canBuy
                        ? ui.notifyHint
                        : item.dynamicResolved
                        ? ui.livePricingHint
                        : ui.fastShipping}
                      </div>
                    </article>
                  );
                })
              ) : (
              <div className={styles.empty}>{ui.emptyTab}</div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.navBtn} ${styles.navRight}`}
              onClick={() => scrollRail("right")}
              aria-label={ui.next}
            >
              ›
            </button>
          </div>

          <div className={styles.dots}>
  {pricedItems.map((_, i) => (
    <span
      key={i}
      className={`${styles.dot} ${i === activeSlide ? styles.dotActive : ""}`}
    />
  ))}
</div>
        </div>
      </div>
    </section>
  );
}