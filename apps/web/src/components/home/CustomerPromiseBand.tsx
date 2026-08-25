"use client";

import styles from "./CustomerPromiseBand.module.css";

type CustomerPromiseBandProps = {
  items?: string[];
};

export default function CustomerPromiseBand({
  items = [],
}: CustomerPromiseBandProps) {
  const safeItems = Array.isArray(items)
    ? items.map((x) => String(x || "").trim()).filter(Boolean)
    : [];

  if (!safeItems.length) return null;

  return (
    <section className={styles.section}>
      <div className="px-container">
        <div className={styles.wrap}>
          {safeItems.map((item, i) => (
            <div key={`${item}-${i}`} className={styles.item}>
              <span className={styles.dot} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}