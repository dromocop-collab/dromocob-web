"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import styles from "./accountFavoritesPanel.module.css";

export default function AccountFavoritesPanel({ uid, loc }: { uid: string; loc: "tr" | "en" }) {
  const favorites = useFavorites(uid);
  const money = (value?: number, currency = "TRY") =>
    typeof value === "number"
      ? new Intl.NumberFormat(loc === "en" ? "en-US" : "tr-TR", { style: "currency", currency }).format(value)
      : "";

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>{loc === "en" ? "Your collection" : "Sana özel seçki"}</span>
          <h2>{loc === "en" ? "Favorites" : "Favorilerim"}</h2>
          <p>{loc === "en" ? "Products you saved for later are collected here." : "Daha sonra incelemek için kaydettiğin ürünler burada birikir."}</p>
        </div>
        <span className={styles.count}>{favorites.count}</span>
      </header>

      {!favorites.items.length ? (
        <div className={styles.empty}>
          <Heart size={30} strokeWidth={1.5} aria-hidden="true" />
          <strong>{loc === "en" ? "Your favorites are empty" : "Favori listen henüz boş"}</strong>
          <span>{loc === "en" ? "Save the pieces you love and find them here instantly." : "Beğendiğin parçaları kaydet, buradan kolayca yeniden ulaş."}</span>
          <Link href="/shop"><ShoppingBag size={17} />{loc === "en" ? "Explore products" : "Ürünleri keşfet"}</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {favorites.items.map((item) => {
            const href = `/products/${encodeURIComponent(item.slug || item.id)}`;
            return (
              <article className={styles.card} key={item.id}>
                <Link className={styles.media} href={href}>
                  {item.image ? <Image src={item.image} alt={item.title || ""} fill sizes="(max-width: 700px) 44vw, 220px" /> : <span>DROMOCOB</span>}
                </Link>
                <div className={styles.body}>
                  <Link href={href} className={styles.title}>{item.title || (loc === "en" ? "Product" : "Ürün")}</Link>
                  {typeof item.price === "number" ? <strong>{money(item.price, item.currency)}</strong> : null}
                  <button type="button" onClick={() => favorites.remove(item.id)}><Trash2 size={15} />{loc === "en" ? "Remove" : "Listeden çıkar"}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
