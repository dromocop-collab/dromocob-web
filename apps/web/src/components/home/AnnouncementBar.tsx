"use client";

type Announcement = {
  text?: string;
  href?: string;
  enabled?: boolean;
};

export default function AnnouncementBar({ data }: { data?: Announcement | null }) {
  if (!data || data.enabled === false) return null;

  const text = (data.text || "").trim();
  if (!text) return null;

  const barStyle: React.CSSProperties = {
    background: "#111",
    color: "#fff",
    padding: "10px 16px",
    fontSize: 13,
    display: "flex",
    justifyContent: "center",
    gap: 10,
  };

  const aStyle: React.CSSProperties = {
    color: "#fff",
    textDecoration: "underline",
    fontWeight: 800,
  };

  return (
    <div style={barStyle}>
      <span>{text}</span>
      {data.href ? (
        <a href={data.href} style={aStyle}>
          Detay →
        </a>
      ) : null}
    </div>
  );
}