import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Braces, Check, Layers3, Orbit, SearchCheck, Sparkles, Target, Workflow, Zap } from "lucide-react";
import ProjectStartButton from "@/components/studio/ProjectStartButton";
import s from "./studioAbout.module.css";

const disciplines = [
  { icon: Target, title: "Dijital strateji", text: "Pazar, kullanıcı ve rakip sinyallerini doğru ürün kararlarına dönüştürüyoruz." },
  { icon: Layers3, title: "Deneyim tasarımı", text: "Markanın karakterini taşıyan, kullanımı sezgisel arayüz sistemleri kuruyoruz." },
  { icon: Braces, title: "Ürün geliştirme", text: "Hızlı, güvenli ve ölçeklenebilir web uygulamalarını modern teknolojiyle geliştiriyoruz." },
  { icon: SearchCheck, title: "SEO ve büyüme", text: "Teknik SEO, içerik mimarisi ve dönüşüm ölçümüyle görünürlüğü büyütüyoruz." },
];

const principles = ["İş hedefi tasarımdan önce gelir", "Her ekran ölçülebilir bir amaca hizmet eder", "Performans tasarımın ayrılmaz parçasıdır", "Sistemler yönetilebilir ve büyümeye hazır kurulur"];
const steps = [
  ["01", "Keşif", "Markayı, kullanıcıyı ve iş modelini anlamak için doğru sorularla başlarız."],
  ["02", "Strateji", "Bilgi mimarisini, dönüşüm yolunu ve teknik kapsamı görünür hale getiririz."],
  ["03", "Tasarım", "Özgün görsel dili çalışan prototiplere ve ölçeklenebilir sisteme dönüştürürüz."],
  ["04", "Geliştirme", "Deneyimi performanslı, güvenli ve yönetilebilir ürüne çeviririz."],
  ["05", "Büyüme", "Veriyi izler, öğrenir ve ürünü gerçek kullanıcı davranışıyla geliştiririz."],
];

export default function StudioAboutPage() {
  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.grid} /><div className={s.orbA} /><div className={s.orbB} />
        <div className={s.heroInner}>
          <div className={s.heroCopy}>
            <span className={s.kicker}><Sparkles /> INDEPENDENT DIGITAL EXPERIENCE STUDIO</span>
            <h1>Markaları değil,<br /><em>gelecekteki hallerini</em><br />tasarlıyoruz.</h1>
            <p>Dromocob; strateji, tasarım ve teknolojiyi tek masada buluşturan bağımsız dijital ürün stüdyosudur. Güçlü görünen değil, güçlü çalışan deneyimler üretir.</p>
            <div className={s.heroActions}><ProjectStartButton label="Birlikte proje başlat" /><Link href="/#tasarimlar">Seçilmiş işleri görün <ArrowRight /></Link></div>
          </div>
          <div className={s.heroVisual}>
            <div className={s.visualMain}><Image src="/portfolio/kurumsal-web-tasarim-v1.jpg" alt="Dromocob dijital deneyim stüdyosu çalışmaları" fill priority sizes="(max-width: 900px) 100vw, 46vw" /><span><b>48+</b> dijital deneyim</span></div>
            <div className={s.visualFloatA}><Image src="/portfolio/e-ticaret-web-tasarim-v1.jpg" alt="Dromocob e-ticaret deneyimi" fill sizes="240px" /></div>
            <div className={s.visualFloatB}><Orbit /><b>360°</b><span>STRATEGY TO SCALE</span></div>
          </div>
        </div>
        <div className={s.heroBand}><span>STRATEGY</span><i /><span>DESIGN SYSTEMS</span><i /><span>DEVELOPMENT</span><i /><span>GROWTH</span><i /><span>SEO</span></div>
      </section>

      <section className={s.manifesto}>
        <span>STÜDYO MANİFESTOSU / 01</span>
        <h2>Dijitalde fark yaratmak,<br />daha fazla efekt kullanmak değildir.</h2>
        <p>Doğru fikri sadeleştirmek, markanın özgün sesini bulmak ve her etkileşimi gerçek bir iş sonucuna bağlamaktır. Tasarımı süs değil; stratejik avantaj olarak görüyoruz.</p>
      </section>

      <section className={s.disciplines}>
        <header><div><span>NE YAPIYORUZ?</span><h2>Tek ekip.<br />Uçtan uca yetkinlik.</h2></div><p>Parçalı ajans süreçleri yerine stratejiden yayına kadar aynı ürün aklıyla ilerleyen kompakt bir stüdyo modeli.</p></header>
        <div className={s.disciplineGrid}>{disciplines.map(({ icon: Icon, title, text }, index) => <article key={title}><span>0{index + 1}</span><Icon /><h3>{title}</h3><p>{text}</p><i /></article>)}</div>
      </section>

      <section className={s.story}>
        <div className={s.storyVisual}><Image src="/portfolio/otel-web-tasarim-v1.jpg" alt="Dromocob tasarım ve teknoloji yaklaşımı" fill sizes="(max-width: 900px) 100vw, 50vw" /><div><span>İSTANBUL / TÜRKİYE</span><b>Yerelden doğan,<br />global düşünen stüdyo.</b></div></div>
        <div className={s.storyCopy}><span>NASIL DÜŞÜNÜYORUZ?</span><h2>Az katman.<br />Net sorumluluk.<br />Yüksek özen.</h2><p>Projenizi satıştan üretime aktaran kalabalık zincirler yok. Stratejist, tasarımcı ve geliştirici aynı hedefe bakar; kararlar daha hızlı, sonuç daha tutarlı olur.</p><div>{principles.map((item) => <span key={item}><Check />{item}</span>)}</div><ProjectStartButton label="Stüdyoyla tanışın" variant="outline" /></div>
      </section>

      <section className={s.process}>
        <header><span>ÇALIŞMA MODELİ / 02</span><h2>Belirsiz fikirden<br />çalışan ürüne.</h2></header>
        <div className={s.processLine}>{steps.map(([number, title, text]) => <article key={number}><div><span>{number}</span><Workflow /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className={s.impact}>
        <div><span>48+</span><p>tasarım sistemi ve dijital deneyim</p></div><div><span>7</span><p>uzmanlaştığımız sektör</p></div><div><span>100%</span><p>markaya özel tasarım yaklaşımı</p></div><div><span>∞</span><p>iyileştirme ve büyüme alanı</p></div>
      </section>

      <section className={s.finalCta}><Zap /><span>SONRAKİ GÜÇLÜ DENEYİM SİZİNKİ OLSUN</span><h2>İyi bir fikir varsa,<br />onu etkileyici hale getirebiliriz.</h2><p>Projenizi birkaç adımda anlatın; ekibimiz size özel kapsam ve yaratıcı yön önerisiyle ulaşsın.</p><ProjectStartButton label="Proje briefini oluştur" variant="light" /></section>
    </main>
  );
}
