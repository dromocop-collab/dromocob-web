"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/useT";
import styles from "./budgetShopping.module.css";

type BudgetRange = {
  label: { tr: string; en: string };
  note: { tr: string; en: string };
  minPrice?: number;
  maxPrice?: number;
};

const DEFAULT_RANGES: BudgetRange[] = [
  { label: { tr: "5.000 TL Altı", en: "Under TRY 5,000" }, note: { tr: "Zarif başlangıçlar", en: "Elegant beginnings" }, maxPrice: 5000 },
  { label: { tr: "5.000 – 15.000 TL", en: "TRY 5,000 – 15,000" }, note: { tr: "Günlük şıklık", en: "Everyday refinement" }, minPrice: 5000, maxPrice: 15000 },
  { label: { tr: "15.000 – 50.000 TL", en: "TRY 15,000 – 50,000" }, note: { tr: "Seçkin tasarımlar", en: "Signature designs" }, minPrice: 15000, maxPrice: 50000 },
  { label: { tr: "50.000 TL Üzeri", en: "Over TRY 50,000" }, note: { tr: "Yüksek özel ürün", en: "Fine lifestyle" }, minPrice: 50000 },
];

type Props = {
  cfg?: {
    enabled?: boolean;
    title?: { tr?: string; en?: string };
    text?: { tr?: string; en?: string };
    ranges?: Array<{ label?: { tr?: string; en?: string }; minPrice?: number; maxPrice?: number }>;
  } | null;
};

export default function BudgetShopping({ cfg }: Props) {
  const loc = useLocale();
  if (cfg?.enabled === false) return null;

  const title = (loc === "en" ? cfg?.title?.en : cfg?.title?.tr) || (loc === "en" ? "A piece for every moment" : "Her ana yakışan bir parça");
  const text = (loc === "en" ? cfg?.text?.en : cfg?.text?.tr) || (loc === "en"
    ? "Explore a considered selection shaped around your style and budget."
    : "Tarzınıza ve bütçenize göre özenle ayrılmış seçkin koleksiyonu keşfedin.");

  const ranges = DEFAULT_RANGES.map((fallback, index) => {
    const configured = cfg?.ranges?.[index];
    return {
      ...fallback,
      ...(configured?.label ? { label: { tr: configured.label.tr || fallback.label.tr, en: configured.label.en || fallback.label.en } } : {}),
      ...(typeof configured?.minPrice === "number" ? { minPrice: configured.minPrice } : {}),
      ...(typeof configured?.maxPrice === "number" ? { maxPrice: configured.maxPrice } : {}),
    };
  });

  return (
    <section className={styles.section} aria-labelledby="budget-shopping-title">
      <div className={styles.frame}>
        <Image
          src="/home/budget-lifestyle-editorial-v1.jpg"
          alt={loc === "en" ? "A curated lifestyle collection" : "Seçkin yaşam tarzı koleksiyonu"}
          fill
          sizes="(max-width: 900px) 100vw, 1400px"
          className={styles.image}
        />
        <div className={styles.overlay} />

        <div className={styles.content}>
          <span className={styles.eyebrow}>{loc === "en" ? "Curated by budget" : "Bütçenize göre seçildi"}</span>
          <h2 id="budget-shopping-title" className={styles.title}>{title}</h2>
          <p className={styles.text}>{text}</p>
          <Link href="/shop" className={styles.allLink}>
            {loc === "en" ? "Explore the collection" : "Koleksiyonu keşfet"}<ArrowUpRight size={17} />
          </Link>
        </div>

        <nav className={styles.rangeNav} aria-label={loc === "en" ? "Shop by price range" : "Fiyat aralığına göre alışveriş"}>
          {ranges.map((range, index) => {
            const params = new URLSearchParams();
            if (range.minPrice) params.set("minPrice", String(range.minPrice));
            if (range.maxPrice) params.set("maxPrice", String(range.maxPrice));
            return (
              <Link key={`${range.label.tr}-${index}`} href={`/shop?${params.toString()}`} className={styles.rangeLink}>
                <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.rangeCopy}>
                  <small>{loc === "en" ? range.note.en : range.note.tr}</small>
                  <strong>{loc === "en" ? range.label.en : range.label.tr}</strong>
                </span>
                <ArrowUpRight className={styles.arrow} size={18} />
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
