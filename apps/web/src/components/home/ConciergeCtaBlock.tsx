"use client";

import Link from "next/link";
import styles from "./ConciergeCtaBlock.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type ConciergeCtaData = {
  title?: string | LocaleText;
  text?: string | LocaleText;
  primaryBtn?: string | LocaleText;
  primaryHref?: string;
  secondaryBtn?: string | LocaleText;
  secondaryHref?: string;
};

type ConciergeCtaBlockProps = {
  data?: ConciergeCtaData;
  loc?: "tr" | "en";
  kicker?: string;
};

function pickText(v: string | LocaleText | undefined, loc: "tr" | "en") {
  if (typeof v === "string") return v.trim();
  const tr = String(v?.tr || "").trim();
  const en = String(v?.en || "").trim();
  return loc === "en" ? en || tr : tr || en;
}

export default function ConciergeCtaBlock({
  data,
  loc = "tr",
  kicker = "Kişisel Danışmanlık",
}: ConciergeCtaBlockProps) {
  const title =
    pickText(data?.title, loc) ||
    (loc === "en"
      ? "Do not leave undecided customers alone"
      : "Kararsız müşteriyi yalnız bırakma");

  const text =
    pickText(data?.text, loc) ||
    (loc === "en"
      ? "Support the buying decision with WhatsApp, store appointments and quick guidance."
      : "WhatsApp, mağaza randevusu ve hızlı yönlendirme ile satın alma kararını kolaylaştır.");

  const primaryBtn =
    pickText(data?.primaryBtn, loc) ||
    (loc === "en" ? "Talk to Consultant" : "Danışmanla Görüş");

  const secondaryBtn =
    pickText(data?.secondaryBtn, loc) ||
    (loc === "en" ? "Create Appointment" : "Randevu Oluştur");

  const primaryHref = String(data?.primaryHref || "").trim() || "/iletisim";
  const secondaryHref = String(data?.secondaryHref || "").trim() || "/hesabim";

  if (!title && !text) return null;

  return (
   <section className={styles.section}>
  <div className={styles.wrap}>
    <div className={styles.left}>
      <span className={styles.kicker}>{kicker}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
    </div>

    <div className={styles.right}>
      <Link href={primaryHref} className={styles.btnDark}>
        {primaryBtn}
      </Link>

      <Link href={secondaryHref} className={styles.btnLight}>
        {secondaryBtn}
      </Link>
    </div>
  </div>
</section>
  );
}