"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SiteError]", error);
  }, [error]);

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={styles.h1}>Bir Sorun Oluştu</h1>

        <p style={styles.desc}>
          Bu sayfada beklenmeyen bir hata meydana geldi. Sayfayı yenileyerek
          tekrar deneyebilirsiniz.
        </p>

        <div style={styles.actions}>
          <button onClick={() => reset()} style={styles.primaryBtn}>
            Tekrar Dene
          </button>

          <Link href="/" style={styles.secondaryBtn}>
            Ana Sayfa
          </Link>

          <Link href="/shop" style={styles.ghostBtn}>
            Mağaza
          </Link>
        </div>

        {error?.digest ? (
          <div style={styles.errorCode}>
            Referans: <code style={styles.code}>{error.digest}</code>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: "grid",
    placeItems: "center",
    minHeight: "55vh",
    padding: "40px 20px",
  },

  card: {
    width: "min(500px, 100%)",
    padding: "40px 32px",
    borderRadius: "28px",
    border: "1px solid rgba(11,15,25,0.08)",
    background:
      "radial-gradient(600px 300px at 50% 0%, rgba(220,38,38,0.04), transparent 50%), #fff",
    boxShadow: "0 24px 60px rgba(0,0,0,0.06)",
    textAlign: "center" as const,
  },

  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    borderRadius: "18px",
    background: "rgba(220,38,38,0.08)",
    color: "#b91c1c",
    marginBottom: "20px",
  },

  h1: {
    margin: "0 0 10px",
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: 950,
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
    color: "#0b0f19",
  },

  desc: {
    margin: "0 0 24px",
    fontSize: "14px",
    lineHeight: 1.6,
    fontWeight: 600,
    color: "rgba(11,15,25,0.55)",
  },

  actions: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    marginBottom: "18px",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "44px",
    padding: "0 20px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #0b0f19, #1e293b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(11,15,25,0.16)",
    fontFamily: "inherit",
  },

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "44px",
    padding: "0 20px",
    borderRadius: "14px",
    border: "1px solid rgba(11,15,25,0.12)",
    background: "#fff",
    color: "#0b0f19",
    fontSize: "13px",
    fontWeight: 900,
    textDecoration: "none",
    letterSpacing: "-0.02em",
  },

  ghostBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "44px",
    padding: "0 20px",
    borderRadius: "14px",
    border: "1px solid rgba(11,15,25,0.06)",
    background: "transparent",
    color: "rgba(11,15,25,0.55)",
    fontSize: "13px",
    fontWeight: 800,
    textDecoration: "none",
    letterSpacing: "-0.02em",
  },

  errorCode: {
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(11,15,25,0.3)",
  },

  code: {
    padding: "3px 8px",
    borderRadius: "8px",
    background: "rgba(11,15,25,0.05)",
    fontFamily: "monospace",
    fontSize: "11px",
    fontWeight: 700,
  },
};
