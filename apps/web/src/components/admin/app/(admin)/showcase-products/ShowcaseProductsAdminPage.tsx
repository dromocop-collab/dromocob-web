"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import {

  collection,

  doc,

  getDocs,

  limit,

  orderBy,

  query,

  updateDoc,

  where,

  writeBatch,

} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase.client";

import styles from "./ShowcaseProductsAdminPage.module.css";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  stock: number;
  isActive: boolean;
  showcaseEnabled: boolean;
  showcaseGroups: string[];
  showcaseOrder: number;
};

const GROUPS = [
  { key: "new", label: "Yeni Modeller" },
  { key: "elegance", label: "Elegance" },
];

function s(v: any) {
  return String(v ?? "").trim();
}

function pickTitle(x: any) {
  if (typeof x?.title === "string") return s(x.title);
  return s(x?.title?.tr || x?.title?.en || x?.name?.tr || x?.name?.en || x?.name || "Ürün");
}

function pickImage(x: any) {
  const images = Array.isArray(x?.images) ? x.images : [];
  return s(x?.mainImage || x?.image || x?.cover || x?.thumbnail || images[0] || "/dromocob-mark.svg");
}

function priceOf(x: any) {
  return Number(
    x?.finalPrice ??
      x?.priceTry ??
      x?.unitPriceTry ??
      x?.price ??
      x?.salePrice ??
      0
  );
}

function formatTRY(v: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(Number(v || 0));
  } catch {
    return `₺${Number(v || 0).toLocaleString("tr-TR")}`;
  }
}

function normalizeProduct(id: string, x: any): ProductRow {
  return {
    id,
    title: pickTitle(x),
    slug: s(x?.slug || id),
    sku: s(x?.sku || x?.code || x?.productCode || ""),
    image: pickImage(x),
    price: priceOf(x),
    stock: Number(x?.stock ?? 0),
    isActive: x?.isActive !== false,
    showcaseEnabled: x?.showcase?.enabled === true,
    showcaseGroups: Array.isArray(x?.showcase?.groups)
      ? x.showcase.groups.map((g: any) => s(g)).filter(Boolean)
      : [],
    showcaseOrder: Number(x?.showcase?.order ?? x?.order ?? 9999),
  };
}

export default function ShowcaseProductsAdminPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [qText, setQText] = useState("");
  const [filter, setFilter] = useState<"all" | "selected" | "unselected">("all");
  const [toast, setToast] = useState("");

const fireToast = useCallback((msg: string) => {

  setToast(msg);

  window.clearTimeout((fireToast as any)._t);

  (fireToast as any)._t = window.setTimeout(() => setToast(""), 2200);

}, []);

const loadProducts = useCallback(async () => {
    setLoading(true);

    try {
      const qy = query(
        collection(db, "products"),
        where("isActive", "==", true),
        orderBy("createdAt", "desc"),
        limit(300)
      );

      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => normalizeProduct(d.id, d.data()));

      list.sort((a, b) => {
        if (a.showcaseEnabled !== b.showcaseEnabled) {
          return Number(b.showcaseEnabled) - Number(a.showcaseEnabled);
        }

        if (a.showcaseOrder !== b.showcaseOrder) {
          return a.showcaseOrder - b.showcaseOrder;
        }

        return a.title.localeCompare(b.title, "tr");
      });

      setRows(list);
    } catch (err) {
      console.error("showcase products load error:", err);
      fireToast("Ürünler yüklenemedi.");
    } finally {
      setLoading(false);
    }
}, [db, fireToast]);

useEffect(() => {

  void loadProducts();

}, [loadProducts]);

  const filteredRows = useMemo(() => {
    const q = qText.toLowerCase().trim();

    return rows.filter((p) => {
      if (filter === "selected" && !p.showcaseEnabled) return false;
      if (filter === "unselected" && p.showcaseEnabled) return false;

      if (!q) return true;

      const hay = `${p.title} ${p.slug} ${p.sku}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, qText, filter]);

  const selectedCount = rows.filter((p) => p.showcaseEnabled).length;

  function patchLocal(id: string, patch: Partial<ProductRow>) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function saveProductShowcase(id: string, patch: Partial<ProductRow>) {
    const current = rows.find((p) => p.id === id);
    if (!current) return;

    const next = {
      ...current,
      ...patch,
    };

    patchLocal(id, patch);
    setSavingId(id);

    try {
      await updateDoc(doc(db, "products", id), {
        showcase: {
          enabled: next.showcaseEnabled,
          groups: next.showcaseGroups,
          order: Number(next.showcaseOrder || 9999),
          updatedAt: new Date().toISOString(),
        },
      });

      fireToast("Showcase ayarı kaydedildi ✅");
    } catch (err) {
      console.error("showcase update error:", err);
      patchLocal(id, current);
      fireToast("Kayıt yapılamadı.");
    } finally {
      setSavingId("");
    }
  }

  function toggleGroup(product: ProductRow, groupKey: string) {
    const has = product.showcaseGroups.includes(groupKey);

    const nextGroups = has
      ? product.showcaseGroups.filter((g) => g !== groupKey)
      : [...product.showcaseGroups, groupKey];

    saveProductShowcase(product.id, {
      showcaseGroups: nextGroups,
      showcaseEnabled: nextGroups.length > 0 ? true : product.showcaseEnabled,
    });
  }

  async function clearAllShowcase() {
    const ok = window.confirm(
      "Tüm ürünlerin anasayfa showcase seçimleri kaldırılacak. Emin misin?"
    );

    if (!ok) return;

    setBulkSaving(true);

    try {
      const selected = rows.filter((p) => p.showcaseEnabled || p.showcaseGroups.length);

      const chunks: ProductRow[][] = [];
      for (let i = 0; i < selected.length; i += 450) {
        chunks.push(selected.slice(i, i + 450));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach((p) => {
          batch.update(doc(db, "products", p.id), {
            showcase: {
              enabled: false,
              groups: [],
              order: 9999,
              updatedAt: new Date().toISOString(),
            },
          });
        });

        await batch.commit();
      }

      setRows((prev) =>
        prev.map((p) => ({
          ...p,
          showcaseEnabled: false,
          showcaseGroups: [],
          showcaseOrder: 9999,
        }))
      );

      fireToast("Tüm showcase seçimleri temizlendi ✅");
    } catch (err) {
      console.error("showcase bulk clear error:", err);
      fireToast("Toplu temizleme başarısız.");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <section className={styles.hero}>
        <div>
          <div className={styles.kicker}>ANASAYFA VİTRİN YÖNETİMİ</div>
          <h1>Seçilmiş Ürünler</h1>
          <p>
            Anasayfadaki “Yeni Modeller” ve “Elegance” slider alanına ürünleri hızlıca
            ekle, sırala ve yayından kaldır.
          </p>
        </div>

        <div className={styles.heroStats}>
          <div>
            <b>{rows.length}</b>
            <span>Aktif ürün</span>
          </div>
          <div>
            <b>{selectedCount}</b>
            <span>Vitrinde</span>
          </div>
        </div>
      </section>

      <section className={styles.toolbar}>
        <label className={styles.searchBox}>
          <span>Ürün ara</span>
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Ürün adı, SKU veya slug..."
          />
        </label>

        <div className={styles.filters}>
          <button
            type="button"
            className={filter === "all" ? styles.activeFilter : ""}
            onClick={() => setFilter("all")}
          >
            Tümü
          </button>
          <button
            type="button"
            className={filter === "selected" ? styles.activeFilter : ""}
            onClick={() => setFilter("selected")}
          >
            Vitrindekiler
          </button>
          <button
            type="button"
            className={filter === "unselected" ? styles.activeFilter : ""}
            onClick={() => setFilter("unselected")}
          >
            Seçilmemiş
          </button>
        </div>

        <button
          type="button"
          className={styles.dangerBtn}
          onClick={clearAllShowcase}
          disabled={bulkSaving || selectedCount === 0}
        >
          {bulkSaving ? "Temizleniyor..." : "Tümünü Temizle"}
        </button>

        <button type="button" className={styles.reloadBtn} onClick={loadProducts}>
          Yenile
        </button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>Ürün Listesi</h2>
            <p>Showcase alanına girecek ürünleri buradan yönet.</p>
          </div>
          <span>{filteredRows.length} sonuç</span>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : filteredRows.length ? (
          <div className={styles.grid}>
            {filteredRows.map((p) => {
              const saving = savingId === p.id;

              return (
                <article
                  key={p.id}
                  className={`${styles.card} ${p.showcaseEnabled ? styles.cardSelected : ""}`}
                >
                  <div className={styles.media}>
                    <img
                      src={p.image || "/dromocob-mark.svg"}
                      alt={p.title}
                      onError={(e) => {
                        e.currentTarget.src = "/dromocob-mark.svg";
                      }}
                    />

                    <span className={p.stock > 0 ? styles.stockOk : styles.stockNo}>
                      Stok: {p.stock}
                    </span>

                    {p.showcaseEnabled ? (
                      <span className={styles.selectedBadge}>Vitrinde</span>
                    ) : null}
                  </div>

                  <div className={styles.body}>
                    <div className={styles.titleRow}>
                      <div>
                        <h3>{p.title}</h3>
                        <p>{p.sku || p.slug}</p>
                      </div>

                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={p.showcaseEnabled}
                          onChange={(e) =>
                            saveProductShowcase(p.id, {
                              showcaseEnabled: e.target.checked,
                              showcaseGroups:
                                e.target.checked && p.showcaseGroups.length === 0
                                  ? ["new"]
                                  : p.showcaseGroups,
                            })
                          }
                        />
                        <span />
                      </label>
                    </div>

                    <div className={styles.price}>{formatTRY(p.price)}</div>

                    <div className={styles.groupBox}>
                      <span>Gösterileceği alan</span>

                      <div className={styles.groupBtns}>
                        {GROUPS.map((g) => (
                          <button
                            key={g.key}
                            type="button"
                            className={
                              p.showcaseGroups.includes(g.key) ? styles.groupActive : ""
                            }
                            onClick={() => toggleGroup(p, g.key)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className={styles.orderBox}>
                      <span>Sıra</span>
                      <input
                        type="number"
                        value={p.showcaseOrder}
                        onChange={(e) =>
                          patchLocal(p.id, {
                            showcaseOrder: Number(e.target.value || 9999),
                          })
                        }
                        onBlur={(e) =>
                          saveProductShowcase(p.id, {
                            showcaseOrder: Number(e.target.value || 9999),
                          })
                        }
                      />
                    </label>

                    <div className={styles.actions}>
                      <Link
  href={`/products/${encodeURIComponent(p.slug)}`}
  target="_blank"
  rel="noreferrer"
  className={styles.previewBtn}
>
  Ürünü Gör
</Link>

                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => saveProductShowcase(p.id, {})}
                        disabled={saving}
                      >
                        {saving ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <b>Ürün bulunamadı.</b>
            <span>Arama filtresini değiştir veya listeyi yenile.</span>
          </div>
        )}
      </section>
    </main>
  );
}