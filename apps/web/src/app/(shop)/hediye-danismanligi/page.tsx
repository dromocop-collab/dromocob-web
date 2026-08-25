"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "../kurumsal-pages.module.css";

export default function HediyeDanismanligiPage() {
  const [loc, setLoc] = useState<Locale>("tr");

  useEffect(() => {
    setLoc(getLocale());

    const onLocaleChange = (e: Event) => {
      const ce = e as CustomEvent<Locale>;
      setLoc(ce.detail || "tr");
    };

    window.addEventListener("locale-changed", onLocaleChange as EventListener);
    return () => window.removeEventListener("locale-changed", onLocaleChange as EventListener);
  }, []);

  const t = loc === "en"
    ? {
        kicker: "Gift Consultation",
        title: "Choosing the right gift becomes easier with the right guidance.",
        lead:
          "Gift selection should not feel confusing. At Dromocob, our gift consultation approach helps you choose the right lifestyle piece according to style, occasion, and budget. Faster process, stronger results.",
        meta1: "Occasion-based guidance",
        meta2: "Style-oriented selection",
        meta3: "Budget-friendly alternatives",
        card1Title: "Why is gift guidance valuable?",
        card1Text:
          "When buying a gift, the biggest challenge is choosing something meaningful without wasting time. A structured consultation process narrows down the right alternatives and makes the decision clearer.",
        card2Title: "How does it help you?",
        list1: "Recommendations according to occasion and recipient type",
        list2: "More accurate alternatives based on style and taste",
        list3: "Budget-based filtering without losing quality perception",
        list4: "Faster and more confident final choice",
        f1Title: "Right direction",
        f1Text:
          "Instead of browsing too many unrelated pieces, you are directed toward options that fit the purpose of your gift.",
        f2Title: "Time saving",
        f2Text:
          "A guided process removes unnecessary hesitation and helps you decide faster without compromising quality.",
        f3Title: "Stronger impression",
        f3Text:
          "A well-chosen gift creates a stronger emotional impact and reflects more care, elegance, and thoughtfulness.",
        band: "A well-guided gift choice feels more elegant, more personal, and more memorable.",
        cta: "Get Gift Support",
      }
    : {
        kicker: "Hediye Danışmanlığı",
        title: "Doğru hediye, doğru yönlendirmeyle daha kolay seçilir.",
        lead:
          "Hediye seçimi karışık değil, net olmalı. Dromocob’ta hediye danışmanlığı yaklaşımı; alıcıya, özel güne ve bütçeye göre en doğru takı alternatifini daha hızlı belirlemenize yardımcı olur.",
        meta1: "Özel güne uygun yönlendirme",
        meta2: "Tarza göre seçim",
        meta3: "Bütçeye uygun alternatifler",
        card1Title: "Hediye danışmanlığı neden değerli?",
        card1Text:
          "Hediye alırken en zor kısım, anlamlı ve doğru seçimi zaman kaybetmeden yapmaktır. Doğru yönlendirme süreci, seçenekleri daraltır ve karar vermeyi kolaylaştırır.",
        card2Title: "Bu süreç size ne sağlar?",
        list1: "Özel güne ve alıcı tipine göre öneri sunulması",
        list2: "Tarza ve zevke göre daha doğru alternatifler belirlenmesi",
        list3: "Bütçeye göre filtrelenmiş ama güçlü seçenekler sunulması",
        list4: "Daha hızlı ve daha güvenli karar verilmesi",
        f1Title: "Doğru yön",
        f1Text:
          "Gereksiz ürün kalabalığı yerine, hediyenin amacına uygun seçeneklere yönlendirilirsiniz.",
        f2Title: "Zaman kazancı",
        f2Text:
          "Kararsızlığı uzatan gereksiz detaylar azalır. Daha kısa sürede daha doğru seçim yapılır.",
        f3Title: "Daha güçlü etki",
        f3Text:
          "Doğru seçilmiş hediye daha anlamlı görünür; özen, zarafet ve değer algısını daha güçlü taşır.",
        band: "Doğru yönlendirilmiş bir hediye seçimi, daha zarif ve daha unutulmaz bir etki bırakır.",
        cta: "Hediye Desteği Al",
      };

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.kicker}>{t.kicker}</div>
          <h1 className={s.title}>{t.title}</h1>
          <p className={s.lead}>{t.lead}</p>

          <div className={s.heroMeta}>
            <span className={s.metaPill}>{t.meta1}</span>
            <span className={s.metaPill}>{t.meta2}</span>
            <span className={s.metaPill}>{t.meta3}</span>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.grid2}>
            <div className={s.card}>
              <h2 className={s.cardTitle}>{t.card1Title}</h2>
              <p className={s.text}>{t.card1Text}</p>
            </div>

            <div className={s.card}>
              <h2 className={s.cardTitle}>{t.card2Title}</h2>
              <ul className={s.list}>
                <li>{t.list1}</li>
                <li>{t.list2}</li>
                <li>{t.list3}</li>
                <li>{t.list4}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.featureGrid}>
            <div className={s.featureCard}>
              <div className={s.featureNo}>01</div>
              <h3 className={s.featureTitle}>{t.f1Title}</h3>
              <p className={s.featureText}>{t.f1Text}</p>
            </div>

            <div className={s.featureCard}>
              <div className={s.featureNo}>02</div>
              <h3 className={s.featureTitle}>{t.f2Title}</h3>
              <p className={s.featureText}>{t.f2Text}</p>
            </div>

            <div className={s.featureCard}>
              <div className={s.featureNo}>03</div>
              <h3 className={s.featureTitle}>{t.f3Title}</h3>
              <p className={s.featureText}>{t.f3Text}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={s.infoBand}>
        <div className={s.wrap}>
          <div className={s.infoBandInner}>
            <div className={s.infoBandText}>{t.band}</div>
            <Link href="/iletisim" className={s.cta}>
              {t.cta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}