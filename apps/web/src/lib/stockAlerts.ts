"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

export type StockAlertStatus = "active" | "notified" | "cancelled";

export type StockAlertInput = {
  uid?: string | null;
  email: string;
  phone?: string;
  productId: string;
  productSlug: string;
  productTitle?: { tr?: string; en?: string } | string;
  productImage?: string;
  productSku?: string;
  source?: "product" | "grid" | "showcase" | "shop" | "category-grid";
  locale?: "tr" | "en";
  lastKnownStock?: number;
  lastKnownPriceTry?: number;
};

function s(v: any) {
  return String(v ?? "").trim();
}

function normalizeTitle(v: any) {
  if (typeof v === "string") {
    const t = s(v);
    return {
      tr: t || "Ürün",
      en: t || "Product",
    };
  }

  return {
    tr: s(v?.tr) || s(v?.en) || "Ürün",
    en: s(v?.en) || s(v?.tr) || "Product",
  };
}

export async function findExistingStockAlert(
  uid: string | null | undefined,
  email: string,
  productId: string
) {
  const db = getFirebaseDb();
  const checks: Promise<any>[] = [];

  const cleanEmail = s(email).toLowerCase();
  const cleanProductId = s(productId);

  if (!cleanProductId) return null;

  if (uid) {
    checks.push(
      getDocs(
        query(
          collection(db, "stock_alerts"),
          where("uid", "==", uid),
          where("productId", "==", cleanProductId),
          limit(1)
        )
      )
    );
  }

  if (cleanEmail) {
    checks.push(
      getDocs(
        query(
          collection(db, "stock_alerts"),
          where("email", "==", cleanEmail),
          where("productId", "==", cleanProductId),
          limit(1)
        )
      )
    );
  }

  const results = await Promise.all(checks);

  for (const snap of results) {
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...(d.data() as any) };
    }
  }

  return null;
}

export async function createStockAlert(input: StockAlertInput) {
  const db = getFirebaseDb();

  const cleanUid = input.uid || null;
  const cleanEmail = s(input.email).toLowerCase();
  const cleanPhone = s(input.phone);
  const cleanProductId = s(input.productId);
  const cleanProductSlug = s(input.productSlug);
  const cleanProductSku = s(input.productSku);
  const cleanProductImage = s(input.productImage);
  const normalizedTitle = normalizeTitle(input.productTitle);

  if (!cleanProductId) throw new Error("productId zorunlu.");
  if (!cleanProductSlug) throw new Error("productSlug zorunlu.");
  if (!cleanEmail) throw new Error("E-posta zorunlu.");

  const existing = await findExistingStockAlert(cleanUid, cleanEmail, cleanProductId);

  if (existing) {
    if (existing.status === "cancelled") {
      await updateDoc(doc(db, "stock_alerts", existing.id), {
        uid: cleanUid,
        email: cleanEmail,
        phone: cleanPhone || s(existing.phone),
        productId: cleanProductId,
        productSlug: cleanProductSlug,
        productTitle: normalizedTitle,
        productImage: cleanProductImage || s(existing.productImage),
        productSku: cleanProductSku || s(existing.productSku),
        status: "active",
        source: input.source || existing.source || "product",
        locale: input.locale || "tr",
        lastKnownStock: Number(input.lastKnownStock ?? existing.lastKnownStock ?? 0),
        lastKnownPriceTry: Number(input.lastKnownPriceTry ?? existing.lastKnownPriceTry ?? 0),
        updatedAt: serverTimestamp(),
      });

      return { ok: true, id: existing.id, revived: true };
    }

    return { ok: true, id: existing.id, exists: true };
  }

  const ref = await addDoc(collection(db, "stock_alerts"), {
    uid: cleanUid,
    email: cleanEmail,
    phone: cleanPhone || "",
    productId: cleanProductId,
    productSlug: cleanProductSlug,
    productTitle: normalizedTitle,
    productImage: cleanProductImage || "",
    productSku: cleanProductSku || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    notifiedAt: null,
    status: "active",
    source: input.source || "product",
    locale: input.locale || "tr",
    lastKnownStock: Number(input.lastKnownStock ?? 0),
    lastKnownPriceTry: Number(input.lastKnownPriceTry ?? 0),
  });

  return { ok: true, id: ref.id, created: true };
}

export async function cancelStockAlert(alertId: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "stock_alerts", alertId), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
}

export async function reactivateStockAlert(alertId: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "stock_alerts", alertId), {
    status: "active",
    updatedAt: serverTimestamp(),
  });
}

export async function listMyStockAlerts(uid: string) {
  const db = getFirebaseDb();

  const snap = await getDocs(
    query(
      collection(db, "stock_alerts"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    )
  );

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
}