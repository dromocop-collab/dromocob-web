"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  calcCampaignDiscount,
  normalizeCampaigns,
  pickCampaignText,
  type StoreCampaign,
} from "@/lib/campaigns";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { CartItem, addToCart, getCart, removeFromCart, setQty, setCartExpiryHoursCache, updateCartItem } from "@/lib/cart";
import {
  saveCartItemToFirestore,
  deleteCartItemFromFirestore,
} from "@/lib/cartFirestore";
import s from "./cart.module.css";
import CartRecommendations from "./CartRecommendations";
import { onIdTokenChanged, type User } from "firebase/auth";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { runCartExpiryCheck } from "@/lib/cartExpiry";

const FALLBACK_IMG = "/dromocob-mark.svg";
const TIMER_KEY = "nci_cart_timer_v1";

/* -------------------- utils -------------------- */
function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function fmtTRY(n: number) {
  const v = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    return `₺${v.toFixed(2)}`;
  }
}

function clampQty(n: number) {
  const x = Number(n ?? 1);
  if (!Number.isFinite(x)) return 1;
  return Math.max(1, Math.min(99, Math.floor(x)));
}

type TimerState = { nextAt: number; total: number };
function safeImageSrc(src?: string) {
  const v = String(src || "").trim();

  if (!v) return FALLBACK_IMG;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return v;

  return `/${v.replace(/^\/+/, "")}`;
}

function getBundleImage(p: any) {
  return safeImageSrc(
    p?.image ||
    p?.mainImage ||
    p?.cover ||
    p?.thumbnail ||
    (Array.isArray(p?.images) ? p.images[0] : "") ||
    FALLBACK_IMG
  );
}
function loadTimer(total: number): TimerState {
  const t = nowSec();
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<TimerState>) : null;
    const storedNextAt = Number(parsed?.nextAt ?? 0);
    const storedTotal = Number(parsed?.total ?? 0);

    if (!Number.isFinite(storedTotal) || storedTotal !== total) {
      const nextAt = t + total;
      const st = { nextAt, total };
      localStorage.setItem(TIMER_KEY, JSON.stringify(st));
      return st;
    }

    if (Number.isFinite(storedNextAt) && storedNextAt > t) {
      return { nextAt: storedNextAt, total };
    }

    const nextAt = t + total;
    const st = { nextAt, total };
    localStorage.setItem(TIMER_KEY, JSON.stringify(st));
    return st;
  } catch {
    return { nextAt: t + total, total };
  }
}

function pickTextLocal(v: any, loc: "tr" | "en" = "tr") {
  if (!v) return "";
  if (typeof v === "string") return v;
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr : tr || en;
}
function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function defaultRingSizes(): string[] {
  return Array.from({ length: 23 }, (_, i) => String(i + 8)); // 8-30
}

function getProductSizes(liveProduct: any): string[] {
  const raw =
    liveProduct?.advanced?.sizes ??
    liveProduct?.sizes ??
    liveProduct?.sizeOptions ??
    liveProduct?.ringSizes ??
    [];

  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? Object.values(raw)
    : typeof raw === "string"
    ? raw.split(",")
    : [];

  return Array.from(
    new Set(
      arr
        .map((x: any) => String(x ?? "").trim())
        .filter(Boolean)
    )
  ).slice(0, 40);
}

function isRingLikeProduct(it: CartItem, liveProduct: any) {
  const title = `${safeStr(it?.title)} ${safeStr(liveProduct?.title?.tr)} ${safeStr(
    liveProduct?.title?.en
  )} ${safeStr(liveProduct?.title)} ${safeStr(liveProduct?.name)}`.toLocaleLowerCase("tr-TR");

  const slug = `${safeStr((it as any)?.slug)} ${safeStr(liveProduct?.slug)}`.toLocaleLowerCase(
    "tr-TR"
  );

  const categoryText = [
    ...(Array.isArray(liveProduct?.categorySlugs) ? liveProduct.categorySlugs : []),
    ...(Array.isArray(liveProduct?.categories) ? liveProduct.categories : []),
    ...(Array.isArray(liveProduct?.categoryIds) ? liveProduct.categoryIds : []),
    safeStr(liveProduct?.categoryId),
    safeStr(liveProduct?.categorySlug),
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  const hay = `${title} ${slug} ${categoryText}`;

  return (
    hay.includes("yüzük") ||
    hay.includes("yüzüğ") ||
    hay.includes("yuzuk") ||
    hay.includes("yuzug") ||
    hay.includes("ring") ||
    hay.includes("signet")
  );
}
function getCachedProductForCartItem(
  productCache: Record<string, any>,
  it: CartItem
) {
  const keys = [
    (it as any)?.productId,
    (it as any)?.id,
    (it as any)?.slug,
    (it as any)?.productSlug,
    (it as any)?.sku,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  for (const key of keys) {
    if (productCache[key]) return productCache[key];
  }

  return null;
}
function getCartRingSize(it: CartItem) {
  const direct = safeStr((it as any)?.selectedSize);
  if (direct) return direct;

  const fromVariants =
    safeStr((it as any)?.selectedVariants?.ring_size) ||
    safeStr((it as any)?.selectedVariants?.ringSize) ||
    safeStr((it as any)?.variant?.ring_size) ||
    safeStr((it as any)?.variant?.ringSize);

  if (fromVariants) return fromVariants;

  const variantItems = Array.isArray((it as any)?.selectedVariantItems)
    ? (it as any).selectedVariantItems
    : [];

  const found = variantItems.find((v: any) => {
    const hay = [
      v?.groupId,
      v?.groupLabel,
      v?.label,
      v?.value,
    ]
      .map((x) => safeStr(x).toLocaleLowerCase("tr-TR"))
      .join(" ");

    return (
      hay.includes("ring_size") ||
      hay.includes("yüzük") ||
      hay.includes("yuzuk") ||
      hay.includes("ölçü") ||
      hay.includes("olcu")
    );
  });

  return safeStr(found?.label) || safeStr(found?.value);
}
function getCartVariantGram(it: CartItem) {
  const variantItems = Array.isArray((it as any)?.selectedVariantItems)
    ? (it as any).selectedVariantItems
    : [];

  const fromVariant = variantItems.find((v: any) => {
    const gram = Number(v?.hasGram ?? v?.weightGram ?? v?.gram ?? 0);
    return Number.isFinite(gram) && gram > 0;
  });

  const variantGram = Number(
    fromVariant?.hasGram ?? fromVariant?.weightGram ?? fromVariant?.gram ?? 0
  );

  if (Number.isFinite(variantGram) && variantGram > 0) {
    return variantGram;
  }

  const pricingGram = Number(
    (it as any)?.pricing?.weightGram ??
      (it as any)?.pricing?.hasGram ??
      (it as any)?.pricing?.gram ??
      (it as any)?.dynamicPricing?.weightGram ??
      (it as any)?.dynamicPricing?.hasGram ??
      (it as any)?.dynamicPricing?.gram ??
      0
  );

  if (Number.isFinite(pricingGram) && pricingGram > 0) {
    return pricingGram;
  }

  const topGram = Number(
    (it as any)?.weightGram ??
      (it as any)?.weightGr ??
      (it as any)?.hasGram ??
      (it as any)?.gram ??
      0
  );

  return Number.isFinite(topGram) && topGram > 0 ? topGram : 0;
}

function withCartVariantGram(liveProduct: any, it: CartItem) {
  if (!liveProduct) return liveProduct;

  const cartGram = getCartVariantGram(it);
  if (!cartGram) return liveProduct;

  // Varyant gramı base gramdan farklıysa sabit fiyatları sıfırla
  const baseProductGram = Math.max(0, Number(
    liveProduct?.hasGram ?? liveProduct?.gram ?? liveProduct?.weightGram ?? liveProduct?.weightGr ?? 0
  ));
  const gramChanged = cartGram > 0 && Math.abs(cartGram - baseProductGram) > 0.001;

  return {
    ...liveProduct,

    // Sepetteki gram, canlı ürün gramından üstündür.
    gram: cartGram,
    hasGram: cartGram,
    weightGram: cartGram,
    weightGr: cartGram,

    // Gram değiştiyse sabit fiyatları sıfırla → dinamik hesaplama devreye girsin
    ...(gramChanged ? { finalPrice: 0, priceTry: 0, final: 0, price: 0, rawPrice: 0 } : {}),

    pricing:
      liveProduct?.pricing && typeof liveProduct.pricing === "object"
        ? {
            ...liveProduct.pricing,
            gram: cartGram,
            hasGram: cartGram,
            weightGram: cartGram,
            weightGr: cartGram,
          }
        : liveProduct?.pricing,

    dynamicPricing:
      liveProduct?.dynamicPricing && typeof liveProduct.dynamicPricing === "object"
        ? {
            ...liveProduct.dynamicPricing,
            gram: cartGram,
            hasGram: cartGram,
            weightGram: cartGram,
            weightGr: cartGram,
          }
        : liveProduct?.dynamicPricing,
  };
}
function saveTimer(st: TimerState) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(st));
  } catch {}
}
function readTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TimerState>;
    const nextAt = Number(parsed?.nextAt ?? 0);
    const total = Number(parsed?.total ?? 0);

    if (!Number.isFinite(nextAt) || !Number.isFinite(total) || total <= 0) {
      return null;
    }

    return { nextAt, total };
  } catch {
    return null;
  }
}
async function triggerRatesRefreshAndWait(db: any, currentFetchedAt?: string) {
  const res = await fetch("/api/rates/refresh", {
    method: "POST",
    cache: "no-store",
  });

  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`rates refresh failed: ${res.status} ${txt}`);
  }

  const started = Date.now();
  const timeoutMs = 15000;

  while (Date.now() - started < timeoutMs) {
    const snap = await getDoc(doc(db, "rates", "latest"));
    const data = snap.exists() ? (snap.data() as any) : null;
    const fetchedAt = String(data?.fetchedAt || "").trim();

    if (fetchedAt && fetchedAt !== String(currentFetchedAt || "").trim()) {
      return data;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("rates/latest güncellenmedi veya geç geldi.");
}

export default function CartPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const cartUid = user && !user.isAnonymous ? user.uid : null;
function refreshCartNow() {
  const next = getCart(cartUid);
  setItems(next);
  window.dispatchEvent(new Event("cart:changed"));
}

async function removeCartEverywhere(item: CartItem) {
  removeFromCart(item.id, cartUid);

  if (cartUid) {
    try {
      await deleteCartItemFromFirestore(cartUid, item);
    } catch (err) {
      console.error("[cart page] cloud delete failed:", err);
    }
  }

  refreshCartNow();
}

async function updateCartEverywhere(item: CartItem, patch: Partial<CartItem>) {
  updateCartItem(item.id, patch, cartUid);

  const updated = getCart(cartUid).find((x) => String(x.id) === String(item.id));

  if (cartUid && updated) {
    try {
      await saveCartItemToFirestore(cartUid, updated);
    } catch (err) {
      console.error("[cart page] cloud update failed:", err);
    }
  }

  refreshCartNow();
}

async function setQtyEverywhere(item: CartItem, nextQty: number) {
  setQty(item.id, nextQty, cartUid);

  const updated = getCart(cartUid).find((x) => String(x.id) === String(item.id));

  if (cartUid) {
    try {
      if (updated) {
        await saveCartItemToFirestore(cartUid, updated);
      } else {
        await deleteCartItemFromFirestore(cartUid, item);
      }
    } catch (err) {
      console.error("[cart page] cloud qty sync failed:", err);
    }
  }

  refreshCartNow();
}
  const [items, setItems] = useState<CartItem[]>([]);
  const [removeConfirm, setRemoveConfirm] = useState<{
  open: boolean;
  item: CartItem | null;
}>({
  open: false,
  item: null,
});
  const [refreshMinutes, setRefreshMinutes] = useState<number>(3);
  const [ratesEnabled, setRatesEnabled] = useState<boolean>(false);
  const [cartAutoRefresh, setCartAutoRefresh] = useState<boolean>(false);
  const [leftSec, setLeftSec] = useState<number>(refreshMinutes * 60);
  const [bundleOpen, setBundleOpen] = useState(false);
const [bundleProducts, setBundleProducts] = useState<any[]>([]);
const [bundleMeta, setBundleMeta] = useState<any | null>(null);
const [bundleLoading, setBundleLoading] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshLockRef = useRef(false);
  const [productCache, setProductCache] = useState<Record<string, any>>({});
  const [campaigns, setCampaigns] = useState<StoreCampaign[]>([]);
const [ratesDoc, setRatesDoc] = useState<RatesLatest | null>(null);
const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
const [expiryBanner, setExpiryBanner] = useState<{ show: boolean; count: number; moved: boolean }>({
  show: false,
  count: 0,
  moved: false,
});
const [cartExpirySettingsReady, setCartExpirySettingsReady] = useState(false);
const [cartExpirySettings, setCartExpirySettings] = useState<{
  enabled: boolean;
  hours: number;
  moveToFavorites: boolean;
  message: string;
}>({
  enabled: true,
  hours: 24,
  moveToFavorites: true,
  message: "",
});
 const refreshCart = useCallback(() => {
  setItems(getCart(cartUid));
}, [cartUid]);
  const SERVICE_KEY = "nci_selected_services_v1";

function saveSelectedServices(next: Record<string, boolean>) {
  setSelectedServices(next);

  try {
    localStorage.setItem(SERVICE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nci:selected-services-changed"));
  } catch {
    //
  }
}
function getItemMaxStock(it: CartItem) {
const liveProduct = getCachedProductForCartItem(productCache, it);

  const stock = Math.floor(
    Number(
      liveProduct?.stock ??
      it?.stock ??
      0
    )
  );

  if (!Number.isFinite(stock)) return 1;
  return Math.max(1, stock);
}
useEffect(() => {
  try {
    localStorage.setItem("nci_selected_services_v1", JSON.stringify(selectedServices));
  } catch {
    //
  }
}, [selectedServices]);
useEffect(() => {
  try {
    const raw = localStorage.getItem("nci_selected_services_v1");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      setSelectedServices(parsed);
    }
  } catch {
    //
  }
}, []);
   useEffect(() => {
    // settings/public'ten cartExpiry ayarlarını oku
    const pubRef = doc(db, "settings", "public");
    const unsub = onSnapshot(pubRef, (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const ce = d?.cartExpiry && typeof d.cartExpiry === "object" ? d.cartExpiry : {};
      const hours = Number.isFinite(Number(ce.hours)) && Number(ce.hours) > 0 ? Number(ce.hours) : 24;
      setCartExpiryHoursCache(hours);
      setCartExpirySettings({
        enabled: ce.enabled !== false,
        hours,
        moveToFavorites: ce.moveToFavorites !== false,
        message: String(ce.message || ""),
      });
      setCartExpirySettingsReady(true);
    }, () => {
      setCartExpiryHoursCache(24);
      setCartExpirySettingsReady(true);
    });
    return () => unsub();
  }, [db]);
  useEffect(() => {
    // Sepet süre kuralı: sayfa açılışında kontrol et
    if (!cartExpirySettingsReady || !cartExpirySettings.enabled) return;

    const result = runCartExpiryCheck(cartUid, {
      moveToFavorites: cartExpirySettings.moveToFavorites,
      expiryHours: cartExpirySettings.hours,
    });
    if (result.movedToFavorites > 0) {
      setExpiryBanner({ show: true, count: result.movedToFavorites, moved: true });
    } else if (result.expired.length > 0) {
      setExpiryBanner({ show: true, count: result.expired.length, moved: false });
    }

    refreshCart();
 }, [refreshCart, cartUid, cartExpirySettingsReady, cartExpirySettings.enabled, cartExpirySettings.hours, cartExpirySettings.moveToFavorites]);

  useEffect(() => {
    refreshCart();
    const onChange = () => {
      refreshCart();
    };
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
 }, [refreshCart]);
  useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "site_options", "campaign_settings"),
    (snap) => {
      setCampaigns(normalizeCampaigns(snap.exists() ? snap.data() : null));
    },
    () => setCampaigns([])
  );

  return () => unsub();
}, [db]);
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "settings", "public"),
    (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};

      const m = Number(d?.cartRefreshMinutes ?? 3);
      if (Number.isFinite(m) && m > 0 && m <= 60) {
        setRefreshMinutes(m);
      } else {
        setRefreshMinutes(3);
      }

      setRatesEnabled(d?.ratesEnabled !== false);
      setCartAutoRefresh(d?.cartRatesAutoRefresh !== false);
    },
    () => {
      setRefreshMinutes(3);
      setRatesEnabled(true);
      setCartAutoRefresh(true);
    }
  );

  return () => unsub();
}, [db]);
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "rates", "latest"),
    (snap) => {
      setRatesDoc(snap.exists() ? (snap.data() as RatesLatest) : null);
    },
    () => setRatesDoc(null)
  );

  return () => unsub();
}, [db]);

const rows = useMemo(() => {
  return items.map((it) => {
    const qty = clampQty(it.qty || 1);
    const liveProduct = getCachedProductForCartItem(productCache, it);
    const pricingProduct = liveProduct ? withCartVariantGram(liveProduct, it) : null;

    const lockedUnitTry = Number((it as any)?.lockedUnitPriceTry ?? 0);
    const resolvedUnitTry = Number((it as any)?.resolvedUnitPrice ?? 0);
    const unitPriceTry = Number((it as any)?.unitPriceTry ?? 0);
    const priceTry = Number((it as any)?.priceTry ?? 0);
    const fallbackPrice = Number((it as any)?.price ?? 0);

    const savedUnitTry =
      lockedUnitTry > 0
        ? lockedUnitTry
        : resolvedUnitTry > 0
        ? resolvedUnitTry
        : unitPriceTry > 0
        ? unitPriceTry
        : priceTry > 0
        ? priceTry
        : fallbackPrice > 0
        ? fallbackPrice
        : 0;

    let unitTry = savedUnitTry;
    let isDynamic = false;

    // Sepette kayıtlı fiyat varsa ASLA tekrar canlı üründen hesaplama.
    // Çünkü canlı ürün cache'i eski gram/ürün gramını getirip fiyatı düşürebiliyor.
    if (savedUnitTry <= 0 && pricingProduct) {
      const resolved = resolveProductPriceTRY(pricingProduct, ratesDoc);
      const dyn = Number(resolved?.price ?? 0);

      if (Number.isFinite(dyn) && dyn > 0) {
        unitTry = dyn;
      }

      isDynamic = Boolean(resolved?.isDynamic);
    } else {
      const cartPricing = (it as any)?.pricing;
      isDynamic =
        cartPricing &&
        typeof cartPricing === "object" &&
        String(cartPricing?.mode || "").toLowerCase() === "dynamic";
    }

    const lineTry = unitTry * qty;

    return { it, qty, unitTry, lineTry, isDynamic, pricingProduct };
  });
}, [items, productCache, ratesDoc]);

const hasDynamicItems = useMemo(() => {
  return rows.some((r) => r.isDynamic);
}, [rows]);
const showRateBox = ratesEnabled && cartAutoRefresh && hasDynamicItems;
useEffect(() => {
  const total = refreshMinutes * 60;

  if (!ratesEnabled || !cartAutoRefresh || !hasDynamicItems) {
    setLeftSec(total);
    return;
  }

  const st = loadTimer(total);
  setLeftSec(Math.max(0, st.nextAt - nowSec()));
}, [refreshMinutes, ratesEnabled, cartAutoRefresh, hasDynamicItems]);

useEffect(() => {
  if (tickRef.current) clearInterval(tickRef.current);

  const total = refreshMinutes * 60;

  if (!ratesEnabled || !cartAutoRefresh || !hasDynamicItems) {
    setLeftSec(total);
    return;
  }

  const st = loadTimer(total);
  setLeftSec(Math.max(0, st.nextAt - nowSec()));

  tickRef.current = setInterval(() => {
    const current = readTimer();

    if (!current) {
      setLeftSec(0);
      return;
    }

    const left = Math.max(0, current.nextAt - nowSec());
    setLeftSec(left);
  }, 1000);

  return () => {
    if (tickRef.current) clearInterval(tickRef.current);
  };
}, [refreshMinutes, ratesEnabled, cartAutoRefresh, hasDynamicItems]);

useEffect(() => {
  const total = refreshMinutes * 60;

  if (!ratesEnabled || !cartAutoRefresh || !hasDynamicItems) return;
  if (leftSec > 0) return;
  if (refreshLockRef.current) return;

  refreshLockRef.current = true;

  const nextAt = nowSec() + total;
  saveTimer({ nextAt, total });
  setLeftSec(total);

  triggerRatesRefreshAndWait(db, String((ratesDoc as any)?.fetchedAt || ""))
    .then((freshRates) => {
      if (freshRates) {
        setRatesDoc(freshRates as RatesLatest);
      }
    })
    .catch((e) => {
      console.error("cart auto refresh error:", e);
    })
    .finally(() => {
      refreshLockRef.current = false;
    });
}, [leftSec, refreshMinutes, ratesEnabled, cartAutoRefresh, hasDynamicItems, db, ratesDoc]);
  const mmss = useMemo(() => {
    const m = Math.floor(leftSec / 60);
    const s2 = leftSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
  }, [leftSec]);

useEffect(() => {
  let alive = true;

  function addProductAliases(
    target: Record<string, any>,
    lookupKey: string,
    product: any
  ) {
    if (!product) return;

    const cleanProduct = {
      ...product,
      id: String(product?.id || lookupKey || "").trim(),
    };

    const keys = [
      lookupKey,
      cleanProduct.id,
      cleanProduct.slug,
      cleanProduct.sku,
      cleanProduct.productId,
    ]
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    for (const key of keys) {
      target[key] = cleanProduct;
    }
  }

  (async () => {
    try {
      const keys = Array.from(
        new Set(
          items
            .flatMap((x: any) => [
              x?.productId,
              x?.id,
              x?.slug,
              x?.productSlug,
              x?.sku,
            ])
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        )
      );

      const need = keys.filter((key) => !productCache[key]);
      if (!need.length) return;

      const fetched: Record<string, any> = {};

      for (const key of need) {
        let found: any = null;

        const byId = await getDoc(doc(db, "products", key));

        if (byId.exists()) {
          found = {
            id: byId.id,
            ...(byId.data() as any),
          };
        } else {
          const bySlug = await getDocs(
            query(collection(db, "products"), where("slug", "==", key))
          );

          if (!bySlug.empty) {
            const d = bySlug.docs[0];
            found = {
              id: d.id,
              ...(d.data() as any),
            };
          } else {
            const bySku = await getDocs(
              query(collection(db, "products"), where("sku", "==", key))
            );

            if (!bySku.empty) {
              const d = bySku.docs[0];
              found = {
                id: d.id,
                ...(d.data() as any),
              };
            }
          }
        }

        if (found) {
          addProductAliases(fetched, key, found);
        }
      }

      if (!alive) return;

      if (Object.keys(fetched).length) {
        setProductCache((prev) => ({
          ...prev,
          ...fetched,
        }));
      }
    } catch (e) {
      console.error("product cache error:", e);
    }
  })();

  return () => {
    alive = false;
  };
}, [db, items, productCache]);


  const bundleTotalTry = useMemo(() => {
  return bundleProducts.reduce((sum, p) => {
    const price =
      Number(
        p?.finalPrice ??
        p?.priceTry ??
        p?.price ??
        0
      ) || 0;

    return sum + price;
  }, 0);
}, [bundleProducts]);
const bundleDiscountTry = useMemo(() => {
  if (!bundleMeta) return 0;

  const type = String(bundleMeta?.discountType || "").trim();
  const value = Number(bundleMeta?.discountValue ?? 0) || 0;

  if (!value || bundleTotalTry <= 0) return 0;

  if (type === "fixed") {
    return Math.min(value, bundleTotalTry);
  }

  if (type === "percent") {
    return bundleTotalTry * (value / 100);
  }

  return 0;
}, [bundleMeta, bundleTotalTry]);
function addBundleToCart() {
  bundleProducts.forEach((p) => {
    const id = String(p?.id || p?.slug || "").trim();
    if (!id) return;

    addToCart(
      {
        id,
        title: pickTextLocal(p?.title, "tr") || p?.name || "Ürün",
        priceTry: Number(p?.finalPrice ?? p?.priceTry ?? p?.price ?? 0) || 0,
        qty: 1,
        image: safeImageSrc(
          p?.image ||
          p?.mainImage ||
          (Array.isArray(p?.images) ? p.images[0] : "") ||
          FALLBACK_IMG
        ),
        slug: String(p?.slug || id),
      },
      cartUid
    );
  });

  // Set önerisini hemen kapat — ürünler zaten sepete eklendi
  setBundleMeta(null);
  setBundleProducts([]);

  window.dispatchEvent(new Event("cart:changed"));
  window.dispatchEvent(new Event("storage"));
}
const bundleFinalTry = useMemo(() => {
  return Math.max(0, bundleTotalTry - bundleDiscountTry);
}, [bundleTotalTry, bundleDiscountTry]);
const hasBundle = !!bundleMeta?.enabled && bundleProducts.length > 0;

const bundleTitle = useMemo(() => {
  return pickTextLocal(bundleMeta?.title, "tr") || "Set olarak satın al";
}, [bundleMeta]);

const bundleSubtitle = useMemo(() => {
  return pickTextLocal(bundleMeta?.subtitle, "tr") || "Uyumlu parçaları tek seferde sepete ekleyerek daha güçlü bir kombin oluştur.";
}, [bundleMeta]);
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      if (!rows.length) {
        if (alive) {
          setBundleMeta(null);
          setBundleProducts([]);
        }
        return;
      }

      setBundleLoading(true);

      // Sepetteki ürün ID/slug'larını topla — bunları set önerilerinden filtreleyeceğiz
      const cartItemKeys = new Set(
        rows.flatMap(({ it }) => [
          String((it as any)?.id || "").trim(),
          String((it as any)?.productId || "").trim(),
          String((it as any)?.slug || "").trim(),
        ].filter(Boolean))
      );

      // Tüm sepet ürünlerinin set bundle'larını topla
      let firstBundleMeta: any = null;
      const allBundleProductIds = new Set<string>();

      for (const row of rows) {
        const rowId = String(row?.it?.id || "").trim();
        if (!rowId) continue;

        let candidate = productCache[rowId] || null;

        if (!candidate) {
          const dsnap = await getDoc(doc(db, "products", rowId));
          if (dsnap.exists()) {
            candidate = { id: dsnap.id, ...(dsnap.data() as any) };
          } else {
            const qs = await getDocs(
              query(collection(db, "products"), where("slug", "==", rowId))
            );
            if (!qs.empty) {
              const d = qs.docs[0];
              candidate = { id: d.id, ...(d.data() as any) };
            }
          }
        }

        const candidateBundle =
          candidate?.setBundle && typeof candidate.setBundle === "object"
            ? candidate.setBundle
            : {
                enabled: !!candidate?.setBundleEnabled,
                title: candidate?.setBundleTitle || null,
                subtitle: candidate?.setBundleSubtitle || null,
                productIds: Array.isArray(candidate?.setBundleProductIds)
                  ? candidate.setBundleProductIds
                  : [],
                discountType: String(candidate?.setBundleDiscountType || "").trim(),
                discountValue: Number(candidate?.setBundleDiscountValue ?? 0) || 0,
              };

        if (
          candidateBundle?.enabled &&
          Array.isArray(candidateBundle?.productIds) &&
          candidateBundle.productIds.length
        ) {
          // İlk bulunan bundle'ın meta bilgilerini (başlık, alt yazı, indirim) kullan
          if (!firstBundleMeta) {
            firstBundleMeta = candidateBundle;
          }

          // Tüm set ürünlerini birleştir
          const ids = (candidateBundle.productIds as any[])
            .flatMap((x: any) =>
              String(x || "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            );
          ids.forEach((id) => allBundleProductIds.add(id));
        }
      }

      if (!firstBundleMeta || !allBundleProductIds.size) {
        if (alive) {
          setBundleMeta(null);
          setBundleProducts([]);
        }
        return;
      }

      // Sepette zaten olan ürünleri set önerisinden çıkar
      const filteredIds = Array.from(allBundleProductIds).filter(
        (id) => !cartItemKeys.has(id)
      );

      if (!filteredIds.length) {
        if (alive) {
          setBundleMeta(null);
          setBundleProducts([]);
        }
        return;
      }

      const fetched: any[] = [];
      const fetchedIds = new Set<string>();

      for (const id of filteredIds) {
        let found: any = null;
        const productKey = String(id || "").trim();
        if (!productKey) continue;

        const byId = await getDoc(doc(db, "products", productKey));

        if (byId.exists()) {
          found = { id: byId.id, ...(byId.data() as any) };
        } else {
          const bySlug = await getDocs(
            query(collection(db, "products"), where("slug", "==", productKey))
          );

          if (!bySlug.empty) {
            const d = bySlug.docs[0];
            found = { id: d.id, ...(d.data() as any) };
          }
        }

        // Aynı ürünü tekrar ekleme ve zaten sepette olanları atla
        if (found && !fetchedIds.has(found.id) && !cartItemKeys.has(found.id) && !cartItemKeys.has(found.slug)) {
          fetchedIds.add(found.id);
          fetched.push(found);
        }
      }

      if (!alive) return;

      setBundleMeta(firstBundleMeta);
      setBundleProducts(fetched);
    } catch (e) {
      console.error("bundle load error:", e);
      if (alive) {
        setBundleMeta(null);
        setBundleProducts([]);
      }
    } finally {
      if (alive) setBundleLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [db, rows, productCache]);
  const totalTry = useMemo(() => rows.reduce((a, r) => a + (r.lineTry || 0), 0), [rows]);
  const itemCount = useMemo(() => rows.reduce((acc, r) => acc + (r.qty || 1), 0), [rows]);
const hasMissingRingSize = useMemo(() => {
  return rows.some(({ it }) => {
    const liveProduct = getCachedProductForCartItem(productCache, it);
    const ringLike = isRingLikeProduct(it, liveProduct);
    const selectedSize = safeStr((it as any).selectedSize);

    return ringLike && !selectedSize;
  });
}, [rows, productCache]);
const campaignResult = useMemo(() => {
  return calcCampaignDiscount({
    campaigns,
    placement: "cart",
    subtotal: totalTry,
    items: rows.map((r) => {
      const liveProduct = productCache[String(r.it.id || "")] || {};

      return {
        id: String(r.it.id || ""),
        productId: String((r.it as any).productId || r.it.id || ""),
        slug: String((r.it as any).slug || liveProduct?.slug || ""),
        qty: r.qty,
        lineTry: r.lineTry,
        categoryIds: Array.isArray(liveProduct?.categoryIds)
          ? liveProduct.categoryIds
          : [],
        categorySlugs: Array.isArray(liveProduct?.categorySlugs)
          ? liveProduct.categorySlugs
          : [],
      };
    }),
  });
}, [campaigns, rows, totalTry, productCache]);
const serviceCampaigns = useMemo(() => {
  return campaigns.filter((c: any) => {
    const kind = String(c?.kind || "").trim().toLowerCase();

    const placement = Array.isArray(c?.placement)
      ? c.placement.map((x: any) => String(x).trim().toLowerCase())
      : [];

    const active = c?.isActive !== false && c?.enabled !== false;

    // requiresProductText olan servisler (metin yazma) sadece checkout'ta gösterilir
    if (c?.requiresProductText === true) return false;

    return active && kind === "service" && placement.includes("cart");
  });
}, [campaigns]);
const campaignDiscountTry = campaignResult.discount;
const serviceTotalTry = useMemo(() => {
  return serviceCampaigns.reduce((sum: number, c: any) => {
    const id = String(c.id || "").trim();
    if (!id) return sum;

    const selected = selectedServices[id] === true;
    if (!selected) return sum;

    const freeOverTry = Number(c.freeOverTry || 0);
    const servicePriceTry = Number(c.servicePriceTry || 0);

    const isFree = freeOverTry > 0 && totalTry >= freeOverTry;
    return sum + (isFree ? 0 : Math.max(0, servicePriceTry));
  }, 0);
}, [serviceCampaigns, selectedServices, totalTry]);
const cartFinalTry = Math.max(0, totalTry - campaignDiscountTry + serviceTotalTry);
  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.heroKicker}>SEPET</div>
            <h1 className={s.title}>Sepetiniz</h1>
            <p className={s.heroText}>
              Seçtiğiniz ürünleri kontrol edin, adetleri güncelleyin ve güvenli şekilde ödeme adımına geçin.
            </p>

            <div className={s.heroStats}>

  <span className={s.pill}>{rows.length} ürün</span>

  <span className={s.pill}>{itemCount} adet</span>

  <span className={s.pillSoft}>Güvenli Alışveriş</span>

</div>
          </div>

          <div className={s.topActions}>
            <Link href="/shop" className={`${s.btn} ${s.ghost}`}>
              ← Mağazaya dön
            </Link>
            <Link href="/" className={`${s.btn} ${s.ghost}`}>
              Anasayfa
            </Link>
          </div>
        </section>

        {/* 24 saat kuralı: süresi dolan ürünler favorilere taşındı bannerı */}
        {expiryBanner.show && (
          <div className={s.expiryResult} role="status">
            <span className={s.expiryResultIcon} aria-hidden="true">
              {expiryBanner.moved ? "♥" : "✓"}
            </span>
            <div className={s.expiryResultCopy}>
              <span>SEPET KORUMA TAMAMLANDI</span>
              <strong>
                {expiryBanner.count > 1 ? `${expiryBanner.count} ürün` : "1 ürün"}{" "}
                {expiryBanner.moved ? "favorilerinize taşındı" : "sepetinizden kaldırıldı"}.
              </strong>
              <p>Altın fiyatı güncellendiğinde seçiminizi kaybetmemeniz için sepet süresi otomatik yönetilir.</p>
            </div>
            {expiryBanner.moved && (
              <Link href="/hesabim?tab=favorites" className={s.expiryResultLink}>
                Favorilerimi Gör <span aria-hidden="true">→</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setExpiryBanner({ show: false, count: 0, moved: false })}
              className={s.expiryResultClose}
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
        )}

        {/* Sepet süre limiti bilgi kutusu */}
        {cartExpirySettings.enabled && rows.length > 0 && (
          <aside className={s.expiryNotice} aria-label="Sepet koruma bilgisi">
            <div className={s.expiryNoticeMark} aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation">
                <path d="M12 3.25a8.75 8.75 0 1 0 8.75 8.75A8.76 8.76 0 0 0 12 3.25Z" />
                <path d="M12 7.5V12l3 1.75" />
              </svg>
            </div>
            <div className={s.expiryNoticeCopy}>
              <span className={s.expiryNoticeKicker}>SEPET KORUMA</span>
              <strong>Seçiminiz {cartExpirySettings.hours} saat boyunca korunur.</strong>
              <p>
              {cartExpirySettings.message ||
                `Sepetteki ürünler ${cartExpirySettings.hours} saat sonra ${
                  cartExpirySettings.moveToFavorites
                    ? "otomatik olarak favorilere taşınır"
                    : "otomatik olarak kaldırılır"
                }. Altın fiyatları sürekli değiştiği için sepet süresi sınırlıdır.`}
              </p>
            </div>
            <div className={s.expiryNoticeDetails} aria-label="Sepet koruma özellikleri">
              <span><i aria-hidden="true" /> Canlı fiyat koruması</span>
              <span><i aria-hidden="true" /> {cartExpirySettings.moveToFavorites ? "Favorilere güvenli aktarım" : "Otomatik sepet temizliği"}</span>
            </div>
          </aside>
        )}

        {rows.length === 0 ? (
          <section className={s.empty}>
            <div className={s.emptyCard}>
              <div className={s.emptyIcon}>🛒</div>
              <div className={s.emptyTitle}>Sepetin boş</div>
              <div className={s.emptyText}>
                Lüks koleksiyon seni bekliyor. Mağazadan ürün ekleyip devam edelim.
              </div>
              <div className={s.emptyActions}>
                <Link href="/shop" className={`${s.btn} ${s.dark}`}>
                  Mağazaya Git
                </Link>
                <Link href="/" className={`${s.btn} ${s.ghost}`}>
                  Anasayfa
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className={s.grid}>
            <section className={s.left}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <div className={s.cardTitle}>Sepet ürünleri</div>
                    <div className={s.cardSub}>
                      Ürün detaylarını, adetleri ve ara toplamı buradan yönetebilirsin.
                    </div>
                  </div>

                  <div className={s.badges}>
                    <span className={s.badge}>Güvenli ödeme</span>
                    <span className={s.badge}>Sigortalı kargo</span>
                    <span className={s.badge}>Premium paketleme</span>
                  </div>
                </div>

                <div className={s.list}>
               {rows.map(({ it, qty, unitTry, lineTry }, idx) => {
                  const maxStock = getItemMaxStock(it);
const isMaxQty = qty >= maxStock;
                const liveProduct = getCachedProductForCartItem(productCache, it);
                  const sku = liveProduct?.sku as string | undefined;

                  const imageSrc = safeImageSrc(
                    it.image ||
                    liveProduct?.image ||
                    liveProduct?.mainImage ||
                    (Array.isArray(liveProduct?.images) ? liveProduct.images[0] : "") ||
                    FALLBACK_IMG
                  );

                    return (
                      <article key={String(it.id)} className={s.item}>
                        <div className={s.media}>
                       <Image
  src={imageSrc}
  alt={it.title || "Ürün"}
  width={124}
  height={124}
  priority={idx === 0}
  unoptimized
  style={{ objectFit: "cover" }}
/>
                        </div>

                        <div className={s.body}>
                          <div className={s.rowTop}>
                            <div className={s.name}>
                             <div className={s.nameRow}>

  <span>{it.title || "Ürün"}</span>

</div>

{sku ? <div className={s.sku}>Ürün kodu: {sku}</div> : null}

{(() => {
 const selectedSize = getCartRingSize(it);
  const ringLike = isRingLikeProduct(it, liveProduct);
  const productSizes = getProductSizes(liveProduct);
  const sizes = ringLike && !productSizes.length ? defaultRingSizes() : productSizes;

  if (!ringLike) return null;

  if (selectedSize) {
    return (
      <div className={s.variantList}>
        <span className={s.variantChip}>Yüzük Ölçüsü: {selectedSize}</span>
      </div>
    );
  }

  return (
    <div className={s.sizeSelectBox}>
      <label className={s.sizeSelectLabel}>Yüzük Ölçünüz</label>

      <select
        className={`${s.sizeSelect} ${s.sizeSelectWarn}`}
        value=""
        onChange={(e) => {
          const nextSize = e.target.value;
const liveProductForSize = getCachedProductForCartItem(productCache, it);
const productPreset =
  liveProductForSize?.productVariantPreset?.enabled === true
    ? liveProductForSize.productVariantPreset
    : null;

const sizeGroup = Array.isArray(productPreset?.groups)
  ? productPreset.groups.find((g: any) => {
      const hay = `${g?.id || ""} ${g?.label?.tr || ""} ${g?.label?.en || ""}`.toLocaleLowerCase("tr-TR");

      return (
        hay.includes("ring_size") ||
        hay.includes("yüzük") ||
        hay.includes("yuzuk") ||
        hay.includes("ölçü") ||
        hay.includes("olcu") ||
        hay.includes("ring")
      );
    })
  : null;

const sizeOption = Array.isArray(sizeGroup?.options)
  ? sizeGroup.options.find((o: any) => String(o?.value || "") === String(nextSize))
  : null;

const sizeGram = Number(
  sizeOption?.hasGram ??
    sizeOption?.weightGram ??
    sizeOption?.gram ??
    0
);
          const oldVariantItems = Array.isArray((it as any).selectedVariantItems)
            ? (it as any).selectedVariantItems.filter(
                (v: any) => safeStr(v?.groupId) !== "ring_size"
              )
            : [];

          updateCartEverywhere(it, {
  selectedSize: nextSize,
  selectedVariants: {
    ...((it as any).selectedVariants || {}),
    ring_size: nextSize,
  },
 selectedVariantItems: nextSize
  ? [
      ...oldVariantItems,
      {
        groupId: "ring_size",
        groupLabel: "Yüzük Ölçüsü",
        value: nextSize,
        label: nextSize,
        priceDelta: Number(sizeOption?.priceDelta || 0),
        ...(sizeGram > 0
          ? {
              hasGram: sizeGram,
              weightGram: sizeGram,
            }
          : {}),
      },
    ]
  : oldVariantItems,
} as any);
        }}
      >
        <option value="">Ölçü seçiniz</option>

        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      <div className={s.sizeSelectHint}>
        Ödeme öncesi yüzük ölçüsü seçilmelidir.
      </div>
    </div>
  );
})()}

{Array.isArray((it as any).selectedVariantItems) &&
(it as any).selectedVariantItems.filter((v: any) => safeStr(v?.groupId) !== "ring_size").length ? (
  <div className={s.variantList}>
    {(it as any).selectedVariantItems
      .filter((v: any) => safeStr(v?.groupId) !== "ring_size")
      .map((v: any) => (
        <span key={`${v.groupId}_${v.value}`} className={s.variantChip}>
          {v.groupLabel}: {v.label}
        </span>
      ))}
  </div>
) : null}


                            </div>

                            <div className={s.line}>{fmtTRY(lineTry)}</div>
                          </div>

                          <div className={s.muted}>{fmtTRY(unitTry)} / adet</div>

                          <div className={s.rowBottom}>
                            <div className={s.qty}>
                              <button
                                type="button"
                                className={s.qtyBtn}
                              onClick={() => {

  const nextQty = Math.max(1, qty - 1);

  setQtyEverywhere(it, nextQty);

}}
                                aria-label="Azalt"
                              >
                                −
                              </button>

                              <div className={s.qtyNum}>{qty}</div>

                            <button
  type="button"
  className={s.qtyBtn}
onClick={() => {
  const nextQty = Math.min(maxStock, qty + 1);
  setQtyEverywhere(it, nextQty);
}}
  aria-label="Artır"
  disabled={isMaxQty}
>
  +
</button>

                            </div>

                            <button
  type="button"
  className={s.remove}
  id={`fb-remove-cart-${String(it.id).slice(0, 8)}`}
  onClick={() =>
    setRemoveConfirm({
      open: true,
      item: it,
    })
  }
>
  Ürünü kaldır
</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className={s.footNote}>
                  * Dinamik fiyatlı ürünlerde kur, gram ve admin marjı etkili olabilir.
                </div>
              </div>
            </section>

            <aside className={s.right}>
              <div className={`${s.card} ${s.sticky}`}>
                <div className={s.sumHead}>
                  <div className={s.sumTitle}>Sipariş özeti</div>
                  <div className={s.sumSub}>Ödeme öncesi son kontrol alanı.</div>
                </div>

                <div className={s.sumRow}>
                  <span className={s.muted2}>Ara toplam</span>
                  <b>{fmtTRY(totalTry)}</b>
                </div>

                <div className={s.sumRow}>
                  <span className={s.muted2}>Kargo</span>
                  <b className={s.ok}>Ücretsiz</b>
                </div>

                <div className={s.sumRow}>
                  <span className={s.muted2}>İndirim</span>
                  <b className={campaignDiscountTry > 0 ? s.ok : s.muted2}>
                    {campaignDiscountTry > 0 ? `-${fmtTRY(campaignDiscountTry)}` : "—"}
                  </b>
                </div>
                  {serviceTotalTry > 0 ? (
                <div className={s.sumRow}>
                  <span className={s.muted2}>Ek hizmet</span>
                  <b>{fmtTRY(serviceTotalTry)}</b>
                </div>
              ) : null}
                <div className={s.divider} />

                <div className={s.sumTotal}>
                  <span>Toplam</span>
                 <span className={s.total}>{fmtTRY(cartFinalTry)}</span>
                </div>
{showRateBox ? (
  <div className={s.rateBox} aria-live="polite">
    <div className={s.rateTop}>
      <div className={s.rateLabel}>Kur Güncelleme</div>
      <span className={`${s.rateDot} ${s.rateDotOn}`} />
    </div>

    <div className={s.rateTime}>{mmss}</div>

    <div className={s.rateSub}>
      Kur bazlı ürün fiyatları otomatik yenilenir.
    </div>
  </div>
) : null}
              {campaignResult.campaign ? (
  <div className={s.campaignBox}>
    <div>
      <span className={s.campaignKicker}>Kampanya</span>
      <b>{pickCampaignText(campaignResult.campaign.title, "tr")}</b>
      <small>{pickCampaignText(campaignResult.campaign.description, "tr")}</small>
    </div>

    <strong>
      {String(campaignResult.campaign.discountType) === "fixed"
        ? fmtTRY(campaignResult.campaign.discountValue || 0)
        : `%${campaignResult.campaign.discountValue || 0}`}
    </strong>
  </div>
) : null}
{serviceCampaigns.length ? (
  <div className={s.serviceList}>
    {serviceCampaigns.map((service: any) => {
      const id = String(service.id || "").trim();
      const selected = selectedServices[id] === true;

      const title = pickCampaignText(service.title, "tr") || "Ek hizmet";
      const desc = pickCampaignText(service.subtitle || service.description, "tr");

      const freeOverTry = Number(service.freeOverTry || 0);
      const servicePriceTry = Number(service.servicePriceTry || 0);
      const isFree = freeOverTry > 0 && totalTry >= freeOverTry;

      return (
        <div key={id} className={s.serviceBox}>
          <div className={s.serviceText}>
            <span className={s.serviceKicker}>Ek Hizmet</span>
            <b>{title}</b>

            {desc ? <small>{desc}</small> : null}

            <em>
              {isFree
                ? "Bu sepet için ücretsiz"
                : servicePriceTry > 0
                ? `Ek ücret: ${fmtTRY(servicePriceTry)}`
                : "Ücretsiz"}
            </em>
          </div>

          <div className={s.serviceChoice}>
            <button
              type="button"
              className={`${s.serviceChoiceBtn} ${selected ? s.serviceChoiceBtnOn : ""}`}
              onClick={() => {
  const next = {
    ...selectedServices,
    [id]: true,
  };

  saveSelectedServices(next);
}}
            >
              <span className={s.serviceCheckIcon} />
              Evet
            </button>

            <button
              type="button"
              className={`${s.serviceChoiceBtn} ${!selected ? s.serviceChoiceBtnOffOn : ""}`}
             onClick={() => {
  const next = {
    ...selectedServices,
    [id]: false,
  };

  saveSelectedServices(next);
}}
            >
              <span className={s.serviceXIcon} />
              Hayır
            </button>
          </div>
        </div>
      );
    })}
  </div>
) : null}
                {hasMissingRingSize ? (
  <button
    type="button"
    className={`${s.btn} ${s.dark} ${s.big} ${s.disabledBtn}`}
    disabled
  >
    Önce yüzük ölçüsü seç
  </button>
) : (
  <button
    type="button"
    id="fb-checkout-btn"
    data-fb="InitiateCheckout"
    className={`${s.btn} ${s.dark} ${s.big}`}
    onClick={() => {
      // Meta Pixel: InitiateCheckout event
      const contentIds = rows.map(({ it }) => String((it as any).productId || it.id || "")).filter(Boolean);
      const contents = rows.map(({ it, qty }) => ({ id: String((it as any).productId || it.id || ""), quantity: qty }));
      trackMetaInitiateCheckout({
        value: cartFinalTry,
        currency: "TRY",
        num_items: itemCount,
        content_ids: contentIds,
        contents,
      });

      // GA4: begin_checkout event (dataLayer → GTM → GA4)
      try {
        const dl = ((window as any).dataLayer = (window as any).dataLayer || []);
        dl.push({ ecommerce: null }); // GA4 best practice: önceki ecommerce verisini temizle
        dl.push({
          event: "begin_checkout",
          ecommerce: {
            currency: "TRY",
            value: cartFinalTry,
            items: rows.map(({ it, qty, unitTry }) => ({
              item_id: String((it as any).productId || it.id || ""),
              item_name: String(it.title || "Ürün"),
              item_brand: "Dromocob",
              price: Number(unitTry || 0),
              quantity: Number(qty || 1),
            })),
          },
        });
      } catch {
        // GA4 event hatası UX'i etkilememeli
      }

      window.location.href = "/checkout";
    }}
  >
    Ödemeye Geç
  </button>
)}

                <div className={s.miniInfo}>
                  <div className={s.miniLine}><span className={s.dot} /> Kart & Havale</div>
                  <div className={s.miniLine}><span className={s.dot} /> Sigortalı kargo</div>
                  <div className={s.miniLine}><span className={s.dot} /> Destek hattı</div>
                </div>
              </div>
            </aside>
          </div>
        )}
{bundleLoading ? (
  <section className={s.bundleSection} aria-label="Set önerisi yükleniyor">
    <div className={s.bundleCard}>
      <div className={s.bundleLeft}>
        <div className={s.bundleBadge}>Set Önerisi</div>
        <div className={s.bundleTitle}>Set önerileri hazırlanıyor...</div>
        <div className={s.bundleSub}>
          Sepetindeki ürünlere göre uyumlu ürünler kontrol ediliyor.
        </div>
      </div>
    </div>
  </section>
) : null}
       {!bundleLoading && hasBundle ? (
  <section className={s.bundleSection} aria-label="Set olarak satın al">
    <div className={s.bundleCard}>
      <div className={s.bundleLeft}>
        <div className={s.bundleBadge}>Set Önerisi</div>
        <div className={s.bundleTitle}>{bundleTitle}</div>
        <div className={s.bundleSub}>{bundleSubtitle}</div>

        <div className={s.bundleMiniRow}>
          {bundleProducts.slice(0, 3).map((it) => {
            const sku = it?.sku;
            return (
              <div key={String(it.id)} className={s.bundleMini}>
                <div className={s.bundleMiniImg}>
                  <img
                    src={getBundleImage(it)}
                    alt={pickTextLocal(it?.title, "tr") || it?.name || "Ürün"}
                  />
                </div>

                <div className={s.bundleMiniBody}>
                  <div className={s.bundleMiniName}>
                    {pickTextLocal(it?.title, "tr") || it?.name || "Ürün"}
                  </div>
                  {sku ? <div className={s.bundleMiniSku}>Ürün kodu: {sku}</div> : null}
                </div>
              </div>
            );
          })}

          {bundleProducts.length > 3 ? (
            <div className={s.bundleMore}>+{bundleProducts.length - 3}</div>
          ) : null}
        </div>

        <div className={s.bundleNote}>
          * Set önerileri bilgilendirme amaçlıdır. Sepetteki ürünler baz alınır.
        </div>
      </div>

      <div className={s.bundleRight}>
        <div className={s.bundlePriceBox}>
          <div className={s.bundlePriceLabel}>Set Toplamı</div>
          <div className={s.bundlePriceValue}>{fmtTRY(bundleFinalTry)}</div>
          <div className={s.bundlePriceHint}>Ücretsiz kargo • Güvenli ödeme</div>
        </div>

        <button
          type="button"
          className={`${s.btn} ${s.dark} ${s.bundleBtn}`}
          onClick={() => {
            addBundleToCart();
            setBundleOpen(false);
          }}
        >
          Set olarak devam et →
        </button>

        <button
          type="button"
          className={`${s.btn} ${s.ghost} ${s.bundleGhost}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBundleOpen(true);
          }}
        >
          Seti düzenle
        </button>
      </div>
    </div>

    {bundleOpen ? (
      <div
        className={s.bundleModalBackdrop}
        role="dialog"
        aria-modal="true"
        onClick={() => setBundleOpen(false)}
      >
        <div className={s.bundleModal} onClick={(e) => e.stopPropagation()}>
          <div className={s.bundleModalTop}>
            <div className={s.bundleModalTitle}>Seti düzenle</div>
            <button
              className={s.bundleModalClose}
              type="button"
              onClick={() => setBundleOpen(false)}
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          <div className={s.bundleModalBody}>
            <div className={s.bundleEditSub}>
              Sepetindeki ürünlere göre oluşan bu seti dilediğin gibi düzenleyebilirsin.
            </div>

            <div className={s.bundleEditGrid}>
              {bundleProducts.map((it) => {
                const liveProduct = getCachedProductForCartItem(productCache, it);
                const sku = liveProduct?.sku;
                const imageSrc = getBundleImage(liveProduct || it);

                return (
                  <div key={String(it.id)} className={s.bundleEditItem}>
                    <div className={s.bundleEditImg}>
                      <img
                        src={imageSrc}
                        alt={pickTextLocal(it?.title, "tr") || it?.name || "Ürün"}
                      />
                    </div>

                    <div className={s.bundleEditInfo}>
                      <div className={s.bundleEditName}>
                        {pickTextLocal(it?.title, "tr") || it?.name || "Ürün"}
                      </div>
                      {sku ? <div className={s.bundleEditSku}>Ürün kodu: {sku}</div> : null}
                      <div className={s.bundleEditQty}>Adet: 1</div>
                    </div>

                    <div className={s.bundleEditActions}>
                      <button
                        type="button"
                        className={s.bundleEditBtn}
                        onClick={() =>
                          setBundleProducts((prev) =>
                            prev.filter((x) => String(x.id) !== String(it.id))
                          )
                        }
                      >
                        Setten çıkar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={s.bundleModalFoot}>
              <div className={s.bundleFootPrice}>
                <span>Set Toplamı</span>
                <b>{fmtTRY(bundleFinalTry)}</b>
              </div>

              <div className={s.bundleFootBtns}>
                <Link
                  href="/shop"
                  className={`${s.btn} ${s.ghost}`}
                  onClick={() => setBundleOpen(false)}
                >
                  Mağazaya git
                </Link>

                <button
                  type="button"
                  className={`${s.btn} ${s.dark}`}
                  onClick={() => {
                    addBundleToCart();
                    setBundleOpen(false);
                  }}
                >
                  Set ile devam →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null}
  </section>
) : null}

<section className={s.sectionBlock}>
  <div className={s.sectionHead}>
    <div>
      <h2 className={s.sectionTitle}></h2>
      <div className={s.sectionSub}></div>
    </div>
  </div>
  <CartRecommendations />
</section>
        <section className={s.infoSection}>
          <div className={s.infoHead}>
            <h2 className={s.infoTitle}>Siparişiniz Nasıl Gelecek?</h2>
            <div className={s.infoSub}>Koruma, doğrulama ve premium teslim süreci.</div>
          </div>

          <div className={s.infoGrid}>
            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>Sertifika & Doğrulama</div>
              <div className={s.infoCardText}>Ürün bilgileri ve doğrulama detaylarıyla teslim edilir.</div>
            </div>

            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>Sigortalı Kargo</div>
              <div className={s.infoCardText}>Koruyucu paketleme ve güvenli gönderim standardı uygulanır.</div>
            </div>

            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>İade / Değişim Desteği</div>
              <div className={s.infoCardText}>Uygun koşullarda profesyonel destek sağlanır.</div>
            </div>

            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>SSL & Güvenli Ödeme</div>
              <div className={s.infoCardText}>Ödeme süreçlerinde güvenlik standartları korunur.</div>
            </div>

            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>Bakım & Kullanım Bilgisi</div>
              <div className={s.infoCardText}>Ürünün uzun ömürlü kullanımı için yönlendirme sunulur.</div>
            </div>

            <div className={s.infoCard}>
              <div className={s.infoCardTitle}>Canlı Destek</div>
              <div className={s.infoCardText}>Sipariş sonrası süreçte hızlı iletişim desteği sağlanır.</div>
            </div>
          </div>
        </section>
      </div>
      {removeConfirm.open && removeConfirm.item ? (
  <div
    className={s.confirmBackdrop}
    role="dialog"
    aria-modal="true"
    onClick={() =>
      setRemoveConfirm({
        open: false,
        item: null,
      })
    }
  >
    <div
      className={s.confirmModal}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.confirmIcon}>!</div>

      <div className={s.confirmTitle}>Ürün sepetten kaldırılsın mı?</div>

      <div className={s.confirmText}>
        {removeConfirm.item.title || "Bu ürün"} sepetinden kaldırılacak.
      </div>

      <div className={s.confirmActions}>
        <button
          type="button"
          className={s.confirmCancel}
          onClick={() =>
            setRemoveConfirm({
              open: false,
              item: null,
            })
          }
        >
          Vazgeç
        </button>

        <button
          type="button"
          className={s.confirmDelete}
          onClick={async () => {
            const item = removeConfirm.item;

            setRemoveConfirm({
              open: false,
              item: null,
            });

            if (item) {
              await removeCartEverywhere(item);
            }
          }}
        >
          Evet, kaldır
        </button>
      </div>
    </div>
  </div>
) : null}
    </main>
  );
}
