import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Layers3, Rocket, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { getMobileApp, mobileApps } from "@/data/mobileApps";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import s from "../mobileApps.module.css";

export function generateStaticParams(){ return mobileApps.map(app=>({slug:app.slug})); }
export function generateMetadata({params}:{params:{slug:string}}):Metadata{
  const app=getMobileApp(params.slug); if(!app) return {};
  return {title:`${app.name} | iOS ve Android Uygulama Örneği`,description:app.description,keywords:app.keywords,alternates:{canonical:`https://dromocob.tr/mobil-uygulama/${app.slug}`},openGraph:{title:`${app.name} Mobil Uygulama Tasarımı`,description:app.summary,images:[{url:app.image,alt:`${app.name} iOS ve Android uygulaması`}]}};
}

export default function MobileAppDetail({params}:{params:{slug:string}}){
  const app=getMobileApp(params.slug); if(!app) notFound();
  return <main className={s.page} style={{"--accent":app.accent} as React.CSSProperties}>
    <section className={s.detailHero}><div className={s.inner}><Link href="/mobil-uygulama-gelistirme" className={s.back}><ArrowLeft/> Tüm mobil uygulamalar</Link><div className={s.detailGrid}><div className={s.detailCopy}><span><Smartphone/> {app.eyebrow}</span><h1>{app.name}</h1><p>{app.description}</p><div className={s.platforms}><b>iOS</b><b>Android</b><b>Yönetim paneli</b></div><ProjectStartButton label="Bu uygulamayı markama uyarla" variant="light" mode="mobile"/></div><div className={s.detailImage}><Image src={app.image} alt={`${app.name} mobil uygulama ekranları`} fill priority sizes="(max-width:900px) 100vw, 54vw"/></div></div></div></section>
    <section className={s.section}><header><span>ÜRÜN KAPSAMI</span><h2>Satışa ve kullanıma hazır mobil deneyim.</h2></header><div className={s.featureGrid}>{app.features.map((x,i)=><article key={x}><i>0{i+1}</i><Check/><h3>{x}</h3><p>Kullanıcı yolculuğu, yönetim ihtiyacı ve ölçüm olaylarıyla birlikte projeye özel tasarlanır.</p></article>)}</div></section>
    <section className={s.darkSection}><div><span><Layers3/> TESLİM KAPSAMI</span><h2>Mağaza yayınına kadar<br/>tek ekip, tek sistem.</h2></div><ul>{app.deliverables.map(x=><li key={x}><ShieldCheck/><span><b>{x}</b><small>Tasarım, geliştirme, test ve yayın kontrol listesiyle teslim edilir.</small></span></li>)}</ul></section>
    <section className={s.process}><article><Sparkles/><b>01 · Keşif</b><p>Hedef, kullanıcı ve gelir modelini netleştiririz.</p></article><ArrowRight/><article><Layers3/><b>02 · Tasarım</b><p>Akışları ve yüksek kaliteli ekran sistemini kurarız.</p></article><ArrowRight/><article><Rocket/><b>03 · Geliştirme</b><p>iOS, Android, panel ve entegrasyonları tamamlarız.</p></article></section>
    <section className={s.cta}><div><span><Sparkles/> SİZE ÖZEL MOBİL ÜRÜN</span><h2>{app.name} deneyimini markanıza taşıyalım.</h2></div><ProjectStartButton label="Uygulama projesi başlat" variant="light" mode="mobile"/></section>
  </main>;
}
