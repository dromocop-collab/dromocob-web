import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Code2, Gauge, Layers3, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { mobileApps } from "@/data/mobileApps";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import s from "../mobil-uygulama/mobileApps.module.css";

export const metadata: Metadata = {
  title: "iOS ve Android Mobil Uygulama Geliştirme",
  description: "İstanbul merkezli iOS ve Android mobil uygulama geliştirme stüdyosu. E-ticaret, rezervasyon, hizmet ve kurumsal uygulamalar; tasarım, yazılım, panel ve mağaza yayını.",
  keywords: ["mobil uygulama geliştirme", "iOS uygulama geliştirme", "Android uygulama geliştirme", "mobil uygulama yaptırma", "İstanbul mobil uygulama ajansı"],
  alternates: { canonical: "https://dromocob.tr/mobil-uygulama-gelistirme" },
};

const strengths = [
  { icon: Layers3, title: "Ürün stratejisi", text: "Kullanıcı, gelir modeli ve operasyonu tek ürün yol haritasında buluşturuyoruz." },
  { icon: Code2, title: "Tek kod, güçlü ürün", text: "İhtiyaca göre native veya çapraz platform mimariyle iOS ve Android'i birlikte geliştiriyoruz." },
  { icon: Gauge, title: "Hız ve ölçüm", text: "Açılış süresi, çökme takibi, dönüşüm olayları ve mağaza performansı baştan planlanır." },
  { icon: ShieldCheck, title: "Güvenli altyapı", text: "Kimlik, ödeme, bildirim ve veri akışlarını güvenlik ve KVKK ilkeleriyle kuruyoruz." },
];

export default function MobileAppDevelopmentPage() {
  return <main className={s.page}>
    <section className={s.hero}><div className={s.heroGlow}/><div className={s.inner}><span><Smartphone/> IOS &amp; ANDROID PRODUCT STUDIO</span><h1>İşinizi kullanıcıların<br/><em>ana ekranına taşıyın.</em></h1><p>Fikirden mağaza yayınına; ürün stratejisi, UX/UI tasarım, mobil yazılım, yönetim paneli, entegrasyon ve büyüme analitiğini tek ekipte birleştiriyoruz.</p><div className={s.heroActions}><ProjectStartButton label="Uygulama projesi başlat" variant="light"/><a href="#uygulamalar">Örnekleri keşfet <ArrowRight/></a></div></div></section>
    <section className={s.section}><header><span>MOBİL ÜRÜN SİSTEMİ</span><h2>Sadece uygulama değil,<br/>çalışan bir dijital iş kuruyoruz.</h2></header><div className={s.strengthGrid}>{strengths.map(({icon:Icon,title,text})=><article key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className={s.section} id="uygulamalar"><header><span>SEÇİLMİŞ UYGULAMALAR</span><h2>Her sektör için farklı ürün deneyimi.</h2></header><div className={s.appGrid}>{mobileApps.map(app=><article key={app.slug} style={{"--accent":app.accent} as React.CSSProperties}><Link href={`/mobil-uygulama/${app.slug}`} className={s.image}><Image src={app.image} alt={`${app.name} mobil uygulama örneği`} fill sizes="(max-width:800px) 100vw, 33vw"/><i/></Link><div><span>{app.eyebrow}</span><h3>{app.name}</h3><p>{app.summary}</p><ul>{app.features.slice(0,4).map(x=><li key={x}><Check/> {x}</li>)}</ul><Link href={`/mobil-uygulama/${app.slug}`}>Uygulamayı incele <ArrowRight/></Link></div></article>)}</div></section>
    <section className={s.cta}><div><span><Sparkles/> ÜRÜNÜNÜZÜ BİRLİKTE TASARLAYALIM</span><h2>iOS ve Android&apos;de güçlü bir başlangıç.</h2></div><ProjectStartButton label="Proje kapsamını oluştur" variant="light"/></section>
  </main>;
}
