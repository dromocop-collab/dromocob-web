"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  getDocs,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getRateValueTRY, type RatesLatest } from "@/lib/pricing";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./stockAdmin.module.css";

type ProductDoc = {
  title?: { tr?: string; en?: string } | string;
  name?: string;
  sku?: string;
  stock?: number;
  active?: boolean;
  updatedAt?: any;
  finalPrice?: number;
  price?: number;
  finalCurrency?: string;
  priceMode?: string;
  priceRateCode?: string;
  rateKey?: string;
  pricePercent?: number;
  priceFixedAdd?: number;
  priceOverrideEnabled?: boolean;
  priceOverride?: number;
  gram?: number;
  hasGram?: number;
  weightGram?: number;
  weightGr?: number;
  categoryPricingEnabled?: boolean;
  categoryPricePercent?: number;
  categoryPriceFixedAdd?: number;
  compareAtPercent?: number;
  categoryPricing?: any;
  createdAt?: any;
  previousFinalPrice?: number;
  lastPriceAppliedAt?: any;
};

type Row = {
  id: string;
  title: string;
  sku: string;
  stock: number;
  active: boolean;
  updatedAtMs: number;
  finalPrice: number;
  price: number;
  finalCurrency: string;
  priceMode: string;
  rateKey: string;
  pricePercent: number;
  priceFixedAdd: number;
  priceOverrideEnabled: boolean;
  priceOverride: number;
  gram: number;
  hasGram: number;
  categoryPricingEnabled: boolean;
  categoryPricePercent: number;
  categoryPriceFixedAdd: number;
  compareAtPercent: number;
  createdAtMs: number;
  previousFinalPrice: number;
  lastPriceAppliedAtMs: number;
};

type SortKey = "updated" | "stock" | "title";

function pickTitle(p: ProductDoc) {
  if (typeof p.title === "string") return p.title;
  const tr = (p.title as any)?.tr;
  const en = (p.title as any)?.en;
  return String(tr || en || p.name || "Ürün").trim();
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

function clampInt(v: any, min = 0, max = 999999) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function shortId(id: string) {
  const x = String(id || "").trim();
  if (!x) return "—";
  if (x.length <= 10) return x.toUpperCase();
  return `${x.slice(0, 6).toUpperCase()}…${x.slice(-3).toUpperCase()}`;
}

function StockAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Live rates data
  const [ratesData, setRatesData] = useState<RatesLatest | null>(null);
  const [ratesFetchedAtMs, setRatesFetchedAtMs] = useState(0);

  // UI state
  const [qText, setQText] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [lowThreshold, setLowThreshold] = useState(5);

  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // edit state
  const [savingId, setSavingId] = useState<string>("");
  const [toast, setToast] = useState("");
  const toastRef = useRef<any>(null);

  // price detail modal
  const [priceModalRow, setPriceModalRow] = useState<Row | null>(null);

  // dirty map: id -> stock value (edited but not saved)
  const [dirty, setDirty] = useState<Record<string, number>>({});

  // selection (bulk ops)
  const [sel, setSel] = useState<Record<string, boolean>>({});

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 1600);
  }

  // debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(qText.trim().toLowerCase()), 180);
    return () => window.clearTimeout(t);
  }, [qText]);

  // load rates/latest (realtime)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as RatesLatest;
          setRatesData(d);
          const fa = d?.fetchedAt;
          if (fa) {
            if (typeof (fa as any)?.toMillis === "function") setRatesFetchedAtMs((fa as any).toMillis());
            else if (typeof (fa as any)?.seconds === "number") setRatesFetchedAtMs((fa as any).seconds * 1000);
            else setRatesFetchedAtMs(0);
          }
        }
      },
      (err) => console.error("rates/latest error:", err)
    );
    return () => unsub();
  }, [db]);

  // load products (realtime)
  useEffect(() => {
    setLoading(true);

    // “çok ürün varsa” daha stabil olsun diye orderBy + limit
    const qy = query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(800));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = [];
        snap.forEach((d) => {
          const p = (d.data() || {}) as ProductDoc;
          list.push({
            id: d.id,
            title: pickTitle(p),
            sku: String(p.sku || "").trim(),
            stock: Number.isFinite(p.stock) ? Number(p.stock) : 0,
            active: p.active !== false,
            updatedAtMs: toMs((p as any)?.updatedAt),
            finalPrice: Number(p.finalPrice || 0),
            price: Number(p.price || 0),
            finalCurrency: String(p.finalCurrency || "TRY"),
            priceMode: String(p.priceMode || "fixed"),
            rateKey: String(p.priceRateCode || p.rateKey || "GRAM_ALTIN"),
            pricePercent: Number(p.pricePercent || 0),
            priceFixedAdd: Number(p.priceFixedAdd || 0),
            priceOverrideEnabled: p.priceOverrideEnabled === true,
            priceOverride: Number(p.priceOverride || 0),
            gram: Number(p.gram || 0),
            hasGram: Number(p.hasGram || p.weightGram || p.weightGr || p.gram || 0),
            categoryPricingEnabled: p.categoryPricingEnabled === true,
            categoryPricePercent: Number(p.categoryPricePercent || 0),
            categoryPriceFixedAdd: Number(p.categoryPriceFixedAdd || 0),
            compareAtPercent: Number(p.compareAtPercent || 0),
            createdAtMs: toMs((p as any)?.createdAt),
            previousFinalPrice: Number(p.previousFinalPrice || 0),
            lastPriceAppliedAtMs: toMs((p as any)?.lastPriceAppliedAt),
          });
        });
        setRows(list);
        setLoading(false);

        // dirty stokları “document güncellenmişse” ezmeyelim:
        // sadece doc ile aynıysa temizle (kaydet sonrası)
        setDirty((prev) => {
          const next = { ...prev };
          for (const r of list) {
            if (next[r.id] != null && Number(next[r.id]) === Number(r.stock)) {
              delete next[r.id];
            }
          }
          return next;
        });
      },
      (err) => {
        console.error("products snapshot error:", err);
        showToast("Firestore okunamadı");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    const inactive = total - active;
    const low = rows.filter((r) => r.stock <= lowThreshold).length;
    const out = rows.filter((r) => r.stock <= 0).length;
    const dirtyCount = Object.keys(dirty).length;
    const selected = Object.values(sel).filter(Boolean).length;
    return { total, active, inactive, low, out, dirtyCount, selected };
  }, [rows, dirty, sel, lowThreshold]);

  const filtered = useMemo(() => {
    const t = debouncedQ;
    return rows
      .filter((r) => (showInactive ? true : r.active))
      .filter((r) => (onlyLow ? r.stock <= lowThreshold : true))
      .filter((r) => {
        if (!t) return true;
        const hay = `${r.title} ${r.sku} ${r.id}`.toLowerCase();
        return hay.includes(t);
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "updated") return (a.updatedAtMs - b.updatedAtMs) * dir;
        if (sortKey === "stock") return (a.stock - b.stock) * dir || a.title.localeCompare(b.title, "tr");
        return a.title.localeCompare(b.title, "tr") * dir;
      });
  }, [rows, debouncedQ, showInactive, onlyLow, lowThreshold, sortKey, sortDir]);

  function isDirty(id: string) {
    return dirty[id] != null;
  }

  function displayedStock(r: Row) {
    return dirty[r.id] != null ? dirty[r.id] : r.stock;
  }

  function toggleSel(id: string, next?: boolean) {
    setSel((p) => ({ ...p, [id]: typeof next === "boolean" ? next : !p[id] }));
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

  async function processStockAlerts(productId: string, nextStock: number) {
    try {
      const qy = query(
        collection(db, "stock_alerts"),
        where("productId", "==", productId),
        where("status", "==", "active")
      );
      const snap = await getDocs(qy);
      if (snap.empty) return 0;

      const jobs = snap.docs.map((d) =>
        updateDoc(doc(db, "stock_alerts", d.id), {
          status: "notified",
          lastKnownStock: Number(nextStock || 0),
          updatedAt: serverTimestamp(),
          notifiedAt: serverTimestamp(),
        })
      );

      await Promise.all(jobs);
      return snap.size;
    } catch (err) {
      console.error("processStockAlerts error:", err);
      return 0;
    }
  }

  async function saveStock(id: string, nextStockRaw: number) {
    const nextStock = clampInt(nextStockRaw, 0, 999999);
    const row = rows.find((x) => x.id === id);
    const prevStock = Number(row?.stock ?? 0);

    setSavingId(id);
    try {
      await updateDoc(doc(db, "products", id), {
        stock: nextStock,
        updatedAt: serverTimestamp(),
      });

      let notifiedCount = 0;
      if (prevStock <= 0 && nextStock > 0) {
        notifiedCount = await processStockAlerts(id, nextStock);
      }

      // optimistik: dirty temizle
      setDirty((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });

      if (notifiedCount > 0) showToast(`Kaydedildi ✅ • ${notifiedCount} bildirim işlendi`);
      else showToast("Kaydedildi ✅");
    } catch (e: any) {
      console.error("saveStock error:", e);
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSavingId("");
    }
  }

  async function saveActive(id: string, nextActive: boolean) {
    setSavingId(id);
    try {
      await updateDoc(doc(db, "products", id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      showToast(nextActive ? "Aktif ✅" : "Pasif ✅");
    } catch (e: any) {
      console.error("saveActive error:", e);
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSavingId("");
    }
  }

  async function bulkDelta(delta: number) {
    const ids = selectedIds();
    if (!ids.length) return showToast("Önce ürün seç");
    const ok = window.confirm(`Seçili ${ids.length} ürüne ${delta > 0 ? "+" : ""}${delta} uygula?`);
    if (!ok) return;

    try {
      for (const id of ids) {
        const r = rows.find((x) => x.id === id);
        const cur = clampInt(displayedStock(r as any), 0, 999999);
        await saveStock(id, cur + delta);
      }
      setSel({});
    } catch {
      // saveStock zaten toast basıyor
    }
  }

  async function bulkSet(value: number) {
    const ids = selectedIds();
    if (!ids.length) return showToast("Önce ürün seç");
    const ok = window.confirm(`Seçili ${ids.length} ürünü stok=${value} yap?`);
    if (!ok) return;

    try {
      for (const id of ids) await saveStock(id, value);
      setSel({});
    } catch {
      //
    }
  }

  async function bulkActive(next: boolean) {
    const ids = selectedIds();
    if (!ids.length) return showToast("Önce ürün seç");
    const ok = window.confirm(`Seçili ${ids.length} ürünü ${next ? "AKTİF" : "PASİF"} yap?`);
    if (!ok) return;

    try {
      for (const id of ids) await saveActive(id, next);
      setSel({});
    } catch {
      //
    }
  }

  function onEditStock(id: string, v: any) {
    const n = clampInt(v, 0, 999999);
    setDirty((p) => ({ ...p, [id]: n }));
  }

  function revertStock(id: string) {
    setDirty((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <header className={s.top}>
        <div className={s.headLeft}>
          <div className={s.kicker}>Admin • Stok</div>
          <h1 className={s.title}>Stok Yönetimi</h1>
          <div className={s.sub}>
            Ürün stoklarını canlı düzenle. <span className={s.dim}>(Firestore: products.stock / active)</span>
          </div>

          <div className={s.statsRow}>
            <div className={s.stat}>
              <span>Toplam</span>
              <b>{stats.total}</b>
            </div>
            <div className={s.stat}>
              <span>Aktif</span>
              <b>{stats.active}</b>
            </div>
            <div className={s.stat}>
              <span>Pasif</span>
              <b>{stats.inactive}</b>
            </div>
            <div className={`${s.stat} ${s.statWarn}`}>
              <span>Düşük ≤{lowThreshold}</span>
              <b>{stats.low}</b>
            </div>
            <div className={`${s.stat} ${s.statBad}`}>
              <span>Stok yok</span>
              <b>{stats.out}</b>
            </div>
            <div className={`${s.stat} ${s.statInfo}`}>
              <span>Değişiklik</span>
              <b>{stats.dirtyCount}</b>
            </div>
            <div className={s.stat}>
              <span>Seçili</span>
              <b>{stats.selected}</b>
            </div>
          </div>
        </div>

        <div className={s.controls}>
          <div className={s.searchWrap}>
            <input
              className={s.search}
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Ara: ürün adı / sku / id"
            />
          </div>

          <div className={s.ctrlRow}>
            <label className={s.check}>
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              <span>Düşük stok</span>
            </label>

            <label className={s.check}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              <span>Pasifleri göster</span>
            </label>

            <div className={s.lowWrap}>
              <span className={s.lowLabel}>Eşik</span>
              <input
                className={s.lowInput}
                type="number"
                min={0}
                max={999}
                value={lowThreshold}
                onChange={(e) => setLowThreshold(clampInt(e.target.value, 0, 999))}
                title="Düşük stok eşiği"
              />
            </div>

            <div className={s.sortWrap}>
              <select
                className={s.select}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                title="Sırala"
              >
                <option value="updated">Güncelleme</option>
                <option value="stock">Stok</option>
                <option value="title">İsim</option>
              </select>

              <button
                type="button"
                className={s.sortDir}
                onClick={() => setSortDir((p) => (p === "asc" ? "desc" : "asc"))}
                title="Artan / Azalan"
              >
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          <div className={s.bulkBar}>
            <div className={s.bulkLeft}>
              <button className={s.btnGhost} type="button" onClick={() => setSelAll(true)}>
                Hepsini seç
              </button>
              <button className={s.btnGhost} type="button" onClick={() => setSelAll(false)}>
                Seçimi temizle
              </button>
            </div>

            <div className={s.bulkRight}>
              <button className={s.btnGhost} type="button" onClick={() => bulkDelta(-1)}>
                −1
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkDelta(+1)}>
                +1
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkDelta(+5)}>
                +5
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkDelta(+10)}>
                +10
              </button>
              <span className={s.bulkSep} />
              <button className={s.btnGhost} type="button" onClick={() => bulkSet(0)}>
                Stok 0
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkSet(5)}>
                Stok 5
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkSet(10)}>
                Stok 10
              </button>
              <span className={s.bulkSep} />
              <button className={s.btnGhost} type="button" onClick={() => bulkActive(true)}>
                Aktif
              </button>
              <button className={s.btnGhost} type="button" onClick={() => bulkActive(false)}>
                Pasif
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className={s.card}>
        <div className={s.table}>
          <div className={`${s.th} ${s.colSel}`}>
            <span className={s.dim}>✓</span>
          </div>
          <div className={`${s.th} ${s.colTitle}`}>Ürün</div>
          <div className={`${s.th} ${s.colSku}`}>SKU</div>
          <div className={`${s.th} ${s.colPrice}`}>Fiyat (₺)</div>
          <div className={`${s.th} ${s.colStock}`}>Stok</div>
          <div className={`${s.th} ${s.colActive}`}>Durum</div>
          <div className={`${s.th} ${s.colActions}`}>İşlem</div>

          {loading ? (
            <div className={s.empty}>Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div className={s.empty}>Sonuç yok.</div>
          ) : (
            filtered.map((r) => {
              const low = r.stock <= lowThreshold;
              const out = r.stock <= 0;
              const isSaving = savingId === r.id;
              const stockVal = displayedStock(r);
              const dirtyOn = isDirty(r.id);

              return (
                <React.Fragment key={r.id}>
                  <div className={`${s.td} ${s.colSel}`}>
                    <input
                      type="checkbox"
                      checked={!!sel[r.id]}
                      onChange={(e) => toggleSel(r.id, e.target.checked)}
                    />
                  </div>

                  <div className={`${s.td} ${s.colTitle}`}>
                    <div className={s.nameRow}>
                      <span className={s.name}>{r.title}</span>

                      {!r.active ? <span className={s.pillOff}>Pasif</span> : null}
                      {out ? <span className={s.pillBad}>Stok yok</span> : low ? <span className={s.pillLow}>Düşük</span> : null}
                      {dirtyOn ? <span className={s.pillDirty}>Değişti</span> : null}
                    </div>

                    <div className={s.mini}>
                      id: <span className={s.mono}>{shortId(r.id)}</span>
                      <span className={s.dot}>•</span>
                      <span className={s.dim}>
                        güncelleme: {r.updatedAtMs ? new Date(r.updatedAtMs).toLocaleString("tr-TR") : "—"}
                      </span>
                    </div>
                  </div>

                  <div className={`${s.td} ${s.colSku}`}>
                    {r.sku ? <span className={s.mono}>{r.sku}</span> : <span className={s.dim}>—</span>}
                  </div>

                  <div className={`${s.td} ${s.colPrice}`}>
                    <button
                      type="button"
                      className={s.priceBtn}
                      onClick={() => setPriceModalRow(r)}
                      title="Fiyat detaylarını göster"
                    >
                      <span className={s.priceVal}>
                        {r.finalPrice > 0 ? `₺${r.finalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </span>
                      <span className={s.priceMode}>{r.priceMode}</span>
                    </button>
                  </div>

                  <div className={`${s.td} ${s.colStock}`}>
                    <input
                      className={[
                        s.stockInput,
                        low ? s.lowBorder : "",
                        dirtyOn ? s.dirtyBorder : "",
                      ].join(" ")}
                      type="number"
                      min={0}
                      value={stockVal}
                      onChange={(e) => onEditStock(r.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveStock(r.id, stockVal);
                        if (e.key === "Escape") revertStock(r.id);
                      }}
                      onBlur={() => {
                        if (!dirtyOn) return;
                        saveStock(r.id, stockVal);
                      }}
                    />

                    <div className={s.inlineBtns}>
                      <button className={s.miniBtn} type="button" onClick={() => onEditStock(r.id, stockVal - 1)} disabled={isSaving || stockVal <= 0}>
                        −
                      </button>
                      <button className={s.miniBtn} type="button" onClick={() => onEditStock(r.id, stockVal + 1)} disabled={isSaving}>
                        +
                      </button>
                      <button className={s.miniBtnGhost} type="button" onClick={() => onEditStock(r.id, 0)} disabled={isSaving}>
                        0
                      </button>
                    </div>
                  </div>

                  <div className={`${s.td} ${s.colActive}`}>
                    <button
                      type="button"
                      className={`${s.activeBtn} ${r.active ? s.activeOn : s.activeOff}`}
                      disabled={isSaving}
                      onClick={() => saveActive(r.id, !r.active)}
                      title="Aktif/Pasif değiştir"
                    >
                      {r.active ? "Aktif" : "Pasif"}
                    </button>
                  </div>

                  <div className={`${s.td} ${s.colActions}`}>
                    <div className={s.actions}>
                      <button
                        className={s.btnGhost}
                        type="button"
                        onClick={() => saveStock(r.id, stockVal)}
                        disabled={isSaving || !dirtyOn}
                        title="Kaydet (Enter)"
                      >
                        {isSaving ? "…" : "Kaydet"}
                      </button>

                      <button
                        className={s.btnGhost}
                        type="button"
                        onClick={() => revertStock(r.id)}
                        disabled={isSaving || !dirtyOn}
                        title="Geri al (Esc)"
                      >
                        Geri al
                      </button>

                      {/* İstersen burayı ürün admin edit sayfana bağla */}
                      {/* <Link className={s.btnLink} href={`/admin/products/${encodeURIComponent(r.id)}`}>Ürün →</Link> */}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </section>

      {/* ── Fiyat Detay Modal ── */}
      {priceModalRow ? (() => {
        const r = priceModalRow;
        const liveRate = getRateValueTRY(ratesData, r.rateKey);
        const mode = r.priceMode;
        const pct = r.pricePercent || r.categoryPricePercent;
        const fixedAdd = r.priceFixedAdd || r.categoryPriceFixedAdd;
        const gram = r.hasGram || r.gram;

        // Formül hesabı
        let formulaText = "";
        let computedPrice = 0;
        if (r.priceOverrideEnabled && r.priceOverride > 0) {
          formulaText = `Override = ₺${r.priceOverride.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
          computedPrice = r.priceOverride;
        } else if (mode === "rate_plus" && liveRate > 0) {
          computedPrice = liveRate * (1 + pct / 100);
          formulaText = `${liveRate.toLocaleString("tr-TR", {maximumFractionDigits: 2})} × (1 + %${pct}/100) = ₺${computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (mode === "rate_plus_fixed" && liveRate > 0) {
          computedPrice = liveRate * (1 + pct / 100) + fixedAdd;
          formulaText = `${liveRate.toLocaleString("tr-TR", {maximumFractionDigits: 2})} × (1 + %${pct}/100) + ₺${fixedAdd} = ₺${computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (mode === "weight_rate" && liveRate > 0) {
          computedPrice = gram * liveRate;
          formulaText = `${gram} gr × ${liveRate.toLocaleString("tr-TR", {maximumFractionDigits: 2})} = ₺${computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (mode === "weight_rate_plus" && liveRate > 0) {
          computedPrice = gram * liveRate * (1 + pct / 100);
          formulaText = `${gram} gr × ${liveRate.toLocaleString("tr-TR", {maximumFractionDigits: 2})} × (1 + %${pct}/100) = ₺${computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (mode === "weight_rate_plus_fixed" && liveRate > 0) {
          computedPrice = gram * liveRate * (1 + pct / 100) + fixedAdd;
          formulaText = `${gram} gr × ${liveRate.toLocaleString("tr-TR", {maximumFractionDigits: 2})} × (1 + %${pct}/100) + ₺${fixedAdd} = ₺${computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (mode === "fixed") {
          computedPrice = r.finalPrice;
          formulaText = "Sabit fiyat (kur etkilemez)";
        }

        const prevPrice = r.previousFinalPrice;
        const priceDiff = prevPrice > 0 && r.finalPrice > 0 ? r.finalPrice - prevPrice : 0;
        const priceDiffPct = prevPrice > 0 ? (priceDiff / prevPrice) * 100 : 0;

        return (
        <div className={s.modalOverlay} onClick={() => setPriceModalRow(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>💰 Fiyat Detayları</h2>
              <button className={s.modalClose} onClick={() => setPriceModalRow(null)}>✕</button>
            </div>

            <div className={s.modalBody}>
              <div className={s.modalProductName}>{r.title}</div>
              <div className={s.modalId}>
                ID: <span className={s.mono}>{r.id}</span>
                {r.sku ? <> · SKU: <span className={s.mono}>{r.sku}</span></> : null}
              </div>

              {/* ── Fiyat Kartları ── */}
              <div className={s.modalGrid}>
                <div className={`${s.modalCard} ${s.modalCardHighlight}`}>
                  <div className={s.modalCardLabel}>📌 Mevcut Fiyat</div>
                  <div className={s.modalCardValue}>
                    {r.finalPrice > 0
                      ? `₺${r.finalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                  <div className={s.modalCardSub}>finalPrice (Firestore)</div>
                </div>

                <div className={s.modalCard}>
                  <div className={s.modalCardLabel}>⏮️ Önceki Fiyat</div>
                  <div className={s.modalCardValue}>
                    {prevPrice > 0
                      ? `₺${prevPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className={s.dim}>Henüz yok</span>}
                  </div>
                  {priceDiff !== 0 ? (
                    <div className={s.modalCardSub} style={{ color: priceDiff > 0 ? "#22c55e" : "#ef4444" }}>
                      {priceDiff > 0 ? "▲" : "▼"} {priceDiff > 0 ? "+" : ""}{`₺${priceDiff.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} ({priceDiffPct > 0 ? "+" : ""}{priceDiffPct.toFixed(1)}%)
                    </div>
                  ) : <div className={s.modalCardSub}>previousFinalPrice</div>}
                </div>

                <div className={s.modalCard}>
                  <div className={s.modalCardLabel}>🏷️ Baz Fiyat</div>
                  <div className={s.modalCardValue}>
                    {r.price > 0
                      ? `₺${r.price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                  <div className={s.modalCardSub}>price (ürün tanımı)</div>
                </div>

                <div className={s.modalCard}>
                  <div className={s.modalCardLabel}>💱 Para Birimi</div>
                  <div className={s.modalCardValue}>{r.finalCurrency}</div>
                </div>
              </div>

              {/* ── Canlı Kur Bilgisi ── */}
              <div className={s.modalSection}>📊 Canlı Kur Bilgisi</div>
              <div className={s.rateCard}>
                <div className={s.rateRow}>
                  <div className={s.rateItem}>
                    <div className={s.rateLabel}>Kur Anahtarı</div>
                    <div className={s.rateValue}><span className={s.mono}>{r.rateKey}</span></div>
                  </div>
                  <div className={s.rateItem}>
                    <div className={s.rateLabel}>Güncel Kur Değeri</div>
                    <div className={s.rateValue} style={{ color: liveRate > 0 ? "#22c55e" : "#ef4444" }}>
                      {liveRate > 0 ? `₺${liveRate.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Kur yok"}
                    </div>
                  </div>
                  <div className={s.rateItem}>
                    <div className={s.rateLabel}>Kur Çekilme Zamanı</div>
                    <div className={s.rateValue}>
                      {ratesFetchedAtMs > 0 ? new Date(ratesFetchedAtMs).toLocaleString("tr-TR") : "—"}
                    </div>
                  </div>
                </div>
                {ratesData?.provider ? (
                  <div className={s.rateProvider}>Kaynak: <b>{ratesData.provider}</b></div>
                ) : null}
              </div>

              {/* ── Formül Hesabı ── */}
              <div className={s.modalSection}>🧮 Fiyat Hesaplama Formülü</div>
              <div className={s.formulaCard}>
                <div className={s.formulaMode}>
                  <span className={s.modeBadge}>{mode}</span>
                  {r.priceOverrideEnabled ? <span className={s.overrideBadge}>OVERRIDE</span> : null}
                </div>
                {formulaText ? (
                  <div className={s.formulaText}>{formulaText}</div>
                ) : (
                  <div className={s.formulaText} style={{ color: "#94a3b8" }}>Hesaplama yapılamadı (kur yok veya mode bilinmiyor)</div>
                )}
                {computedPrice > 0 && Math.abs(computedPrice - r.finalPrice) > 0.01 ? (
                  <div className={s.formulaWarn}>
                    ⚠️ Hesaplanan fiyat (₺{computedPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}) kayıtlıdan (₺{r.finalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}) farklı — kur son güncellemeden beri değişmiş olabilir.
                  </div>
                ) : computedPrice > 0 ? (
                  <div className={s.formulaOk}>✅ Hesaplanan fiyat kayıtlı fiyatla eşleşiyor</div>
                ) : null}
              </div>

              {/* ── Fiyatlandırma Parametreleri ── */}
              <div className={s.modalSection}>⚙️ Fiyatlandırma Parametreleri</div>
              <table className={s.modalTable}>
                <tbody>
                  <tr>
                    <td className={s.modalTdLabel}>Gram</td>
                    <td>{r.gram > 0 ? <b>{r.gram} gr</b> : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Has Gram (hesapta kullanılan)</td>
                    <td>{r.hasGram > 0 ? <b style={{color:"#2563eb"}}>{r.hasGram} gr</b> : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Fiyat Yüzdesi</td>
                    <td>{r.pricePercent > 0 ? <b>%{r.pricePercent}</b> : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Sabit Ekleme</td>
                    <td>{r.priceFixedAdd > 0 ? <b>₺{r.priceFixedAdd.toLocaleString("tr-TR")}</b> : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Override</td>
                    <td>{r.priceOverrideEnabled ? <span style={{color:"#f59e0b"}}>✅ Evet — ₺{r.priceOverride.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span> : "Hayır"}</td>
                  </tr>
                </tbody>
              </table>

              {/* ── Kategori Fiyatlandırma ── */}
              <div className={s.modalSection}>📂 Kategori Fiyatlandırma</div>
              <table className={s.modalTable}>
                <tbody>
                  <tr>
                    <td className={s.modalTdLabel}>Durum</td>
                    <td>{r.categoryPricingEnabled ? <span style={{color:"#22c55e"}}>✅ Aktif</span> : <span style={{color:"#888"}}>Pasif</span>}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Kategori Yüzdesi</td>
                    <td>{r.categoryPricePercent > 0 ? `%${r.categoryPricePercent}` : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Kategori Sabit Ekleme</td>
                    <td>{r.categoryPriceFixedAdd > 0 ? `₺${r.categoryPriceFixedAdd.toLocaleString("tr-TR")}` : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>İndirim Yüzdesi</td>
                    <td>{r.compareAtPercent > 0 ? `%${r.compareAtPercent}` : "—"}</td>
                  </tr>
                </tbody>
              </table>

              {/* ── Zaman Bilgileri ── */}
              <div className={s.modalSection}>🕐 Zaman Bilgileri</div>
              <table className={s.modalTable}>
                <tbody>
                  <tr>
                    <td className={s.modalTdLabel}>Son Fiyat Güncelleme</td>
                    <td><b>{r.updatedAtMs ? new Date(r.updatedAtMs).toLocaleString("tr-TR") : "—"}</b></td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Son Kur Uygulanma</td>
                    <td>{r.lastPriceAppliedAtMs ? new Date(r.lastPriceAppliedAtMs).toLocaleString("tr-TR") : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Oluşturulma</td>
                    <td>{r.createdAtMs ? new Date(r.createdAtMs).toLocaleString("tr-TR") : "—"}</td>
                  </tr>
                  <tr>
                    <td className={s.modalTdLabel}>Son Kur Çekilme</td>
                    <td>{ratesFetchedAtMs > 0 ? new Date(ratesFetchedAtMs).toLocaleString("tr-TR") : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })() : null}
    </main>
  );
}
export default function StockAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="products">
        <StockAdminPageInner />
      </PermissionGate>
    </AdminGate>
  );
}