"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./AdminStockAlertsPage.module.css";

type AlertStatus = "active" | "notified" | "cancelled";

type StockAlertDoc = {
  id: string;
  uid?: string | null;
  email?: string;
  phone?: string;
  productId?: string;
  productSlug?: string;
  productSku?: string;
  productImage?: string;
  productTitle?: { tr?: string; en?: string } | string;
  lastKnownStock?: number;
  lastKnownPriceTry?: number;
  status?: AlertStatus;
  locale?: string[] | string;
  source?: string[] | string;
  createdAt?: any;
  updatedAt?: any;
  notifiedAt?: any;
};

function safeStr(v: any) {
  const x = String(v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : "";
}

function pickTitle(v: any) {
  if (typeof v === "string") return safeStr(v);
  return safeStr(v?.tr) || safeStr(v?.en) || "Ürün";
}

function toMs(ts: any) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  } catch {
    return 0;
  }
}

function fmtDate(ts: any) {
  const ms = toMs(ts);
  if (!ms) return "—";

  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTRY(v: any) {
  const n = Number(v || 0);

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₺${n.toFixed(2)}`;
  }
}

function statusLabel(status: string) {
  if (status === "notified") return "Stok Geldi";
  if (status === "cancelled") return "İptal";
  return "Bekleyen";
}

function statusTone(status: string) {
  if (status === "notified") return s.badgeOk;
  if (status === "cancelled") return s.badgeMuted;
  return s.badgeWarn;
}

function normalizeSource(v: any) {
  if (Array.isArray(v)) return v.map(safeStr).filter(Boolean).join(" • ");
  return safeStr(v) || "product";
}

function normalizeLocale(v: any) {
  if (Array.isArray(v)) return v.map(safeStr).filter(Boolean).join(", ");
  return safeStr(v) || "tr";
}

export default function AdminStockAlertsPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [rows, setRows] = useState<StockAlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | AlertStatus>("active");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErr("");

    const qy = query(
      collection(db, "stock_alerts"),
      orderBy("createdAt", "desc"),
      limit(300)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: StockAlertDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error("admin stock alerts listen error:", e);
        setRows([]);
        setErr("Stok bildirimleri yüklenemedi. Firestore index/rules kontrol edilmeli.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db]);

  const stats = useMemo(() => {
    const active = rows.filter((x) => safeStr(x.status || "active") === "active").length;
    const notified = rows.filter((x) => safeStr(x.status) === "notified").length;
    const cancelled = rows.filter((x) => safeStr(x.status) === "cancelled").length;

    return {
      total: rows.length,
      active,
      notified,
      cancelled,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase("tr-TR").trim();

    return rows.filter((x) => {
      const status = safeStr(x.status || "active") as AlertStatus;

      if (filter !== "all" && status !== filter) return false;

      if (!q) return true;

      const haystack = [
        x.id,
        x.uid,
        x.email,
        x.phone,
        x.productId,
        x.productSlug,
        x.productSku,
        pickTitle(x.productTitle),
        normalizeSource(x.source),
        normalizeLocale(x.locale),
      ]
        .map((v) => safeStr(v).toLocaleLowerCase("tr-TR"))
        .join(" ");

      return haystack.includes(q);
    });
  }, [rows, filter, search]);

  async function markNotified(id: string) {
    if (!id) return;

    setSavingId(id);

    try {
      await updateDoc(doc(db, "stock_alerts", id), {
        status: "notified",
        notifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("mark notified error:", e);
      window.alert("Bildirim durumu güncellenemedi.");
    } finally {
      setSavingId("");
    }
  }

  async function cancelAlert(id: string) {
    if (!id) return;

    setSavingId(id);

    try {
      await updateDoc(doc(db, "stock_alerts", id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("cancel alert error:", e);
      window.alert("Bildirim iptal edilemedi.");
    } finally {
      setSavingId("");
    }
  }

  async function reactivateAlert(id: string) {
    if (!id) return;

    setSavingId(id);

    try {
      await updateDoc(doc(db, "stock_alerts", id), {
        status: "active",
        notifiedAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("reactivate alert error:", e);
      window.alert("Bildirim tekrar aktif edilemedi.");
    } finally {
      setSavingId("");
    }
  }

  async function removeAlert(id: string) {
    if (!id) return;

    const ok = window.confirm("Bu stok bildirim kaydı silinsin mi? Geri alınamaz.");
    if (!ok) return;

    setSavingId(id);

    try {
      await deleteDoc(doc(db, "stock_alerts", id));
    } catch (e) {
      console.error("delete alert error:", e);
      window.alert("Kayıt silinemedi.");
    } finally {
      setSavingId("");
    }
  }

  async function cancelAllActive() {
    const activeRows = rows.filter((x) => safeStr(x.status || "active") === "active");

    if (!activeRows.length) return;

    const ok = window.confirm(`${activeRows.length} adet bekleyen stok bildirimi iptal edilsin mi?`);
    if (!ok) return;

    setBulkBusy(true);

    try {
      const chunkSize = 25;

      for (let i = 0; i < activeRows.length; i += chunkSize) {
        const part = activeRows.slice(i, i + chunkSize);

        await Promise.all(
          part.map((x) =>
            updateDoc(doc(db, "stock_alerts", x.id), {
              status: "cancelled",
              updatedAt: serverTimestamp(),
            })
          )
        );
      }
    } catch (e) {
      console.error("cancel all active error:", e);
      window.alert("Toplu iptal işlemi tamamlanamadı.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.kicker}>ADMIN • STOCK ALERTS</div>
          <h1 className={s.title}>Stok Bildirim Merkezi</h1>
          <p className={s.sub}>
            Müşterilerin “Gelince Haber Ver” taleplerini takip et, stok dönüşlerini yönet ve bildirim sürecini kontrol altında tut.
          </p>

          <div className={s.heroBadges}>
            <span>Canlı Firestore takip</span>
            <span>Müşteri talep listesi</span>
            <span>Ürün bazlı operasyon</span>
          </div>
        </div>

        <div className={s.stats}>
          <button
            type="button"
            className={`${s.statCard} ${filter === "all" ? s.statOn : ""}`}
            onClick={() => setFilter("all")}
          >
            <span>Toplam</span>
            <b>{stats.total}</b>
          </button>

          <button
            type="button"
            className={`${s.statCard} ${filter === "active" ? s.statOn : ""}`}
            onClick={() => setFilter("active")}
          >
            <span>Bekleyen</span>
            <b>{stats.active}</b>
          </button>

          <button
            type="button"
            className={`${s.statCard} ${filter === "notified" ? s.statOn : ""}`}
            onClick={() => setFilter("notified")}
          >
            <span>Stok Geldi</span>
            <b>{stats.notified}</b>
          </button>

          <button
            type="button"
            className={`${s.statCard} ${filter === "cancelled" ? s.statOn : ""}`}
            onClick={() => setFilter("cancelled")}
          >
            <span>İptal</span>
            <b>{stats.cancelled}</b>
          </button>
        </div>
      </section>

      <section className={s.toolbar}>
        <div className={s.searchBox}>
          <span>ARA</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı, SKU, müşteri, e-posta, telefon..."
          />
        </div>

        <div className={s.toolbarActions}>
          <button
            type="button"
            className={s.softBtn}
            onClick={() => {
              setSearch("");
              setFilter("active");
            }}
          >
            Sıfırla
          </button>

          <button
            type="button"
            className={s.warnBtn}
            disabled={bulkBusy || stats.active === 0}
            onClick={cancelAllActive}
          >
            {bulkBusy ? "İşleniyor..." : "Bekleyenleri İptal Et"}
          </button>
        </div>
      </section>

      {err ? <div className={s.errorBox}>{err}</div> : null}

      {loading ? (
        <section className={s.skeletonGrid}>
          <div className={s.skel} />
          <div className={s.skel} />
          <div className={s.skel} />
          <div className={s.skel} />
        </section>
      ) : filtered.length === 0 ? (
        <section className={s.empty}>
          <div className={s.emptyIcon}>🔔</div>
          <h2>Kayıt bulunamadı</h2>
          <p>Bu filtreye uygun stok bildirimi şu an görünmüyor.</p>
        </section>
      ) : (
        <section className={s.list}>
          {filtered.map((item) => {
            const status = safeStr(item.status || "active") as AlertStatus;
            const title = pickTitle(item.productTitle);
            const image = safeStr(item.productImage);
            const href = item.productSlug
              ? `/products/${encodeURIComponent(item.productSlug)}`
              : item.productId
              ? `/products/${encodeURIComponent(item.productId)}`
              : "/shop";

            const busy = savingId === item.id;

            return (
              <article key={item.id} className={s.card}>
                <div className={s.media}>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={title} />
                  ) : (
                    <div className={s.mediaPh}>DROMOCOB</div>
                  )}
                </div>

                <div className={s.body}>
                  <div className={s.cardTop}>
                    <div className={s.titleBlock}>
                      <div className={s.productTitle}>{title}</div>

                      <div className={s.metaLine}>
                        {item.productSku ? <span>SKU: {item.productSku}</span> : null}
                        {item.productId ? <span>Ürün ID: {item.productId}</span> : null}
                        {item.productSlug ? <span>Slug: {item.productSlug}</span> : null}
                      </div>
                    </div>

                    <span className={`${s.badge} ${statusTone(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </div>

                  <div className={s.infoGrid}>
                    <div className={s.infoBox}>
                      <span>Müşteri</span>
                      <b>{safeStr(item.email) || safeStr(item.uid) || "—"}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>Telefon</span>
                      <b>{safeStr(item.phone) || "—"}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>Son Stok</span>
                      <b>{Number(item.lastKnownStock ?? 0)}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>Son Fiyat</span>
                      <b>{fmtTRY(item.lastKnownPriceTry)}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>Kayıt Tarihi</span>
                      <b>{fmtDate(item.createdAt)}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>Kaynak</span>
                      <b>{normalizeSource(item.source)}</b>
                    </div>
                  </div>

                  <div className={s.cardFooter}>
                    <div className={s.smallMeta}>
                      <span>ID: {item.id}</span>
                      <span>Dil: {normalizeLocale(item.locale)}</span>
                      {item.notifiedAt ? <span>Bildirildi: {fmtDate(item.notifiedAt)}</span> : null}
                    </div>

                    <div className={s.actions}>
                      <Link href={href} target="_blank" className={s.linkBtn}>
                        Ürünü Aç
                      </Link>

                      {status !== "notified" ? (
                        <button
                          type="button"
                          className={s.okBtn}
                          disabled={busy}
                          onClick={() => markNotified(item.id)}
                        >
                          {busy ? "..." : "Stok Geldi İşaretle"}
                        </button>
                      ) : null}

                      {status !== "active" ? (
                        <button
                          type="button"
                          className={s.softBtn}
                          disabled={busy}
                          onClick={() => reactivateAlert(item.id)}
                        >
                          {busy ? "..." : "Tekrar Aktif"}
                        </button>
                      ) : null}

                      {status === "active" ? (
                        <button
                          type="button"
                          className={s.warnBtn}
                          disabled={busy}
                          onClick={() => cancelAlert(item.id)}
                        >
                          {busy ? "..." : "İptal Et"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={s.dangerBtn}
                        disabled={busy}
                        onClick={() => removeAlert(item.id)}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}