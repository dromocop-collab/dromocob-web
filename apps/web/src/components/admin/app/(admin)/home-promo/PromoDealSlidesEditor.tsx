"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./promoDealSlidesEditor.module.css";
import { uploadPromoImage, uploadPromoThumb } from "@/lib/uploadProductImage";

type LocaleText = { tr: string; en: string };

export type PromoDealSlide = {
  id: string;
  imageUrl: string;
  thumbUrl?: string;
  href?: string;
  title: LocaleText;
  subtitle?: LocaleText;
  priceBig?: LocaleText;
  badge?: LocaleText;
  order?: number;
  isActive?: boolean;
};

type HomeSettingsDoc = {
  promoDealSlides?: PromoDealSlide[];
};

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function L(t?: LocaleText) {
  return t || { tr: "", en: "" };
}

function normalizeSlides(raw: any): PromoDealSlide[] {
    if (!Array.isArray(raw)) return [];
  
    return raw
      .map((x: any, idx: number) => {
        const id = String(x?.id || "").trim() || `slide_${idx}_${crypto?.randomUUID?.() ?? Date.now()}`;
        const imageUrl = String(x?.imageUrl || "").trim();
        if (!imageUrl) return null;
  
        const orderNum = Number.isFinite(Number(x?.order)) ? Number(x.order) : idx + 1;
  
        const item: PromoDealSlide = {
          id,
          imageUrl,
          thumbUrl: String(x?.thumbUrl || "").trim() || undefined,
          href: String(x?.href || "").trim() || undefined,
          title: {
            tr: String(x?.title?.tr || "").trim(),
            en: String(x?.title?.en || "").trim(),
          },
          subtitle: x?.subtitle
            ? { tr: String(x.subtitle.tr || "").trim(), en: String(x.subtitle.en || "").trim() }
            : undefined,
          priceBig: x?.priceBig
            ? { tr: String(x.priceBig.tr || "").trim(), en: String(x.priceBig.en || "").trim() }
            : undefined,
          badge: x?.badge
            ? { tr: String(x.badge.tr || "").trim(), en: String(x.badge.en || "").trim() }
            : undefined,
          order: orderNum,
          isActive: typeof x?.isActive === "boolean" ? x.isActive : true,
        };
  
        return item;
      })
      .filter((x): x is PromoDealSlide => Boolean(x)) // 👈 TS burada rahatlıyor
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

function stripUndefined<T>(obj: T): T {
  // Firestore setDoc undefined sevmez → temizle
  return JSON.parse(JSON.stringify(obj));
}

const emptySlide = (): PromoDealSlide => ({
  id: `promo_${uid()}`,
  imageUrl: "",
  thumbUrl: "",
  href: "",
  title: { tr: "", en: "" },
  subtitle: { tr: "", en: "" },
  priceBig: { tr: "", en: "" },
  badge: { tr: "", en: "" },
  order: 1,
  isActive: true,
});

export default function PromoDealSlidesEditor() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "home_settings"), [db]);

  const [slides, setSlides] = useState<PromoDealSlide[]>([]);
  const [draft, setDraft] = useState<PromoDealSlide | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");
  const [uploading, setUploading] = useState<"image" | "thumb" | null>(null);

  const imageFileRef = useMemo(() => ({ current: null as HTMLInputElement | null }), []);
  const thumbFileRef = useMemo(() => ({ current: null as HTMLInputElement | null }), []);
  async function makeThumbFromFile(file: File, opts?: { maxW?: number; quality?: number }) {
    const maxW = opts?.maxW ?? 520;     // thumb genişliği
    const quality = opts?.quality ?? 0.82;
  
    // decode
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    });
  
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
  
    const scale = Math.min(1, maxW / Math.max(1, w));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
  
    // canvas
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context yok");
  
    // daha temiz küçültme
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  
    ctx.drawImage(img, 0, 0, tw, th);
  
    // cleanup objectURL
    try { URL.revokeObjectURL(img.src); } catch {}
  
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob başarısız"))),
        "image/webp",
        quality
      );
    });
  
    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + "-thumb.webp", { type: "image/webp" });
  }
  async function doUpload(kind: "image" | "thumb", file?: File | null) {
    if (!draft) return;
    if (!file) return;

    setErr("");
    setUploading(kind);

    try {
      // promoId: draft.id üzerinden namespace
      const promoId = kind === "thumb" ? `${draft.id}-thumb` : draft.id;
      const url = await uploadPromoImage(file, promoId);

      setDraft((prev) => {
        if (!prev) return prev;
        return kind === "image" ? { ...prev, imageUrl: url } : { ...prev, thumbUrl: url };
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Upload hatası");
    } finally {
      setUploading(null);
      // aynı dosyayı tekrar seçebilmek için reset
      try {
        if (kind === "image" && imageFileRef.current) imageFileRef.current.value = "";
        if (kind === "thumb" && thumbFileRef.current) thumbFileRef.current.value = "";
      } catch {}
    }
  }
  useEffect(() => {
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as HomeSettingsDoc) || {};
        const list = normalizeSlides(data.promoDealSlides);
        setSlides(list);
      },
      (e) => {
        console.error(e);
        setSlides([]);
      }
    );
  }, [ref]);

  const startNew = () => {
    const next = emptySlide();
    next.order = (slides.at(-1)?.order ?? slides.length) + 1;
    setDraft(next);
    setErr("");
  };

  const edit = (x: PromoDealSlide) => {
    // deep copy
    setDraft(stripUndefined({ ...x, title: L(x.title), subtitle: L(x.subtitle), priceBig: L(x.priceBig), badge: L(x.badge) }));
    setErr("");
  };

  const remove = async (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    setSaving(true);
    setErr("");
    try {
      const next = slides.filter((x) => x.id !== id);
      await setDoc(
        ref,
        stripUndefined({
          promoDealSlides: next,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Silme hatası");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!draft) return;

    const clean: PromoDealSlide = stripUndefined({
      ...draft,
      id: String(draft.id || "").trim() || `promo_${uid()}`,
      imageUrl: String(draft.imageUrl || "").trim(),
      thumbUrl: String(draft.thumbUrl || "").trim() || undefined,
      href: String(draft.href || "").trim() || undefined,
      title: { tr: String(draft.title?.tr || "").trim(), en: String(draft.title?.en || "").trim() },
      subtitle: draft.subtitle ? { tr: String(draft.subtitle.tr || "").trim(), en: String(draft.subtitle.en || "").trim() } : undefined,
      priceBig: draft.priceBig ? { tr: String(draft.priceBig.tr || "").trim(), en: String(draft.priceBig.en || "").trim() } : undefined,
      badge: draft.badge ? { tr: String(draft.badge.tr || "").trim(), en: String(draft.badge.en || "").trim() } : undefined,
      order: Number.isFinite(Number(draft.order)) ? Number(draft.order) : 1,
      isActive: typeof draft.isActive === "boolean" ? draft.isActive : true,
    });

    if (!clean.imageUrl) {
      setErr("imageUrl boş olamaz.");
      return;
    }
    if (!clean.title.tr && !clean.title.en) {
      setErr("title.tr veya title.en en az biri dolu olmalı.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const exists = slides.some((x) => x.id === clean.id);
      const next = exists ? slides.map((x) => (x.id === clean.id ? clean : x)) : [...slides, clean];
      next.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

      await setDoc(
        ref,
        stripUndefined({
          promoDealSlides: next,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );

      setDraft(null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Kaydetme hatası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <button className={s.primary} onClick={startNew} type="button">
          + Yeni Slide
        </button>
        <div className={s.hint}>Sürükle-bırak yok; sıralama için “Order” değiştir.</div>
      </div>

      {err ? <div className={s.err}>{err}</div> : null}

      <div className={s.grid}>
        {slides.length === 0 ? (
          <div className={s.empty}>Bu alanda slide yok. “Yeni Slide” ile ekle.</div>
        ) : (
          slides.map((x) => (
            <div key={x.id} className={s.card}>
              <div className={s.preview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.imageUrl} alt={x.title.tr || x.title.en || "promo"} />
                <div className={s.overlay}>
                  <div className={s.badge}>{x.badge?.tr || x.badge?.en || "Promo"}</div>
                  <div className={s.price}>{x.priceBig?.tr || x.priceBig?.en || ""}</div>
                </div>
              </div>

              <div className={s.meta}>
                <div className={s.row}>
                  <div className={s.title}>{x.title.tr || x.title.en}</div>
                  <div className={s.order}>#{x.order ?? "-"}</div>
                </div>
                <div className={s.sub}>{x.subtitle?.tr || x.subtitle?.en || x.href || ""}</div>

                <div className={s.actions}>
                  <button className={s.ghost} onClick={() => edit(x)} type="button">
                    Düzenle
                  </button>
                  <button className={s.danger} onClick={() => remove(x.id)} type="button" disabled={saving}>
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {draft ? (
        <div className={s.modalBackdrop} role="dialog" aria-modal="true">
          <div className={s.modal}>
            <div className={s.modalHead}>
              <div>
                <div className={s.modalTitle}>Slide Düzenle</div>
                <div className={s.modalDesc}>TR/EN metinleri + görsel URL’leri</div>
              </div>
              <button className={s.close} onClick={() => setDraft(null)} type="button" aria-label="Kapat">
                ✕
              </button>
            </div>

            <div className={s.formGrid}>
              <label className={s.label}>
                <span>ID</span>
                <input className={s.input} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
              </label>

              <label className={s.label}>
                <span>Order</span>
                <input
                  className={s.input}
                  type="number"
                  value={draft.order ?? 1}
                  onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                />
              </label>

              <label className={s.label} style={{ gridColumn: "1 / -1" }}>
  <span>imageUrl (büyük banner)</span>

  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <input
      className={s.input}
      value={draft.imageUrl}
      onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
      placeholder="https://..."
      style={{ flex: "1 1 520px" }}
    />

    <button
      type="button"
      className={s.primary}
      disabled={uploading !== null}
      onClick={() => imageFileRef.current?.click()}
      style={{ whiteSpace: "nowrap" }}
      title="Bilgisayardan görsel yükle"
    >
      {uploading === "image" ? "Yükleniyor..." : "📤 Büyük Görsel Yükle"}
    </button>

    <input
      ref={(el) => {
        imageFileRef.current = el;
      }}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => doUpload("image", e.target.files?.[0] || null)}
    />
  </div>

  {draft.imageUrl ? (
    <div
      style={{
        marginTop: 10,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,.08)",
        background: "rgba(0,0,0,.02)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={draft.imageUrl} alt="banner" style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  ) : null}
</label>
<label className={s.label} style={{ gridColumn: "1 / -1" }}>
  <span>Görsel Yükle (otomatik thumb üretir)</span>

  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <input
      className={s.input}
      type="file"
      accept="image/*"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;

        try {
          setSaving(true);
          setErr("");

          const promoId = String(draft.id || "").trim() || `promo_${uid()}`;

          // 1) big upload
          const bigUrl = await uploadPromoImage(f, promoId);

          // 2) thumb üret + upload
          const thumbFile = await makeThumbFromFile(f, { maxW: 520, quality: 0.82 });
          const thumbUrl = await uploadPromoThumb(thumbFile, promoId);

          setDraft({
            ...draft,
            id: promoId,
            imageUrl: bigUrl,
            thumbUrl: thumbUrl,
          });

          // file input reset (aynı dosyayı tekrar seçebilmek için)
          e.currentTarget.value = "";
        } catch (err: any) {
          console.error(err);
          setErr(err?.message || "Upload/thumbnail hatası");
        } finally {
          setSaving(false);
        }
      }}
    />

    {saving ? <span style={{ opacity: 0.7 }}>Yükleniyor…</span> : null}
  </div>

  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
    Not: Dış URL yazarsan thumb üretmek CORS yüzünden çalışmayabilir. En sağlamı upload.
  </div>
</label>
<label className={s.label} style={{ gridColumn: "1 / -1" }}>
  <span>thumbUrl (küçük thumbnail) — opsiyonel</span>

  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <input
      className={s.input}
      value={draft.thumbUrl || ""}
      onChange={(e) => setDraft({ ...draft, thumbUrl: e.target.value })}
      placeholder="https://..."
      style={{ flex: "1 1 520px" }}
    />

    <button
      type="button"
      className={s.ghost}
      disabled={uploading !== null}
      onClick={() => thumbFileRef.current?.click()}
      style={{ whiteSpace: "nowrap" }}
      title="Bilgisayardan küçük görsel yükle"
    >
      {uploading === "thumb" ? "Yükleniyor..." : "📎 Thumbnail Yükle"}
    </button>

    <input
      ref={(el) => {
        thumbFileRef.current = el;
      }}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => doUpload("thumb", e.target.files?.[0] || null)}
    />
  </div>

  {draft.thumbUrl ? (
    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 120,
          height: 72,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,.08)",
          background: "rgba(0,0,0,.02)",
          flex: "0 0 auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.thumbUrl} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>Thumbnail preview</div>
    </div>
  ) : null}
</label>

              <label className={s.label} style={{ gridColumn: "1 / -1" }}>
                <span>href — opsiyonel</span>
                <input className={s.input} value={draft.href || ""} onChange={(e) => setDraft({ ...draft, href: e.target.value })} />
              </label>

              <div className={s.langCols}>
                <div className={s.langCol}>
                  <div className={s.langHead}>TR</div>

                  <label className={s.label}>
                    <span>Title (TR)</span>
                    <textarea
                      className={s.textarea}
                      value={draft.title.tr}
                      onChange={(e) => setDraft({ ...draft, title: { ...draft.title, tr: e.target.value } })}
                      placeholder="Sevgililer Günü Özel&#10;Avantajlı Tektaş Fırsatı"
                    />
                  </label>

                  <label className={s.label}>
                    <span>Subtitle (TR)</span>
                    <input
                      className={s.input}
                      value={draft.subtitle?.tr || ""}
                      onChange={(e) => setDraft({ ...draft, subtitle: { ...(draft.subtitle || { tr: "", en: "" }), tr: e.target.value } })}
                    />
                  </label>

                  <label className={s.label}>
                    <span>PriceBig (TR)</span>
                    <input
                      className={s.input}
                      value={draft.priceBig?.tr || ""}
                      onChange={(e) => setDraft({ ...draft, priceBig: { ...(draft.priceBig || { tr: "", en: "" }), tr: e.target.value } })}
                    />
                  </label>

                  <label className={s.label}>
                    <span>Badge (TR)</span>
                    <input
                      className={s.input}
                      value={draft.badge?.tr || ""}
                      onChange={(e) => setDraft({ ...draft, badge: { ...(draft.badge || { tr: "", en: "" }), tr: e.target.value } })}
                    />
                  </label>
                </div>

                <div className={s.langCol}>
                  <div className={s.langHead}>EN</div>

                  <label className={s.label}>
                    <span>Title (EN)</span>
                    <textarea
                      className={s.textarea}
                      value={draft.title.en}
                      onChange={(e) => setDraft({ ...draft, title: { ...draft.title, en: e.target.value } })}
                      placeholder="Valentine Special&#10;Single Stone Deal"
                    />
                  </label>

                  <label className={s.label}>
                    <span>Subtitle (EN)</span>
                    <input
                      className={s.input}
                      value={draft.subtitle?.en || ""}
                      onChange={(e) => setDraft({ ...draft, subtitle: { ...(draft.subtitle || { tr: "", en: "" }), en: e.target.value } })}
                    />
                  </label>

                  <label className={s.label}>
                    <span>PriceBig (EN)</span>
                    <input
                      className={s.input}
                      value={draft.priceBig?.en || ""}
                      onChange={(e) => setDraft({ ...draft, priceBig: { ...(draft.priceBig || { tr: "", en: "" }), en: e.target.value } })}
                    />
                  </label>

                  <label className={s.label}>
                    <span>Badge (EN)</span>
                    <input
                      className={s.input}
                      value={draft.badge?.en || ""}
                      onChange={(e) => setDraft({ ...draft, badge: { ...(draft.badge || { tr: "", en: "" }), en: e.target.value } })}
                    />
                  </label>
                </div>
              </div>

              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={!!draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                Aktif
              </label>
            </div>

            <div className={s.modalActions}>
              <button className={s.ghost} onClick={() => setDraft(null)} type="button">
                İptal
              </button>
              <button className={s.primary} onClick={save} type="button" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}