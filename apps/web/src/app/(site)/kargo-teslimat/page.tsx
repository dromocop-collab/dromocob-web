"use client";

import Link from "next/link";
import { useLocale } from "@/lib/useT";
import s from "./KargoPage.module.css";

type L = { tr: string; en: string };
function l(loc: "tr" | "en", v: L) { return v[loc]; }

export default function KargoTeslimatPage() {
  const loc = useLocale();

  return (
    <main className={s.page}>
      <section className={s.heroSection}>
        <div className={s.heroShell}>
          <div className={s.heroGrid}>
            <div className={s.heroLeft}>
              <div className={s.badge}>
                {l(loc, { tr: "Güvenli Teslimat • Sigortalı Kargo", en: "Secure Delivery • Insured Shipping" })}
              </div>
              <h1 className={s.heroTitle}>
                {l(loc, { tr: "Kargo & Teslimat", en: "Shipping & Delivery" })}
              </h1>
              <p className={s.heroText}>
                {l(loc, {
                  tr: "Siparişin özenle paketlenir, sigortalı olarak kargoya teslim edilir ve takip numarasıyla sana güvenle ulaştırılır.",
                  en: "Your order is carefully packaged, delivered to the insured carrier, and safely delivered to you with a tracking number.",
                })}
              </p>
            </div>

            <div className={s.heroRight}>
              <div className={s.heroPanel}>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{l(loc, { tr: "Kargo Firması", en: "Carrier" })}</div>
                  <div className={s.quickStatText}>MNG Kargo</div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{l(loc, { tr: "Hazırlık", en: "Preparation" })}</div>
                  <div className={s.quickStatText}>{l(loc, { tr: "1-3 İş Günü", en: "1-3 Business Days" })}</div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{l(loc, { tr: "Teslimat", en: "Delivery" })}</div>
                  <div className={s.quickStatText}>{l(loc, { tr: "1-3 İş Günü", en: "1-3 Business Days" })}</div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{l(loc, { tr: "Sigorta", en: "Insurance" })}</div>
                  <div className={s.quickStatText}>{l(loc, { tr: "Tam Güvence", en: "Full Coverage" })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.contentSection}>
        <div className={s.contentGrid}>
          {/* Kargo Süreci */}
          <div className={`${s.card} ${s.cardFull}`}>
            <h2 className={s.cardTitle}>
              <span className={s.cardIcon}>📦</span>
              {l(loc, { tr: "Sipariş & Kargo Süreci", en: "Order & Shipping Process" })}
            </h2>
            <p className={s.cardDesc}>
              {l(loc, { tr: "Siparişiniz aşağıdaki adımlarla size ulaşır.", en: "Your order reaches you through the following steps." })}
            </p>

            <div className={s.stepGrid}>
              <div className={s.step}>
                <div className={s.stepNum}>1</div>
                <div className={s.stepTitle}>{l(loc, { tr: "Sipariş Alındı", en: "Order Received" })}</div>
                <div className={s.stepText}>
                  {l(loc, {
                    tr: "Ödemeniz onaylandıktan sonra siparişiniz hazırlanmaya başlar.",
                    en: "Your order starts being prepared after payment confirmation.",
                  })}
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNum}>2</div>
                <div className={s.stepTitle}>{l(loc, { tr: "Hazırlanıyor", en: "Preparing" })}</div>
                <div className={s.stepText}>
                  {l(loc, {
                    tr: "Ürününüz özenle kontrol edilir ve güvenli şekilde paketlenir.",
                    en: "Your product is carefully inspected and securely packaged.",
                  })}
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNum}>3</div>
                <div className={s.stepTitle}>{l(loc, { tr: "Kargoya Verildi", en: "Shipped" })}</div>
                <div className={s.stepText}>
                  {l(loc, {
                    tr: "Paketiniz MNG Kargo'ya teslim edilir ve takip numarası oluşur.",
                    en: "Your package is handed to MNG Cargo and a tracking number is generated.",
                  })}
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNum}>4</div>
                <div className={s.stepTitle}>{l(loc, { tr: "Teslim Edildi", en: "Delivered" })}</div>
                <div className={s.stepText}>
                  {l(loc, {
                    tr: "Gönderiniz adresinize güvenle ulaştırılır.",
                    en: "Your shipment is safely delivered to your address.",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Kargo Bilgileri */}
          <div className={s.card}>
            <h2 className={s.cardTitle}>
              <span className={s.cardIcon}>🚚</span>
              {l(loc, { tr: "Kargo Bilgileri", en: "Shipping Details" })}
            </h2>
            <p className={s.cardDesc}>
              {l(loc, { tr: "Teslimat süreleri ve kargo detayları.", en: "Delivery times and shipping details." })}
            </p>

            <div className={s.infoList}>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Kargo Firması", en: "Carrier" })}</span>
                <span className={s.infoValue}>MNG Kargo</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Hazırlık Süresi", en: "Preparation Time" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "1-3 iş günü", en: "1-3 business days" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Teslimat Süresi", en: "Delivery Time" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "1-3 iş günü", en: "1-3 business days" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Kargo Takip", en: "Tracking" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Hesabım → Kargo Takip", en: "My Account → Shipment Tracking" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Sigorta", en: "Insurance" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Tam sigorta kapsamında", en: "Full insurance coverage" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Teslimat Alanı", en: "Delivery Area" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Türkiye geneli", en: "Turkey-wide" })}</span>
              </div>
            </div>
          </div>

          {/* Paketleme */}
          <div className={s.card}>
            <h2 className={s.cardTitle}>
              <span className={s.cardIcon}>🎁</span>
              {l(loc, { tr: "Paketleme & Güvenlik", en: "Packaging & Security" })}
            </h2>
            <p className={s.cardDesc}>
              {l(loc, { tr: "Her ürün özel paketleme ile gönderilir.", en: "Every product is shipped with special packaging." })}
            </p>

            <div className={s.infoList}>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Standart Paket", en: "Standard Package" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Özel marka kutusu", en: "Branded box" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Hediye Paketi", en: "Gift Wrap" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Opsiyonel (checkout'ta)", en: "Optional (at checkout)" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Sertifika", en: "Certificate" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Kutuya dahil", en: "Included in box" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Koruma", en: "Protection" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "Darbe emici ambalaj", en: "Shock-absorbing packaging" })}</span>
              </div>
              <div className={s.infoRow}>
                <span className={s.infoLabel}>{l(loc, { tr: "Fatura", en: "Invoice" })}</span>
                <span className={s.infoValue}>{l(loc, { tr: "E-fatura (e-posta ile)", en: "E-invoice (via email)" })}</span>
              </div>
            </div>

            <div className={s.noteBox}>
              {l(loc, {
                tr: "Tüm kargo gönderileri sigortalıdır. Kargo sürecinde oluşabilecek hasar durumlarında tarafımıza ulaşmanız yeterlidir. Gerekli işlemler en kısa sürede başlatılır.",
                en: "All shipments are insured. In case of damage during the shipping process, simply contact us. Necessary procedures will be initiated promptly.",
              })}
            </div>
          </div>
        </div>

        <div className={s.ctaSection}>
          <h2 className={s.ctaTitle}>
            {l(loc, { tr: "Kargo hakkında sorun mu var?", en: "Having issues with shipping?" })}
          </h2>
          <p className={s.ctaText}>
            {l(loc, {
              tr: "Kargo takibi, teslimat sorunları veya paket hasarı için hemen bizimle iletişime geçin.",
              en: "Contact us immediately for tracking, delivery issues, or package damage.",
            })}
          </p>
          <div className={s.ctaActions}>
            <Link href="/iletisim" className={`${s.btn} ${s.btnPrimary}`}>
              {l(loc, { tr: "İletişim", en: "Contact" })}
            </Link>
            <Link href="/sss" className={`${s.btn} ${s.btnSecondary}`}>
              {l(loc, { tr: "Sıkça Sorulan Sorular", en: "FAQ" })}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
