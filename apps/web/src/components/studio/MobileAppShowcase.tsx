import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Smartphone, Sparkles } from "lucide-react";
import { mobileApps } from "@/data/mobileApps";
import s from "./MobileAppShowcase.module.css";

export default function MobileAppShowcase() {
  return (
    <section className={s.section} id="mobil-uygulamalar">
      <div className={s.heading}>
        <div><span><Smartphone /> iOS &amp; ANDROID ÜRÜN STÜDYOSU</span><h2>Fikriniz, kullanıcıların<br /><em>ana ekranında.</em></h2></div>
        <div><p>Markanıza özel, App Store ve Google Play&apos;e hazır; hızlı, ölçülebilir ve yönetim panelli mobil ürünler.</p><Link href="/mobil-uygulama-gelistirme">Tüm mobil çözümler <ArrowRight /></Link></div>
      </div>
      <div className={s.grid}>
        {mobileApps.map((app, index) => (
          <article key={app.slug} style={{ "--accent": app.accent } as React.CSSProperties}>
            <Link href={`/mobil-uygulama/${app.slug}`} className={s.visual}>
              <Image src={app.image} alt={`${app.name} iOS ve Android mobil uygulama tasarımı`} fill sizes="(max-width: 800px) 100vw, 33vw" />
              <span className={s.shade} /><i>0{index + 1}</i><b><Sparkles /> UYGULAMAYI İNCELE</b>
            </Link>
            <div className={s.body}><span>{app.eyebrow}</span><h3>{app.name}</h3><p>{app.summary}</p><div>{app.features.slice(0, 3).map((feature) => <small key={feature}><Check /> {feature}</small>)}</div><Link href={`/mobil-uygulama/${app.slug}`}>Örnek projeyi incele <ArrowRight /></Link></div>
          </article>
        ))}
      </div>
    </section>
  );
}
