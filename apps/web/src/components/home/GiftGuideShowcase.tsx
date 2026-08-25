"use client";

import Link from "next/link";
import styles from "./GiftGuideShowcase.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type GiftCardItem = {
  title?: string | LocaleText;
  text?: string | LocaleText;
  href?: string;
};

type GiftGuideData = {
  title?: string | LocaleText;
  text?: string | LocaleText;
  primaryBtn?: string | LocaleText;
  primaryHref?: string;
  secondaryBtn?: string | LocaleText;
  secondaryHref?: string;
  cards?: GiftCardItem[];
};

type GiftGuideShowcaseProps = {
  data?: GiftGuideData;
  loc?: "tr" | "en";
  kicker?: string;
};

function pickText(v: string | LocaleText | undefined, loc: "tr" | "en") {
  if (typeof v === "string") return v.trim();
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr : tr || en;
}

export default function GiftGuideShowcase({
  data,
  loc = "tr",
  kicker = "Hediye Rehberi",
}: GiftGuideShowcaseProps) {
  const title =
    pickText(data?.title, loc) ||
    (loc === "en"
      ? "Start here if you are not sure what to buy"
      : "Ne alacağını bilmiyorsan buradan gir");

  const text =
    pickText(data?.text, loc) ||
    (loc === "en"
      ? "Prepared gift scenarios help hesitant visitors decide faster."
      : "Kararsız müşteri için hazır senaryolar satış hızını artırır.");

  const primaryBtn =
    pickText(data?.primaryBtn, loc) ||
    (loc === "en" ? "View All Gifts" : "Tüm Hediyeleri Gör");

  const secondaryBtn =
    pickText(data?.secondaryBtn, loc) ||
    (loc === "en" ? "Choose with Consultant" : "Danışmanla Seç");

  const primaryHref = String(data?.primaryHref || "").trim() || "/shop";
  const secondaryHref = String(data?.secondaryHref || "").trim() || "/iletisim";

  const cards = Array.isArray(data?.cards)
    ? data.cards
        .map((card, index) => ({
          no: String(index + 1).padStart(2, "0"),
          title: pickText(card?.title, loc),
          text: pickText(card?.text, loc),
          href: String(card?.href || "").trim() || "/shop",
        }))
        .filter((card) => card.title || card.text)
    : [];

  if (!cards.length && !title && !text) return null;

  return (
    <section className={styles.section}>
      <div className="px-container">
        <div className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.kicker}>{kicker}</span>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.text}>{text}</p>

            <div className={styles.actions}>
              <Link href={primaryHref} className={styles.btnPrimary}>
                {primaryBtn}
              </Link>

              <Link href={secondaryHref} className={styles.btnGhost}>
                {secondaryBtn}
              </Link>
            </div>
          </div>

          {cards.length > 0 ? (
            <div className={styles.cards}>
              {cards.map((card) => (
                <Link key={`${card.no}-${card.title}`} href={card.href} className={styles.card}>
                  <div className={styles.cardNo}>{card.no}</div>
                  <div className={styles.cardTitle}>{card.title}</div>
                  {card.text ? <div className={styles.cardText}>{card.text}</div> : null}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}