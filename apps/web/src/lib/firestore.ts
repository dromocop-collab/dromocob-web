// apps/web/src/lib/firestore.ts
"use client";

import { getFirebaseDb } from "@/lib/firebase.client";
import {
  doc,
  onSnapshot,
  type Unsubscribe,
  type Timestamp,
} from "firebase/firestore";

export type Locale = "tr" | "en";

// UI'nın beklediği stabil item tipi ✅
export type RateItem = {
  id: string;                 // stable key
  rawKey?: string;            // provider key (örn: "GRAM ALTIN")
  label?: Partial<Record<Locale, string>>; // {"tr": "...", "en": "..."} opsiyonel
  buy: number;
  sell: number;
  percent?: number | null;    // yüzde değişim
  arrow?: "up" | "down" | "flat" | null;
};

// Firestore rates/latest dokümanı tipi ✅
export type RatesLatest = {
  provider?: string;
  fetchedAt?: Timestamp | string | number | null;
  count?: number;
  // hem eski map hem yeni array'i destekliyoruz
  items?: Record<string, RateItem> | RateItem[];
  itemsArray?: RateItem[]; // opsiyonel legacy
  raw?: any;               // debug
};

// sayı normalize
function toNum(v: any, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function normArrow(v: any): "up" | "down" | "flat" | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "up") return "up";
  if (s === "down") return "down";
  if (s === "flat") return "flat";
  return null;
}

// Firestore'dan gelen item'ı UI tipine normalize et
function normalizeItem(x: any, fallbackKey: string): RateItem | null {
  if (!x || typeof x !== "object") return null;

  const rawKey = String(x.rawKey ?? x.code ?? x.key ?? fallbackKey ?? "").trim();
  const id = String(x.id ?? rawKey ?? fallbackKey ?? "").trim();
  if (!id) return null;

  // label (varsa)
  const labelObj = x.label && typeof x.label === "object" ? x.label : null;

  // percent / change
  const percent =
    x.percent != null ? toNum(x.percent, 0)
    : x.change != null ? toNum(x.change, 0)
    : null;

  return {
    id,
    rawKey,
    label: labelObj
      ? {
          tr: typeof labelObj.tr === "string" ? labelObj.tr : undefined,
          en: typeof labelObj.en === "string" ? labelObj.en : undefined,
        }
      : undefined,
    buy: toNum(x.buy ?? x.alis ?? x.bid ?? 0, 0),
    sell: toNum(x.sell ?? x.satis ?? x.ask ?? 0, 0),
    percent,
    arrow: normArrow(x.arrow),
  };
}

// rates/latest içeriğini normalize edip tek format döndür
function normalizeRatesLatest(docData: any): RatesLatest {
  const provider = docData?.provider ?? docData?.source ?? "-";
  const fetchedAt = docData?.fetchedAt ?? docData?.updatedAt ?? null;

  const src =
    docData?.items ??
    docData?.itemsArray ??
    docData?.data ??
    [];

  let itemsArray: RateItem[] = [];

  if (Array.isArray(src)) {
    itemsArray = src
      .map((x, i) => normalizeItem(x, String(i)))
      .filter(Boolean) as RateItem[];
  } else if (src && typeof src === "object") {
    itemsArray = Object.entries(src)
      .map(([k, v]) => normalizeItem(v, k))
      .filter(Boolean) as RateItem[];
  }

  return {
    provider,
    fetchedAt,
    count: docData?.count ?? itemsArray.length,
    // UI iki formu da okuyabiliyor ama array'i de verelim
    itemsArray,
    // debug istersen:
    raw: docData,
  };
}

/**
 * rates/latest realtime listener
 * callback'e her zaman normalize edilmiş RatesLatest verir.
 */
export function listenRatesLatest(onData: (d: RatesLatest | null) => void): Unsubscribe {
  const db = getFirebaseDb();
  const ref = doc(db, "rates", "latest");

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return onData(null);
      const data = snap.data();
      onData(normalizeRatesLatest(data));
    },
    (err) => {
      console.error("listenRatesLatest error:", err);
      onData(null);
    }
  );
}