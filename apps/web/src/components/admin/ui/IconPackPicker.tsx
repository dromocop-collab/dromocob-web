"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./IconPackPicker.module.css";

type IconItem = {
  id: string;
  name: string;
  url: string;
  tags?: string[];
  group?: "lux" | "trust" | "shipping" | "promo" | "ui";
};

function s(v: any) {
  return String(v ?? "").trim();
}

function isLikelyUrl(u: string) {
  if (!u) return false;
  return u.startsWith("/") || u.startsWith("http://") || u.startsWith("https://") || u.startsWith("//");
}

function extOf(u: string) {
  const x = u.split("?")[0].toLowerCase();
  const m = x.match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isAllowedIcon(u: string) {
  const e = extOf(u);
  // svg/png/webp en stabil
  return ["svg", "png", "webp", "jpg", "jpeg", "gif"].includes(e);
}

function toClipboard(text: string) {
  try {
    navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const GROUPS: Array<{ key: "all" | IconItem["group"]; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "lux", label: "Luxury" },
  { key: "trust", label: "Güven" },
  { key: "shipping", label: "Kargo" },
  { key: "promo", label: "Promo" },
  { key: "ui", label: "UI" },
];

export default function IconPackPicker({
  value,
  onChange,
  label = "Icon",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"all" | IconItem["group"]>("all");
  const [copied, setCopied] = useState("");
  const [imgErr, setImgErr] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const icons: IconItem[] = useMemo(
    () => [
      { id: "diamond", name: "Diamond", url: "/admin-icons/diamond.svg", tags: ["lux", "gem", "premium"], group: "lux" },
      { id: "gem", name: "Gem", url: "/admin-icons/gem.svg", tags: ["gem", "stone"], group: "lux" },
      { id: "crown", name: "Crown", url: "/admin-icons/crown.svg", tags: ["lux", "king"], group: "lux" },

      { id: "shield", name: "Shield", url: "/admin-icons/shield.svg", tags: ["secure", "safe", "trust"], group: "trust" },
      { id: "check", name: "Verified", url: "/admin-icons/check.svg", tags: ["verified", "trust"], group: "trust" },

      { id: "truck", name: "Truck", url: "/admin-icons/truck.svg", tags: ["shipping", "cargo"], group: "shipping" },
      { id: "bolt", name: "Fast", url: "/admin-icons/bolt.svg", tags: ["fast", "express"], group: "shipping" },

      { id: "gift", name: "Gift", url: "/admin-icons/gift.svg", tags: ["wrap", "present"], group: "promo" },
      { id: "tag", name: "Tag", url: "/admin-icons/tag.svg", tags: ["sale", "price"], group: "promo" },
      { id: "star", name: "Star", url: "/admin-icons/star.svg", tags: ["featured", "top"], group: "promo" },

      { id: "heart", name: "Heart", url: "/admin-icons/heart.svg", tags: ["wish", "love"], group: "ui" },
      { id: "spark", name: "Spark", url: "/admin-icons/spark.svg", tags: ["shine", "lux"], group: "ui" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();

    const base = group === "all" ? icons : icons.filter((x) => x.group === group);

    if (!t) return base;

    return base.filter((x) => {
      const hay = `${x.id} ${x.name} ${(x.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(t);
    });
  }, [icons, q, group]);

  const selected = useMemo(() => icons.find((x) => x.url === value) || null, [icons, value]);

  // outside click close
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as any)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // focus search when open
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  // esc close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // preview error reset
  useEffect(() => {
    setImgErr(false);
  }, [value]);

  const urlOk = isLikelyUrl(s(value));
  const extOk = !value ? true : isAllowedIcon(s(value));

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.labelRow}>
          <div className={styles.label}>{label}</div>
          {selected ? <span className={styles.pill}>Seçili: {selected.name}</span> : null}
        </div>

        <div className={styles.headActions}>
          <button type="button" className={styles.btnGhost} onClick={() => setOpen((p) => !p)}>
            {open ? "Kapat" : "Paket"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setOpen(true);
              setGroup("all");
            }}
          >
            Seç
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.preview} aria-label="preview">
          {value && !imgErr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" onError={() => setImgErr(true)} />
          ) : value && imgErr ? (
            <div className={styles.previewErr}>Görsel yüklenemedi</div>
          ) : (
            <div className={styles.empty}>—</div>
          )}
        </div>

        <div className={styles.inputCol}>
          <input
            className={`${styles.input} ${value && (!urlOk || !extOk) ? styles.inputBad : ""}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/admin-icons/diamond.svg veya https://..."
          />
          <div className={styles.meta}>
            {value ? (
              <>
                {!urlOk ? <span className={styles.warn}>URL formatı şüpheli</span> : null}
                {urlOk && !extOk ? <span className={styles.warn}>svg/png/webp önerilir</span> : null}
                {urlOk && extOk ? <span className={styles.ok}>OK</span> : null}
              </>
            ) : (
              <span className={styles.muted}>İpucu: Storage URL yapıştırabilirsin.</span>
            )}
          </div>
        </div>

        <div className={styles.sideBtns}>
          {value ? (
            <>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => {
                  const v = s(value);
                  if (!v) return;
                  toClipboard(v);
                  setCopied("copied");
                  window.setTimeout(() => setCopied(""), 800);
                }}
                title="Kopyala"
              >
                {copied ? "✓" : "⧉"}
              </button>

              <a className={styles.miniBtn} href={value} target="_blank" rel="noreferrer" title="Aç">
                ↗
              </a>

              <button type="button" className={styles.clear} onClick={() => onChange("")} title="Temizle">
                Temizle
              </button>
            </>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelTop}>
            <input
              ref={searchRef}
              className={styles.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara: diamond, truck, shield..."
            />

            <div className={styles.chips}>
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`${styles.chip} ${group === g.key ? styles.chipOn : ""}`}
                  onClick={() => setGroup(g.key as any)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.grid}>
            {filtered.map((it) => {
              const active = (value || "") === it.url;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`${styles.iconBtn} ${active ? styles.active : ""}`}
                  onClick={() => {
                    onChange(it.url);
                    setOpen(false);
                  }}
                  title={it.name}
                >
                  <span className={styles.iconImg}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt="" />
                  </span>
                  <span className={styles.iconName}>{it.name}</span>
                  <span className={styles.iconMeta}>{it.group?.toUpperCase() || "—"}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.hint}>
            İpucu: Kendi SVG/PNG URL’ini yukarıdaki input’a yapıştırabilirsin. (En stabil: Storage URL)
          </div>
        </div>
      ) : null}
    </div>
  );
}