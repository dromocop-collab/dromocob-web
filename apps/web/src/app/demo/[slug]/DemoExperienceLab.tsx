"use client";

import { Activity, ArrowRight, BarChart3, Check, Gauge, Layers3, MousePointer2, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import s from "./DemoExperienceLab.module.css";

type Module = { title: string; label: string; description: string; metric: string; metricLabel: string; features: string[] };
const content: Record<string, Module[]> = {
  rent: [
    { title: "Canlı filo ve müsaitlik", label: "FLEET / LIVE", description: "Lokasyon, tarih ve araç sınıfına göre gerçek zamanlı sonuç üreten rezervasyon motoru.", metric: "96%", metricLabel: "rezervasyon tamamlama", features: ["Anlık araç durumu", "Dinamik fiyat", "Ek hizmet seçimi"] },
    { title: "Akıllı teklif akışı", label: "QUOTE / SMART", description: "Ziyaretçinin ihtiyacını kısa adımlarla öğrenir, doğru aracı ve paketi önerir.", metric: "2.4x", metricLabel: "daha hızlı teklif", features: ["Hızlı form", "WhatsApp aktarımı", "CRM kaydı"] },
    { title: "Operasyon paneli", label: "OPS / CONTROL", description: "Rezervasyon, ödeme, bakım ve teslim operasyonlarını merkezden yönetin.", metric: "−38%", metricLabel: "operasyon yükü", features: ["Filo takvimi", "Hasar kayıtları", "Şube raporları"] },
  ],
  shop: [
    { title: "Kişiselleştirilmiş keşif", label: "COMMERCE / DISCOVERY", description: "Davranış sinyallerine göre ürün sıralaması ve akıllı önerilerle keşfi hızlandırır.", metric: "+41%", metricLabel: "ürün etkileşimi", features: ["Akıllı öneriler", "Hızlı filtre", "Editoryal koleksiyon"] },
    { title: "Dönüşüm odaklı sepet", label: "CART / CONVERT", description: "Sürtünmeyi azaltan sepet ve ödeme akışı, kampanya bilgisini doğru anda sunar.", metric: "+28%", metricLabel: "ödeme dönüşümü", features: ["Tek sayfa ödeme", "Sepet kurtarma", "Kupon motoru"] },
    { title: "Birleşik mağaza paneli", label: "OMNI / CONTROL", description: "Ürün, stok, sipariş ve kampanyaları tek gerçek zamanlı merkezde birleştirir.", metric: "24/7", metricLabel: "satış görünürlüğü", features: ["Stok senkronu", "Sipariş otomasyonu", "Canlı raporlama"] },
  ],
  estate: [
    { title: "Harita tabanlı keşif", label: "MAP / DISCOVERY", description: "Bölge, bütçe ve yaşam tercihlerini birleştiren akıllı portföy araması.", metric: "3.1x", metricLabel: "daha ilgili ilan", features: ["Çizerek arama", "Semt verileri", "Favori karşılaştırma"] },
    { title: "Nitelikli müşteri akışı", label: "LEAD / ROUTING", description: "Talebi portföy, lokasyon ve bütçeye göre doğru danışmana otomatik yönlendirir.", metric: "+52%", metricLabel: "nitelikli talep", features: ["Lead puanlama", "Danışman eşleme", "Otomatik takip"] },
    { title: "Proje sunum sistemi", label: "PROJECT / STORY", description: "Kat planı, konum, video ve yatırım verilerini etkileyici bir anlatıda toplar.", metric: "360°", metricLabel: "proje deneyimi", features: ["Sanal tur", "Kat planları", "Yatırım özeti"] },
  ],
  food: [
    { title: "Canlı dijital menü", label: "MENU / LIVE", description: "Stok, saat ve şubeye göre değişen görsel menü; hızlı seçim ve alerjen bilgisi.", metric: "+34%", metricLabel: "menü etkileşimi", features: ["Akıllı öneri", "Alerjen filtresi", "Anlık güncelleme"] },
    { title: "Masa rezervasyonu", label: "TABLE / BOOK", description: "Kapasiteyi gören, özel gün notlarını alan ve otomatik onay gönderen akış.", metric: "90 sn", metricLabel: "rezervasyon süresi", features: ["Masa planı", "SMS/e-posta onayı", "Bekleme listesi"] },
    { title: "Sadakat ve etkinlik", label: "GUEST / RETAIN", description: "Misafir tercihlerini, özel menüleri ve etkinlikleri tekrar ziyarete dönüştürür.", metric: "+26%", metricLabel: "tekrar ziyaret", features: ["Üye profili", "Etkinlik bileti", "Özel teklifler"] },
  ],
  hotel: [
    { title: "Doğrudan rezervasyon", label: "STAY / BOOK", description: "Oda, tarih, kişi ve deneyim seçimini tek akıcı yolculukta birleştirir.", metric: "+39%", metricLabel: "doğrudan rezervasyon", features: ["Canlı müsaitlik", "Paket karşılaştırma", "Güvenli ödeme"] },
    { title: "Deneyim yükseltme", label: "UPSELL / DELIGHT", description: "Transfer, spa, yemek ve özel anları doğru adımda kişiselleştirerek sunar.", metric: "+22%", metricLabel: "sepet değeri", features: ["Akıllı ek hizmet", "Kişisel paket", "Ön konaklama formu"] },
    { title: "Sezon ve kanal paneli", label: "REVENUE / CONTROL", description: "Fiyat, kontenjan ve paketleri dönemsel talebe göre merkezi olarak yönetin.", metric: "1 panel", metricLabel: "tüm kanallar", features: ["Fiyat takvimi", "Kanal senkronu", "Doluluk analizi"] },
  ],
  clinic: [
    { title: "Akıllı randevu", label: "CARE / BOOK", description: "Hizmet ihtiyacını doğru uzman ve uygun saatle eşleştiren sakin, güvenli akış.", metric: "70 sn", metricLabel: "randevu süresi", features: ["Uzman eşleme", "Takvim senkronu", "Otomatik hatırlatma"] },
    { title: "Güven veren içerik", label: "TRUST / INFORM", description: "Uzmanlık, süreç ve sık soruları anlaşılır biçimde sunan hizmet mimarisi.", metric: "+47%", metricLabel: "bilgi etkileşimi", features: ["Uzman profilleri", "Hizmet rehberi", "Çoklu dil"] },
    { title: "Güvenli danışan akışı", label: "PRIVACY / CARE", description: "KVKK onayları ve başvuruları rol tabanlı panelde güvenle yönetir.", metric: "100%", metricLabel: "izlenebilir süreç", features: ["KVKK akışı", "Yetkili erişim", "Başvuru durumu"] },
  ],
  corp: [
    { title: "Hizmet ve vaka mimarisi", label: "VALUE / STORY", description: "Karmaşık yetkinlikleri anlaşılır hizmetlere ve ikna edici vaka çalışmalarına dönüştürür.", metric: "+44%", metricLabel: "hizmet keşfi", features: ["Vaka çalışmaları", "Sektör sayfaları", "İçerik merkezi"] },
    { title: "Nitelikli teklif sistemi", label: "LEAD / QUALIFY", description: "Proje türü, bütçe ve zamanlamayı alarak satış ekibine temiz bir brief gönderir.", metric: "2.8x", metricLabel: "nitelikli brief", features: ["Akıllı form", "CRM entegrasyonu", "Lead puanlama"] },
    { title: "Çoklu pazar yönetimi", label: "GLOBAL / SCALE", description: "Dil, ülke ve ekip bazlı içerikleri tek sistemde ölçeklenebilir biçimde yönetir.", metric: "12+", metricLabel: "pazara hazır", features: ["Çoklu dil", "Bölgesel SEO", "Rol tabanlı panel"] },
  ],
};

export default function DemoExperienceLab({ type, brand }: { type: string; brand: string }) {
  const modules = useMemo(() => content[type] || content.corp, [type]);
  const [active, setActive] = useState(0);
  const selected = modules[active];

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % modules.length), 6500);
    return () => window.clearInterval(timer);
  }, [modules.length]);

  return (
    <section className={s.experienceLab} id="deneyim-lab">
      <div className={s.labHeader}><span><Sparkles /> INTERACTIVE EXPERIENCE / {brand}</span><h2>Sadece görünen değil,<br /><em>çalışan bir sistem.</em></h2><p>Modülleri seçin; bu demo deneyiminin müşteriyi nasıl karara taşıdığını keşfedin.</p></div>
      <div className={s.labShell}>
        <nav className={s.labTabs} aria-label="Demo özellik modülleri">{modules.map((item, index) => <button type="button" key={item.title} className={active === index ? s.labTabActive : ""} onClick={() => setActive(index)}><span>0{index + 1}</span><div><b>{item.title}</b><small>{item.label}</small></div><ArrowRight /></button>)}</nav>
        <div className={s.labCanvas} key={selected.title}>
          <div className={s.canvasTop}><span><i /><i /><i /> LIVE PRODUCT VIEW</span><b>{selected.label}</b></div>
          <div className={s.canvasGrid}>
            <div className={s.canvasCopy}><span><Activity /> AKTİF MODÜL</span><h3>{selected.title}</h3><p>{selected.description}</p><div>{selected.features.map((feature) => <span key={feature}><Check />{feature}</span>)}</div></div>
            <div className={s.metricOrb}><div className={s.metricRing}><i /><span>{selected.metric}</span></div><small>{selected.metricLabel}</small></div>
          </div>
          <div className={s.signalGrid}><div><Gauge /><span>PERFORMANS</span><b>98</b><i><em style={{ width: "98%" }} /></i></div><div><MousePointer2 /><span>ETKİLEŞİM</span><b>+42%</b><i><em style={{ width: "82%" }} /></i></div><div><BarChart3 /><span>DÖNÜŞÜM</span><b>4.8x</b><i><em style={{ width: "91%" }} /></i></div></div>
        </div>
      </div>
      <div className={s.journey}><article><span>01</span><Zap /><b>Keşfet</b><p>İlk saniyede değer önerisini anlar.</p></article><article><span>02</span><Layers3 /><b>Etkileş</b><p>İhtiyacına uygun içeriği hızla bulur.</p></article><article><span>03</span><Activity /><b>Güven</b><p>Kanıt, özellik ve akışla karar verir.</p></article><article><span>04</span><ArrowRight /><b>Dönüş</b><p>Teklif, rezervasyon veya satın alma tamamlanır.</p></article></div>
    </section>
  );
}
