"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  addDoc,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase.client";
import { onIdTokenChanged, type User } from "firebase/auth";
import { fetchCategoryBySlug, type Category as Cat } from "@/lib/categories";
import { addToCart, getCart } from "@/lib/cart";
import { RatesLatest, resolveProductPriceTRY } from "@/lib/pricing";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./ShopClient.module.css";
import { useT } from "@/lib/useT";
import { trackMetaAddToCart } from "@/lib/metaPixel";

type LT = { tr?: string; en?: string };

type Product = {
  id: string;
  title: string;
  slug: string;
  price?: number;
  finalPrice?: number;
  currency?: string;
  images?: string[];
  createdAt?: any;
  isActive?: boolean;
  sku?: string;
  stock?: number;
  categoryIds?: string[];
  categorySlug?: string;
  categorySlugs?: string[];

  priceMode?: string;
  priceRateCode?: string;
  pricePercent?: number;
  priceFixedAdd?: number;
  priceOverrideEnabled?: boolean;
  priceOverride?: number;

  gram?: number;
  hasGram?: number;
  weightGram?: number;
  weightGr?: number;

  categoryPricingEnabled?: boolean;
  categoryPricing?: any;
  resolvedCategoryPricing?: any;

  compareAtPercent?: number;
  comparePricePercent?: number;
  compareAtRate?: number;
  compareAtEnabled?: boolean;
  compareAtOverrideEnabled?: boolean;
};

type StatItem = { k?: string; title?: LT; value?: LT };

type ShopSettings = {
  isActiveOnly?: boolean;
  pageSize?: number;
  defaultSort?: "new" | "price_asc" | "price_desc";
  hero?: {
    badge?: LT;
    title?: LT;
    subtitle?: LT;
    posterHint?: LT;
    posterImage?: LT;
  };
  featureChips?: { tr?: any; en?: any };
  stats?: any;
};

type ShopCatItem = {
  id: string;
  slug: string;
  name: string;
  parentId?: string;
  order?: number;
};
const FALLBACK_PRODUCT_LOGO = "/dromocob-mark.svg";
const DEFAULT_SETTINGS: ShopSettings = {
  isActiveOnly: true,
  pageSize: 48,
  defaultSort: "new",
  hero: {
    badge: { tr: "Premium Koleksiyon", en: "Premium Collection" },
    title: { tr: "Mağaza", en: "Shop" },
    subtitle: {
      tr: "Özenle seçilmiş ürünleri keşfet. Filtrele, sırala ve güvenle satın al.",
      en: "Discover carefully selected products. Filter, sort and shop securely.",
    },
    posterHint: { tr: "Özel seçki", en: "Curated picks" },
  },
  featureChips: {
    tr: ["Sertifikalı", "Güvenli ödeme", "Hızlı teslimat"],
    en: ["Certified", "Secure payment", "Fast delivery"],
  },
  stats: [
    { k: "delivery", title: { tr: "Teslimat", en: "Delivery" }, value: { tr: "Hızlı", en: "Fast" } },
    { k: "payment", title: { tr: "Ödeme", en: "Payment" }, value: { tr: "Güvenli", en: "Secure" } },
    { k: "quality", title: { tr: "Kalite", en: "Quality" }, value: { tr: "Sertifikalı", en: "Certified" } },
  ],
};
function categoryLabelByLoc(loc: "tr" | "en", v: any, fallback = ""): string {
  if (!v) return fallback;

  if (typeof v === "string") return v.trim() || fallback;

  const directTr = s(v?.tr);
  const directEn = s(v?.en);

  const nameTr = s(v?.name?.tr);
  const nameEn = s(v?.name?.en);

  const titleTr = s(v?.title?.tr);
  const titleEn = s(v?.title?.en);

  const labelTr = s(v?.label?.tr);
  const labelEn = s(v?.label?.en);

  const slug = s(v?.slug);

  const tr = directTr || nameTr || titleTr || labelTr;
  const en = directEn || nameEn || titleEn || labelEn;

  return loc === "en" ? (en || tr || slug || fallback) : (tr || en || slug || fallback);
}
function s(v: any) {
  return String(v ?? "").trim();
}

function pickLT(loc: "tr" | "en", v: any, fbTR = "", fbEN = ""): string {
  if (typeof v === "string") return v.trim();
  const tr = s(v?.tr) || fbTR;
  const en = s(v?.en) || fbEN;
  return loc === "en" ? en : tr;
}

function isUsableImageUrl(v: string) {
  const x = String(v || "").trim();
  if (!x) return false;
  if (x.startsWith("/")) return true;
  return /^https?:\/\//i.test(x);
}

function pickProductImage(x: any): string {
  const images = Array.isArray(x?.images)
    ? x.images.map((v: any) => s(v)).filter(Boolean)
    : [];

  const candidates = [
    images[0],
    x?.image,
    x?.mainImage,
    x?.fallbackImageUrl,
    FALLBACK_PRODUCT_LOGO,
  ]
    .map((v) => s(v))
    .filter(Boolean);

  return candidates.find(isUsableImageUrl) || FALLBACK_PRODUCT_LOGO;
}
function currencyCode(cur?: string) {
  const c = String(cur || "").toUpperCase().trim();
  if (c === "TL" || c === "₺") return "TRY";
  if (c === "$") return "USD";
  if (c === "€") return "EUR";
  return c || "TRY";
}

function moneyTR(v?: number, cur?: string) {
  const n = typeof v === "number" ? v : Number(v || 0);
  const code = currencyCode(cur);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${(Number.isFinite(n) ? n : 0).toLocaleString("tr-TR")} ₺`;
  }
}

function getCurrentCartQty(productId: string, uid?: string | null) {
  try {
    const items = getCart(uid || null);
    return items
      .filter((it) => String(it?.id || "").trim() === String(productId || "").trim())
      .reduce((sum, it) => sum + Math.max(1, Number(it?.qty || 1)), 0);
  } catch {
    return 0;
  }
}

function clampAddableQty(wanted: number, current: number, stock: number) {
  const safeWanted = Math.max(1, Math.floor(Number(wanted || 1)));
  const safeCurrent = Math.max(0, Math.floor(Number(current || 0)));
  const safeStock = Math.max(0, Math.floor(Number(stock || 0)));

  if (safeStock <= safeCurrent) return 0;
  return Math.min(safeWanted, safeStock - safeCurrent);
}

function getCreatedAtMs(v: any) {
  try {
    if (v?.toMillis) return Number(v.toMillis());
    if (typeof v === "number") return v;
    if (typeof v === "string") return Date.parse(v) || 0;
    return 0;
  } catch {
    return 0;
  }
}

function normalizeStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[\n,|]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeStats(v: any): StatItem[] {
  if (Array.isArray(v)) return v as StatItem[];
  if (v && typeof v === "object") {
    const vals = Object.values(v);
    if (Array.isArray(vals)) return vals as StatItem[];
  }
  return [];
}

function normalizeShopSettings(raw: any): ShopSettings {
  const d = raw && typeof raw === "object" ? raw : {};
  const hero = d.hero && typeof d.hero === "object" ? d.hero : {};

  const chipsTR = normalizeStringArray(d?.featureChips?.tr ?? d?.featureChipsTR ?? d?.chipsTR);
  const chipsEN = normalizeStringArray(d?.featureChips?.en ?? d?.featureChipsEN ?? d?.chipsEN);
  const stats = normalizeStats(d?.stats);

  return {
    ...DEFAULT_SETTINGS,
    ...d,
    pageSize: Number.isFinite(Number(d?.pageSize)) ? Number(d.pageSize) : DEFAULT_SETTINGS.pageSize,
    isActiveOnly: d?.isActiveOnly !== false,
    defaultSort: (d?.defaultSort as any) || DEFAULT_SETTINGS.defaultSort,
    hero: {
      ...DEFAULT_SETTINGS.hero,
      ...hero,
    },
    featureChips: {
      tr: chipsTR.length ? chipsTR : (DEFAULT_SETTINGS.featureChips?.tr as any),
      en: chipsEN.length ? chipsEN : (DEFAULT_SETTINGS.featureChips?.en as any),
    },
    stats: stats.length ? stats : (DEFAULT_SETTINGS.stats as any),
  };
}

function normText(v: any) {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productSearchText(p: any) {
  return normText(
    [
      p?.title,
      p?.slug,
      p?.sku,
      p?.currency,
      Array.isArray(p?.images) ? p.images.join(" ") : "",
    ].join(" ")
  );
}

function seededShuffle<T>(arr: T[], seed = "shop-mix"): T[] {
  const copy = [...arr];

  function hash(str: string) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  let state = hash(seed);

  function rand() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
export default function ShopClient({
  initialCat,
  initialQ,
  initialSort,
}: {
  initialCat: string;
  initialQ: string;
  initialSort: string;
}) {
  const { loc } = useT();
  const ui = useMemo(
    () => ({
      home: loc === "en" ? "Home" : "Anasayfa",
      shop: loc === "en" ? "Shop" : "Mağaza",
      loading: loc === "en" ? "Loading…" : "Yükleniyor…",
      filters: loc === "en" ? "Filters" : "Filtreler",
      openFilters: loc === "en" ? "Open filters" : "Filtreleri aç",
      closeFilters: loc === "en" ? "Close filters" : "Filtreleri kapat",
      goCart: loc === "en" ? "Go to Cart" : "Sepete Git",
      clearCategory: loc === "en" ? "Clear Category" : "Kategoriyi Temizle",
      filterTitle: loc === "en" ? "Product filters" : "Ürün filtreleri",
      filterDesc:
        loc === "en"
          ? "You can manage search and sorting here."
          : "Arama ve sıralamayı buradan yönetebilirsin.",
      search: loc === "en" ? "Search" : "Ara",
      searchPlaceholder:
        loc === "en"
          ? "Product name, SKU, slug..."
          : "Ürün adı, ürün kodu, slug...",
      minPrice: loc === "en" ? "Min price" : "Min fiyat",
      maxPrice: loc === "en" ? "Max price" : "Max fiyat",
      sort: loc === "en" ? "Sort" : "Sırala",
      action: loc === "en" ? "Action" : "İşlem",
      newest: loc === "en" ? "Newest" : "En yeni",
      priceAsc: loc === "en" ? "Price (low to high)" : "Fiyat (artan)",
      priceDesc: loc === "en" ? "Price (high to low)" : "Fiyat (azalan)",
      clearFilters: loc === "en" ? "Clear filters" : "Filtreleri temizle",
      showResults: loc === "en" ? "Show results" : "Sonuçları göster",
      collection: loc === "en" ? "Collection" : "Koleksiyon",
      allProducts: loc === "en" ? "All products" : "Tüm ürünler",
      productViewText:
        loc === "en"
          ? "Your smile is our gold."
          : "Sizin Gülümsemeniz Dromocob deneyimi...",
      results: loc === "en" ? "results" : "sonuç",
      all: loc === "en" ? "All" : "Tümü",
      notFoundTitle: loc === "en" ? "No products found" : "Ürün bulunamadı",
      notFoundSub:
        loc === "en"
          ? "Change the search filter or try another category."
          : "Arama filtresini değiştir ya da başka kategori dene.",
      clearSearch: loc === "en" ? "Clear search" : "Aramayı temizle",
      productCode: loc === "en" ? "Product Code" : "Ürün Kodu",
      salePrice: loc === "en" ? "Sale price" : "Satış fiyatı",
      outOfStock: loc === "en" ? "Out of stock" : "Tükendi",
      addToCart: loc === "en" ? "Add to Cart" : "Sepete Ekle",
      review: loc === "en" ? "View" : "İncele",
      saving: loc === "en" ? "Saving..." : "Kaydediliyor...",
      notifyActive: loc === "en" ? "Notification Active" : "Bildirim Aktif",
      notifyMe: loc === "en" ? "Notify Me" : "Gelince Haber Ver",
      showMore: loc === "en" ? "Show All Products" : "Tüm Ürünleri Göster",
      alreadyInStock:
        loc === "en" ? "This product is already in stock." : "Bu ürün zaten stokta var.",
      loginRequired:
        loc === "en" ? "You need to sign in first." : "Önce giriş yapman gerekiyor.",
      alreadyActive:
        loc === "en" ? "Notification is already active." : "Bildirim zaten aktif.",
      stockAlertCreated:
        loc === "en" ? "Stock alert created ✅" : "Stok bildirimi oluşturuldu ✅",
      stockAlertFailed:
        loc === "en" ? "Stock alert could not be created." : "Stok bildirimi oluşturulamadı.",
      noStock: loc === "en" ? "Out of stock." : "Stokta yok.",
      maxQtyReached:
        loc === "en"
          ? "Maximum stock quantity reached for this product"
          : "Bu ürün için maksimum stok adedine ulaşıldı",
      addedToCart: loc === "en" ? "Added to cart ✅" : "Sepete eklendi ✅",
      maxQty: loc === "en" ? "Maximum quantity" : "Maksimum adet",
    }),

    [loc]

  );
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const [totalCount, setTotalCount] = useState(0);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const catSlug = (searchParams.get("cat") || initialCat || "").trim();
  const [qText, setQText] = useState(initialQ || "");
  const [sort, setSort] = useState<string>(initialSort || DEFAULT_SETTINGS.defaultSort || "new");

  const [cat, setCat] = useState<Cat | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);

  const [items, setItems] = useState<Product[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsErr, setItemsErr] = useState("");

  const [allCategories, setAllCategories] = useState<ShopCatItem[]>([]);
  const [shopCats, setShopCats] = useState<ShopCatItem[]>([]);
  const [rates, setRates] = useState<RatesLatest | null>(null);

  const [cartPulseId, setCartPulseId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileOpenCatId, setMobileOpenCatId] = useState("");
  const [alertBusyId, setAlertBusyId] = useState("");
  const [alertMap, setAlertMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const localizedCurrentCategoryName = useMemo(() => {
    if (!catSlug) return "";

    const exact = allCategories.find((c) => c.slug === catSlug);
    if (exact?.name) return exact.name;

    return categoryLabelByLoc(loc, cat, catSlug);
  }, [allCategories, catSlug, cat, loc]);
  const cartUid = user && !user.isAnonymous ? user.uid : null;
  const selectedRootCat = useMemo(() => {
    if (!catSlug) return null;

    const direct = shopCats.find((c) => c.slug === catSlug || c.id === cat?.id);
    if (direct) return direct;

    const selected = allCategories.find((c) => c.slug === catSlug || c.id === cat?.id);
    if (!selected?.parentId) return selected || null;

    return shopCats.find((c) => c.id === selected.parentId) || selected;
  }, [shopCats, allCategories, catSlug, cat?.id]);

  const mobileSubCats = useMemo(() => {
    const rootId = mobileOpenCatId || selectedRootCat?.id || "";
    if (!rootId) return [];

    return allCategories
      .filter((x) => x.parentId === rootId)
      .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));
  }, [allCategories, mobileOpenCatId, selectedRootCat?.id]);

  const activeRootSlug = selectedRootCat?.slug || "";
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRates(snap.exists() ? (snap.data() as any) : null),
      () => setRates(null)
    );
    return () => unsub();
  }, [db]);
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  function fireToast(msg: string) {
    setToast(msg);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    const ref = doc(db, "site_options", "shop_settings");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const raw = snap.exists() ? (snap.data() as any) : null;
        const merged = normalizeShopSettings(raw);
        setSettings(merged);
        setSort((prev) => (s(prev) ? prev : String(merged.defaultSort || "new")));
      },
      (err) => console.error("shop_settings snapshot error:", err)
    );
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setAlertMap({});
      return;
    }

    const qy = query(
      collection(db, "stock_alerts"),
      where("uid", "==", user.uid),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next: Record<string, boolean> = {};
        snap.forEach((d) => {
          const x: any = d.data();
          const pid = String(x?.productId || "").trim();
          if (pid) next[pid] = true;
        });
        setAlertMap(next);
      },
      () => setAlertMap({})
    );

    return () => unsub();
  }, [db, user]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
        if (!alive) return;

        const allCats = snap.docs
          .map((d) => {
            const x: any = d.data();
            return {
              id: d.id,
              slug: String(x?.slug || d.id).trim(),
              name:
                typeof x?.name === "string"
                  ? x.name
                  : String(
                    loc === "en"
                      ? x?.name?.en || x?.name?.tr || x?.title?.en || x?.title?.tr || x?.slug || d.id
                      : x?.name?.tr || x?.name?.en || x?.title?.tr || x?.title?.en || x?.slug || d.id
                  ).trim(),
              isActive: x?.isActive !== false,
              showInMenu: x?.showInMenu !== false,
              parentId: String(x?.parentId || "").trim(),
              order: Number(x?.order ?? 9999),
            };
          })
          .filter((x) => x.isActive && x.showInMenu);

        const roots = allCats.filter((x) => !x.parentId);

        setShopCats(roots);
        setAllCategories(allCats);
      } catch (err) {
        console.error("shop categories load error:", err);
        if (alive) {
          setShopCats([]);
          setAllCategories([]);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, loc]);

  useEffect(() => {
    let alive = true;

    if (!catSlug) {
      setCat(null);
      setLoadingCat(false);
      return () => {
        alive = false;
      };
    }

    setLoadingCat(true);

    (async () => {
      try {
        const c = await fetchCategoryBySlug(catSlug);
        if (!alive) return;
        setCat(c);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setCat(null);
      } finally {
        if (!alive) return;
        setLoadingCat(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [catSlug]);

  useEffect(() => {
    if (!filterOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const effectiveCatId = catSlug && cat?.id ? cat.id : "";

  const activeCategoryMeta = useMemo(() => {
    if (!effectiveCatId) {
      return {
        ids: [] as string[],
        slugs: [] as string[],
      };
    }

    const selectedRoot = allCategories.find((c) => c.id === effectiveCatId);
    const children = allCategories.filter((c) => c.parentId === effectiveCatId);

    return {
      ids: [effectiveCatId, ...children.map((c) => c.id)].filter(Boolean),
      slugs: [selectedRoot?.slug || "", ...children.map((c) => c.slug)].filter(Boolean),
    };
  }, [effectiveCatId, allCategories]);

  const loadProducts = useCallback(async () => {
    setItemsErr("");

    if (catSlug && !cat?.id) {
      setLoadingItems(true);
      return;
    }

    setLoadingItems(true);

    const colRef = collection(db, "products");
    const catFilters: QueryConstraint[] = [];

    if (catSlug && cat?.id) {
      catFilters.push(where("categoryIds", "array-contains", cat.id));
    }

    const wantActiveOnly = settings?.isActiveOnly !== false;
    const activeFilter: QueryConstraint[] = wantActiveOnly ? [where("isActive", "==", true)] : [];

    const idealOrder =
      sort === "price_asc"
        ? orderBy("price", "asc")
        : sort === "price_desc"
          ? orderBy("price", "desc")
          : orderBy("createdAt", "desc");

    const toList = (snap: any): Product[] =>
      snap.docs.map((d: any) => {
        const x: any = d.data();
        const firstImage = pickProductImage(x);
        const imgs = firstImage ? [firstImage] : [FALLBACK_PRODUCT_LOGO];
        return {
          id: d.id,
          title:
            typeof x?.title === "string"
              ? x.title
              : loc === "en"
                ? String(x?.title?.en || x?.title?.tr || x?.name?.en || x?.name?.tr || x?.name || "")
                : String(x?.title?.tr || x?.title?.en || x?.name?.tr || x?.name?.en || x?.name || ""),
          slug: String(x.slug || d.id),

          price:
            typeof x.finalPrice === "number"
              ? x.finalPrice
              : typeof x.price === "number"
                ? x.price
                : Number(x.finalPrice || x.price || 0),

          finalPrice:
            typeof x.finalPrice === "number"
              ? x.finalPrice
              : Number(x.finalPrice || 0),

          currency: String(x.currency || "TRY"),
          images: imgs,
          createdAt: x.createdAt,
          isActive: typeof x.isActive === "boolean" ? x.isActive : undefined,
          sku: String(x.sku || ""),
          stock: typeof x.stock === "number" ? x.stock : Number(x.stock || 0),

          categoryIds: Array.isArray(x.categoryIds) ? x.categoryIds : [],
          categorySlug: String(x.categorySlug || ""),
          categorySlugs: Array.isArray(x.categorySlugs) ? x.categorySlugs : [],

          priceMode: String(x.priceMode || ""),
          priceRateCode: String(x.priceRateCode || ""),
          pricePercent: Number(x.pricePercent || 0),
          priceFixedAdd: Number(x.priceFixedAdd || 0),
          priceOverrideEnabled: !!x.priceOverrideEnabled,
          priceOverride: Number(x.priceOverride || 0),

          gram: Number(x.gram || 0),
          hasGram: Number(x.hasGram || 0),
          weightGram: Number(x.weightGram || 0),
          weightGr: Number(x.weightGr || 0),

          categoryPricingEnabled: !!x.categoryPricingEnabled,
          categoryPricing: x.categoryPricing || null,
          resolvedCategoryPricing: x.resolvedCategoryPricing || null,

          compareAtEnabled:
            x.compareAtEnabled === true ||
            x.categoryPricing?.compareAtEnabled === true ||
            x.resolvedCategoryPricing?.compareAtEnabled === true,

          compareAtOverrideEnabled: !!x.compareAtOverrideEnabled,

          compareAtPercent: Number(
            x.compareAtPercent ??
            x.comparePricePercent ??
            x.categoryPricing?.compareAtPercent ??
            x.resolvedCategoryPricing?.compareAtPercent ??
            0
          ),
        };
      });

    const applySearch = (list: Product[]) => {
      const q = normText(qText);
      const min = Number(minPrice || 0);
      const max = Number(maxPrice || 0);

      let out = [...list];

      if (activeCategoryMeta.ids.length || activeCategoryMeta.slugs.length) {
        out = out.filter((p) => {
          const ids = Array.isArray(p.categoryIds) ? p.categoryIds.map((x) => String(x).trim()) : [];
          const slug = String(p.categorySlug || "").trim();
          const slugs = Array.isArray(p.categorySlugs) ? p.categorySlugs.map((x) => String(x).trim()) : [];

          const hitById = activeCategoryMeta.ids.some((id) => ids.includes(id));
          const hitBySlug =
            activeCategoryMeta.slugs.includes(slug) ||
            activeCategoryMeta.slugs.some((s) => slugs.includes(s));

          return hitById || hitBySlug;
        });
      }

      if (q) {
        out = out.filter((p) => {
          const hay = productSearchText(p);
          if (hay.includes(q)) return true;

          const parts = q.split(" ").filter(Boolean);
          return parts.every((part) => hay.includes(part));
        });
      }

      if (Number.isFinite(min) && min > 0) {
        out = out.filter((p) => Number(p.price || 0) >= min);
      }

      if (Number.isFinite(max) && max > 0) {
        out = out.filter((p) => Number(p.price || 0) <= max);
      }

      return out;
    };

    const clientSort = (list: Product[]) => {
      const arr = [...list];

      if (sort === "price_asc") {
        arr.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      } else if (sort === "price_desc") {
        arr.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      } else {
        arr.sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      }

      return arr;
    };

    try {
      try {
        const q1Parts = [
          ...catFilters,
          ...activeFilter,
          ...(idealOrder ? [idealOrder] : []),
        ];

        const q1 = query(colRef, ...q1Parts);
        const snap1 = await getDocs(q1);
        let list1 = toList(snap1);

        if (!list1.length && wantActiveOnly) {
          const q1bParts = [
            ...catFilters,
            ...(idealOrder ? [idealOrder] : []),
          ];

          const q1b = query(colRef, ...q1bParts);
          const snap1b = await getDocs(q1b);
          list1 = toList(snap1b).filter((p) => p.isActive !== false);
        }

        list1 = applySearch(list1);
        list1 = clientSort(list1);
        setItems(list1);
        return;
      } catch (e1) {
        console.error("products fetch ideal error:", e1);
      }

      const q2 = query(colRef, ...catFilters, ...activeFilter);
      const snap2 = await getDocs(q2);
      let list2 = toList(snap2);

      if (!list2.length && wantActiveOnly) {
        const q2b = query(colRef, ...catFilters);
        const snap2b = await getDocs(q2b);
        list2 = toList(snap2b).filter((p) => p.isActive !== false);
      }

      list2 = clientSort(list2);
      list2 = applySearch(list2);
      setItems(list2);
    } catch (e2) {
      console.error("products fetch fallback error:", e2);
      setItems([]);
      setItemsErr(loc === "en" ? "Products could not be loaded." : "Ürünler yüklenemedi.");
    } finally {
      setLoadingItems(false);
    }
  }, [db, catSlug, cat?.id, qText, minPrice, maxPrice, sort, settings, activeCategoryMeta, loc]);

  useEffect(() => {
    setVisibleCount(24);
  }, [qText, minPrice, maxPrice, sort, catSlug]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const colRef = collection(db, "products");
        const catFilters: QueryConstraint[] = [];

        if (catSlug && cat?.id) {
          catFilters.push(where("categoryIds", "array-contains", cat.id));
        }

        const wantActiveOnly = settings?.isActiveOnly !== false;
        const activeFilter: QueryConstraint[] = wantActiveOnly ? [where("isActive", "==", true)] : [];
        const snap = await getDocs(query(colRef, ...catFilters, ...activeFilter));

        if (!alive) return;

        const docs = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            categoryIds: Array.isArray(x.categoryIds) ? x.categoryIds.map((v: any) => String(v).trim()) : [],
            categorySlug: String(x.categorySlug || "").trim(),
            categorySlugs: Array.isArray(x.categorySlugs) ? x.categorySlugs.map((v: any) => String(v).trim()) : [],
          };
        });

        let filtered = docs;

        if (activeCategoryMeta.ids.length || activeCategoryMeta.slugs.length) {
          filtered = docs.filter((p) => {
            const hitById = activeCategoryMeta.ids.some((id) => p.categoryIds.includes(id));
            const hitBySlug =
              activeCategoryMeta.slugs.includes(p.categorySlug) ||
              activeCategoryMeta.slugs.some((s) => p.categorySlugs.includes(s));
            return hitById || hitBySlug;
          });
        }

        setTotalCount(filtered.length);
      } catch (err) {
        console.error("total count load error:", err);
        if (alive) setTotalCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, catSlug, cat?.id, settings?.isActiveOnly, activeCategoryMeta]);

  const mixedItems = useMemo(() => {
    if (!items.length) return [];

    if (sort === "price_asc" || sort === "price_desc") {
      return items;
    }

    const seed = `${catSlug || "all"}-${qText || "q"}-${items.length}`;
    return seededShuffle(items, seed);
  }, [items, sort, catSlug, qText]);

  const displayedItems = useMemo(() => {
    return mixedItems.slice(0, visibleCount);
  }, [mixedItems, visibleCount]);

  const hasMore = visibleCount < mixedItems.length;


  const hero = settings?.hero || DEFAULT_SETTINGS.hero!;
  const heroTitle = pickLT(loc, hero?.title, "Mağaza", "Shop");
  const title = catSlug
    ? localizedCurrentCategoryName || catSlug
    : heroTitle;

  function handleAddToCart(e: React.MouseEvent, p: Product) {
    e.preventDefault();
    e.stopPropagation();

    const { price: resolvedPrice } = resolveProductPriceTRY(p, rates);

    const stock = Math.max(0, Number(p.stock ?? 0));
    if (stock <= 0) {
      fireToast(ui.noStock);
      return;
    }

    const currentQty = getCurrentCartQty(p.id, cartUid);
    const addableQty = clampAddableQty(1, currentQty, stock);

    if (addableQty <= 0) {
      fireToast(`${ui.maxQtyReached} (${stock}).`);
      return;
    }

    addToCart(
      {
        id: p.id,
        title: p.title,
        slug: p.slug,
        image: p.images?.[0] || FALLBACK_PRODUCT_LOGO,
        priceTry: Number(resolvedPrice || 0),
        qty: addableQty,
      },
      cartUid
    );

    setCartPulseId(p.id);
    window.setTimeout(() => setCartPulseId(""), 900);

    if (currentQty + addableQty >= stock) {
      fireToast(`${ui.addedToCart} ${ui.maxQty}: ${stock}`);
    } else {
      fireToast(ui.addedToCart);
    }

    // Meta Pixel: AddToCart event
    const productSku = s(p.sku || p.id);
    trackMetaAddToCart({
      content_ids: [productSku],
      content_name: p.title,
      content_type: "product",
      contents: [{ id: productSku, quantity: addableQty }],
      value: Number(resolvedPrice) * addableQty || 0,
      currency: "TRY",
    });
  }

  async function createStockAlert(p: Product) {
    const liveStock = Math.max(0, Number(p.stock ?? 0));
    if (liveStock > 0) {
      fireToast(ui.alreadyInStock);
      return;
    }

    if (!user || user.isAnonymous) {
      fireToast(ui.loginRequired);
      return;
    }

    if (alertMap[p.id]) {
      fireToast(ui.alreadyActive);
      return;
    }

    setAlertBusyId(p.id);

    try {
      await addDoc(collection(db, "stock_alerts"), {
        uid: user.uid,
        email: String(user.email || "").trim(),
        phone: "",
        productId: p.id,
        productSlug: String(p.slug || p.id).trim(),
        productSku: String(p.sku || "").trim(),
        productImage: p.images?.[0] || FALLBACK_PRODUCT_LOGO,
        productTitle: {
          tr: String(p.title || "Ürün").trim(),
          en: String(p.title || "Product").trim(),
        },
        lastKnownStock: Number(p.stock ?? 0),
        lastKnownPriceTry: Number(resolveProductPriceTRY(p, rates).price ?? 0),
        locale: [loc === "en" ? "en" : "tr"],
        source: ["shop", "category-grid"],
        status: "active",
        notifiedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      fireToast(ui.stockAlertCreated);
    } catch (err: any) {
      console.error("stock alert create error:", err);
      fireToast(err?.message || ui.stockAlertFailed);
    } finally {
      setAlertBusyId("");
    }
  }

  return (
    <div className={styles.shopWrap}>
      <button
        type="button"
        className={`${styles.filterEdgeToggle} ${filterOpen ? styles.filterEdgeToggleOpen : ""}`}
        onClick={() => setFilterOpen((v) => !v)}
        aria-label={filterOpen ? ui.closeFilters : ui.openFilters}
        aria-expanded={filterOpen}
      >
        <span className={styles.filterEdgeIcon}>{filterOpen ? "→" : "←"}</span>
      </button>

      <section className={styles.heroSection}>
        {toast ? (
          <div className={styles.toast} role="status" aria-live="polite">
            <div className={styles.toastInner}>
              <span className={styles.toastDot} />
              <span>{toast}</span>
            </div>
          </div>
        ) : null}

        <div className={styles.heroTopCompact}>
          <div className={styles.crumbs}>
            <Link href="/" className={styles.crumb}>{ui.home}</Link>
            <span className={styles.dot}>•</span>
            <Link href="/shop" className={styles.crumb}>{ui.shop}</Link>
            {catSlug ? (
              <>
                <span className={styles.dot}>•</span>
                <span className={styles.crumbActive}>
                  {loadingCat ? ui.loading : title}
                </span>
              </>
            ) : null}
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.topBtnGhost}
              onClick={() => setFilterOpen(true)}
            >
              {ui.filters}
            </button>

            <Link href="/cart" className={styles.topBtnDark}>
              {ui.goCart}
            </Link>

            {catSlug ? (
              <Link className={styles.topBtnGhost} href="/shop">
                {ui.clearCategory}
              </Link>
            ) : null}
          </div>
        </div>

        <div
          className={`${styles.filterBackdrop} ${filterOpen ? styles.filterBackdropOpen : ""}`}
          onClick={() => setFilterOpen(false)}
        />

        <aside className={`${styles.filterDrawer} ${filterOpen ? styles.filterDrawerOpen : ""}`}>
          <div className={styles.filterDrawerHead}>
            <div>
              <div className={styles.filterTitle}>{ui.filterTitle}</div>
              <div className={styles.filterDesc}>
                {ui.filterDesc}
              </div>
            </div>

            <button
              type="button"
              className={styles.drawerClose}
              onClick={() => setFilterOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.filterGrid}>
            <label className={styles.field}>
              <span className={styles.label}>{ui.search}</span>
              <input
                className={styles.input}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder={ui.searchPlaceholder}
              />
            </label>

            <div className={styles.priceRow}>
              <label className={styles.field}>
                <span className={styles.label}>{ui.minPrice}</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{ui.maxPrice}</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="50000"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>{ui.sort}</span>
              <div className={styles.sortPicker}>
                {[
                  { value: "new", label: ui.newest, icon: "✦" },
                  { value: "price_asc", label: ui.priceAsc, icon: "↑" },
                  { value: "price_desc", label: ui.priceDesc, icon: "↓" },
                ].map((item) => {
                  const active = sort === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.sortOption} ${active ? styles.sortOptionActive : ""}`}
                      onClick={() => setSort(item.value)}
                    >
                      <span className={styles.sortIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </label>

            <div className={styles.filterActionCol}>
              <span className={styles.label}>{ui.action}</span>

              <div className={styles.filterBtnRow}>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQText("");
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  {ui.clearFilters}
                </button>

                <button
                  type="button"
                  className={styles.applyBtn}
                  onClick={() => setFilterOpen(false)}
                >
                  {ui.showResults}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.catalogHead}>
          <div>
            <div className={styles.catalogKicker}>{ui.collection}</div>
            <h2 className={styles.catalogTitle}>
              {catSlug ? `${title} ${loc === "en" ? "products" : "ürünleri"}` : ui.allProducts}
            </h2>
            <p className={styles.catalogSub}>
              {ui.productViewText}
            </p>
          </div>

          <div className={styles.catalogMeta}>
            {itemsErr ? <span className={styles.errPill}>{itemsErr}</span> : null}
            {!loadingItems ? (
              <span className={styles.resultPill}>
                {totalCount || items.length} {ui.results}
              </span>
            ) : null}
          </div>
        </div>

        {shopCats.length ? (
          <div className={styles.catChips}>
            <button
              type="button"
              className={`${styles.catChip} ${!catSlug ? styles.catChipActive : ""}`}
              onClick={() => {
                setQText("");
                setMinPrice("");
                setMaxPrice("");
                router.push("/shop");
              }}
            >
              {ui.all}
            </button>

            {shopCats.map((c) => {
              const children = allCategories
                .filter((x) => x.parentId === c.id)
                .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));

              const isRootActive = activeRootSlug === c.slug || catSlug === c.slug;
              const isMobileOpened = mobileOpenCatId === c.id;

              return (
                <div key={c.id} className={styles.catChipWrap}>
                  <button
                    type="button"
                    className={`${styles.catChip} ${isRootActive ? styles.catChipActive : ""}`}
                    onClick={() => {
                      if (children.length && typeof window !== "undefined" && window.innerWidth <= 768) {
                        setMobileOpenCatId((prev) => (prev === c.id ? "" : c.id));
                        return;
                      }

                      setMobileOpenCatId("");
                      router.push(`/shop?cat=${encodeURIComponent(c.slug)}`);
                    }}
                  >
                    <span>{categoryLabelByLoc(loc, c.name, c.slug)}</span>

                    {children.length ? (
                      <span
                        className={`${styles.catArrow} ${isMobileOpened ? styles.catArrowOpen : ""}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>

                  {children.length ? (
                    <div className={styles.catDropdown}>
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={styles.catDropItem}
                          onClick={() => {
                            setMobileOpenCatId("");
                            router.push(`/shop?cat=${encodeURIComponent(child.slug)}`);
                          }}
                        >
                          {categoryLabelByLoc(loc, child.name, child.slug)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

        ) : null}
        {mobileSubCats.length > 0 ? (
          <div className={styles.mobileSubCatPanel}>
            <button
              type="button"
              className={`${styles.mobileSubCatItem} ${catSlug === selectedRootCat?.slug ? styles.mobileSubCatItemActive : ""
                }`}
              onClick={() => {
                setMobileOpenCatId("");
                if (selectedRootCat?.slug) {
                  router.push(`/shop?cat=${encodeURIComponent(selectedRootCat.slug)}`);
                }
              }}
            >
              {ui.all}
            </button>

            {mobileSubCats.map((child) => (
              <button
                key={child.id}
                type="button"
                className={`${styles.mobileSubCatItem} ${catSlug === child.slug ? styles.mobileSubCatItemActive : ""
                  }`}
                onClick={() => {
                  setMobileOpenCatId("");
                  router.push(`/shop?cat=${encodeURIComponent(child.slug)}`);
                }}
              >
                {categoryLabelByLoc(loc, child.name, child.slug)}
              </button>
            ))}
          </div>
        ) : null}
        {loadingItems ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skCard}>
                <div className={styles.skImg} />
                <div className={styles.skLine} />
                <div className={styles.skLine2} />
                <div className={styles.skBtnRow}>
                  <div className={styles.skBtn} />
                  <div className={styles.skBtn} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>{ui.notFoundTitle}</div>
              <div className={styles.emptySub}>{ui.notFoundSub}</div>
              <div className={styles.emptyBtns}>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    setQText("");
                    setMinPrice("");
                    setMaxPrice("");
                    router.push("/shop");
                  }}
                >
                  {ui.clearSearch}
                </button>
                <Link className={styles.ghostBtn} href="/shop">
                  {ui.allProducts}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {displayedItems.map((p) => {
                const { price: resolvedPrice, compareAtPrice } = resolveProductPriceTRY(p, rates);
                const canBuy = Number(p.stock ?? 0) > 0;
                const alertOn = !!alertMap[p.id];
                const alertBusy = alertBusyId === p.id;

                return (
                  <article
                    key={p.id}
                    className={`${styles.pCard} ${cartPulseId === p.id ? styles.pCardPulse : ""} ${!canBuy ? styles.pCardOut : ""}`}
                  >
                    <Link
                      href={`/products/${encodeURIComponent(p.slug)}`}
                      className={styles.pMediaLink}
                    >
                      <div className={`${styles.pImgWrap} ${!canBuy ? styles.pImgWrapOut : ""}`}>
                        {p.images?.[0] && isUsableImageUrl(p.images[0]) ? (
                          <img
                            className={styles.pImg}
                            src={p.images[0]}
                            alt={p.title}
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src.includes(FALLBACK_PRODUCT_LOGO)) return;
                              img.src = FALLBACK_PRODUCT_LOGO;
                            }}
                          />
                        ) : (
                          <img
                            className={styles.pImg}
                            src={FALLBACK_PRODUCT_LOGO}
                            alt={p.title || "Dromocob"}
                            loading="lazy"
                          />
                        )}

                        {!canBuy ? <span className={styles.outBadge}>{ui.outOfStock}</span> : null}
                      </div>
                    </Link>

                    <div className={styles.pMeta}>
                      <div className={styles.pNameWrap}>
                        <Link
                          href={`/products/${encodeURIComponent(p.slug)}`}
                          className={styles.pTitle}
                          title={p.title}
                        >
                          {p.title}
                        </Link>

                        {p.sku ? (
                          <div className={styles.pSku}>{ui.productCode} {p.sku}</div>
                        ) : null}
                      </div>

                      <div className={styles.pBottom}>
                        <div className={styles.pPriceBox}>
                          <div className={styles.pPriceLabel}>{ui.salePrice}</div>

                          {compareAtPrice ? (
                            <div className={styles.pComparePrice}>
                              {moneyTR(compareAtPrice, p.currency || "TRY")}
                            </div>
                          ) : null}

                          <div className={styles.pPrice}>
                            {moneyTR(resolvedPrice, p.currency || "TRY")}
                          </div>
                        </div>
                      </div>

                      <div className={styles.pActionRow}>
                        {canBuy ? (
                          <button
                            type="button"
                            className={styles.cartBtn}
                            onClick={(e) => {
                              handleAddToCart(e, p);
                            }}
                          >
                            {ui.addToCart}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.cartBtn} ${styles.notifyBtn} ${alertOn ? styles.notifyBtnActive : ""}`}
                            onClick={() => createStockAlert(p)}
                            disabled={alertBusy || alertOn}
                          >
                            {alertBusy
                              ? "Kaydediliyor..."
                              : alertOn
                                ? "Bildirim Aktif"
                                : "Gelince Haber Ver"}
                          </button>
                        )}

                        <Link
                          href={`/products/${encodeURIComponent(p.slug)}`}
                          className={styles.detailBtn}
                        >
                          {ui.review}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore ? (
              <div className={styles.loadMoreWrap}>
                <button
                  type="button"
                  className={styles.loadMoreBtn}
                  onClick={() => setVisibleCount(mixedItems.length)}
                >
                  {ui.showMore}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
