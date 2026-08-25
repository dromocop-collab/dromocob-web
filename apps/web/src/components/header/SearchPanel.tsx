"use client";

import Link from "next/link";
import type { FormEvent, RefObject } from "react";
import { RatesLatest, resolveProductPriceTRY } from "@/lib/pricing";
import styles from "./styles/searchPanel.module.css";

type Locale = "tr" | "en";

type SearchProduct = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  image: string;
  stock: number;
  raw: any;
};

type Props = {
  open: boolean;
  loc: Locale;
  q: string;
  setQ: (v: string) => void;
  searchLoading: boolean;
  searchDone: boolean;
  searchResults: SearchProduct[];
  rates: RatesLatest | null;
  onSubmit: (e?: FormEvent) => void;
  onClose: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
  onAddToCart: (item: SearchProduct, price: number) => void;
  formatTRY: (v: number, digits?: number) => string;
};

function safeStr(v: unknown) {
  const x = String(v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : "";
}

function clampStock(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function getInitial(title: string) {
  return safeStr(title).slice(0, 1).toLocaleUpperCase("tr-TR") || "6";
}

export default function SearchPanel({
  open,
  loc,
  q,
  setQ,
  searchLoading,
  searchDone,
  searchResults,
  rates,
  onSubmit,
  onClose,
  searchInputRef,
  onAddToCart,
  formatTRY,
}: Props) {
  const isTR = loc === "tr";
  const queryText = safeStr(q);
  const hasQuery = queryText.length > 0;
  const hasResults = searchResults.length > 0;

  return (
    <aside
      className={`${styles.panel} ${open ? styles.open : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={isTR ? "Ürün arama paneli" : "Product search panel"}
    >
      <div className={styles.topGlow} aria-hidden="true" />

      <div className={styles.head}>
        <div className={styles.brandSide}>
          <div className={styles.rocketBadge} aria-hidden="true">
            <span className={styles.rocket}>🚀</span>
          </div>

          <div>
            <div className={styles.kicker}>
              {isTR ? "6’NCI ARAMA MOTORU" : "6’NCI SEARCH ENGINE"}
            </div>
            <h2 className={styles.title}>
              {isTR ? "Ürün Keşfi" : "Product Discovery"}
            </h2>
          </div>
        </div>

        <button
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
          aria-label={isTR ? "Aramayı kapat" : "Close search"}
        >
          ✕
        </button>
      </div>

      <div className={styles.body}>
        <form className={styles.searchCard} onSubmit={onSubmit}>
          <div className={styles.searchIcon} aria-hidden="true">
            ⌕
          </div>

          <input
            ref={searchInputRef}
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              isTR
                ? "Yüzük, bileklik, kolye, SKU veya model ara..."
                : "Search rings, bracelets, necklaces, SKU..."
            }
            autoComplete="off"
          />

          {hasQuery ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setQ("")}
              aria-label={isTR ? "Aramayı temizle" : "Clear search"}
            >
              ×
            </button>
          ) : null}

          <button className={styles.goBtn} type="submit" disabled={searchLoading}>
            {searchLoading ? (
              <span className={styles.loadingDots}>
                <i />
                <i />
                <i />
              </span>
            ) : (
              <>
                <span>{isTR ? "Ara" : "Search"}</span>
                <b>→</b>
              </>
            )}
          </button>
        </form>

        <div className={styles.quickBar}>
          <button type="button" onClick={() => setQ("yüzük")}>
            Yüzük
          </button>
          <button type="button" onClick={() => setQ("kolye")}>
            Kolye
          </button>
          <button type="button" onClick={() => setQ("bileklik")}>
            Bileklik
          </button>
          <button type="button" onClick={() => setQ("alyans")}>
            Alyans
          </button>
        </div>

        {searchLoading ? (
          <div className={styles.stateCard}>
            <div className={styles.orbit}>
              <span className={styles.orbitCore}>6</span>
              <span className={styles.orbitDot} />
            </div>

            <div>
              <strong>{isTR ? "Ürünler taranıyor..." : "Scanning products..."}</strong>
              <p>
                {isTR
                  ? "Katalog, stok ve güncel fiyatlar aynı anda kontrol ediliyor."
                  : "Catalog, stock and live prices are being checked."}
              </p>
            </div>
          </div>
        ) : searchDone && !hasResults ? (
          <div className={styles.emptyCard}>
            <div className={styles.emptyRocket} aria-hidden="true">
              🚀
            </div>
            <h3>{isTR ? "Bu ürün galakside yok gibi" : "No product found"}</h3>
            <p>
              {isTR
                ? "Kelimeyi biraz sadeleştir: örn. “yüzük”, “kolye”, “YZ03587”."
                : "Try a simpler keyword, SKU or product type."}
            </p>
          </div>
        ) : hasResults ? (
          <div className={styles.resultsShell}>
            <div className={styles.resultHead}>
              <div>
                <span>{isTR ? "Sonuçlar" : "Results"}</span>
                <strong>
                  {searchResults.length} {isTR ? "ürün bulundu" : "products found"}
                </strong>
              </div>

              <small>{isTR ? "Canlı fiyat destekli" : "Live price supported"}</small>
            </div>

            <div className={styles.list}>
              {searchResults.map((item) => {
                const { price, compareAtPrice } = resolveProductPriceTRY(item.raw, rates);
                const href = `/products/${encodeURIComponent(item.slug || item.id)}`;
                const stock = clampStock(item.stock);
                const canBuy = stock > 0;
                const cleanTitle = safeStr(item.title) || (isTR ? "Ürün" : "Product");
                const cleanSku = safeStr(item.sku);

                return (
                  <article key={item.id} className={styles.item}>
                    <Link href={href} className={styles.thumb} onClick={onClose}>
                      {item.image ? (
                        <img src={item.image} alt={cleanTitle} loading="lazy" />
                      ) : (
                        <div className={styles.thumbPh}>{getInitial(cleanTitle)}</div>
                      )}
                    </Link>

                    <div className={styles.meta}>
                      <div className={styles.itemTop}>
                        <Link href={href} className={styles.productTitle} onClick={onClose}>
                          {cleanTitle}
                        </Link>

                        <span className={`${styles.stockPill} ${canBuy ? styles.stockOk : styles.stockBad}`}>
                          {canBuy
                            ? isTR
                              ? `Stok: ${stock}`
                              : `Stock: ${stock}`
                            : isTR
                              ? "Stok yok"
                              : "Out"}
                        </span>
                      </div>

                      <div className={styles.subMeta}>
                        {cleanSku ? <span>SKU: {cleanSku}</span> : null}
                        {item.slug ? <span>{item.slug}</span> : null}
                      </div>

                      <div className={styles.priceWrap}>
                        {Number(compareAtPrice ?? 0) > Number(price ?? 0) ? (
                          <div className={styles.comparePrice}>
                            {formatTRY(Number(compareAtPrice ?? 0), 2)}
                          </div>
                        ) : null}

                        <div className={styles.price}>{formatTRY(Number(price || 0), 2)}</div>
                      </div>

                      <div className={styles.actions}>
                        <Link href={href} className={styles.detailBtn} onClick={onClose}>
                          {isTR ? "Detay" : "Detail"}
                        </Link>

                        <button
                          className={styles.cartBtn}
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onAddToCart(item, Number(price || 0))}
                        >
                          {canBuy
                            ? isTR
                              ? "Sepete ekle"
                              : "Add to cart"
                            : isTR
                              ? "Stokta yok"
                              : "Out of stock"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.hintCard}>
            <div className={styles.hintIcon}>💎</div>
            <h3>{isTR ? "Arama Yapabilirsiniz" : "What are we looking for?"}</h3>
            <p>
              {isTR
                ? "Ürün adı, kategori, model kodu veya SKU yaz. Biz de mağaza rafını ışık hızında tarayalım."
                : "Type a product name, category, model code or SKU."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}