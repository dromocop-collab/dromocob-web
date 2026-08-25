import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Gauge, SearchCheck, ShieldCheck, Sparkles } from "lucide-react";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import { getSector, sectors, studioTemplates } from "@/data/studioCatalog";
import s from "../sectors.module.css";

type Props = { params: { slug: string } };

export function generateStaticParams() { return sectors.map((sector) => ({ slug: sector.slug })); }

export function generateMetadata({ params }: Props): Metadata {
  const sector = getSector(params.slug);
  if (!sector) return {};
  const url = `https://dromocob.com/sektorler/${sector.slug}`;
  return {
    title: `${sector.name} Tasarımı ve Yazılımı`,
    description: sector.description,
    keywords: sector.keywords,
    alternates: { canonical: url },
    openGraph: { title: sector.title, description: sector.description, url, type: "website", images: [{ url: sector.image, alt: `${sector.name} tasarımı` }] },
    twitter: { card: "summary_large_image", title: sector.title, description: sector.description, images: [sector.image] },
  };
}

export default function SectorDetailPage({ params }: Props) {
  const sector = getSector(params.slug);
  if (!sector) notFound();
  const related = studioTemplates.filter((item) => item.sector === sector.slug).slice(0, 3);
  const url = `https://dromocob.com/sektorler/${sector.slug}`;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Service", name: sector.name, serviceType: sector.name, provider: { "@type": "Organization", name: "Dromocob", url: "https://dromocob.com" }, areaServed: { "@type": "Country", name: "Türkiye" }, url, description: sector.description },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: sector.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://dromocob.com" }, { "@type": "ListItem", position: 2, name: "Sektörler", item: "https://dromocob.com/sektorler" }, { "@type": "ListItem", position: 3, name: sector.name, item: url }] },
  ];

  return (
    <main className={s.page} style={{ "--accent": sector.accent } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className={s.detailHero}>
        <div className={s.detailGlow} />
        <div className={s.detailWrap}>
          <nav className={s.breadcrumb}><Link href="/">Ana Sayfa</Link><ChevronRight /><Link href="/sektorler">Sektörler</Link><ChevronRight /><span>{sector.shortName}</span></nav>
          <div className={s.detailGrid}>
            <div className={s.detailCopy}><span className={s.kicker}><Sparkles /> {sector.eyebrow}</span><h1>{sector.title}</h1><p>{sector.description}</p><div className={s.heroActions}><ProjectStartButton label="Bu çözümle proje başlat" /><a href="#ozellikler">Özellikleri incele <ArrowRight /></a></div><div className={s.trustRow}><span><Gauge /> Yüksek performans</span><span><SearchCheck /> Teknik SEO</span><span><ShieldCheck /> Güvenli altyapı</span></div></div>
            <div className={s.detailVisual}><Image src={sector.image} alt={`${sector.name} profesyonel web tasarımı`} fill priority sizes="(max-width: 920px) 100vw, 50vw" /><div><span>SEKTÖREL DENEYİM / 2026</span><b>{sector.shortName}</b><small>Dromocob tarafından tasarlandı</small></div></div>
          </div>
        </div>
      </section>

      <section className={s.featureSection} id="ozellikler">
        <div className={s.sectionIntro}><span>NELER DAHİL?</span><h2>İşletmenizin gerçek ihtiyaçlarına hazır.</h2><p>Görsel tasarım, teknik altyapı ve müşteri yolculuğu aynı hedef için birlikte çalışır.</p></div>
        <div className={s.featureGrid}>{sector.features.map((feature, index) => <article key={feature}><span>0{index + 1}</span><Check /><h3>{feature}</h3><p>{sector.shortName} iş modeline göre yapılandırılan, yönetilebilir ve geliştirilebilir modül.</p></article>)}</div>
      </section>

      <section className={s.benefitSection}>
        <div className={s.benefitImage}><Image src={sector.image} alt={`${sector.shortName} dijital deneyim örneği`} fill sizes="(max-width: 900px) 100vw, 48vw" /></div>
        <div className={s.benefitCopy}><span>DÖNÜŞÜM ODAKLI YAPI</span><h2>Sadece güzel değil,<br />iş üreten bir web sitesi.</h2>{sector.benefits.map((benefit, index) => <article key={benefit.title}><i>0{index + 1}</i><div><h3>{benefit.title}</h3><p>{benefit.text}</p></div></article>)}<ProjectStartButton label="Teklif ve yol haritası alın" variant="outline" /></div>
      </section>

      {related.length > 0 && <section className={s.relatedSection}><div className={s.sectionIntro}><span>ÖRNEK TASARIMLAR</span><h2>{sector.shortName} için seçilmiş deneyimler.</h2></div><div className={s.relatedGrid}>{related.map((item) => <Link href={`/demo/${item.slug}`} key={item.id}><div><Image src={item.image} alt={`${item.name} canlı demo`} fill sizes="(max-width: 760px) 100vw, 33vw" /></div><span>{item.style}</span><h3>{item.name}</h3><b>Canlı demoyu aç <ArrowRight /></b></Link>)}</div></section>}

      <section className={s.faqSection}><div className={s.sectionIntro}><span>SIK SORULAN SORULAR</span><h2>{sector.name} hakkında merak edilenler.</h2></div><div className={s.faqGrid}>{sector.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div></section>

      <section className={s.bottomCta}><span><Sparkles /> PROJENİZİ HAYATA GEÇİRELİM</span><h2>{sector.shortName} markanızı<br />dijitalde büyütelim.</h2><p>İş modelinizi birkaç adımda anlatın; size özel kapsam ve yol haritası hazırlayalım.</p><ProjectStartButton label="Proje briefini oluştur" variant="light" /></section>
    </main>
  );
}
