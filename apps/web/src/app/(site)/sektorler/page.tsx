import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Layers3, Search, Sparkles } from "lucide-react";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import { sectors } from "@/data/studioCatalog";
import s from "./sectors.module.css";

export const metadata: Metadata = {
  title: "Sektörel Web Tasarım Çözümleri",
  description: "Rent a car, e-ticaret, emlak, restoran, otel, klinik ve kurumsal firmalar için SEO uyumlu, yönetim panelli web sitesi çözümleri.",
  keywords: ["sektörel web tasarım", "profesyonel web sitesi", "SEO uyumlu web sitesi", "web tasarım ajansı", "İstanbul web tasarım"],
  alternates: { canonical: "https://dromocob.com/sektorler" },
  openGraph: { title: "Sektörünüze Özel Web Tasarım Çözümleri", description: "Her sektörün satış ve iletişim modeline göre kurgulanan modern web deneyimleri.", url: "https://dromocob.com/sektorler", type: "website" },
};

export default function SectorsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Dromocob Sektörel Web Tasarım Çözümleri",
    url: "https://dromocob.com/sektorler",
    hasPart: sectors.map((sector) => ({ "@type": "Service", name: sector.name, url: `https://dromocob.com/sektorler/${sector.slug}`, description: sector.description })),
  };

  return (
    <main className={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className={s.indexHero}>
        <div className={s.orbA} /><div className={s.orbB} />
        <div className={s.wrap}>
          <span className={s.kicker}><Sparkles /> SEKTÖREL DİJİTAL DENEYİMLER</span>
          <h1>Her sektörün müşterisi farklı.<br /><em>Web sitesi de farklı olmalı.</em></h1>
          <p>Görünüşten fazlasını tasarlıyoruz. Arama davranışı, müşteri yolculuğu, satış modeli ve yönetim ihtiyacına göre sektörünüze özel dijital sistem kuruyoruz.</p>
          <div className={s.heroActions}><ProjectStartButton label="Sektörüme özel proje başlat" /><Link href="#cozumler">Çözümleri keşfet <ArrowRight /></Link></div>
          <div className={s.heroMetrics}><div><Search /><b>SEO</b><span>Arama niyeti odaklı</span></div><div><Layers3 /><b>Panel</b><span>Kolay yönetim</span></div><div><BarChart3 /><b>Dönüşüm</b><span>Ölçülebilir büyüme</span></div></div>
        </div>
      </section>

      <section className={s.indexSection} id="cozumler">
        <div className={s.sectionIntro}><span>UZMANLIK ALANLARI</span><h2>İş modelinize hazır bir başlangıç.</h2><p>Her çözüm; sektörün gerçek ihtiyaçlarına göre özellik, içerik ve SEO mimarisiyle hazırlanır.</p></div>
        <div className={s.sectorGrid}>
          {sectors.map((sector, index) => (
            <Link href={`/sektorler/${sector.slug}`} key={sector.slug} className={s.sectorCard} style={{ "--accent": sector.accent } as React.CSSProperties}>
              <div className={s.cardImage}><Image src={sector.image} alt={`${sector.name} örnek tasarımı`} fill sizes="(max-width: 760px) 100vw, 50vw" /><span>0{index + 1}</span></div>
              <div className={s.cardContent}><small>{sector.eyebrow}</small><h2>{sector.name}</h2><p>{sector.summary}</p><div>{sector.features.slice(0, 3).map((feature) => <span key={feature}><Check />{feature}</span>)}</div><b>Çözümü incele <ArrowRight /></b></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={s.bottomCta}><span><Sparkles /> DOĞRU SEKTÖRÜ BULAMADINIZ MI?</span><h2>İşinize özel dijital sistemi<br />birlikte kurgulayalım.</h2><p>İhtiyacınızı anlatın; strateji, tasarım ve teknoloji ekibimiz size özel yol haritası hazırlasın.</p><ProjectStartButton label="Ücretsiz ön görüşme başlat" variant="light" /></section>
    </main>
  );
}
