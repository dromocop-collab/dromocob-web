"use client";

import Link from "next/link";
import { Globe2, Mail, Sparkles } from "lucide-react";
import ProjectStartButton from "./ProjectStartButton";
import s from "./studioChrome.module.css";

export default function StudioFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.footerGlow} />
      <div className={s.footerInner}>
        <section className={s.footerCta}>
          <div>
            <span><Sparkles /> Bir sonraki güçlü marka sizinki olsun.</span>
            <h2>Fikrinizi dijitalde<br /><em>unutulmaz hale getirelim.</em></h2>
          </div>
          <ProjectStartButton label="Proje başlatın" variant="light" />
        </section>
        <div className={s.footerGrid}>
          <div className={s.footerBrand}>
            <Link href="/" className={s.brand}><span>D</span><div><b>DROMOCOB</b><small>digital experience studio</small></div></Link>
            <p>Strateji, tasarım ve teknolojiyi birleştirerek sektörlere özel yüksek dönüşümlü web deneyimleri üretiyoruz.</p>
            <div><a href="/sektorler" aria-label="Sektörler"><Globe2 /></a><a href="/hakkimizda" aria-label="Stüdyo"><Sparkles /></a><a href="mailto:info@dromocob.tr" aria-label="E-posta"><Mail /></a></div>
          </div>
          <div><b>Keşfet</b><Link href="/#tasarimlar">Tüm tasarımlar</Link><Link href="/sektorler">Sektörler</Link><Link href="/hakkimizda">Stüdyo</Link></div>
          <div><b>Çözümler</b><Link href="/sektorler/e-ticaret-web-sitesi">E-ticaret web sitesi</Link><Link href="/sektorler/rent-a-car-web-sitesi">Araç kiralama sitesi</Link><Link href="/sektorler/kurumsal-web-sitesi">Kurumsal web sitesi</Link></div>
          <div><b>İletişim</b><a href="tel:+905304788298">0530 478 82 98</a><a href="mailto:info@dromocob.tr">info@dromocob.tr</a><a href="https://dromocob.tr">dromocob.tr</a><span><Globe2 /> Türkiye ve dünya çapında hizmet</span></div>
        </div>
        <div className={s.footerBottom}><span>© 2026 Dromocob Studio</span><span>Tasarımın ötesinde, dijital büyüme.</span></div>
      </div>
    </footer>
  );
}
