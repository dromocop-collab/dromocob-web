export default function SiteLoading() {
  return (
    <div style={styles.wrap}>
      <div style={styles.spinner}>
        <div style={styles.ring} />
      </div>
      <div style={styles.text}>Yükleniyor…</div>

      <style>{`
        @keyframes nciSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes nciPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "grid",
    placeItems: "center",
    minHeight: "50vh",
    gap: "16px",
    padding: "40px 20px",
  },

  spinner: {
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
  },

  ring: {
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    border: "3px solid rgba(11,15,25,0.08)",
    borderTopColor: "#0b0f19",
    animation: "nciSpin 0.7s linear infinite",
  },

  text: {
    fontSize: "13px",
    fontWeight: 700,
    color: "rgba(11,15,25,0.4)",
    letterSpacing: "-0.02em",
    animation: "nciPulse 1.5s ease infinite",
  },
};
