"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseDb } from "@/lib/firebase.client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { uploadProductImage } from "@/lib/uploadProductImage";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./home-promos.module.css";

function s(v: any) {
  return String(v ?? "").trim();
}

function uid() {
  return `pb_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

type I18nText = { tr?: string; en?: string } | string;
type HeroTheme = "light" | "dark";
type HeroVariant = "classic" | "visual" | "split" | "editorial" | "immersive";
type HeroAlign = "left" | "center" | "media";
type HeroImageFit = "cover" | "contain" | "auto";
type HeroOverlayStrength = "soft" | "medium" | "strong";

type PromoBanner = {
  id: string;
  isActive?: boolean;
  order?: number;

  title?: I18nText;
  subtitle?: I18nText;
  eyebrow?: I18nText;

  startLabel?: I18nText;
  priceText?: I18nText;
  bullets?: { tr?: string[]; en?: string[] } | string[];

  primaryCta?: { label?: I18nText; href?: string };
  secondaryCta?: { label?: I18nText; href?: string };

  image?: { url?: string; alt?: I18nText; badgeText?: I18nText };
  image2?: string;

  theme?: HeroTheme;
  variant?: HeroVariant;
  align?: HeroAlign;
  imageFit?: HeroImageFit;
  overlayStrength?: HeroOverlayStrength;
  mediaSize?: "normal" | "large" | "xl";
};

const emptyBanner = (): PromoBanner => ({
  id: uid(),
  isActive: true,
  order: 0,
  title: { tr: "Yeni Sezon Koleksiyonu", en: "New Season Collection" },
  subtitle: {
    tr: "Modern, premium ve güçlü vitrin deneyimi.",
    en: "A modern, premium and bold showcase experience.",
  },
  eyebrow: { tr: "Premium Koleksiyon", en: "Premium Collection" },
  startLabel: { tr: "Başlangıç", en: "Starting" },
  priceText: { tr: "₺—", en: "₺—" },
  bullets: {
    tr: ["Sertifikalı ürün", "Güvenli ödeme", "Hızlı kargo"],
    en: ["Certified products", "Secure payment", "Fast shipping"],
  },
  primaryCta: { label: { tr: "Mağaza", en: "Shop" }, href: "/shop" },
  secondaryCta: { label: { tr: "Kategoriler", en: "Categories" }, href: "/shop" },
  image: {
    url: "",
    alt: { tr: "Kampanya görseli", en: "Promo image" },
    badgeText: { tr: "YENİ", en: "NEW" },
  },
  image2: "",
  theme: "light",
  variant: "classic",
  align: "left",
  imageFit: "cover",
  overlayStrength: "medium",
  mediaSize: "normal",
  
});

function getText(val: any, loc: "tr" | "en") {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return s(val?.[loc] ?? val?.tr ?? val?.en ?? "");
  return "";
}

async function uploadToUrl(file: File): Promise<string> {
  const res: any = await (uploadProductImage as any)(file);
  if (typeof res === "string") return res;
  if (res && typeof res === "object") {
    if (typeof res.url === "string") return res.url;
    if (typeof res.downloadURL === "string") return res.downloadURL;
    if (typeof res.path === "string") return res.path;
  }
  throw new Error("Upload sonucu URL üretmedi.");
}

function AdminHomePromosPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "home_settings"), [db]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [items, setItems] = useState<PromoBanner[]>([]);
  const [openTextPanels, setOpenTextPanels] = useState<Record<string, boolean>>({});

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileRefs2 = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(ref);
        if (!alive) return;

        const data = snap.exists() ? (snap.data() as any) : {};
        const arr = Array.isArray(data?.promoBanners) ? data.promoBanners : [];

        const norm: PromoBanner[] = arr
          .map((x: any, idx: number) => ({
            ...x,
            id: s(x?.id) || uid(),
            order: typeof x?.order === "number" ? x.order : idx * 10,
            isActive: x?.isActive !== false,
            image: typeof x?.image === "string" ? { url: x.image } : (x?.image ?? {}),
            image2: s(x?.image2),
            theme: x?.theme === "dark" ? "dark" : "light",
            variant: ["classic", "visual", "split", "editorial", "immersive"].includes(s(x?.variant))
              ? x.variant
              : "classic",
            imageFit: x?.imageFit === "contain" ? "contain" : "cover",
            align:
  x?.align === "center"
    ? "center"
    : x?.align === "media"
    ? "media"
    : "left",

mediaSize:
  x?.mediaSize === "large" || x?.mediaSize === "xl"
    ? x.mediaSize
    : "normal",
            overlayStrength:
              x?.overlayStrength === "soft" || x?.overlayStrength === "strong"
                ? x.overlayStrength
                : "medium",
          }))
          .sort((a: PromoBanner, b: PromoBanner) => Number(a.order ?? 0) - Number(b.order ?? 0));

        setItems(norm.length ? norm : [emptyBanner()]);
      } catch (e: any) {
        setErr(e?.message || "Load error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [ref]);

  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next.map((it, idx) => ({ ...it, order: idx * 10 }));
    });
  }
function toggleTextPanel(id: string) {
  setOpenTextPanels((prev) => ({
    ...prev,
    [id]: !prev[id],
  }));
}
  async function save() {
    setSaving(true);
    setErr("");

    try {
      const cleaned = (items || []).map((x, idx) => ({
        ...x,
        order: idx * 10,
        id: s(x.id) || uid(),
        isActive: x?.isActive !== false,
        theme: x?.theme === "dark" ? "dark" : "light",
        variant: x?.variant || "classic",
        align: x?.align || "left",
        mediaSize: x?.mediaSize || "normal",
        imageFit: x?.imageFit || "cover",
        overlayStrength: x?.overlayStrength || "medium",
        image: {
          ...(x.image ?? {}),
          url: s(x?.image?.url),
        },
        image2: s(x?.image2),
        primaryCta: {
          ...(x.primaryCta ?? {}),
          href: s(x?.primaryCta?.href),
        },
        secondaryCta: {
          ...(x.secondaryCta ?? {}),
          href: s(x?.secondaryCta?.href),
        },
      }));

      await setDoc(ref, { promoBanners: cleaned }, { merge: true });
    } catch (e: any) {
      setErr(e?.message || "Missing or insufficient permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile(bannerId: string, file: File | null, key: "image" | "image2" = "image") {
    if (!file) return;

    setErr("");

    try {
      const url = await uploadToUrl(file);

      setItems((p) =>
        p.map((x) => {
          if (x.id !== bannerId) return x;
          if (key === "image2") return { ...x, image2: url };
          return {
            ...x,
            image: {
              ...(x.image ?? {}),
              url,
            },
          };
        })
      );
    } catch (e: any) {
      setErr(e?.message || "Upload error");
    } finally {
      if (key === "image") {
        const inp = fileRefs.current[bannerId];
        if (inp) inp.value = "";
      } else {
        const inp = fileRefs2.current[bannerId];
        if (inp) inp.value = "";
      }
    }
  }

  if (loading) return <div className={styles.loading}>Yükleniyor…</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.heroBar}>
        <div>
          <h1 className={styles.h1}>Hero / Promo Banner Yönetimi</h1>
          <div className={styles.sub}>
            Kayıt alanı: <code>site_options/home_settings.promoBanners</code>
          </div>
        </div>

        <div className={styles.headBtns}>
          <button
            className={styles.primaryGhostBtn}
            type="button"
            onClick={() => setItems((p) => [...p, { ...emptyBanner(), order: p.length * 10 }])}
          >
            + Banner Ekle
          </button>

          <button className={styles.primaryBtn} type="button" onClick={save} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      {!!err && <div className={styles.err}>{err}</div>}

      <div className={styles.list}>
        {items.map((b, idx) => {
          const imgUrl = s(b?.image?.url);
          const img2Url = s(b?.image2);
const trEyebrow = getText(b.eyebrow, "tr");
const trTitle = getText(b.title, "tr");
const trSubtitle = getText(b.subtitle, "tr");
const trStart = getText(b.startLabel, "tr");
const trPrice = getText(b.priceText, "tr");

const trBullets = Array.isArray((b as any)?.bullets?.tr) ? (b as any).bullets.tr : [];
const hasPreviewText =
  !!(trEyebrow || trTitle || trSubtitle || trStart || trPrice || trBullets.length);
  const isTextOpen = !!openTextPanels[b.id];
          return (
            <div key={b.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardTopLeft}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={b.isActive !== false}
                      onChange={(e) =>
                        setItems((p) => p.map((x) => (x.id === b.id ? { ...x, isActive: e.target.checked } : x)))
                      }
                    />
                    Aktif
                  </label>

                  <span className={styles.idx}>#{idx + 1}</span>

                  <div className={styles.themeRow}>
                    <span className={styles.themeLabel}>Tema</span>
                    <button
                      className={`${styles.miniBtn} ${b.theme !== "dark" ? styles.miniBtnActive : ""}`}
                      type="button"
                      onClick={() => setItems((p) => p.map((x) => (x.id === b.id ? { ...x, theme: "light" } : x)))}
                    >
                      Light
                    </button>
                    <button
                      className={`${styles.miniBtn} ${b.theme === "dark" ? styles.miniBtnActive : ""}`}
                      type="button"
                      onClick={() => setItems((p) => p.map((x) => (x.id === b.id ? { ...x, theme: "dark" } : x)))}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                <div className={styles.cardTopRight}>
                  <button
  className={`${styles.miniBtn} ${isTextOpen ? styles.miniBtnActive : ""}`}
  type="button"
  onClick={() => toggleTextPanel(b.id)}
>
  {isTextOpen ? "Metin Alanlarını Gizle" : "Metin Alanlarını Göster"}
</button>
                  <button className={styles.miniBtn} type="button" onClick={() => move(idx, -1)}>
                    ↑
                  </button>
                  <button className={styles.miniBtn} type="button" onClick={() => move(idx, +1)}>
                    ↓
                  </button>
                  <button className={styles.miniBtnDanger} type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== b.id))}>
                    Sil
                  </button>
                </div>
              </div>

              <div className={styles.previewRow}>
                                  <div
                      className={[
                        styles.preview,
                        b.theme === "dark" ? styles.previewDark : "",
                        (!hasPreviewText || b.align === "media") ? styles.previewMedia : "",
                        b.mediaSize === "large" ? styles.previewLarge : "",
                        b.mediaSize === "xl" ? styles.previewXl : "",
                      ].join(" ")}
                    >
                                {hasPreviewText && b.align !== "media" ? (
                      <div className={styles.previewInfo}>
                        <div className={styles.previewKicker}>{getText(b.eyebrow, "tr") || "Premium Koleksiyon"}</div>
                        <div className={styles.previewVariant}>Variant: {b.variant || "classic"}</div>
                        <div className={styles.previewTitle}>{getText(b.title, "tr") || "Başlık"}</div>
                        <div className={styles.previewSub}>{getText(b.subtitle, "tr") || "Alt metin"}</div>

                        <div className={styles.previewPriceWrap}>
                          <div className={styles.previewStart}>{getText(b.startLabel, "tr") || "Başlangıç"}</div>
                          <div className={styles.previewPrice}>{getText(b.priceText, "tr") || "₺—"}</div>
                        </div>

                        <ul className={styles.previewBullets}>
                          {(Array.isArray((b as any)?.bullets?.tr) ? (b as any).bullets.tr : [])
                            .slice(0, 4)
                            .map((x: string, i2: number) => (
                              <li key={i2}>{x}</li>
                            ))}
                        </ul>

                        <div className={styles.previewCtas}>
                          <span className={styles.previewPillActive}>
                            {getText(b.primaryCta?.label, "tr") || "Mağaza"}
                          </span>
                          <span className={styles.previewPill}>
                            {getText(b.secondaryCta?.label, "tr") || "Kategoriler"}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  <div className={styles.previewVisual}>
                    <div className={styles.previewImageBox}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={getText(b.image?.alt, "tr") || "Promo"} />
                      ) : (
                        <div className={styles.imgEmpty}>Ana görsel yok</div>
                      )}
                      {getText(b.image?.badgeText, "tr") ? (
                        <div className={styles.badgeVert}>{getText(b.image?.badgeText, "tr")}</div>
                      ) : null}
                    </div>

                    {b.variant === "split" ? (
                      <div className={styles.previewImageBoxSmall}>
                        {img2Url ? (
                          <img src={img2Url} alt="Promo 2" />
                        ) : (
                          <div className={styles.imgEmptySmall}>2. görsel</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
<div className={styles.grid3}>
  <Field
    label="Ana Görsel URL"
    value={s(b.image?.url)}
    onChange={(v) =>
      setItems((p) =>
        p.map((x) =>
          x.id === b.id ? { ...x, image: { ...(x.image ?? {}), url: v } } : x
        )
      )
    }
  />

  <Field
    label="İkinci Görsel URL"
    value={s(b.image2)}
    onChange={(v) =>
      setItems((p) =>
        p.map((x) => (x.id === b.id ? { ...x, image2: v } : x))
      )
    }
  />

  <div className={styles.uploadGroup}>
    <input
      ref={(el) => {
        fileRefs.current[b.id] = el;
      }}
      className={styles.file}
      type="file"
      accept="image/*"
      onChange={(e) => onPickFile(b.id, e.target.files?.[0] ?? null, "image")}
    />

    <input
      ref={(el) => {
        fileRefs2.current[b.id] = el;
      }}
      className={styles.file}
      type="file"
      accept="image/*"
      onChange={(e) => onPickFile(b.id, e.target.files?.[0] ?? null, "image2")}
    />

    <button
      className={styles.uploadBtn}
      type="button"
      onClick={() => fileRefs.current[b.id]?.click()}
    >
      Ana Görsel Yükle
    </button>

    <button
      className={styles.uploadBtn}
      type="button"
      onClick={() => fileRefs2.current[b.id]?.click()}
    >
      2. Görsel Yükle
    </button>
  </div>
</div>
              <div className={styles.grid4}>
                <SelectField
                  label="Varyant"
                  value={b.variant || "classic"}
                  onChange={(v) =>
                    setItems((p) => p.map((x) => (x.id === b.id ? { ...x, variant: v as HeroVariant } : x)))
                  }
                  options={[
                    { value: "classic", label: "Classic" },
                    { value: "visual", label: "Visual" },
                    { value: "split", label: "Split" },
                    { value: "editorial", label: "Editorial" },
                    { value: "immersive", label: "Immersive" },
                  ]}
                />

              <SelectField
  label="Hizalama"
  value={b.align || "left"}
  onChange={(v) =>
    setItems((p) => p.map((x) => (x.id === b.id ? { ...x, align: v as HeroAlign } : x)))
  }
  options={[
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "media", label: "Media" },
  ]}
/>
<SelectField
  label="Medya Boyutu"
  value={b.mediaSize || "normal"}
  onChange={(v) =>
    setItems((p) =>
      p.map((x) =>
        x.id === b.id
          ? { ...x, mediaSize: v as "normal" | "large" | "xl" }
          : x
      )
    )
  }
  options={[
    { value: "normal", label: "Normal" },
    { value: "large", label: "Large" },
    { value: "xl", label: "XL" },
  ]}
/>
                <SelectField
                  label="Görsel Fit"
                  value={b.imageFit || "cover"}
                  onChange={(v) =>
                    setItems((p) => p.map((x) => (x.id === b.id ? { ...x, imageFit: v as HeroImageFit } : x)))
                  }
                  options={[
                    { value: "cover", label: "Cover (Kırp & Doldur)" },
                    { value: "contain", label: "Contain (Sığdır)" },
                    { value: "auto", label: "Auto (Doğal Boyut)" },
                  ]}
                />

                <SelectField
                  label="Overlay Gücü"
                  value={b.overlayStrength || "medium"}
                  onChange={(v) =>
                    setItems((p) =>
                      p.map((x) => (x.id === b.id ? { ...x, overlayStrength: v as HeroOverlayStrength } : x))
                    )
                  }
                  options={[
                    { value: "soft", label: "Soft" },
                    { value: "medium", label: "Medium" },
                    { value: "strong", label: "Strong" },
                  ]}
                />
              </div>

              {isTextOpen ? (
  <div className={styles.grid2}>
    <div className={styles.panel}>
      <div className={styles.panelTitle}>TR</div>

      <Field
        label="Eyebrow"
        value={s((b as any)?.eyebrow?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, eyebrow: { ...(x.eyebrow as any), tr: v } } : x))
          )
        }
      />

      <Field
        label="Başlık"
        value={s((b as any)?.title?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, title: { ...(x.title as any), tr: v } } : x))
          )
        }
      />

      <Field
        label="Alt Metin"
        value={s((b as any)?.subtitle?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, subtitle: { ...(x.subtitle as any), tr: v } } : x))
          )
        }
      />

      <Field
        label="Start Label"
        value={s((b as any)?.startLabel?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, startLabel: { ...(x.startLabel as any), tr: v } } : x))
          )
        }
      />

      <Field
        label="Fiyat"
        value={s((b as any)?.priceText?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, priceText: { ...(x.priceText as any), tr: v } } : x))
          )
        }
      />

      <Field
        label="Badge"
        value={s((b as any)?.image?.badgeText?.tr)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) =>
              x.id === b.id
                ? {
                    ...x,
                    image: {
                      ...(x.image ?? {}),
                      badgeText: { ...((x.image as any)?.badgeText ?? {}), tr: v },
                    },
                  }
                : x
            )
          )
        }
      />

      <TextArea
        label="Maddeler (satır satır)"
        value={Array.isArray((b as any)?.bullets?.tr) ? (b as any).bullets.tr.join("\n") : ""}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) =>
              x.id === b.id
                ? {
                    ...x,
                    bullets: {
                      ...((x.bullets as any) ?? {}),
                      tr: v.split("\n").map(s).filter(Boolean),
                    },
                  }
                : x
            )
          )
        }
      />
    </div>

    <div className={styles.panel}>
      <div className={styles.panelTitle}>EN</div>

      <Field
        label="Eyebrow"
        value={s((b as any)?.eyebrow?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, eyebrow: { ...(x.eyebrow as any), en: v } } : x))
          )
        }
      />

      <Field
        label="Title"
        value={s((b as any)?.title?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, title: { ...(x.title as any), en: v } } : x))
          )
        }
      />

      <Field
        label="Subtitle"
        value={s((b as any)?.subtitle?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, subtitle: { ...(x.subtitle as any), en: v } } : x))
          )
        }
      />

      <Field
        label="Start Label"
        value={s((b as any)?.startLabel?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, startLabel: { ...(x.startLabel as any), en: v } } : x))
          )
        }
      />

      <Field
        label="Price"
        value={s((b as any)?.priceText?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) => (x.id === b.id ? { ...x, priceText: { ...(x.priceText as any), en: v } } : x))
          )
        }
      />

      <Field
        label="Badge"
        value={s((b as any)?.image?.badgeText?.en)}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) =>
              x.id === b.id
                ? {
                    ...x,
                    image: {
                      ...(x.image ?? {}),
                      badgeText: { ...((x.image as any)?.badgeText ?? {}), en: v },
                    },
                  }
                : x
            )
          )
        }
      />

     <Field
  label="Secondary CTA TR"
  value={s((b.secondaryCta as any)?.label?.tr)}
  onChange={(v) =>
    setItems((p) =>
      p.map((x) =>
        x.id === b.id
          ? {
              ...x,
              secondaryCta: {
                ...(x.secondaryCta ?? {}),
                label: { ...(((x.secondaryCta as any)?.label ?? {}) as any), tr: v },
              },
            }
          : x
      )
    )
  }
/>

    <Field
  label="Secondary CTA EN"
  value={s((b.secondaryCta as any)?.label?.en)}
  onChange={(v) =>
    setItems((p) =>
      p.map((x) =>
        x.id === b.id
          ? {
              ...x,
              secondaryCta: {
                ...(x.secondaryCta ?? {}),
                label: { ...(((x.secondaryCta as any)?.label ?? {}) as any), en: v },
              },
            }
          : x
      )
    )
  }
/>

      <TextArea
        label="Bullets"
        value={Array.isArray((b as any)?.bullets?.en) ? (b as any).bullets.en.join("\n") : ""}
        onChange={(v) =>
          setItems((p) =>
            p.map((x) =>
              x.id === b.id
                ? {
                    ...x,
                    bullets: {
                      ...((x.bullets as any) ?? {}),
                      en: v.split("\n").map(s).filter(Boolean),
                    },
                  }
                : x
            )
          )
        }
      />
    </div>
  </div>
) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <input
        className={styles.input}
        value={value}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        rows={4}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Page() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <AdminHomePromosPage />
      </PermissionGate>
    </AdminGate>
  );
}