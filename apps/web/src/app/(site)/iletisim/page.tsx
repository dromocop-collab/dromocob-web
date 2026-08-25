"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/useT";
import { getWhatsAppNumber, onWhatsAppNumberChange } from "@/lib/whatsapp";
import s from "./IletisimPage.module.css";

type L = { tr: string; en: string };
function l(loc: "tr" | "en", v: L) { return v[loc]; }

const CONTACT = {
  storeName: "Bizim Dromocob",
  addressLine1: "İstanbul / Türkiye",
  addressLine2: " İstanbul · Demo Showroom",
  phone: "+90 555 000 00 00",
  email: "hello@dromocob.com",
  hours_tr: [
    { day: "Pazartesi - Cumartesi", time: "09:00 - 20:00" },
    { day: "Pazar", time: "Kapalı" },
  ],
  hours_en: [
    { day: "Monday - Saturday", time: "09:00 - 20:00" },
    { day: "Sunday", time: "Closed" },
  ],
  mapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3202.2156531492105!2d29.108407876367703!3d36.621195377768835!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14c041006acfdaa9%3A0x62c678db418cc34f!2sBizim%206nc%C4%B1%20e-ticaret%20m%C3%BCcevherat!5e0!3m2!1str!2str!4v1776168949519!5m2!1str!2str",
};

function ContactCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>{title}</h2>
        {desc ? <p className={s.cardDesc}>{desc}</p> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className={s.infoRow}>
      <div className={s.infoLabel}>{label}</div>
      <div className={s.infoValue}>
        {href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            className={s.infoLink}
          >
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function QuickStat({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className={s.quickStat}>
      <div className={s.quickStatTitle}>{title}</div>
      <div className={s.quickStatText}>{text}</div>
    </div>
  );
}

export default function IletisimPage() {
  const loc = useLocale();
  const [waNumber, setWaNumber] = useState(getWhatsAppNumber);

  useEffect(() => {
    return onWhatsAppNumberChange(setWaNumber);
  }, []);

  const phoneHref = `tel:${CONTACT.phone.replace(/\s+/g, "")}`;
  const whatsappHref = `https://wa.me/${waNumber}`;
  const mailHref = `mailto:${CONTACT.email}`;
  const mapsHref = CONTACT.mapEmbed.replace("&output=embed", "");

  const hours = loc === "en" ? CONTACT.hours_en : CONTACT.hours_tr;

  return (
    <main className={s.page}>
      <section className={s.heroSection}>
        <div className={s.heroShell}>
          <div className={s.heroGrid}>
            <div className={s.heroLeft}>
              <div className={s.badge}>
                {l(loc, { tr: "Premium Hizmet • Güvenli Alışveriş", en: "Premium Service • Secure Shopping" })}
              </div>

              <h1 className={s.heroTitle}>
                {l(loc, { tr: "İletişim", en: "Contact" })}
              </h1>

              <p className={s.heroText}>
                {l(loc, {
                  tr: "Soruların, sipariş taleplerin ya da mağaza ziyareti planın için bize kolayca ulaşabilirsin. Net bilgi, hızlı dönüş ve güven veren bir deneyim burada başlar.",
                  en: "You can easily reach us for questions, order requests, or planning a store visit. Clear information, fast response, and a trustworthy experience starts here.",
                })}
              </p>

              <div className={s.heroActions}>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.btn} ${s.btnPrimary}`}
                >
                  {l(loc, { tr: "WhatsApp'tan Yaz", en: "Message on WhatsApp" })}
                </a>

                <a href={phoneHref} className={`${s.btn} ${s.btnSecondary}`}>
                  {l(loc, { tr: "Hemen Ara", en: "Call Now" })}
                </a>

                <Link href="/shop" className={`${s.btn} ${s.btnGhost}`}>
                  {l(loc, { tr: "Mağazaya Dön", en: "Back to Shop" })}
                </Link>
              </div>
            </div>

            <div className={s.heroRight}>
              <div className={s.heroPanel}>
                <QuickStat title={l(loc, { tr: "Mağaza", en: "Store" })} text={CONTACT.storeName} />
                <QuickStat title={l(loc, { tr: "Telefon", en: "Phone" })} text={CONTACT.phone} />
                <QuickStat title={l(loc, { tr: "E-posta", en: "Email" })} text={CONTACT.email} />
                <QuickStat title={l(loc, { tr: "Konum", en: "Location" })} text={CONTACT.addressLine1} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.contentSection}>
        <div className={s.contentGrid}>
          <div className={s.leftCol}>
            <ContactCard
              title={l(loc, { tr: "Mağaza Bilgileri", en: "Store Information" })}
              desc={l(loc, { tr: "Temel iletişim kanalları ve mağaza bilgileri.", en: "Basic contact channels and store information." })}
            >
              <InfoRow label={l(loc, { tr: "Mağaza", en: "Store" })} value={CONTACT.storeName} />
              <InfoRow
                label={l(loc, { tr: "Adres", en: "Address" })}
                value={`${CONTACT.addressLine1} — ${CONTACT.addressLine2}`}
              />
              <InfoRow label={l(loc, { tr: "Telefon", en: "Phone" })} value={CONTACT.phone} href={phoneHref} />
              <InfoRow label={l(loc, { tr: "E-posta", en: "Email" })} value={CONTACT.email} href={mailHref} />
              <InfoRow
                label="WhatsApp"
                value={l(loc, { tr: "Hızlı iletişim için tıkla", en: "Click for quick contact" })}
                href={whatsappHref}
              />
            </ContactCard>

            <ContactCard
              title={l(loc, { tr: "Çalışma Saatleri", en: "Business Hours" })}
              desc={l(loc, {
                tr: "Ziyaret öncesi kısa bir mesaj atarsan yönlendirmeyi daha hızlı yaparız.",
                en: "Send us a quick message before your visit so we can assist you faster.",
              })}
            >
              <div className={s.hoursList}>
                {hours.map((item) => (
                  <div key={item.day} className={s.hourItem}>
                    <span className={s.hourDay}>{item.day}</span>
                    <span className={s.hourTime}>{item.time}</span>
                  </div>
                ))}
              </div>

              <div className={s.noteBox}>
                {l(loc, {
                  tr: "Düzen seviyoruz; e-ticaretta da iletişimde de dağınıklık yakışmaz. Gelmeden önce ulaşman işleri hızlandırır.",
                  en: "We value order; in lifestyle and in communication alike. Reaching out before your visit helps speed things up.",
                })}
              </div>
            </ContactCard>
          </div>

          <div className={s.rightCol}>
            <ContactCard
              title={l(loc, { tr: "Konum / Harita", en: "Location / Map" })}
              desc={l(loc, { tr: "Harita üzerinden doğrudan mağaza konumuna ulaşabilirsin.", en: "Find our store location directly on the map." })}
            >
              <div className={s.mapWrap}>
                <iframe
                  src={CONTACT.mapEmbed}
                  width="100%"
                  height="100%"
                  className={s.mapFrame}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={l(loc, { tr: "Mağaza Konumu", en: "Store Location" })}
                />
              </div>

              <div className={s.mapActions}>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.btn} ${s.btnPrimary}`}
                >
                  WhatsApp
                </a>

                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.btn} ${s.btnSecondary}`}
                >
                  {l(loc, { tr: "Haritada Aç", en: "Open in Maps" })}
                </a>
              </div>
            </ContactCard>
          </div>
        </div>
      </section>
    </main>
  );
}