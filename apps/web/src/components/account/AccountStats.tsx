"use client";

import styles from "@/styles/account-stats.module.css";

export default function AccountStats({
  loc,
  orderCount,
  addressCount,
  isEmailVerified,
  defaultAddressTitle,
  lastOrderText,
  lastOrderStatus,
}: {
  loc: "tr" | "en";
  orderCount: number;
  addressCount: number;
  isEmailVerified: boolean;
  defaultAddressTitle?: string;
  lastOrderText?: string;
  lastOrderStatus?: string;
}) {
  const t = {
    orders: loc === "en" ? "Orders" : "Siparişler",
    addresses: loc === "en" ? "Addresses" : "Adresler",
    security: loc === "en" ? "Security" : "Güvenlik",
    lastOrder: loc === "en" ? "Last order" : "Son sipariş",
    totalRecords: loc === "en" ? "Total records" : "Toplam kayıt",
    noDefault: loc === "en" ? "No default yet" : "Henüz varsayılan yok",
    emailVerified: loc === "en" ? "Email verified" : "E-posta doğrulandı",
    emailPending: loc === "en" ? "Email pending" : "E-posta bekliyor",
    noOrders: loc === "en" ? "No orders" : "Sipariş yok",
    verified: loc === "en" ? "Verified" : "Doğrulandı",
    pending: loc === "en" ? "Pending" : "Bekliyor",
  };

  return (
    <section className={styles.statsWrap} aria-label={loc === "en" ? "Account statistics" : "Hesap istatistikleri"}>
      <article className={styles.card}>
        <div className={styles.topRow}>
          <span className={styles.label}>{t.orders}</span>
          <span className={`${styles.badge} ${styles.badgeDark}`}>#{orderCount}</span>
        </div>
        <div className={styles.value}>{orderCount}</div>
        <div className={styles.meta}>{t.totalRecords}</div>
      </article>

      <article className={styles.card}>
        <div className={styles.topRow}>
          <span className={styles.label}>{t.addresses}</span>
          <span className={`${styles.badge} ${styles.badgeSoft}`}>{addressCount}</span>
        </div>
        <div className={styles.value}>{addressCount}</div>
        <div className={styles.meta} title={defaultAddressTitle || t.noDefault}>
          {defaultAddressTitle || t.noDefault}
        </div>
      </article>

      <article className={styles.card}>
        <div className={styles.topRow}>
          <span className={styles.label}>{t.security}</span>
          <span
            className={`${styles.badge} ${
              isEmailVerified ? styles.badgeOk : styles.badgeWarn
            }`}
          >
            {isEmailVerified ? t.verified : t.pending}
          </span>
        </div>

        <div className={styles.value}>{isEmailVerified ? "OK" : "!"}</div>

        <div className={styles.meta}>
          {isEmailVerified ? t.emailVerified : t.emailPending}
        </div>
      </article>

      <article className={`${styles.card} ${styles.cardWide}`}>
        <div className={styles.topRow}>
          <span className={styles.label}>{t.lastOrder}</span>
          {lastOrderStatus ? (
            <span className={`${styles.badge} ${styles.badgeInfo}`}>{lastOrderStatus}</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeSoft}`}>—</span>
          )}
        </div>

        <div className={styles.valueSm}>
          {lastOrderText || t.noOrders}
        </div>

        <div className={styles.meta}>
          {lastOrderStatus || "—"}
        </div>
      </article>
    </section>
  );
}