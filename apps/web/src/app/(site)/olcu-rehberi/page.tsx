"use client";

import Link from "next/link";
import { useT } from "@/lib/useT";
import styles from "./OlcuRehberiPage.module.css";

const ringSizes = [
  { circumference: "4.4 cm", eu: "44", us: "3", diameter: "14.0 mm" },
  { circumference: "4.6 cm", eu: "46", us: "3.75", diameter: "14.6 mm" },
  { circumference: "4.8 cm", eu: "48", us: "4.5", diameter: "15.3 mm" },
  { circumference: "5.0 cm", eu: "50", us: "5.25", diameter: "15.9 mm" },
  { circumference: "5.2 cm", eu: "52", us: "6", diameter: "16.6 mm" },
  { circumference: "5.4 cm", eu: "54", us: "6.75", diameter: "17.2 mm" },
  { circumference: "5.6 cm", eu: "56", us: "7.5", diameter: "17.8 mm" },
  { circumference: "5.8 cm", eu: "58", us: "8.25", diameter: "18.5 mm" },
  { circumference: "6.0 cm", eu: "60", us: "9", diameter: "19.1 mm" },
  { circumference: "6.2 cm", eu: "62", us: "10", diameter: "19.7 mm" },
];

export default function OlcuRehberiPage() {
  const { loc } = useT();
  const isEn = loc === "en";

  const braceletTips = isEn
    ? [
        "Measure your wrist with a tape or string without tightening too much.",
        "Add 1–1.5 cm comfort allowance for daily wear.",
        "If you prefer a looser feel, add 1.5–2 cm.",
        "For thicker bracelets, choosing a slightly roomier size is usually better.",
      ]
    : [
        "Bileğini çok sıkmadan mezura veya ip ile ölç.",
        "Ölçüye günlük kullanım için 1–1.5 cm konfor payı ekle.",
        "Daha dökümlü kullanım istiyorsan 1.5–2 cm ekle.",
        "Kalın bilekliklerde biraz daha rahat ölçü tercih et.",
      ];

  const necklaceGuide = isEn
    ? [
        { name: "40 cm", text: "Close to the neck, elegant and minimal." },
        { name: "45 cm", text: "The most classic necklace length for daily wear." },
        { name: "50 cm", text: "A more relaxed feel, great for layering." },
        { name: "55–60 cm", text: "For a longer and more visible look." },
      ]
    : [
        { name: "40 cm", text: "Boyna yakın, zarif ve minimal görünüm." },
        { name: "45 cm", text: "En klasik kolye boyu, günlük kullanım için ideal." },
        { name: "50 cm", text: "Biraz daha rahat duruş, katmanlı kullanım için iyi." },
        { name: "55–60 cm", text: "Daha uzun ve belirgin görünüm isteyenler için." },
      ];

  const faqItems = isEn
    ? [
        {
          q: "My finger size changes during the day. Which one should I trust?",
          a: "Measure under normal conditions, ideally during a neutral time of day when your hands are neither too cold nor too warm.",
        },
        {
          q: "How can I estimate the size if I am buying a gift?",
          a: "The safest method is to compare with an existing ring, bracelet, or lifestyle piece already in use.",
        },
        {
          q: "Will thick rings feel the same in the same size?",
          a: "Not always. For wider ring bands, choosing half or one size larger can often feel more comfortable.",
        },
        {
          q: "I am unsure about the right size. What should I do?",
          a: "The best move is to ask for direct support. The model type, width, and intended fit all matter.",
        },
      ]
    : [
        {
          q: "Parmağım sabah ve akşam farklı oluyor, hangisini baz almalıyım?",
          a: "Çok sıcak ya da çok soğuk olmayan zamanda, ideal olarak günün normal saatlerinde ölçüm yap.",
        },
        {
          q: "Hediye alıyorsam ölçüyü nasıl tahmin ederim?",
          a: "Mevcut yüzük, bileklik ya da sık kullandığı takı üzerinden karşılaştırma yapmak en güvenli yöntemdir.",
        },
        {
          q: "Kalın yüzüklerde aynı ölçü olur mu?",
          a: "Her zaman değil. Kalın formlarda bazen yarım ya da bir ölçü büyük tercih daha rahat olur.",
        },
        {
          q: "Kararsız kaldım, ne yapmalıyım?",
          a: "En mantıklısı danışman desteği almak. Böylece model tipine göre en doğru yönlendirme yapılır.",
        },
      ];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="px-container">
          <div className={styles.heroWrap}>
            <div className={styles.heroLeft}>
              <span className={styles.kicker}>
                {isEn ? "Size Guide" : "Ölçü Rehberi"}
              </span>

              <h1 className={styles.title}>
                {isEn
                  ? "The right size creates the right experience"
                  : "Doğru ölçü, doğru deneyim yaratır"}
              </h1>

              <p className={styles.desc}>
                {isEn
                  ? "A clean and practical guide designed to reduce sizing mistakes in rings, bracelets and necklaces. Less hesitation, lower return risk, stronger trust."
                  : "Yüzük, bileklik ve kolye seçiminde ölçü hatasını azaltmak için sade, net ve güven veren bir rehber. Kararsızlığı azaltır, iade riskini düşürür, müşteri deneyimini güçlendirir."}
              </p>

              <div className={styles.heroActions}>
                <Link href="/shop" className={styles.primaryBtn}>
                  {isEn ? "Explore Products" : "Ürünleri İncele"}
                </Link>
                <Link href="/iletisim" className={styles.secondaryBtn}>
                  {isEn ? "Get Assistance" : "Danışmanlık Al"}
                </Link>
              </div>
            </div>

            <div className={styles.heroCard}>
              <div className={styles.heroStat}>
                <strong>{isEn ? "Ring" : "Yüzük"}</strong>
                <span>
                  {isEn ? "Measured by circumference and diameter." : "Çevre ve çap bazlı ölçüm."}
                </span>
              </div>
              <div className={styles.heroStat}>
                <strong>{isEn ? "Bracelet" : "Bileklik"}</strong>
                <span>
                  {isEn ? "Comfort allowance matters." : "Konfor payı önemlidir."}
                </span>
              </div>
              <div className={styles.heroStat}>
                <strong>{isEn ? "Necklace" : "Kolye"}</strong>
                <span>
                  {isEn ? "Length should match both style and usage." : "Uzunluk, stile ve kullanıma göre seçilmelidir."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="px-container">
          <div className={styles.blockHead}>
            <span className={styles.eyebrow}>
              {isEn ? "Ring Sizing" : "Yüzük Ölçüsü"}
            </span>
            <h2 className={styles.blockTitle}>
              {isEn ? "How to measure ring size at home?" : "Evde yüzük ölçüsü nasıl alınır?"}
            </h2>
            <p className={styles.blockDesc}>
              {isEn
                ? "Use a thin strip of paper, string, or a measuring tape around the finger. The ring should pass the knuckle comfortably and still sit securely."
                : "Parmağı bir ip, ince şerit kâğıt ya da mezura ile ölç. Ölçüm noktası parmak ekleminden rahat geçmeli. Çok sıkı alma; akşam saatlerinde parmak biraz daha şiş olabilir."}
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNo}>01</div>
              <h3>{isEn ? "Use string or paper" : "İp veya şerit kullan"}</h3>
              <p>
                {isEn
                  ? "Wrap it around the finger, mark the meeting point and measure it with a ruler."
                  : "Parmağın çevresini sar, birleşim noktasını işaretle ve cetvelle ölç."}
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNo}>02</div>
              <h3>{isEn ? "Find the circumference" : "Çevreyi cm olarak bul"}</h3>
              <p>
                {isEn
                  ? "Compare the measured length with the chart below and choose the closest value."
                  : "Ölçtüğün uzunluğu tabloyla karşılaştır. En yakın değeri seç."}
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNo}>03</div>
              <h3>{isEn ? "Do not ignore the knuckle" : "Eklem payını unutma"}</h3>
              <p>
                {isEn
                  ? "If your knuckle is more prominent, choose a size that passes it comfortably while still sitting well."
                  : "Parmağın boğumluysa, eklemden geçecek ama parmakta rahat duracak ölçüyü seç."}
              </p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{isEn ? "Circumference" : "Çevre"}</th>
                  <th>EU</th>
                  <th>US</th>
                  <th>{isEn ? "Inner Diameter" : "İç Çap"}</th>
                </tr>
              </thead>
              <tbody>
                {ringSizes.map((row) => (
                  <tr key={row.eu}>
                    <td>{row.circumference}</td>
                    <td>{row.eu}</td>
                    <td>{row.us}</td>
                    <td>{row.diameter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.noteBox}>
            <strong>{isEn ? "Note:" : "Not:"}</strong>{" "}
            {isEn
              ? "If you are between two sizes, choosing the larger size is often the safer option."
              : "İki ölçü arasında kalıyorsan genelde bir büyük ölçü daha güvenlidir."}
          </div>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className="px-container">
          <div className={styles.twoCol}>
            <div className={styles.infoCard}>
              <span className={styles.eyebrow}>
                {isEn ? "Bracelet Size" : "Bileklik Ölçüsü"}
              </span>
              <h2 className={styles.blockTitle}>
                {isEn ? "Comfort allowance is essential" : "Bileklikte rahatlık payı şart"}
              </h2>
              <ul className={styles.list}>
                {braceletTips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.eyebrow}>
                {isEn ? "Necklace Length" : "Kolye Boyu"}
              </span>
              <h2 className={styles.blockTitle}>
                {isEn ? "Choose for style as well as fit" : "Boyuna göre değil, stile göre de seç"}
              </h2>

              <div className={styles.lengthList}>
                {necklaceGuide.map((item) => (
                  <div key={item.name} className={styles.lengthItem}>
                    <strong>{item.name}</strong>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="px-container">
          <div className={styles.faqWrap}>
            <div className={styles.blockHead}>
              <span className={styles.eyebrow}>
                {isEn ? "FAQ" : "Sık Sorulanlar"}
              </span>
              <h2 className={styles.blockTitle}>
                {isEn ? "Questions customers ask most" : "Müşterinin aklındaki kritik sorular"}
              </h2>
            </div>

            <div className={styles.faqGrid}>
              {faqItems.map((item) => (
                <div key={item.q} className={styles.faqCard}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className="px-container">
          <div className={styles.ctaBox}>
            <div>
              <span className={styles.eyebrow}>{isEn ? "Support" : "Destek"}</span>
              <h2 className={styles.ctaTitle}>
                {isEn
                  ? "If you are unsure, do not guess"
                  : "Ölçüden emin değilsen tahmin yürütme"}
              </h2>
              <p className={styles.ctaText}>
                {isEn
                  ? "Get quick WhatsApp support, request in-store assistance, or contact us directly before ordering."
                  : "WhatsApp üzerinden hızlı destek al, mağazada birebir danışmanlık iste ya da sipariş öncesi doğrudan bizimle iletişime geç."}
              </p>
            </div>

            <div className={styles.ctaActions}>
              <a
                href="https://wa.me/90XXXXXXXXXX"
                target="_blank"
                rel="noreferrer"
                className={styles.primaryBtn}
              >
                {isEn ? "WhatsApp Support" : "WhatsApp Destek"}
              </a>
              <Link href="/iletisim" className={styles.secondaryBtn}>
                {isEn ? "Contact Us" : "İletişime Geç"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}