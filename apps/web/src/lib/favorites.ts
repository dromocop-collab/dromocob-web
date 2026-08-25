"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type FavItem = {
  id: string;
  title?: string;
  image?: string;
  price?: number;
  currency?: string;
  slug?: string;
  updatedAt?: number;
};

const EVT = "nci_favorites_changed";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cleanStr(v: unknown) {
  return String(v ?? "").trim();
}

function getFavoritesKey(uid?: string | null) {
  const clean = cleanStr(uid);
  return clean ? `nci_favorites_${clean}` : "nci_favorites_guest";
}

function sanitizeFavItem(item: unknown): FavItem | null {
  if (!item || typeof item !== "object") return null;

  const obj = item as any;
  const id = cleanStr(obj.id);
  if (!id) return null;

  const title = cleanStr(obj.title);
  const image = cleanStr(obj.image);
  const currency = cleanStr(obj.currency);
  const slug = cleanStr(obj.slug);

  const priceNum = Number(obj.price);
  const updatedAtNum = Number(obj.updatedAt);

  return {
    id,
    ...(title ? { title } : {}),
    ...(image ? { image } : {}),
    ...(Number.isFinite(priceNum) ? { price: priceNum } : {}),
    ...(currency ? { currency } : {}),
    ...(slug ? { slug } : {}),
    updatedAt: Number.isFinite(updatedAtNum) ? updatedAtNum : Date.now(),
  };
}

function normalizeStore(raw: unknown): Record<string, FavItem> {
  if (!raw || typeof raw !== "object") return {};

  const out: Record<string, FavItem> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const item = sanitizeFavItem({ ...(value as any), id: cleanStr((value as any)?.id || key) });
    if (!item) continue;
    out[item.id] = item;
  }

  return out;
}

function readStore(key: string): Record<string, FavItem> {
  if (!isBrowser()) return {};
  return normalizeStore(safeParse<Record<string, FavItem>>(window.localStorage.getItem(key), {}));
}

function writeStore(key: string, next: Record<string, FavItem>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

/**
 * Guest favorileri girişten sonra kullanıcı favorilerine taşır.
 * - duplicate varsa user tarafı korunur
 * - guest store temizlenir
 */
export function syncFavoritesAfterAuth(uid?: string | null) {
  if (!isBrowser()) return;

  const cleanUid = cleanStr(uid);
  if (!cleanUid) return;

  const guestKey = getFavoritesKey(null);
  const userKey = getFavoritesKey(cleanUid);

  if (guestKey === userKey) return;

  const guestStore = readStore(guestKey);
  const userStore = readStore(userKey);

  const guestItems = Object.values(guestStore);
  if (!guestItems.length) return;

  const merged: Record<string, FavItem> = { ...userStore };

  for (const item of guestItems) {
    if (!merged[item.id]) {
      merged[item.id] = {
        ...item,
        updatedAt: Date.now(),
      };
    }
  }

  window.localStorage.setItem(userKey, JSON.stringify(merged));
  window.localStorage.removeItem(guestKey);
  window.dispatchEvent(new Event(EVT));
}

/**
 * Hook dışı favori ekleme (24 saat kuralı için).
 * Zaten favorilerdeyse duplicate oluşturmaz.
 */
export function addFavoriteItem(uid: string | null | undefined, item: FavItem) {
  if (!isBrowser()) return;

  const clean = sanitizeFavItem(item);
  if (!clean) return;

  const key = getFavoritesKey(uid);
  const store = readStore(key);

  if (store[clean.id]) return; // duplicate kontrolü

  store[clean.id] = {
    ...clean,
    updatedAt: Date.now(),
  };

  writeStore(key, store);
}

export function useFavorites(uid?: string | null) {
  const key = useMemo(() => getFavoritesKey(uid), [uid]);
  const [map, setMap] = useState<Record<string, FavItem>>({});

  useEffect(() => {
    const load = () => setMap(readStore(key));

    load();

    const onCustom = () => load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === getFavoritesKey(null)) load();
    };

    window.addEventListener(EVT, onCustom);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(EVT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const items = useMemo(
    () =>
      Object.values(map).sort(
        (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
      ),
    [map]
  );

  const count = items.length;

  const has = useCallback((id: string) => !!map[cleanStr(id)], [map]);

  const add = useCallback(
    (item: FavItem) => {
      const clean = sanitizeFavItem(item);
      if (!clean) return;

      const store = readStore(key);
      store[clean.id] = {
        ...store[clean.id],
        ...clean,
        updatedAt: Date.now(),
      };

      writeStore(key, store);
      setMap(store);
    },
    [key]
  );

  const remove = useCallback(
    (id: string) => {
      const cleanId = cleanStr(id);
      if (!cleanId) return;

      const store = readStore(key);
      delete store[cleanId];

      writeStore(key, store);
      setMap(store);
    },
    [key]
  );

  const toggle = useCallback(
    (id: string, item?: Omit<FavItem, "id">) => {
      const cleanId = cleanStr(id);
      if (!cleanId) return;

      const store = readStore(key);

      if (store[cleanId]) {
        delete store[cleanId];
      } else {
        const clean = sanitizeFavItem({
          id: cleanId,
          ...(item || {}),
          updatedAt: Date.now(),
        });
        if (!clean) return;
        store[cleanId] = clean;
      }

      writeStore(key, store);
      setMap(store);
    },
    [key]
  );

  const clear = useCallback(() => {
    writeStore(key, {});
    setMap({});
  }, [key]);

  return {
    items,
    count,
    has,
    add,
    remove,
    toggle,
    clear,
    storageKey: key,
  };
}