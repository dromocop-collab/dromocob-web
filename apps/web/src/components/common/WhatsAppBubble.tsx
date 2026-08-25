"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "./whatsappBubble.module.css";

type Locale = "tr" | "en";

function getLocaleSafe(): Locale {
  try {
    // senin projede getLocale() varsa onu import edip kullanabilirsin
    const v = (typeof window !== "undefined" && (localStorage.getItem("locale") as any)) || "tr";
    return v === "en" ? "en" : "tr";
  } catch {
    return "tr";
  }
}

function waLink(phoneE164: string, text: string) {
  const clean = String(phoneE164 || "").replace(/[^\d+]/g, "");
  const msg = encodeURIComponent(text || "");
  // wa.me formatı: countrycode + number (başında + olmadan da olur ama biz güvenli koyalım)
  const noPlus = clean.startsWith("+") ? clean.slice(1) : clean;
  return `https://wa.me/${noPlus}?text=${msg}`;
}

export default function WhatsAppBubble({
  phone = "+90XXXXXXXXXX",
  brand = "Dromocob",
  position = "right",
}: {
  phone?: string;
  brand?: string;
  position?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<Locale>("tr");
  const fabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setLoc(getLocaleSafe());

    const onEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") closePanel();
      };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);
  function closePanel() {
    setOpen(false);
    // Panel kapanınca focus FAB'a dönsün (ARIA uyarısı biter)
    window.setTimeout(() => fabRef.current?.focus(), 0);
  }
  const copy = useMemo(() => {
    if (loc === "en") {
      return {
        tip: "Need help?",
        title: "WhatsApp Support",
        desc: "Write us. We reply fast.",
        cta: "Chat on WhatsApp",
        preset: `Hi! I have a question about my order / product.`,
      };
    }
    return {
      tip: "Yardıma mı ihtiyacın var?",
      title: "WhatsApp Destek",
      desc: "Yaz, hızlı dönelim.",
      cta: "WhatsApp’tan Yaz",
      preset: `Selam! ${brand} için ürün / sipariş hakkında bilgi alabilir miyim?`,
    };
  }, [loc, brand]);

  const href = useMemo(() => waLink(phone, copy.preset), [phone, copy.preset]);

  return (
    <div className={`${s.root} ${position === "left" ? s.left : s.right}`}>
      {/* mini panel */}
      <div className={`${s.panel} ${open ? s.open : ""}`}
  {...(!open ? ({ inert: "" } as any) : {})}
>
        <div className={s.panelTop}>
          <div className={s.dot} />
          <div className={s.panelText}>
            <div className={s.tip}>{copy.tip}</div>
            <div className={s.title}>{copy.title}</div>
            <div className={s.desc}>{copy.desc}</div>
          </div>

          <button className={s.close} onClick={closePanel} aria-label="Close" type="button">
            ✕
          </button>
        </div>

        <a className={s.cta} href={href} target="_blank" rel="noreferrer">
          <span className={s.waIcon} aria-hidden="true">
            {/* WhatsApp icon */}
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16 3C8.82 3 3 8.67 3 15.66c0 2.74.9 5.27 2.43 7.33L4 29l6.24-1.6a13.3 13.3 0 0 0 5.76 1.29c7.18 0 13-5.67 13-12.66C29 8.67 23.18 3 16 3Z"
                fill="currentColor"
                opacity="0.22"
              />
              <path
                d="M16 5.2c5.93 0 10.74 4.67 10.74 10.43S21.93 26.06 16 26.06c-1.93 0-3.75-.5-5.33-1.39l-3.66.94.98-3.43A10.2 10.2 0 0 1 5.26 15.63C5.26 9.87 10.07 5.2 16 5.2Z"
                fill="currentColor"
              />
              <path
                d="M12.85 11.35c.23-.53.47-.54.7-.55h.6c.2 0 .48.07.73.56.27.52.93 1.8 1.01 1.94.1.15.16.33.03.53-.12.2-.2.33-.38.51-.18.18-.37.4-.53.54-.17.14-.35.3-.15.59.2.29.9 1.44 1.93 2.34 1.33 1.16 2.45 1.52 2.8 1.69.34.16.55.14.76-.09.2-.22.87-.99 1.1-1.33.23-.34.46-.28.77-.16.31.11 1.96.9 2.3 1.07.34.16.57.24.65.37.08.13.08.77-.18 1.52-.26.75-1.52 1.44-2.09 1.5-.56.07-1.27.1-2.05-.13-.47-.13-1.08-.35-1.86-.68-3.27-1.38-5.4-4.63-5.56-4.84-.16-.21-1.33-1.71-1.33-3.25 0-1.54.83-2.3 1.12-2.62Z"
                fill="#0b0b0b"
                opacity="0.92"
              />
            </svg>
          </span>
          <span>{copy.cta}</span>
          <span className={s.arrow} aria-hidden="true">→</span>
        </a>
      </div>

      {/* button */}
      <button
  ref={fabRef}
  className={`${s.fab} ${open ? s.fabOpen : ""}`}
  onClick={() => (open ? closePanel() : setOpen(true))}
  type="button"
  aria-label="WhatsApp"
  aria-expanded={open}
>
        <span className={s.fabIcon} aria-hidden="true">💬</span>
        <span className={s.fabText}>WhatsApp</span>
      </button>
    </div>
  );
}