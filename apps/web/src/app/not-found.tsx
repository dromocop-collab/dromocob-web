import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | Dromocob",
  description: "Aradığınız sayfa bulunamadı.",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return (
    <main style={styles.main}>
      <div style={styles.bg} />

      <div style={styles.card}>
        <div style={styles.badge}>404</div>

        <h1 style={styles.h1}>Sayfa Bulunamadı</h1>

        <p style={styles.desc}>
          Aradığınız sayfa kaldırılmış, adı değişmiş veya geçici olarak
          kullanım dışı olabilir.
        </p>

        <div style={styles.actions}>
          <Link href="/" style={styles.primaryBtn}>
            Ana Sayfaya Dön
          </Link>

          <Link href="/shop" style={styles.secondaryBtn}>
            Mağazaya Git
          </Link>
        </div>

        <div style={styles.hint}>
          Bir sorun olduğunu düşünüyorsanız{" "}
          <Link href="/iletisim" style={styles.link}>
            iletişim
          </Link>{" "}
          sayfamızdan bize ulaşabilirsiniz.
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    overflow: "hidden",
  },

  bg: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background:
      "radial-gradient(900px 500px at 30% 20%, rgba(214,177,93,0.08), transparent 50%), " +
      "radial-gradient(700px 400px at 75% 70%, rgba(11,15,25,0.04), transparent 50%), " +
      "#fafafa",
  },

  card: {
    position: "relative",
    zIndex: 1,
    width: "min(520px, 100%)",
    padding: "48px 36px",
    borderRadius: "32px",
    border: "1px solid rgba(11,15,25,0.08)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 32px 90px rgba(0,0,0,0.08)",
    textAlign: "center" as const,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "44px",
    padding: "0 20px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #0b0f19, #1e293b)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 950,
    letterSpacing: "-0.03em",
    marginBottom: "24px",
  },

  h1: {
    margin: "0 0 12px",
    fontSize: "clamp(28px, 4vw, 38px)",
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
    marginBottom: "24px",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    height: "48px",
    padding: "0 24px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #0b0f19, #1e293b)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 900,
    textDecoration: "none",
    letterSpacing: "-0.02em",
    boxShadow: "0 12px 28px rgba(11,15,25,0.18)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
    transition: "transform 0.15s ease",
  },

  hint: {
    fontSize: "13px",
    fontWeight: 600,
    color: "rgba(11,15,25,0.45)",
    lineHeight: 1.5,
  },

  link: {
    color: "#0b0f19",
    fontWeight: 800,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};
