import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

export type AdminProduct = {
  id: string;
  title?: string;
  description?: string;

  category?: string;
  categoryName?: string;

  price?: number;
  priceTry?: number;
  oldPriceTry?: number;

  image?: string;
  images?: string[];

  karat?: number;
  weightGram?: number;

  stock?: number;
  stockLeft?: number;
  stockSold?: number;

  rating?: { star?: number; review?: number };

  createdAt?: any;
  updatedAt?: any;
};

const num = (v: any, fallback = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asStr = (v: any) => (v == null ? "" : String(v));

export async function fetchAdminProducts(opts?: { take?: number }): Promise<AdminProduct[]> {
  try {
    const db = getFirebaseDb();
    const take = opts?.take ?? 200;

    const ref = collection(db, "products");

    // updatedAt yoksa createdAt fallback
    let snap;
    try {
      snap = await getDocs(query(ref, orderBy("updatedAt", "desc"), limit(take)));
    } catch {
      snap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(take)));
    }

    return snap.docs.map((d) => {
      const data = d.data() as DocumentData;

      const categoryName = asStr(data.categoryName ?? data.category ?? "");

      const priceTry = num(data.priceTry ?? data.price ?? data.priceTRY ?? 0, 0);
      const oldPriceTry = num(data.oldPriceTry ?? data.oldPrice ?? 0, 0);

      const stock = num(data.stock ?? data.stockLeft ?? 0, 0);
      const stockSold = num(data.stockSold ?? data.sold ?? data.soldCount ?? 0, 0);

      const image = asStr(data.image ?? data.thumbnail ?? data.cover ?? data.photo ?? "");

      const karat = num(data.karat ?? 0, 0);
      const weightGram = num(data.weightGram ?? data.gram ?? 0, 0);

      const star = num(data.rating?.star ?? data.star ?? 0, 0);
      const review = num(data.rating?.review ?? data.review ?? 0, 0);

      return {
        id: d.id,
        title: asStr(data.title ?? data.name ?? ""),
        description: asStr(data.description ?? ""),

        categoryName,
        category: categoryName,

        priceTry,
        price: priceTry,
        oldPriceTry,

        image,
        images: Array.isArray(data.images) ? (data.images as string[]) : [],

        karat,
        weightGram,

        stock,
        stockLeft: stock,
        stockSold,

        rating: { star, review },

        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  } catch (e) {
    console.error("fetchAdminProducts failed:", e);
    return [];
  }
}

export async function fetchAdminProductsPage({
  take = 24,
  cursor = null,
  type = null,
}: {
  take?: number;
  cursor?: any;
  type?: string | null;
}) {
  const db = getFirebaseDb();
  const col = collection(db, "products");

  const constraints: QueryConstraint[] = [];

  if (type) constraints.push(where("type", "==", type));
  constraints.push(orderBy("updatedAt", "desc"));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(take));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);

  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
  const last = snap.docs[snap.docs.length - 1];
  const nextCursor = last ? (last.data() as any)?.updatedAt ?? null : null;

  return { items, nextCursor };
}