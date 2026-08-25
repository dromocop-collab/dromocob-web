"use client";

import type { ReactNode } from "react";
import styles from "./styles/headerActions.module.css";

type Props = {
  cartCount: number;
  wishCount: number;
  onOpenSearch: () => void;
  onOpenWish: () => void;
  onOpenCart: () => void;
  onOpenProfile: () => void;
  languageToggle: ReactNode;
};

function clampCount(n: number) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return "";
  return x > 99 ? "99+" : String(x);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.iconSvg} aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.25 4.25" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.iconSvg} aria-hidden="true" focusable="false">
      <path
        d="M12 20.2s-6.9-4.16-9.02-8.44C1.16 8.11 3.3 5 6.56 5c1.94 0 3.32.97 4.16 2.08C11.56 5.97 12.94 5 14.88 5c3.26 0 5.4 3.11 3.58 6.76C18.34 16.04 12 20.2 12 20.2Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.iconSvg} aria-hidden="true" focusable="false">
      <path d="M6.75 8.25h10.5l-.9 10.5H7.65l-.9-10.5Z" strokeLinejoin="round" />
      <path d="M9 8.25V7.5a3 3 0 0 1 6 0v.75" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.iconSvg} aria-hidden="true" focusable="false">
      <circle cx="12" cy="8.25" r="3.25" />
      <path d="M5 19a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  );
}

export default function HeaderActions({
  cartCount,
  wishCount,
  onOpenSearch,
  onOpenWish,
  onOpenCart,
  onOpenProfile,
  languageToggle,
}: Props) {
  const cartBadge = clampCount(cartCount);
  const wishBadge = clampCount(wishCount);

  return (
    <div className={styles.right} aria-label="Hızlı işlemler">
      <button
        className={styles.iconBtn}
        onClick={onOpenSearch}
        type="button"
        aria-label="Ürün ara"
        title="Ara"
      >
        <SearchIcon />
      </button>

      <button
        className={styles.iconBtn}
        onClick={onOpenWish}
        type="button"
        aria-label={wishBadge ? `Favoriler, ${wishBadge} ürün` : "Favoriler"}
        title="Favoriler"
      >
        <HeartIcon />
        {wishBadge ? <span className={styles.badge}>{wishBadge}</span> : null}
      </button>

      <button
        className={styles.iconBtn}
        onClick={onOpenCart}
        type="button"
        aria-label={cartBadge ? `Sepet, ${cartBadge} ürün` : "Sepet"}
        title="Sepet"
      >
        <BagIcon />
        {cartBadge ? <span className={styles.badge}>{cartBadge}</span> : null}
      </button>

      <button
        className={styles.iconBtn}
        onClick={onOpenProfile}
        type="button"
        aria-label="Profil ve hesap paneli"
        title="Profil"
      >
        <UserIcon />
      </button>

      <div className={styles.langWrap}>{languageToggle}</div>
    </div>
  );
}