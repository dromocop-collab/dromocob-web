import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Rocket, Sparkles } from "lucide-react";
import { realPortfolio } from "@/data/realPortfolio";
import s from "./RealPortfolioShowcase.module.css";

export default function RealPortfolioShowcase({ full = false }: { full?: boolean }) {
  const projects = full ? realPortfolio : realPortfolio.slice(0, 6);
  return <section className={`${s.section} ${full ? s.full : ""}`} id="gercek-projeler">
    <div className={s.orb}/><header><div><span><Sparkles/> CANLIYA ALINMIŞ ÜRÜNLER</span><h2>Örnek değil.<br/><em>Gerçekten çalışan sistemler.</em></h2></div><p>Cihat Erdem Studio ve Dromocob tarafından tasarlanan; gerçek markalar, kullanıcılar ve operasyonlar için yayına alınmış web ve mobil ürünler.</p></header>
    <div className={s.metrics}><span><b>{realPortfolio.length}</b> seçilmiş ürün</span><span><b>Web · iOS · SaaS</b> tek ürün yaklaşımı</span><span><b><i/> CANLI</b> gerçek kullanım</span></div>
    <div className={s.grid}>{projects.map((project,index)=><article key={project.slug} className={s.card} style={{"--accent":project.accent} as React.CSSProperties}>
      <div className={s.visual}><Image src={project.image} alt={`${project.name} ${project.kind} projesi`} fill sizes="(max-width:760px) 100vw, (max-width:1100px) 50vw, 33vw"/><i/><span>{String(index+1).padStart(2,"0")}</span><b>{project.kind}</b></div>
      <div className={s.copy}><div className={s.meta}><span>{project.sector}</span><span><i/> YAYINDA</span></div><h3>{project.name}</h3><p>{project.summary}</p><ul>{project.features.map(feature=><li key={feature}><Check/>{feature}</li>)}</ul><footer>{project.caseUrl ? <a href={project.caseUrl} target="_blank" rel="noreferrer">Vaka çalışması <ArrowRight/></a> : <span/>}{project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={`${project.name} canlı ürünü aç`}><ExternalLink/> Canlı ürünü aç</a>}</footer></div>
    </article>)}</div>
    {!full && <div className={s.more}><Link href="/projelerimiz"><Rocket/> Tüm gerçek projeleri keşfet <ArrowRight/></Link></div>}
  </section>;
}
