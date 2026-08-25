"use client";

import Link from "next/link";
import { Globe2, Mail, Sparkles } from "lucide-react";
import ProjectStartButton from "./ProjectStartButton";
import s from "./studioChrome.module.css";
import brandAssets from "./BrandLogo.module.css";

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
            <Link href="/" className={s.brand}><span className={`${s.brandMark} ${brandAssets.logoBox}`}><img className={brandAssets.logoImg} src="/dromocob-app-icon-192.png" alt="" /></span><div><b>CIHAT ERDEM</b><small>web tasarım &amp; SEO stüdyosu</small></div></Link>
            <p>Strateji, tasarım ve teknolojiyi birleştirerek sektörlere özel yüksek dönüşümlü web deneyimleri üretiyoruz.</p>
            <div><a href="/sektorler" aria-label="Sektörler"><Globe2 /></a><a href="/hakkimizda" aria-label="Stüdyo"><Sparkles /></a><a href="mailto:info@dromocob.tr" aria-label="E-posta"><Mail /></a></div>
          </div>
          <div><b>Keşfet</b><Link href="/projelerimiz">Gerçek projeler</Link><Link href="/#tasarimlar">Tüm tasarımlar</Link><Link href="/sektorler">Sektörler</Link><Link href="/mobil-uygulama-gelistirme">Mobil uygulamalar</Link><Link href="/hakkimizda">Stüdyo</Link></div>
          <div><b>Çözümler</b><Link href="/sektorler/e-ticaret-web-sitesi">E-ticaret web sitesi</Link><Link href="/mobil-uygulama/e-ticaret-ios-android-uygulamasi">E-ticaret mobil uygulaması</Link><Link href="/mobil-uygulama/arac-kiralama-ios-android-uygulamasi">Araç kiralama uygulaması</Link></div>
          <div><b>İletişim</b><a href="tel:+905304788298">0530 478 82 98</a><a href="mailto:info@dromocob.tr">info@dromocob.tr</a><a href="https://dromocob.tr">dromocob.tr</a><span><Globe2 /> Türkiye ve dünya çapında hizmet</span></div>
        </div>
        <div className={s.footerBottom}><span>© 2026 Cihat Erdem Studio · Dromocob teknoloji markası</span><span>Tasarımın ötesinde, dijital büyüme.</span></div>
      </div>
    </footer>
  );
}
