// apps/web/src/lib/categories.ts
"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

export type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  image?: string;
  parentId?: string | null;

  // home slider
  showOnHome?: boolean;

  // opsiyonel
  isFeatured?: boolean;

  // pricing vs vs (lazım olursa)
  pricing?: any;
};

function normalizeCategory(id: string, x: DocumentData): Category {
  return {
    id,
    name: String(x?.name || ""),
    slug: String(x?.slug || ""),
    order: Number(x?.order ?? 0) || 0,
    isActive: !!x?.isActive,
    image: x?.image ? String(x.image) : undefined,
    parentId: x?.parentId ?? null,
    showOnHome: !!x?.showOnHome,
    isFeatured: !!x?.isFeatured,
    pricing: x?.pricing ?? null,
  };
}

/**
 * ✅ Aktif kategorileri order'a göre çeker.
 * Index riski düşük: where(isActive) + orderBy(order) genelde problemsiz.
 */
export async function fetchActiveCategories(): Promise<Category[]> {
  const db = getFirebaseDb();

  const qy = query(
    collection(db, "categories"),
    where("isActive", "==", true),
    orderBy("order", "asc")
  );

  const snap = await getDocs(qy);
  const rows = snap.docs.map((d) => normalizeCategory(d.id, d.data()));

  // ikincil sıralama (aynı order varsa)
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (a.name || "").localeCompare(b.name || "", "tr");
  });

  return rows;
}

/**
 * ✅ Home'da gösterilecek kategoriler.
 * showOnHome filtresi client'ta: index derdi yok, sürpriz yok.
 */
export async function fetchHomeCategories(opts?: { onlyRoot?: boolean; max?: number }) {
  const onlyRoot = opts?.onlyRoot ?? true;
  const max = Math.max(1, Math.min(50, opts?.max ?? 20));

  const all = await fetchActiveCategories();

  let list = all.filter((c) => !!c.showOnHome);

  if (onlyRoot) {
    list = list.filter((c) => c.parentId == null);
  }

  return list.slice(0, max);
}

/**
 * ✅ Slug ile kategori bul (aktif/pasif fark etmez istersen burayı where ile daraltırız).
 * Firestore'da slug unique olsun diye admin zaten kontrol ediyor.
 */
export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  const db = getFirebaseDb();
  const s = String(slug || "").trim();
  if (!s) return null;

  const qy = query(
    collection(db, "categories"),
    where("slug", "==", s),
    limit(1)
  );

  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return normalizeCategory(d.id, d.data());
}