"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { useT } from "@/lib/useT";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import s from "./CategoryBarMega.module.css";

const MOBILE_BP = 920;
const FALLBACK_PRODUCT_LOGO = "/dromocob-mark.svg";

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
};

type CategoryNode = {
  id: string;
  slug: string;
  name: any;
  order: number;
  isActive: boolean;
  showInMenu: boolean;
  parentId: string;
  level: number;
  children: CategoryNode[];
};

type ProductMini = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  price?: number;
  compareAtPrice?: number | null;
};

function str(v: unknown) {
  return String(v ?? "").trim();
}

function isUsableImage(v: string) {
  const x = str(v);
  return /^https?:\/\//i.test(x) || x.startsWith("/");
}

function isMobileNow() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= MOBILE_BP;
}

function formatTRY(v?: number) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₺${n}`;
  }
}

export default function CategoryBarMega() {
  const { loc } = useT();
  const db = useMemo(() => getFirebaseDb(), []);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [roots, setRoots] = useState<CategoryNode[]>([]);
  const [openRootId, setOpenRootId] = useState("");
  const [activeCatId, setActiveCatId] = useState("");
  const [previews, setPreviews] = useState<Record<string, ProductMini[]>>({});
  const [loadingCatId, setLoadingCatId] = useState("");
  const [ratesDoc, setRatesDoc] = useState<RatesLatest | null>(null);

  // Kurları çek (mega menü fiyatları için)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { doc: docRef, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(docRef(db, "rates", "latest"));
        if (!alive) return;
        setRatesDoc(snap.exists() ? (snap.data() as RatesLatest) : null);
      } catch (e) {
        console.error("rates load error (mega):", e);
      }
    })();

    return () => { alive = false; };
  }, [db]);

  const ui = useMemo(
    () => ({
      product: loc === "en" ? "Product" : "Ürün",
      collection: loc === "en" ? "Collection" : "Koleksiyon",
      subcategories: loc === "en" ? "Subcategories" : "Alt kategoriler",
      categoryContent: loc === "en" ? "Category content" : "Kategori içeriği",
      all: loc === "en" ? "All" : "Tümü",
      openCategory: loc === "en" ? "Open category" : "Kategoriyi aç",
      selectedArea: loc === "en" ? "Selected area" : "Seçili alan",
      category: loc === "en" ? "Category" : "Kategori",
      productsSuffix: loc === "en" ? "products" : "ürünleri",
      loading: loc === "en" ? "Loading…" : "Yükleniyor…",
      close: loc === "en" ? "Close" : "Kapat",
      emptyCategory:
        loc === "en"
          ? "No products to show in this category."
          : "Bu kategoride gösterilecek ürün yok.",
    }),
    [loc]
  );

  const closeMegaMenu = useCallback(() => {
    setOpenRootId("");
    setActiveCatId("");
  }, []);
useEffect(() => {
  if (typeof window === "undefined") return;

  const isMegaOpen = Boolean(openRootId);
  const isMobileScreen = window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;

  if (!isMegaOpen || !isMobileScreen) {
    document.documentElement.classList.remove("nci-category-mega-open");
    document.body.classList.remove("nci-category-mega-open");
    return;
  }

  const scrollY = window.scrollY || window.pageYOffset || 0;

  document.documentElement.classList.add("nci-category-mega-open");
  document.body.classList.add("nci-category-mega-open");
  document.body.dataset.categoryMegaScrollY = String(scrollY);

  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";

  return () => {
    const y = document.body.dataset.categoryMegaScrollY;

    document.documentElement.classList.remove("nci-category-mega-open");
    document.body.classList.remove("nci-category-mega-open");

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";

    if (y) {
      window.scrollTo(0, Number(y));
      delete document.body.dataset.categoryMegaScrollY;
    }
  };
}, [openRootId]);
  const catLabel = useCallback(
    (name: any, fallback: string) => {
      if (!name) return fallback;
      if (typeof name === "string") return str(name) || fallback;

      const tr = str(name?.tr);
      const en = str(name?.en);
      const titleTr = str(name?.title?.tr);
      const titleEn = str(name?.title?.en);
      const labelTr = str(name?.label?.tr);
      const labelEn = str(name?.label?.en);

      if (loc === "en") {
        return en || titleEn || labelEn || tr || titleTr || labelTr || fallback;
      }

      return tr || titleTr || labelTr || en || titleEn || labelEn || fallback;
    },
    [loc]
  );

  const buildTree = useCallback((rows: Array<{ id: string; d: CategoryDoc }>) => {
    const map = new Map<string, CategoryNode>();

    for (const r of rows) {
      const d = r.d || {};
      const id = r.id;
      const slug = str(d.slug) || id;
      const parentId = str(d.parentId);

      map.set(id, {
        id,
        slug,
        name: d.name ?? d.title ?? d.label ?? slug,
        order: Number(d.order ?? 9999),
        isActive: d.isActive !== false,
        showInMenu: d.showInMenu !== false,
        parentId,
        level: typeof d.level === "number" ? d.level : parentId ? 1 : 0,
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
        .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug, "tr"));
    }

    return Array.from(map.values())
      .filter((n) => !n.parentId && n.level === 0)
      .filter((n) => n.isActive && n.showInMenu)
      .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug, "tr"));
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadCategories() {
      try {
        const qref = query(collection(db, "categories"), orderBy("order", "asc"));
        const snap = await getDocs(qref);

        if (!alive) return;

        const rows = snap.docs.map((d) => ({
          id: d.id,
          d: d.data() as CategoryDoc,
        }));

        setRoots(buildTree(rows));
      } catch (e) {
        console.error("categories load error:", e);
        if (alive) setRoots([]);
      }
    }

    loadCategories();

    return () => {
      alive = false;
    };
  }, [db, buildTree]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      const target = e.target;

      if (!el || !(target instanceof Node)) return;

      if (!el.contains(target)) {
        closeMegaMenu();
      }
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [closeMegaMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMegaMenu();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMegaMenu]);

  useEffect(() => {
    setPreviews({});
    setLoadingCatId("");
  }, [loc]);

  async function ensurePreview(catId: string) {
    if (!catId || previews[catId]) return;

    setLoadingCatId(catId);

    try {
      const constraints: QueryConstraint[] = [
        where("categoryIds", "array-contains", catId),
        limit(8),
      ];

      const qref = query(collection(db, "products"), ...constraints);
      const snap = await getDocs(qref);

      const list: ProductMini[] = snap.docs.map((d) => {
        const x: any = d.data();

        const imgs = Array.isArray(x?.images)
          ? x.images
          : x?.image
          ? [x.image]
          : x?.mainImage
          ? [x.mainImage]
          : [];

        const image =
          imgs.find((u: any) => isUsableImage(String(u))) ||
          str(x?.image) ||
          str(x?.mainImage) ||
          FALLBACK_PRODUCT_LOGO;

        const rawTitle =
          x?.title?.[loc] ??
          x?.title?.tr ??
          x?.title?.en ??
          x?.title ??
          x?.name?.[loc] ??
          x?.name?.tr ??
          x?.name?.en ??
          x?.name ??
          ui.product;

        return {
          id: d.id,
          slug: str(x?.slug) || d.id,
          title: str(rawTitle),
          image,
          price: 0,
          compareAtPrice: null as number | null,
          _raw: x, // pricing hesabı için ham veri
        };
      });

      // Fiyatları resolveProductPriceTRY ile hesapla
      const withPrices = list.map((p: any) => {
        const raw = p._raw;
        const resolved = resolveProductPriceTRY(raw, ratesDoc);
        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          image: p.image,
          price: resolved.price > 0 ? resolved.price : (Number(raw?.finalPrice ?? raw?.price ?? 0) || 0),
          compareAtPrice: resolved.compareAtPrice,
        };
      });

      const shuffled = [...withPrices].sort(() => Math.random() - 0.5).slice(0, 4);
      setPreviews((prev) => ({ ...prev, [catId]: shuffled }));
    } catch (e) {
      console.error("preview products error:", e);
      setPreviews((prev) => ({ ...prev, [catId]: [] }));
    } finally {
      setLoadingCatId("");
    }
  }

  const openRoot = roots.find((r) => r.id === openRootId);
  const activeSub = openRoot?.children.find((x) => x.id === activeCatId);
  const effectiveCatId = activeCatId || openRoot?.id || "";
  const effectiveList = effectiveCatId ? previews[effectiveCatId] || [] : [];

  function openRootNow(root: CategoryNode) {
    setOpenRootId(root.id);
    setActiveCatId("");
    void ensurePreview(root.id);
  }

  function hoverSubNow(sub: CategoryNode) {
    setActiveCatId(sub.id);
    void ensurePreview(sub.id);
  }

  function goToCategory(slug: string) {
    closeMegaMenu();
    router.push(`/shop?cat=${encodeURIComponent(slug)}`);
  }

  function handleRootClick(root: CategoryNode) {
    if (openRootId === root.id) {
      closeMegaMenu();
      return;
    }

    openRootNow(root);
  }

  return (
    <div ref={wrapRef} className={s.wrap}>
      <div className={s.bar}>
        {roots.slice(0, 10).map((root) => {
          const active = openRootId === root.id;

          return (
            <button
              key={root.id}
              type="button"
              className={`${s.item} ${active ? s.active : ""}`}
              onMouseEnter={() => {
                if (!isMobileNow()) openRootNow(root);
              }}
              onClick={() => handleRootClick(root)}
              aria-expanded={active}
            >
              <span className={s.linkText}>{catLabel(root.name, root.slug)}</span>
              <span className={s.chev} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {openRoot ? (
        <div
          className={`${s.dropdown} ${openRootId ? s.dropdownOpen : ""}`}
          onMouseEnter={() => {
            if (!isMobileNow()) setOpenRootId(openRoot.id);
          }}
          onMouseLeave={() => {
            if (!isMobileNow()) closeMegaMenu();
          }}
        >
          <button
            type="button"
            className={s.mobileCloseBtn}
            onClick={closeMegaMenu}
            aria-label={ui.close}
          >
            ×
          </button>

          <div className={s.ddInner}>
            <aside className={s.ddLeft}>
              <div className={s.ddLeftTop}>
                <div className={s.ddEyebrow}>{ui.collection}</div>
                <div className={s.ddTitle}>{catLabel(openRoot.name, openRoot.slug)}</div>
                <div className={s.ddCaption}>
                  {openRoot.children?.length ? ui.subcategories : ui.categoryContent}
                </div>
              </div>

              <div className={s.subList}>
                

                {openRoot.children.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={`${s.subItem} ${activeCatId === sub.id ? s.subItemActive : ""}`}
                    onMouseEnter={() => {
                      if (!isMobileNow()) hoverSubNow(sub);
                    }}
                    onClick={() => {
                      if (isMobileNow()) {
                        setActiveCatId(sub.id);
                        void ensurePreview(sub.id);
                        return;
                      }

                      goToCategory(sub.slug);
                    }}
                  >
                    <span>{catLabel(sub.name, sub.slug)}</span>
                    <i>→</i>
                  </button>
                ))}
              </div>

              <Link
                className={s.more}
                href={`/shop?cat=${encodeURIComponent(activeSub?.slug || openRoot.slug)}`}
                onClick={closeMegaMenu}
              >
                {ui.openCategory}
                <span>→</span>
              </Link>
            </aside>

            <section className={s.ddRight}>
              <div className={s.rightHead}>
                <div>
                  <div className={s.rightKicker}>{ui.selectedArea}</div>
                  <div className={s.rightTitle}>
                    {activeCatId
                      ? catLabel(activeSub?.name, ui.category)
                      : `${catLabel(openRoot.name, openRoot.slug)} ${ui.productsSuffix}`}
                  </div>
                </div>

                <button
                  type="button"
                  className={s.rightOpenBtn}
                  onClick={() => goToCategory(activeSub?.slug || openRoot.slug)}
                >
                  {ui.openCategory}
                </button>
              </div>

              <div className={s.ddGrid}>
                {loadingCatId === effectiveCatId && effectiveList.length === 0 ? (
                  <div className={s.stateBox}>{ui.loading}</div>
                ) : effectiveList.length === 0 ? (
                  <div className={s.stateBox}>{ui.emptyCategory}</div>
                ) : (
                  effectiveList.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${encodeURIComponent(p.slug)}`}
                      className={s.pCard}
                      onClick={closeMegaMenu}
                    >
                      <div className={s.pImg}>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.title}
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_PRODUCT_LOGO;
                            }}
                          />
                        ) : (
                          <div className={s.pImgPh}>✦</div>
                        )}
                      </div>

                      <div className={s.pMeta}>
                        <div className={s.pTitle}>{p.title}</div>
                        {p.price ? (
                          <div className={s.pPriceWrap}>
                            {p.compareAtPrice && p.compareAtPrice > p.price ? (
                              <span className={s.pOldPrice}>{formatTRY(p.compareAtPrice)}</span>
                            ) : null}
                            <span className={p.compareAtPrice && p.compareAtPrice > p.price ? s.pSalePrice : s.pPrice}>
                              {formatTRY(p.price)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}