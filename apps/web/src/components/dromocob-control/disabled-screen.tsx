/**
 * Dromocob Control — Disabled Screen
 *
 * Merkezi yönetim sistemi tarafından devre dışı bırakıldığında
 * gösterilen tam ekran bilgilendirme sayfası.
 *
 * Dromocob marka kimliğine uygun tasarım.
 */
export default function DisabledScreen() {
  return (
    <html lang="tr">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Servis Kullanılamıyor | 6&apos;ncı e-ticaret</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#090a09",
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
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 999,
              color: "#ef4444",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".18em",
              textTransform: "uppercase" as const,
              background: "rgba(239, 68, 68, 0.05)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef4444",
              }}
            />
            SERVICE SUSPENDED
          </div>

          {/* X icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              margin: "32px auto 24px",
              display: "grid",
              placeItems: "center",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              fontSize: 30,
              fontWeight: 300,
            }}
          >
            ×
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
            Bu servis
            <br />
            şu an
            <br />
            <span style={{ fontWeight: 600, fontStyle: "italic" }}>
              kullanılamıyor.
            </span>
          </h1>

          {/* Description */}
          <p
            style={{
              color: "#6b6b6b",
              lineHeight: 1.7,
              fontSize: 15,
              maxWidth: 420,
              margin: "0 auto 48px",
            }}
          >
            Site yönetim sistemi tarafından geçici olarak
            devre dışı bırakıldı.
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
            <span style={{ color: "#444" }}>REMOTE OPERATIONS</span>
            <strong style={{ color: "#666", fontWeight: 600 }}>
              DROMOCOB CONTROL OS
            </strong>
          </div>
        </main>
      </body>
    </html>
  );
}
