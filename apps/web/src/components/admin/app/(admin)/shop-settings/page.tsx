"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./ShopSettingsAdmin.module.css";

// ✅ burası sende farklı path ise düzelt:
import { uploadProductImage } from "@/lib/uploadProductImage";

type LT = { tr?: string; en?: string };

function s(v: any) {
  return String(v ?? "").trim();
}
function normalizeStats(v: any): any[] {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return Object.values(v);
    return [];
  }
function normalizeStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(/[\n,|]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}

const empty = {
  isActiveOnly: true,
  pageSize: 48,
  defaultSort: "new",
  hero: {
    badge: { tr: "Tüm Ürünler", en: "All Products" },
    title: { tr: "Mağaza", en: "Shop" },
    subtitle: {
      tr: "Tüm ürünleri keşfet. Filtrele, sırala, şık seçimini yap.",
      en: "Discover all items. Filter, sort, choose your style.",
    },
    posterHint: { tr: "Premium seçki", en: "Premium picks" },
    // ✅ yeni: hero poster url’leri
    posterImage: { tr: "", en: "" } as LT,
  },
  featureChips: {
    tr: ["Sertifikalı", "Güvenli ödeme", "Hızlı teslimat"],
    en: ["Certified", "Secure payment", "Fast delivery"],
  },
  stats: [
    { k: "delivery", title: { tr: "Teslimat", en: "Delivery" }, value: { tr: "Hızlı", en: "Fast" } },
    { k: "payment", title: { tr: "Ödeme", en: "Payment" }, value: { tr: "Güvenli", en: "Secure" } },
    { k: "quality", title: { tr: "Kalite", en: "Quality" }, value: { tr: "Sertifikalı", en: "Certified" } },
  ],
};

function ShopSettingsAdminInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "shop_settings"), [db]);

  const [data, setData] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [uploading, setUploading] = useState<null | "tr" | "en">(null);
  const fileTR = useRef<HTMLInputElement | null>(null);
  const fileEN = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.exists() ? (snap.data() as any) : null;

      // ✅ merge + normalize (chips array değilse patlamasın)
      const merged = d ? { ...empty, ...d } : empty;
      merged.featureChips = {
        tr: normalizeStringArray(merged?.featureChips?.tr ?? empty.featureChips.tr),
        en: normalizeStringArray(merged?.featureChips?.en ?? empty.featureChips.en),
      };

      // hero posterImage alanını garanti et
      merged.hero = {
        ...empty.hero,
        ...(merged.hero || {}),
        posterImage: {
          tr: s(merged?.hero?.posterImage?.tr),
          en: s(merged?.hero?.posterImage?.en),
        },
      };

      setData(merged);
    });
    return () => unsub();
  }, [ref]);

  async function uploadPoster(locale: "tr" | "en", file: File) {
    setStatus("");
    setUploading(locale);
    try {
      const url = await uploadProductImage(file, `shop_settings_hero_poster_${locale}`);
  
      setData((p: any) => ({
        ...p,
        hero: {
          ...p.hero,
          posterImage: { ...(p.hero?.posterImage || {}), [locale]: url },
        },
      }));
  
      setStatus(`${locale.toUpperCase()} görsel yüklendi ✅`);
    } catch (e: any) {
      setStatus("Upload hata: " + String(e?.message || e));
    } finally {
      setUploading(null);
      if (locale === "tr" && fileTR.current) fileTR.current.value = "";
      if (locale === "en" && fileEN.current) fileEN.current.value = "";
      setTimeout(() => setStatus(""), 2500);
    }
  }
  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const cleaned = {
        ...data,
        pageSize: Math.max(6, Math.min(120, Number(data?.pageSize ?? 48))),
        defaultSort: ["new", "price_asc", "price_desc"].includes(String(data?.defaultSort))
          ? String(data?.defaultSort)
          : "new",
        isActiveOnly: data?.isActiveOnly !== false,
        hero: {
          ...data.hero,
          badge: { tr: s(data?.hero?.badge?.tr), en: s(data?.hero?.badge?.en) },
          title: { tr: s(data?.hero?.title?.tr), en: s(data?.hero?.title?.en) },
          subtitle: { tr: s(data?.hero?.subtitle?.tr), en: s(data?.hero?.subtitle?.en) },
          posterHint: { tr: s(data?.hero?.posterHint?.tr), en: s(data?.hero?.posterHint?.en) },
          posterImage: { tr: s(data?.hero?.posterImage?.tr), en: s(data?.hero?.posterImage?.en) },
        },
        featureChips: {
          tr: normalizeStringArray(data?.featureChips?.tr),
          en: normalizeStringArray(data?.featureChips?.en),
        },
      };

      await setDoc(ref, cleaned, { merge: true });
      setStatus("Kaydedildi ✅");
    } catch (e: any) {
      setStatus("Hata: " + String(e?.message || e));
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(""), 2500);
    }
  }

  const hero = data?.hero || empty.hero;
  const statsSafe = normalizeStats(data?.stats);
  const statsToShow = statsSafe.length ? statsSafe : empty.stats;
  return (
    <AdminGate>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.h1}>Shop Ayarları</h1>
            <p className={styles.p}>Mağaza sayfasının metinleri + davranışı buradan yönetilir.</p>
          </div>

          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={save} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            {status ? <div className={styles.status}>{status}</div> : null}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.row3}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={!!data?.isActiveOnly}
                onChange={(e) => setData((p: any) => ({ ...p, isActiveOnly: e.target.checked }))}
              />
              <span>Sadece aktif ürünleri göster</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Sayfa limiti</span>
              <input
                className={styles.input}
                type="number"
                value={Number(data?.pageSize ?? 48)}
                onChange={(e) => setData((p: any) => ({ ...p, pageSize: Number(e.target.value || 48) }))}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Varsayılan sıralama</span>
              <select
                className={styles.select}
                value={String(data?.defaultSort ?? "new")}
                onChange={(e) => setData((p: any) => ({ ...p, defaultSort: e.target.value }))}
              >
                <option value="new">En yeni</option>
                <option value="price_asc">Fiyat (artan)</option>
                <option value="price_desc">Fiyat (azalan)</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Hero Metinleri</div>

            <div className={styles.heroGrid}>
              {(["badge", "title", "subtitle", "posterHint"] as const).map((k) => (
                <div key={k} className={styles.box}>
                  <div className={styles.boxHead}>{k}</div>
                  <div className={styles.lang2}>
                    <input
                      className={styles.input}
                      value={s(hero?.[k]?.tr)}
                      placeholder="TR"
                      onChange={(e) =>
                        setData((p: any) => ({
                          ...p,
                          hero: { ...p.hero, [k]: { ...p.hero?.[k], tr: e.target.value } },
                        }))
                      }
                    />
                    <input
                      className={styles.input}
                      value={s(hero?.[k]?.en)}
                      placeholder="EN"
                      onChange={(e) =>
                        setData((p: any) => ({
                          ...p,
                          hero: { ...p.hero, [k]: { ...p.hero?.[k], en: e.target.value } },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.sep} />

            <div className={styles.cardTitle}>Hero Görseli</div>

            <div className={styles.posterGrid}>
              {(["tr", "en"] as const).map((loc) => {
                const url = s(hero?.posterImage?.[loc]);
                const isUp = uploading === loc;
                return (
                  <div key={loc} className={styles.posterCard}>
                    <div className={styles.posterTop}>
                      <div className={styles.badge}>{loc.toUpperCase()}</div>
                      <div className={styles.posterHint}>Mağaza hero posteri</div>
                    </div>

                    <div className={styles.preview}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`${loc} poster`} className={styles.previewImg} />
                      ) : (
                        <div className={styles.previewEmpty}>Görsel yok</div>
                      )}
                    </div>

                    <div className={styles.posterBtns}>
                      <input
                        ref={loc === "tr" ? fileTR : fileEN}
                        className={styles.file}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPoster(loc, f);
                        }}
                      />

                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => (loc === "tr" ? fileTR.current?.click() : fileEN.current?.click())}
                        disabled={isUp}
                      >
                        {isUp ? "Yükleniyor…" : "Görsel Yükle"}
                      </button>

                      {url ? (
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() =>
                            setData((p: any) => ({
                              ...p,
                              hero: {
                                ...p.hero,
                                posterImage: { ...(p.hero?.posterImage || {}), [loc]: "" },
                              },
                            }))
                          }
                          disabled={isUp}
                        >
                          Kaldır
                        </button>
                      ) : null}
                    </div>

                    <div className={styles.smallNote}>Öneri: 1200×1200 veya 1400×1400, JPG/WEBP.</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Feature Chips</div>
            <div className={styles.miniNote}>Virgül veya alt satırla ayırabilirsin.</div>

            <div className={styles.lang2}>
              <textarea
                className={styles.textarea}
                value={normalizeStringArray(data?.featureChips?.tr).join("\n")}
                placeholder="TR (satır satır)"
                onChange={(e) =>
                  setData((p: any) => ({
                    ...p,
                    featureChips: { ...(p.featureChips || {}), tr: e.target.value },
                  }))
                }
              />
              <textarea
                className={styles.textarea}
                value={normalizeStringArray(data?.featureChips?.en).join("\n")}
                placeholder="EN (satır satır)"
                onChange={(e) =>
                  setData((p: any) => ({
                    ...p,
                    featureChips: { ...(p.featureChips || {}), en: e.target.value },
                  }))
                }
              />
            </div>

            <div className={styles.sep} />

            <div className={styles.cardTitle}>Stats</div>
            <div className={styles.miniNote}>3 kart gösteriliyor. İçerikleri düzenle.</div>

            <div className={styles.statsGrid}>
            {statsToShow.slice(0, 3).map((st: any, idx: number) => (
                <div key={st?.k || idx} className={styles.statBox}>
                  <div className={styles.statKey}>
                    <span className={styles.label}>key</span>
                    <input
                      className={styles.input}
                      value={s(st?.k)}
                      onChange={(e) =>
                        setData((p: any) => {
                          const next = [...(p.stats || [])];
                          next[idx] = { ...(next[idx] || {}), k: e.target.value };
                          return { ...p, stats: next };
                        })
                      }
                    />
                  </div>

                  <div className={styles.lang2}>
                    <input
                      className={styles.input}
                      placeholder="Title TR"
                      value={s(st?.title?.tr)}
                      onChange={(e) =>
                        setData((p: any) => {
                          const next = [...(p.stats || [])];
                          next[idx] = { ...(next[idx] || {}), title: { ...(next[idx]?.title || {}), tr: e.target.value } };
                          return { ...p, stats: next };
                        })
                      }
                    />
                    <input
                      className={styles.input}
                      placeholder="Title EN"
                      value={s(st?.title?.en)}
                      onChange={(e) =>
                        setData((p: any) => {
                          const next = [...(p.stats || [])];
                          next[idx] = { ...(next[idx] || {}), title: { ...(next[idx]?.title || {}), en: e.target.value } };
                          return { ...p, stats: next };
                        })
                      }
                    />
                  </div>

                  <div className={styles.lang2}>
                    <input
                      className={styles.input}
                      placeholder="Value TR"
                      value={s(st?.value?.tr)}
                      onChange={(e) =>
                        setData((p: any) => {
                          const next = [...(p.stats || [])];
                          next[idx] = { ...(next[idx] || {}), value: { ...(next[idx]?.value || {}), tr: e.target.value } };
                          return { ...p, stats: next };
                        })
                      }
                    />
                    <input
                      className={styles.input}
                      placeholder="Value EN"
                      value={s(st?.value?.en)}
                      onChange={(e) =>
                        setData((p: any) => {
                          const next = [...(p.stats || [])];
                          next[idx] = { ...(next[idx] || {}), value: { ...(next[idx]?.value || {}), en: e.target.value } };
                          return { ...p, stats: next };
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.foot}>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
              {status ? <div className={styles.status}>{status}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
export default function ShopSettingsAdmin() {
  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <ShopSettingsAdminInner />
      </PermissionGate>
    </AdminGate>
  );
}