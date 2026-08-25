import Link from "next/link";
import s from "../checkout.module.css";

type Props = {
  orderKicker: string;
  title: string;
  subtitle: string;
  ssl: string;
  freeShipping: string;
  orderProtection: string;
  back: string;
};

export default function CheckoutHero({
  orderKicker,
  title,
  subtitle,
  ssl,
  freeShipping,
  orderProtection,
  back,
}: Props) {
  return (
    <section className={s.hero}>
      <div className={s.heroLeft}>
        <div className={s.kicker}>{orderKicker}</div>
        <h1 className={s.h1}>{title}</h1>
        <p className={s.heroText}>{subtitle}</p>

        <div className={s.heroBadges}>
          <span className={s.heroBadge}>{ssl}</span>
          <span className={s.heroBadge}>{freeShipping}</span>
          <span className={s.heroBadge}>{orderProtection}</span>
        </div>
      </div>

      <div className={s.heroRight}>
        <Link className={s.backLink} href="/cart">
          {back}
        </Link>
      </div>
    </section>
  );
}