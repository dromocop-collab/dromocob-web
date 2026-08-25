"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CarFront, Check, ChevronDown, Filter, HeartPulse, Hotel, LayoutGrid, Search, ShoppingBag, Sparkles, UtensilsCrossed, WandSparkles, X } from "lucide-react";
import styles from "./HomeClient.module.css";

const categories = [
  ["rent-a-car","Rent a Car","Rezervasyon & filo",CarFront,"blue"], ["e-ticaret","E-Mağaza","Satış & ödeme",ShoppingBag,"orange"],
  ["emlak","Emlak","İlan & harita",Building2,"violet"], ["restoran","Restoran","Menü & rezervasyon",UtensilsCrossed,"red"],
  ["otel","Otel & Turizm","Oda & rezervasyon",Hotel,"cyan"], ["saglik","Sağlık & Klinik","Randevu & danışan",HeartPulse,"green"],
  ["kurumsal","Kurumsal","Güçlü marka sunumu",LayoutGrid,"slate"], ["ozel","Size Özel","Sıfırdan tasarım",WandSparkles,"gold"],
] as const;

const templates = [
  [1,"Velocity Black","rent-a-car","Rent a Car","Lüks",34900,"#4f7cff",["Online rezervasyon","Filo","Çok dil"]],
  [2,"Moda Atelier","e-ticaret","E-Mağaza","Editorial",42900,"#ff7657",["Ödeme","Kampanya","Ürün yönetimi"]],
  [3,"Estate Prime","emlak","Emlak","Kurumsal",38900,"#8b5cf6",["Akıllı filtre","Harita","Danışman"]],
  [4,"Noir Table","restoran","Restoran","Lüks",29900,"#e65252",["Dijital menü","Masa ayırt","Galeri"]],
  [5,"Azure Stay","otel","Otel & Turizm","Modern",44900,"#09a6c7",["Oda seçimi","Takvim","Rezervasyon"]],
  [6,"Clarity Clinic","saglik","Sağlık & Klinik","Minimal",32900,"#10a779",["Randevu","Uzmanlar","KVKK"]],
  [7,"Monolith Studio","kurumsal","Kurumsal","Brutalist",26900,"#334155",["Hizmetler","Projeler","Teklif formu"]],
  [8,"Nexa Commerce","e-ticaret","E-Mağaza","Modern",46900,"#ec4899",["Pazaryeri","Stok","Raporlama"]],
  [9,"Drive Electric","rent-a-car","Rent a Car","Fütüristik",36900,"#22c55e",["Hızlı rezervasyon","Lokasyon","Transfer"]],
] as const;
const money = new Intl.NumberFormat("tr-TR",{maximumFractionDigits:0});

export default function HomeClient(){
  const [query,setQuery]=useState(""); const [category,setCategory]=useState("all"); const [style,setStyle]=useState("all"); const [budget,setBudget]=useState("all"); const [open,setOpen]=useState(false);
  const results=useMemo(()=>templates.filter(i=>{const q=query.trim().toLocaleLowerCase("tr-TR"); const hay=[i[1],i[3],i[4],...i[7]].join(" ").toLocaleLowerCase("tr-TR"); const budgetOk=budget==="all"||(budget==="under30"?i[5]<30000:budget==="30to40"?i[5]>=30000&&i[5]<=40000:i[5]>40000); return(!q||hay.includes(q))&&(category==="all"||i[2]===category)&&(style==="all"||i[4]===style)&&budgetOk}),[query,category,style,budget]);
  const demoSlug=(name:string)=>name.toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  const choose=(id:string)=>{setCategory(id==="ozel"?"all":id);document.getElementById("tasarimlar")?.scrollIntoView({behavior:"smooth"})};
  return <main className={styles.page}>
    <section className={styles.hero}><div className={styles.heroImage}/><div className={styles.heroShade}/><div className={styles.inner}>
      <span className={styles.kicker}><Sparkles size={15}/> Yeni nesil web tasarım stüdyosu</span>
      <h1>İşinize uygun siteyi<br/><em>dakikalar içinde keşfedin.</em></h1>
      <p>Hazır şablon değil; sektörünüze göre kurgulanmış, yönetim panelli ve satışa hazır dijital deneyimler.</p>
      <div className={styles.searchPanel}>
        <label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Örn: lüks rent a car, modern e-mağaza..."/>{query&&<button onClick={()=>setQuery("")}><X/></button>}</label>
        <button className={styles.filter} onClick={()=>setOpen(!open)}><Filter/> Filtrele <ChevronDown/></button><a href="#tasarimlar">Tasarımları bul <ArrowRight/></a>
        <div className={`${styles.filters} ${open?styles.filtersOpen:""}`}>
          <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Tüm sektörler</option>{categories.slice(0,-1).map(c=><option key={c[0]} value={c[0]}>{c[1]}</option>)}</select>
          <select value={style} onChange={e=>setStyle(e.target.value)}><option value="all">Tüm stiller</option>{["Lüks","Modern","Minimal","Editorial","Kurumsal","Brutalist","Fütüristik"].map(x=><option key={x}>{x}</option>)}</select>
          <select value={budget} onChange={e=>setBudget(e.target.value)}><option value="all">Tüm bütçeler</option><option value="under30">30.000 TL altı</option><option value="30to40">30–40 bin TL</option><option value="over40">40.000 TL üzeri</option></select>
        </div>
      </div><div className={styles.stats}><span><b>48+</b> özgün tasarım</span><span><b>12</b> sektör</span><span><b>7–21 gün</b> teslim</span><span><b>∞</b> özelleştirme</span></div>
    </div></section>
    <section className={styles.section}><header><div><span>SEKTÖRÜNÜ SEÇ</span><h2>Her iş için farklı bir dünya.</h2></div><p>Markanız hangi sektördeyse, dönüşüm sağlayan yapı ve özelliklerle oradan başlayın.</p></header>
      <div className={styles.categoryGrid}>{categories.map((c,index)=>{const Icon=c[3];return <button key={c[0]} onClick={()=>choose(c[0])} className={`${styles.category} ${styles[`tone_${c[4]}`]}`}><div className={styles.visual} style={{"--pos":`${12+index*11}%`} as React.CSSProperties}><i/><Icon/></div><strong>{c[1]}</strong><small>{c[2]}</small><ArrowRight/></button>})}</div>
    </section>
    <section className={`${styles.section} ${styles.showcase}`} id="tasarimlar"><header><div><span>SEÇİLMİŞ DENEYİMLER</span><h2>Sıradan olmayan tasarımlar.</h2></div><b className={styles.count}>{results.length} tasarım bulundu</b></header>
      <nav className={styles.chips}><button className={category==="all"?styles.active:""} onClick={()=>setCategory("all")}>Tümü</button>{categories.slice(0,7).map(c=><button key={c[0]} className={category===c[0]?styles.active:""} onClick={()=>setCategory(c[0])}>{c[1]}</button>)}</nav>
      {results.length?<div className={styles.grid}>{results.map(i=><article key={i[0]} className={styles.card} style={{"--accent":i[6]} as React.CSSProperties}><div className={styles.mock}><div className={styles.bar}><i/><i/><i/><span/></div><div className={styles.mockHero}><small>{i[3]}</small><b>{i[1]}</b><span/></div><div className={styles.tiles}><i/><i/><i/></div></div><div className={styles.info}><div className={styles.meta}><span>{i[3]}</span><span>{i[4]}</span></div><h3>{i[1]}</h3><div className={styles.tags}>{i[7].map(t=><small key={t}><Check/>{t}</small>)}</div><footer><div><small>Başlangıç</small><b>{money.format(i[5])} TL</b></div><Link href={`/demo/${demoSlug(i[1])}`}>Canlı demoyu aç <ArrowRight/></Link></footer></div></article>)}</div>:<div className={styles.empty}><Search/><h3>Uygun tasarım bulunamadı.</h3><button onClick={()=>{setQuery("");setCategory("all");setStyle("all");setBudget("all")}}>Filtreleri temizle</button></div>}
    </section>
    <section className={styles.cta}><div><span><WandSparkles/> TAMAMEN SİZE ÖZEL</span><h2>Aklınızdaki site burada yoksa,<br/>birlikte sıfırdan tasarlayalım.</h2></div><Link href="/iletisim">Projenizi anlatın <ArrowRight/></Link></section>
  </main>
}
