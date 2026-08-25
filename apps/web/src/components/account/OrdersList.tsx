"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import s from "./OrdersList.module.css";

type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type Money = { amount: number; currency: string };

type OrderRow = {
  id: string;
  status?: OrderStatus | string;
  total?: Money | number;
  currency?: string;
  createdAt?: any;
  createdAtIso?: string;
  updatedAt?: any;
  itemCount?: number;
};

function toDateSafe(v: any, fallbackIso?: string) {
  try {
    if (!v) {
      if (fallbackIso) {
        const d = new Date(fallbackIso);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    }

    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    if (fallbackIso) {
      const d = new Date(fallbackIso);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any, loc: "tr" | "en", fallbackIso?: string) {
  const d = toDateSafe(v, fallbackIso);
  if (!d) return loc === "en" ? "Date pending" : "Tarih bekleniyor";

  return new Intl.DateTimeFormat(loc === "en" ? "en-US" : "tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtMoney(v: number, loc: "tr" | "en", currency = "TRY") {
  const locale = loc === "en" ? "en-US" : "tr-TR";
  const n = Number(v || 0);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function statusLabel(st: string, loc: "tr" | "en") {
  const s = String(st || "").trim();

  const tr: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };

  const en: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Pending payment",
    paid: "Paid",
    preparing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return (loc === "en" ? en[s] : tr[s]) || s || (loc === "en" ? "Processing" : "İşleniyor");
}

function statusTone(statusRaw: string) {
  const s = String(statusRaw || "").trim();
  if (s === "paid" || s === "delivered") return "ok";
  if (s === "cancelled" || s === "refunded") return "bad";
  if (s === "shipped" || s === "preparing") return "info";
  return "warn";
}

function totalToNumber(o: OrderRow) {
  if (o?.total && typeof o.total === "object") {
    return Number((o.total as any)?.amount ?? 0);
  }
  return Number((o as any)?.total ?? 0);
}

function totalCurrency(o: OrderRow) {
  if (o?.total && typeof o.total === "object") {
    return String((o.total as any)?.currency || "TRY");
  }
  return String((o as any)?.currency || "TRY");
}

export default function OrdersList({ loc = "tr" }: { loc?: "tr" | "en" }) {
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onIdTokenChanged(auth, (u) => setUid(u?.uid || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    setErr("");
    setOrders([]);

    if (!uid) {
      setBusy(false);
      return;
    }

    const db = getFirebaseDb();
    setBusy(true);

    const qy = query(
      collection(db, "orders"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: OrderRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setOrders(list);
        setBusy(false);
      },
      (e: any) => {
        setErr(e?.message || (loc === "en" ? "Orders could not be loaded." : "Siparişler okunamadı."));
        setBusy(false);
      }
    );

    return () => unsub();
  }, [uid, loc]);

  return (
    <section className={s.wrap}>
      <header className={s.head}>
        <h2 className={s.title}>{loc === "en" ? "Orders" : "Siparişler"}</h2>
        <p className={s.desc}>
          {loc === "en"
            ? "Track your latest orders, payment status and delivery flow."
            : "Son siparişlerini, ödeme durumunu ve teslimat akışını buradan takip et."}
        </p>
      </header>

      {err ? (
        <div className={`${s.stateCard} ${s.stateError}`}>
          {err}
        </div>
      ) : null}

      {busy ? (
        <div className={s.stateCard}>
          {loc === "en" ? "Loading..." : "Yükleniyor..."}
        </div>
      ) : !uid ? (
        <div className={s.emptyCard}>
          <b className={s.emptyTitle}>
            {loc === "en" ? "Please sign in" : "Giriş yapman gerekiyor"}
          </b>

          <div className={s.emptyText}>
            {loc === "en"
              ? "You need to sign in to view your order history."
              : "Sipariş geçmişini görmek için hesabına giriş yapman lazım."}
          </div>

          <div>
            <Link href="/login" className={s.primaryBtn}>
              {loc === "en" ? "Login" : "Giriş Yap"}
            </Link>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className={s.emptyCard}>
          <b className={s.emptyTitle}>
            {loc === "en" ? "No orders yet." : "Henüz sipariş yok."}
          </b>

          <div className={s.emptyText}>
            {loc === "en"
              ? "Once you place an order, it will appear here with live status updates."
              : "İlk siparişini verdiğinde burada canlı durum güncellemeleriyle görünecek."}
          </div>

          <div>
            <Link href="/shop" className={s.secondaryBtn}>
              {loc === "en" ? "Go to shop" : "Mağazaya git"}
            </Link>
          </div>
        </div>
      ) : (
        <div className={s.list}>
          {orders.map((o) => {
            const id = String(o.id || "").trim();
            const total = totalToNumber(o);
            const cur = totalCurrency(o);
            const st = statusLabel(String(o.status || ""), loc);
            const tone = statusTone(String(o.status || ""));
            const shortId = `#${id.slice(0, 10).toUpperCase()}`;

            return (
              <Link
                key={id}
                href={`/hesabim/orders/${encodeURIComponent(id)}`}
                className={s.orderCard}
              >
                <div className={s.orderTop}>
                  <div className={s.orderHeadBlock}>
                    <b className={s.orderId}>{shortId}</b>

                    <div className={s.orderDate}>
                      {loc === "en" ? "Date" : "Tarih"}:{" "}
                      <b>{fmtDate(o.createdAt, loc, o.createdAtIso)}</b>
                    </div>
                  </div>

                  <span className={`${s.orderStatus} ${s[`tone_${tone}`]}`}>
                    {st}
                  </span>
                </div>

                <div className={s.orderBottom}>
                  <div className={s.orderMeta}>
                    {Number(o?.itemCount || 0)} {loc === "en" ? "item(s)" : "ürün"}
                  </div>

                  <div className={s.orderTotal}>
                    {fmtMoney(total, loc, cur)}
                  </div>
                </div>

                <div className={s.orderLink}>
                  {loc === "en" ? "View details →" : "Detaya git →"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}