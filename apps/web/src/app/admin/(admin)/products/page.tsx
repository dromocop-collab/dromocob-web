"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listDocs, patchDoc } from "@/lib/adminApi";
import s from "./productsAdmin.module.css";

type ProductRow = any;

type FilterKey =
  | "all"
  | "active"
  | "passive"
  | "low"
  | "no_price"
  | "no_image"
  | "dynamic"
  | "healthy";

type SortKey =
  | "updated_desc"
  | "title_asc"
  | "price_desc"
  | "price_asc"
  | "stock_asc"
  | "stock_desc"
  | "health_asc";

type ViewMode = "table" | "grid";

function money(n: any) {
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function fmtMoney(amount: number | null, currency?: string) {
  if (amount == null) return "-";

  const cur = String(currency || "TRY").toUpperCase();

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

function safeStr(v: any) {
  const x = String(v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : "";
}

function pickTitle(r: any) {
  return (
    safeStr(r?.title?.tr) ||
    safeStr(r?.title?.en) ||
    safeStr(r?.title) ||
    safeStr(r?.name?.tr) ||
    safeStr(r?.name?.en) ||
    safeStr(r?.name) ||
    safeStr(r?.slug) ||
    "-"
  );
}

function pickImage(r: any) {
  const img =
    (Array.isArray(r?.images) && r.images[0]) ||
    r?.mainImage ||
    r?.image ||
    r?.thumbnail ||
    r?.cover ||
    null;

  return typeof img === "string" && img.trim() ? img.trim() : null;
}

function pickPrice(r: any) {
  const finalPrice =
    money(r?.finalPrice) ??
    money(r?.computedPrice) ??
    money(r?.priceFinal) ??
    money(r?.priceTry) ??
    money(r?.price);

  const currency =
    r?.currency ||
    r?.priceCurrency ||
    r?.finalCurrency ||
    r?.priceEngine?.currency ||
    "TRY";

  return { finalPrice, currency };
}

function pickRawPrice(r: any) {
  return money(r?.price) ?? money(r?.priceTry);
}

function pickStock(r: any) {
  const stock = money(r?.stock);
  return stock == null ? null : Math.max(0, stock);
}

function pickStockAlarm(r: any) {
  const alarm = money(r?.stockAlarm ?? r?.lowStockAlert ?? r?.minStock);
  return alarm == null ? 0 : Math.max(0, alarm);
}

function isActiveRow(r: any) {
  if (typeof r?.isActive === "boolean") return r.isActive;
  if (typeof r?.active === "boolean") return r.active;
  return true;
}

function isDynamicRow(r: any) {
  const pricing = r?.pricing || {};
  const dynamicPricing = r?.dynamicPricing;

  return (
    dynamicPricing === true ||
    r?.priceMode === "dynamic" ||
    r?.pricingMode === "dynamic" ||
    pricing?.enabled === true ||
    pricing?.dynamic === true ||
    pricing?.mode === "dynamic" ||
    pricing?.model === "gram" ||
    Boolean(r?.rateKey || r?.priceRateCode || pricing?.rateKey)
  );
}

function pickRateKey(r: any) {
  const pricing = r?.pricing || {};
  return safeStr(r?.rateKey || r?.priceRateCode || pricing?.rateKey || pricing?.rateCode);
}

function pickGram(r: any) {
  const pricing = r?.pricing || {};
  return money(r?.weightGram ?? r?.gram ?? r?.weightGr ?? pricing?.weightGram ?? pricing?.gram);
}

function shortId(v: any) {
  const x = String(v || "").trim();
  if (!x) return "-";
  if (x.length <= 14) return x;
  return `${x.slice(0, 7)}...${x.slice(-5)}`;
}

function getUpdatedMs(r: any) {
  const v = r?.updatedAt || r?.createdAt || r?.createdAtIso || r?.updatedAtIso;

  try {
    if (v?.toMillis) return Number(v.toMillis());
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    if (typeof v === "string") return Date.parse(v) || 0;
    return 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: any) {
  const ms = getUpdatedMs({ updatedAt: v });
  if (!ms) return "-";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(ms);
  } catch {
    return "-";
  }
}

function getHealth(r: any) {
  const img = pickImage(r);
  const { finalPrice } = pickPrice(r);
  const stock = pickStock(r);
  const active = isActiveRow(r);
  const title = pickTitle(r);
  const sku = safeStr(r?.sku);
  const slug = safeStr(r?.slug);

  const issues: string[] = [];

  if (!active) issues.push("Pasif");
  if (!img) issues.push("Görsel yok");
  if (finalPrice == null || finalPrice <= 0) issues.push("Fiyat yok");
  if (stock == null) issues.push("Stok yok");
  if (!title || title === "-") issues.push("Başlık yok");
  if (!sku) issues.push("SKU yok");
  if (!slug) issues.push("Slug yok");

  let score = 100;
  score -= issues.includes("Pasif") ? 12 : 0;
  score -= issues.includes("Görsel yok") ? 22 : 0;
  score -= issues.includes("Fiyat yok") ? 26 : 0;
  score -= issues.includes("Stok yok") ? 14 : 0;
  score -= issues.includes("Başlık yok") ? 14 : 0;
  score -= issues.includes("SKU yok") ? 6 : 0;
  score -= issues.includes("Slug yok") ? 6 : 0;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    ok: score >= 82 && issues.length === 0,
  };
}

function healthTone(score: number) {
  if (score >= 85) return "ok";
  if (score >= 60) return "warn";
  return "bad";
}

async function copyText(text: string) {
  try {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  } catch {
    //
  }
}

function productHref(id: any) {
  return `/admin/products/${encodeURIComponent(String(id))}`;
}

export default function AdminProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [view, setView] = useState<ViewMode>("table");
  const [copyMsg, setCopyMsg] = useState("");
  const [statusBusy, setStatusBusy] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const data = await listDocs("products", 1000);

        if (!alive) return;

        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("products listDocs error:", err);

        if (!alive) return;

        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  function notifyCopy(label: string) {
    setCopyMsg(`${label} kopyalandı`);
    window.clearTimeout((notifyCopy as any)._t);
    (notifyCopy as any)._t = window.setTimeout(() => setCopyMsg(""), 1400);
  }
  async function changeProductStatus(id: string, nextActive: boolean) {
    const productId = String(id || "").trim();

    if (!productId || statusBusy[productId]) return;

    const previousRows = rows;

    // UI anında tepki versin
    setRows((current) =>
      current.map((item) =>
        String(item.id) === productId
          ? {
            ...item,
            isActive: nextActive,
            active: nextActive,
          }
          : item
      )
    );

    setStatusBusy((current) => ({
      ...current,
      [productId]: true,
    }));

    try {
      await patchDoc("products", productId, {
        isActive: nextActive,
        active: nextActive,
      });

      setCopyMsg(nextActive ? "Ürün aktif yapıldı" : "Ürün pasif yapıldı");

      window.setTimeout(() => {
        setCopyMsg("");
      }, 1600);
    } catch (error) {
      console.error("Ürün durum güncelleme hatası:", error);

      // Firestore başarısızsa eski haline dön
      setRows(previousRows);

      setCopyMsg("Durum değiştirilemedi");

      window.setTimeout(() => {
        setCopyMsg("");
      }, 2200);
    } finally {
      setStatusBusy((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
    }
  }
  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => isActiveRow(r)).length;
    const passive = rows.filter((r) => !isActiveRow(r)).length;

    const lowStock = rows.filter((r) => {
      const stock = pickStock(r);
      const alarm = pickStockAlarm(r);
      return stock != null && stock <= alarm;
    }).length;

    const noPrice = rows.filter((r) => {
      const p = pickPrice(r).finalPrice;
      return p == null || p <= 0;
    }).length;

    const noImage = rows.filter((r) => !pickImage(r)).length;
    const dynamic = rows.filter((r) => isDynamicRow(r)).length;
    const healthy = rows.filter((r) => getHealth(r).ok).length;

    const inventoryValue = rows.reduce((sum, r) => {
      const { finalPrice } = pickPrice(r);
      const stock = pickStock(r);
      if (finalPrice == null || stock == null) return sum;
      return sum + finalPrice * stock;
    }, 0);

    return {
      total,
      active,
      passive,
      lowStock,
      noPrice,
      noImage,
      dynamic,
      healthy,
      inventoryValue,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    let out = rows.filter((r) => {
      if (!text) return true;

      const hay = [
        r?.id,
        pickTitle(r),
        r?.sku,
        r?.slug,
        r?.barcode,
        r?.category,
        ...(Array.isArray(r?.categorySlugs) ? r.categorySlugs : []),
        ...(Array.isArray(r?.categoryIds) ? r.categoryIds : []),
        pickRateKey(r),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(text);
    });

    out = out.filter((r) => {
      const active = isActiveRow(r);
      const stock = pickStock(r);
      const alarm = pickStockAlarm(r);
      const low = stock != null && stock <= alarm;
      const noPrice = (pickPrice(r).finalPrice ?? 0) <= 0;
      const noImage = !pickImage(r);
      const dynamic = isDynamicRow(r);
      const healthy = getHealth(r).ok;

      if (filter === "active") return active;
      if (filter === "passive") return !active;
      if (filter === "low") return low;
      if (filter === "no_price") return noPrice;
      if (filter === "no_image") return noImage;
      if (filter === "dynamic") return dynamic;
      if (filter === "healthy") return healthy;
      return true;
    });

    out = [...out].sort((a, b) => {
      if (sort === "title_asc") {
        return String(pickTitle(a)).localeCompare(String(pickTitle(b)), "tr");
      }

      if (sort === "price_desc") {
        return (pickPrice(b).finalPrice ?? -1) - (pickPrice(a).finalPrice ?? -1);
      }

      if (sort === "price_asc") {
        return (pickPrice(a).finalPrice ?? 999999999) - (pickPrice(b).finalPrice ?? 999999999);
      }

      if (sort === "stock_desc") {
        return (pickStock(b) ?? -1) - (pickStock(a) ?? -1);
      }

      if (sort === "stock_asc") {
        return (pickStock(a) ?? 999999999) - (pickStock(b) ?? 999999999);
      }

      if (sort === "health_asc") {
        return getHealth(a).score - getHealth(b).score;
      }

      return getUpdatedMs(b) - getUpdatedMs(a);
    });

    return out;
  }, [rows, q, filter, sort]);

  return (
    <main className={s.page}>
      {copyMsg ? <div className={s.toast}>{copyMsg}</div> : null}

      <section className={s.hero}>
        <div className={s.heroGlow} />

        <div className={s.heroLeft}>
          <div className={s.kicker}>ADMIN • KATALOG OPERASYON MERKEZİ</div>
          <h1 className={s.title}>Ürün Yönetimi</h1>
          <p className={s.sub}>
            Ürünleri, fiyatları, stok sağlığını, dinamik kur bilgisini ve vitrin
            durumunu tek ekrandan kontrol et. Dağınık katalog yok; net operasyon var.
          </p>

          <div className={s.heroBadges}>
            <span>Canlı katalog kontrolü</span>
            <span>Stok & fiyat alarmı</span>
            <span>VIP yönetim görünümü</span>
          </div>
        </div>

        <div className={s.heroRight}>
          <div className={s.heroMetric}>
            <span>Toplam Envanter Değeri</span>
            <b>{fmtMoney(stats.inventoryValue, "TRY")}</b>
          </div>

          <Link href="/admin/products/new" className={s.primaryBtn}>
            <span>+</span>
            Yeni Ürün
          </Link>
        </div>
      </section>

      <section className={s.statsGrid}>
        <button type="button" className={s.statCard} onClick={() => setFilter("all")}>
          <span className={s.statLabel}>Toplam Ürün</span>
          <b className={s.statValue}>{stats.total}</b>
          <small>Tüm katalog</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statOk}`} onClick={() => setFilter("active")}>
          <span className={s.statLabel}>Aktif</span>
          <b className={s.statValue}>{stats.active}</b>
          <small>Vitrinde açık</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statMuted}`} onClick={() => setFilter("passive")}>
          <span className={s.statLabel}>Pasif</span>
          <b className={s.statValue}>{stats.passive}</b>
          <small>Satış dışı</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statWarn}`} onClick={() => setFilter("low")}>
          <span className={s.statLabel}>Düşük Stok</span>
          <b className={s.statValue}>{stats.lowStock}</b>
          <small>Kontrol edilmeli</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statDanger}`} onClick={() => setFilter("no_price")}>
          <span className={s.statLabel}>Fiyat Eksik</span>
          <b className={s.statValue}>{stats.noPrice}</b>
          <small>Satış riski</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statImage}`} onClick={() => setFilter("no_image")}>
          <span className={s.statLabel}>Görsel Eksik</span>
          <b className={s.statValue}>{stats.noImage}</b>
          <small>Katalog kalitesi</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statDynamic}`} onClick={() => setFilter("dynamic")}>
          <span className={s.statLabel}>Dinamik</span>
          <b className={s.statValue}>{stats.dynamic}</b>
          <small>Kur bağlantılı</small>
        </button>

        <button type="button" className={`${s.statCard} ${s.statHealthy}`} onClick={() => setFilter("healthy")}>
          <span className={s.statLabel}>Sağlıklı</span>
          <b className={s.statValue}>{stats.healthy}</b>
          <small>Tam kayıt</small>
        </button>
      </section>

      <section className={s.toolbar}>
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>⌕</span>
          <input
            className={s.search}
            placeholder="Ara: id / başlık / sku / slug / kategori / kur anahtarı…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className={s.toolbarControls}>
          <select
            className={s.select}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="updated_desc">Son güncellenen</option>
            <option value="title_asc">Başlık A-Z</option>
            <option value="price_desc">Fiyat yüksekten</option>
            <option value="price_asc">Fiyat düşükten</option>
            <option value="stock_desc">Stok yüksekten</option>
            <option value="stock_asc">Stok düşükten</option>
            <option value="health_asc">Sağlık sorunu önce</option>
          </select>

          <div className={s.viewToggle}>
            <button
              type="button"
              className={view === "table" ? s.viewOn : ""}
              onClick={() => setView("table")}
            >
              Tablo
            </button>

            <button
              type="button"
              className={view === "grid" ? s.viewOn : ""}
              onClick={() => setView("grid")}
            >
              Kart
            </button>
          </div>
        </div>

        <div className={s.segmented}>
          {[
            ["all", "Tümü"],
            ["active", "Aktif"],
            ["passive", "Pasif"],
            ["low", "Düşük Stok"],
            ["no_price", "Fiyat Eksik"],
            ["no_image", "Görsel Eksik"],
            ["dynamic", "Dinamik"],
            ["healthy", "Sağlıklı"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${s.segBtn} ${filter === key ? s.segBtnActive : ""}`}
              onClick={() => setFilter(key as FilterKey)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={s.resultHead}>
        <div>
          <strong>{filtered.length}</strong>
          <span> ürün gösteriliyor</span>
        </div>

        <button
          type="button"
          className={s.clearBtn}
          onClick={() => {
            setQ("");
            setFilter("all");
            setSort("updated_desc");
          }}
        >
          Filtreleri Temizle
        </button>
      </section>

      <section className={s.contentCard}>
        {loading ? (
          <div className={s.loadingState}>
            <div className={s.loader} />
            <strong>Ürünler yükleniyor…</strong>
            <span>Katalog taranıyor, birazdan operasyon masası hazır.</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>⌕</div>
            <div className={s.emptyTitle}>Ürün bulunamadı</div>
            <div className={s.emptySub}>Arama veya filtreleri değiştir kanka.</div>
          </div>
        ) : view === "table" ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.thImage}></th>
                  <th>Ürün</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Kur</th>
                  <th>Sağlık</th>
                  <th>Durum</th>
                  <th>Güncelleme</th>
                  <th className={s.thRight}>İşlem</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const img = pickImage(r);
                  const title = pickTitle(r);
                  const { finalPrice, currency } = pickPrice(r);
                  const rawPrice = pickRawPrice(r);
                  const stock = pickStock(r);
                  const stockAlarm = pickStockAlarm(r);
                  const active = isActiveRow(r);
                  const lowStock = stock != null ? stock <= stockAlarm : false;
                  const dynamic = isDynamicRow(r);
                  const health = getHealth(r);
                  const tone = healthTone(health.score);
                  const rateKey = pickRateKey(r);
                  const gram = pickGram(r);

                  return (
                    <tr key={String(r.id)} className={s.row}>
                      <td className={s.tdImage}>
                        <Link href={productHref(r.id)} className={s.thumbWrap}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={String(title)} className={s.thumb} loading="lazy" />
                          ) : (
                            <div className={s.thumbPh}>ÜRÜN</div>
                          )}
                        </Link>
                      </td>

                      <td>
                        <div className={s.productBlock}>
                          <Link href={productHref(r.id)} className={s.productTitle}>
                            {title}
                          </Link>

                          <div className={s.metaRow}>
                            <button
                              type="button"
                              className={s.codePill}
                              onClick={() => {
                                copyText(String(r.id || ""));
                                notifyCopy("Ürün ID");
                              }}
                            >
                              ID: {shortId(r.id)}
                            </button>

                            {r?.sku ? (
                              <button
                                type="button"
                                className={s.metaItemBtn}
                                onClick={() => {
                                  copyText(String(r.sku || ""));
                                  notifyCopy("SKU");
                                }}
                              >
                                SKU: <b>{r.sku}</b>
                              </button>
                            ) : null}

                            {r?.slug ? (
                              <button
                                type="button"
                                className={s.metaItemBtn}
                                onClick={() => {
                                  copyText(String(r.slug || ""));
                                  notifyCopy("Slug");
                                }}
                              >
                                Slug: <b>{r.slug}</b>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={s.priceBlock}>
                          <div className={s.priceMain}>{fmtMoney(finalPrice, currency)}</div>
                          {rawPrice != null && rawPrice !== finalPrice ? (
                            <div className={s.priceSub}>Ham: {fmtMoney(rawPrice, currency)}</div>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        {stock == null ? (
                          <span className={`${s.chip} ${s.chipMuted}`}>Stok yok</span>
                        ) : lowStock ? (
                          <span className={`${s.chip} ${s.chipWarn}`}>{stock} adet • düşük</span>
                        ) : (
                          <span className={`${s.chip} ${s.chipNeutral}`}>{stock} adet</span>
                        )}
                      </td>

                      <td>
                        {dynamic ? (
                          <div className={s.rateBox}>
                            <span className={`${s.chip} ${s.chipDynamic}`}>Dinamik</span>
                            {rateKey ? <small>{rateKey}</small> : null}
                            {gram != null ? <small>{gram} gr</small> : null}
                          </div>
                        ) : (
                          <span className={`${s.chip} ${s.chipMuted}`}>Sabit</span>
                        )}
                      </td>

                      <td>
                        <div className={s.healthWrap}>
                          <span
                            className={`${s.healthDot} ${tone === "ok"
                              ? s.healthOk
                              : tone === "warn"
                                ? s.healthWarn
                                : s.healthBad
                              }`}
                          />
                          <div>
                            <b>{health.score}</b>
                            <small>
                              {health.issues.length
                                ? health.issues.slice(0, 2).join(", ")
                                : "Temiz"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`${s.statusSwitch} ${active ? s.statusSwitchActive : s.statusSwitchPassive
                            }`}
                          disabled={Boolean(statusBusy[String(r.id)])}
                          onClick={() =>
                            changeProductStatus(String(r.id), !active)
                          }
                          title={
                            active
                              ? "Ürünü pasif yap"
                              : "Ürünü aktif yap"
                          }
                        >
                          <span className={s.statusSwitchTrack}>
                            <span className={s.statusSwitchKnob} />
                          </span>

                          <span className={s.statusSwitchText}>
                            {statusBusy[String(r.id)]
                              ? "Kaydediliyor..."
                              : active
                                ? "Aktif"
                                : "Pasif"}
                          </span>
                        </button>
                      </td>

                      <td>
                        <span className={s.dateText}>{fmtDate(r?.updatedAt || r?.createdAt)}</span>
                      </td>

                      <td className={s.tdRight}>
                        <Link href={productHref(r.id)} className={s.actionBtn}>
                          Düzenle →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.gridList}>
            {filtered.map((r) => {
              const img = pickImage(r);
              const title = pickTitle(r);
              const { finalPrice, currency } = pickPrice(r);
              const stock = pickStock(r);
              const alarm = pickStockAlarm(r);
              const active = isActiveRow(r);
              const lowStock = stock != null ? stock <= alarm : false;
              const dynamic = isDynamicRow(r);
              const health = getHealth(r);
              const tone = healthTone(health.score);
              const rateKey = pickRateKey(r);
              const gram = pickGram(r);

              return (
                <article key={String(r.id)} className={s.productCard}>
                  <Link href={productHref(r.id)} className={s.cardMedia}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={String(title)} loading="lazy" />
                    ) : (
                      <div className={s.cardMediaPh}>Görsel Yok</div>
                    )}


                  </Link>

                  <div className={s.cardBody}>
                    <Link href={productHref(r.id)} className={s.cardTitle}>
                      {title}
                    </Link>

                    <div className={s.cardMeta}>
                      <button
                        type="button"
                        onClick={() => {
                          copyText(String(r.id || ""));
                          notifyCopy("Ürün ID");
                        }}
                      >
                        {shortId(r.id)}
                      </button>

                      {r?.sku ? (
                        <button
                          type="button"
                          onClick={() => {
                            copyText(String(r.sku || ""));
                            notifyCopy("SKU");
                          }}
                        >
                          SKU: {r.sku}
                        </button>
                      ) : null}
                    </div>

                    <div className={s.cardInfoGrid}>
                      <div>
                        <span>Fiyat</span>
                        <b>{fmtMoney(finalPrice, currency)}</b>
                      </div>

                      <div>
                        <span>Stok</span>
                        <b>{stock == null ? "—" : `${stock} adet`}</b>
                        {lowStock ? <small className={s.warnText}>Düşük stok</small> : null}
                      </div>

                      <div>
                        <span>Kur</span>
                        <b>{dynamic ? "Dinamik" : "Sabit"}</b>
                        {dynamic && rateKey ? <small>{rateKey}</small> : null}
                        {dynamic && gram != null ? <small>{gram} gr</small> : null}
                      </div>

                      <div>
                        <span>Sağlık</span>
                        <b
                          className={
                            tone === "ok"
                              ? s.scoreOk
                              : tone === "warn"
                                ? s.scoreWarn
                                : s.scoreBad
                          }
                        >
                          {health.score}/100
                        </b>
                      </div>
                    </div>

                    {health.issues.length ? (
                      <div className={s.issueRow}>
                        {health.issues.slice(0, 4).map((x) => (
                          <span key={x}>{x}</span>
                        ))}
                      </div>
                    ) : (
                      <div className={s.cleanRow}>Kayıt sağlıklı görünüyor.</div>
                    )}

                    <div className={s.cardActions}>
                      <button
                        type="button"
                        className={`${s.statusSwitch} ${active ? s.statusSwitchActive : s.statusSwitchPassive
                          }`}
                        disabled={Boolean(statusBusy[String(r.id)])}
                        onClick={() =>
                          changeProductStatus(String(r.id), !active)
                        }
                      >
                        <span className={s.statusSwitchTrack}>
                          <span className={s.statusSwitchKnob} />
                        </span>

                        <span className={s.statusSwitchText}>
                          {statusBusy[String(r.id)]
                            ? "Kaydediliyor..."
                            : active
                              ? "Aktif"
                              : "Pasif"}
                        </span>
                      </button>

                      <Link href={productHref(r.id)} className={s.actionBtn}>
                        Düzenle
                      </Link>

                      {r?.slug ? (
                        <Link
                          href={`/products/${encodeURIComponent(String(r.slug))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={s.secondaryAction}
                        >
                          Önizle
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className={s.note}>
        Fiyat okuma sırası: <b>finalPrice → computedPrice → priceFinal → priceTry → price</b>.
        Sağlık skoru; görsel, fiyat, stok, başlık, SKU ve slug alanlarına göre hesaplanır.
      </div>
    </main>
  );
}