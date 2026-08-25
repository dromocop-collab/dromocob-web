"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./styles/headerBrand.module.css";

type Props = {
  brandLink: string;
  brandLogoUrl: string;
  brandMark: string;
  brandTitle: string;
  onOpenMenu: () => void;
};

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.menuIconSvg} aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function safeText(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function safeHref(v: unknown, fallback = "/") {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

export default function HeaderBrand({
  brandLink,
  brandLogoUrl,
  brandMark,
  brandTitle,
  onOpenMenu,
}: Props) {
  const [logoBroken, setLogoBroken] = useState(false);

  const title = safeText(brandTitle, "Dromocob");
  const href = safeHref(brandLink, "/");
  const mark = safeText(brandMark, "D");
  const logo = safeText(brandLogoUrl);

  const showLogo = !!logo && !logoBroken;
  const isStudioLogo = logo === "/dromocob-app-icon-192.png";

  return (
    <div className={styles.wrap}>
      <button
        className={styles.menuBtn}
        onClick={onOpenMenu}
        type="button"
        aria-label="Menüyü aç"
      >
        <MenuIcon />
      </button>

      <Link
        className={styles.brand}
        href={href}
        aria-label={title}
        scroll={false}
      >
        {showLogo ? (
          <img
            className={styles.brandLogo}
            src={logo}
            alt={title}
            onError={() => setLogoBroken(true)}
          />
        ) : (
          <div className={styles.brandMark} aria-hidden="true">
            {mark}
          </div>
        )}
        {showLogo && isStudioLogo ? (
          <span className={styles.brandWord}>
            <b>CIHAT ERDEM</b>
            <small>WEB TASARIM &amp; SEO STÜDYOSU</small>
          </span>
        ) : null}
      </Link>
    </div>
  );
}
