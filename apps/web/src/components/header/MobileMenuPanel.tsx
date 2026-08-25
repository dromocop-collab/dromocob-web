"use client";

import Link from "next/link";
import styles from "./styles/mobileMenuPanel.module.css";

type Locale = "tr" | "en";
type LocaleText = { tr: string; en: string };
type NavItem = { label: LocaleText; url: string };

type MenuCategoryNode = {
  id: string;
  slug: string;
  name: any;
  children: MenuCategoryNode[];
};

type Props = {

  open: boolean;

  loc: Locale;

  brandLink: string;

  brandLogoUrl: string;

  brandMark: string;

  brandTitle: string;

  nav: NavItem[];

  menuCats: MenuCategoryNode[];

  openCatIds: string[];

  isRealUser: boolean;

  onToggleCat: (id: string) => void;

  onClose: () => void;

};
function openLiveChat(onClose?: () => void) {
  onClose?.();

  const launcher =
    document.querySelector('[data-chat-launcher]') ||
    document.querySelector('[data-chat-toggle]') ||
    document.querySelector('.chat-launcher') ||
    document.querySelector('.chat-widget-button') ||
    document.querySelector('.chat-toggle') ||
    document.querySelector('button[aria-label*="İletişim"]') ||
    document.querySelector('button[aria-label*="chat"]');

  if (launcher instanceof HTMLElement) {
    launcher.click();
    return;
  }

  window.dispatchEvent(new CustomEvent("chat:open"));
}
function pickAnyLocaleText(v: any, loc: Locale, fallback = "") {
  if (typeof v === "string") return v.trim() || fallback;
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr || fallback : tr || en || fallback;
}

export default function MobileMenuPanel({
  open,
  loc,
  brandLink: _brandLink, // eslint-disable-line @typescript-eslint/no-unused-vars
  brandLogoUrl: _brandLogoUrl, // eslint-disable-line @typescript-eslint/no-unused-vars
  brandMark: _brandMark, // eslint-disable-line @typescript-eslint/no-unused-vars
  brandTitle: _brandTitle, // eslint-disable-line @typescript-eslint/no-unused-vars
  nav,
  menuCats,
  openCatIds,
  isRealUser: _isRealUser, // eslint-disable-line @typescript-eslint/no-unused-vars
  onToggleCat,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label={loc === "en" ? "Close menu overlay" : "Menü katmanını kapat"}
      />

      <aside
        className={`${styles.panel} ${styles.open}`}
       
      >
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <div className={styles.kicker}>
              {loc === "en" ? "Dromocob" : "Dromocob"}
            </div>
            
          </div>

          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label={loc === "en" ? "Close menu" : "Menüyü kapat"}
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>



          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                {loc === "en" ? "Categories" : "Kategoriler"}
              </div>
              <div></div>
            </div>

            <div className={styles.categoryList}>
              {menuCats.map((cat) => {
                const isOpen = openCatIds.includes(cat.id);
                const hasChildren = cat.children?.length > 0;
                const label = pickAnyLocaleText(cat.name, loc, cat.slug);

                return (
                  <div key={cat.id} className={styles.catItem}>
                    {hasChildren ? (
                      <>
                        <button
                          className={`${styles.catTrigger} ${isOpen ? styles.catTriggerOpen : ""}`}
                          onClick={() => onToggleCat(cat.id)}
                          type="button"
                        >
                          <span className={styles.catText}>{label}</span>
                          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
                            ›
                          </span>
                        </button>

                        <div className={`${styles.subWrap} ${isOpen ? styles.subWrapOpen : ""}`}>
                          <div className={styles.subList}>
                            <Link
                              href={`/shop?cat=${encodeURIComponent(cat.slug)}`}
                              onClick={onClose}
                              className={`${styles.subLink} ${styles.subLinkPrimary}`}
                            >
                              {loc === "en" ? "View all" : "Tümünü gör"}
                            </Link>

                            {cat.children.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/shop?cat=${encodeURIComponent(sub.slug)}`}
                                onClick={onClose}
                                className={styles.subLink}
                              >
                                {pickAnyLocaleText(sub.name, loc, sub.slug)}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <Link
                        href={`/shop?cat=${encodeURIComponent(cat.slug)}`}
                        onClick={onClose}
                        className={styles.link}
                      >
                        <span>{label}</span>
                        <i className={styles.arrow}>›</i>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                {loc === "en" ? "Pages" : "Sayfalar"}
              </div>
              
            </div>

            <div className={styles.linkList}>
              {nav.map((it, i) => (
                <Link
                  key={`${it.url}-${i}`}
                  href={it.url}
                  className={styles.link}
                  onClick={onClose}
                >
                  <span>{loc === "en" ? it.label.en : it.label.tr}</span>
                  <i className={styles.arrow}>›</i>
                </Link>
              ))}
            </div>
          </div>
          <div className={styles.footerBox}>
            <div className={styles.footerTitle}>
              {loc === "en" ? "Need help?" : "Yardım mı lazım?"}
            </div>
            <div className={styles.footerText}>
              {loc === "en"
                ? "Reach the right collection quickly or continue to the full store."
                : "Doğru koleksiyona hızlı geç veya mağazaya tam görünümle devam et."}
            </div>

            <div className={styles.footerActions}>
              <Link href="/shop" className={styles.primaryCta} onClick={onClose}>
                {loc === "en" ? "Go to store" : "Mağazaya git"}
              </Link>
              <button
  type="button"
  className={styles.secondaryCta}
  onClick={() => openLiveChat(onClose)}
>
  {loc === "en" ? "Contact" : "İletişim"}
</button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}