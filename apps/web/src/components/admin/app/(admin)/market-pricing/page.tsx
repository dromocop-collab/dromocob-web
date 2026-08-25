"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import {
  calcMarketAverage,
  calcMinMax,
  calcDifferencePercent,
  resolveMarketStatus,
  statusLabel,
  matchQualityLabel,
  availabilityLabel,
  fmtTRY,
  pickTitle,
  pickImage,
  tsToMs,
  type MarketMatch,
  type MarketStatus,
  type MatchQuality,
} from "@/lib/marketPricing";
import s from "./marketPricing.module.css";

/* ─── Types ─── */

type ProductRaw = Record<string, any>;

type EnrichedRow = {
  id: string;
  slug: string;
  title: string;
  sku: string;
  category: string;
  image: string;
  gram: number;
  karat: string;
  ourPrice: number;
  matches: MarketMatch[];
  marketAverage: number | null;
  differencePercent: number | null;
  status: MarketStatus;
  updatedAtMs: number;
};

type StatusFilter = "all" | MarketStatus;
type ModalMode = "add" | "detail" | null;

/* ─── Helpers ─── */

function str(v: any): string {
  return String(v ?? "").trim();
}

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ─── Component ─── */

export default function MarketPricingPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  /* DATA */
  const [products, setProducts] = useState<ProductRaw[]>([]);
  const [rates, setRates] = useState<RatesLatest | null>(null);
  const [allMatches, setAllMatches] = useState<MarketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);

  /* FILTERS */
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  /* MODALS */
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalProductId, setModalProductId] = useState("");

  /* ADD FORM */
  const [addSite, setAddSite] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addQuality, setAddQuality] = useState<MatchQuality>("exact");
  const [addAvail, setAddAvail] = useState<"in_stock" | "out_of_stock" | "unknown">("unknown");
  const [addNote, setAddNote] = useState("");
  const [addActive, setAddActive] = useState(true);
  const [saving, setSaving] = useState(false);

  /* EDIT */
  const [editId, setEditId] = useState("");
  const [editSite, setEditSite] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQuality, setEditQuality] = useState<MatchQuality>("exact");
  const [editAvail, setEditAvail] = useState<"in_stock" | "out_of_stock" | "unknown">("unknown");
  const [editNote, setEditNote] = useState("");
  const [editActive, setEditActive] = useState(true);

  /* TOAST */
  const [toast, setToast] = useState("");
  const toastRef = useRef<any>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 2200);
  }

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Load rates
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rates", "latest"), (snap) => {
      if (snap.exists()) setRates(snap.data() as RatesLatest);
    }, () => {});
    return () => unsub();
  }, [db]);

  // Load products
  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(800));
    const unsub = onSnapshot(qy, (snap) => {
      const list: ProductRaw[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
      setLoading(false);
    }, () => {
      showToast("Ürünler yüklenemedi");
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Load ALL market matches (single query — performant)
  useEffect(() => {
    setMatchesLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "market_price_matches"), orderBy("updatedAt", "desc")),
      (snap) => {
        const list: MarketMatch[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            productId: str(data.productId),
            productTitle: str(data.productTitle),
            productSku: str(data.productSku),
            siteName: str(data.siteName),
            url: str(data.url),
            priceTry: num(data.priceTry),
            currency: str(data.currency) || "TRY",
            availability: data.availability || "unknown",
            matchQuality: data.matchQuality || "exact",
            matchNote: str(data.matchNote),
            isActive: data.isActive !== false,
            status: data.status || "manual",
            error: data.error || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            lastCheckedAt: data.lastCheckedAt,
          });
        });
        setAllMatches(list);
        setMatchesLoading(false);
      },
      () => {
        setMatchesLoading(false);
      }
    );
    return () => unsub();
  }, [db]);

  // Group matches by productId
  const matchesByProduct = useMemo(() => {
    const map: Record<string, MarketMatch[]> = {};
    for (const m of allMatches) {
      if (!map[m.productId]) map[m.productId] = [];
      map[m.productId].push(m);
    }
    return map;
  }, [allMatches]);

  // Build enriched rows
  const rows: EnrichedRow[] = useMemo(() => {
    return products.map((p) => {
      const resolved = resolveProductPriceTRY(p, rates);
      const ourPrice = num(resolved?.price);
      const matches = matchesByProduct[p.id] || [];
      const activeMatches = matches.filter((m) => m.isActive && m.status !== "error" && m.priceTry > 0);
      const marketAvg = calcMarketAverage(matches);
      const diffPct = marketAvg !== null && ourPrice > 0 ? calcDifferencePercent(ourPrice, marketAvg) : null;
      const status = resolveMarketStatus(ourPrice, marketAvg, activeMatches.length);

      return {
        id: p.id,
        slug: str(p.slug),
        title: pickTitle(p),
        sku: str(p.sku),
        category: str(typeof p.category === "string" ? p.category : p.category?.tr || p.category?.name || ""),
        image: pickImage(p),
        gram: num(p.hasGram || p.gram || p.weightGram),
        karat: str(p.karat || p.ayar || ""),
        ourPrice,
        matches,
        marketAverage: marketAvg,
        differencePercent: diffPct,
        status,
        updatedAtMs: tsToMs(p.updatedAt),
      };
    });
  }, [products, rates, matchesByProduct]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [rows]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const competitive = rows.filter((r) => r.status === "competitive").length;
    const normal = rows.filter((r) => r.status === "normal").length;
    const expensive = rows.filter((r) => r.status === "expensive").length;
    const missing = rows.filter((r) => r.status === "missing").length;
    return { total, competitive, normal, expensive, missing };
  }, [rows]);

  // Filtered
  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (debouncedQ) {
          const hay = `${r.title} ${r.sku} ${r.slug} ${r.category}`.toLowerCase();
          if (!hay.includes(debouncedQ)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<MarketStatus, number> = { expensive: 0, normal: 1, competitive: 2, missing: 3 };
        const d = order[a.status] - order[b.status];
        if (d !== 0) return d;
        return b.updatedAtMs - a.updatedAtMs;
      });
  }, [rows, statusFilter, categoryFilter, debouncedQ]);

  // Slots for table columns (max 3)
  function getSlots(r: EnrichedRow): (MarketMatch | null)[] {
    const valid = r.matches.filter((m) => m.isActive && m.priceTry > 0).sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt));
    return [valid[0] || null, valid[1] || null, valid[2] || null];
  }

  function badgeClass(status: MarketStatus): string {
    switch (status) {
      case "competitive": return s.badgeCompetitive;
      case "normal": return s.badgeNormal;
      case "expensive": return s.badgeExpensive;
      case "missing": return s.badgeMissing;
    }
  }

  function diffClass(pct: number | null): string {
    if (pct === null) return s.priceEmpty;
    if (pct > 8) return s.diffPositive;
    if (pct < -8) return s.diffNegative;
    return s.diffNeutral;
  }

  // Current modal row
  const modalRow = useMemo(() => {
    if (!modalProductId) return null;
    return rows.find((r) => r.id === modalProductId) || null;
  }, [modalProductId, rows]);

  /* ─── CRUD ─── */

  function resetAddForm() {
    setAddSite("");
    setAddUrl("");
    setAddPrice("");
    setAddQuality("exact");
    setAddAvail("unknown");
    setAddNote("");
    setAddActive(true);
  }

  function openAddModal(productId: string) {
    setModalProductId(productId);
    setModalMode("add");
    setEditId("");
    resetAddForm();
  }

  function openDetailModal(productId: string) {
    setModalProductId(productId);
    setModalMode("detail");
    setEditId("");
  }

  function closeModal() {
    setModalMode(null);
    setModalProductId("");
    setEditId("");
  }

  // ADD
  async function handleAdd() {
    if (!addSite.trim()) return showToast("Site adı zorunlu");
    if (!addPrice.trim() || num(addPrice) <= 0) return showToast("Geçerli fiyat girin");
    if (!modalRow) return;

    setSaving(true);
    try {
      await addDoc(collection(db, "market_price_matches"), {
        productId: modalRow.id,
        productTitle: modalRow.title,
        productSku: modalRow.sku,
        siteName: addSite.trim(),
        url: addUrl.trim(),
        priceTry: num(addPrice),
        currency: "TRY",
        availability: addAvail,
        matchQuality: addQuality,
        matchNote: addNote.trim(),
        isActive: addActive,
        status: "manual",
        error: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastCheckedAt: serverTimestamp(),
      });
      showToast("Rakip fiyat eklendi ✓");
      resetAddForm();
      // Switch to detail mode to see the result
      setModalMode("detail");
    } catch (e: any) {
      showToast(e?.message || "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  // EDIT – start
  function startEdit(m: MarketMatch) {
    setEditId(m.id);
    setEditSite(m.siteName);
    setEditUrl(m.url);
    setEditPrice(String(m.priceTry));
    setEditQuality(m.matchQuality);
    setEditAvail(m.availability);
    setEditNote(m.matchNote);
    setEditActive(m.isActive);
  }

  function cancelEdit() {
    setEditId("");
  }

  // EDIT – save
  async function handleSaveEdit() {
    if (!editSite.trim()) return showToast("Site adı zorunlu");
    if (num(editPrice) <= 0) return showToast("Geçerli fiyat girin");

    setSaving(true);
    try {
      await updateDoc(doc(db, "market_price_matches", editId), {
        siteName: editSite.trim(),
        url: editUrl.trim(),
        priceTry: num(editPrice),
        availability: editAvail,
        matchQuality: editQuality,
        matchNote: editNote.trim(),
        isActive: editActive,
        updatedAt: serverTimestamp(),
        lastCheckedAt: serverTimestamp(),
      });
      showToast("Güncellendi ✓");
      setEditId("");
    } catch (e: any) {
      showToast(e?.message || "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  // DELETE
  async function handleDelete(matchId: string) {
    if (!confirm("Bu rakip fiyatı silmek istiyor musunuz?")) return;
    try {
      await deleteDoc(doc(db, "market_price_matches", matchId));
      showToast("Silindi ✓");
    } catch (e: any) {
      showToast(e?.message || "Silinemedi");
    }
  }

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      {/* ── HEADER ── */}
      <header className={s.top}>
        <div className={s.kicker}>Admin • Piyasa</div>
        <h1 className={s.title}>Piyasa Fiyat Analizi</h1>
        <div className={s.sub}>
          Ürünlerinizi rakip fiyatlarla karşılaştırın.{" "}
          <span className={s.dim}>(market_price_matches koleksiyonu)</span>
        </div>

        <div className={s.statsRow}>
          <div className={s.stat}>
            <span>Toplam</span>
            <b>{stats.total}</b>
          </div>
          <div className={`${s.stat} ${s.statRed}`}>
            <span>Pahalı</span>
            <b>{stats.expensive}</b>
          </div>
          <div className={`${s.stat} ${s.statYellow}`}>
            <span>Normal</span>
            <b>{stats.normal}</b>
          </div>
          <div className={`${s.stat} ${s.statGreen}`}>
            <span>Rekabetçi</span>
            <b>{stats.competitive}</b>
          </div>
          <div className={`${s.stat} ${s.statGray}`}>
            <span>Veri Yok</span>
            <b>{stats.missing}</b>
          </div>
        </div>
      </header>

      {/* ── CONTROLS ── */}
      <div className={s.controls}>
        <div className={s.searchWrap}>
          <input
            className={s.search}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Ara: ürün adı, SKU, slug…"
          />
        </div>

        <div className={s.filterRow}>
          {(
            [
              ["all", "Tümü"],
              ["expensive", "Pahalı"],
              ["normal", "Normal"],
              ["competitive", "Rekabetçi"],
              ["missing", "Veri Yok"],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${s.filterBtn} ${statusFilter === key ? s.filterActive : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}

          {categories.length > 0 ? (
            <select
              className={s.filterSelect}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : null}

          <span className={s.filterCount}>
            {filtered.length} / {rows.length} ürün
          </span>
        </div>
      </div>

      {/* ── TABLE ── */}
      <section className={s.card} style={{ marginTop: 16 }}>
        <div className={s.scrollWrap}>
          <div className={s.table}>
            <div className={`${s.th} ${s.colImg}`}></div>
            <div className={`${s.th} ${s.colName}`}>Ürün</div>
            <div className={`${s.th} ${s.colSku}`}>SKU</div>
            <div className={`${s.th} ${s.colOur}`}>Bizim Fiyat</div>
            <div className={`${s.th} ${s.colGram}`}>Gram</div>
            <div className={`${s.th} ${s.colRa}`}>Rakip A</div>
            <div className={`${s.th} ${s.colRb}`}>Rakip B</div>
            <div className={`${s.th} ${s.colRc}`}>Rakip C</div>
            <div className={`${s.th} ${s.colAvg}`}>Piyasa Ort.</div>
            <div className={`${s.th} ${s.colDiff}`}>Fark %</div>
            <div className={`${s.th} ${s.colStatus}`}>Durum</div>
            <div className={`${s.th} ${s.colActions}`}>İşlem</div>

            {loading || matchesLoading ? (
              <div className={s.empty}>Yükleniyor…</div>
            ) : filtered.length === 0 ? (
              <div className={s.empty}>Sonuç bulunamadı.</div>
            ) : (
              filtered.map((r) => {
                const slots = getSlots(r);

                return (
                  <React.Fragment key={r.id}>
                    {/* Image */}
                    <div className={`${s.td} ${s.colImg}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={s.thumb}
                        src={r.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/dromocob-mark.svg"; }}
                      />
                    </div>

                    {/* Name */}
                    <div className={`${s.td} ${s.colName}`}>
                      <div className={s.nameWrap}>
                        <span className={s.nameText}>{r.title}</span>
                        <span className={s.nameSlug}>{r.slug || r.id.slice(0, 10)}</span>
                      </div>
                    </div>

                    {/* SKU */}
                    <div className={`${s.td} ${s.colSku}`}>
                      {r.sku ? <span className={s.mono}>{r.sku}</span> : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Our Price */}
                    <div className={`${s.td} ${s.colOur}`}>
                      {r.ourPrice > 0 ? <span className={s.priceOur}>{fmtTRY(r.ourPrice)}</span> : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Gram */}
                    <div className={`${s.td} ${s.colGram}`}>
                      {r.gram > 0 ? <span>{r.gram}g{r.karat ? ` ${r.karat}K` : ""}</span> : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Rakip A */}
                    <div className={`${s.td} ${s.colRa}`}>
                      {slots[0] ? (
                        <div>
                          <div className={s.priceCompetitor}>{fmtTRY(slots[0].priceTry)}</div>
                          <div className={s.nameSlug}>{slots[0].siteName}</div>
                        </div>
                      ) : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Rakip B */}
                    <div className={`${s.td} ${s.colRb}`}>
                      {slots[1] ? (
                        <div>
                          <div className={s.priceCompetitor}>{fmtTRY(slots[1].priceTry)}</div>
                          <div className={s.nameSlug}>{slots[1].siteName}</div>
                        </div>
                      ) : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Rakip C */}
                    <div className={`${s.td} ${s.colRc}`}>
                      {slots[2] ? (
                        <div>
                          <div className={s.priceCompetitor}>{fmtTRY(slots[2].priceTry)}</div>
                          <div className={s.nameSlug}>{slots[2].siteName}</div>
                        </div>
                      ) : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Market Average */}
                    <div className={`${s.td} ${s.colAvg}`}>
                      {r.marketAverage !== null ? <span className={s.priceAvg}>{fmtTRY(r.marketAverage)}</span> : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Diff % */}
                    <div className={`${s.td} ${s.colDiff}`}>
                      {r.differencePercent !== null ? (
                        <span className={diffClass(r.differencePercent)}>
                          {r.differencePercent > 0 ? "+" : ""}{r.differencePercent.toFixed(1)}%
                        </span>
                      ) : <span className={s.priceEmpty}>—</span>}
                    </div>

                    {/* Status */}
                    <div className={`${s.td} ${s.colStatus}`}>
                      <span className={`${s.badge} ${badgeClass(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className={`${s.td} ${s.colActions}`}>
                      <div className={s.rowActions}>
                        <button
                          type="button"
                          className={s.actionBtn}
                          onClick={() => openAddModal(r.id)}
                          title="Rakip fiyat ekle"
                        >
                          + Ekle
                        </button>
                        <button
                          type="button"
                          className={`${s.actionBtn} ${s.actionBtnDetail}`}
                          onClick={() => openDetailModal(r.id)}
                          title="Detay"
                        >
                          Detay
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ══════ ADD MODAL ══════ */}
      {modalMode === "add" && modalRow ? (
        <div className={s.modalOverlay} onClick={closeModal}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>➕ Rakip Fiyat Ekle</h2>
              <button className={s.modalClose} onClick={closeModal}>✕</button>
            </div>
            <div className={s.modalBody}>
              {/* Product Info */}
              <div className={s.modalProductInfo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={s.modalThumb} src={modalRow.image} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/dromocob-mark.svg"; }} />
                <div>
                  <div className={s.modalProductName}>{modalRow.title}</div>
                  <div className={s.modalProductMeta}>
                    {modalRow.sku ? `SKU: ${modalRow.sku} · ` : ""}
                    Bizim: <strong>{fmtTRY(modalRow.ourPrice)}</strong>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className={s.formGrid}>
                <div className={s.formRow}>
                  <div>
                    <div className={s.formLabel}>Site Adı *</div>
                    <input className={s.formInput} value={addSite} onChange={(e) => setAddSite(e.target.value)} placeholder="ör: Trendyol" />
                  </div>
                  <div>
                    <div className={s.formLabel}>Fiyat (₺) *</div>
                    <input className={s.formInput} type="number" min="0" step="0.01" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} placeholder="ör: 15000" />
                  </div>
                </div>

                <div>
                  <div className={s.formLabel}>Rakip Ürün URL</div>
                  <input className={s.formInput} value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="https://..." />
                </div>

                <div className={s.formRow}>
                  <div>
                    <div className={s.formLabel}>Eşleşme Kalitesi</div>
                    <select className={s.formSelect} value={addQuality} onChange={(e) => setAddQuality(e.target.value as MatchQuality)}>
                      <option value="exact">Birebir</option>
                      <option value="similar">Benzer</option>
                      <option value="weak">Zayıf</option>
                    </select>
                  </div>
                  <div>
                    <div className={s.formLabel}>Stok Durumu</div>
                    <select className={s.formSelect} value={addAvail} onChange={(e) => setAddAvail(e.target.value as any)}>
                      <option value="in_stock">Stokta</option>
                      <option value="out_of_stock">Tükendi</option>
                      <option value="unknown">Bilinmiyor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className={s.formLabel}>Not</div>
                  <input className={s.formInput} value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="ör: Aynı model ama farklı gramaj" />
                </div>

                <label className={s.checkRow}>
                  <input type="checkbox" checked={addActive} onChange={(e) => setAddActive(e.target.checked)} />
                  <span>Aktif (hesaplamalara dahil edilsin)</span>
                </label>

                <div className={s.formBtnRow}>
                  <button type="button" className={s.btnGhost} onClick={closeModal}>İptal</button>
                  <button type="button" className={s.btnPrimary} disabled={saving} onClick={handleAdd}>
                    {saving ? "Ekleniyor…" : "Rakip Fiyat Ekle"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══════ DETAIL MODAL ══════ */}
      {modalMode === "detail" && modalRow ? (() => {
        const activeMatches = modalRow.matches.filter((m) => m.isActive && m.priceTry > 0 && m.status !== "error");
        const minMax = calcMinMax(modalRow.matches);

        return (
          <div className={s.modalOverlay} onClick={closeModal}>
            <div className={s.modal} onClick={(e) => e.stopPropagation()}>
              <div className={s.modalHeader}>
                <h2 className={s.modalTitle}>📊 Piyasa Detayı</h2>
                <button className={s.modalClose} onClick={closeModal}>✕</button>
              </div>
              <div className={s.modalBody}>
                {/* Product Info */}
                <div className={s.modalProductInfo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={s.modalThumb} src={modalRow.image} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/dromocob-mark.svg"; }} />
                  <div>
                    <div className={s.modalProductName}>{modalRow.title}</div>
                    <div className={s.modalProductMeta}>
                      {modalRow.sku ? `SKU: ${modalRow.sku} · ` : ""}
                      {modalRow.gram > 0 ? `${modalRow.gram}g${modalRow.karat ? ` ${modalRow.karat}K` : ""} · ` : ""}
                      Bizim: <strong>{fmtTRY(modalRow.ourPrice)}</strong>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`${s.badge} ${badgeClass(modalRow.status)}`}>{statusLabel(modalRow.status)}</span>
                      <Link href={`/admin/products/${encodeURIComponent(modalRow.id)}`} className={s.linkBtn}>
                        Ürün Düzenle →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className={s.detailStats}>
                  <div className={s.detailStat}>
                    <span>Bizim Fiyat</span>
                    <b>{fmtTRY(modalRow.ourPrice)}</b>
                  </div>
                  <div className={s.detailStat}>
                    <span>Piyasa Ort.</span>
                    <b>{modalRow.marketAverage !== null ? fmtTRY(modalRow.marketAverage) : "—"}</b>
                  </div>
                  <div className={s.detailStat}>
                    <span>En Düşük</span>
                    <b>{minMax ? fmtTRY(minMax.min) : "—"}</b>
                  </div>
                  <div className={s.detailStat}>
                    <span>En Yüksek</span>
                    <b>{minMax ? fmtTRY(minMax.max) : "—"}</b>
                  </div>
                  <div className={s.detailStat}>
                    <span>Fark</span>
                    <b className={modalRow.differencePercent !== null ? (modalRow.differencePercent > 8 ? s.diffPositive : modalRow.differencePercent < -8 ? s.diffNegative : s.diffNeutral) : ""}>
                      {modalRow.differencePercent !== null ? `${modalRow.differencePercent > 0 ? "+" : ""}${modalRow.differencePercent.toFixed(1)}%` : "—"}
                    </b>
                  </div>
                  <div className={s.detailStat}>
                    <span>Rakip Sayısı</span>
                    <b>{activeMatches.length}</b>
                  </div>
                </div>

                {/* All Matches */}
                <div className={s.modalSection}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <h4 className={s.modalSectionTitle}>Tüm Rakip Fiyatlar ({modalRow.matches.length})</h4>
                    <button type="button" className={s.btnPrimary} style={{ minHeight: 32, fontSize: 12 }} onClick={() => { setModalMode("add"); resetAddForm(); }}>
                      + Yeni Ekle
                    </button>
                  </div>

                  {modalRow.matches.length === 0 ? (
                    <div className={s.empty} style={{ padding: "20px 16px" }}>
                      Henüz rakip fiyat eklenmemiş.
                    </div>
                  ) : (
                    modalRow.matches.map((m) => (
                      <div key={m.id} className={`${s.compItem} ${!m.isActive ? s.compInactive : ""}`}>
                        {editId === m.id ? (
                          /* EDIT MODE */
                          <div className={s.editForm}>
                            <div className={s.formRow}>
                              <div>
                                <div className={s.formLabel}>Site Adı</div>
                                <input className={s.formInput} value={editSite} onChange={(e) => setEditSite(e.target.value)} />
                              </div>
                              <div>
                                <div className={s.formLabel}>Fiyat (₺)</div>
                                <input className={s.formInput} type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <div className={s.formLabel}>URL</div>
                              <input className={s.formInput} value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                            </div>
                            <div className={s.formRow}>
                              <div>
                                <div className={s.formLabel}>Eşleşme</div>
                                <select className={s.formSelect} value={editQuality} onChange={(e) => setEditQuality(e.target.value as MatchQuality)}>
                                  <option value="exact">Birebir</option>
                                  <option value="similar">Benzer</option>
                                  <option value="weak">Zayıf</option>
                                </select>
                              </div>
                              <div>
                                <div className={s.formLabel}>Stok</div>
                                <select className={s.formSelect} value={editAvail} onChange={(e) => setEditAvail(e.target.value as any)}>
                                  <option value="in_stock">Stokta</option>
                                  <option value="out_of_stock">Tükendi</option>
                                  <option value="unknown">Bilinmiyor</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <div className={s.formLabel}>Not</div>
                              <input className={s.formInput} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                            </div>
                            <label className={s.checkRow}>
                              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                              <span>Aktif</span>
                            </label>
                            <div className={s.formBtnRow}>
                              <button type="button" className={s.btnGhost} onClick={cancelEdit} style={{ minHeight: 32, fontSize: 12 }}>İptal</button>
                              <button type="button" className={s.btnPrimary} disabled={saving} onClick={handleSaveEdit} style={{ minHeight: 32, fontSize: 12 }}>
                                {saving ? "…" : "Kaydet"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* VIEW MODE */
                          <>
                            <div className={s.compLeft}>
                              <div className={s.compSite}>
                                {m.siteName}
                                <span className={`${s.badge} ${s.badgeTiny}`} style={{ marginLeft: 6 }}>
                                  {matchQualityLabel(m.matchQuality)}
                                </span>
                                {!m.isActive ? <span className={`${s.badge} ${s.badgeMissing} ${s.badgeTiny}`} style={{ marginLeft: 4 }}>Pasif</span> : null}
                              </div>
                              {m.url ? (
                                <a href={m.url} target="_blank" rel="noreferrer" className={s.compUrl}>
                                  {m.url.length > 60 ? m.url.slice(0, 60) + "…" : m.url}
                                </a>
                              ) : null}
                              <div className={s.compMeta}>
                                {availabilityLabel(m.availability)} · {m.status === "manual" ? "Manuel" : m.status}
                                {m.matchNote ? ` · ${m.matchNote}` : ""}
                              </div>
                              <div className={s.compDate}>
                                {m.lastCheckedAt ? new Date(tsToMs(m.lastCheckedAt)).toLocaleString("tr-TR") : "—"}
                              </div>
                            </div>
                            <div className={s.compRight}>
                              <div className={s.compPrice}>{fmtTRY(m.priceTry)}</div>
                              <div className={s.compActions}>
                                <button type="button" className={s.compBtn} onClick={() => startEdit(m)}>Düzenle</button>
                                <button type="button" className={`${s.compBtn} ${s.compBtnDanger}`} onClick={() => handleDelete(m.id)}>Sil</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
    </main>
  );
}
