"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Mail, MapPin, MessageCircle, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import { getWhatsAppNumber, onWhatsAppNumberChange } from "@/lib/whatsapp";
import s from "./IletisimPage.module.css";

export default function IletisimPage() {
  const [whatsApp, setWhatsApp] = useState(getWhatsAppNumber);
  useEffect(() => onWhatsAppNumberChange(setWhatsApp), []);
  const whatsappUrl = `https://wa.me/${whatsApp}?text=${encodeURIComponent("Merhaba Dromocob, web projem hakkında görüşmek istiyorum.")}`;

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.grid} /><div className={s.glowA} /><div className={s.glowB} />
        <div className={s.wrap}>
          <span className={s.kicker}><Sparkles /> DROMOCOB PROJE OFİSİ</span>
          <h1>İyi fikirler bir mesajla başlar.<br /><em>Birlikte büyütelim.</em></h1>
          <p>Yeni web sitesi, e-ticaret altyapısı veya dijital ürün fikrinizi anlatın. Ekibimiz ihtiyacınızı analiz edip net bir yol haritasıyla size dönsün.</p>
          <div className={s.heroActions}><ProjectStartButton label="Proje briefini oluştur" /><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp’tan yaz</a></div>
          <div className={s.response}><span><i /> Şu anda yeni proje kabul ediyoruz</span><span><Clock3 /> Ortalama ilk dönüş: 24–48 saat</span></div>
        </div>
      </section>

      <section className={s.contactSection}>
        <div className={s.sectionHead}><span>İLETİŞİM KANALLARI</span><h2>Size en uygun yolu seçin.</h2><p>Projenizin kapsamı ne olursa olsun doğru uzmanla hızlıca eşleşin.</p></div>
        <div className={s.contactGrid}>
          <a href="mailto:hello@dromocob.com?subject=Yeni%20proje%20talebi" className={s.contactCard}><div><Mail /></div><small>E-POSTA</small><h3>hello@dromocob.com</h3><p>Dosya, kapsam veya referanslarınızı gönderin. Proje ekibimiz inceleyip yanıtlasın.</p><b>E-posta gönder <ArrowRight /></b></a>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className={s.contactCard}><div><MessageCircle /></div><small>HIZLI İLETİŞİM</small><h3>WhatsApp görüşmesi</h3><p>Kısa bir mesaj bırakın; ihtiyacınızı anlayıp doğru sonraki adımı birlikte belirleyelim.</p><b>Görüşmeyi başlat <ArrowRight /></b></a>
          <article className={s.contactCard}><div><MapPin /></div><small>PROJE OFİSİ</small><h3>İstanbul · Türkiye</h3><p>Türkiye’nin her yerine ve global markalara uzaktan strateji, tasarım ve geliştirme hizmeti.</p><b>Türkiye ve dünya çapında</b></article>
        </div>
      </section>

      <section className={s.process}>
        <div className={s.processIntro}><span><Workflow /> SÜREÇ NASIL İLERLER?</span><h2>Belirsizliği azaltan,<br />net bir başlangıç.</h2><p>Satış baskısı yerine doğru soruları soruyoruz. Böylece ilk görüşmede ihtiyacınıza uygun kapsamı netleştiriyoruz.</p><ProjectStartButton label="Ücretsiz ön görüşme başlat" variant="outline" /></div>
        <div className={s.steps}>
          <article><span>01</span><CheckCircle2 /><h3>Briefinizi paylaşın</h3><p>Sektör, hedef, özellik ve tasarım beklentinizi birkaç adımda anlatın.</p></article>
          <article><span>02</span><CheckCircle2 /><h3>Stratejik inceleme</h3><p>Ekibimiz kullanıcı yolculuğu, teknoloji ve SEO fırsatlarını analiz etsin.</p></article>
          <article><span>03</span><CheckCircle2 /><h3>Yol haritası alın</h3><p>Kapsam, takvim ve öncelikleri içeren şeffaf proje planıyla ilerleyin.</p></article>
        </div>
      </section>

      <section className={s.assurance}>
        <div><ShieldCheck /><span>GİZLİLİK VE GÜVEN</span><h2>Fikriniz güvende,<br />iletişiminiz net.</h2></div>
        <p>Paylaştığınız bilgiler yalnızca proje talebinizi değerlendirmek için kullanılır. Talebiniz size özel referans koduyla sisteme kaydedilir ve yetkili ekip tarafından görüntülenir.</p>
        <Link href="/gizlilik-politikasi">Gizlilik yaklaşımımız <ArrowRight /></Link>
      </section>

      <section className={s.finalCta}><span><Sparkles /> HAZIRSANIZ BAŞLAYALIM</span><h2>Markanızın yeni dijital<br />deneyimini birlikte tasarlayalım.</h2><ProjectStartButton label="Projemi başlat" variant="light" /></section>
    </main>
  );
}
