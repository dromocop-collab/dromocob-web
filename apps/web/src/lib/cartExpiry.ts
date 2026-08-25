// apps/web/src/lib/cartExpiry.ts
// 24 Saat Kuralı — Merkezi orchestration modülü
//
// Sepetteki 24 saati dolmuş ürünleri:
//  1. Local cart'tan siler
//  2. Favorilere taşır (duplicate kontrolü ile)
//  3. Firestore cart'tan siler (giriş yapmış kullanıcı)
//
// Kullanım: runCartExpiryCheck(uid) → { expired, movedToFavorites }

import { enforceCartExpiry, type ExpiredCartItem } from "@/lib/cart";
import { deleteExpiredCartItems } from "@/lib/cartFirestore";
import { addFavoriteItem, type FavItem } from "@/lib/favorites";

export type CartExpiryResult = {
  expired: ExpiredCartItem[];
  movedToFavorites: number;
};

/**
 * CartItem → FavItem dönüştürücü.
 * Ürün bazında bir kez favoriye eklenmesi yeterli
 * (farklı varyantlar için ayrı favori oluşturmaz).
 */
function cartItemToFavItem(item: ExpiredCartItem): FavItem {
  // productId tercih et, yoksa id kullan
  const id = String(item.productId || item.id || "").trim();

  return {
    id,
    title: item.title || undefined,
    image: item.image || undefined,
    price: item.priceTry > 0 ? item.priceTry : undefined,
    currency: "TRY",
    slug: item.slug || undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Aynı ürünü (productId bazında) birden fazla kez favoriye ekleme.
 * Farklı varyantlar aynı productId'ye sahipse tek kez eklenir.
 */
function deduplicateByProductId(items: ExpiredCartItem[]): ExpiredCartItem[] {
  const seen = new Set<string>();
  const unique: ExpiredCartItem[] = [];

  for (const item of items) {
    const key = String(item.productId || item.id || "")
      .trim()
      .toLowerCase();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

// Debounce: son 2 saniye içinde zaten çalıştıysa tekrar çalışma
let lastRunAt = 0;
const DEBOUNCE_MS = 2000;

/**
 * Sepette süresi dolmuş ürünleri kontrol eder.
 * moveToFavorites true ise expired ürünleri favorilere taşır, değilse sadece siler.
 *
 * @param uid - Giriş yapmış kullanıcının uid'si (null = misafir)
 * @param options.moveToFavorites - false ise favorilere taşıma, sadece sil (varsayılan: true)
 * @returns Kaç ürün taşındığı bilgisi
 */
export function runCartExpiryCheck(
  uid?: string | null,
  options?: { enabled?: boolean; moveToFavorites?: boolean; expiryHours?: number }
): CartExpiryResult {
  if (options?.enabled === false) {
    return { expired: [], movedToFavorites: 0 };
  }

  const now = Date.now();
  const shouldMoveToFav = options?.moveToFavorites !== false;

  // Debounce
  if (now - lastRunAt < DEBOUNCE_MS) {
    return { expired: [], movedToFavorites: 0 };
  }
  lastRunAt = now;

  // 1. Local cart'tan expired ürünleri çıkar
  const expired = enforceCartExpiry(uid, options?.expiryHours);

  if (!expired.length) {
    return { expired: [], movedToFavorites: 0 };
  }

  // 2. Favorilere taşı (admin ayarına göre)
  let movedToFavorites = 0;

  if (shouldMoveToFav) {
    const uniqueForFav = deduplicateByProductId(expired);
    for (const item of uniqueForFav) {
      const favItem = cartItemToFavItem(item);
      addFavoriteItem(uid, favItem);
      movedToFavorites++;
    }
  }

  // 3. Firestore'dan da sil (async, arka planda)
  const cleanUid = String(uid || "").trim();
  if (cleanUid) {
    deleteExpiredCartItems(cleanUid, expired).catch((err) => {
      console.error("[cartExpiry] Firestore expired items delete failed:", err);
    });
  }

  return { expired, movedToFavorites };
}
