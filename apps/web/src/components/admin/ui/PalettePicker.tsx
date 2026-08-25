"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  palettes?: Array<{ name: string; colors: string[] }>;
};

const DEFAULT_PALETTES: Array<{ name: string; colors: string[] }> = [
  { name: "Premium Mono", colors: ["#111111", "#1f1f1f", "#2b2b2b", "#ffffff", "rgba(255,255,255,0.85)", "rgba(0,0,0,0.82)"] },
  { name: "Gold Luxury", colors: ["#0b0b0b", "#151515", "#ffffff", "#d4af37", "#b88a2b", "#f5e6b3"] },
  { name: "Rose", colors: ["#0b0b0b", "#ffffff", "#f3d4db", "#d98ea1", "#7a2f3f", "#f7eef1"] },
  { name: "Ocean", colors: ["#061826", "#0a2b3c", "#ffffff", "#2ac3ff", "#00a3c4", "#dff6ff"] },
  { name: "Emerald", colors: ["#071a12", "#0e2d1f", "#ffffff", "#2ecc71", "#1f8f52", "#dff7ea"] },
];

function isHex(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
}
function toHexIfPossible(v: string) {
  return isHex(v) ? v : "#ffffff";
}

export default function PalettePicker({ label = "Renk", value, onChange, palettes }: Props) {
  const pals = useMemo(() => (palettes?.length ? palettes : DEFAULT_PALETTES), [palettes]);
  const [open, setOpen] = useState(false);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          border: "1px solid rgba(0,0,0,.10)",
          background: "rgba(0,0,0,.02)",
          borderRadius: 12,
          padding: "10px 12px",
          fontWeight: 850,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Palette
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 92vw)",     // ✅ sağa taşmaz
              maxHeight: "min(70vh, 560px)", // ✅ içeride scroll
              overflow: "auto",
              background: "#fff",
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,.12)",
              boxShadow: "0 30px 120px rgba(0,0,0,.35)",
              padding: 14,
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 950, fontSize: 14 }}>{label}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Palette seç veya renk kutusundan hex seç.</div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid rgba(0,0,0,.12)",
                  background: "rgba(0,0,0,.02)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            {/* picker row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                type="color"
                value={toHexIfPossible(value)}
                onChange={(e) => onChange(e.target.value)}
                title="Renk seç"
                style={{
                  width: 46,
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: "#fff",
                  padding: 4,
                  cursor: "pointer",
                }}
              />
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="#ffffff veya rgba(...)"
                style={{
                  flex: "1 1 220px",
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.12)",
                  padding: "0 12px",
                  fontWeight: 850,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => onChange("")}
                style={{
                  border: "1px solid rgba(0,0,0,.10)",
                  background: "rgba(0,0,0,.02)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 850,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Sıfırla
              </button>
            </div>

            {/* palettes */}
            <div style={{ display: "grid", gap: 14 }}>
              {pals.map((p) => (
                <div key={p.name} style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.7 }}>{p.name}</div>

                  {/* ✅ grid: taşmaz */}
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
                    }}
                  >
                    {p.colors.map((c) => {
                      const active = value === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onChange(c)}
                          title={c}
                          style={{
                            width: "100%",
                            height: 34,
                            borderRadius: 14,
                            border: active ? "2px solid rgba(0,0,0,.55)" : "1px solid rgba(0,0,0,.14)",
                            background: c,
                            boxShadow: "0 10px 25px rgba(0,0,0,.08)",
                            cursor: "pointer",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              Seçili: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value || "(boş)"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}