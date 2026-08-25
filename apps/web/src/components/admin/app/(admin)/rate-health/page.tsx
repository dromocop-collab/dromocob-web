"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./rateHealth.module.css";

/* ── Helpers ── */
function toNum(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null) return 0;
  let str = String(v).trim().replace(/\s/g, "");
  if (str.includes(".") && str.includes(",")) str = str.replace(/\./g, "").replace(",", ".");
  else if (str.includes(",")) str = str.replace(",", ".");
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

function fmtTRY(n: number): string {
  if (n <= 0) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  if (typeof v === "number") return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function fmtDate(v: any): string {
  const ms = toMs(v);
  if (ms <= 0) return "—";
  return new Date(ms).toLocaleString("tr-TR");
}

function timeAgo(v: any): string {
  const ms = toMs(v);
  if (ms <= 0) return "";
  const diff = Date.now() - ms;
  if (diff < 60000) return "az önce";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
  return `${Math.floor(diff / 86400000)} gün önce`;
}

type RateInfo = {
  code: string;
  sell: number;
  buy: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  priceMode: string;
  finalPrice: number;
  previousFinalPrice: number;
  lastPriceAppliedAt: any;
  hasGram: number;
  gram: number;
  isActive: boolean;
  pricePercent: number;
  priceFixedAdd: number;
  updatedAt: any;
  categoryPricingEnabled: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  pricingEnabled: boolean;
  refreshMode: string;
  pricePercent: number;
  priceFixedAdd: number;
  productCount: number;
};

function extractRates(items: any): RateInfo[] {
  if (!items) return [];
  const result: RateInfo[] = [];
  const keys = ["GRAM_ALTIN", "HAS_ALTIN", "CEYREK_ALTIN", "YARIM_ALTIN", "TAM_ALTIN"];

  for (const code of keys) {
    let node: any = null;
    if (typeof items === "object" && !Array.isArray(items)) {
      node = items[code] ?? items[code.toLowerCase()] ?? items[code.replace(/_/g, "")];
    } else if (Array.isArray(items)) {
      node = items.find((x: any) => String(x?.code || "").toUpperCase().replace(/\s+/g, "_") === code);
    }
    if (node) {
      result.push({
        code,
        sell: toNum(node?.sell ?? node?.Sell ?? node?.satis ?? node?.value ?? 0),
        buy: toNum(node?.buy ?? node?.Buy ?? node?.alis ?? 0),
      });
    }
  }
  return result;
}

/* ── Main Component ── */
function RateHealthInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [rates, setRates] = useState<RateInfo[]>([]);
  const [fetchedAt, setFetchedAt] = useState<any>(null);
  const [provider, setProvider] = useState("");
  const [rateLoading, setRateLoading] = useState(true);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [prodLoading, setProdLoading] = useState(true);

  const [categories, setCategories] = useState<CategoryRow[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "updated" | "not_updated" | "no_price" | "pricing_off">("all");

  // ── Realtime rates ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rates", "latest"), (snap) => {
      if (!snap.exists()) { setRateLoading(false); return; }
      const data = snap.data() as any;
      setRates(extractRates(data?.items));
      setFetchedAt(data?.fetchedAt);
      setProvider(String(data?.provider || ""));
      setRateLoading(false);
    });
    return () => unsub();
  }, [db]);

  // ── Load products + categories ──
  const loadProducts = useCallback(async () => {
    setProdLoading(true);
    try {
      const [prodSnap, catSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "categories")),
      ]);

      // Categories
      const catRows: CategoryRow[] = catSnap.docs.map((d) => {
        const c = d.data() as any;
        const pricing = c?.pricing || {};
        return {
          id: d.id,
          name: String(c.name?.tr || c.name || c.title?.tr || c.title || "").trim(),
          slug: String(c.slug || "").trim(),
          pricingEnabled: !!pricing?.enabled,
          refreshMode: String(pricing?.refreshMode || "manual").trim(),
          pricePercent: toNum(pricing?.pricePercent || 0),
          priceFixedAdd: toNum(pricing?.priceFixedAdd || 0),
          productCount: 0,
        };
      });

      // Products
      const rows: ProductRow[] = prodSnap.docs.map((d) => {
        const p = d.data() as any;
        const catId = String(p.categoryId || "").trim();
        const catIds: string[] = Array.isArray(p.categoryIds) ? p.categoryIds.map(String) : [];
        const catSlugs: string[] = Array.isArray(p.categorySlugs)
          ? p.categorySlugs.map((v: any) => String(v || "").trim().toLowerCase())
          : [];
        const singleSlug = String(p.categorySlug || "").trim().toLowerCase();

        // Find ALL matching categories (not just first)
        const matchedCats = catRows.filter((c) =>
          c.id === catId ||
          catIds.includes(c.id) ||
          (c.slug && catSlugs.includes(c.slug)) ||
          (c.slug && singleSlug === c.slug)
        );

        // Count products per category (count in ALL matching)
        for (const mc of matchedCats) mc.productCount++;

        // categoryPricingEnabled = true if ANY matched category has pricing on
        const hasPricingOn = matchedCats.some((c) => c.pricingEnabled);

        return {
          id: d.id,
          name: String(p.name?.tr || p.name?.en || p.title?.tr || p.title || "").trim(),
          slug: String(p.slug || "").trim(),
          categoryName: String(p.categoryName?.tr || p.categoryName || p.category || "").trim(),
          priceMode: String(p.priceMode || "fixed").trim(),
          finalPrice: toNum(p.finalPrice),
          previousFinalPrice: toNum(p.previousFinalPrice),
          lastPriceAppliedAt: p.lastPriceAppliedAt || null,
          hasGram: toNum(p.hasGram || p.weightGram || p.gram || 0),
          gram: toNum(p.gram || 0),
          isActive: p.isActive !== false,
          pricePercent: toNum(p.pricePercent || p.categoryPricePercent || 0),
          priceFixedAdd: toNum(p.priceFixedAdd || p.categoryPriceFixedAdd || 0),
          updatedAt: p.updatedAt || null,
          categoryPricingEnabled: hasPricingOn,
        };
      });
      setProducts(rows);
      setCategories(catRows);
    } catch (err) {
      console.error("loadProducts error:", err);
    } finally {
      setProdLoading(false);
    }
  }, [db]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const withPrice = products.filter((p) => p.finalPrice > 0).length;
    const noPrice = products.filter((p) => p.finalPrice <= 0).length;
    const updated = products.filter((p) => p.lastPriceAppliedAt).length;
    const notUpdated = products.filter((p) => !p.lastPriceAppliedAt).length;
    const priceChanged = products.filter((p) => p.previousFinalPrice > 0 && p.finalPrice !== p.previousFinalPrice).length;
    const rateDependent = products.filter((p) => p.priceMode && p.priceMode !== "fixed").length;
    const fixed = products.filter((p) => p.priceMode === "fixed").length;

    return { total, active, withPrice, noPrice, updated, notUpdated, priceChanged, rateDependent, fixed };
  }, [products]);

  // ── Filter ──
  const filtered = useMemo(() => {
    let list = [...products];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }

    if (filterStatus === "updated") list = list.filter((p) => p.lastPriceAppliedAt);
    else if (filterStatus === "not_updated") list = list.filter((p) => !p.lastPriceAppliedAt);
    else if (filterStatus === "no_price") list = list.filter((p) => p.finalPrice <= 0);
    else if (filterStatus === "pricing_off") list = list.filter((p) => !p.categoryPricingEnabled);

    return list.sort((a, b) => {
      const aT = a.lastPriceAppliedAt?.seconds || 0;
      const bT = b.lastPriceAppliedAt?.seconds || 0;
      return bT - aT;
    });
  }, [products, search, filterStatus]);

  // ── Rate Health Status ──
  const rateStatus = useMemo(() => {
    if (rateLoading) return { color: "gray", text: "Yükleniyor..." };
    if (!rates.length) return { color: "red", text: "❌ Kur verisi bulunamadı!" };

    const ms = toMs(fetchedAt);
    if (ms <= 0) return { color: "red", text: "❌ Kur çekim zamanı bilinmiyor" };

    const diff = Date.now() - ms;
    if (diff < 300000) return { color: "green", text: "✅ Kurlar güncel (5 dk içinde)" };
    if (diff < 3600000) return { color: "yellow", text: "⚠️ Kurlar biraz eski (" + timeAgo(fetchedAt) + ")" };
    return { color: "red", text: "❌ Kurlar çok eski (" + timeAgo(fetchedAt) + ")" };
  }, [rates, fetchedAt, rateLoading]);

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.head}>
        <div>
          <div className={s.kicker}>📊 Kur & Fiyat Sağlık Paneli</div>
          <h1 className={s.title}>Kur → Ürün Fiyat Bağlantısı</h1>
          <p className={s.desc}>Kurlar doğru çekildi mi, ürün fiyatları güncellendi mi? Hepsi burada.</p>
        </div>
        <button className={s.refreshBtn} type="button" onClick={loadProducts} disabled={prodLoading}>
          {prodLoading ? "⏳ Yükleniyor..." : "🔄 Yenile"}
        </button>
      </div>

      {/* Rate Status Banner */}
      <div className={`${s.statusBanner} ${s["status_" + rateStatus.color]}`}>
        <div className={s.statusLeft}>
          <div className={s.statusDot} />
          <div>
            <div className={s.statusText}>{rateStatus.text}</div>
            <div className={s.statusMeta}>
              {provider && <>Kaynak: <b>{provider}</b> · </>}
              Son çekim: <b>{fmtDate(fetchedAt)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Live Rates */}
      {rates.length > 0 && (
        <div className={s.rateGrid}>
          {rates.map((r) => (
            <div key={r.code} className={s.rateCard}>
              <div className={s.rateLabel}>{r.code.replace(/_/g, " ")}</div>
              <div className={s.rateSell}>₺{fmtTRY(r.sell).replace("₺", "")}</div>
              {r.buy > 0 && <div className={s.rateBuy}>Alış: ₺{fmtTRY(r.buy).replace("₺", "")}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Category Pricing Status */}
      {categories.length > 0 && (
        <div className={s.catSection}>
          <div className={s.catTitle}>📂 Kategori Pricing Durumu</div>
          <div className={s.catDesc}>
            Kur değişince sadece <b>Pricing Açık</b> olan kategorilerdeki ürünler güncellenir.
            Kapalı olanlar eski fiyatta kalır.
          </div>
          <div className={s.catGrid}>
            {categories
              .sort((a, b) => (a.pricingEnabled === b.pricingEnabled ? 0 : a.pricingEnabled ? -1 : 1))
              .map((c) => (
                <div key={c.id} className={`${s.catCard} ${c.pricingEnabled ? s.catOn : s.catOff}`}>
                  <div className={s.catCardHead}>
                    <span className={s.catBadge}>{c.pricingEnabled ? "✅ Açık" : "⛔ Kapalı"}</span>
                    <span className={s.catMode}>{c.refreshMode === "auto" ? "⏱ Oto" : "✋ Manuel"}</span>
                  </div>
                  <div className={s.catName}>{c.name || c.slug || c.id}</div>
                  <div className={s.catMeta}>
                    {c.productCount} ürün · %{c.pricePercent} · +₺{c.priceFixedAdd}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className={s.statsGrid}>
        <div className={s.statCard}>
          <div className={s.statIcon}>📦</div>
          <div className={s.statNum}>{stats.total}</div>
          <div className={s.statLabel}>Toplam Ürün</div>
        </div>
        <div className={`${s.statCard} ${s.statGreen}`}>
          <div className={s.statIcon}>✅</div>
          <div className={s.statNum}>{stats.updated}</div>
          <div className={s.statLabel}>Fiyat Güncellenen</div>
        </div>
        <div className={`${s.statCard} ${s.statRed}`}>
          <div className={s.statIcon}>⛔</div>
          <div className={s.statNum}>{stats.notUpdated}</div>
          <div className={s.statLabel}>Henüz Güncellenmemiş</div>
        </div>
        <div className={`${s.statCard} ${s.statAmber}`}>
          <div className={s.statIcon}>🔄</div>
          <div className={s.statNum}>{stats.priceChanged}</div>
          <div className={s.statLabel}>Fiyatı Değişen</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statIcon}>📈</div>
          <div className={s.statNum}>{stats.rateDependent}</div>
          <div className={s.statLabel}>Kura Bağlı</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statIcon}>📌</div>
          <div className={s.statNum}>{stats.fixed}</div>
          <div className={s.statLabel}>Sabit Fiyat</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statIcon}>💰</div>
          <div className={s.statNum}>{stats.withPrice}</div>
          <div className={s.statLabel}>Fiyatlı</div>
        </div>
        <div className={`${s.statCard} ${s.statRed}`}>
          <div className={s.statIcon}>🚫</div>
          <div className={s.statNum}>{stats.noPrice}</div>
          <div className={s.statLabel}>Fiyatsız</div>
        </div>
      </div>

      {/* Filters */}
      <div className={s.toolbar}>
        <input
          className={s.search}
          type="text"
          placeholder="Ürün ara... (isim, slug, kategori)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={s.filterRow}>
          {([
            ["all", "Tümü"],
            ["updated", "Güncellenen"],
            ["not_updated", "Güncellenmemiş"],
            ["no_price", "Fiyatsız"],
            ["pricing_off", "Pricing Kapalı"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`${s.filterBtn} ${filterStatus === key ? s.filterActive : ""}`}
              onClick={() => setFilterStatus(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className={s.resultCount}>{filtered.length} ürün gösteriliyor</div>

      {/* Product Table */}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Mod</th>
              <th>Has Gram</th>
              <th>Önceki Fiyat</th>
              <th>Güncel Fiyat</th>
              <th>Fark</th>
              <th>Son Güncelleme</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p, i) => {
              const diff = p.finalPrice - p.previousFinalPrice;
              const hasPrev = p.previousFinalPrice > 0;
              const wasUpdated = !!p.lastPriceAppliedAt;

              return (
                <tr key={p.id} className={!p.isActive ? s.rowInactive : ""}>
                  <td className={s.tdNum}>{i + 1}</td>
                  <td>
                    <div className={s.prodName}>{p.name || p.slug || p.id}</div>
                    <div className={s.prodSlug}>{p.slug}</div>
                  </td>
                  <td className={s.tdMeta}>{p.categoryName || "—"}</td>
                  <td>
                    <span className={`${s.modeBadge} ${p.priceMode === "fixed" ? s.modeFixed : s.modeRate}`}>
                      {p.priceMode === "fixed" ? "Sabit" : p.priceMode}
                    </span>
                  </td>
                  <td className={s.tdNum}>{p.hasGram > 0 ? `${p.hasGram} gr` : "—"}</td>
                  <td className={s.tdPrice}>{hasPrev ? fmtTRY(p.previousFinalPrice) : "—"}</td>
                  <td className={s.tdPrice}>
                    <b>{p.finalPrice > 0 ? fmtTRY(p.finalPrice) : "—"}</b>
                  </td>
                  <td>
                    {hasPrev && p.finalPrice > 0 ? (
                      <span className={diff > 0 ? s.diffUp : diff < 0 ? s.diffDown : s.diffSame}>
                        {diff > 0 ? "+" : ""}{fmtTRY(Math.abs(diff)).replace("₺", "")}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={s.tdMeta}>
                    {wasUpdated ? (
                      <>
                        <div>{fmtDate(p.lastPriceAppliedAt)}</div>
                        <div className={s.timeAgo}>{timeAgo(p.lastPriceAppliedAt)}</div>
                      </>
                    ) : "—"}
                  </td>
                  <td>
                    {wasUpdated ? (
                      <span className={s.statusOk}>✅</span>
                    ) : (
                      <span className={s.statusFail}>⛔</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 200 && (
        <div className={s.resultCount}>İlk 200 ürün gösteriliyor (toplam {filtered.length})</div>
      )}
    </div>
  );
}

export default function RateHealthPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <RateHealthInner />
      </PermissionGate>
    </AdminGate>
  );
}
