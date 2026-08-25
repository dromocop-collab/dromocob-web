"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/styles/account-sidebar.module.css";
import type { AccountTab } from "@/components/account/types";

type Props = {
  loc: "tr" | "en";
  tab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  title: string;
  breadcrumbHome: string;
  onLogout: () => void;
  adminButton?: ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
};

type TabItem = {
  key: AccountTab;
  label: string;
  desc: string;
  icon: string;
};

export default function AccountSidebar({
  loc,
  tab,
  onTabChange,
  title,
  breadcrumbHome,
  onLogout,
  adminButton,
  isOpen = false,
  onClose,
}: Props) {
  const tabs: TabItem[] = [
    {
      key: "profile",
      label: loc === "en" ? "Profile" : "Profil",
      desc: loc === "en" ? "Personal information" : "Kişisel bilgiler",
      icon: "👤",
    },
    {
      key: "addresses",
      label: loc === "en" ? "Addresses" : "Adresler",
      desc: loc === "en" ? "Delivery and billing" : "Teslimat ve fatura",
      icon: "⌂",
    },
    {
      key: "orders",
      label: loc === "en" ? "Orders" : "Siparişler",
      desc: loc === "en" ? "Order history" : "Sipariş geçmişi",
      icon: "▦",
    },
    {
      key: "appointments",
      label: loc === "en" ? "My Appointments" : "Randevularım",
      desc: loc === "en" ? "Requests and results" : "Talepler ve sonuçlar",
      icon: "◷",
    },
    {
      key: "refunds",
      label: loc === "en" ? "Refund Requests" : "İade Taleplerim",
      desc: loc === "en" ? "Refund process" : "İade süreci",
      icon: "↩",
    },
    {
      key: "shipments",
      label: loc === "en" ? "Shipment Tracking" : "Kargo Takibi",
      desc: loc === "en" ? "Cargo and delivery" : "Kargo ve teslimat",
      icon: "⇄",
    },
    {
      key: "coupons",
      label: loc === "en" ? "My Coupons" : "Kuponlarım",
      desc: loc === "en" ? "Discount rights" : "İndirim hakları",
      icon: "✦",
    },
    {
      key: "favorites",
      label: loc === "en" ? "Favorites" : "Favorilerim",
      desc: loc === "en" ? "Saved products" : "Kaydettiğin ürünler",
      icon: "♡",
    },
{

  key: "notifications",

  label: loc === "en" ? "Notifications" : "Bildirim Merkezi",

  desc: loc === "en" ? "Order and support updates" : "Sipariş ve destek bildirimleri",

  icon: "🔔",

},
    {
      key: "security",
      label: loc === "en" ? "Security" : "Güvenlik",
      desc: loc === "en" ? "Login and account" : "Giriş ve hesap",
      icon: "◆",
    },
    {
      key: "stock-alerts",
      label: loc === "en" ? "Stock Alerts" : "Stok Bildirimlerim",
      desc: loc === "en" ? "Product alerts" : "Ürün bildirimleri",
      icon: "◌",
    },
  ];

  function handleTabClick(nextTab: AccountTab) {
    onTabChange(nextTab);
    onClose?.();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`}
        onClick={onClose}
        aria-label={loc === "en" ? "Close account menu" : "Hesap menüsünü kapat"}
        tabIndex={isOpen ? 0 : -1}
      />

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
        aria-label={loc === "en" ? "Account menu" : "Hesap menüsü"}
      >
          <button

    type="button"

    className={styles.mobileClose}

    onClick={onClose}

    aria-label={loc === "en" ? "Close menu" : "Menüyü kapat"}

  >

    ✕

  </button>
        <div className={styles.card}>
          <div className={styles.top}>
           

            <div className={styles.brandRow}>
              <div className={styles.brandMark}>
                <span>6</span>
              </div>

              <div className={styles.brandText}>
                <div className={styles.brandName}>Dromocob</div>
                <div className={styles.brandSub}>
                  {loc === "en" ? "Premium customer panel" : "Premium müşteri paneli"}
                </div>
              </div>
            </div>

            <div className={styles.hero}>
              <div className={styles.kicker}>
                <span className={styles.liveDot} />
                {loc === "en" ? "Account Center" : "Hesap Merkezi"}
              </div>

              <h1 className={styles.title}>{title}</h1>

              <div className={styles.breadcrumb}>
                <Link href="/">{breadcrumbHome}</Link>
                <span>›</span>
                <span>{title}</span>
              </div>
            </div>
          </div>

          <div className={styles.panelNote}>
            <strong>{loc === "en" ? "Secure area" : "Güvenli alan"}</strong>
            <span>
              {loc === "en"
                ? "Manage orders, returns and account details."
                : "Sipariş, iade ve hesap bilgilerini tek merkezden yönet."}
            </span>
          </div>

          <nav className={styles.nav}>
            {tabs.map((item) => {
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  onClick={() => handleTabClick(item.key)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>

                  <span className={styles.navText}>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.navDesc}>{item.desc}</span>
                  </span>

                  <span className={styles.navArrow}>›</span>
                </button>
              );
            })}

            {adminButton ? (
              <div className={styles.adminWrap}>
                <div className={styles.adminLabel}>
                  {loc === "en" ? "Management" : "Yönetim"}
                </div>
                {adminButton}
              </div>
            ) : null}
          </nav>

          <div className={styles.footer}>
            <div className={styles.footerText}>
              <strong>{loc === "en" ? "Need help?" : "Yardım mı lazım?"}</strong>
              <span>
                {loc === "en"
                  ? "Our team is ready to support you."
                  : "Ekibimiz destek için hazır."}
              </span>
            </div>

            <button
              type="button"
              className={styles.logoutBtn}
              onClick={onLogout}
              aria-label={loc === "en" ? "Logout" : "Çıkış"}
              title={loc === "en" ? "Logout" : "Çıkış"}
            >
              <span>⨉</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
