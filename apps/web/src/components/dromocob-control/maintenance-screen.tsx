/**
 * Dromocob Control — Maintenance Screen
 *
 * Merkezi yönetim sistemi tarafından bakım moduna alındığında
 * gösterilen tam ekran bakım sayfası.
 *
 * Dromocob marka kimliğine uygun tasarım.
 */
export default function MaintenanceScreen() {
  return (
    <html lang="tr">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bakım Modu | 6&apos;ncı e-ticaret</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(160deg, #0b0b0b 0%, #1a1510 50%, #0b0b0b 100%)",
          color: "#fff",
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 24,
          textRendering: "optimizeLegibility",
        }}
      >
        <main style={{ maxWidth: 640, textAlign: "center" }}>
          {/* Status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              border: "1px solid rgba(212, 175, 55, 0.25)",
              borderRadius: 999,
              color: "#d4af37",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".18em",
              textTransform: "uppercase" as const,
              backdropFilter: "blur(8px)",
              background: "rgba(212, 175, 55, 0.06)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#d4af37",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            SCHEDULED MAINTENANCE
          </div>

          {/* Logo mark */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              margin: "32px auto 24px",
              display: "grid",
              placeItems: "center",
              background: "rgba(212, 175, 55, 0.08)",
              border: "1px solid rgba(212, 175, 55, 0.15)",
              fontSize: 32,
              fontWeight: 700,
              color: "#d4af37",
              fontFamily: "serif",
            }}
          >
            6
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "clamp(36px, 7vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-.04em",
              margin: "0 0 24px",
              fontWeight: 300,
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
            }}
          >
            Daha iyi bir
            <br />
            <span style={{ fontWeight: 600, fontStyle: "italic" }}>
              deneyim
            </span>{" "}
            için
            <br />
            çalışıyoruz.
          </h1>

          {/* Description */}
          <p
            style={{
              color: "#8e8a83",
              lineHeight: 1.7,
              fontSize: 15,
              maxWidth: 420,
              margin: "0 auto 48px",
            }}
          >
            Sistemimiz kısa süreliğine bakım modunda.
            Dijital altyapımız üzerinde gerekli iyileştirmeleri
            tamamlıyoruz.
          </p>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              letterSpacing: ".2em",
              textTransform: "uppercase" as const,
            }}
          >
            <span style={{ color: "#555" }}>SYSTEM CONTROLLED BY</span>
            <strong style={{ color: "#777", fontWeight: 600 }}>
              DROMOCOB CONTROL OS
            </strong>
          </div>
        </main>

        {/* Pulse animation */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
