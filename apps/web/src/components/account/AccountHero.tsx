"use client";

import styles from "@/styles/account.module.css";

export default function AccountHero({
  loc,
  name,
  isEmailVerified,
  orderCount = 0,
  addressCount = 0,
  lastOrderText = "—",
}: {
  loc: "tr" | "en";
  name: string;
  isEmailVerified: boolean;
  orderCount?: number;
  addressCount?: number;
  lastOrderText?: string;
}) {
  return (
    <section className={styles.accountHeroCompact}>
      <div className={styles.accountHeroCompactLeft}>
        <div className={styles.accountHeroCompactEyebrow}>
          {loc === "en" ? "Customer Panel" : "Müşteri Paneli"}
        </div>

        <div className={styles.accountHeroCompactTitleRow}>
          <h1 className={styles.accountHeroCompactTitle}>
            {loc === "en" ? "Welcome, " : "Hoş geldin, "}
            <span className={styles.accountHeroCompactName}>{name}</span>
          </h1>

          <span
            className={`${styles.accountHeroCompactStatus} ${
              isEmailVerified
                ? styles.accountHeroCompactStatusOk
                : styles.accountHeroCompactStatusWarn
            }`}
          >
            {isEmailVerified
              ? loc === "en"
                ? "Verified"
                : "Doğrulandı"
              : loc === "en"
              ? "Verification Required"
              : "Doğrulama Gerekli"}
          </span>
        </div>
      </div>

      <div className={styles.accountHeroCompactStats}>
        <div className={styles.accountHeroCompactStat}>
          <span>{loc === "en" ? "Orders" : "Sipariş"}</span>
          <strong>{orderCount}</strong>
        </div>

        <div className={styles.accountHeroCompactStat}>
          <span>{loc === "en" ? "Addresses" : "Adres"}</span>
          <strong>{addressCount}</strong>
        </div>

        <div
          className={`${styles.accountHeroCompactStat} ${styles.accountHeroCompactStatWide}`}
        >
          <span>{loc === "en" ? "Last Order" : "Son Sipariş"}</span>
          <strong>{lastOrderText}</strong>
        </div>
      </div>
    </section>
  );
}