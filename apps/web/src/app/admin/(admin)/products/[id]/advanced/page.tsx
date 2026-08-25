"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertDoc } from "@/lib/adminApi";
import { getFirebaseDb } from "@/lib/firebase.client";
import { doc, onSnapshot } from "firebase/firestore";
import s from "./advanced.module.css";

function str(v: any) {
  return String(v ?? "").trim();
}

type I18nText = { tr?: string; en?: string };

type ProductAdvanced = {
  description?: I18nText;
  shortDescription?: I18nText;

  attributes?: Record<string, any>;
  colors?: Array<{ name: string; hex?: string }>;
  sizes?: string[];
  tags?: string[];

  specs?: { weightGr?: number; widthMm?: number; lengthMm?: number; heightMm?: number };
  shipping?: { fastShipping?: boolean; shippingDaysMin?: number; shippingDaysMax?: number; cargoNote?: string };

  returns?: {
    title?: I18nText;
    content?: I18nText;
  };

  seo?: {
    title?: I18nText;
    description?: I18nText;
    keywords?: string[];
    ogImage?: string;
    canonical?: string;
  };

  galleryVideos?: string[];
};

type ProductDoc = {
  title?: any;
  slug?: string;
  isActive?: boolean;
  advanced?: ProductAdvanced;
};

export default function AdminProductAdvanced({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const id = decodeURIComponent(params.id);
  const db = useMemo(() => getFirebaseDb(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [docData, setDocData] = useState<ProductDoc | null>(null);
  const [adv, setAdv] = useState<ProductAdvanced>({
    description: { tr: "", en: "" },
    shortDescription: { tr: "", en: "" },
    attributes: {},
    colors: [],
    sizes: [],
    tags: [],
    specs: {
      weightGr: undefined,
      widthMm: undefined,
      lengthMm: undefined,
      heightMm: undefined,
    },
    shipping: {
      fastShipping: true,
      shippingDaysMin: 1,
      shippingDaysMax: 3,
      cargoNote: "",
    },
    returns: {
      title: { tr: "İade & Değişim", en: "Returns & Exchange" },
      content: {
        tr: "",
        en: "",
      },
    },
    seo: {
      title: { tr: "", en: "" },
      description: { tr: "", en: "" },
      keywords: [],
      ogImage: "",
      canonical: "",
    },
    galleryVideos: [],
  });

  useEffect(() => {
    const ref = doc(db, "products", id);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = (snap.data() as any) || null;
        setDocData(d);
        setAdv((prev) => ({ ...prev, ...(d?.advanced || {}) }));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [db, id]);

  function deepClean<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj as any;
    if (Array.isArray(obj)) return obj.map(deepClean) as any;

    if (typeof obj === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(obj as any)) {
        if (v === undefined) continue;
        const vv = deepClean(v);

        if (
          vv &&
          typeof vv === "object" &&
          !Array.isArray(vv) &&
          Object.keys(vv).length === 0
        ) {
          continue;
        }

        out[k] = vv;
      }
      return out;
    }

    return obj as any;
  }

  function stripUndefSpecs(specs: any) {
    const x = specs && typeof specs === "object" ? { ...specs } : {};
    Object.keys(x).forEach((k) => {
      if (x[k] === undefined || x[k] === null || x[k] === "") delete x[k];
    });
    return Object.keys(x).length ? x : undefined;
  }

  async function save() {
    setSaving(true);
    setMsg("");

    try {
      const payload: ProductAdvanced = {
        ...adv,
        sizes: (adv.sizes || []).map(str).filter(Boolean),
        tags: (adv.tags || []).map(str).filter(Boolean),
        galleryVideos: (adv.galleryVideos || []).map(str).filter(Boolean),
        specs: stripUndefSpecs(adv.specs),
        shipping: {
          ...adv.shipping,
          cargoNote: str(adv.shipping?.cargoNote),
          shippingDaysMin: Number.isFinite(Number(adv.shipping?.shippingDaysMin))
            ? Number(adv.shipping?.shippingDaysMin)
            : undefined,
          shippingDaysMax: Number.isFinite(Number(adv.shipping?.shippingDaysMax))
            ? Number(adv.shipping?.shippingDaysMax)
            : undefined,
        },
        seo: {
          ...adv.seo,
          keywords: (adv.seo?.keywords || []).map(str).filter(Boolean),
          ogImage: str(adv.seo?.ogImage) || undefined,
          canonical: str(adv.seo?.canonical) || undefined,
        },
        colors: Array.isArray(adv.colors)
          ? adv.colors
              .map((c) => ({
                name: str(c?.name),
                hex: str(c?.hex) || undefined,
              }))
              .filter((c) => c.name)
          : [],
      };

      const clean = deepClean({ advanced: payload });
      await upsertDoc("products", id, clean as any);

      setMsg("Kaydedildi ✅");
      setTimeout(() => setMsg(""), 1800);
    } catch (e: any) {
      setMsg(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={s.loadingBox}>Yükleniyor…</div>;
  }

  const title = str(docData?.title?.tr ?? docData?.title ?? "Ürün");

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.kicker}>Admin • Ürün Gelişmiş</div>
          <h1 className={s.title}>
            Ürün Gelişmiş <span className={s.titlePill}>{title}</span>
          </h1>
          <div className={s.sub}>
            ID: <code className={s.codePill}>{id}</code>
          </div>
        </div>

        <div className={s.headerActions}>
          <button
            type="button"
            className={s.secondaryBtn}
            onClick={() => router.push(`/admin/products/${encodeURIComponent(id)}`)}
          >
            ← Temel Edit
          </button>

          <button
            type="button"
            className={s.primaryBtn}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      {msg ? (
        <div
          className={`${s.notice} ${
            msg.includes("✅") ? s.noticeOk : s.noticeError
          }`}
        >
          {msg}
        </div>
      ) : null}

      <section className={s.card}>
        <div className={s.sectionTitle}>Açıklama</div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label}>Kısa Açıklama (TR)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={adv.shortDescription?.tr || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  shortDescription: {
                    ...(a.shortDescription || {}),
                    tr: e.target.value,
                  },
                }))
              }
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>Kısa Açıklama (EN)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={adv.shortDescription?.en || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  shortDescription: {
                    ...(a.shortDescription || {}),
                    en: e.target.value,
                  },
                }))
              }
            />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label}>Detay Açıklama (TR)</label>
            <textarea
              className={s.textarea}
              rows={8}
              value={adv.description?.tr || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  description: {
                    ...(a.description || {}),
                    tr: e.target.value,
                  },
                }))
              }
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>Detay Açıklama (EN)</label>
            <textarea
              className={s.textarea}
              rows={8}
              value={adv.description?.en || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  description: {
                    ...(a.description || {}),
                    en: e.target.value,
                  },
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className={s.card}>
        <div className={s.sectionTitle}>Renk • Beden • Etiket</div>
        

        <div className={s.grid3}>
          <TextList
            title="Bedenler"
            value={adv.sizes || []}
            onChange={(v) => setAdv((a) => ({ ...a, sizes: v }))}
          />

          <TextList
            title="Etiketler"
            value={adv.tags || []}
            onChange={(v) => setAdv((a) => ({ ...a, tags: v }))}
          />

          <TextList
            title="Video URL"
            value={adv.galleryVideos || []}
            onChange={(v) => setAdv((a) => ({ ...a, galleryVideos: v }))}
          />
        </div>

        <div className={s.colorsBlock}>
          <div className={s.subSectionTitle}>Renkler</div>
          <ColorsEditor
            value={adv.colors || []}
            onChange={(v) => setAdv((a) => ({ ...a, colors: v }))}
          />
        </div>
      </section>

      <section className={s.card}>
        <div className={s.sectionTitle}>Ölçüler • Kargo</div>

        <div className={s.grid2}>
          <div className={s.group}>
            <div className={s.subSectionTitle}>Ölçüler</div>
            <div className={s.grid2}>
              <Num
                label="Ağırlık (gr)"
                v={adv.specs?.weightGr}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    specs: { ...(a.specs || {}), weightGr: n },
                  }))
                }
              />
              <Num
                label="Genişlik (mm)"
                v={adv.specs?.widthMm}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    specs: { ...(a.specs || {}), widthMm: n },
                  }))
                }
              />
              <Num
                label="Uzunluk (mm)"
                v={adv.specs?.lengthMm}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    specs: { ...(a.specs || {}), lengthMm: n },
                  }))
                }
              />
              <Num
                label="Yükseklik (mm)"
                v={adv.specs?.heightMm}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    specs: { ...(a.specs || {}), heightMm: n },
                  }))
                }
              />
            </div>
          </div>

          <div className={s.group}>
            <div className={s.subSectionTitle}>Kargo</div>

            <label className={s.switchLine}>
              <input
                type="checkbox"
                checked={!!adv.shipping?.fastShipping}
                onChange={(e) =>
                  setAdv((a) => ({
                    ...a,
                    shipping: {
                      ...(a.shipping || {}),
                      fastShipping: e.target.checked,
                    },
                  }))
                }
              />
              <b>Hızlı kargo</b>
            </label>

            <div className={s.grid2}>
              <Num
                label="Min gün"
                v={adv.shipping?.shippingDaysMin}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    shipping: {
                      ...(a.shipping || {}),
                      shippingDaysMin: n,
                    },
                  }))
                }
              />
              <Num
                label="Max gün"
                v={adv.shipping?.shippingDaysMax}
                onChange={(n) =>
                  setAdv((a) => ({
                    ...a,
                    shipping: {
                      ...(a.shipping || {}),
                      shippingDaysMax: n,
                    },
                  }))
                }
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>Kargo notu</label>
              <textarea
                className={s.textarea}
                rows={3}
                value={adv.shipping?.cargoNote || ""}
                onChange={(e) =>
                  setAdv((a) => ({
                    ...a,
                    shipping: {
                      ...(a.shipping || {}),
                      cargoNote: e.target.value,
                    },
                  }))
                }
              />
            </div>
          </div>
        </div>  
      </section>
      <section className={s.card}>
  <div className={s.sectionTitle}>İade / Değişim İçeriği</div>

  <div className={s.grid2}>
    <div className={s.field}>
      <label className={s.label}>Başlık (TR)</label>
      <input
        className={s.input}
        value={adv.returns?.title?.tr || ""}
        onChange={(e) =>
          setAdv((a) => ({
            ...a,
            returns: {
              ...(a.returns || {}),
              title: { ...(a.returns?.title || {}), tr: e.target.value },
            },
          }))
        }
      />
    </div>

    <div className={s.field}>
      <label className={s.label}>Başlık (EN)</label>
      <input
        className={s.input}
        value={adv.returns?.title?.en || ""}
        onChange={(e) =>
          setAdv((a) => ({
            ...a,
            returns: {
              ...(a.returns || {}),
              title: { ...(a.returns?.title || {}), en: e.target.value },
            },
          }))
        }
      />
    </div>
  </div>

  <div className={s.grid2}>
    <div className={s.field}>
      <label className={s.label}>İade Metni (TR)</label>
      <textarea
        className={s.textarea}
        rows={6}
        value={adv.returns?.content?.tr || ""}
        onChange={(e) =>
          setAdv((a) => ({
            ...a,
            returns: {
              ...(a.returns || {}),
              content: { ...(a.returns?.content || {}), tr: e.target.value },
            },
          }))
        }
      />
    </div>

    <div className={s.field}>
      <label className={s.label}>İade Metni (EN)</label>
      <textarea
        className={s.textarea}
        rows={6}
        value={adv.returns?.content?.en || ""}
        onChange={(e) =>
          setAdv((a) => ({
            ...a,
            returns: {
              ...(a.returns || {}),
              content: { ...(a.returns?.content || {}), en: e.target.value },
            },
          }))
        }
      />
    </div>
  </div>
</section>
      <section className={s.card}>
        <div className={s.sectionTitle}>SEO (Ürün)</div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label}>SEO Title (TR)</label>
            <input
              className={s.input}
              value={adv.seo?.title?.tr || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: {
                    ...(a.seo || {}),
                    title: { ...(a.seo?.title || {}), tr: e.target.value },
                  },
                }))
              }
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>SEO Title (EN)</label>
            <input
              className={s.input}
              value={adv.seo?.title?.en || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: {
                    ...(a.seo || {}),
                    title: { ...(a.seo?.title || {}), en: e.target.value },
                  },
                }))
              }
            />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label}>SEO Description (TR)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={adv.seo?.description?.tr || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: {
                    ...(a.seo || {}),
                    description: {
                      ...(a.seo?.description || {}),
                      tr: e.target.value,
                    },
                  },
                }))
              }
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>SEO Description (EN)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={adv.seo?.description?.en || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: {
                    ...(a.seo || {}),
                    description: {
                      ...(a.seo?.description || {}),
                      en: e.target.value,
                    },
                  },
                }))
              }
            />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label}>OG Image</label>
            <input
              className={s.input}
              value={adv.seo?.ogImage || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: { ...(a.seo || {}), ogImage: e.target.value },
                }))
              }
              placeholder="https://..."
            />
          </div>

          <div className={s.field}>
            <label className={s.label}>Canonical</label>
            <input
              className={s.input}
              value={adv.seo?.canonical || ""}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  seo: { ...(a.seo || {}), canonical: e.target.value },
                }))
              }
              placeholder="https://site.com/products/..."
            />
          </div>
        </div>

        <TextList
          title="Keywords"
          value={adv.seo?.keywords || []}
          onChange={(v) =>
            setAdv((a) => ({
              ...a,
              seo: { ...(a.seo || {}), keywords: v },
            }))
          }
          asComma
        />
      </section>
    </div>
  );
}

function TextList({
  title,
  value,
  onChange,
  asComma,
}: {
  title: string;
  value: string[];
  onChange: (v: string[]) => void;
  asComma?: boolean;
}) {
  return (
    <div className={s.field}>
      <div className={s.subSectionTitle}>{title}</div>
      <textarea
        className={s.textarea}
        rows={3}
        value={asComma ? (value || []).join(", ") : (value || []).join("\n")}
        onChange={(e) => {
          const raw = e.target.value || "";
          const list = asComma
            ? raw.split(",").map(str).filter(Boolean)
            : raw.split("\n").map(str).filter(Boolean);
          onChange(list);
        }}
      />
    </div>
  );
}

function ColorsEditor({
  value,
  onChange,
}: {
  value: Array<{ name: string; hex?: string }>;
  onChange: (v: Array<{ name: string; hex?: string }>) => void;
}) {
  const list = Array.isArray(value) ? value : [];

  return (
    <div className={s.colorsEditor}>
      {list.map((c, i) => (
        <div key={i} className={s.colorRow}>
          <input
            className={s.input}
            value={c.name || ""}
            placeholder="Renk adı"
            onChange={(e) => {
              const next = [...list];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
          />

          <input
            className={s.input}
            value={c.hex || ""}
            placeholder="#d4af37"
            onChange={(e) => {
              const next = [...list];
              next[i] = { ...next[i], hex: e.target.value };
              onChange(next);
            }}
          />

          <button
            type="button"
            className={s.dangerBtn}
            onClick={() => onChange(list.filter((_, idx) => idx !== i))}
          >
            Sil
          </button>
        </div>
      ))}

      <button
        type="button"
        className={s.secondaryBtn}
        onClick={() => onChange([...list, { name: "", hex: "" }])}
      >
        + Renk ekle
      </button>
    </div>
  );
}

function Num({
  label,
  v,
  onChange,
}: {
  label: string;
  v: any;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      <input
        className={s.input}
        type="number"
        value={v ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
      />
    </div>
  );
}