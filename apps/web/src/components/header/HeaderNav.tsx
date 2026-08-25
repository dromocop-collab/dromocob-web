"use client";

import Link from "next/link";
import styles from "./styles/headerNav.module.css";

type LocaleText = { tr: string; en: string };
type NavItem = { label: LocaleText; url: string };

type Props = {
  nav: NavItem[];
  pathname: string;
  L: (x: LocaleText) => string;
};

export default function HeaderNav({ nav, pathname, L }: Props) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {nav.map((it, i) => {
        const href = it.url;
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={`${href}-${i}`}
            href={href}
            className={`${styles.navLink} ${isActive ? styles.navActive : ""}`}
          >
            {L(it.label)}
          </Link>
        );
      })}
    </nav>
  );
}