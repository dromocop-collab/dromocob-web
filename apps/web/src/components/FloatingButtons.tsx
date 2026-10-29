"use client";

import { useEffect, useState } from "react";
import { ArrowUp, PhoneCall } from "lucide-react";
import { getWhatsAppNumber, onWhatsAppNumberChange } from "@/lib/whatsapp";
import s from "./FloatingButtons.module.css";

const PHONE_DISPLAY = "0530 478 82 98";
const PHONE_HREF = "tel:+905304788298";
const WHATSAPP_TEXT = "Merhaba Cihat Erdem Studio, web sitesi için teklif almak istiyorum.";

export default function FloatingButtons() {
  const [showTop, setShowTop] = useState(false);
  const [whatsApp, setWhatsApp] = useState(getWhatsAppNumber);

  useEffect(() => onWhatsAppNumberChange(setWhatsApp), []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={s.dock} aria-label="Hızlı iletişim">
      <button
        type="button"
        className={`${s.topButton} ${showTop ? s.topButtonVisible : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Sayfanın başına dön"
      >
        <ArrowUp aria-hidden="true" />
      </button>

      <a
        className={s.whatsApp}
        href={`https://wa.me/${whatsApp}?text=${encodeURIComponent(WHATSAPP_TEXT)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp'tan yazın"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.19 4.23-9.42 9.43-9.42a9.37 9.37 0 0 1 9.42 9.43c0 5.2-4.23 9.42-9.43 9.42m8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.07c0 2 .52 3.95 1.51 5.66L.62 23.62l6.03-1.58a11.3 11.3 0 0 0 5.4 1.38h.01c6.24 0 11.32-5.08 11.33-11.33 0-3.02-1.18-5.87-3.32-8.01"/></svg>
        <span>WhatsApp</span>
      </a>

      <a className={s.phoneBubble} href={PHONE_HREF} aria-label={`${PHONE_DISPLAY} numarasını ara`}>
        <span className={s.rings} aria-hidden="true" />
        <span className={s.phoneIcon}><PhoneCall aria-hidden="true" /></span>
        <span className={s.phoneCopy}>
          <small>PROJENİZİ KONUŞALIM</small>
          <strong>{PHONE_DISPLAY}</strong>
        </span>
        <span className={s.live}><i /> Şimdi ulaşın</span>
      </a>
    </div>
  );
}
