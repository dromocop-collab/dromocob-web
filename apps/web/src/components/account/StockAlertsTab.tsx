"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { useT } from "@/lib/useT";
import s from "./StockAlertsTab.module.css";

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
  status?: "active" | "notified" | "cancelled";
  locale?: string[] | string;
  source?: string[] | string;
  createdAt?: any;
  updatedAt?: any;
  notifiedAt?: any;
};

function str(v: any) {
  return String(v ?? "").trim();
}

function pickText(v: any, loc: "tr" | "en") {
  if (typeof v === "string") return v.trim();
  const tr = str(v?.tr);
  const en = str(v?.en);
  return loc === "en" ? (en || tr || "") : (tr || en || "");
}

function toMs(ts: any) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts === "number") return ts;
    return 0;
  } catch {
    return 0;
  }
}

function fmtTRY(v: number, loc: "tr" | "en") {
  return new Intl.NumberFormat(loc === "en" ? "en-US" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number(v || 0));
}

export default function StockAlertsTab({
  uid,
}: {
  uid: string;
}) {
  const db = useMemo(() => getFirebaseDb(), []);
  const { loc } = useT();

  const [rows, setRows] = useState<StockAlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "notified" | "cancelled">("all");
  const [savingId, setSavingId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }

    const qy = query(
      collection(db, "stock_alerts"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
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
      (err) => {
        console.error("stock alerts listen error:", err);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((x) => str(x.status || "active") === filter);
  }, [rows, filter]);

  async function cancelAlert(id: string) {
    if (!id) return;
    setSavingId(id);
    try {
      await updateDoc(doc(db, "stock_alerts", id), {
        status: "cancelled",
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("cancel stock alert error:", err);
    } finally {
      setSavingId("");
    }
  }
  async function clearAllActive() {
    if (!uid) return;
  
    setBulkBusy(true);
    try {
      const active = rows.filter((x) => str(x.status || "active") === "active");
      if (!active.length) return;
  
      // paralel update (çok fazla olursa chunk’larız)
      const chunkSize = 25;
      for (let i = 0; i < active.length; i += chunkSize) {
        const part = active.slice(i, i + chunkSize);
        await Promise.all(
          part.map((x) =>
            updateDoc(doc(db, "stock_alerts", x.id), {
              status: "cancelled",
              updatedAt: new Date(),
            })
          )
        );
      }
  
      // istersen toast bağlarız (varsa)
      // toast.success(t.clearedOk);
    } catch (err) {
      console.error("clearAllActive error:", err);
    } finally {
      setBulkBusy(false);
    }
  }
  async function deleteAll() {
    if (!uid) return;
  
    setBulkBusy(true);
    try {
      const list = rows.slice();
      if (!list.length) return;
  
      const chunkSize = 25;
      for (let i = 0; i < list.length; i += chunkSize) {
        const part = list.slice(i, i + chunkSize);
        await Promise.all(part.map((x) => deleteDoc(doc(db, "stock_alerts", x.id))));
      }
    } catch (err) {
      console.error("deleteAll stock alerts error:", err);
    } finally {
      setBulkBusy(false);
    }
  }
  const t = {
    title: loc === "en" ? "Stock Alerts" : "Stok Bildirimlerim",
    sub: loc === "en"
      ? "Track products you requested to be notified for."
      : "Gelince haber ver dediğin ürünleri buradan takip et.",
    all: loc === "en" ? "All" : "Tümü",
    active: loc === "en" ? "Waiting" : "Bekleyen",
    notified: loc === "en" ? "Restocked" : "Stok Geldi",
    cancelled: loc === "en" ? "Cancelled" : "İptal",
    empty: loc === "en"
      ? "No stock alert records yet."
      : "Henüz stok bildirimi kaydın yok.",
    productDetail: loc === "en" ? "Product Detail" : "Ürün Detayı",
    cancel: loc === "en" ? "Cancel Alert" : "Bildirimi İptal Et",
    createdAt: loc === "en" ? "Created" : "Kayıt",
    lastStock: loc === "en" ? "Last stock" : "Son stok",
    lastPrice: loc === "en" ? "Last price" : "Son fiyat",
    sku: "SKU",
    clear: loc === "en" ? "Clear" : "Temizle",
clearConfirm:
  loc === "en"
    ? "Cancel all ACTIVE alerts?"
    : "Tüm BEKLEYEN bildirimleri iptal etmek istiyor musun?",
clearedOk: loc === "en" ? "Cleared." : "Temizlendi.",
  };

  return (
    <section className={s.wrap}>
      <div className={s.head}>
        <div>
          <h2 className={s.title}>{t.title}</h2>
          <p className={s.sub}>{t.sub}</p>
        </div>

        <div className={s.filters}>
          <button
            type="button"
            className={`${s.filterBtn} ${filter === "all" ? s.filterBtnOn : ""}`}
            onClick={() => setFilter("all")}
          >
            {t.all}
          </button>
          <button
            type="button"
            className={`${s.filterBtn} ${filter === "active" ? s.filterBtnOn : ""}`}
            onClick={() => setFilter("active")}
          >
            {t.active}
          </button>
          <button
            type="button"
            className={`${s.filterBtn} ${filter === "notified" ? s.filterBtnOn : ""}`}
            onClick={() => setFilter("notified")}
          >
            {t.notified}
          </button>
          <button
            type="button"
            className={`${s.filterBtn} ${filter === "cancelled" ? s.filterBtnOn : ""}`}
            onClick={() => setFilter("cancelled")}
          >
            {t.cancelled}
          </button>
          <button
  type="button"
  className={s.clearBtn}
  disabled={bulkBusy || rows.length === 0}
  onClick={async () => {
    const ok = window.confirm(t.clearConfirm);
    if (!ok) return;
    await clearAllActive();
  }}
>
  {bulkBusy ? "..." : t.clear}
</button>
<button
  type="button"
  className={s.dangerBtn}
  disabled={bulkBusy || rows.length === 0}
  onClick={async () => {
    const ok = window.confirm(
      loc === "en"
        ? "Delete ALL stock alerts? This cannot be undone."
        : "Tüm stok bildirimlerini SİLMEK istiyor musun? Geri alınamaz."
    );
    if (!ok) return;
    await deleteAll();
  }}
>
  {bulkBusy ? "..." : (loc === "en" ? "Delete all" : "Tümünü Sil")}
</button>
        </div>
      </div>

      {loading ? (
        <div className={s.stateBox}>{loc === "en" ? "Loading..." : "Yükleniyor..."}</div>
      ) : filtered.length === 0 ? (
        <div className={s.stateBox}>{t.empty}</div>
      ) : (
        <div className={s.list}>
          {filtered.map((item) => {
            const status = str(item.status || "active") as "active" | "notified" | "cancelled";
            const title = pickText(item.productTitle, loc) || (loc === "en" ? "Product" : "Ürün");
            const href = item.productSlug
              ? `/products/${encodeURIComponent(item.productSlug)}`
              : item.productId
              ? `/products/${encodeURIComponent(item.productId)}`
              : "/shop";

            const createdAtMs = toMs(item.createdAt);
            const createdText = createdAtMs
              ? new Date(createdAtMs).toLocaleDateString(loc === "en" ? "en-US" : "tr-TR")
              : "-";

            return (
              <article key={item.id} className={s.card}>
                <div className={s.media}>
                  {item.productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.productImage} alt={title} className={s.img} />
                  ) : (
                    <div className={s.ph}>DROMOCOB</div>
                  )}
                </div>

                <div className={s.body}>
                  <div className={s.topRow}>
                    <div>
                      <div className={s.productTitle}>{title}</div>
                      {item.productSku ? (
                        <div className={s.metaLine}>
                          {t.sku}: <span>{item.productSku}</span>
                        </div>
                      ) : null}
                    </div>

                    <span
                      className={[
                        s.badge,
                        status === "active" ? s.badgeWarn : "",
                        status === "notified" ? s.badgeOk : "",
                        status === "cancelled" ? s.badgeMuted : "",
                      ].join(" ")}
                    >
                      {status === "active"
                        ? t.active
                        : status === "notified"
                        ? t.notified
                        : t.cancelled}
                    </span>
                  </div>

                  <div className={s.infoGrid}>
                    <div className={s.infoBox}>
                      <span>{t.createdAt}</span>
                      <b>{createdText}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>{t.lastStock}</span>
                      <b>{Number(item.lastKnownStock ?? 0)}</b>
                    </div>

                    <div className={s.infoBox}>
                      <span>{t.lastPrice}</span>
                      <b>{fmtTRY(Number(item.lastKnownPriceTry ?? 0), loc)}</b>
                    </div>
                  </div>

                  <div className={s.actions}>
                    <Link href={href} className={s.btnGhost}>
                      {t.productDetail}
                    </Link>

                    {status === "active" ? (
                      <button
                        type="button"
                        className={s.btnDark}
                        disabled={savingId === item.id}
                        onClick={() => cancelAlert(item.id)}
                      >
                        {savingId === item.id ? "..." : t.cancel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}