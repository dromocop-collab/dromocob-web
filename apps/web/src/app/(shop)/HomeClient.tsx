"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, Building2, CarFront, Check, ChevronDown, Filter,
  HeartPulse, Hotel, LayoutGrid, Search, ShoppingBag, Sparkles,
  UtensilsCrossed, WandSparkles, X,
} from "lucide-react";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import { sectors, studioTemplates } from "@/data/studioCatalog";
import styles from "./HomeClient.module.css";
import cardStyles from "./HomeClientCards.module.css";
import MobileAppShowcase from "@/components/studio/MobileAppShowcase";
import RealPortfolioShowcase from "@/components/studio/RealPortfolioShowcase";

const iconBySector = {
  "rent-a-car-web-sitesi": CarFront,
  "e-ticaret-web-sitesi": ShoppingBag,
  "emlak-web-sitesi": Building2,
  "restoran-web-sitesi": UtensilsCrossed,
  "otel-web-sitesi": Hotel,
  "klinik-web-sitesi": HeartPulse,
  "kurumsal-web-sitesi": LayoutGrid,
} as const;

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export default function HomeClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  const [budget, setBudget] = useState("all");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => studioTemplates.filter((item) => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const haystack = [item.name, item.category, item.style, ...item.features].join(" ").toLocaleLowerCase("tr-TR");
    const budgetOk = budget === "all" || (budget === "under30" ? item.price < 30000 : budget === "30to40" ? item.price >= 30000 && item.price <= 40000 : item.price > 40000);
    return (!q || haystack.includes(q)) && (category === "all" || item.sector === category) && (style === "all" || item.style === style) && budgetOk;
  }), [query, category, style, budget]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroImage} /><div className={styles.heroShade} />
        <div className={styles.inner}>
          <span className={styles.kicker}><Sparkles size={15} /> Yeni nesil web tasarım stüdyosu</span>
          <h1>İşinize uygun siteyi<br /><em>dakikalar içinde keşfedin.</em></h1>
          <p>Hazır şablon değil; sektörünüze göre kurgulanmış, yönetim panelli ve satışa hazır dijital deneyimler.</p>
          <div className={styles.searchPanel}>
            <label><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Örn: araç kiralama, butik otel, e-ticaret..." />{query && <button onClick={() => setQuery("")} aria-label="Aramayı temizle"><X /></button>}</label>
            <button className={styles.filter} onClick={() => setOpen(!open)}><Filter /> Filtrele <ChevronDown /></button>
            <a href="#tasarimlar">Tasarımları bul <ArrowRight /></a>
            <div className={`${styles.filters} ${open ? styles.filtersOpen : ""}`}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tüm sektörler</option>{sectors.map((sector) => <option key={sector.slug} value={sector.slug}>{sector.shortName}</option>)}</select>
              <select value={style} onChange={(e) => setStyle(e.target.value)}><option value="all">Tüm stiller</option>{["Lüks", "Modern", "Minimal", "Editoryal", "Kurumsal", "Fütüristik"].map((item) => <option key={item}>{item}</option>)}</select>
              <select value={budget} onChange={(e) => setBudget(e.target.value)}><option value="all">Tüm bütçeler</option><option value="under30">30.000 TL altı</option><option value="30to40">30–40 bin TL</option><option value="over40">40.000 TL üzeri</option></select>
            </div>
          </div>
          <div className={styles.stats}><span><b>48+</b> özgün tasarım</span><span><b>12</b> sektör</span><span><b>7–21 gün</b> teslim</span><span><b>∞</b> özelleştirme</span></div>
        </div>
      </section>

      <section className={styles.section} id="sektorler">
        <header><div><span>SEKTÖRÜNÜ SEÇ</span><h2>Her iş için farklı bir dünya.</h2></div><p>Markanız hangi sektördeyse, dönüşüm sağlayan yapı ve özelliklerle oradan başlayın.</p></header>
        <div className={styles.categoryGrid}>
          {sectors.map((sector) => {
            const Icon = iconBySector[sector.slug as keyof typeof iconBySector];
            return (
              <Link key={sector.slug} href={`/sektorler/${sector.slug}`} className={styles.category} style={{ "--tone": sector.accent } as React.CSSProperties}>
                <div className={styles.visual}><Image src={sector.image} alt={`${sector.name} tasarım örneği`} fill sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, 25vw" /><span /><Icon /></div>
                <strong>{sector.shortName}</strong><small>{sector.eyebrow}</small><ArrowRight />
              </Link>
            );
          })}
          <button className={`${styles.category} ${styles.tone_gold}`} onClick={() => document.getElementById("tasarimlar")?.scrollIntoView({ behavior: "smooth" })}>
            <div className={styles.visual}><span /><WandSparkles /></div><strong>Size Özel</strong><small>Sıfırdan özgün tasarım</small><ArrowRight />
          </button>
        </div>
        <div className={styles.sectorMore}><Link href="/sektorler">Tüm sektör çözümlerini inceleyin <ArrowRight /></Link></div>
      </section>

      <section className={`${styles.section} ${styles.showcase}`} id="tasarimlar">
        <header><div><span>SEÇİLMİŞ DENEYİMLER</span><h2>Türk markaları için özgün tasarımlar.</h2></div><b className={styles.count}>{results.length} tasarım bulundu</b></header>
        <nav className={styles.chips} aria-label="Tasarım kategorileri"><button className={category === "all" ? styles.active : ""} onClick={() => setCategory("all")}>Tümü</button>{sectors.map((sector) => <button key={sector.slug} className={category === sector.slug ? styles.active : ""} onClick={() => setCategory(sector.slug)}>{sector.shortName}</button>)}</nav>
        {results.length ? (
          <div className={styles.grid}>
            {results.map((item, index) => (
              <article key={item.id} className={`${styles.card} ${cardStyles.card}`} style={{ "--accent": item.accent } as React.CSSProperties}>
                <Link href={`/demo/${item.slug}`} className={`${styles.mock} ${cardStyles.mock}`} aria-label={`${item.name} sitesini incele`}>
                  <Image src={item.image} alt={`${item.name} web sitesi küçük resmi`} fill sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, 33vw" />
                  <span className={`${styles.mockShade} ${cardStyles.mockShade}`} />
                  <span className={cardStyles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={`${styles.mockBadge} ${cardStyles.mockBadge}`}><i /> {item.category}</span>
                  <strong>{item.name}</strong>
                  <span className={`${styles.previewCta} ${cardStyles.previewCta}`}><span>Siteyi incele</span><i><ArrowRight /></i></span>
                </Link>
                <div className={`${styles.info} ${cardStyles.info}`}>
                  <div className={`${styles.meta} ${cardStyles.meta}`}><span>{item.category}</span><span>{item.style}</span></div>
                  <h3>{item.name}</h3>
                  <p className={cardStyles.cardSummary}>{sectors.find((sector) => sector.slug === item.sector)?.summary}</p>
                  <div className={`${styles.tags} ${cardStyles.tags}`}>{item.features.map((feature) => <small key={feature}><Check />{feature}</small>)}</div>
                  <footer className={cardStyles.footer}><div><small>Proje başlangıç bütçesi</small><b>{money.format(item.price)} TL</b></div><Link href={`/demo/${item.slug}`} aria-label={`${item.name} sitesini incele`}><span>Siteyi incele</span><i><ArrowRight /></i></Link></footer>
                </div>
              </article>
            ))}
          </div>
        ) : <div className={styles.empty}><Search /><h3>Uygun tasarım bulunamadı.</h3><button onClick={() => { setQuery(""); setCategory("all"); setStyle("all"); setBudget("all"); }}>Filtreleri temizle</button></div>}
      </section>

      <RealPortfolioShowcase />

      <MobileAppShowcase />

      <section className={styles.cta}>
        <div><span><WandSparkles /> TAMAMEN SİZE ÖZEL</span><h2>Aklınızdaki site burada yoksa,<br />birlikte sıfırdan tasarlayalım.</h2></div>
        <ProjectStartButton label="Projenizi anlatın" variant="light" />
      </section>
    </main>
  );
}
