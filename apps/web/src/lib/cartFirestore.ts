// apps/web/src/lib/cartFirestore.ts

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase.client";
import {
  getCart,
  mergeGuestCartToUser,
  notifyCartChanged,
  replaceCart,
  type CartItem,
} from "@/lib/cart";

function safeStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

// Recently deleted items — Firestore listener race condition önlemi
const recentlyDeleted = new Map<string, number>();
const DELETED_TTL = 10_000; // 10 saniye

function markAsDeleted(key: string) {
  recentlyDeleted.set(key.toLowerCase(), Date.now());
}

function isRecentlyDeleted(key: string): boolean {
  const lower = key.toLowerCase();
  const ts = recentlyDeleted.get(lower);
  if (!ts) return false;
  if (Date.now() - ts > DELETED_TTL) {
    recentlyDeleted.delete(lower);
    return false;
  }
  return true;
}

function cleanIdPart(v: unknown) {
  return safeStr(v)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Firestore doküman id.
 * Şu an ürün başına tek satır istiyoruz.
 * Ölçü değişince doc id değişmemeli, sadece selectedSize güncellenmeli.
 */
function cartLineId(item: Partial<CartItem>) {
  const productId = cleanIdPart(item.productId || item.id || item.slug);
  return productId.slice(0, 220);
}

function cleanCartItem(item: CartItem) {
  return {
    id: safeStr(item.id),
    productId: safeStr(item.productId || item.id),
    title: safeStr(item.title) || "Ürün",
    priceTry: Number(item.priceTry || 0),
    qty: Math.max(1, Math.min(99, Math.floor(Number(item.qty || 1)))),

    selectedSize: safeStr(item.selectedSize),
    selectedVariants: item.selectedVariants || {},
    selectedVariantItems: Array.isArray(item.selectedVariantItems)
      ? item.selectedVariantItems
      : [],

    image: safeStr(item.image),
    slug: safeStr(item.slug),
    pricing: item.pricing || null,
    stock: Number(item.stock || 0),

    // 24 saat kuralı: sepete eklenme zamanı
    addedAt: Number(item.addedAt) > 0 ? Number(item.addedAt) : Date.now(),

    updatedAt: serverTimestamp(),
  };
}

function fromFirestoreCartItem(id: string, data: any): CartItem | null {
  const productId = safeStr(data?.productId || data?.id || id);
  const itemId = safeStr(data?.id || productId);

  if (!itemId) return null;

  // addedAt: Firestore'da number veya Timestamp olabilir
  const rawAddedAt = data?.addedAt;
  let addedAt: number | undefined;
  if (typeof rawAddedAt === "number" && rawAddedAt > 0) {
    addedAt = rawAddedAt;
  } else if (rawAddedAt && typeof rawAddedAt.toMillis === "function") {
    addedAt = rawAddedAt.toMillis();
  } else if (rawAddedAt && typeof rawAddedAt.toDate === "function") {
    addedAt = rawAddedAt.toDate().getTime();
  }

  return {
    id: itemId,
    productId,
    title: safeStr(data?.title) || "Ürün",
    priceTry: Number(data?.priceTry || 0),
    qty: Math.max(1, Math.min(99, Math.floor(Number(data?.qty || 1)))),

    ...(safeStr(data?.selectedSize)
      ? { selectedSize: safeStr(data.selectedSize) }
      : {}),

    ...(data?.selectedVariants && typeof data.selectedVariants === "object"
      ? { selectedVariants: data.selectedVariants }
      : {}),

    ...(Array.isArray(data?.selectedVariantItems) && data.selectedVariantItems.length
      ? { selectedVariantItems: data.selectedVariantItems }
      : {}),

    ...(safeStr(data?.image) ? { image: safeStr(data.image) } : {}),
    ...(safeStr(data?.slug) ? { slug: safeStr(data.slug) } : {}),
    ...(data?.pricing ? { pricing: data.pricing } : {}),
    ...(Number(data?.stock || 0) > 0 ? { stock: Number(data.stock) } : {}),
    ...(addedAt ? { addedAt } : {}),
  };
}

function cartStableKey(item: Partial<CartItem>) {
  return cleanIdPart(item.productId || item.id || item.slug);
}

function cartSignature(items: CartItem[]) {
  return JSON.stringify(
    [...items]
      .map((x) => ({
        id: safeStr(x.id),
        productId: safeStr(x.productId),
        slug: safeStr(x.slug),
        qty: Number(x.qty || 1),
        selectedSize: safeStr(x.selectedSize),
        priceTry: Number(x.priceTry || 0),
      }))
      .sort((a, b) => {
        const ak = a.productId || a.id || a.slug;
        const bk = b.productId || b.id || b.slug;
        return ak.localeCompare(bk);
      })
  );
}

/**
 * Local + Remote merge.
 * Remote boş ama local doluysa sepeti uçurma.
 */
function mergeRemoteCartWithLocal(uid: string, remoteItems: CartItem[]) {
  const localItems = getCart(uid);

  if (!remoteItems.length && localItems.length) {
    return localItems;
  }

  const map = new Map<string, CartItem>();

  for (const item of localItems) {
    const key = cartStableKey(item);
    if (!key) continue;

    map.set(key, item);
  }

  for (const item of remoteItems) {
    const key = cartStableKey(item);
    if (!key) continue;

    // Yakın zamanda silinen bir ürünse, Firestore listener'dan geri ekleme
    if (isRecentlyDeleted(key)) continue;

    const old = map.get(key);

    map.set(key, {
      ...(old || {}),
      ...item,

      id: safeStr(item.id || old?.id),
      productId: safeStr(item.productId || old?.productId || item.id || old?.id),
      title: safeStr(item.title || old?.title) || "Ürün",
      priceTry: Number(item.priceTry || old?.priceTry || 0),
      qty: Math.max(1, Math.min(99, Math.floor(Number(item.qty || old?.qty || 1)))),

      image: safeStr(item.image || old?.image),
      slug: safeStr(item.slug || old?.slug),
      stock: Number(item.stock || old?.stock || 0),

      pricing: item.pricing || old?.pricing,

      selectedSize: safeStr(item.selectedSize || old?.selectedSize) || undefined,

      selectedVariants: item.selectedVariants || old?.selectedVariants,

      selectedVariantItems:
        Array.isArray(item.selectedVariantItems) && item.selectedVariantItems.length
          ? item.selectedVariantItems
          : old?.selectedVariantItems,

      // 24 saat kuralı: addedAt korunsun (local > remote > undefined)
      addedAt: old?.addedAt || item.addedAt || undefined,
    } as CartItem);
  }

  const finalItems = Array.from(map.values());

  replaceCart(finalItems, uid, { emit: false });

  return finalItems;
}

export async function pushLocalCartToFirestore(uid: string) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return;

  const db = getFirebaseDb();
  const items = getCart(cleanUid);

  const batch = writeBatch(db);

  for (const item of items) {
    const lineId = cartLineId(item);
    if (!lineId) continue;

    const ref = doc(db, "users", cleanUid, "cart_items", lineId);

    batch.set(
      ref,
      {
        ...cleanCartItem(item),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function pullFirestoreCartToLocal(uid: string) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return [];

  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "users", cleanUid, "cart_items"));

  const remoteItems: CartItem[] = [];

  snap.forEach((d) => {
    const item = fromFirestoreCartItem(d.id, d.data());
    if (item) remoteItems.push(item);
  });

  const finalItems = mergeRemoteCartWithLocal(cleanUid, remoteItems);

  notifyCartChanged();

  return finalItems;
}

export async function syncCartLogin(uid: string) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return;

  mergeGuestCartToUser(cleanUid);

  await pushLocalCartToFirestore(cleanUid);
  await pullFirestoreCartToLocal(cleanUid);

  notifyCartChanged();
}

export function listenFirestoreCart(
  uid: string,
  onItems?: (items: CartItem[]) => void
) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return () => {};

  const db = getFirebaseDb();

  let lastSig = "";

  return onSnapshot(
    collection(db, "users", cleanUid, "cart_items"),
    (snap) => {
      const remoteItems: CartItem[] = [];

      snap.forEach((d) => {
        const item = fromFirestoreCartItem(d.id, d.data());
        if (item) remoteItems.push(item);
      });

      const finalItems = mergeRemoteCartWithLocal(cleanUid, remoteItems);
      const nextSig = cartSignature(finalItems);

      if (nextSig === lastSig) return;

      lastSig = nextSig;

      // Kritik: burada window.dispatchEvent yok.
      // Sonsuz döngünün ana sebebi buydu.
      if (typeof onItems === "function") {
        onItems(finalItems);
      }
    },
    (err) => {
      console.error("[cartFirestore] listen error:", err);
    }
  );
}

export async function saveCartItemToFirestore(uid: string, item: CartItem) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return;

  const db = getFirebaseDb();
  const lineId = cartLineId(item);

  if (!lineId) return;

  const ref = doc(db, "users", cleanUid, "cart_items", lineId);

  await setDoc(
    ref,
    {
      ...cleanCartItem(item),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteCartItemFromFirestore(uid: string, item: CartItem) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return;

  const db = getFirebaseDb();
  const lineId = cartLineId(item);

  if (!lineId) return;

  // Race condition önlemi: silinen ürünü recently deleted olarak işaretle
  markAsDeleted(lineId);

  await deleteDoc(doc(db, "users", cleanUid, "cart_items", lineId));
}

export async function clearFirestoreCart(uid: string) {
  const cleanUid = safeStr(uid);
  if (!cleanUid) return;

  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "users", cleanUid, "cart_items"));

  const batch = writeBatch(db);

  snap.forEach((d) => {
    batch.delete(d.ref);
  });

  await batch.commit();
}
export async function clearCartEverywhere(uid?: string | null) {
  const cleanUid = safeStr(uid);

  try {
    if (cleanUid) {
      await clearFirestoreCart(cleanUid);
    }
  } catch (err) {
    console.error("[cartFirestore] clear firestore cart failed:", err);
  }

  try {
    if (typeof window !== "undefined") {
      if (cleanUid) {
        window.localStorage.removeItem(`nci_cart_${cleanUid}`);
      }

      window.localStorage.removeItem("nci_cart_guest");

      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("nci_cart_"))
        .forEach((k) => {
          const raw = window.localStorage.getItem(k);

          // Bozuk / eski / boş olmayan başka user cart kalmışsa temizle.
          // Tek cihazda çok uid kalınca header rozeti şaşırmasın.
          if (raw && raw !== "[]") {
            window.localStorage.removeItem(k);
          }
        });

      window.dispatchEvent(new Event("cart:changed"));
    }
  } catch (err) {
    console.error("[cartFirestore] clear local cart failed:", err);
  }
}

/**
 * 24 saat kuralı: Süresi dolmuş ürünleri Firestore'dan toplu sil.
 */
export async function deleteExpiredCartItems(uid: string, items: CartItem[]) {
  const cleanUid = safeStr(uid);
  if (!cleanUid || !items.length) return;

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  for (const item of items) {
    const lineId = cartLineId(item);
    if (!lineId) continue;

    markAsDeleted(lineId);
    batch.delete(doc(db, "users", cleanUid, "cart_items", lineId));
  }

  await batch.commit();
}