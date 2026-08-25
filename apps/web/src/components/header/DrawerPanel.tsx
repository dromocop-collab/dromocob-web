"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { RatesLatest, resolveProductPriceTRY } from "@/lib/pricing";
import type { CartItem } from "@/lib/cart";
import { onIdTokenChanged, type User } from "firebase/auth";
import {
  deleteCartItemFromFirestore,
  saveCartItemToFirestore,
} from "@/lib/cartFirestore";
import { runCartExpiryCheck } from "@/lib/cartExpiry";
import styles from "./styles/drawerPanel.module.css";

type Locale = "tr" | "en";

type Props = {
  open: boolean;
  loc: Locale;
  tab: "cart" | "wish";
  setTab: (v: "cart" | "wish") => void;
  cartItems: CartItem[];
  favItems: any[];
  favProductMap: Record<string, any>;
  rates: RatesLatest | null;
  productStockMap: Record<string, number>;
  cartCount: number;
  wishCount: number;
  cartSubtotal: number;
  money: (v: number, loc: Locale) => string;
  onClose: () => void;
  onRemoveCart: (type: "cart", id: string, title: string, image?: string) => void;
  onRemoveWish: (type: "wish", id: string, title: string, image?: string) => void;
  onIncQty: (id: string, qty: number) => void;
  onDecQty: (id: string, qty: number) => void;
};

type DrawerVariantOption = {
  value: string;
  label?: {
    tr?: string;
    en?: string;
  };
  priceDelta?: number;
  hasGram?: number;
  weightGram?: number;
  gram?: number;
  isActive?: boolean;
  order?: number;
};

type DrawerVariantGroup = {
  id: string;
  label?: {
    tr?: string;
    en?: string;
  };
  required?: boolean;
  options?: DrawerVariantOption[];
};

type DrawerVariantPreset = {
  enabled?: boolean;
  groups?: DrawerVariantGroup[];
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type DrawerCategoryMeta = {
  variantPreset: DrawerVariantPreset | null;
  pricing: any | null;
};
function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function defaultRingSizes(): string[] {
  return Array.from({ length: 23 }, (_, i) => String(i + 8)); // 8 - 30
}

function getFavImage(it: any, live: any) {
  return (
    safeStr(live?.image) ||
    safeStr(live?.mainImage) ||
    safeStr(live?.cover) ||
    safeStr(live?.thumbnail) ||
    (Array.isArray(live?.images) ? safeStr(live.images[0]) : "") ||
    safeStr(it?.image) ||
    safeStr(it?.imageUrl)
  );
}

function getLiveProductFromCartItem(
  it: CartItem,
  favProductMap: Record<string, any>
) {
  const rawId = safeStr(it?.id);
  const productId = safeStr((it as any)?.productId);
  const rawSlug = safeStr((it as any)?.slug);

  return (
    favProductMap[productId] ||
    favProductMap[rawId] ||
    favProductMap[rawSlug] ||
    null
  );
}

function getLiveStock(
  it: CartItem,
  liveProduct: any,
  productStockMap: Record<string, number>
) {
  const rawId = safeStr(it?.id);
  const productId = safeStr((it as any)?.productId);
  const rawSlug = safeStr((it as any)?.slug);
  const liveId = safeStr(liveProduct?.id);

  const stockFromMap =
    productStockMap[liveId] ??
    productStockMap[productId] ??
    productStockMap[rawId] ??
    productStockMap[rawSlug];

  if (typeof stockFromMap === "number" && Number.isFinite(stockFromMap)) {
    return Math.max(0, stockFromMap);
  }

  if (liveProduct && typeof liveProduct === "object" && "stock" in liveProduct) {
    const stockFromProduct = Number(liveProduct.stock);

    if (Number.isFinite(stockFromProduct)) {
      return Math.max(0, stockFromProduct);
    }
  }

  const stockFromCart = Number((it as any)?.stock ?? 0);
  if (Number.isFinite(stockFromCart) && stockFromCart > 0) {
    return Math.max(0, stockFromCart);
  }

  // Canlı ürün henüz hydrate olmadıysa 0 deme.
  // 0 dersen DrawerPanel ürünü otomatik siliyor.
  return 999;
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

function extractCategoryIdsFromProduct(liveProduct: any): string[] {
  const raw =
    liveProduct?.categoryIds ??
    liveProduct?.categories ??
    liveProduct?.categoryId ??
    liveProduct?.catIds ??
    liveProduct?.cats ??
    [];

  if (typeof raw === "string") {
    return raw.trim() ? [raw.trim()] : [];
  }

  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((x: any) => safeStr(x?.id ?? x?.value ?? x))
          .filter(Boolean)
      )
    );
  }

  if (raw && typeof raw === "object") {
    return Array.from(
      new Set(
        Object.values(raw)
          .map((x: any) => safeStr((x as any)?.id ?? (x as any)?.value ?? x))
          .filter(Boolean)
      )
    );
  }

  return [];
}

function sanitizeDrawerVariantPreset(v: any): DrawerVariantPreset | null {
  if (!v || typeof v !== "object") return null;

  const groupsRaw = Array.isArray(v?.groups) ? v.groups : [];

  const groups: DrawerVariantGroup[] = groupsRaw
    .map((g: any) => {
      const id = safeStr(g?.id || g?.label?.tr || g?.label?.en);
      const optionsRaw = Array.isArray(g?.options) ? g.options : [];

      const options: DrawerVariantOption[] = optionsRaw
        .map((o: any, index: number) => {
          const value = safeStr(o?.value ?? o?.label?.tr ?? o?.label?.en);
          if (!value) return null;

          const optionGram = Number(o?.hasGram ?? o?.weightGram ?? o?.gram ?? 0);

return {
  value,
  label: {
    tr: safeStr(o?.label?.tr) || value,
    en: safeStr(o?.label?.en) || value,
  },
  priceDelta: Number(o?.priceDelta || 0),
  ...(Number.isFinite(optionGram) && optionGram > 0
    ? {
        hasGram: optionGram,
        weightGram: optionGram,
        gram: optionGram,
      }
    : {}),
  isActive: o?.isActive !== false,
  order: Number.isFinite(Number(o?.order)) ? Number(o.order) : index,
};
        })
        .filter(Boolean) as DrawerVariantOption[];

      const cleanOptions = options
        .filter((o) => o.value && o.isActive !== false)
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

      if (!id || !cleanOptions.length) return null;

      return {
        id,
        label: {
          tr: safeStr(g?.label?.tr) || id,
          en: safeStr(g?.label?.en),
        },
        required: g?.required !== false,
        options: cleanOptions,
      };
    })
    .filter(Boolean) as DrawerVariantGroup[];

  return {
    enabled: v?.enabled === true,
    groups,
  };
}

function pickProductVariantPreset(liveProduct: any): DrawerVariantPreset | null {
  const raw =
    liveProduct?.variantPreset ||
    liveProduct?.categoryVariantPreset ||
    liveProduct?.resolvedCategoryVariantPreset ||
    liveProduct?.categoryPreset ||
    liveProduct?.category?.variantPreset ||
    null;

  return sanitizeDrawerVariantPreset(raw);
}

function getVariantGroupsFromPreset(preset: DrawerVariantPreset | null): DrawerVariantGroup[] {
  if (!preset?.enabled) return [];
  return Array.isArray(preset.groups) ? preset.groups : [];
}

function findRingSizeGroupFromGroups(groups: DrawerVariantGroup[]) {
  return (
    groups.find((g) => {
      const hay = [g.id, g.label?.tr, g.label?.en]
        .map((x) => safeStr(x).toLocaleLowerCase("tr-TR"))
        .join(" ");

      return (
        hay.includes("ring_size") ||
        hay.includes("yuzuk") ||
        hay.includes("yüzük") ||
        hay.includes("ring") ||
        hay.includes("ölçü") ||
        hay.includes("olcu")
      );
    }) || null
  );
}

function getRingSizeGroup(
  liveProduct: any,
  categoryVariantMap: Record<string, DrawerVariantPreset | null>
): DrawerVariantGroup | null {
  const productPreset = pickProductVariantPreset(liveProduct);
  const productGroup = findRingSizeGroupFromGroups(getVariantGroupsFromPreset(productPreset));

  if (productGroup) return productGroup;

  const categoryIds = extractCategoryIdsFromProduct(liveProduct);

  for (const categoryId of categoryIds) {
    const preset = categoryVariantMap[categoryId];
    const group = findRingSizeGroupFromGroups(getVariantGroupsFromPreset(preset));
    if (group) return group;
  }

  return null;
}

function getRingSizesFromGroup(group: DrawerVariantGroup | null, loc: Locale): string[] {
  if (!group?.options?.length) return [];

  return Array.from(
    new Set(
      group.options
        .map((o) => {
          const label = loc === "en" ? o.label?.en : o.label?.tr;
          return safeStr(label) || safeStr(o.value);
        })
        .filter(Boolean)
    )
  ).sort((a, b) => Number(a) - Number(b));
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

  return (
    title.includes("yüzük") ||
    title.includes("yuzuk") ||
    slug.includes("yuzuk") ||
    slug.includes("yüzük") ||
    categoryText.includes("yuzuk") ||
    categoryText.includes("yüzük") ||
    categoryText.includes("ring")
  );
}

function needsRingSizeSelection(
  it: CartItem,
  liveProduct: any,
  categoryVariantMap: Record<string, DrawerVariantPreset | null>
) {
  const ringGroup = getRingSizeGroup(liveProduct, categoryVariantMap);
  return Boolean(ringGroup) || isRingLikeProduct(it, liveProduct);
}
function isDynamicPricingSource(x: any) {
  if (!x || typeof x !== "object") return false;

  return (
    x.enabled === true ||
    x.mode === "dynamic" ||
    x.model === "gram" ||
    Boolean(x.rateKey) ||
    Boolean(x.rateCode)
  );
}

function getCategoryPricingForDrawerProduct(
  liveProduct: any,
  categoryPricingMap: Record<string, any | null>
) {
  if (!liveProduct) return null;

  const direct =
    liveProduct?.categoryPricing ||
    liveProduct?.resolvedCategoryPricing ||
    liveProduct?.category?.pricing ||
    null;

  if (isDynamicPricingSource(direct)) return direct;

  const ids = extractCategoryIdsFromProduct(liveProduct);

  for (const id of ids) {
    const pricing = categoryPricingMap[id];
    if (isDynamicPricingSource(pricing)) return pricing;
  }

  return null;
}
function getCartVariantGram(it: CartItem) {
  const variantItems = Array.isArray((it as any)?.selectedVariantItems)
    ? (it as any).selectedVariantItems
    : [];

  const found = variantItems.find((v: any) => {
    const gram = Number(v?.hasGram ?? v?.weightGram ?? v?.gram ?? 0);
    return Number.isFinite(gram) && gram > 0;
  });

  const gram = Number(found?.hasGram ?? found?.weightGram ?? found?.gram ?? 0);

  return Number.isFinite(gram) && gram > 0 ? gram : 0;
}

function applyCartVariantGramToProduct(
  liveProduct: any,
  it: CartItem,
  categoryPricingMap: Record<string, any | null>
) {
  if (!liveProduct) return liveProduct;

  const gram = getCartVariantGram(it);
  const categoryPricing = getCategoryPricingForDrawerProduct(liveProduct, categoryPricingMap);

  if (!gram) {
    return {
      ...liveProduct,
      categoryPricing: liveProduct?.categoryPricing || categoryPricing || null,
      resolvedCategoryPricing:
        liveProduct?.resolvedCategoryPricing || categoryPricing || null,
    };
  }

  const effectivePricing =
    liveProduct?.pricing ||
    liveProduct?.dynamicPricing ||
    liveProduct?.categoryPricing ||
    liveProduct?.resolvedCategoryPricing ||
    categoryPricing ||
    null;

  const patchedPricing =
    effectivePricing && typeof effectivePricing === "object"
      ? {
          ...effectivePricing,
          enabled: effectivePricing.enabled !== false,
          mode: effectivePricing.mode || "dynamic",
          model: effectivePricing.model || "gram",

          gram,
          hasGram: gram,
          weightGram: gram,
          weightGr: gram,
        }
      : null;

  // Varyant gramı base gramdan farklıysa sabit fiyatları sıfırla → dinamik hesaplama devreye girsin
  const baseProductGram = Math.max(0, Number(
    liveProduct?.hasGram ?? liveProduct?.gram ?? liveProduct?.weightGram ?? liveProduct?.weightGr ?? 0
  ));
  const gramChanged = gram > 0 && Math.abs(gram - baseProductGram) > 0.001;

  return {
    ...liveProduct,

    gram,
    hasGram: gram,
    weightGram: gram,
    weightGr: gram,

    // Gram değiştiyse sabit fiyatları sıfırla → dinamik hesaplama devreye girsin
    ...(gramChanged ? { finalPrice: 0, priceTry: 0, final: 0, price: 0, rawPrice: 0 } : {}),

    pricing:
      liveProduct?.pricing && typeof liveProduct.pricing === "object"
        ? {
            ...liveProduct.pricing,
            gram,
            hasGram: gram,
            weightGram: gram,
            weightGr: gram,
          }
        : patchedPricing || liveProduct?.pricing,

    dynamicPricing:
      liveProduct?.dynamicPricing && typeof liveProduct.dynamicPricing === "object"
        ? {
            ...liveProduct.dynamicPricing,
            gram,
            hasGram: gram,
            weightGram: gram,
            weightGr: gram,
          }
        : liveProduct?.dynamicPricing,

    categoryPricing:
      patchedPricing || liveProduct?.categoryPricing || categoryPricing || null,

    resolvedCategoryPricing:
      patchedPricing || liveProduct?.resolvedCategoryPricing || categoryPricing || null,
  };
}

function getDrawerResolvedUnitPrice(

  it: CartItem,

  liveProduct: any,

  rates: RatesLatest | null,

  categoryPricingMap: Record<string, any | null>

) {
  const variantDelta = Array.isArray((it as any)?.selectedVariantItems)
    ? (it as any).selectedVariantItems.reduce(
        (sum: number, v: any) => sum + Number(v?.priceDelta || 0),
        0
      )
    : 0;

const pricingProduct = applyCartVariantGramToProduct(

  liveProduct,

  it,

  categoryPricingMap

);

  if (pricingProduct) {
    const resolved = resolveProductPriceTRY(pricingProduct, rates);
    const livePrice = Number(resolved?.price || 0);

    if (livePrice > 0) {
      return Math.max(0, livePrice + variantDelta);
    }
  }

  return Math.max(0, Number((it as any)?.priceTry || 0) + variantDelta);
}
export default function DrawerPanel({
  open,
  loc,
  tab,
  setTab,
  cartItems,
  favItems,
  favProductMap,
  rates,
  productStockMap,
  cartCount,
  wishCount,
  cartSubtotal,
  money,
  onClose,
  onRemoveCart,
  onRemoveWish,
  onIncQty,
  onDecQty,
}: Props) {
  const isTR = loc === "tr";

  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

 const [categoryVariantMap, setCategoryVariantMap] = useState<
  Record<string, DrawerVariantPreset | null>
>({});

const [categoryPricingMap, setCategoryPricingMap] = useState<Record<string, any | null>>({});

 const [currentUser, setCurrentUser] = useState<User | null>(null);

useEffect(() => {
  const unsub = onIdTokenChanged(auth, (u) => {
    setCurrentUser(u);
  });

  return () => unsub();
}, [auth]);

const cartUid = currentUser && !currentUser.isAnonymous ? currentUser.uid : null;
function syncCartItemToCloud(item: CartItem) {
  if (!cartUid) return;

  saveCartItemToFirestore(cartUid, item).catch((err) => {
    console.error("[drawer cart] firestore item sync failed:", err);
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteCartItemFromCloud(item: CartItem) {
  if (!cartUid) return;

  deleteCartItemFromFirestore(cartUid, item).catch((err) => {
    console.error("[drawer cart] firestore item delete failed:", err);
  });
}

function buildPatchedCartItem(item: CartItem, patch: Partial<CartItem>): CartItem {
  return {
    ...item,
    ...patch,
    qty: Math.max(1, Number(patch.qty ?? item.qty ?? 1)),
  };
}
function getCartStorageKey(uid: string | null) {
  return uid ? `nci_cart_${uid}` : "nci_cart_guest";
}

function readRawCart(uid: string | null): CartItem[] {
  try {
    const raw = window.localStorage.getItem(getCartStorageKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRawCart(uid: string | null, items: CartItem[]) {
  try {
    window.localStorage.setItem(getCartStorageKey(uid), JSON.stringify(items));
  } catch (err) {
    console.error("[drawer cart] local cart write failed:", err);
  }
}

function makeCartLineKey(item: any) {
  const id = safeStr(item?.id);
  const productId = safeStr(item?.productId);
  const slug = safeStr(item?.slug);

  const cartLineId = safeStr(item?.cartLineId);
  const lineId = safeStr(item?.lineId);

  // En güvenlisi varsa özel satır id
  if (cartLineId) return `cartLine:${cartLineId}`;
  if (lineId) return `line:${lineId}`;

  // Bizim mevcut sistemde her ürün genelde id/slug ile tek satır.
  // Ölçü değişince key değişmesin diye selectedSize dahil etmiyoruz.
  if (productId) return `product:${productId}`;
  if (id) return `id:${id}`;
  if (slug) return `slug:${slug}`;

  return "";
}

function sameCartLine(a: any, b: any) {
  const ak = makeCartLineKey(a);
  const bk = makeCartLineKey(b);

  return Boolean(ak && bk && ak === bk);
}

function mergeCartItem(oldItem: CartItem, nextItem: CartItem): CartItem {
  return {
    ...oldItem,
    ...nextItem,

    // Kritik alanları garantiye al
    id: safeStr((nextItem as any).id) || safeStr((oldItem as any).id),
    productId:
      safeStr((nextItem as any).productId) ||
      safeStr((oldItem as any).productId) ||
      safeStr((nextItem as any).id) ||
      safeStr((oldItem as any).id),
    slug: safeStr((nextItem as any).slug) || safeStr((oldItem as any).slug),
    qty: Math.max(1, Number((nextItem as any).qty ?? (oldItem as any).qty ?? 1)),
  } as CartItem;
}

function updateCartItemInMemoryList(
  sourceList: CartItem[],
  nextItem: CartItem
): CartItem[] {
  let found = false;

  const nextList = sourceList.map((oldItem) => {
    if (sameCartLine(oldItem, nextItem)) {
      found = true;
      return mergeCartItem(oldItem, nextItem);
    }

    return oldItem;
  });

  // Normalde bulunur. Bulunmazsa ürünü ekler ama diğerlerini asla silmez.
  if (!found) {
    return [
      ...nextList,
      {
        ...nextItem,
        productId:
          safeStr((nextItem as any).productId) || safeStr((nextItem as any).id),
        qty: Math.max(1, Number((nextItem as any).qty || 1)),
      } as CartItem,
    ];
  }

  return nextList;
}

async function updateCartItemEverywhere(
  nextItem: CartItem,
  uid: string | null,
  allCartItems: CartItem[]
) {
  const finalItem = {
    ...nextItem,
    id: safeStr((nextItem as any).id),
    productId:
      safeStr((nextItem as any).productId) || safeStr((nextItem as any).id),
    slug: safeStr((nextItem as any).slug),
    qty: Math.max(1, Number((nextItem as any).qty || 1)),
  } as CartItem;

  // En sağlam kaynak ekrandaki aktif cartItems.
  // localStorage eksikse bile diğer ürünleri korur.
  const sourceList =
    Array.isArray(allCartItems) && allCartItems.length
      ? allCartItems
      : readRawCart(uid);

  const finalList = updateCartItemInMemoryList(sourceList, finalItem);

  writeRawCart(uid, finalList);

  // Firestore’da sadece ilgili satırı güncelle. Diğer ürünlere dokunma.
  if (uid) {
    await saveCartItemToFirestore(uid, finalItem);
  }

  return {
    before: sourceList,
    after: finalList,
    finalItem,
  };
}
// Stok 0 olan ürünleri otomatik silmiyoruz.
// Kullanıcı kendisi kaldırmalı. Aksi halde beklenmedik şekilde ürünler kayboluyor.

const visibleCartItems = useMemo(() => {
  // Tüm ürünleri göster, stok durumunu kart üzerinde badge ile belirt
  return cartItems;
}, [cartItems]);

  useEffect(() => {
    let alive = true;

    async function loadCategoryVariantPresets() {
      try {
        const ids = Array.from(
          new Set(
            visibleCartItems.flatMap((it) => {
              const liveProduct = getLiveProductFromCartItem(it, favProductMap);
              return extractCategoryIdsFromProduct(liveProduct);
            })
          )
        ).filter(Boolean);

       if (!ids.length) {

  if (alive) {

    setCategoryVariantMap({});

    setCategoryPricingMap({});

  }

  return;

}

        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) {
          chunks.push(ids.slice(i, i + 10));
        }

        const next: Record<string, DrawerVariantPreset | null> = {};
const nextPricing: Record<string, any | null> = {};
        for (const part of chunks) {
          const snap = await getDocs(
            query(collection(db, "categories"), where("__name__", "in", part))
          );

        snap.forEach((d) => {
  const data: any = d.data();

  next[d.id] = sanitizeDrawerVariantPreset(data?.variantPreset);

  nextPricing[d.id] =
    data?.pricing && typeof data.pricing === "object" ? data.pricing : null;

  if (data?.slug) {
    nextPricing[String(data.slug)] =
      data?.pricing && typeof data.pricing === "object" ? data.pricing : null;
  }
});
        }

        if (alive) {

  setCategoryVariantMap(next);

  setCategoryPricingMap(nextPricing);

}
      } catch (e) {
        console.error("drawer category variant presets error:", e);
       if (alive) {

  setCategoryVariantMap({});

  setCategoryPricingMap({});

}
      }
    }

    loadCategoryVariantPresets();

    return () => {
      alive = false;
    };
  }, [db, visibleCartItems, favProductMap]);

  const visibleCartCount = useMemo(() => {
    return visibleCartItems.reduce(
      (sum, it) => sum + Math.max(1, Number(it.qty || 1)),
      0
    );
  }, [visibleCartItems]);

const visibleCartSubtotal = useMemo(() => {
  return visibleCartItems.reduce((sum, it) => {
    const qty = Math.max(1, Number(it.qty || 1));
    const liveProduct = getLiveProductFromCartItem(it, favProductMap);
const unitPrice = getDrawerResolvedUnitPrice(

  it,

  liveProduct,

  rates,

  categoryPricingMap

);

    return sum + unitPrice * qty;
  }, 0);
}, [visibleCartItems, favProductMap, rates, categoryPricingMap]);

  const hasMissingRingSize = useMemo(() => {
    return visibleCartItems.some((it) => {
      const liveProduct = getLiveProductFromCartItem(it, favProductMap);
      const selectedSize = safeStr((it as any).selectedSize);

      return needsRingSizeSelection(it, liveProduct, categoryVariantMap) && !selectedSize;
    });
  }, [visibleCartItems, favProductMap, categoryVariantMap]);
useEffect(() => {
  const root = document.documentElement;
  const body = document.body;

  const prevHtmlOverflow = root.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevBodyTouchAction = body.style.touchAction;

  const chatRoot = document.querySelector<HTMLElement>("[data-chat-widget-root]");
  const chatLauncher = document.querySelector<HTMLElement>("[data-chat-launcher]");

  const prevChatRootDisplay = chatRoot?.style.display || "";
  const prevChatLauncherDisplay = chatLauncher?.style.display || "";

  if (open) {
    root.classList.add("nci-drawer-open");

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    if (chatRoot) chatRoot.style.display = "none";
    if (chatLauncher) chatLauncher.style.display = "none";
  } else {
    root.classList.remove("nci-drawer-open");

    root.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    body.style.touchAction = prevBodyTouchAction;

    if (chatRoot) chatRoot.style.display = prevChatRootDisplay;
    if (chatLauncher) chatLauncher.style.display = prevChatLauncherDisplay;
  }

  return () => {
    root.classList.remove("nci-drawer-open");

    root.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    body.style.touchAction = prevBodyTouchAction;

    if (chatRoot) chatRoot.style.display = prevChatRootDisplay;
    if (chatLauncher) chatLauncher.style.display = prevChatLauncherDisplay;
  };
}, [open]);
useEffect(() => {

  if (!open) return;

  if (!cartUid) return;

  if (!visibleCartItems.length) return;

  visibleCartItems.forEach((item) => {

    const id = safeStr((item as any).id);

    const productId = safeStr((item as any).productId) || id;

    const slug = safeStr((item as any).slug);

    if (!id && !productId && !slug) return;

    const cleanItem = {

      ...item,

      id: id || productId || slug,

      productId: productId || id || slug,

      slug,

      qty: Math.max(1, Number((item as any).qty || 1)),

    } as CartItem;

    saveCartItemToFirestore(cartUid, cleanItem).catch((err) => {

      console.error("[drawer cart] cloud backfill failed:", err);

    });

  });

}, [open, cartUid, visibleCartItems]);

// 24 saat kuralı: drawer açıldığında süresi dolmuş ürünleri kontrol et
const [expiryMsg, setExpiryMsg] = useState<string | null>(null);
const [cartExpirySettings, setCartExpirySettings] = useState({
  enabled: true,
  hours: 24,
  moveToFavorites: true,
});
const [cartExpirySettingsReady, setCartExpirySettingsReady] = useState(false);

useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "settings", "public"),
    (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};
      const expiry = data?.cartExpiry && typeof data.cartExpiry === "object"
        ? data.cartExpiry
        : {};

      setCartExpirySettings({
        enabled: expiry.enabled !== false,
        hours: Number(expiry.hours) > 0 ? Number(expiry.hours) : 24,
        moveToFavorites: expiry.moveToFavorites !== false,
      });
      setCartExpirySettingsReady(true);
    },
    (error) => {
      console.error("[drawer cart] expiry settings failed:", error);
      setCartExpirySettingsReady(true);
    }
  );

  return () => unsub();
}, [db]);

useEffect(() => {
  if (!open) {
    setExpiryMsg(null);
    return;
  }
  if (!cartExpirySettingsReady || !cartExpirySettings.enabled) return;

  const result = runCartExpiryCheck(cartUid, {
    enabled: cartExpirySettings.enabled,
    expiryHours: cartExpirySettings.hours,
    moveToFavorites: cartExpirySettings.moveToFavorites,
  });
  if (result.movedToFavorites > 0) {
    setExpiryMsg(
      isTR
        ? `${result.movedToFavorites} ürün süresi dolduğu için favorilere taşındı.`
        : `${result.movedToFavorites} item(s) moved to favorites (expired).`
    );
    // cart:changed event ile sepet yenilenecek
    window.dispatchEvent(new Event("cart:changed"));
  } else if (result.expired.length > 0) {
    setExpiryMsg(
      isTR
        ? `${result.expired.length} ürün süresi dolduğu için sepetten kaldırıldı.`
        : `${result.expired.length} expired item(s) removed from the cart.`
    );
    window.dispatchEvent(new Event("cart:changed"));
  }
}, [
  open,
  cartUid,
  isTR,
  cartExpirySettings.enabled,
  cartExpirySettings.hours,
  cartExpirySettings.moveToFavorites,
  cartExpirySettingsReady,
]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay — drawer arkasını kapatır */}
      <div
        className={styles.overlay}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${styles.open}`}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? "Sepet ve favori paneli" : "Cart and wishlist panel"}
      >
      <div className={styles.head}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "cart" ? styles.active : ""}`}
            onClick={() => setTab("cart")}
            type="button"
          >
            {isTR ? "Sepet" : "Cart"}{" "}
            <span>{tab === "cart" ? visibleCartCount : cartCount}</span>
          </button>

          <button
            className={`${styles.tab} ${tab === "wish" ? styles.active : ""}`}
            onClick={() => setTab("wish")}
            type="button"
          >
            {isTR ? "Favori" : "Wishlist"} <span>{wishCount}</span>
          </button>
        </div>

        <button
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
          aria-label={isTR ? "Paneli kapat" : "Close panel"}
        >
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {tab === "cart" ? (
          visibleCartItems.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>
                {isTR ? "Sepet boş" : "Cart is empty"}
              </div>

              <p className={styles.emptyText}>
                {isTR
                  ? "Mağazadan ürün eklediğinde burada görünecek."
                  : "Products you add from the store will appear here."}
              </p>

              <Link href="/shop" className={styles.primaryBtn} onClick={onClose}>
                {isTR ? "Mağazaya git" : "Go to shop"}
              </Link>
            </div>
          ) : (
            <>
              {expiryMsg ? (
                <div style={{
                  padding: "10px 14px",
                  margin: "0 0 8px",
                  background: "rgba(255,180,60,0.12)",
                  border: "1px solid rgba(255,180,60,0.3)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#b8860b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>⏱️</span>
                  <span>{expiryMsg}</span>
                </div>
              ) : null}
              <div className={styles.list}>
                {visibleCartItems.map((it) => {
                  const qty = Math.max(1, Number(it.qty || 1));
                  const title = safeStr(it.title) || (isTR ? "Ürün" : "Product");
                  const href = it.slug
                    ? `/products/${encodeURIComponent(it.slug)}`
                    : `/products/${encodeURIComponent(String(it.id || ""))}`;

                  const liveProduct = getLiveProductFromCartItem(it, favProductMap);

                  const image =
                    safeStr(it.image) ||
                    safeStr(liveProduct?.image) ||
                    safeStr(liveProduct?.mainImage) ||
                    safeStr(liveProduct?.cover) ||
                    safeStr(liveProduct?.thumbnail);

                  const stock = getLiveStock(it, liveProduct, productStockMap);
                  const isOutOfStock = stock <= 0;
                 const unitPrice = getDrawerResolvedUnitPrice(

  it,

  liveProduct,

  rates,

  categoryPricingMap

);


                  const selectedSize = safeStr((it as any).selectedSize);
                  const ringGroup = getRingSizeGroup(liveProduct, categoryVariantMap);

                  const shouldAskSize = needsRingSizeSelection(
                    it,
                    liveProduct,
                    categoryVariantMap
                  );

                  const presetSizes = getRingSizesFromGroup(ringGroup, loc);
                  const productSizes = getProductSizes(liveProduct);

                  const sizes = shouldAskSize
                    ? presetSizes.length
                      ? presetSizes
                      : productSizes.length
                        ? productSizes
                        : defaultRingSizes()
                    : [];

                  return (
                    <article
  className={styles.itemCard}
  key={`${safeStr((it as any).productId) || safeStr(it.id)}-${safeStr((it as any).selectedSize) || "no-size"}-${safeStr((it as any).slug) || "no-slug"}`}
>
                      <Link href={href} className={styles.mediaWrap} onClick={onClose}>
                        {image ? (
                          <img src={image} alt={title} className={styles.media} />
                        ) : (
                          <div className={styles.mediaPh}>DROMOCOB</div>
                        )}
                      </Link>

                      <div className={styles.itemMain}>
                        <div className={styles.itemTop}>
                          <div className={styles.itemInfo}>
                            <Link href={href} className={styles.itemTitle} onClick={onClose}>
                              {title}
                            </Link>

                            <div className={styles.itemBadges}>
                              <span className={styles.metaPill}>
                                {isTR ? "Sepet Ürünü" : "Cart Item"}
                              </span>

                              <span
                                className={`${styles.stockPill} ${
                                  isOutOfStock ? styles.stockPillBad : styles.stockPillOk
                                }`}
                              >
                                {isTR ? `Stok: ${stock}` : `Stock: ${stock}`}
                              </span>
                            </div>

                            {shouldAskSize ? (
                              <div className={styles.sizeSelectBox}>
                                <label className={styles.sizeSelectLabel}>
                                  {isTR ? "Yüzük Ölçünüz" : "Ring Size"}
                                </label>

                                <select
                                  className={`${styles.sizeSelect} ${
                                    !selectedSize ? styles.sizeSelectWarn : ""
                                  }`}
                                  value={selectedSize}
                                  onChange={async (e) => {
  const nextSize = e.target.value;
console.log("[DrawerPanel] size change item", {
  id: it.id,
  productId: (it as any).productId,
  slug: (it as any).slug,
  nextSize,
});
const oldVariantItems = Array.isArray((it as any).selectedVariantItems)
  ? (it as any).selectedVariantItems.filter(
      (v: any) => safeStr(v?.groupId) !== "ring_size"
    )
  : [];

const sizeOption = ringGroup?.options?.find((o: any) => {
  const labelTr = safeStr(o?.label?.tr);
  const labelEn = safeStr(o?.label?.en);
  const value = safeStr(o?.value);

  return (
    value === safeStr(nextSize) ||
    labelTr === safeStr(nextSize) ||
    labelEn === safeStr(nextSize)
  );
});

const sizeGram = Number(
  sizeOption?.hasGram ??
    sizeOption?.weightGram ??
    sizeOption?.gram ??
    0
);

const sizePriceDelta = Number(sizeOption?.priceDelta || 0);

const patch = {
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
          groupLabel: isTR ? "Yüzük Ölçünüz" : "Ring Size",
          value: nextSize,
          label: nextSize,
          priceDelta: Number.isFinite(sizePriceDelta) ? sizePriceDelta : 0,

          ...(Number.isFinite(sizeGram) && sizeGram > 0
            ? {
                hasGram: sizeGram,
                weightGram: sizeGram,
                gram: sizeGram,
              }
            : {}),
        },
      ]
    : oldVariantItems,
} as Partial<CartItem>;

  const stockSafe = getLiveStock(it, liveProduct, productStockMap);
  const cleanStock = stockSafe === 999 ? Number((it as any).stock || 1) : stockSafe;
const finalDrawerUnitPrice = getDrawerResolvedUnitPrice(
  {
    ...it,
    ...patch,
  } as CartItem,
  liveProduct,
  rates,
  categoryPricingMap
);

const patchedItem = buildPatchedCartItem(it, {
  ...patch,
  id: safeStr(it.id),
  productId: safeStr((it as any).productId) || safeStr(it.id),
  slug: safeStr((it as any).slug),
  stock: cleanStock,
  qty: Math.max(
    1,
    Math.min(Number(it.qty || 1), Math.max(1, cleanStock))
  ),
lockedUnitPriceTry: finalDrawerUnitPrice,
  priceTry: finalDrawerUnitPrice,
  unitPriceTry: finalDrawerUnitPrice,
  resolvedUnitPrice: finalDrawerUnitPrice,
} as any);

  try {
  await updateCartItemEverywhere(patchedItem, cartUid, cartItems);

  window.dispatchEvent(new Event("cart:changed"));
} catch (err) {
  console.error("[DrawerPanel] size update failed:", err);

  // Firestore patlasa bile local sepeti güvenli şekilde güncelle.
  // Diğer ürünlere asla dokunmaz.
  const sourceList =
    Array.isArray(cartItems) && cartItems.length
      ? cartItems
      : readRawCart(cartUid);

  const finalList = updateCartItemInMemoryList(sourceList, patchedItem);

  writeRawCart(cartUid, finalList);
  window.dispatchEvent(new Event("cart:changed"));
}
}}
                                >
                                  <option value="">
                                    {isTR ? "Ölçü seçiniz" : "Select size"}
                                  </option>

                                  {sizes.map((size) => (
                                    <option key={size} value={size}>
                                      {size}
                                    </option>
                                  ))}
                                </select>

                                {!selectedSize ? (
                                  <div className={styles.sizeSelectHint}>
                                    {isTR
                                      ? "Ödeme öncesi yüzük ölçüsü seçilmelidir."
                                      : "Ring size must be selected before checkout."}
                                  </div>
                                ) : null}
                              </div>
                            ) : selectedSize ? (
                              <div className={styles.optionPills}>
                                <span className={styles.optionPill}>
                                  {isTR ? "Yüzük Ölçünüz" : "Ring Size"}: {selectedSize}
                                </span>
                              </div>
                            ) : null}

                            {Array.isArray((it as any).selectedVariantItems) &&
                            (it as any).selectedVariantItems.filter(
                              (v: any) => safeStr(v?.groupId) !== "ring_size"
                            ).length ? (
                              <div className={styles.optionPills}>
                                {(it as any).selectedVariantItems
                                  .filter(
                                    (v: any) => safeStr(v?.groupId) !== "ring_size"
                                  )
                                  .map((v: any, index: number) => (
                                    <span
                                      key={`${safeStr(v?.groupId)}-${safeStr(
                                        v?.value
                                      )}-${index}`}
                                      className={styles.optionPill}
                                    >
                                      {safeStr(v?.groupLabel)}: {safeStr(v?.label)}
                                    </span>
                                  ))}
                              </div>
                            ) : null}
                          </div>

                       <button

  className={styles.removeBtn}

  type="button"

  onClick={() => {

    onRemoveCart("cart", it.id, title, image);

  }}

  aria-label={isTR ? "Ürünü kaldır" : "Remove product"}

>

  ✕

</button>
                        </div>

                                  <div className={styles.compactPriceRow}>
            <div>
              <span className={styles.compactPriceLabel}>
                {isTR ? "Birim" : "Unit"}
              </span>
              <b className={styles.compactPriceValue}>{money(unitPrice, loc)}</b>
            </div>

            {qty > 1 ? (
              <span className={styles.compactLineHint}>
                {isTR ? `${qty} adet` : `${qty} pcs`}
              </span>
            ) : null}
          </div>
                        <div className={styles.itemBottom}>
                          <div className={styles.qtyControl}>
                            <button
                              onClick={() => {
                               if (qty <= 1) {
  onRemoveCart("cart", it.id, title, image);
  return;
}

const nextQty = Math.max(1, qty - 1);

onDecQty(it.id, qty);
syncCartItemToCloud(buildPatchedCartItem(it, { qty: nextQty }));
                              }}
                              type="button"
                              aria-label={isTR ? "Adedi azalt" : "Decrease quantity"}
                            >
                              −
                            </button>

                            <span>{qty}</span>

                            <button
  onClick={() => {
    const nextQty = Math.min(stock || 99, qty + 1);

    onIncQty(it.id, qty);
    syncCartItemToCloud(buildPatchedCartItem(it, { qty: nextQty }));
  }}
  type="button"
  aria-label={isTR ? "Adedi artır" : "Increase quantity"}
  disabled={qty >= stock || isOutOfStock}
>
  +
</button>
                          </div>

                          <Link href={href} className={styles.detailBtn} onClick={onClose}>
                            {isTR ? "Detay →" : "Detail →"}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className={styles.summaryCard}>
                <div className={styles.totalRow}>
                  <span>{isTR ? "Toplam" : "Subtotal"}</span>
                  <b>{money(visibleCartSubtotal || cartSubtotal, loc)}</b>
                </div>

                <div className={styles.footerActions}>
                  {hasMissingRingSize ? (
                    <button
                      type="button"
                      className={`${styles.softBtn} ${styles.disabledBtn}`}
                      disabled
                    >
                      {isTR ? "Ölçü seçmeden sepet açılamaz" : "Select size first"}
                    </button>
                  ) : (
                    <Link href="/cart" className={styles.softBtn} onClick={onClose}>
                      {isTR ? "Sepeti gör" : "View cart"}
                    </Link>
                  )}

                  {hasMissingRingSize ? (
                    <button
                      type="button"
                      className={`${styles.primaryBtn} ${styles.disabledBtn}`}
                      disabled
                    >
                      {isTR ? "Önce ölçü seç" : "Select size first"}
                    </button>
                  ) : (
                    <Link href="/checkout" className={styles.primaryBtn} onClick={onClose}>
                      {isTR ? "Ödeme" : "Checkout"}
                    </Link>
                  )}
                </div>
              </div>
            </>
          )
        ) : favItems.length === 0 ? (
          <div className={styles.emptyCard}>
            <div className={styles.emptyTitle}>
              {isTR ? "Favoriler boş" : "Wishlist is empty"}
            </div>

            <p className={styles.emptyText}>
              {isTR
                ? "Beğendiğin ürünleri kaydet, sonra tekrar incele."
                : "Save products you like and review them later."}
            </p>

            <Link href="/shop" className={styles.primaryBtn} onClick={onClose}>
              {isTR ? "Mağazaya git" : "Go to shop"}
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {favItems.map((it: any, idx: number) => {
              const id = safeStr(it?.id);
              const live = favProductMap[id] || null;

              const title =
                safeStr(live?.title?.tr) ||
                safeStr(live?.title?.en) ||
                safeStr(live?.title) ||
                safeStr(it?.title) ||
                (isTR ? "Ürün" : "Product");

              const image = getFavImage(it, live);

              const resolved = live
                ? resolveProductPriceTRY(live, rates)
                : { price: Number(it?.priceTry || 0) };

              const href = `/products/${encodeURIComponent(
                String(it?.slug || it?.id || "")
              )}`;

              return (
                <article key={`${id}-${idx}`} className={styles.itemCard}>
                  <Link href={href} className={styles.mediaWrap} onClick={onClose}>
                    {image ? (
                      <img src={image} alt={title} className={styles.media} />
                    ) : (
                      <div className={styles.mediaPh}>DROMOCOB</div>
                    )}
                  </Link>

                  <div className={styles.itemMain}>
                    <div className={styles.itemTop}>
                      <div className={styles.itemInfo}>
                        <Link href={href} className={styles.itemTitle} onClick={onClose}>
                          {title}
                        </Link>

                        <div className={styles.itemBadges}>
                          <span className={styles.metaPill}>
                            {isTR ? "Favori" : "Wishlist"}
                          </span>
                        </div>
                      </div>

                      <button
                        className={styles.removeBtn}
                        type="button"
                        onClick={() => onRemoveWish("wish", id, title, image)}
                        aria-label={isTR ? "Ürünü kaldır" : "Remove product"}
                      >
                        ✕
                      </button>
                    </div>

                    <div className={styles.priceGridSingle}>
                      <div className={styles.priceBox}>
                        <span className={styles.priceLabel}>
                          {isTR ? "Güncel Fiyat" : "Current Price"}
                        </span>
                        <b className={styles.priceValue}>
                          {money(Number(resolved.price || 0), loc)}
                        </b>
                      </div>
                    </div>

                    <div className={styles.itemBottom}>
                      <Link href={href} className={styles.detailBtn} onClick={onClose}>
                        {isTR ? "Detay →" : "Detail →"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
