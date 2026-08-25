"use client";

export default function TrustBadges({ items }: { items?: any[] }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
      {list.map((b, i) => (
        <div
          key={i}
          style={{
            borderRadius: 18,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 950 }}>{b?.title?.tr || b?.title || "Güvence"}</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>{b?.desc?.tr || b?.desc || ""}</div>
        </div>
      ))}
    </div>
  );
}