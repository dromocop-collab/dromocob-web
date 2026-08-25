"use client";

import Link from "next/link";
import { Building2, Gift, Gem, ReceiptText, ArrowUpRight, Check } from "lucide-react";
import styles from "./CorporateSolutions.module.css";

type Props = { loc?: "tr" | "en" };

const copy = {
  tr: {
    kicker: "Kurumsal Çözümler",
    title: "Markanıza değer katan, kalıcı hediyeler",
    text: "Çalışan ödüllendirmeden özel günlere, iş ortaklarından VIP müşterilere kadar her ölçekte kurumsal hediye sürecini tek noktadan yönetiyoruz.",
    services: [
      { title: "Toplu Sipariş", text: "Adede ve bütçeye özel seçki, avantajlı fiyatlandırma.", icon: Building2 },
      { title: "Kurumsal Hediye", text: "Çalışan, bayi ve müşteri bağlılığını güçlendiren alternatifler.", icon: Gift },
      { title: "Özel Tasarım", text: "Marka hikâyenize uygun kişiselleştirme ve seçkin sunum.", icon: Gem },
      { title: "Teklif & Fatura", text: "Şeffaf teklif, kurumsal faturalama ve planlı teslimat.", icon: ReceiptText },
    ],
    benefits: ["Bütçeye özel ürün seçkisi", "Kişiselleştirilmiş paketleme", "Planlı ve güvenli teslimat"],
    primary: "Kurumsal teklif alın",
    secondary: "Bizi tanıyın",
    note: "Talebinizi paylaşın, ekibimiz size özel seçeneklerle dönüş yapsın.",
  },
  en: {
    kicker: "Corporate Solutions",
    title: "Lasting gifts that elevate your brand",
    text: "From employee recognition and milestones to business partners and VIP clients, we manage corporate gifting at every scale.",
    services: [
      { title: "Bulk Orders", text: "Curated options and preferred pricing for your volume and budget.", icon: Building2 },
      { title: "Corporate Gifting", text: "Meaningful pieces for employees, dealers and valued clients.", icon: Gift },
      { title: "Bespoke Design", text: "Personalisation and premium presentation shaped around your brand.", icon: Gem },
      { title: "Quote & Invoice", text: "Clear proposals, corporate invoicing and scheduled delivery.", icon: ReceiptText },
    ],
    benefits: ["Budget-led product curation", "Personalised packaging", "Scheduled secure delivery"],
    primary: "Request a corporate quote",
    secondary: "About our company",
    note: "Share your brief and our team will return with tailored options.",
  },
};

export default function CorporateSolutions({ loc = "tr" }: Props) {
  const t = copy[loc];

  return (
    <section className={styles.section} aria-labelledby="corporate-solutions-title">
      <div className="px-container">
        <div className={styles.panel}>
          <div className={styles.intro}>
            <span className={styles.kicker}>{t.kicker}</span>
            <h2 id="corporate-solutions-title" className={styles.title}>{t.title}</h2>
            <p className={styles.lead}>{t.text}</p>

            <div className={styles.benefits}>
              {t.benefits.map((item) => (
                <span key={item}><Check size={15} aria-hidden="true" />{item}</span>
              ))}
            </div>

            <div className={styles.actions}>
              <Link className={styles.primary} href="/iletisim">
                {t.primary}<ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link className={styles.secondary} href="/hakkimizda">
                {t.secondary}
              </Link>
            </div>
            <p className={styles.note}>{t.note}</p>
          </div>

          <div className={styles.grid}>
            {t.services.map(({ title, text, icon: Icon }, index) => (
              <article className={styles.card} key={title}>
                <div className={styles.cardTop}>
                  <span className={styles.icon}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className={styles.number}>0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
