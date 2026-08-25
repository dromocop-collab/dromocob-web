"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "../kurumsal-pages.module.css";

export default function RandevuMagazaDeneyimiPage() {
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
        kicker: "Appointment & In-Store Experience",
        title: "Choose the right piece through real experience, not just a screen.",
        lead:
          "At Dromocob, our appointment system is designed to make your store visit calmer, more focused, and more efficient. Examine products closely, compare alternatives, and make the right decision with confidence according to your budget.",
        meta1: "One-to-one consultation",
        meta2: "Planned store visit",
        meta3: "Faster decision-making",
        card1Title: "Why is the appointment system important?",
        card1Text:
          "In lifestyle, a decision is never made by visuals alone. The fit, craftsmanship, gold setting, intended use, and budget balance must all be evaluated together. The appointment system helps you manage this process without rushing and without distraction.",
        card2Title: "What should you expect during your visit?",
        list1: "Relevant product groups prepared in advance for your needs",
        list2: "Close examination and comparison of lifestyle pieces",
        list3: "Clear alternatives presented according to your budget range",
        list4: "One-to-one in-store guidance during the decision process",
        f1Title: "Preparation",
        f1Text:
          "Your product category is clarified in advance. This allows you to focus directly on the right options when you arrive, without wasting time.",
        f2Title: "Clear guidance",
        f2Text:
          "Instead of getting lost in a crowded product selection, the most relevant alternatives for your needs are prioritized. The selection process becomes easier.",
        f3Title: "Confident decision",
        f3Text:
          "You evaluate style, purpose, and budget together before making your choice. This significantly reduces the risk of regret later.",
        band: "A planned in-store experience speeds up decisions and increases confidence.",
        cta: "Create Appointment Request",
      }
    : {
        kicker: "Randevu & Mağaza Deneyimi",
        title: "Doğru ürünü ekranda değil, deneyim içinde seçin.",
        lead:
          "Dromocob’ta randevu sistemi, mağaza ziyaretini daha sakin, daha odaklı ve daha verimli hale getirmek için tasarlandı. Ürünleri yakından inceleyin, seçenekleri karşılaştırın ve bütçenize en uygun kararı güvenle verin.",
        meta1: "Birebir danışmanlık",
        meta2: "Planlı mağaza ziyareti",
        meta3: "Daha hızlı karar süreci",
        card1Title: "Randevu sistemi neden önemli?",
        card1Text:
          "e-ticaretta karar sadece görselliğe bakılarak verilmez. Ürünün duruşu, işçiliği, ayarı, kullanım amacı ve bütçeyle dengesi birlikte değerlendirilir. Randevu sistemi, bu süreci acele etmeden ve dikkat dağılmadan yönetmenizi sağlar.",
        card2Title: "Ziyarette sizi ne bekler?",
        list1: "İhtiyacınıza uygun ürün gruplarının önceden hazırlanması",
        list2: "Takıların yakından incelenmesi ve karşılaştırılması",
        list3: "Bütçe aralığına göre net alternatif sunulması",
        list4: "Karar sürecinde birebir mağaza danışmanlığı",
        f1Title: "Ön hazırlık",
        f1Text:
          "Hangi ürün grubuna baktığınız önceden netleşir. Böylece mağazaya geldiğinizde zaman kaybetmeden doğru seçeneklere geçilir.",
        f2Title: "Net yönlendirme",
        f2Text:
          "Karmaşık ürün kalabalığı yerine, sizin ihtiyacınıza uygun net alternatifler ön plana çıkarılır. Seçim daha kolay hale gelir.",
        f3Title: "Güvenli karar",
        f3Text:
          "Stil, kullanım amacı ve bütçe dengesini birlikte görerek karar verirsiniz. Bu da sonradan pişmanlık riskini ciddi biçimde azaltır.",
        band: "Planlı bir mağaza deneyimi, kararı hızlandırır; güveni artırır.",
        cta: "Randevu Talebi Oluştur",
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