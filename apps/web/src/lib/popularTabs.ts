"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

export type PopularTab = {
  key: string;
  label?: string | { tr?: string; en?: string };
  section?: string;
  enabled?: boolean;
  isActive?: boolean;
  order?: number;
  limit?: number;
};

function s(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function uniqById(list: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const x of list) {
    const id = s(x?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }

  return out;
}

function normalizeTab(t: any): PopularTab | null {
  const key = s(t?.key);
  if (!key) return null;

  return {
    key,
    label: t?.label ?? t?.title ?? t?.name ?? { tr: key, en: key },
    section: s(t?.section) || key,
    enabled:
      typeof t?.enabled === "boolean"
        ? t.enabled
        : typeof t?.isActive === "boolean"
        ? t.isActive
        : true,
    isActive:
      typeof t?.isActive === "boolean"
        ? t.isActive
        : typeof t?.enabled === "boolean"
        ? t.enabled
        : true,
    order: toNum(t?.order, 0),
    limit: toNum(t?.limit, 0) > 0 ? toNum(t?.limit, 0) : undefined,
  };
}

/**
 * Firestore:
 * site_options/home_settings
 * - popular_tabs
 * - popularTabs
 */
export async function fetchPopularTabs(): Promise<PopularTab[]> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "site_options", "home_settings"));
  const hs = snap.exists() ? (snap.data() as any) : null;

 const raw =
  (Array.isArray(hs?.popularTabs) ? hs.popularTabs : null) ??
  (Array.isArray(hs?.popular_tabs) ? hs.popular_tabs : null) ??
  [];

  const mapped = raw
    .map(normalizeTab)
    .filter(Boolean) as PopularTab[];

  const activeOnly = mapped
    .filter((t) => t.enabled !== false && t.isActive !== false)
    .sort((a, b) => toNum(a.order, 0) - toNum(b.order, 0));

  const hasAll = activeOnly.some((t) => t.key === "all");

  if (!hasAll) {
    return [
      {
        key: "all",
        label: { tr: "Tümü", en: "All" },
        section: "all",
        enabled: true,
        isActive: true,
        order: 0,
      },
      ...activeOnly,
    ];
  }

  return activeOnly;
}

async function safeGetDocs(qy: any) {
  try {
    return await getDocs(qy);
  } catch (e) {
    throw e;
  }
}

function mapDocs(snap: any) {
  return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
}

/**
 * section mantığı:
 * - all         => aktif ürünler
 * - new         => createdAt desc
 * - featured    => önce homeSections, sonra isFeatured fallback
 * - bestsellers => önce homeSections, sonra isBestseller fallback
 * - diğerleri   => homeSections array-contains
 */
export async function fetchProductsByHomeSection(
  section: string,
  lim = 12
): Promise<any[]> {
  const db = getFirebaseDb();
  const col = collection(db, "products");
  const sec = s(section || "all").toLowerCase();
  const safeLimit = Math.max(1, Math.min(48, Number(lim || 12)));

  const base = [where("isActive", "==", true)];

  // ALL
  if (sec === "all") {
    try {
      const snap = await safeGetDocs(
        query(col, ...base, orderBy("createdAt", "desc"), limit(safeLimit))
      );
      return mapDocs(snap);
    } catch {
      const snap = await safeGetDocs(query(col, ...base, limit(safeLimit)));
      return mapDocs(snap);
    }
  }

  // NEW
  if (sec === "new") {
    try {
      const snap = await safeGetDocs(
        query(col, ...base, orderBy("createdAt", "desc"), limit(safeLimit))
      );
      return mapDocs(snap);
    } catch {
      const snap = await safeGetDocs(query(col, ...base, limit(safeLimit)));
      return mapDocs(snap);
    }
  }

  // ASIL FİLTRE: homeSections
  let items: any[] = [];
  try {
    const q1 = query(
      col,
      ...base,
      where("homeSections", "array-contains", sec),
      limit(safeLimit)
    );
    const s1 = await safeGetDocs(q1);
    items = mapDocs(s1);
  } catch (e) {
    console.error(`homeSections query failed for "${sec}"`, e);
  }

  // FALLBACKS
  if (items.length < safeLimit) {
    try {
      if (sec === "featured") {
        const q2 = query(col, ...base, where("isFeatured", "==", true), limit(safeLimit));
        const s2 = await safeGetDocs(q2);
        items = uniqById([...items, ...mapDocs(s2)]).slice(0, safeLimit);
      }

      if (sec === "bestsellers") {
        const q3 = query(col, ...base, where("isBestseller", "==", true), limit(safeLimit));
        const s3 = await safeGetDocs(q3);
        items = uniqById([...items, ...mapDocs(s3)]).slice(0, safeLimit);
      }
    } catch (e) {
      console.error(`fallback query failed for "${sec}"`, e);
    }
  }

  // son fallback: hiç ürün gelmediyse boş dönme yerine aktif ürünlerden doldur
  if (!items.length) {
    try {
      const snap = await safeGetDocs(
        query(col, ...base, orderBy("createdAt", "desc"), limit(safeLimit))
      );
      return mapDocs(snap);
    } catch {
      const snap = await safeGetDocs(query(col, ...base, limit(safeLimit)));
      return mapDocs(snap);
    }
  }

  return items.slice(0, safeLimit);
}