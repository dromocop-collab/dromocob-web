"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/useT";
import { getWhatsAppNumber, onWhatsAppNumberChange } from "@/lib/whatsapp";

function ImgBox({
  src,
  title,
  ratio = "16/10",
  label,
}: {
  src?: string;
  title: string;
  ratio?: string;
  label: string;
}) {
  const hasImage = !!String(src || "").trim();

  return (
    <div style={{
      overflow: "hidden",
      borderRadius: 28,
      border: "1px solid rgba(0,0,0,.06)",
      background: "#fff",
      boxShadow: "0 18px 50px rgba(16,24,40,.06)",
    }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: ratio }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg,#f8f4ec 0%,#efe7d8 100%)",
          }} />
        )}
      </div>

      <div style={{
        borderTop: "1px solid rgba(0,0,0,.06)",
        padding: "18px 22px",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase" as const,
          letterSpacing: "0.16em",
          color: "#b3871b",
        }}>
          {label}
        </div>
        <div style={{
          marginTop: 6,
          fontSize: 16,
          fontWeight: 900,
          color: "#101828",
        }}>
          {title}
        </div>
      </div>
    </div>
  );
}

const STATS_TR = [
  { value: "25+", label: "Yıllık Tecrübe" },
  { value: "10.000+", label: "Mutlu Müşteri" },
  { value: "5.000+", label: "Ürün Çeşidi" },
  { value: "%100", label: "Sertifikalı Ürün" },
];

const STATS_EN = [
  { value: "25+", label: "Years of Experience" },
  { value: "10,000+", label: "Happy Customers" },
  { value: "5,000+", label: "Product Variety" },
  { value: "100%", label: "Certified Products" },
];

const HIGHLIGHTS_TR = [
  { icon: "💎", title: "Sertifikalı Ürünler", text: "Tüm ürünlerimiz uluslararası standartlarda sertifikalıdır. Her parçanın ayar ve kalite belgesi mevcuttur." },
  { icon: "🔒", title: "Güvenli Alışveriş", text: "3D Secure ödeme altyapısı, SSL şifreleme ve sigortalı kargo ile güvenli bir alışveriş deneyimi sunuyoruz." },
  { icon: "🏪", title: "Fiziksel Mağaza", text: "dijital dünyada yer alan mağazamızda ürünlerimizi yakından inceleyebilir, uzman danışmanlarımızdan destek alabilirsiniz." },
  { icon: "🎁", title: "Hediye Danışmanlığı", text: "Özel günleriniz için en uygun hediye seçiminde size yardımcı oluyoruz. Ücretsiz hediye paketleme hizmetimiz mevcuttur." },
];

const HIGHLIGHTS_EN = [
  { icon: "💎", title: "Certified Products", text: "All our products are certified to international standards. Every piece comes with a quality and fineness certificate." },
  { icon: "🔒", title: "Secure Shopping", text: "We offer a secure shopping experience with 3D Secure payment infrastructure, SSL encryption and insured shipping." },
  { icon: "🏪", title: "Physical Store", text: "You can examine our products up close in our store located in the heart of İstanbul and get support from our expert consultants." },
  { icon: "🎁", title: "Gift Advisory", text: "We help you choose the most suitable gift for your special occasions. Our free gift wrapping service is available." },
];

const BELIEFS_TR = [
  "Her ürünümüz uluslararası standartlarda sertifikalıdır",
  "Şeffaf fiyatlandırma ve açık ürün bilgisi sunulur",
  "Ücretsiz iade ve değişim garantisi sunulur",
  "Sigortalı ve özel paketleme ile kargo gönderimi yapılır",
  "7/24 WhatsApp destek hattı ile her an yanınızdayız",
];

const BELIEFS_EN = [
  "All our products are certified to international standards",
  "Transparent pricing and clear product information",
  "Free return and exchange guarantee offered",
  "Insured and specially packaged shipping provided",
  "24/7 WhatsApp support line always available",
];

const CTA_CARDS_TR = [
  { title: "Telefon", text: "+90 555 000 00 00" },
  { title: "E-posta", text: "hello@dromocob.com" },
  { title: "Adres", text: "İstanbul · Demo Showroom" },
  { title: "Çalışma Saatleri", text: "Her gün 09:00 – 22:00" },
];

const CTA_CARDS_EN = [
  { title: "Phone", text: "+90 555 000 00 00" },
  { title: "Email", text: "hello@dromocob.com" },
  { title: "Address", text: "İstanbul · Demo Showroom" },
  { title: "Business Hours", text: "Every day 09:00 – 22:00" },
];

const GALLERY_TITLES_TR = ["Mağaza Dış Cephesi", "İç Mekân & Vitrin", "Marka & Detay Kareleri"];
const GALLERY_TITLES_EN = ["Store Exterior", "Interior & Display", "Brand & Detail Shots"];

export default function DromocobAboutPage() {
  const { t, loc } = useT();
  const [waNumber, setWaNumber] = useState(getWhatsAppNumber);

  useEffect(() => {
    return onWhatsAppNumberChange(setWaNumber);
  }, []);

  const stats = loc === "en" ? STATS_EN : STATS_TR;
  const highlights = loc === "en" ? HIGHLIGHTS_EN : HIGHLIGHTS_TR;
  const beliefs = loc === "en" ? BELIEFS_EN : BELIEFS_TR;
  const ctaCards = loc === "en" ? CTA_CARDS_EN : CTA_CARDS_TR;
  const galleryTitles = loc === "en" ? GALLERY_TITLES_EN : GALLERY_TITLES_TR;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ee", color: "#171717" }}>

      {/* ═══ Hero ═══ */}
      <section style={{
        position: "relative",
        overflow: "hidden",
        borderBottom: "1px solid rgba(0,0,0,.05)",
        background: "radial-gradient(circle at top left,rgba(212,175,55,.18),transparent 28%),linear-gradient(135deg,#fbf8f2 0%,#f4efe6 45%,#f8f5ef 100%)",
      }}>
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
          gap: 48,
          alignItems: "center",
          padding: "80px 32px",
        }}>
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              border: "1px solid rgba(212,175,55,.25)",
              background: "rgba(255,255,255,.70)",
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase" as const,
              color: "#8f6a16",
              backdropFilter: "blur(8px)",
            }}>
              {t("about_eyebrow")}
            </div>

            <h1 style={{
              maxWidth: 680,
              marginTop: 22,
              fontFamily: "'Playfair Display',Georgia,serif",
              fontSize: "clamp(36px,5vw,64px)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#101828",
            }}>
              {t("about_title")}
            </h1>

            <p style={{
              maxWidth: 580,
              marginTop: 22,
              fontFamily: "'Inter',system-ui,sans-serif",
              fontSize: 16,
              lineHeight: 1.8,
              color: "#475467",
              fontWeight: 500,
            }}>
              {t("about_desc")}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 14, marginTop: 28 }}>
              <Link href="/shop" style={{
                display: "inline-flex", alignItems: "center", borderRadius: 16,
                background: "#101828", padding: "14px 28px", fontSize: 14,
                fontWeight: 800, color: "#fff", textDecoration: "none",
                boxShadow: "0 12px 30px rgba(16,24,40,.16)",
              }}>
                {t("about_cta_primary")}
              </Link>
              <Link href="/iletisim" style={{
                display: "inline-flex", alignItems: "center", borderRadius: 16,
                border: "1px solid rgba(16,24,40,.12)", background: "#fff",
                padding: "14px 28px", fontSize: 14, fontWeight: 800,
                color: "#101828", textDecoration: "none",
              }}>
                {t("about_cta_secondary")}
              </Link>
            </div>
          </div>

          {/* Story Card */}
          <div style={{
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,.70)",
            background: "rgba(255,255,255,.70)",
            padding: 28,
            boxShadow: "0 20px 60px rgba(16,24,40,.10)",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{
              borderRadius: 22,
              border: "1px solid rgba(0,0,0,.05)",
              background: "#fffdfa",
              padding: 28,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 800,
                textTransform: "uppercase" as const,
                letterSpacing: "0.18em", color: "#b3871b", marginBottom: 16,
              }}>
                {t("about_story_title")}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.9, color: "#475467", fontWeight: 500 }}>
                {t("about_story_1")}
              </p>
              <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.9, color: "#475467", fontWeight: 500 }}>
                {t("about_story_2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Stats Band ═══ */}
      <section style={{
        background: "linear-gradient(135deg,#0f1728 0%,#18243b 55%,#22304c 100%)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: 0, padding: "0 32px",
        }}>
          {stats.map((stat, i) => (
            <div key={i} style={{
              padding: "44px 28px", textAlign: "center" as const,
              borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,.08)" : "none",
            }}>
              <div style={{
                fontFamily: "'Playfair Display',Georgia,serif",
                fontSize: "clamp(32px,4vw,52px)", fontWeight: 800,
                color: "#e6c874", lineHeight: 1,
              }}>
                {stat.value}
              </div>
              <div style={{
                marginTop: 10, fontFamily: "'Inter',system-ui,sans-serif",
                fontSize: 13, fontWeight: 700,
                color: "rgba(255,255,255,.65)", letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Gallery ═══ */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 32px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 12, fontWeight: 800,
            textTransform: "uppercase" as const,
            letterSpacing: "0.18em", color: "#b3871b",
          }}>
            {t("about_gallery_title")}
          </div>
          <h2 style={{
            marginTop: 10, fontFamily: "'Playfair Display',Georgia,serif",
            fontSize: "clamp(28px,4vw,48px)", fontWeight: 800,
            letterSpacing: "-0.03em", color: "#101828",
          }}>
            {t("about_gallery_sub")}
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20 }}>
          <ImgBox title={galleryTitles[0]} ratio="16/10" label={t("about_gallery_label")} />
          <div style={{ display: "grid", gap: 20 }}>
            <ImgBox title={galleryTitles[1]} ratio="4/3" label={t("about_gallery_label")} />
            <ImgBox title={galleryTitles[2]} ratio="4/3" label={t("about_gallery_label")} />
          </div>
        </div>
      </section>

      {/* ═══ Highlights ═══ */}
      <section style={{
        background: "#fff",
        borderTop: "1px solid rgba(0,0,0,.05)",
        borderBottom: "1px solid rgba(0,0,0,.05)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 32px" }}>
          <div style={{ textAlign: "center" as const, marginBottom: 44 }}>
            <div style={{
              fontSize: 12, fontWeight: 800,
              textTransform: "uppercase" as const,
              letterSpacing: "0.18em", color: "#b3871b",
            }}>
              {t("about_highlights_eyebrow")}
            </div>
            <h2 style={{
              marginTop: 10, fontFamily: "'Playfair Display',Georgia,serif",
              fontSize: "clamp(28px,4vw,44px)", fontWeight: 800,
              letterSpacing: "-0.03em", color: "#101828",
            }}>
              {t("about_highlights_title")}
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${highlights.length}, 1fr)`, gap: 20 }}>
            {highlights.map((item, i) => (
              <article key={i} style={{
                borderRadius: 24, border: "1px solid rgba(0,0,0,.06)",
                background: "#fcfaf6", padding: "32px 26px",
                boxShadow: "0 14px 40px rgba(16,24,40,.05)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: "linear-gradient(135deg,#f6edd5 0%,#ece0c0 100%)",
                  display: "grid", placeItems: "center", fontSize: 24, marginBottom: 18,
                }}>
                  {item.icon}
                </div>
                <h3 style={{
                  fontFamily: "'Inter',system-ui,sans-serif",
                  fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: "#101828",
                }}>
                  {item.title}
                </h3>
                <p style={{
                  marginTop: 10, fontFamily: "'Inter',system-ui,sans-serif",
                  fontSize: 14, lineHeight: 1.8, color: "#475467", fontWeight: 500,
                }}>
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Beliefs ═══ */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 800, textTransform: "uppercase" as const,
              letterSpacing: "0.18em", color: "#b3871b",
            }}>
              {t("about_beliefs_eyebrow")}
            </div>
            <h2 style={{
              marginTop: 14, fontFamily: "'Playfair Display',Georgia,serif",
              fontSize: "clamp(28px,4vw,44px)", fontWeight: 800,
              lineHeight: 1.1, letterSpacing: "-0.03em", color: "#101828",
            }}>
              {t("about_beliefs_title")}
            </h2>
          </div>

          <div>
            <p style={{
              fontFamily: "'Inter',system-ui,sans-serif",
              fontSize: 16, lineHeight: 1.8, color: "#475467", fontWeight: 500,
            }}>
              {t("about_beliefs_desc")}
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
              {beliefs.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  borderRadius: 16, border: "1px solid rgba(0,0,0,.06)",
                  background: "#fcfaf6", padding: "16px 20px",
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "linear-gradient(135deg,#d4af37,#b8941f)",
                    marginTop: 7, flexShrink: 0,
                  }} />
                  <p style={{
                    fontFamily: "'Inter',system-ui,sans-serif",
                    fontSize: 14, fontWeight: 600, lineHeight: 1.7, color: "#344054",
                  }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px 80px" }}>
        <div style={{
          borderRadius: 28, border: "1px solid rgba(0,0,0,.06)",
          background: "linear-gradient(135deg,#0f1728 0%,#18243b 55%,#22304c 100%)",
          padding: "56px 44px", color: "#fff",
          boxShadow: "0 24px 70px rgba(16,24,40,.18)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 44, alignItems: "center" }}>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 800, textTransform: "uppercase" as const,
                letterSpacing: "0.18em", color: "#e6c874",
              }}>
                {t("about_cta_eyebrow")}
              </div>
              <h2 style={{
                marginTop: 14, fontFamily: "'Playfair Display',Georgia,serif",
                fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em",
              }}>
                {t("about_cta_title")}
              </h2>
              <p style={{
                marginTop: 16, maxWidth: 520,
                fontFamily: "'Inter',system-ui,sans-serif",
                fontSize: 15, lineHeight: 1.8,
                color: "rgba(255,255,255,.72)", fontWeight: 500,
              }}>
                {t("about_cta_desc")}
              </p>

              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12, marginTop: 28 }}>
                <Link href="/iletisim" style={{
                  display: "inline-flex", alignItems: "center", borderRadius: 16,
                  background: "linear-gradient(135deg,#fff7df,#d9aa42)",
                  padding: "14px 26px", fontSize: 14, fontWeight: 900,
                  color: "#0f172a", textDecoration: "none",
                  boxShadow: "0 12px 28px rgba(212,175,55,.18)",
                }}>
                  {t("about_cta_contact")}
                </Link>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" style={{
                  display: "inline-flex", alignItems: "center", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,.14)",
                  padding: "14px 26px", fontSize: 14, fontWeight: 800,
                  color: "#fff", textDecoration: "none",
                }}>
                  WhatsApp
                </a>
              </div>
            </div>

            <div style={{
              borderRadius: 22, border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.06)", padding: 24,
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ display: "grid", gap: 12 }}>
                {ctaCards.map((card, i) => (
                  <div key={i} style={{
                    borderRadius: 16, border: "1px solid rgba(255,255,255,.08)",
                    background: "rgba(255,255,255,.05)", padding: "16px 20px",
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, textTransform: "uppercase" as const,
                      letterSpacing: "0.16em", color: "#e6c874",
                    }}>
                      {card.title}
                    </div>
                    <div style={{
                      marginTop: 6, fontFamily: "'Inter',system-ui,sans-serif",
                      fontSize: 16, fontWeight: 700,
                    }}>
                      {card.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
