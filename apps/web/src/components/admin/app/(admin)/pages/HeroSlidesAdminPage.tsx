"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { uploadSettingsImage } from "@/lib/uploadProductImage";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./heroSlidesAdmin.module.css";


type LocaleText = { tr: string; en: string };

export type HeroSlide = {
  id: string;
  imageUrl: string;
  title: LocaleText;
  subtitle?: LocaleText;
  cta?: LocaleText;
  href?: string;
};

type HomeSettingsDoc = { heroSlides?: HeroSlide[] };

const emptyLT = (): LocaleText => ({ tr: "", en: "" });

function uid() {
  // Safari fallback için
  // eslint-disable-next-line no-restricted-globals
  return (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

function normLT(x: any): LocaleText {
  return {
    tr: typeof x?.tr === "string" ? x.tr : "",
    en: typeof x?.en === "string" ? x.en : "",
  };
}

function normSlides(raw: any): HeroSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    id: String(x?.id || uid()),
    imageUrl: String(x?.imageUrl || "").trim(),
    title: normLT(x?.title),
    subtitle: x?.subtitle ? normLT(x.subtitle) : undefined,
    cta: x?.cta ? normLT(x.cta) : undefined,
    href: String(x?.href || "").trim(),
  }));
}

// Firestore undefined sevmez -> temizle
function clean(obj: any): any {
  if (obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean).filter((v) => v !== null);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = clean(v);
      if (cv === null) continue;
      // boş LT ise bile kalsın (UI için iyi)
      out[k] = cv;
    }
    return out;
  }
  return obj;
}

function HeroSlidesAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "home_settings"), [db]);

  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1400);
  }

  useEffect(() => {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as HomeSettingsDoc) || {};
        setSlides(normSlides(data.heroSlides));
      },
      () => showToast("Firestore okunamadı")
    );
    return () => unsub();
  }, [ref]);

  async function save(next: HeroSlide[]) {
    setSlides(next);
    setSaving(true);
    try {
      const payload = { heroSlides: clean(next) };
      await setDoc(ref, payload, { merge: true });
      showToast("Kaydedildi ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  function setField(i: number, path: string, value: any) {
    const next = structuredClone(slides) as any[];
    const parts = path.split(".");
    let cur = next[i];
    for (let p = 0; p < parts.length - 1; p++) {
      cur[parts[p]] = cur[parts[p]] || {};
      cur = cur[parts[p]];
    }
    cur[parts[parts.length - 1]] = value;
    void save(next as HeroSlide[]);
  }

  function addSlide() {
    const next = structuredClone(slides) as HeroSlide[];
    next.push({
      id: uid(),
      imageUrl: "",
      title: emptyLT(),
      subtitle: emptyLT(),
      cta: emptyLT(),
      href: "/shop",
    });
    void save(next);
  }

  function removeSlide(i: number) {
    const next = slides.filter((_, idx) => idx !== i);
    void save(next);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = structuredClone(slides) as HeroSlide[];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    void save(next);
  }

  async function uploadAndSet(i: number, file: File) {
    showToast("Yükleniyor…");
    try {
      const key = `hero-slide-${slides[i]?.id || uid()}`;
      const url = await uploadSettingsImage(file, key);
      setField(i, "imageUrl", url);
    } catch (e: any) {
      showToast(e?.message || "Upload fail");
    }
  }

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <div className={s.top}>
        <div>
          <div className={s.kicker}>Admin • Anasayfa</div>
          <h1 className={s.title}>Hero Mosaic Slides</h1>
          <div className={s.sub}>
            Firestore: <b className={s.mono}>site_options/home_settings → heroSlides</b>
          </div>
        </div>
        <div className={s.right}>
          <span className={s.pill}>{saving ? "Kaydediliyor…" : "Hazır"}</span>
          <button className={s.btn} type="button" onClick={addSlide}>
            + Slide ekle
          </button>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className={s.empty}>
          Henüz slide yok. <button className={s.linkBtn} onClick={addSlide}>Bir tane ekle</button>
        </div>
      ) : null}

      <div className={s.list}>
        {slides.map((x, i) => (
          <section key={x.id} className={s.card}>
            <div className={s.cardHead}>
              <div className={s.idx}>#{i + 1}</div>
              <div className={s.headBtns}>
                <button className={s.iconBtn} onClick={() => move(i, -1)} type="button">↑</button>
                <button className={s.iconBtn} onClick={() => move(i, 1)} type="button">↓</button>
                <button className={s.dangerBtn} onClick={() => removeSlide(i)} type="button">Sil</button>
              </div>
            </div>

            <div className={s.grid2}>
              <div>
                <div className={s.miniTitle}>Görsel</div>
                <div className={s.row}>
                  <input
                    className={s.input}
                    value={x.imageUrl || ""}
                    onChange={(e) => setField(i, "imageUrl", e.target.value)}
                    placeholder="https://..."
                  />
                  <label className={s.fileBtn}>
                    Upload
                    <input
                      className={s.file}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadAndSet(i, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {x.imageUrl ? (
                  <div className={s.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.imageUrl} alt="preview" />
                  </div>
                ) : null}

                <div className={s.miniHint}>Öneri: 1600×900 veya daha büyük, karanlık tonlar daha premium durur.</div>
              </div>

              <div>
                <div className={s.miniTitle}>Link</div>
                <input
                  className={s.input}
                  value={x.href || ""}
                  onChange={(e) => setField(i, "href", e.target.value)}
                  placeholder="/shop veya https://..."
                />

                <div className={s.miniTitle} style={{ marginTop: 14 }}>CTA</div>
                <div className={s.grid2}>
                  <input className={s.input} value={x.cta?.tr || ""} onChange={(e) => setField(i, "cta.tr", e.target.value)} placeholder="TR (Detaylı Bilgi)" />
                  <input className={s.input} value={x.cta?.en || ""} onChange={(e) => setField(i, "cta.en", e.target.value)} placeholder="EN (Learn more)" />
                </div>
              </div>
            </div>

            <div className={s.grid2}>
              <div>
                <div className={s.miniTitle}>Başlık</div>
                <div className={s.grid2}>
                  <input className={s.input} value={x.title?.tr || ""} onChange={(e) => setField(i, "title.tr", e.target.value)} placeholder="TR" />
                  <input className={s.input} value={x.title?.en || ""} onChange={(e) => setField(i, "title.en", e.target.value)} placeholder="EN" />
                </div>
              </div>

              <div>
                <div className={s.miniTitle}>Alt Başlık</div>
                <div className={s.grid2}>
                  <input className={s.input} value={x.subtitle?.tr || ""} onChange={(e) => setField(i, "subtitle.tr", e.target.value)} placeholder="TR" />
                  <input className={s.input} value={x.subtitle?.en || ""} onChange={(e) => setField(i, "subtitle.en", e.target.value)} placeholder="EN" />
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
export default function HeroSlidesAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <HeroSlidesAdminPageInner />
      </PermissionGate>
    </AdminGate>
  );
}