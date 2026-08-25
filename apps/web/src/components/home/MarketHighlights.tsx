import s from "./marketHighlights.module.css";

const highlights = [
  { icon: "↗", label: "Hızlı teslimat", value: "1–3 iş günü", detail: "Sipariş takibiyle birlikte" },
  { icon: "↺", label: "Kolay iade", value: "30 gün", detail: "Şeffaf iade süreci" },
  { icon: "◎", label: "Güvenli ödeme", value: "3D Secure", detail: "Korunan ödeme altyapısı" },
  { icon: "◌", label: "Müşteri desteği", value: "7/24", detail: "Çok kanallı destek" },
];

export default function MarketHighlights() {
  return (
    <section className={s.section} aria-label="Dromocob mağaza avantajları">
      <div className={s.inner}>
        <div className={s.head}>
          <div className={s.headLeft}>
            <div className={s.kicker}>DROMOCOB STANDARDI</div>
            <h2 className={s.h2}>Alışverişin her adımı düşünülmüş.</h2>
          </div>
        </div>
        <div className={s.grid}>
          {highlights.map((item) => (
            <article key={item.label} className={s.card}>
              <div className={s.cardIcon}>{item.icon}</div>
              <div className={s.cardInfo}>
                <div className={s.cardLabel}>{item.label}</div>
                <div className={s.cardSell}>{item.value}</div>
                <div className={s.cardBuy}>{item.detail}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
