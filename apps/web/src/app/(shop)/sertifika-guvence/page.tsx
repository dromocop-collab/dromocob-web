"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "../kurumsal-pages.module.css";

export default function SertifikaGuvencePage() {
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
        kicker: "Certificate & Assurance",
        title: "Clear information builds stronger trust in lifestyle shopping.",
        lead:
          "At Dromocob, certification and product assurance are presented with a transparent and understandable approach. Product setting, craftsmanship, and confidence must be clear before purchase—not after.",
        meta1: "Transparent details",
        meta2: "Reliable information",
        meta3: "Confident purchase",
        card1Title: "Why does certification matter?",
        card1Text:
          "lifestyle is not just a visual purchase. Product value, gold setting, workmanship quality, and technical details directly affect trust. Proper certification helps the buyer understand exactly what is being purchased.",
        card2Title: "What do we aim to provide?",
        list1: "Clear information about product setting and workmanship",
        list2: "A more transparent and reliable shopping experience",
        list3: "Reduced uncertainty before purchase",
        list4: "Stronger confidence in the final decision",
        f1Title: "Transparency",
        f1Text:
          "When product details are shared clearly, the customer feels more secure and can compare alternatives more accurately.",
        f2Title: "Confidence",
        f2Text:
          "A customer who knows what they are buying makes a stronger and more comfortable purchase decision.",
        f3Title: "Long-term satisfaction",
        f3Text:
          "Clear product information reduces hesitation during purchase and supports a more satisfying shopping experience afterward.",
        band: "Trust grows where product information is clear and transparent.",
        cta: "Contact Us",
      }
    : {
        kicker: "Sertifika & Güvence",
        title: "Online alışverişte güçlü güven, net bilgiyle başlar.",
        lead:
          "Dromocob’ta sertifika ve ürün güvence yaklaşımı, müşteriye şeffaf ve anlaşılır bilgi sunmak için tasarlanır. Ürün ayarı, işçilik ve değer algısı satın almadan önce netleşmelidir; sonradan değil.",
        meta1: "Şeffaf detaylar",
        meta2: "Güvenilir bilgi",
        meta3: "Daha güvenli satın alma",
        card1Title: "Sertifika neden önemlidir?",
        card1Text:
          "Takı alışverişi sadece görsele dayalı bir seçim değildir. Ürünün değeri, ayarı, işçiliği ve teknik detayları doğrudan güven duygusunu etkiler. Doğru sertifika yaklaşımı, müşterinin ne aldığını daha net anlamasını sağlar.",
        card2Title: "Burada neyi hedefliyoruz?",
        list1: "Ürün ayarı ve işçilik hakkında net bilgi sunmak",
        list2: "Daha şeffaf ve güvenli bir alışveriş deneyimi oluşturmak",
        list3: "Satın alma öncesi belirsizliği azaltmak",
        list4: "Karar sürecinde müşterinin güvenini artırmak",
        f1Title: "Şeffaflık",
        f1Text:
          "Ürün bilgisi açık paylaşıldığında müşteri kendini daha güvenli hisseder ve karşılaştırma yapması kolaylaşır.",
        f2Title: "Güven",
        f2Text:
          "Ne aldığını bilen müşteri, kararını daha rahat verir. Bu da satış sürecini daha güçlü hale getirir.",
        f3Title: "Uzun vadeli memnuniyet",
        f3Text:
          "Açık bilgiyle yapılan satış, satın alma sonrası memnuniyeti ve markaya duyulan güveni güçlendirir.",
        band: "Ürün bilgisi netse, güven de güçlü olur.",
        cta: "Bizimle İletişime Geç",
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
