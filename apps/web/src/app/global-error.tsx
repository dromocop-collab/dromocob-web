"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
        <main style={styles.main}>
          <div style={styles.bg} />

          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>

            <h1 style={styles.h1}>Bir Sorun Oluştu</h1>

            <p style={styles.desc}>
              Beklenmeyen bir hata meydana geldi. Lütfen sayfayı yenilemeyi
              deneyin veya daha sonra tekrar ziyaret edin.
            </p>

            <div style={styles.actions}>
              <button onClick={() => reset()} style={styles.primaryBtn}>
                Tekrar Dene
              </button>

              <a href="/" style={styles.secondaryBtn}>
                Ana Sayfaya Dön
              </a>
            </div>

            {error?.digest ? (
              <div style={styles.errorCode}>
                Hata kodu: <code style={styles.code}>{error.digest}</code>
              </div>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
    padding: "24px",
    overflow: "hidden",
  },

  bg: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background:
      "radial-gradient(800px 400px at 50% 30%, rgba(220,38,38,0.06), transparent 50%), " +
      "radial-gradient(600px 300px at 70% 70%, rgba(11,15,25,0.04), transparent 50%), " +
      "#fafafa",
  },

  card: {
    position: "relative",
    zIndex: 1,
    width: "min(520px, 100%)",
    padding: "48px 36px",
    borderRadius: "32px",
    border: "1px solid rgba(220,38,38,0.12)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 32px 90px rgba(0,0,0,0.08)",
    textAlign: "center" as const,
  },

  icon: {
    fontSize: "48px",
    marginBottom: "20px",
    lineHeight: 1,
  },

  h1: {
    margin: "0 0 12px",
    fontSize: "clamp(26px, 3.5vw, 36px)",
    fontWeight: 950,
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
    color: "#0b0f19",
  },

  desc: {
    margin: "0 0 28px",
    fontSize: "15px",
    lineHeight: 1.6,
    fontWeight: 600,
    color: "rgba(11,15,25,0.6)",
  },

  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    marginBottom: "20px",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "48px",
    padding: "0 24px",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(135deg, #0b0f19, #1e293b)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(11,15,25,0.18)",
    fontFamily: "inherit",
  },

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "48px",
    padding: "0 24px",
    borderRadius: "16px",
    border: "1px solid rgba(11,15,25,0.12)",
    background: "#fff",
    color: "#0b0f19",
    fontSize: "14px",
    fontWeight: 900,
    textDecoration: "none",
    letterSpacing: "-0.02em",
  },

  errorCode: {
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(11,15,25,0.35)",
  },

  code: {
    padding: "3px 8px",
    borderRadius: "8px",
    background: "rgba(11,15,25,0.06)",
    fontFamily: "monospace",
    fontSize: "11px",
    fontWeight: 700,
  },
};
