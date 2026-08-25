"use client";

import { useEffect, useState } from "react";
import { ArrowUp, PhoneCall } from "lucide-react";
import s from "./FloatingButtons.module.css";

const PHONE_DISPLAY = "0530 478 82 98";
const PHONE_HREF = "tel:+905304788298";

export default function FloatingButtons() {
  const [showTop, setShowTop] = useState(false);

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
