"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { adminFetch } from "@/lib/adminFetch";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import { resolveProductPriceTRY, formatTRY, type RatesLatest } from "@/lib/pricing";
import s from "./page.module.css";

/* ── Types ── */
type CategoryDoc = {
  id: string;
  slug: string;
  name: string;
  pricing?: any;
  compareAtPercent?: number;
  compareAtEnabled?: boolean;
};

type ProductRow = {
  id: string;
  title: string;
  sku: string;
  slug: string;
  categoryIds: string[];
  categoryNames: string[];
  price: number;
  finalPrice: number;
  priceMode: string;
  compareAtPercent: number;
  compareAtEnabled: boolean;
  compareAtOverrideEnabled: boolean;
  categoryPricingEnabled: boolean;
  categoryPricing: any;
  resolvedCategoryPricing: any;
  stock: number;
  isActive: boolean;
  hasGram: number;
  gram: number;
  priceRateCode: string;
  pricePercent: number;
  priceFixedAdd: number;
  priceOverrideEnabled: boolean;
  priceOverride: number;
};

type Tab = "products" | "categories";

/* ── Helpers ── */
function pickTitle(p: any): string {
  if (typeof p?.title === "string") return p.title;
  if (typeof p?.title === "object") return String(p.title?.tr || p.title?.en || "");
  if (typeof p?.name === "string") return p.name;
  return "";
}

function pickCategoryName(c: any): string {
  if (typeof c?.name === "string") return c.name;
  if (typeof c?.name === "object") return String(c.name?.tr || c.name?.en || "");
  if (typeof c?.title === "string") return c.title;
  if (typeof c?.title === "object") return String(c.title?.tr || c.title?.en || "");
  return c?.slug || c?.id || "";
}

function fmt(n: number) {
  return formatTRY(n, 2);
}

/* ── Component ── */
function DiscountsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [tab, setTab] = useState<Tab>("products");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [rates, setRates] = useState<RatesLatest | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState("");
  const [qText, setQText] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterDiscount, setFilterDiscount] = useState<"all" | "active" | "none">("all");
  const [bulkPercent, setBulkPercent] = useState<number>(5);
  const [catDirty, setCatDirty] = useState<Record<string, number>>({});
  const [catSaving, setCatSaving] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout((showToast as any)._t);
    (showToast as any)._t = setTimeout(() => setToast(""), 2200);
  }

  // ── Load Rates ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRates(snap.exists() ? (snap.data() as any) : null),
      () => setRates(null)
    );
    return () => unsub();
  }, [db]);

  // ── Load Products ──
  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(800));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: ProductRow[] = [];
        snap.forEach((d) => {
          const p = d.data() as any;
          list.push({
            id: d.id,
            title: pickTitle(p),
            sku: String(p.sku || ""),
            slug: String(p.slug || d.id),
            categoryIds: Array.isArray(p.categoryIds) ? p.categoryIds : [],
            categoryNames: [],
            price: Number(p.price || 0),
            finalPrice: Number(p.finalPrice || 0),
            priceMode: String(p.priceMode || "fixed"),
            compareAtPercent: Number(p.compareAtPercent || 0),
            compareAtEnabled:
              p.compareAtEnabled === true ||
              p.categoryPricing?.compareAtEnabled === true ||
              p.resolvedCategoryPricing?.compareAtEnabled === true,
            compareAtOverrideEnabled: !!p.compareAtOverrideEnabled,
            categoryPricingEnabled: !!p.categoryPricingEnabled,
            categoryPricing: p.categoryPricing || null,
            resolvedCategoryPricing: p.resolvedCategoryPricing || null,
            stock: Number(p.stock || 0),
            isActive: p.isActive !== false,
            hasGram: Number(p.hasGram || 0),
            gram: Number(p.gram || 0),
            priceRateCode: String(p.priceRateCode || ""),
            pricePercent: Number(p.pricePercent || 0),
            priceFixedAdd: Number(p.priceFixedAdd || 0),
            priceOverrideEnabled: !!p.priceOverrideEnabled,
            priceOverride: Number(p.priceOverride || 0),
          });
        });
        setProducts(list);
        setLoading(false);
      },
      () => {
        showToast("Ürünler yüklenemedi");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [db]);

  // ── Load Categories ──
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "categories"), orderBy("order", "asc")),
      (snap) => {
        const list: CategoryDoc[] = snap.docs.map((d) => {
          const c = d.data() as any;
          return {
            id: d.id,
            slug: String(c.slug || d.id),
            name: pickCategoryName(c),
            pricing: c.pricing || null,
            compareAtPercent: Number(
              c.pricing?.compareAtPercent || c.compareAtPercent || 0
            ),
            compareAtEnabled:
              c.pricing?.compareAtEnabled === true ||
              c.compareAtEnabled === true,
          };
        });
        setCategories(list);
      },
      () => setCategories([])
    );
    return () => unsub();
  }, [db]);

  // ── Category map ──
  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => {
      m[c.id] = c.name;
    });
    return m;
  }, [categories]);

  // ── Filtered Products ──
  const filtered = useMemo(() => {
    const q = qText.toLowerCase().trim();
    return products
      .filter((p) => {
        if (q) {
          const hay = `${p.title} ${p.sku} ${p.id} ${p.slug}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filterCat) {
          if (!p.categoryIds.includes(filterCat)) return false;
        }
        if (filterDiscount === "active") {
          const eff = dirty[p.id] != null ? dirty[p.id] : p.compareAtPercent;
          if (eff <= 0) return false;
        }
        if (filterDiscount === "none") {
          const eff = dirty[p.id] != null ? dirty[p.id] : p.compareAtPercent;
          if (eff > 0) return false;
        }
        return true;
      })
      .map((p) => ({
        ...p,
        categoryNames: p.categoryIds.map((id) => catMap[id] || id).filter(Boolean),
      }));
  }, [products, qText, filterCat, filterDiscount, dirty, catMap]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = products.length;
    const withDiscount = products.filter((p) => {
      const eff = dirty[p.id] != null ? dirty[p.id] : p.compareAtPercent;
      return eff > 0;
    }).length;
    const withoutDiscount = total - withDiscount;
    const selected = Object.values(sel).filter(Boolean).length;
    return { total, withDiscount, withoutDiscount, selected };
  }, [products, dirty, sel]);

  // ── Helpers ──
  function getEffectiveDiscount(p: ProductRow): number {
    return dirty[p.id] != null ? dirty[p.id] : p.compareAtPercent;
  }

  function setSelAll(next: boolean) {
    const map: Record<string, boolean> = {};
    for (const r of filtered) map[r.id] = next;
    setSel(map);
  }

  function selectedIds(): string[] {
    return Object.entries(sel)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  // ── Save single product discount ──
  async function saveProductDiscount(id: string, percent: number) {
    setSavingId(id);
    try {
      const pct = Math.max(0, Math.min(99, percent));
      await updateDoc(doc(db, "products", id), {
        compareAtPercent: pct,
        compareAtEnabled: pct > 0,
        compareAtOverrideEnabled: true,
        updatedAt: serverTimestamp(),
      });
      setDirty((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      showToast(`%${pct} indirim uygulandı ✅`);
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSavingId("");
    }
  }

  // ── Remove single product discount ──
  async function removeProductDiscount(id: string) {
    setSavingId(id);
    try {
      await updateDoc(doc(db, "products", id), {
        compareAtPercent: 0,
        compareAtEnabled: false,
        updatedAt: serverTimestamp(),
      });
      setDirty((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      showToast("İndirim kaldırıldı ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaldırılamadı");
    } finally {
      setSavingId("");
    }
  }

  // ── Bulk apply discount ──
  async function bulkApply() {
    const ids = selectedIds();
    if (!ids.length) return showToast("Önce ürün seç");
    const pct = Math.max(0, Math.min(99, bulkPercent));
    if (!window.confirm(`Seçili ${ids.length} ürüne %${pct} indirim uygulansın mı?`)) return;

    setSavingId("bulk");
    try {
      for (const id of ids) {
        await updateDoc(doc(db, "products", id), {
          compareAtPercent: pct,
          compareAtEnabled: pct > 0,
          compareAtOverrideEnabled: true,
          updatedAt: serverTimestamp(),
        });
      }
      setSel({});
      setDirty({});
      showToast(`${ids.length} ürüne %${pct} indirim uygulandı ✅`);
    } catch (e: any) {
      showToast(e?.message || "Toplu uygulama başarısız");
    } finally {
      setSavingId("");
    }
  }

  // ── Bulk remove discount ──
  async function bulkRemove() {
    const ids = selectedIds();
    if (!ids.length) return showToast("Önce ürün seç");
    if (!window.confirm(`Seçili ${ids.length} üründen indirim kaldırılsın mı?`)) return;

    setSavingId("bulk");
    try {
      for (const id of ids) {
        await updateDoc(doc(db, "products", id), {
          compareAtPercent: 0,
          compareAtEnabled: false,
          updatedAt: serverTimestamp(),
        });
      }
      setSel({});
      setDirty({});
      showToast(`${ids.length} üründen indirim kaldırıldı ✅`);
    } catch (e: any) {
      showToast(e?.message || "Kaldırılamadı");
    } finally {
      setSavingId("");
    }
  }

  // ── Category discount apply ──
  async function applyCategoryDiscount(catId: string) {
    const pct = Math.max(0, Math.min(99, catDirty[catId] ?? 0));
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    setCatSaving(catId);
    try {
      const res = await adminFetch("/api/admin/categories/apply-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: catId,
          categorySlug: cat.slug,
          pricing: {
            enabled: true,
            compareAtPercent: pct,
            compareAtEnabled: pct > 0,
            pricePercent: cat.pricing?.pricePercent || 0,
            priceFixedAdd: cat.pricing?.priceFixedAdd || 0,
            refreshMode: cat.pricing?.refreshMode || "manual",
          },
        }),
      });

      const data = await res.json();
      if (data?.ok) {
        setCatDirty((prev) => {
          const n = { ...prev };
          delete n[catId];
          return n;
        });
        showToast(`${cat.name}: %${pct} indirim → ${data.updated} ürüne uygulandı ✅`);
      } else {
        showToast(data?.error || "Uygulama başarısız");
      }
    } catch (e: any) {
      showToast(e?.message || "Hata oluştu");
    } finally {
      setCatSaving("");
    }
  }

  // ── Category discount remove ──
  async function removeCategoryDiscount(catId: string) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    if (!window.confirm(`${cat.name} kategorisindeki indirim kaldırılsın mı?`)) return;

    setCatSaving(catId);
    try {
      const res = await adminFetch("/api/admin/categories/apply-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: catId,
          categorySlug: cat.slug,
          pricing: {
            enabled: true,
            compareAtPercent: 0,
            compareAtEnabled: false,
            pricePercent: cat.pricing?.pricePercent || 0,
            priceFixedAdd: cat.pricing?.priceFixedAdd || 0,
            refreshMode: cat.pricing?.refreshMode || "manual",
          },
        }),
      });

      const data = await res.json();
      if (data?.ok) {
        setCatDirty((prev) => {
          const n = { ...prev };
          delete n[catId];
          return n;
        });
        showToast(`${cat.name}: indirim kaldırıldı → ${data.updated} ürün güncellendi ✅`);
      } else {
        showToast(data?.error || "Kaldırma başarısız");
      }
    } catch (e: any) {
      showToast(e?.message || "Hata oluştu");
    } finally {
      setCatSaving("");
    }
  }

  // ── Count products per category ──
  const catProductCounts = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach((p) => {
      p.categoryIds.forEach((cid) => {
        m[cid] = (m[cid] || 0) + 1;
      });
    });
    return m;
  }, [products]);

  const isBusy = savingId !== "";

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      {/* ── Header ── */}
      <header className={s.top}>
        <div className={s.kicker}>Admin • Pazarlama</div>
        <h1 className={s.title}>İndirim Yönetimi</h1>
        <div className={s.sub}>
          Ürünlere tek tek, toplu veya kategori bazlı indirim uygula.{" "}
          <span className={s.dim}>(compareAtPercent → gerçek indirim)</span>
        </div>

        <div className={s.statsRow}>
          <div className={s.stat}>
            <span>Toplam</span>
            <b>{stats.total}</b>
          </div>
          <div className={`${s.stat} ${s.statOk}`}>
            <span>İndirimli</span>
            <b>{stats.withDiscount}</b>
          </div>
          <div className={s.stat}>
            <span>İndirimsiz</span>
            <b>{stats.withoutDiscount}</b>
          </div>
          <div className={`${s.stat} ${s.statInfo}`}>
            <span>Seçili</span>
            <b>{stats.selected}</b>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className={s.tabsBar}>
        <button
          type="button"
          className={`${s.tabBtn} ${tab === "products" ? s.tabBtnActive : ""}`}
          onClick={() => setTab("products")}
        >
          Ürün Bazlı
        </button>
        <button
          type="button"
          className={`${s.tabBtn} ${tab === "categories" ? s.tabBtnActive : ""}`}
          onClick={() => setTab("categories")}
        >
          Kategori Bazlı
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ── Products Tab ── */}
      {/* ═══════════════════════════════════════════ */}
      {tab === "products" ? (
        <>
          {/* Controls */}
          <div className={s.controls}>
            <div className={s.searchWrap}>
              <input
                className={s.search}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Ara: ürün adı / sku / id"
              />
            </div>

            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="">Tüm Kategoriler</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({catProductCounts[c.id] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={filterDiscount}
                onChange={(e) => setFilterDiscount(e.target.value as any)}
              >
                <option value="all">Tümü</option>
                <option value="active">İndirimli</option>
                <option value="none">İndirimsiz</option>
              </select>
            </div>
          </div>

          {/* Bulk Bar */}
          <div className={s.bulkBar}>
            <span className={s.bulkLabel}>Toplu İşlem:</span>

            <button className={s.btnGhost} type="button" onClick={() => setSelAll(true)}>
              Hepsini seç
            </button>
            <button className={s.btnGhost} type="button" onClick={() => setSelAll(false)}>
              Seçimi temizle
            </button>

            <span className={s.bulkSep} />

            <span style={{ fontSize: 12, fontWeight: 800 }}>%</span>
            <input
              className={s.bulkInput}
              type="number"
              min={0}
              max={99}
              value={bulkPercent}
              onChange={(e) => setBulkPercent(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
            />

            <button className={s.btnPrimary} type="button" onClick={bulkApply} disabled={isBusy}>
              {isBusy && savingId === "bulk" ? "⏳ Uygulanıyor…" : `Seçilenlere %${bulkPercent} Uygula`}
            </button>

            <span className={s.bulkSep} />

            <button className={s.btnDanger} type="button" onClick={bulkRemove} disabled={isBusy}>
              Seçilenlerden Kaldır
            </button>
          </div>

          {/* Table */}
          <section className={s.card}>
            <div className={s.table}>
              <div className={`${s.th} ${s.colSel}`}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((r) => sel[r.id])}
                  onChange={(e) => setSelAll(e.target.checked)}
                />
              </div>
              <div className={`${s.th} ${s.colTitle}`}>Ürün</div>
              <div className={`${s.th} ${s.colCategory}`}>Kategori</div>
              <div className={`${s.th} ${s.colPrice}`}>Fiyat</div>
              <div className={`${s.th} ${s.colDiscount}`}>İndirim %</div>
              <div className={`${s.th} ${s.colFinal}`}>İndirimli</div>
              <div className={`${s.th} ${s.colActions}`}>İşlem</div>

              {loading ? (
                <div className={s.empty}>Yükleniyor…</div>
              ) : filtered.length === 0 ? (
                <div className={s.empty}>Sonuç yok.</div>
              ) : (
                filtered.map((r) => {
                  const effectivePercent = getEffectiveDiscount(r);
                  const isDirtyRow = dirty[r.id] != null;
                  const isSaving = savingId === r.id;

                  const resolved = resolveProductPriceTRY( // eslint-disable-line @typescript-eslint/no-unused-vars
                    { ...r, compareAtPercent: effectivePercent, compareAtEnabled: effectivePercent > 0, compareAtOverrideEnabled: true },
                    rates
                  );

                  const displayPrice = r.finalPrice > 0 ? r.finalPrice : r.price;
                  const discountedPrice = effectivePercent > 0
                    ? displayPrice * (1 - effectivePercent / 100)
                    : displayPrice;

                  return (
                    <React.Fragment key={r.id}>
                      <div className={`${s.td} ${s.colSel}`}>
                        <input
                          type="checkbox"
                          checked={!!sel[r.id]}
                          onChange={(e) =>
                            setSel((prev) => ({ ...prev, [r.id]: e.target.checked }))
                          }
                        />
                      </div>

                      <div className={`${s.td} ${s.colTitle}`}>
                        <div className={s.nameRow}>
                          <span className={s.name}>{r.title || r.id}</span>
                          {!r.isActive ? <span className={s.pillOff}>Pasif</span> : null}
                          {r.compareAtPercent > 0 && !isDirtyRow ? (
                            <span className={s.pillDiscount}>%{r.compareAtPercent}</span>
                          ) : null}
                        </div>
                        <div className={s.mini}>
                          {r.sku ? <><span className={s.mono}>{r.sku}</span><span className={s.dot}>•</span></> : null}
                          <span className={s.mono}>{r.id.substring(0, 12)}</span>
                        </div>
                      </div>

                      <div className={`${s.td} ${s.colCategory}`}>
                        {r.categoryNames.length > 0
                          ? r.categoryNames.slice(0, 2).map((n) => (
                            <span key={n} className={s.pillCat}>{n}</span>
                          ))
                          : <span className={s.dim}>—</span>}
                      </div>

                      <div className={`${s.td} ${s.colPrice}`}>
                        {effectivePercent > 0 ? (
                          <div className={s.priceOld}>{fmt(displayPrice)}</div>
                        ) : null}
                        <div>{fmt(displayPrice)}</div>
                      </div>

                      <div className={`${s.td} ${s.colDiscount}`}>
                        <input
                          className={s.discountInput}
                          type="number"
                          min={0}
                          max={99}
                          value={effectivePercent}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                            setDirty((prev) => ({ ...prev, [r.id]: v }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isDirtyRow) {
                              saveProductDiscount(r.id, dirty[r.id]);
                            }
                          }}
                        />
                      </div>

                      <div className={`${s.td} ${s.colFinal}`}>
                        {effectivePercent > 0 ? (
                          <span className={s.priceNew}>{fmt(discountedPrice)}</span>
                        ) : (
                          <span className={s.dim}>—</span>
                        )}
                      </div>

                      <div className={`${s.td} ${s.colActions}`}>
                        <div className={s.inlineActions}>
                          {isDirtyRow ? (
                            <button
                              className={s.miniBtnSave}
                              type="button"
                              onClick={() => saveProductDiscount(r.id, dirty[r.id])}
                              disabled={isSaving || isBusy}
                            >
                              {isSaving ? "…" : "Kaydet"}
                            </button>
                          ) : null}
                          {effectivePercent > 0 && !isDirtyRow ? (
                            <button
                              className={s.miniBtn}
                              type="button"
                              onClick={() => removeProductDiscount(r.id)}
                              disabled={isSaving || isBusy}
                            >
                              Kaldır
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* ═══════════════════════════════════════════ */}
      {/* ── Categories Tab ── */}
      {/* ═══════════════════════════════════════════ */}
      {tab === "categories" ? (
        <div className={s.catGrid}>
          {categories.map((cat) => {
            const currentPercent = catDirty[cat.id] != null ? catDirty[cat.id] : (cat.compareAtPercent || 0);
            const isDirtyC = catDirty[cat.id] != null; // eslint-disable-line @typescript-eslint/no-unused-vars
            const isSavingC = catSaving === cat.id;
            const productCount = catProductCounts[cat.id] || 0;

            return (
              <div key={cat.id} className={s.catCard}>
                <div className={s.catName}>{cat.name}</div>
                <div className={s.catSlug}>{cat.slug}</div>
                <div className={s.catCount}>{productCount} ürün</div>

                {currentPercent > 0 ? (
                  <div className={s.catBadge}>%{currentPercent} indirim aktif</div>
                ) : (
                  <div className={s.catBadgeOff}>İndirim yok</div>
                )}

                <div className={s.catField}>
                  <div className={s.catFieldLabel}>İndirim Yüzdesi (%)</div>
                  <div className={s.catInputRow}>
                    <input
                      className={s.catInput}
                      type="number"
                      min={0}
                      max={99}
                      value={currentPercent}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                        setCatDirty((prev) => ({ ...prev, [cat.id]: v }));
                      }}
                    />

                    <button
                      className={s.catApply}
                      type="button"
                      onClick={() => applyCategoryDiscount(cat.id)}
                      disabled={isSavingC || savingId !== ""}
                    >
                      {isSavingC ? "⏳ Uygulanıyor…" : `Uygula (${productCount} ürün)`}
                    </button>

                    {currentPercent > 0 ? (
                      <button
                        className={s.catClear}
                        type="button"
                        onClick={() => removeCategoryDiscount(cat.id)}
                        disabled={isSavingC || savingId !== ""}
                      >
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

export default function DiscountsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="products">
        <DiscountsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
