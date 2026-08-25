"use client";

import Link from "next/link";
import styles from "./LuxuryServicesStrip.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type LuxuryServiceItem = {
  title?: string | LocaleText;
  text?: string | LocaleText;
  href?: string;
};

type LuxuryServicesStripProps = {
  items?: LuxuryServiceItem[];
  loc?: "tr" | "en";
  kicker?: string;
  title?: string;
  desc?: string;
};

function pickText(v: string | LocaleText | undefined, loc: "tr" | "en") {
  if (typeof v === "string") return v.trim();
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr : tr || en;
}

export default function LuxuryServicesStrip({
  items = [],
  loc = "tr",
  kicker = "Premium Hizmetler",
  title = "Sadece ürün değil, tam deneyim",
  desc = "Müşteri güvenini yükselten servis alanlarıyla dönüşümü güçlendir.",
}: LuxuryServicesStripProps) {
  const safeItems = Array.isArray(items)
    ? items
        .map((item) => ({
          title: pickText(item?.title, loc),
          text: pickText(item?.text, loc),
          href: String(item?.href || "").trim() || "/",
        }))
        .filter((item) => item.title || item.text)
    : [];

  if (!safeItems.length) return null;

  return (
    <section className={styles.section}>
      <div className="px-container">
        <div className={styles.wrap}>
          <div className={styles.head}>
            <span className={styles.kicker}>{kicker}</span>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.desc}>{desc}</p>
          </div>

          <div className={styles.grid}>
            {safeItems.map((item, i) => (
              <Link
                key={`${item.title}-${i}`}
                href={item.href}
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.dot} />
                  <span className={styles.arrow}>→</span>
                </div>

                <h3 className={styles.cardTitle}>{item.title}</h3>

                {item.text ? (
                  <p className={styles.cardText}>{item.text}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}