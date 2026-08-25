"use client";

import Link from "next/link";
import styles from "@/styles/account-guest.module.css";

export default function AccountGuestView({
  loc,
  title,
  homeLabel,
}: {
  loc: "tr" | "en";
  title: string;
  homeLabel: string;
}) {
  return (
    <section className={styles.guestWrap}>
      <div className={styles.guestCard}>
        <div className={styles.guestBrand}>
          <div className={styles.guestMark}>6</div>

          <div className={styles.guestBrandText}>
            <div className={styles.guestBrandName}>Dromocob</div>
            <div className={styles.guestBrandSub}>
              {loc === "en" ? "Premium customer panel" : "Premium müşteri paneli"}
            </div>
          </div>
        </div>

        <div className={styles.guestBody}>
          <div className={styles.guestKicker}>
            {loc === "en" ? "Account Center" : "Hesap Merkezi"}
          </div>

          <h1 className={styles.guestTitle}>{title}</h1>

          <div className={styles.guestBreadcrumb}>
            <Link href="/">{homeLabel}</Link>
            <span className={styles.guestBreadcrumbSep}>›</span>
            <span>{title}</span>
          </div>

          <p className={styles.guestText}>
            {loc === "en"
              ? "Sign in to manage your profile, addresses, orders and security settings."
              : "Profilini, adreslerini, siparişlerini ve güvenlik ayarlarını yönetmek için giriş yap."}
          </p>

          <div className={styles.guestActions}>
            <Link href="/login" className={styles.guestPrimaryBtn}>
              {loc === "en" ? "Sign in" : "Giriş Yap"}
            </Link>

            <Link href="/register" className={styles.guestSecondaryBtn}>
              {loc === "en" ? "Register" : "Kayıt Ol"}
            </Link>
          </div>

          <div className={styles.guestNote}>
            {loc === "en" ? "Admin access is separate." : "Admin girişi ayrıdır."}
          </div>
        </div>
      </div>
    </section>
  );
}