"use client";

import Link from "next/link";
import styles from "./LifestyleEducationHub.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type EducationItem = {
  title?: string | LocaleText;
  text?: string | LocaleText;
  href?: string;
};

type LifestyleEducationHubProps = {
  items?: EducationItem[];
  loc?: "tr" | "en";
  kicker?: string;
  title?: string;
  allLabel?: string;
  allHref?: string;
};

function pickText(v: string | LocaleText | undefined, loc: "tr" | "en") {
  if (typeof v === "string") return v.trim();
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr : tr || en;
}

export default function LifestyleEducationHub({
  items = [],
  loc = "tr",
  kicker = "Bilgilendirici İçerikler",
  title = "Satıştan önce güven ver",
  allLabel = "Tüm rehberler →",
  allHref = "",
}: LifestyleEducationHubProps) {
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
        <div className={styles.top}>
          <div>
            <span className={styles.kicker}>{kicker}</span>
            <h2 className={styles.title}>{title}</h2>
          </div>

          <Link href={allHref} className={styles.linkAll}>
            {allLabel}
          </Link>
        </div>

        <div className={styles.grid}>
          {safeItems.map((item, i) => (
            <Link
              key={`${item.title}-${i}`}
              href={item.href}
              className={styles.card}
            >
              <div className={styles.iconBox}>◎</div>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              {item.text ? <p className={styles.cardText}>{item.text}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
