export default function ProductLoading() {
  return (
    <div style={styles.wrap}>
      <div style={styles.container}>
        {/* Görsel skeleton */}
        <div style={styles.mediaSkel}>
          <div style={styles.skelBox} />
          <div style={styles.thumbRow}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={styles.thumbSkel} />
            ))}
          </div>
        </div>

        {/* Bilgi skeleton */}
        <div style={styles.infoSkel}>
          <div style={{ ...styles.skelLine, width: "40%", height: "14px" }} />
          <div style={{ ...styles.skelLine, width: "80%", height: "22px", marginTop: "12px" }} />
          <div style={{ ...styles.skelLine, width: "60%", height: "14px", marginTop: "8px" }} />
          <div style={{ ...styles.skelLine, width: "30%", height: "28px", marginTop: "20px" }} />
          <div style={{ ...styles.skelLine, width: "100%", height: "48px", marginTop: "20px", borderRadius: "16px" }} />
          <div style={{ ...styles.skelLine, width: "100%", height: "48px", marginTop: "8px", borderRadius: "16px" }} />
        </div>
      </div>

      <style>{`
        @keyframes nciSkelShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

const shimmerBg = {
  background:
    "linear-gradient(90deg, rgba(11,15,25,0.04) 25%, rgba(11,15,25,0.08) 37%, rgba(11,15,25,0.04) 63%)",
  backgroundSize: "400% 100%",
  animation: "nciSkelShimmer 1.4s ease infinite",
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px 16px",
  },

  container: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "28px",
  },

  mediaSkel: {
    display: "grid",
    gap: "10px",
  },

  skelBox: {
    aspectRatio: "1 / 1",
    borderRadius: "22px",
    ...shimmerBg,
  },

  thumbRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },

  thumbSkel: {
    aspectRatio: "1 / 1",
    borderRadius: "14px",
    ...shimmerBg,
  },

  infoSkel: {
    padding: "8px 0",
  },

  skelLine: {
    borderRadius: "10px",
    ...shimmerBg,
  },
};
