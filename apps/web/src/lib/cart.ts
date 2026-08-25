// apps/web/src/lib/cart.ts

export type CartVariantItem = {
  groupId: string;
  groupLabel: string;
  value: string;
  label: string;
  priceDelta: number;

  hasGram?: number;
  weightGram?: number;
  gram?: number;
};

export type CartPricing =

  | {

      mode: "fixed";

      priceTry: number;

      variantPriceDelta?: number;

    }

  | {

      mode: "dynamic";

      model: "gram";

      rateKey: string;

      weightGram: number;

      hasGram?: number;

      markupTry?: number;

      markupPercent?: number;

      variantPriceDelta?: number;

    };

export type CartItem = {
  id: string;
  productId?: string;

  title: string;
  priceTry: number;
  qty: number;

  gram?: number;
  hasGram?: number;
  weightGram?: number;
  weightGr?: number;

  selectedSize?: string;
  selectedVariants?: Record<string, string>;
  selectedVariantItems?: CartVariantItem[];

  image?: string;
  slug?: string;
  pricing?: CartPricing;
  stock?: number;

  /** Ürünün sepete ilk eklendiği an (Unix ms). 24 saat kuralı için. */
  addedAt?: number;
};

const EVT = "cart:changed";
const GUEST_KEY = "nci_cart_guest";

function getCartKey(uid?: string | null) {
  const clean = String(uid || "").trim();
  return clean ? `nci_cart_${clean}` : GUEST_KEY;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toNum(v: unknown, fallback = 0): number {
  const n =
    typeof v === "string"
      ? Number(v.trim().replace(/\./g, "").replace(",", "."))
      : Number(v);

  return Number.isFinite(n) ? n : fallback;
}

function clampQty(qty: unknown): number {
  const n = Math.floor(toNum(qty, 1));
  return Math.max(1, Math.min(99, n));
}

function clampQtyOrZero(qty: unknown): number {
  const n = Math.floor(toNum(qty, 0));
  return Math.max(0, Math.min(99, n));
}

function clampByStock(qty: number, stock?: number): number {
  const q = Math.max(1, Math.min(99, Math.floor(toNum(qty, 1))));
  const s = Math.max(0, Math.floor(toNum(stock, 0)));

  if (s > 0) return Math.min(q, s);
  return q;
}

function normRateKey(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s.replace(/\s+/g, "_").toUpperCase() : "GRAM_ALTIN";
}

function sanitizePricing(p: unknown): CartPricing | undefined {
  if (!p || typeof p !== "object") return undefined;

  const obj = p as any;

  if (obj.mode === "fixed") {
    const variantPriceDelta = Math.max(0, toNum(obj.variantPriceDelta, 0));

    return {
      mode: "fixed",
      priceTry: Math.max(0, toNum(obj.priceTry, 0)),
      ...(variantPriceDelta ? { variantPriceDelta } : {}),
    };
  }

  if (obj.mode === "dynamic" && (obj.model === "gram" || !obj.model)) {
    const rateKey = normRateKey(obj.rateKey || "GRAM_ALTIN");
   const weightGram = Math.max(
  0,
  toNum(obj.weightGram ?? obj.hasGram, 0)
);

const hasGram = Math.max(
  0,
  toNum(obj.hasGram ?? obj.weightGram, 0)
);

const markupTry = Math.max(0, toNum(obj.markupTry, 0));
const markupPercent = Math.max(0, toNum(obj.markupPercent, 0));
const variantPriceDelta = Math.max(0, toNum(obj.variantPriceDelta, 0));

    if (!weightGram) return undefined;

    return {
  mode: "dynamic",
  model: "gram",
  rateKey,
  weightGram,
  hasGram: hasGram || weightGram,
  ...(markupTry ? { markupTry } : {}),
  ...(markupPercent ? { markupPercent } : {}),
  ...(variantPriceDelta ? { variantPriceDelta } : {}),
};
  }

  return undefined;
}

function sanitizeItem(x: unknown): CartItem | null {
  if (!x || typeof x !== "object") return null;

  const obj = x as any;

  const id = String(obj.id ?? "").trim();
  if (!id) return null;

  const productId = obj.productId ? String(obj.productId).trim() : undefined;
  const title = String(obj.title ?? "Ürün").trim() || "Ürün";

  const rawPrice =
    obj.priceTry ??
    obj.priceTRY ??
    obj.price ??
    obj.finalPrice ??
    obj.computedPrice ??
    0;

  const priceTry = Math.max(0, toNum(rawPrice, 0));
  const qty = clampQty(obj.qty ?? obj.quantity ?? 1);

  const selectedSize = obj.selectedSize ? String(obj.selectedSize).trim() : undefined;

  const selectedVariants =
    obj.selectedVariants && typeof obj.selectedVariants === "object"
      ? Object.fromEntries(
          Object.entries(obj.selectedVariants as Record<string, unknown>)
            .map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])
            .filter(([k, v]) => k && v)
        )
      : undefined;

  const selectedVariantItemsRaw = Array.isArray(obj.selectedVariantItems)
    ? obj.selectedVariantItems
    : [];

  const selectedVariantItems = selectedVariantItemsRaw
    .map((v: any): CartVariantItem | null => {
      const groupId = String(v?.groupId ?? "").trim();
      const value = String(v?.value ?? "").trim();

      if (!groupId || !value) return null;

const gram = Math.max(
  0,
  toNum(v?.hasGram ?? v?.weightGram ?? v?.gram, 0)
);

return {
  groupId,
  groupLabel: String(v?.groupLabel ?? groupId).trim() || groupId,
  value,
  label: String(v?.label ?? value).trim() || value,
  priceDelta: Math.max(0, toNum(v?.priceDelta, 0)),

  ...(gram > 0
    ? {
        hasGram: gram,
        weightGram: gram,
        gram,
      }
    : {}),
};
    })
    .filter(Boolean) as CartVariantItem[];

  const image = obj.image ? String(obj.image).trim() : undefined;
  const slug = obj.slug ? String(obj.slug).trim() : undefined;
  const pricing = sanitizePricing(obj.pricing);

  const stockNum = Math.max(0, Math.floor(toNum(obj.stock, 0)));
  const stock = Number.isFinite(stockNum) ? stockNum : 0;

  // addedAt: ürünün sepete ilk eklendiği zaman (24 saat kuralı)
  const addedAtRaw = Number((obj as any).addedAt);
  const addedAt = Number.isFinite(addedAtRaw) && addedAtRaw > 0 ? addedAtRaw : undefined;

  return {
    id,
    ...(productId ? { productId } : {}),
    title,
    priceTry,
    qty,
    ...(selectedSize ? { selectedSize } : {}),
    ...(selectedVariants && Object.keys(selectedVariants).length ? { selectedVariants } : {}),
    ...(selectedVariantItems.length ? { selectedVariantItems } : {}),
    ...(image ? { image } : {}),
    ...(slug ? { slug } : {}),
    ...(pricing ? { pricing } : {}),
    ...(stock > 0 ? { stock } : {}),
    ...(addedAt ? { addedAt } : {}),
  };
}

function readRaw(uid?: string | null): any[] {
  if (!isBrowser()) return [];

  try {
    const key = getCartKey(uid);
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];

    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function read(uid?: string | null): CartItem[] {
  const raw = readRaw(uid);
  const out: CartItem[] = [];

  for (const x of raw) {
    const it = sanitizeItem(x);
    if (it) out.push(it);
  }

  return out;
}

function emitChanged() {
  if (!isBrowser()) return;

  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    try {
      const evt = document.createEvent("Event");
      evt.initEvent(EVT, true, true);
      window.dispatchEvent(evt);
    } catch {
      //
    }
  }
}

function write(items: CartItem[], uid?: string | null) {
  replaceCart(items, uid, { emit: true });
}

function productKey(item: Partial<CartItem>) {
  return (
    String(item.productId || "").trim() ||
    String(item.id || "").trim() ||
    String(item.slug || "").trim()
  );
}

/**
 * Sepette aynı ürün tek satır mantığı.
 * Yüzük ölçüsü değişince yeni satır açmaz; mevcut ürünü günceller.
 */
function buildMergeKey(item: Partial<CartItem>) {
  return productKey(item).toLowerCase();
}

function sameCartLine(item: Partial<CartItem>, key: string) {
  const cleanKey = String(key || "").trim().toLowerCase();
  if (!cleanKey) return false;

  // Önce exact id eşleşmesi dene — en güvenilir
  const itemId = String(item.id || "").trim().toLowerCase();
  if (itemId && itemId === cleanKey) return true;

  // Sonra productId
  const productId = String((item as any).productId || "").trim().toLowerCase();
  if (productId && productId === cleanKey) return true;

  // Sonra slug
  const slug = String((item as any).slug || "").trim().toLowerCase();
  if (slug && slug === cleanKey) return true;

  // En son merge key
  const mergeKey = buildMergeKey(item);
  if (mergeKey && mergeKey === cleanKey) return true;

  return false;
}

/**
 * Sessiz veya event'li cart replace.
 * Firestore listener bunu emit:false ile kullanmalı.
 */
export function replaceCart(
  items: CartItem[],
  uid?: string | null,
  options?: { emit?: boolean }
) {
  if (!isBrowser()) return;

  const cleanItems = (Array.isArray(items) ? items : [])
    .map((x) => sanitizeItem(x))
    .filter(Boolean) as CartItem[];

  const key = getCartKey(uid);
  window.localStorage.setItem(key, JSON.stringify(cleanItems));

  if (options?.emit !== false) {
    emitChanged();
  }
}

export function notifyCartChanged() {
  emitChanged();
}

export function getCartLineKeyForSync(item: Partial<CartItem>) {
  return buildMergeKey(item)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 240);
}

export function getCart(uid?: string | null): CartItem[] {
  return read(uid);
}

export function cartCount(uid?: string | null): number {
  return read(uid).reduce((sum, it) => sum + clampQtyOrZero(it.qty), 0);
}

export function cartTotalTry(uid?: string | null): number {
  return read(uid).reduce((sum, it) => {
    const qty = clampQtyOrZero(it.qty);
    const price = Math.max(0, toNum(it.priceTry, 0));

    return sum + price * qty;
  }, 0);
}

export function addToCart(
  item: Omit<CartItem, "qty"> & { qty?: number },
  uid?: string | null
) {
  const items = read(uid);
  const id = String(item.id ?? "").trim();

  if (!id) return;

  const qtyAdd = clampQty(item.qty ?? 1);

  const incoming = sanitizeItem({
    ...item,
    id,
    productId: item.productId || item.id,
    qty: qtyAdd,
  });

  if (!incoming) return;

  const incomingKey = buildMergeKey(incoming);
  const idx = items.findIndex((x) => buildMergeKey(x) === incomingKey);

  if (idx >= 0) {
    const prev = items[idx];

    const effectiveStock =
      incoming.stock && incoming.stock > 0 ? incoming.stock : prev.stock;

    const nextQty = clampByStock(clampQty(prev.qty) + qtyAdd, effectiveStock);

    items[idx] = {
      ...prev,
      productId: incoming.productId ?? prev.productId,
      title: incoming.title || prev.title,
      image: incoming.image ?? prev.image,
      slug: incoming.slug ?? prev.slug,
      selectedSize: incoming.selectedSize ?? prev.selectedSize,
      selectedVariants: incoming.selectedVariants ?? prev.selectedVariants,
      selectedVariantItems: incoming.selectedVariantItems ?? prev.selectedVariantItems,
      priceTry: incoming.priceTry > 0 ? incoming.priceTry : prev.priceTry,
      pricing: incoming.pricing ?? prev.pricing,
      stock: incoming.stock ?? prev.stock,
      qty: nextQty,
      // 24 saat kuralı: ilk eklenme zamanı korunur, sıfırlanmaz
      addedAt: prev.addedAt || Date.now(),
    };
  } else {
    items.push({
      ...incoming,
      qty: clampByStock(incoming.qty, incoming.stock),
      addedAt: Date.now(),
    });
  }

  write(items, uid);
}

export function setQty(id: string, qty: number, uid?: string | null) {
  const items = read(uid);
  const key = String(id ?? "").trim();

  if (!key) return;

  const idx = items.findIndex((x) => sameCartLine(x, key));
  if (idx < 0) return;

  const next = Math.floor(toNum(qty, 0));

  if (!Number.isFinite(next) || next <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx] = {
      ...items[idx],
      qty: clampByStock(next, items[idx].stock),
    };
  }

  write(items, uid);
}

export function removeFromCart(id: string, uid?: string | null) {
  const key = String(id ?? "").trim();

  if (!key) return;

  const items = read(uid);
  const idx = items.findIndex((x) => sameCartLine(x, key));

  if (idx < 0) return;

  items.splice(idx, 1);
  write(items, uid);
}

export function clearCart(uid?: string | null) {
  write([], uid);
}

export function updateCartItem(id: string, patch: Partial<CartItem>, uid?: string | null) {
  const key = String(id ?? "").trim();

  if (!key) return;

  const items = read(uid);
  const idx = items.findIndex((x) => sameCartLine(x, key));

  if (idx < 0) return;

  const merged = sanitizeItem({
    ...items[idx],
    ...patch,
    id: patch.id || items[idx].id,
    productId: patch.productId || items[idx].productId || items[idx].id,
  });

  if (!merged) return;

  items[idx] = {
    ...merged,
    qty: clampByStock(merged.qty, merged.stock),
  };

  write(items, uid);
}

export function mergeGuestCartToUser(uid: string | null | undefined): CartItem[] {
  const cleanUid = String(uid || "").trim();

  if (!cleanUid || !isBrowser()) return [];

  const guestItems = read(null);
  const userItems = read(cleanUid);

  if (!guestItems.length) {
    return userItems;
  }

  const map = new Map<string, CartItem>();

  for (const item of userItems) {
    map.set(buildMergeKey(item), { ...item });
  }

  for (const guest of guestItems) {
    const key = buildMergeKey(guest);
    const existing = map.get(key);

    if (existing) {
      const mergedStock =
        existing.stock && existing.stock > 0 ? existing.stock : guest.stock;

      map.set(key, {
        ...existing,
        productId: existing.productId ?? guest.productId,
        title: existing.title || guest.title,
        image: existing.image ?? guest.image,
        slug: existing.slug ?? guest.slug,
        selectedSize: existing.selectedSize ?? guest.selectedSize,
        selectedVariants: existing.selectedVariants ?? guest.selectedVariants,
        selectedVariantItems: existing.selectedVariantItems ?? guest.selectedVariantItems,
        priceTry: existing.priceTry > 0 ? existing.priceTry : guest.priceTry,
        pricing: existing.pricing ?? guest.pricing,
        stock: existing.stock ?? guest.stock,
        qty: clampByStock(clampQty(existing.qty) + clampQty(guest.qty), mergedStock),
        // 24 saat kuralı: daha eski addedAt korunsun (en erken ekleme zamanı)
        addedAt: Math.min(existing.addedAt || Infinity, guest.addedAt || Infinity) === Infinity
          ? undefined
          : Math.min(existing.addedAt || Infinity, guest.addedAt || Infinity),
      });
    } else {
      map.set(key, {
        ...guest,
        qty: clampByStock(guest.qty, guest.stock),
      });
    }
  }

  const merged = Array.from(map.values());

  replaceCart(merged, cleanUid, { emit: false });

  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    //
  }

  emitChanged();

  return merged;
}

export function syncCartAfterAuth(uid?: string | null) {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return getCart(null);

  return mergeGuestCartToUser(cleanUid);
}

export function hasGuestCart(): boolean {
  return getCart(null).length > 0;
}

export function subscribeCartChange(callback: () => void) {
  if (!isBrowser()) return () => {};

  const handler = () => callback();

  window.addEventListener(EVT, handler);

  return () => {
    window.removeEventListener(EVT, handler);
  };
}

/* ────────── 24 Saat Kuralı (Admin'den ayarlanabilir süre) ────────── */

const DEFAULT_CART_EXPIRY_HOURS = 24;
let _cachedExpiryHours: number | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika cache

/**
 * Firestore settings/public → cartExpiry.hours değerini okur.
 * Bellek cache'i ile gereksiz okuma yapmaz.
 * Hata veya Firestore yoksa varsayılan 24 saat kullanır.
 */
function getCartExpiryMs(): number {
  // Cache geçerliyse onu kullan
  if (_cachedExpiryHours !== null && Date.now() - _cacheLoadedAt < CACHE_TTL) {
    return _cachedExpiryHours * 60 * 60 * 1000;
  }

  // Async olarak Firestore'dan oku (arka planda güncelle)
  if (isBrowser()) {
    _fetchExpiryFromFirestore();
  }

  // İlk çağrıda veya cache yoksa varsayılan kullan
  return (_cachedExpiryHours ?? DEFAULT_CART_EXPIRY_HOURS) * 60 * 60 * 1000;
}

/** Arka planda Firestore'dan expiry ayarını çeker */
async function _fetchExpiryFromFirestore() {
  try {
    const { getFirebaseDb } = await import("@/lib/firebase.client");
    const { doc, getDoc } = await import("firebase/firestore");
    const db = getFirebaseDb();
    const ref = doc(db, "settings", "public");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const hours = Number(data?.cartExpiry?.hours);
      if (Number.isFinite(hours) && hours > 0) {
        _cachedExpiryHours = hours;
      } else {
        _cachedExpiryHours = DEFAULT_CART_EXPIRY_HOURS;
      }
    } else {
      _cachedExpiryHours = DEFAULT_CART_EXPIRY_HOURS;
    }
    _cacheLoadedAt = Date.now();
  } catch {
    _cachedExpiryHours = DEFAULT_CART_EXPIRY_HOURS;
    _cacheLoadedAt = Date.now();
  }
}

/** Dışarıdan cache'i set etmek için (örn: settings dinleyen bileşen) */
export function setCartExpiryHoursCache(hours: number) {
  if (Number.isFinite(hours) && hours > 0) {
    _cachedExpiryHours = hours;
    _cacheLoadedAt = Date.now();
  }
}

export type ExpiredCartItem = CartItem;

/**
 * Sepetteki süresi dolmuş ürünleri tespit edip siler.
 * Süresi dolmuş ürünleri döndürür (favorilere taşımak için).
 * addedAt olmayan eski ürünlere retroaktif timestamp ekler (ilk çalışmada silinmesinler).
 */
export function enforceCartExpiry(uid?: string | null, expiryHours?: number): ExpiredCartItem[] {
  if (!isBrowser()) return [];

  const items = read(uid);
  if (!items.length) return [];

  const now = Date.now();
  const configuredHours = Number(expiryHours);
  const expiryMs = Number.isFinite(configuredHours) && configuredHours > 0
    ? configuredHours * 60 * 60 * 1000
    : getCartExpiryMs();
  const expired: ExpiredCartItem[] = [];
  const kept: CartItem[] = [];
  let needsWrite = false;

  for (const item of items) {
    if (!item.addedAt) {
      // Retroaktif: eski ürünlere şimdi timestamp ata, henüz silme
      kept.push({ ...item, addedAt: now });
      needsWrite = true;
      continue;
    }

    if (now - item.addedAt >= expiryMs) {
      expired.push(item);
      needsWrite = true;
    } else {
      kept.push(item);
    }
  }

  if (needsWrite) {
    replaceCart(kept, uid, { emit: true });
  }

  return expired;
}
