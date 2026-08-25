"use client";

import { useEffect, useState } from "react";

const COOKIE_KEY = "nci_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) {
        // İlk ziyarette kısa gecikmeyle göster
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage erişim hatası — gösterme
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(COOKIE_KEY, "accepted");
    } catch {
      // --
    }
    setVisible(false);
  }

  function decline() {
    try {
      localStorage.setItem(COOKIE_KEY, "declined");
    } catch {
      // --
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.icon}>🍪</div>

        <div style={styles.content}>
          <div style={styles.title}>Çerez ve Reklam Ölçümleme</div>
          <p style={styles.text}>
            Deneyiminizi iyileştirmek, site performansını analiz etmek ve reklam
            kampanyalarının etkinliğini ölçmek için çerezler ve izleme
            teknolojileri kullanıyoruz. Kabul ederek{" "}
            <a href="/cerez-politikasi" style={styles.link}>
              çerez politikamızı
            </a>{" "}
            ve{" "}
            <a href="/gizlilik-politikasi" style={styles.link}>
              gizlilik politikamızı
            </a>{" "}
            onaylamış olursunuz.
          </p>
        </div>

        <div style={styles.actions}>
          <button onClick={accept} style={styles.acceptBtn}>
            Kabul Et
          </button>
          <button onClick={decline} style={styles.declineBtn}>
            Reddet
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    padding: "16px",
    pointerEvents: "none",
    display: "flex",
    justifyContent: "center",
  },

  card: {
    pointerEvents: "auto",
    width: "min(600px, 100%)",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px 20px",
    borderRadius: "20px",
    border: "1px solid rgba(11,15,25,0.10)",
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(16px)",
    boxShadow:
      "0 -4px 40px rgba(0,0,0,0.08), 0 16px 50px rgba(0,0,0,0.12)",
    animation: "nciCookieSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
    flexWrap: "wrap" as const,
  },

  icon: {
    fontSize: "28px",
    lineHeight: 1,
    flexShrink: 0,
  },

  content: {
    flex: 1,
    minWidth: "180px",
  },

  title: {
    fontWeight: 900,
    fontSize: "14px",
    letterSpacing: "-0.02em",
    color: "#0b0f19",
    marginBottom: "2px",
  },

  text: {
    margin: 0,
    fontSize: "12.5px",
    fontWeight: 600,
    lineHeight: 1.5,
    color: "rgba(11,15,25,0.55)",
  },

  link: {
    color: "#0b0f19",
    fontWeight: 800,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },

  actions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },

  acceptBtn: {
    height: "38px",
    padding: "0 18px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #0b0f19, #1e293b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.02em",
    boxShadow: "0 8px 20px rgba(11,15,25,0.16)",
  },

  declineBtn: {
    height: "38px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(11,15,25,0.12)",
    background: "#fff",
    color: "#0b0f19",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.02em",
  },
};
