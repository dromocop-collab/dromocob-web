import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Quote, ShieldCheck, Sparkles, Star } from "lucide-react";
import StudioFooter from "@/components/studio/StudioFooter";
import StudioHeader from "@/components/studio/StudioHeader";
import DesignQuoteButton from "@/components/studio/DesignQuoteButton";
import DemoExperienceLab from "./DemoExperienceLab";
import s from "./demo.module.css";
import lab from "./DemoExperienceLab.module.css";

const demos: Record<string, any> = {
  "bogaz-premium-arac-kiralama": { brand: "BOĞAZ PREMİUM", type: "rent", theme: "velocity", eyebrow: "SEÇKİN ARAÇ KİRALAMA", title: "Yolculuğunuz,\nstandartların üzerinde.", text: "Seçkin araç filosu, kusursuz rezervasyon deneyimi ve ayrıcalıklı hizmet.", cta: "Aracını seç", stats: [["120+", "Premium araç"], ["7/24", "Özel destek"], ["18", "Lokasyon"]], works: ["Uzun Yol", "Yönetici Sınıfı", "Şehir Performansı"] },
  "istanbul-moda-e-magaza": { brand: "İSTANBUL MODA", type: "shop", theme: "atelier", eyebrow: "YENİ SEZON / 2026", title: "Sessiz lüksün\nyeni formu.", text: "Güçlü siluetler, doğal dokular ve zamansız parçalarla hazırlanan yeni koleksiyon.", cta: "Koleksiyonu keşfet", stats: [["01", "Editoryal"], ["02", "Koleksiyon"], ["03", "Hikâyeler"]], works: ["Yumuşak Form", "Doğal Doku", "Gece Seçkisi"] },
  "marmara-seckin-gayrimenkul": { brand: "MARMARA SEÇKİN", type: "estate", theme: "estate", eyebrow: "SEÇKİN GAYRİMENKULLER", title: "Yaşamınıza değer\nkatan adresler.", text: "Şehrin seçkin lokasyonlarında uzman danışmanlığıyla benzersiz gayrimenkuller.", cta: "İlanları keşfet", stats: [["240+", "Seçkin portföy"], ["34", "Uzman"], ["12", "Şehir"]], works: ["Boğaz Evi", "Orman Rezidansı", "Sahil Villası"] },
  "sofra-istanbul-restoran": { brand: "SOFRA İSTANBUL", type: "food", theme: "noir", eyebrow: "TABAĞIN ÖTESİNDE", title: "Her tabakta\nyeni bir hikâye.", text: "Yerel malzemeler, çağdaş teknikler ve gecenin ritmiyle şekillenen gastronomi deneyimi.", cta: "Masa ayırt", stats: [["7 Aşama", "Tadım menüsü"], ["19:00", "Akşam servisi"], ["İstanbul", "Boğaz"]], works: ["Ateş ve Toprak", "Deniz Ritüeli", "Gece Tatlısı"] },
  "ege-butik-otel": { brand: "EGE BUTİK", type: "hotel", theme: "azure", eyebrow: "EGE'DE KAÇIŞ", title: "Zamanın yavaşladığı\nyerde uyanın.", text: "Ege'nin sakin kıyısında doğayla bütünleşen odalar ve kişiselleştirilmiş deneyimler.", cta: "Konaklamanı planla", stats: [["24", "Özel süit"], ["2", "Sonsuzluk havuzu"], ["1", "Unutulmaz kaçış"]], works: ["Ufuk Süiti", "Ege Ritüeli", "Özel Kıyı"] },
  "iyi-yasam-klinigi": { brand: "İYİ YAŞAM", type: "clinic", theme: "clarity", eyebrow: "BİLİM. ÖZEN. SİZ.", title: "Sağlığınız için\nnet bir yaklaşım.", text: "Alanında uzman hekimler, ileri teknoloji ve insan odaklı bütünsel sağlık hizmeti.", cta: "Randevu oluştur", stats: [["18", "Uzman hekim"], ["12B+", "Danışan"], ["4.9", "Memnuniyet"]], works: ["Kişisel Bakım", "Akıllı Tanı", "İyi Yaşam Planı"] },
  "vizyon-kurumsal": { brand: "VİZYON®", type: "corp", theme: "monolith", eyebrow: "GÜÇLÜ FİKİRLER ÜRETİRİZ", title: "Büyük fikirler.\nNet sonuçlar.", text: "Markaları strateji, tasarım ve teknolojiyle sektörlerinin önüne taşıyan bağımsız danışmanlık.", cta: "Birlikte çalışalım", stats: [["48", "Global proje"], ["11", "Ödül"], ["9", "Ülke"]], works: ["Cesur Kimlik", "Dijital Dönüşüm", "Gelecek Kültürü"] },
  "anadolu-e-ticaret": { brand: "ANADOLU", type: "shop", theme: "nexa", eyebrow: "GÜNLÜK, DAHA İYİ", title: "Yeni nesil alışveriş,\ntam sana göre.", text: "Trend ürünler, hızlı teslimat ve kişiselleştirilmiş keşif deneyimi tek platformda.", cta: "Alışverişe başla", stats: [["50B+", "Ürün"], ["24 saat", "Hızlı kargo"], ["4.8", "Müşteri puanı"]], works: ["Günlük Seçki", "Teknoloji", "Üretici Koleksiyonu"] },
  "yeni-nesil-elektrikli-arac": { brand: "YENİ NESİL:E", type: "rent", theme: "electric", eyebrow: "GELECEK HAREKET EDİYOR", title: "Sessiz. Güçlü.\nTamamen elektrikli.", text: "Şehir içi yolculuğu akıllı teknoloji ve sıfır emisyonla yeniden tanımlayın.", cta: "Sürüşünü başlat", stats: [["520 km", "Menzil"], ["18 dk", "Hızlı şarj"], ["0", "Emisyon"]], works: ["Şehir Ritmi", "Uzun Menzil", "Gece Sürüşü"] },
};

export default function DemoPage({ params }: { params: { slug: string } }) {
  const d = demos[params.slug];
  if (!d) notFound();
  const subject = d.type === "rent" ? "GT" : d.type === "estate" ? "VILLA" : d.type === "food" ? "CHEF" : d.type === "hotel" ? "SUITE" : d.type === "clinic" ? "CARE" : d.type === "corp" ? "A—01" : "DROP 01";
  const siteType = d.type === "rent" ? "Rent a Car" : d.type === "estate" ? "Gayrimenkul" : d.type === "food" ? "Restoran" : d.type === "hotel" ? "Otel & Turizm" : d.type === "clinic" ? "Sağlık" : d.type === "corp" ? "Kurumsal" : "E-Ticaret";
  return (
    <>
      <StudioHeader />
      <main className={`${s.demo} ${s[d.theme]}`}>
        <div className={s.topNotice}><Link href="/#tasarimlar"><ArrowLeft /> Tasarımlara dön</Link><span>CANLI DENEYİM · {d.brand}</span><DesignQuoteButton brand={d.brand} design={params.slug} siteType={siteType} label="Bu tasarımı iste" variant="notice" /></div>
        <div className={s.demoBar}><b>{d.brand}</b><span>SEÇKİN DENEYİM / 2026</span><small>SCROLL TO DISCOVER ↓</small></div>
        <section className={s.hero}>
          <div className={s.orb} />
          <div className={s.copy}><span><Sparkles /> {d.eyebrow}</span><h1>{d.title.split("\n").map((line: string, index: number) => <span key={line}>{line}{index === 0 && <br />}</span>)}</h1><p>{d.text}</p><a className={lab.heroCta} href="#deneyim-lab">{d.cta}<ArrowRight /></a></div>
          <div className={s.art}><div className={s.artFrame}><div className={s.artNav}><i /><i /><i /><span>LIVE / 01</span></div><div className={s.artSubject}>{subject}<small>{d.eyebrow}</small></div><div className={s.artLines}><i /><i /><i /></div></div></div>
        </section>
        <section className={s.stats}>{d.stats.map((item: string[]) => <div key={item[0]}><b>{item[0]}</b><span>{item[1]}</span></div>)}</section>
        <DemoExperienceLab type={d.type} brand={d.brand} />
        <section className={s.showcase}>
          <div className={s.sectionHead}><span>SELECTED / EXPERIENCES</span><h2>Her detayda<br /><em>kendine özgü.</em></h2><p>Sadece güzel görünen değil; markanın karakterini hissettiren, keşfetmesi keyifli ve dönüşüm odaklı dijital deneyimler.</p></div>
          <div className={s.workGrid}>{d.works.map((work: string, index: number) => <article key={work} className={index === 1 ? s.featuredWork : ""}><div><span>0{index + 1}</span><b>{subject}</b><i /></div><small>{d.eyebrow}</small><h3>{work}</h3><button aria-label={`${work} detayları`}><ArrowRight /></button></article>)}</div>
        </section>
        <section className={s.marquee}><div>STRATEGY <i /> EXPERIENCE <i /> TECHNOLOGY <i /> PERFORMANCE <i /> STRATEGY <i /> EXPERIENCE</div></section>
        <section className={s.features}><article><span>01</span><h2>Akıllı kullanıcı deneyimi</h2><p>Her ayrıntısı kullanıcı yolculuğuna göre tasarlanmış güçlü ve akıcı deneyim.</p><Check /></article><article><span>02</span><h2>Premium hizmet</h2><p>Güven veren içerik mimarisi, hızlı etkileşim ve yüksek dönüşüm odağı.</p><ShieldCheck /></article><article><span>03</span><h2>Her ekranda etkileyici</h2><p>Mobil, tablet ve masaüstünde karakterini koruyan kusursuz tasarım sistemi.</p><Star /></article></section>
        <section className={s.testimonial}><Quote /><blockquote>“Dijital deneyimimiz artık yalnızca markamızı anlatmıyor; müşterilerimizin karar verme biçimini de dönüştürüyor.”</blockquote><div><b>ELİF DEMİR</b><span>BRAND DIRECTOR / {d.brand}</span></div></section>
        <section className={s.demoCta}><span><CalendarDays /> PROJENİZİ HAYATA GEÇİRELİM</span><h2>Bu tasarımı markanıza<br />özel uyarlayalım.</h2><DesignQuoteButton brand={d.brand} design={params.slug} siteType={siteType} label="Teklif alın" /></section>
      </main>
      <StudioFooter />
    </>
  );
}

export function generateStaticParams() { return Object.keys(demos).map((slug) => ({ slug })); }
