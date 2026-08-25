"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onIdTokenChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";
import { RatesLatest, formatTRY } from "@/lib/pricing";
import { useFavorites, syncFavoritesAfterAuth } from "@/lib/favorites";
import { getCart, setQty, removeFromCart, addToCart, type CartItem } from "@/lib/cart";
import {
  syncCartLogin,
  listenFirestoreCart,
  saveCartItemToFirestore,
  deleteCartItemFromFirestore,
} from "@/lib/cartFirestore";
import { sendVerifyCodeClient } from "@/lib/emailVerifyClient";

import HeaderBrand from "./HeaderBrand";
import HeaderNav from "./HeaderNav";
import HeaderActions from "./HeaderActions";
import MobileMenuPanel from "./MobileMenuPanel";
import SearchPanel from "./SearchPanel";
import DrawerPanel from "./DrawerPanel";
import ProfilePanel from "./ProfilePanel";
import RemoveConfirmModal from "./RemoveConfirmModal";

import s from "./styles/appHeader.module.css";

/* ---------------- Types ---------------- */
type LocaleText = { tr: string; en: string };
type NavItem = { label: LocaleText; url: string };
type SearchProduct = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  image: string;
  priceTry: number;
  stock: number;
  raw: any;
};

type BrandSettings = {
  title?: LocaleText;
  tagline?: LocaleText;
  logoUrl?: string;
  logoLink?: string;
  faviconUrl?: string;
};

type HeaderSettings = {
  brand?: {
    markText?: string;
  };
  nav?: NavItem[];
};

type SiteSettingsDoc = {
  site?: { brand?: BrandSettings };
  header?: HeaderSettings;
};

type CategoryDoc = {
  slug?: string;
  name?: any;
  title?: any;
  label?: any;
  order?: number;
  isActive?: boolean;
  showInMenu?: boolean;
  parentId?: string;
  level?: number;
  image?: string;
};

type MenuCategoryNode = {
  id: string;
  slug: string;
  name: any;
  order: number;
  parentId: string;
  level: number;
  isActive: boolean;
  showInMenu: boolean;
  children: MenuCategoryNode[];
};

function seg(x: any) {
  const v = String(x ?? "").trim();
  return v && v !== "undefined" && v !== "null" ? v : "";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function safeDocId(x: any) {
  const v = String(x ?? "").trim();
  if (!v || v.includes("/")) return "";
  return v;
}

function safeUrl(u: any) {
  const x = String(u ?? "").trim();
  if (!x) return "/";
  if (x.startsWith("http://") || x.startsWith("https://") || x.startsWith("//")) return x;
  return x.startsWith("/") ? x : `/${x}`;
}

function pickLocaleText(v: any, fallbackTR: string, fallbackEN: string): LocaleText {
  const tr = typeof v?.tr === "string" && v.tr.trim() ? v.tr : fallbackTR;
  const en = typeof v?.en === "string" && v.en.trim() ? v.en : fallbackEN;
  return { tr, en };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pickAnyLocaleText(v: any, loc: Locale, fallback = "") {
  if (typeof v === "string") return v.trim() || fallback;
  const tr = seg(v?.tr);
  const en = seg(v?.en);
  return loc === "en" ? en || tr || fallback : tr || en || fallback;
}

function normalizeSearchProduct(id: string, d: any): SearchProduct {
  const image =
    String(
      d?.image ||
        d?.mainImage ||
        d?.cover ||
        d?.thumbnail ||
        (Array.isArray(d?.images) ? d.images[0] : "") ||
        ""
    ).trim();

  const rawTitle =
    d?.title?.tr ||
    d?.title?.en ||
    d?.title ||
    d?.name?.tr ||
    d?.name?.en ||
    d?.name ||
    "Ürün";

  return {
    id,
    title: String(rawTitle || "Ürün").trim(),
    slug: String(d?.slug || id).trim(),
    sku: String(d?.sku || "").trim(),
    image,
    priceTry: Number(d?.priceTry ?? d?.price ?? 0),
    stock: Number(d?.stock ?? 0),
    raw: d,
  };
}

function buildCategoryTree(rows: Array<{ id: string; d: CategoryDoc }>): MenuCategoryNode[] {
  const map = new Map<string, MenuCategoryNode>();

  for (const row of rows) {
    const d = row.d || {};
    const id = row.id;
    const slug = seg(d.slug) || id;

    map.set(id, {
      id,
      slug,
      name: d.name ?? d.title ?? d.label ?? slug,
      order: Number(d.order ?? 9999),
      parentId: seg(d.parentId),
      level: typeof d.level === "number" ? d.level : seg(d.parentId) ? 1 : 0,
      isActive: d.isActive !== false,
      showInMenu: d.showInMenu !== false,
      children: [],
    });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    }
  }

  for (const node of map.values()) {
    node.children = node.children
      .filter((c) => c.isActive && c.showInMenu)
      .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  }

  return Array.from(map.values())
    .filter((n) => !n.parentId && n.level === 0)
    .filter((n) => n.isActive && n.showInMenu)
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

function money(v: number, loc: Locale) {
  const locale = loc === "en" ? "en-US" : "tr-TR";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" }).format(Number(v || 0));
}
function cartProductKey(it: any) {
  return (
    seg(it?.productId) ||
    seg(it?.id) ||
    seg(it?.slug)
  );
}
function cartStateSignature(items: CartItem[]) {
  return JSON.stringify(
    (Array.isArray(items) ? items : [])
      .map((x: any) => ({
        id: seg(x?.id),
        productId: seg(x?.productId),
        slug: seg(x?.slug),
        qty: Number(x?.qty || 1),
        selectedSize: seg(x?.selectedSize),
        priceTry: Number(x?.priceTry || 0),
      }))
      .sort((a, b) => {
        const ak = a.productId || a.id || a.slug;
        const bk = b.productId || b.id || b.slug;
        return ak.localeCompare(bk);
      })
  );
}

function setCartItemsIfChanged(
  nextItems: CartItem[],
  currentItems: CartItem[],
  setter: React.Dispatch<React.SetStateAction<CartItem[]>>,
  ref: React.MutableRefObject<CartItem[]>
) {
  const next = Array.isArray(nextItems) ? nextItems : [];
  const current = Array.isArray(currentItems) ? currentItems : [];

  if (cartStateSignature(next) === cartStateSignature(current)) return;

  ref.current = next;
  setter(next);
}
function dedupeCartItems(items: CartItem[]) {
  const map = new Map<string, CartItem>();

  for (const it of items || []) {
    const key = cartProductKey(it);
    if (!key) continue;

    const old = map.get(key);

    // Ölçülü olan ölçüsüze göre daha değerli.
    // İkisi varsa ölçülü olan kalsın.
    if (!old) {
      map.set(key, it);
      continue;
    }

    const oldHasSize = !!seg((old as any).selectedSize);
    const nextHasSize = !!seg((it as any).selectedSize);

    if (nextHasSize && !oldHasSize) {
      map.set(key, it);
      continue;
    }

    // İkisinde de ölçü varsa en güncel görüneni / dolu olanı koru.
    if (nextHasSize && oldHasSize) {
      map.set(key, {
        ...old,
        ...it,
        qty: Math.max(1, Number(it.qty || old.qty || 1)),
      });
      continue;
    }

    // İkisi de ölçüsüzse ilkini koru ama qty sağlam olsun.
    map.set(key, {
      ...old,
      qty: Math.max(1, Number(old.qty || 1)),
    });
  }

  return Array.from(map.values());
}
export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [_uid, setUid] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [me, setMe] = useState<any>(null);

  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [hdr, setHdr] = useState<HeaderSettings | null>(null);
  const [menuCats, setMenuCats] = useState<MenuCategoryNode[]>([]);
  const [openCatIds, setOpenCatIds] = useState<string[]>([]);

  const [rates, setRates] = useState<RatesLatest | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [favProductMap, setFavProductMap] = useState<Record<string, any>>({});
  const [productStockMap, setProductStockMap] = useState<Record<string, number>>({});
  const [userDoc, setUserDoc] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [defaultAddr, setDefaultAddr] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [recentOrder, setRecentOrder] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [stockAlertsCount, setStockAlertsCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isAdminUser, setIsAdminUser] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tab, setTab] = useState<"cart" | "wish">("cart");
const [liveProductMap, setLiveProductMap] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [q, setQ] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  const [confirmBox, setConfirmBox] = useState<{
    open: boolean;
    type: "cart" | "wish" | null;
    id: string;
    title: string;
    image?: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const confirmFocusRef = useRef<HTMLElement | null>(null);

  const isRealUser = !!me && !me.isAnonymous;
  const isEmailVerified = isRealUser && !!me?.emailVerified;

  const fav = useFavorites(isRealUser ? me?.uid : null);
 const favItemsRaw = fav?.items;

const favItems = useMemo(() => {
  return (Array.isArray(favItemsRaw) ? favItemsRaw : []) as any[];
}, [favItemsRaw]);
  const favCount = fav?.count ?? 0;

  const anyOpen = menuOpen || drawerOpen || searchOpen || profileOpen;
const productHydrateKey = useMemo(() => {
  const keys = Array.from(
    new Set(
      [
        ...cartItems.map((it: any) => seg(it?.id)),
        ...cartItems.map((it: any) => seg(it?.productId)),
        ...cartItems.map((it: any) => seg(it?.slug)),
        ...favItems.map((it: any) => seg(it?.id)),
        ...favItems.map((it: any) => seg(it?.productId)),
        ...favItems.map((it: any) => seg(it?.slug)),
      ].filter(Boolean)
    )
  ).sort();

  return keys.join("|");
}, [cartItems, favItems]);

useEffect(() => {
  if (!drawerOpen) return;
  let alive = true;

  async function loadLiveProducts() {
    if (!drawerOpen) {
      setLiveProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      setProductStockMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      setFavProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      return;
    }

    const keys = productHydrateKey
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!keys.length) {
      setLiveProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      setProductStockMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      setFavProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      return;
    }

    const nextProductMap: Record<string, any> = {};
    const nextStockMap: Record<string, number> = {};

    for (const key of keys.slice(0, 40)) {
      try {
        const byId = await getDoc(doc(db, "products", key));
        if (!alive) return;

        if (byId.exists()) {
          const data = { id: byId.id, ...(byId.data() as any) };

          nextProductMap[key] = data;
          nextProductMap[data.id] = data;
          if (data.slug) nextProductMap[String(data.slug)] = data;

          const stock = Math.max(0, Number(data?.stock ?? 0));
          nextStockMap[key] = stock;
          nextStockMap[data.id] = stock;
          if (data.slug) nextStockMap[String(data.slug)] = stock;

          continue;
        }

        const qs = await getDocs(
          query(collection(db, "products"), where("slug", "==", key))
        );

        if (!alive) return;

        if (!qs.empty) {
          const d = qs.docs[0];
          const data = { id: d.id, ...(d.data() as any) };

          nextProductMap[key] = data;
          nextProductMap[data.id] = data;
          if (data.slug) nextProductMap[String(data.slug)] = data;

          const stock = Math.max(0, Number(data?.stock ?? 0));
          nextStockMap[key] = stock;
          nextStockMap[data.id] = stock;
          if (data.slug) nextStockMap[String(data.slug)] = stock;
        }
      } catch (err) {
        console.warn("live product hydrate failed:", key, err);
      }
    }

    if (!alive) return;

    setLiveProductMap((prev) => {
      const a = JSON.stringify(prev || {});
      const b = JSON.stringify(nextProductMap || {});
      return a === b ? prev : nextProductMap;
    });

    setProductStockMap((prev) => {
      const a = JSON.stringify(prev || {});
      const b = JSON.stringify(nextStockMap || {});
      return a === b ? prev : nextStockMap;
    });

    setFavProductMap((prev) => {
      const a = JSON.stringify(prev || {});
      const b = JSON.stringify(nextProductMap || {});
      return a === b ? prev : nextProductMap;
    });
  }

  void loadLiveProducts();

  return () => {
    alive = false;
  };
}, [db, drawerOpen, productHydrateKey]);
  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setLoc(((ce?.detail as Locale) || "tr") as Locale);
    };
    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

const syncedUidRef = useRef<string | null>(null);

useEffect(() => {
  let unsubCloudCart: (() => void) | null = null;

  const unsubAuth = onIdTokenChanged(auth, async (u) => {
    setUid(u?.uid || null);
    setMe(u || null);

    if (unsubCloudCart) {
      unsubCloudCart();
      unsubCloudCart = null;
    }

    try {
      if (!u || u.isAnonymous) {
        syncedUidRef.current = null;
       setCartItemsIfChanged(
  getCart(null),
  cartItemsRef.current,
  setCartItems,
  cartItemsRef
);
        window.dispatchEvent(new Event("cart:changed"));
        return;
      }

      if (syncedUidRef.current !== u.uid) {
        await syncCartLogin(u.uid);
        await syncFavoritesAfterAuth(u.uid);
        syncedUidRef.current = u.uid;
      }

     setCartItemsIfChanged(
  getCart(u.uid),
  cartItemsRef.current,
  setCartItems,
  cartItemsRef
);

      unsubCloudCart = listenFirestoreCart(u.uid, (items) => {
  const next = dedupeCartItems(items);

  setCartItemsIfChanged(
    next,
    cartItemsRef.current,
    setCartItems,
    cartItemsRef
  );
});

      window.dispatchEvent(new Event("cart:changed"));
      window.dispatchEvent(new Event("nci_favorites_changed"));
    } catch (err) {
      console.error("auth sync error:", err);
    }
  });

  return () => {
    unsubAuth();

    if (unsubCloudCart) {
      unsubCloudCart();
      unsubCloudCart = null;
    }
  };
}, [auth]);

 useEffect(() => {
  if (!searchOpen && !drawerOpen) {
    setRates(null);
    return;
  }

  const unsub = onSnapshot(doc(db, "rates", "latest"), (snap) => {
    setRates(snap.exists() ? (snap.data() as RatesLatest) : null);
  });

  return () => unsub();
}, [db, searchOpen, drawerOpen]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (!snap.exists()) {
        setBrand(null);
        setHdr(null);
        return;
      }
      const data = snap.data() as SiteSettingsDoc;
      setBrand(data?.site?.brand ?? null);
      setHdr(data?.header ?? null);
    });
    return () => unsub();
  }, [db]);

useEffect(() => {
  if (!menuOpen) return;
  if (menuCats.length > 0) return;

  let alive = true;

  (async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      if (!alive) return;

      const rows = snap.docs.map((d) => ({
        id: d.id,
        d: d.data() as CategoryDoc,
      }));

      setMenuCats(buildCategoryTree(rows));
    } catch (err) {
      console.error("[AppHeader] categories load failed:", err);
      if (alive) setMenuCats([]);
    }
  })();

  return () => {
    alive = false;
  };
}, [db, menuOpen, menuCats.length]);

const cartItemsRef = useRef<CartItem[]>([]);

useEffect(() => {
  cartItemsRef.current = cartItems;
}, [cartItems]);

useEffect(() => {
  const refresh = () => {
    const cartUid = isRealUser ? me?.uid : null;

    const rawNext = getCart(cartUid);
    const next = dedupeCartItems(rawNext);
    const prev = cartItemsRef.current || [];

    if (rawNext.length !== next.length) {
      try {
        localStorage.setItem(
          cartUid ? `nci_cart_${cartUid}` : "nci_cart_guest",
          JSON.stringify(next)
        );
      } catch (err) {
        console.error("[AppHeader] dedupe cart local write failed:", err);
      }
    }

    const prevJson = JSON.stringify(prev);
    const nextJson = JSON.stringify(next);

    if (prevJson === nextJson) return;

    cartItemsRef.current = next;
    setCartItems(next);
  };

  refresh();

  window.addEventListener("cart:changed", refresh);
  window.addEventListener("storage", refresh);

  return () => {
    window.removeEventListener("cart:changed", refresh);
    window.removeEventListener("storage", refresh);
  };
}, [isRealUser, me?.uid]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

useEffect(() => {
  document.body.classList.toggle("sb-open", anyOpen);
  document.body.classList.toggle("nciHeaderDrawerOpen", anyOpen);

  if (!anyOpen) {
    return;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeAll();
  };

  window.addEventListener("keydown", onKey);

  return () => {
    window.removeEventListener("keydown", onKey);
    document.body.classList.remove("sb-open");
    document.body.classList.remove("nciHeaderDrawerOpen");
  };
}, [anyOpen]);

  const cartCount = cartItems.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
  const cartSubtotal = cartItems.reduce((sum, it) => sum + (Number(it.priceTry) || 0) * (Number(it.qty) || 1), 0);

  const fallbackNav: NavItem[] = [
    { label: { tr: "Anasayfa", en: "Home" }, url: "/" },
    { label: { tr: "Mağaza", en: "Shop" }, url: "/shop" },
    { label: { tr: "Hesabım", en: "My Account" }, url: "/hesabim" },
  ];

  const navBase = Array.isArray(hdr?.nav) && hdr?.nav.length ? hdr.nav : fallbackNav;
  const nav = navBase.map((it) => {
    const isAccountItem =
      it.url === "/hesabim" ||
      it.label?.tr?.toLowerCase() === "hesabım" ||
      it.label?.en?.toLowerCase() === "my account";

    if (!isAccountItem) return it;

    if (isRealUser) {
      return { ...it, label: { tr: "Profil", en: "Account" }, url: "/hesabim" };
    }

    return { ...it, label: { tr: "Giriş Yap / Kayıt Ol", en: "Login / Register" }, url: "/login" };
  });

  const L = (x: LocaleText) => (loc === "en" ? x.en : x.tr);

  const brandLogoUrl = seg(brand?.logoUrl) || "/dromocob-app-icon-192.png";
  const brandLink = safeUrl(brand?.logoLink || "/");
  const brandTitle = pickLocaleText(brand?.title, "Dromocob", "Dromocob");
  const brandMark = seg(hdr?.brand?.markText || "D");

  function closeAll() {
    setMenuOpen(false);
    setDrawerOpen(false);
    setSearchOpen(false);
    setProfileOpen(false);
  }

  function openOnly(panel: "menu" | "drawer" | "search" | "profile") {
    setMenuOpen(panel === "menu");
    setDrawerOpen(panel === "drawer");
    setSearchOpen(panel === "search");
    setProfileOpen(panel === "profile");
  }

  function openDrawer(which: "cart" | "wish") {
    setTab(which);
    openOnly("drawer");
  }

  function toggleMenuCat(id: string) {
    setOpenCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function doSignOut() {
    try {
      await signOut(auth);
      window.dispatchEvent(new Event("cart:changed"));
      window.dispatchEvent(new Event("nci_favorites_changed"));
      closeAll();
      router.push("/");
    } catch (e) {
      console.error("signOut failed", e);
    }
  }

  async function submitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim().toLocaleLowerCase("tr-TR");
    if (!term) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }

    setSearchLoading(true);
    setSearchDone(false);

    try {
      const snap = await getDocs(collection(db, "products"));
      const all = snap.docs.map((doc) => normalizeSearchProduct(doc.id, doc.data()));
      const filtered = all.filter((p) => {
        const title = String(p.title || "").toLocaleLowerCase("tr-TR");
        const slug = String(p.slug || "").toLocaleLowerCase("tr-TR");
        const sku = String(p.sku || "").toLocaleLowerCase("tr-TR");
        return title.includes(term) || slug.includes(term) || sku.includes(term);
      });

      setSearchResults(filtered.slice(0, 20));
      setSearchDone(true);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setSearchLoading(false);
    }
  }

function removeCartLocal(id: string) {
  const cartUid = isRealUser ? me?.uid : null;
  const item = cartItems.find((x) => String(x.id) === String(id));

  removeFromCart(id, cartUid);

  if (cartUid && item) {
    deleteCartItemFromFirestore(cartUid, item).catch((err) => {
      console.error("[header cart] cloud delete failed:", err);
    });
  }

  const next = getCart(cartUid);
  setCartItems(next);
  cartItemsRef.current = next;

  window.dispatchEvent(new Event("cart:changed"));
}

  function removeFavLocal(id: string) {
    (fav as any)?.remove?.(id);
    (fav as any)?.removeById?.(id);
  }

  function openRemoveConfirm(type: "cart" | "wish", id: string, title: string, image?: string) {
    confirmFocusRef.current = document.activeElement as HTMLElement | null;
    setConfirmBox({ open: true, type, id, title, image });
  }

  function closeRemoveConfirm() {
    setConfirmBox(null);
    setTimeout(() => {
      confirmFocusRef.current?.focus?.();
      confirmFocusRef.current = null;
    }, 0);
  }

  function confirmRemoveNow() {
    if (!confirmBox?.id || !confirmBox?.type) return;
    if (confirmBox.type === "cart") removeCartLocal(confirmBox.id);
    if (confirmBox.type === "wish") removeFavLocal(confirmBox.id);
    closeRemoveConfirm();
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.inner}>
          <HeaderBrand
            brandLink={brandLink}
            brandLogoUrl={brandLogoUrl}
            brandMark={brandMark}
            brandTitle={L(brandTitle)}
            onOpenMenu={() => openOnly("menu")}
          />

          <HeaderNav nav={nav} pathname={pathname || "/"} L={L} />

          <HeaderActions
            cartCount={cartCount}
            wishCount={favCount}
            onOpenSearch={() => openOnly("search")}
            onOpenWish={() => openDrawer("wish")}
            onOpenCart={() => openDrawer("cart")}
            onOpenProfile={() => openOnly("profile")}
            languageToggle={<LanguageToggle />}
          />
        </div>
      </header>

      <div className={`${s.backdrop} ${anyOpen ? s.open : ""}`} onClick={closeAll} />

     {menuOpen ? (
  <MobileMenuPanel
    open={menuOpen}
    loc={loc}
    brandLink={brandLink}
    brandLogoUrl={brandLogoUrl}
    brandMark={brandMark}
    brandTitle={L(brandTitle)}
    nav={nav}
    menuCats={menuCats}
    openCatIds={openCatIds}
    onToggleCat={toggleMenuCat}
    onClose={closeAll}
    isRealUser={isRealUser}
  />
) : null}

      {searchOpen ? (
  <SearchPanel
    open={searchOpen}
    loc={loc}
    q={q}
    setQ={setQ}
    searchLoading={searchLoading}
    searchDone={searchDone}
    searchResults={searchResults}
    rates={rates}
    onSubmit={submitSearch}
    onClose={() => setSearchOpen(false)}
    searchInputRef={searchInputRef}
    onAddToCart={(item, price) => {
      const cartUid = isRealUser ? me?.uid : null;

      const cartItem: CartItem = {
        id: item.id,
        productId: item.id,
        title: item.title,
        priceTry: Number(price) || 0,
        image: item.image || "",
        slug: item.slug,
        qty: 1,
        stock: Number(item.stock || 0),
      };

      addToCart(cartItem, cartUid);

      if (cartUid) {
        saveCartItemToFirestore(cartUid, cartItem).catch((err) => {
          console.error("[header search cart] cloud save failed:", err);
        });
      }

      window.dispatchEvent(new Event("cart:changed"));
    }}
    formatTRY={formatTRY}
  />
) : null}

      {drawerOpen ? (
  <DrawerPanel
    open={drawerOpen}
    loc={loc}
    tab={tab}
    setTab={setTab}
    cartItems={cartItems}
    favItems={favItems}
    favProductMap={favProductMap}
    rates={rates}
    productStockMap={productStockMap}
    cartCount={cartCount}
    wishCount={favCount}
    cartSubtotal={cartSubtotal}
    money={money}
    onClose={() => setDrawerOpen(false)}
    onRemoveCart={openRemoveConfirm}
    onRemoveWish={openRemoveConfirm}
    onIncQty={(id, qty) => {
      const cartUid = isRealUser ? me?.uid : null;
      const item = cartItems.find((x) => String(x.id) === String(id));
      const nextQty = qty + 1;

      setQty(id, nextQty, cartUid);

      if (cartUid && item) {
        saveCartItemToFirestore(cartUid, {
          ...item,
          qty: nextQty,
        }).catch((err) => {
          console.error("[header cart] cloud qty inc failed:", err);
        });
      }
    }}
    onDecQty={(id, qty) => {
      const cartUid = isRealUser ? me?.uid : null;
      const item = cartItems.find((x) => String(x.id) === String(id));

      if (qty <= 1) {
        removeCartLocal(id);
        return;
      }

      const nextQty = qty - 1;

      setQty(id, nextQty, cartUid);

      if (cartUid && item) {
        saveCartItemToFirestore(cartUid, {
          ...item,
          qty: nextQty,
        }).catch((err) => {
          console.error("[header cart] cloud qty dec failed:", err);
        });
      }
    }}
  />
) : null}
      {profileOpen ? (
  <ProfilePanel
    open={profileOpen}
    loc={loc}
    me={me}
    isRealUser={isRealUser}
    isEmailVerified={isEmailVerified}
    isAdminUser={isAdminUser}
    userDoc={userDoc}
    defaultAddr={defaultAddr}
    recentOrder={recentOrder}
    stockAlertsCount={stockAlertsCount}
    cartCount={cartCount}
    wishCount={favCount}
    cartSubtotal={cartSubtotal}
    onClose={() => setProfileOpen(false)}
    onSignOut={doSignOut}
    onSendVerify={async () => {
      await sendVerifyCodeClient();
      closeAll();
      router.push("/verify-email");
    }}
    money={money}
  />
) : null}

      <RemoveConfirmModal
        open={!!confirmBox?.open}
        loc={loc}
        confirmBox={confirmBox}
        onClose={closeRemoveConfirm}
        onConfirm={confirmRemoveNow}
      />
    </>
  );
}
