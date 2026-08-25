"use client";

import { useMemo } from "react";
import Link from "next/link";
import ProductGrid from "@/components/home/ProductGrid";
import styles from "./PopularProductsStrip.module.css";

type PopTabUI = {
  key: string;
  label?: any;
  order?: number;
  limit?: number;
  isActive?: boolean;
};

type Props = {
  loc: "tr" | "en";
  title: string;
  desc: string;
  eyebrow?: string;
  tabs: PopTabUI[];
  activeKey: string;
  onChangeTab: (key: string) => void;
  items: any[];
  loading?: boolean;
};

const MAX_VISIBLE_ITEMS = 30;

function s(v: any) {
  return String(v ?? "").trim();
}

function pickTabLabel(tb: any, loc: "tr" | "en") {
  const raw = tb?.label ?? tb?.title ?? tb?.name ?? tb?.key ?? "";

  if (typeof raw === "string") return raw.trim();

  if (raw && typeof raw === "object") {
    const v = String(raw?.[loc] ?? raw?.tr ?? raw?.en ?? "").trim();
    return v || s(tb?.key);
  }

  return s(tb?.key);
}

function getProductCategoryKey(item: any) {
  const categoryObj =
    item?.category && typeof item.category === "object" && !Array.isArray(item.category)
      ? item.category
      : null;

  const candidates = [
    item?.mainCategorySlug,
    item?.mainCategory,
    item?.categorySlug,
    item?.categoryId,
    item?.categoryKey,
    item?.categoryName,

    Array.isArray(item?.categorySlugs) ? item.categorySlugs[0] : "",
    Array.isArray(item?.categoryIds) ? item.categoryIds[0] : "",

    Array.isArray(item?.categories) ? item.categories[0] : "",
    Array.isArray(item?.categoryList) ? item.categoryList[0] : "",

    categoryObj?.slug,
    categoryObj?.id,
    categoryObj?.key,
    categoryObj?.name,
  ];

  const found = candidates
    .map((x) => {
      if (typeof x === "string" || typeof x === "number") return s(x);
      return "";
    })
    .find(Boolean);

  return found || "uncategorized";
}

function interleaveByCategory(list: any[], max = MAX_VISIBLE_ITEMS) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const buckets = new Map<string, any[]>();

  for (const item of list) {
    const key = getProductCategoryKey(item);

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key)!.push(item);
  }

  const bucketEntries = Array.from(buckets.entries())
    .filter(([, arr]) => arr.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0], "tr"));

  if (bucketEntries.length <= 1) {
    return list.slice(0, max);
  }

  const mixed: any[] = [];
  let safety = 0;

  while (mixed.length < max && bucketEntries.some(([, arr]) => arr.length > 0)) {
    for (const [, bucket] of bucketEntries) {
      const item = bucket.shift();

      if (item) {
        mixed.push(item);
      }

      if (mixed.length >= max) break;
    }

    safety += 1;
    if (safety > 500) break;
  }

  return mixed.filter(Boolean);
}
export default function PopularProductsStrip({
  loc,
  title,
  desc,
  eyebrow,
  tabs,
  activeKey,
  onChangeTab,
  items,
  loading = false,
}: Props) {
  const safeTabs = useMemo(() => {
    return Array.isArray(tabs)
      ? tabs
          .filter((tb) => s(tb?.key))
          .filter((tb) => tb?.isActive !== false)
          .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
      : [];
  }, [tabs]);

  const resolvedActiveKey = useMemo(() => {
    if (!safeTabs.length) return "";
    const exists = safeTabs.some((tb) => s(tb?.key) === s(activeKey));
    return exists ? s(activeKey) : s(safeTabs[0]?.key);
  }, [safeTabs, activeKey]);

const visibleItems = useMemo(() => {
  if (!Array.isArray(items)) return [];

  return interleaveByCategory(items, MAX_VISIBLE_ITEMS);
}, [items]);

  const tabPanelId = "popular-products-panel";

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headLeft}>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.desc}>{desc}</p>
          </div>

          {safeTabs.length ? (
            <div
              className={styles.tabs}
              role="tablist"
              aria-label={loc === "en" ? "Popular product tabs" : "Popüler ürün sekmeleri"}
            >
              {safeTabs.map((tb) => {
                const key = s(tb?.key) || "all";
                const label = pickTabLabel(tb, loc) || key;
                const isActive = resolvedActiveKey === key;
                const tabId = `popular-tab-${key}`;

                return (
                  <button
                    key={key}
                    id={tabId}
                    className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={tabPanelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onChangeTab(key)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          className={styles.sliderShell}
          id={tabPanelId}
          role="tabpanel"
          aria-labelledby={resolvedActiveKey ? `popular-tab-${resolvedActiveKey}` : undefined}
        >
          <div className={styles.sliderTrack}>
            <ProductGrid
              items={visibleItems}
              loading={loading}
              mode="carousel"
              cardClassName={styles.carouselCard}
            />
          </div>
        </div>

        {!loading ? (
          <div className={styles.bottomLinkWrap}>
            <Link href="/shop" className={styles.allBtn}>
              {loc === "en" ? "View all products" : "Tüm ürünleri gör"}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}