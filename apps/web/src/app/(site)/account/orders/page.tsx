"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { fmtTRY, type OrderDoc } from "@/lib/orders";
import { getLocale, type Locale } from "@/lib/i18n";
import { formatOrderId } from "@/lib/orderId";
import s from "./orders.module.css";

type Row = OrderDoc & { id: string };

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function getOrderTime(row: any) {
  const d = toDateSafe(row?.createdAt) || toDateSafe(row?.createdAtIso);
  return d ? d.getTime() : 0;
}

function fmtOrderDate(createdAt: any, loc: Locale, createdAtIso?: string) {
  const d = toDateSafe(createdAt) || toDateSafe(createdAtIso);

  if (!d) {
    return loc === "en" ? "Just now" : "Az önce";
  }

  return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(statusRaw: any): "ok" | "bad" | "info" | "warn" {
  const st = String(statusRaw || "pending_payment").trim();

  if (st === "paid" || st === "delivered") return "ok";
  if (st === "cancelled" || st === "refunded") return "bad";
  if (st === "shipped" || st === "preparing") return "info";

  return "warn";
}

function statusLabel(statusRaw: any, loc: Locale) {
  const st = String(statusRaw || "pending_payment").trim();

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

  return (loc === "en" ? en[st] : tr[st]) || st;
}

function getPaymentKind(row: any): "card" | "transfer" | "unknown" {
  const method = String(row?.payment?.method || "").trim().toLowerCase();
  const provider = String(row?.payment?.provider || "").trim().toLowerCase();
  const ref = String(row?.payment?.ref || "").trim().toLowerCase();

  if (provider === "paytr") return "card";
  if (method === "card") return "card";
  if (ref.startsWith("paytr") || ref.includes("paytr")) return "card";

  if (
    method === "eft" ||
    method === "havale" ||
    method === "transfer" ||
    method === "bank_transfer"
  ) {
    return "transfer";
  }

  if (provider === "manual") return "transfer";

  return "unknown";
}

function paymentMethodLabel(row: any, loc: Locale) {
  const kind = getPaymentKind(row);

  if (kind === "card") return loc === "en" ? "Card" : "Kart";
  if (kind === "transfer") return loc === "en" ? "Bank transfer" : "Havale / EFT";

  return loc === "en" ? "Not specified" : "Belirtilmedi";
}

function paymentMethodIcon(row: any) {
  const kind = getPaymentKind(row);

  if (kind === "card") return "💳";
  if (kind === "transfer") return "🏦";

  return "•";
}

function invoiceTypeRaw(row: any) {
  return String(
    row?.billing?.invoiceType ||
      row?.shippingAddress?.invoiceType ||
      row?.invoiceType ||
      "individual"
  )
    .trim()
    .toLowerCase();
}

function invoiceTypeLabel(row: any, loc: Locale) {
  const raw = invoiceTypeRaw(row);

  if (raw === "company") {
    return loc === "en" ? "Company" : "Kurumsal";
  }

  return loc === "en" ? "Individual" : "Bireysel";
}

function invoiceTypeTone(row: any) {
  return invoiceTypeRaw(row) === "company" ? "company" : "individual";
}

function invoiceTypeIcon(row: any) {
  return invoiceTypeTone(row) === "company" ? "🏢" : "👤";
}

function getTotalAmount(row: any) {
  const totalObj = Number(row?.total?.amount ?? 0);
  if (Number.isFinite(totalObj) && totalObj > 0) return totalObj;

  const totalTry = Number(row?.totalTry ?? 0);
  if (Number.isFinite(totalTry) && totalTry > 0) return totalTry;

  const totalFlat = Number(row?.total ?? 0);
  if (Number.isFinite(totalFlat) && totalFlat > 0) return totalFlat;

  return 0;
}

function getItemsCount(row: any) {
  if (Array.isArray(row?.items)) {
    return row.items.reduce((sum: number, it: any) => {
      return sum + Math.max(1, Number(it?.qty || 1));
    }, 0);
  }

  const itemCount = Number(row?.itemCount ?? 0);
  return Number.isFinite(itemCount) ? itemCount : 0;
}

function getStats(rows: Row[]) {
  return {
    total: rows.length,
    paid: rows.filter((r) => String(r.status || "") === "paid").length,
    pending: rows.filter((r) => String(r.status || "") === "pending_payment").length,
    shipped: rows.filter((r) => String(r.status || "") === "shipped").length,
  };
}

export default function AccountOrdersPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loc, setLoc] = useState<Locale>("tr");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      setLoc(((e as any)?.detail as Locale) || "tr");
    };

    window.addEventListener("locale-changed", handler as EventListener);

    return () => {
      window.removeEventListener("locale-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u && !u.isAnonymous ? u.uid : null);
      setAuthReady(true);
    });

    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!authReady) return;

    if (!uid) {
      setRows([]);
      setErr("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    const qy = query(collection(db, "orders"), where("uid", "==", uid));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
          .sort((a: any, b: any) => getOrderTime(b) - getOrderTime(a));

        setRows(list);
        setLoading(false);
      },
      (snapshotErr) => {
        console.error("orders snapshot error:", snapshotErr);

        setErr(
          loc === "en"
            ? "Orders could not be loaded."
            : "Siparişler yüklenemedi."
        );

        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid, authReady, loc]);

  const stats = useMemo(() => getStats(rows), [rows]);

  const t = useMemo(() => {
    const en = loc === "en";

    return {
      account: "ACCOUNT",
      title: en ? "My Orders" : "Siparişlerim",
      loadingText: en ? "Your orders are being prepared." : "Siparişlerin hazırlanıyor, bir saniye.",
      loginText: en ? "Sign in to view your order history." : "Sipariş geçmişini görmek için giriş yap.",
      subtitle: en
        ? "Track your latest purchases, payment status and delivery progress."
        : "Son siparişlerini, ödeme durumlarını ve teslimat ilerlemelerini takip et.",
      live: en ? "Live updates" : "Canlı durum",
      secure: en ? "Secure orders" : "Güvenli sipariş",
      fast: en ? "Fast tracking" : "Hızlı takip",
      total: en ? "Total" : "Toplam",
      paid: en ? "Paid" : "Ödendi",
      pending: en ? "Pending" : "Bekleyen",
      shipped: en ? "Shipped" : "Kargoda",
      accountBtn: en ? "Account" : "Hesabım",
      shopBtn: en ? "Shop" : "Mağaza",
      signRequired: en ? "Sign in required" : "Giriş yapman gerekiyor",
      signDesc: en ? "Please sign in to see your orders." : "Siparişlerini görmek için hesabına giriş yap.",
      login: en ? "Login" : "Giriş Yap",
      register: en ? "Register" : "Kayıt Ol",
      noOrders: en ? "No orders yet" : "Henüz sipariş yok",
      noOrdersDesc: en
        ? "Looks calm here. Time to add some shine."
        : "Buralar sakin. Biraz parıltı ekleme vakti.",
      goShop: en ? "Go to shop" : "Mağazaya git",
      home: en ? "Home" : "Anasayfa",
      items: en ? "Items" : "Ürün",
      payment: en ? "Payment" : "Ödeme",
      invoiceType: en ? "Invoice type" : "Fatura tipi",
      detail: en ? "View details" : "Detayları Gör",
      order: en ? "Order" : "Sipariş",
    };
  }, [loc]);

  if (!authReady) {
    return (
      <main className={s.page}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.kicker}>{t.account}</div>
            <h1 className={s.h1}>{t.title}</h1>
            <p className={s.sub}>{t.loadingText}</p>
          </div>
        </section>

        <div className={s.skeletonGrid}>
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
        </div>
      </main>
    );
  }

  if (!uid) {
    return (
      <main className={s.page}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.kicker}>{t.account}</div>
            <h1 className={s.h1}>{t.title}</h1>
            <p className={s.sub}>{t.loginText}</p>
          </div>
        </section>

        <div className={s.emptyCard}>
          <div className={s.emptyIcon}>🧾</div>
          <div className={s.emptyTitle}>{t.signRequired}</div>
          <div className={s.emptyDesc}>{t.signDesc}</div>

          <div className={s.actions}>
            <Link className={s.primaryBtn} href="/login">
              {t.login}
            </Link>
            <Link className={s.ghostBtn} href="/register">
              {t.register}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.kicker}>{t.account}</div>
          <h1 className={s.h1}>{t.title}</h1>
          <p className={s.sub}>{t.subtitle}</p>

          <div className={s.heroBadges}>
            <span className={s.heroBadge}>{t.live}</span>
            <span className={s.heroBadge}>{t.secure}</span>
            <span className={s.heroBadge}>{t.fast}</span>
          </div>
        </div>

        <div className={s.heroRight}>
          <div className={s.statCard}>
            <span>{t.total}</span>
            <b>{stats.total}</b>
          </div>

          <div className={s.statCard}>
            <span>{t.paid}</span>
            <b>{stats.paid}</b>
          </div>

          <div className={s.statCard}>
            <span>{t.pending}</span>
            <b>{stats.pending}</b>
          </div>

          <div className={s.statCard}>
            <span>{t.shipped}</span>
            <b>{stats.shipped}</b>
          </div>
        </div>
      </section>

      <div className={s.topLinks}>
        <Link className={s.miniLink} href="/hesabim">
          {t.accountBtn} →
        </Link>

        <Link className={s.miniLink} href="/shop">
          {t.shopBtn} →
        </Link>
      </div>

      {err ? <div className={s.errorBox}>{err}</div> : null}

      {loading ? (
        <div className={s.skeletonGrid}>
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
        </div>
      ) : rows.length === 0 ? (
        <div className={s.emptyCard}>
          <div className={s.emptyIcon}>✨</div>
          <div className={s.emptyTitle}>{t.noOrders}</div>
          <div className={s.emptyDesc}>{t.noOrdersDesc}</div>

          <div className={s.actions}>
            <Link className={s.primaryBtn} href="/shop">
              {t.goShop}
            </Link>

            <Link className={s.ghostBtn} href="/">
              {t.home}
            </Link>
          </div>
        </div>
      ) : (
        <div className={s.list}>
          {rows.map((r) => {
            const id = String(r.id || "").trim();
            if (!id) return null;

            const shortId = `#${formatOrderId(id, "short")}`;
            const totalAmount = getTotalAmount(r);
            const tone = statusTone(r.status);
            const label = statusLabel(r.status, loc);
            const itemsCount = getItemsCount(r);
            const paymentLabel = paymentMethodLabel(r, loc);
            const paymentIcon = paymentMethodIcon(r);
            const invoiceLabel = invoiceTypeLabel(r, loc);
            const invoiceTone = invoiceTypeTone(r);
            const invoiceIcon = invoiceTypeIcon(r);

            return (
              <Link
                key={id}
                href={`/account/orders/${encodeURIComponent(id)}`}
                className={s.cardLink}
              >
                <article className={s.card}>
                  <div className={s.cardGlow} />

                  <div className={s.cardTop}>
                    <div className={s.cardIdWrap}>
                      <div className={s.cardId}>{shortId}</div>
                      <div className={s.cardDate}>
                        {fmtOrderDate((r as any)?.createdAt, loc, (r as any)?.createdAtIso)}
                      </div>
                    </div>

                    <span
                      className={`${s.pill} ${
                        tone === "ok"
                          ? s.pillOk
                          : tone === "bad"
                          ? s.pillBad
                          : tone === "info"
                          ? s.pillInfo
                          : s.pillWarn
                      }`}
                    >
                      {label}
                    </span>
                  </div>

                  <div className={s.cardMid}>
                    <div className={s.metaGrid}>
                      <div className={s.metaBox}>
                        <span className={s.metaKey}>{t.items}</span>
                        <b className={s.metaVal}>
                          {itemsCount} {loc === "en" ? "items" : "ürün"}
                        </b>
                      </div>

                      <div className={s.metaBox}>
                        <span className={s.metaKey}>{t.payment}</span>
                        <b className={s.metaVal}>
                          <span className={s.inlineIcon}>{paymentIcon}</span>
                          {paymentLabel}
                        </b>
                      </div>

                      <div className={s.metaBox}>
                        <span className={s.metaKey}>{t.invoiceType}</span>
                        <b
                          className={`${s.metaVal} ${
                            invoiceTone === "company"
                              ? s.metaValCompany
                              : s.metaValIndividual
                          }`}
                        >
                          <span className={s.inlineIcon}>{invoiceIcon}</span>
                          {invoiceLabel}
                        </b>
                      </div>
                    </div>
                  </div>

                  <div className={s.cardBot}>
                    <div className={s.detail}>
                      {t.detail} <span className={s.arr}>→</span>
                    </div>

                    <div className={s.totalWrap}>
                      <span className={s.totalLabel}>{t.total}</span>
                      <div className={s.total}>{fmtTRY(totalAmount)}</div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}