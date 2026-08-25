"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/styles/account-header.module.css";

export default function AccountHeader({
  title,
  breadcrumbHome,
  onAddAddress,
  onLogout,
  canWrite,
  lockMsg,
  adminButton,
}: {
  title: string;
  breadcrumbHome: string;
  onAddAddress: () => void;
  onLogout: () => void;
  canWrite: boolean;
  lockMsg: string;
  adminButton?: ReactNode;
}) {
  return (
    <aside className={styles.accountSidebar}>
      <div className={styles.sidebarCard}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarBrand}>
            <div className={styles.sidebarBrandMark}>6</div>

            <div className={styles.sidebarBrandText}>
              <div className={styles.sidebarBrandName}>Dromocob</div>
              <div className={styles.sidebarBrandSub}>Premium müşteri paneli</div>
            </div>
          </div>

          <div className={styles.sidebarHero}>
            <div className={styles.sidebarKicker}>Account Center</div>
            <h1 className={styles.sidebarTitle}>{title}</h1>

            <div className={styles.sidebarBreadcrumb}>
              <Link href="/">{breadcrumbHome}</Link>
              <span className={styles.sidebarBreadcrumbSep}>›</span>
              <span>{title}</span>
            </div>
          </div>
        </div>

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarActionStack}>
          <button
            className={styles.sidebarPrimaryBtn}
            onClick={onAddAddress}
            type="button"
            disabled={!canWrite}
            title={!canWrite ? lockMsg : ""}
          >
            + Adres ekle
          </button>

          <button
            className={styles.sidebarGhostBtn}
            onClick={onLogout}
            type="button"
          >
            Çıkış
          </button>

          {adminButton ? (
            <div className={styles.sidebarAdminWrap}>{adminButton}</div>
          ) : null}
        </div>

        <div className={styles.sidebarVisual}>
          <div className={styles.sidebarVisualGlow} />
          <div className={styles.sidebarVisualCard}>
            <div className={styles.sidebarVisualMini} />
            <div className={styles.sidebarVisualMini} />
            <div className={styles.sidebarVisualMiniWide} />
          </div>
        </div>
      </div>
    </aside>
  );
}