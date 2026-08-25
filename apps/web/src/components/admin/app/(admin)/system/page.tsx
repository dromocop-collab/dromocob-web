"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./systemAdmin.module.css";

type LogRow = {
  id: string;
  level?: "info" | "warn" | "error" | "critical";
  source?: string;
  code?: string;
  message?: string;
  status?: "open" | "investigating" | "resolved";
  createdAt?: any;
  details?: any;
};

type ProductRow = {
  id: string;
  title?: string | { tr?: string; en?: string };
  slug?: string;
  sku?: string;
  stock?: number;
  stockAlarm?: number;
  price?: number;
  finalPrice?: number;
  computedPrice?: number;
  priceTry?: number;
  isActive?: boolean;
  images?: string[];
  image?: string;
  categoryIds?: string[];
  description?: string | { tr?: string; en?: string };
  shortDescription?: string | { tr?: string; en?: string };
  seoDescription?: string | { tr?: string; en?: string };
};

type OrderRow = {
  id: string;
  uid?: string;
  email?: string;
  status?: string;
  paymentStatus?: string;
  payment?: {
    provider?: string;
    method?: string;
    ref?: string;
  };
  total?: { amount?: number; currency?: string } | number;
  items?: any[];
  createdAt?: any;
  updatedAt?: any;

  shippingProvider?: string;
  shippingStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shipmentId?: string;
  shipmentRef?: string;
  shipmentDocId?: string;
  shippingReferenceId?: string;
  shippingInvoiceId?: string;
  shippingCancelled?: boolean;
  shippingBarcodeError?: string;

  refundStatus?: string;
  refundedTotal?: { amount?: number; currency?: string } | number;
  hasReturnRequest?: boolean;
  lastReturnRequestId?: string;
  lastReturnShippingStatus?: string;
  lastReturnTrackingNumber?: string;
  returnInfo?: any;
};

type RefundRow = {
  id: string;
  uid?: string;
  orderId?: string;
  orderDocId?: string;
  merchantOid?: string;
  amountTry?: string | number;
  reason?: string;
  status?: string;
  type?: string;
  createdAt?: any;
  updatedAt?: any;
  rejectReason?: string;
  returnShipping?: any;
  returnShipment?: any;
  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};

type SupportThreadRow = {
  id: string;
  status?: "open" | "closed";
  unreadByAdmin?: number;
  name?: string;
  phone?: string;
  email?: string;
  page?: string;
  lastText?: string;
  lastMessageAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

type HealthDoc = {
  web?: { status?: string; checkedAt?: any };
  firestore?: { status?: string; checkedAt?: any };
  storage?: { status?: string; checkedAt?: any };
  functions?: { status?: string; checkedAt?: any };
  rates?: { status?: string; checkedAt?: any; fetchedAt?: any };
  support?: { status?: string; checkedAt?: any };
};

type RateDoc = {
  fetchedAt?: any;
  provider?: string;
  count?: number;
  items?: any[];
  itemsMap?: Record<string, any>;
};

type CenterTab =
  | "overview"
  | "products"
  | "orders"
  | "shipping"
  | "refunds"
  | "rates"
  | "support"
  | "logs";

function s(v: any) {
  return String(v ?? "").trim();
}

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function moneyAmount(v: any) {
  if (v && typeof v === "object") return n(v.amount, 0);
  return n(v, 0);
}

function tsMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return Number(v.toMillis());
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    const d = Date.parse(String(v));
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: any) {
  const ms = tsMs(v);
  if (!ms) return "-";

  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(v: any) {
  const ms = tsMs(v);
  if (!ms) return "-";

  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);

  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa önce`;

  const day = Math.floor(hour / 24);
  return `${day} gün önce`;
}

function pickLocaleText(v: any) {
  if (typeof v === "string") return s(v);
  return s(v?.tr || v?.en || "");
}

function pickTitle(p: ProductRow) {
  if (typeof p?.title === "string") return p.title;
  return s(p?.title?.tr || p?.title?.en || p?.slug || p?.sku || p?.id || "Ürün");
}

function pickPrice(p: ProductRow) {
  return n(p?.finalPrice ?? p?.computedPrice ?? p?.priceTry ?? p?.price ?? 0, 0);
}

function hasImage(p: ProductRow) {
  if (Array.isArray(p?.images) && p.images.some((x) => s(x))) return true;
  if (s(p?.image)) return true;
  return false;
}

function hasCategory(p: ProductRow) {
  return Array.isArray(p?.categoryIds) && p.categoryIds.length > 0;
}

function hasDescription(p: ProductRow) {
  return Boolean(
    pickLocaleText(p?.description) ||
      pickLocaleText(p?.shortDescription) ||
      pickLocaleText(p?.seoDescription)
  );
}

function statusTone(v?: string) {
  const st = s(v).toLowerCase();

  if (["ok", "healthy", "online", "paid", "delivered", "created", "barcode_created"].includes(st)) {
    return "ok";
  }

  if (["warn", "warning", "degraded", "preparing", "shipped", "pending", "pending_payment"].includes(st)) {
    return "warn";
  }

  if (["error", "critical", "offline", "failed", "cancelled", "barcode_error"].includes(st)) {
    return "bad";
  }

  return "neutral";
}

function levelTone(v?: string) {
  if (v === "critical") return "critical";
  if (v === "error") return "error";
  if (v === "warn") return "warn";
  return "info";
}

function rateFreshnessTone(v: any) {
  const ms = tsMs(v);
  if (!ms) return "bad";

  const diffMin = Math.floor((Date.now() - ms) / 60000);
  const diffHours = diffMin / 60;

  if (diffHours <= 24) return "ok";
  if (diffHours <= 48) return "warn";

  return "bad";
}
function isLogStillRelevant(log: LogRow) {
  const status = s(log.status || "open").toLowerCase();
  if (status === "resolved") return false;

  const code = s(log.code).toUpperCase();
  const level = s(log.level).toLowerCase();
  const source = s(log.source).toLowerCase();

  const createdMs = tsMs(log.createdAt);
  const ageHours = createdMs ? (Date.now() - createdMs) / (1000 * 60 * 60) : 9999;

  if (!["critical", "error", "warn"].includes(level)) return false;

  // System health kendi ürettiği digest logları panelde kritik log olarak şişirmesin.
  if (source === "system_health" || code === "SYSTEM_HEALTH_DEGRADED") {
    return false;
  }

  // Frontend crash logları 24 saatten eskiyse artık acil değil.
  if (code === "SHOP_PAGE_CRASH") return ageHours <= 24;

  return true;
}

function orderLabel(o: OrderRow) {
  return `${s(o.id)} ${s(o.email)} ${s(o.uid)} ${s(o.payment?.ref)} ${s(o.status)} ${s(o.paymentStatus)}`;
}

function refundLabel(r: RefundRow) {
  return `${s(r.id)} ${s(r.orderId)} ${s(r.orderDocId)} ${s(r.uid)} ${s(r.merchantOid)} ${s(r.status)} ${s(r.reason)}`;
}

function threadLabel(t: SupportThreadRow) {
  return `${s(t.id)} ${s(t.name)} ${s(t.phone)} ${s(t.email)} ${s(t.lastText)} ${s(t.status)}`;
}

function productLabel(p: ProductRow) {
  return `${pickTitle(p)} ${s(p.slug)} ${s(p.sku)} ${s(p.id)}`;
}

function orderIssues(o: OrderRow) {
  const issues: string[] = [];

  const status = s(o.status).toLowerCase();
  const paymentStatus = s(o.paymentStatus).toLowerCase();
  const provider = s(o.payment?.provider).toLowerCase();
  const method = s(o.payment?.method).toLowerCase();

  const total = moneyAmount(o.total);

  if (!status) issues.push("Sipariş durumu boş");
  if (!Array.isArray(o.items) || o.items.length === 0) issues.push("Ürün listesi boş");
  if (total <= 0) issues.push("Toplam tutar 0");

  if (provider === "paytr" && method === "card" && paymentStatus !== "paid" && status !== "cancelled") {
    issues.push("PayTR sipariş ödemesi net değil");
  }

  if (["paid", "preparing", "shipped", "delivered"].includes(status) && !provider) {
    issues.push("Ödeme sağlayıcı boş");
  }

  if (status === "shipped" && !s(o.trackingNumber)) {
    issues.push("Kargoda ama takip no yok");
  }

  if (s(o.shippingStatus) === "barcode_error") {
    issues.push("Kargo barkod hatası");
  }

  if (s(o.shippingBarcodeError)) {
    issues.push(`Kargo hata: ${s(o.shippingBarcodeError).slice(0, 60)}`);
  }

  if (o.shippingCancelled && status === "shipped") {
    issues.push("Kargo iptal ama sipariş kargoda");
  }

  if (s(o.refundStatus) === "full_refunded" && status !== "refunded") {
    issues.push("Tam iade var ama sipariş refunded değil");
  }

  return issues;
}

function shippingIssues(o: OrderRow) {
  const issues: string[] = [];

  const status = s(o.status).toLowerCase();
  const shipStatus = s(o.shippingStatus).toLowerCase();

  if (["paid", "preparing"].includes(status) && !shipStatus) {
    issues.push("Kargo oluşturulmamış");
  }

  if (shipStatus === "created" && !s(o.trackingNumber)) {
    issues.push("Kargo var ama takip numarası yok");
  }

  if (shipStatus === "barcode_error") {
    issues.push("Barkod hatası");
  }

  if (shipStatus === "cancelled" && !o.shippingCancelled) {
    issues.push("Status cancelled ama flag yok");
  }

  if (s(o.shipmentId) && !s(o.shippingReferenceId)) {
    issues.push("Shipment var ama referenceId yok");
  }

  return issues;
}

function refundIssues(r: RefundRow) {
  const issues: string[] = [];

  const status = s(r.status).toLowerCase();
  const rs = r.returnShipping || {};
  const mirror = r.returnShipment || {};
  const shipStatus = s(mirror.status || rs.status).toLowerCase();

  if (!s(r.orderId || r.orderDocId)) issues.push("orderId yok");
  if (!s(r.uid)) issues.push("uid yok");
  if (moneyAmount(r.amountTry) <= 0) issues.push("İade tutarı 0");

  if (status === "approved" && !shipStatus) {
    issues.push("Onaylı ama kargo durumu yok");
  }

  if (status === "return_label_created") {
    const code = s(rs.returnCode || rs.trackingNumber || mirror.returnCode || mirror.trackingNumber || mirror.trackingNo);
    if (!code) issues.push("İade kodu hazır ama kod boş");

    if (!s(rs.shipmentId || mirror.shipmentId)) issues.push("İade kodu var ama shipmentId boş");
    if (!s(rs.referenceId || mirror.referenceId)) issues.push("İade kodu var ama referenceId boş");
  }

  if (["return_label_error", "return_label_failed"].includes(status)) {
    issues.push(s(rs.lastError || mirror.lastError) || "İade kargo oluşturma hatası");
  }

  if (status === "return_label_cancelled" && shipStatus !== "cancelled") {
    issues.push("Refund cancelled ama returnShipment cancelled değil");
  }

  if (r.paytr?.error) {
    issues.push(`PayTR hata: ${s(r.paytr.error).slice(0, 70)}`);
  }

  if (status === "refunded" && !s(r.paytr?.referenceNo)) {
    issues.push("İade tamam ama PayTR ref yok");
  }

  return issues;
}

function productIssues(p: ProductRow) {
  const issues: string[] = [];

  if (p.isActive !== false && pickPrice(p) <= 0) issues.push("Fiyat 0");
  if (p.isActive !== false && !hasImage(p)) issues.push("Görsel yok");
  if (p.isActive !== false && !hasCategory(p)) issues.push("Kategori yok");
  if (p.isActive !== false && !hasDescription(p)) issues.push("Açıklama yok");

  const stock = n(p.stock, 0);
  const stockAlarm = n(p.stockAlarm, 0);

  if (p.isActive !== false) {
    if (stockAlarm > 0 && stock <= stockAlarm) issues.push(`Düşük stok (${stock})`);
    else if (stock > 0 && stock <= 3) issues.push(`Düşük stok (${stock})`);
  }

  if (p.isActive === false && (pickPrice(p) <= 0 || !hasImage(p) || !hasCategory(p))) {
    issues.push("Pasif ürün sorunlu veri");
  }

  return issues;
}

export default function AdminSystemPage() {
  return (
    <AdminGate>
      <PermissionGate permission="system">
        <AdminSystemPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function AdminSystemPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [health, setHealth] = useState<HealthDoc | null>(null);
  const [rate, setRate] = useState<RateDoc | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [threads, setThreads] = useState<SupportThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [centerTab, setCenterTab] = useState<CenterTab>("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, "system_health", "current"),
        (snap) => setHealth(snap.exists() ? (snap.data() as HealthDoc) : null),
        () => setHealth(null)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "rates", "latest"),
        (snap) => setRate(snap.exists() ? (snap.data() as RateDoc) : null),
        () => setRate(null)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "system_logs"), orderBy("createdAt", "desc"), limit(80)),
        (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
        () => setLogs([])
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "products"), limit(700)),
        (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
        () => setProducts([])
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(300)),
        (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
        () => setOrders([])
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "refund_requests"), orderBy("createdAt", "desc"), limit(200)),
        (snap) => setRefunds(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
        () => setRefunds([])
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "support_threads"), orderBy("lastMessageAt", "desc"), limit(80)),
        (snap) => {
          setThreads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
          setLoading(false);
        },
        () => {
          setThreads([]);
          setLoading(false);
        }
      )
    );

    return () => unsubs.forEach((x) => x());
  }, [db]);

  const metrics = useMemo(() => {
    const visibleLogs = logs.filter((x) => isLogStillRelevant(x));
    const activeProducts = products.filter((p) => p.isActive !== false);

    const productProblemRows = products
      .map((p) => ({ row: p, issues: productIssues(p) }))
      .filter((x) => x.issues.length > 0);

    const orderProblemRows = orders
      .map((o) => ({ row: o, issues: orderIssues(o) }))
      .filter((x) => x.issues.length > 0);

    const shippingProblemRows = orders
      .map((o) => ({ row: o, issues: shippingIssues(o) }))
      .filter((x) => x.issues.length > 0);

    const refundProblemRows = refunds
      .map((r) => ({ row: r, issues: refundIssues(r) }))
      .filter((x) => x.issues.length > 0);

    const unreadSupport = threads.reduce((a, t) => a + n(t.unreadByAdmin, 0), 0);
    const openThreads = threads.filter((t) => s(t.status || "open") !== "closed").length;

    const rateMs = tsMs(rate?.fetchedAt);
    const rateAgeMin = rateMs ? Math.floor((Date.now() - rateMs) / 60000) : 9999;
   const rateProblem =
  !rate ||
  rateFreshnessTone(rate?.fetchedAt) === "bad" ||
  n(rate?.count, 0) <= 0 ||
  rateAgeMin > 24 * 60;

   const criticalScore =
  visibleLogs.filter((x) => s(x.level) === "critical").length * 10 +
  visibleLogs.filter((x) => s(x.level) === "error").length * 5 +
  orderProblemRows.length * 4 +
  refundProblemRows.length * 4 +
  shippingProblemRows.length * 3 +
  Math.min(productProblemRows.length, 25) +
  (rateProblem ? 12 : 0) +
  Math.min(unreadSupport, 20);

    return {
      visibleLogs,
      activeProducts: activeProducts.length,

      productProblemRows,
      orderProblemRows,
      shippingProblemRows,
      refundProblemRows,

      productProblemCount: productProblemRows.length,
      orderProblemCount: orderProblemRows.length,
      shippingProblemCount: shippingProblemRows.length,
      refundProblemCount: refundProblemRows.length,

      openLogs: visibleLogs.length,
      criticalLogs: visibleLogs.filter((x) => s(x.level) === "critical").length,
      errorLogs: visibleLogs.filter((x) => s(x.level) === "error").length,

      unreadSupport,
      openThreads,
      recentThreads: threads.slice(0, 12),

      rateProblem,
      rateAgeMin,
      criticalScore,
      healthTone:
        criticalScore >= 30
          ? "bad"
          : criticalScore >= 12
          ? "warn"
          : "ok",
    };
  }, [logs, products, orders, refunds, threads, rate]);

  const healthCards = [
    {
      title: "Web",
      value: s(health?.web?.status || "unknown"),
      time: health?.web?.checkedAt,
      tone: statusTone(health?.web?.status),
    },
    {
      title: "Firestore",
      value: s(health?.firestore?.status || "unknown"),
      time: health?.firestore?.checkedAt,
      tone: statusTone(health?.firestore?.status),
    },
    {
      title: "Storage",
      value: s(health?.storage?.status || "unknown"),
      time: health?.storage?.checkedAt,
      tone: statusTone(health?.storage?.status),
    },
    {
      title: "Functions",
      value: s(health?.functions?.status || "unknown"),
      time: health?.functions?.checkedAt,
      tone: statusTone(health?.functions?.status),
    },
    {
      title: "Rates",
      value: s(health?.rates?.status || "unknown"),
      time: rate?.fetchedAt || health?.rates?.fetchedAt || health?.rates?.checkedAt,
      tone: rateFreshnessTone(rate?.fetchedAt || health?.rates?.fetchedAt || health?.rates?.checkedAt),
    },
    {
      title: "Support",
      value: s(health?.support?.status || "unknown"),
      time: health?.support?.checkedAt,
      tone: statusTone(health?.support?.status),
    },
  ];

  const q = search.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    const rows = metrics.productProblemRows;
    if (!q) return rows.slice(0, 100);

    return rows
      .filter((x) => productLabel(x.row).toLowerCase().includes(q))
      .slice(0, 100);
  }, [metrics.productProblemRows, q]);

  const filteredOrders = useMemo(() => {
    const rows = metrics.orderProblemRows;
    if (!q) return rows.slice(0, 100);

    return rows
      .filter((x) => orderLabel(x.row).toLowerCase().includes(q))
      .slice(0, 100);
  }, [metrics.orderProblemRows, q]);

  const filteredShipping = useMemo(() => {
    const rows = metrics.shippingProblemRows;
    if (!q) return rows.slice(0, 100);

    return rows
      .filter((x) => orderLabel(x.row).toLowerCase().includes(q))
      .slice(0, 100);
  }, [metrics.shippingProblemRows, q]);

  const filteredRefunds = useMemo(() => {
    const rows = metrics.refundProblemRows;
    if (!q) return rows.slice(0, 100);

    return rows
      .filter((x) => refundLabel(x.row).toLowerCase().includes(q))
      .slice(0, 100);
  }, [metrics.refundProblemRows, q]);

  const filteredLogs = useMemo(() => {
    const rows = metrics.visibleLogs;
    if (!q) return rows.slice(0, 30);

    return rows
      .filter((x) =>
        [x.source, x.code, x.message, x.level, x.id]
          .map(s)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 30);
  }, [metrics.visibleLogs, q]);

  const filteredSupport = useMemo(() => {
    const rows = threads;
    if (!q) return rows.slice(0, 30);

    return rows.filter((x) => threadLabel(x).toLowerCase().includes(q)).slice(0, 30);
  }, [threads, q]);

  const tabs = [
    { key: "overview", label: "Genel Bakış", count: metrics.criticalScore },
    { key: "products", label: "Ürün", count: metrics.productProblemCount },
    { key: "orders", label: "Sipariş", count: metrics.orderProblemCount },
    { key: "shipping", label: "Kargo", count: metrics.shippingProblemCount },
    { key: "refunds", label: "İade", count: metrics.refundProblemCount },
    { key: "rates", label: "Rates", count: metrics.rateProblem ? 1 : 0 },
    { key: "support", label: "Destek", count: metrics.unreadSupport },
    { key: "logs", label: "Log", count: metrics.openLogs },
  ] as const;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.kicker}>Admin • Sistem İzleme</div>
          <h1 className={styles.title}>Operasyon Kontrol Merkezi</h1>
          <p className={styles.sub}>
            Sipariş, kargo, iade, ürün, rates, destek ve sistem loglarını tek ekrandan izle.
          </p>

          <div className={`${styles.healthPill} ${styles[`tone_${metrics.healthTone}`]}`}>
            Sistem Skoru: {metrics.criticalScore}
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/refunds" className={styles.ghostBtn}>
            İade Merkezi
          </Link>
          <Link href="/admin/support" className={styles.ghostBtn}>
            Destek Paneli
          </Link>
          <Link href="/admin/orders" className={styles.ghostBtn}>
            Siparişler
          </Link>
          <Link href="/admin" className={styles.primaryBtn}>
            Admin Anasayfa
          </Link>
        </div>
      </section>

      <section className={styles.metricsGrid}>
        <MetricCard label="Kritik Skor" value={metrics.criticalScore} warn={metrics.criticalScore > 0} />
       <MetricCard label="Kritik Log" value={metrics.criticalLogs} warn={metrics.criticalLogs > 0} />
<MetricCard label="Error Log" value={metrics.errorLogs} warn={metrics.errorLogs > 0} />
<MetricCard label="Sipariş Sorunu" value={metrics.orderProblemCount} warn={metrics.orderProblemCount > 0} />
<MetricCard label="Kargo Sorunu" value={metrics.shippingProblemCount} warn={metrics.shippingProblemCount > 0} />
<MetricCard label="İade Sorunu" value={metrics.refundProblemCount} warn={metrics.refundProblemCount > 0} />
<MetricCard label="Ürün Sorunu" value={metrics.productProblemCount} warn={metrics.productProblemCount > 0} />
        <MetricCard label="Okunmamış Destek" value={metrics.unreadSupport} warn={metrics.unreadSupport > 0} />
      </section>

      <section className={styles.healthGrid}>
        {healthCards.map((card) => (
          <div key={card.title} className={styles.healthCard}>
            <div className={styles.healthTop}>
              <span className={styles.healthTitle}>{card.title}</span>
              <span className={`${styles.healthPill} ${styles[`tone_${card.tone}`]}`}>
                {card.value || "unknown"}
              </span>
            </div>
            <div className={styles.healthTime}>{timeAgo(card.time)}</div>
            <div className={styles.healthDate}>{fmtDate(card.time)}</div>
          </div>
        ))}
      </section>

      <section className={styles.singleCenterGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h3 className={styles.panelTitle}>Canlı Sorun Merkezi</h3>
              <p className={styles.panelSub}>
                En ince veri bozukluğunu yakala: sipariş, kargo, iade, ürün, rates, destek ve log.
              </p>
            </div>
          </div>

          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara: sipariş id / sku / müşteri / refund id / log kodu / destek"
            />
          </div>

          <div className={styles.mainTabBar}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.mainTabBtn} ${centerTab === tab.key ? styles.mainTabBtnActive : ""}`}
                onClick={() => setCenterTab(tab.key)}
              >
                <span>{tab.label}</span>
                <b>{tab.count}</b>
              </button>
            ))}
          </div>

          {centerTab === "overview" ? (
            <div className={styles.centerTabContent}>
              <div className={styles.sectionMiniHead}>
                <h3 className={styles.panelTitle}>Genel Bakış</h3>
                <p className={styles.panelSub}>En riskli başlıkları hızlıca gör.</p>
              </div>

              <div className={styles.sideStats}>
                <OverviewStat title="Rates" value={metrics.rateProblem ? "Sorunlu" : "Sağlıklı"} tone={metrics.rateProblem ? "bad" : "ok"} />
                <OverviewStat title="Sipariş Sorunu" value={metrics.orderProblemCount} tone={metrics.orderProblemCount ? "bad" : "ok"} />
                <OverviewStat title="Kargo Sorunu" value={metrics.shippingProblemCount} tone={metrics.shippingProblemCount ? "bad" : "ok"} />
                <OverviewStat title="İade Sorunu" value={metrics.refundProblemCount} tone={metrics.refundProblemCount ? "bad" : "ok"} />
                <OverviewStat title="Ürün Sorunu" value={metrics.productProblemCount} tone={metrics.productProblemCount ? "warn" : "ok"} />
                <OverviewStat title="Destek" value={`${metrics.unreadSupport} okunmamış`} tone={metrics.unreadSupport ? "warn" : "ok"} />
              </div>
            </div>
          ) : null}

          {centerTab === "products" ? (
            <ProblemList
              title="Ürün Sorunları"
              empty="Ürünlerde sorun görünmüyor."
              rows={filteredProducts.map((x) => ({
                id: x.row.id,
                title: pickTitle(x.row),
                meta: `SKU: ${s(x.row.sku || "-")} • Slug: ${s(x.row.slug || "-")} • ID: ${x.row.id}`,
                issues: x.issues,
                href: "/admin/products",
                side: `₺ ${pickPrice(x.row)} • Stok: ${n(x.row.stock, 0)}`,
              }))}
            />
          ) : null}

          {centerTab === "orders" ? (
            <ProblemList
              title="Sipariş Sorunları"
              empty="Siparişlerde sorun görünmüyor."
              rows={filteredOrders.map((x) => ({
                id: x.row.id,
                title: `Sipariş ${x.row.id}`,
                meta: `${s(x.row.email || x.row.uid || "-")} • Status: ${s(x.row.status || "-")} • Payment: ${s(x.row.paymentStatus || "-")}`,
                issues: x.issues,
                href: `/admin/orders/${encodeURIComponent(x.row.id)}`,
                side: `₺ ${moneyAmount(x.row.total)} • ${fmtDate(x.row.createdAt)}`,
              }))}
            />
          ) : null}

          {centerTab === "shipping" ? (
            <ProblemList
              title="Kargo Sorunları"
              empty="Kargo tarafında sorun görünmüyor."
              rows={filteredShipping.map((x) => ({
                id: x.row.id,
                title: `Kargo / Sipariş ${x.row.id}`,
                meta: `Provider: ${s(x.row.shippingProvider || "-")} • Status: ${s(x.row.shippingStatus || "-")} • Track: ${s(x.row.trackingNumber || "-")}`,
                issues: x.issues,
                href: `/admin/orders/${encodeURIComponent(x.row.id)}`,
                side: `Shipment: ${s(x.row.shipmentId || "-")}`,
              }))}
            />
          ) : null}

          {centerTab === "refunds" ? (
            <ProblemList
              title="İade Sorunları"
              empty="İade tarafında sorun görünmüyor."
              rows={filteredRefunds.map((x) => ({
                id: x.row.id,
                title: `İade ${x.row.id}`,
                meta: `Order: ${s(x.row.orderDocId || x.row.orderId || "-")} • Status: ${s(x.row.status || "-")} • OID: ${s(x.row.merchantOid || "-")}`,
                issues: x.issues,
                href: "/admin/refunds",
                side: `₺ ${moneyAmount(x.row.amountTry)} • ${fmtDate(x.row.createdAt)}`,
              }))}
            />
          ) : null}

          {centerTab === "rates" ? (
            <div className={styles.centerTabContent}>
              <div className={styles.sectionMiniHead}>
                <h3 className={styles.panelTitle}>Rates Sağlığı</h3>
                <p className={styles.panelSub}>Canlı kur verisinin tazeliği ve provider durumu.</p>
              </div>

              <div className={styles.sideStats}>
                <OverviewStat title="Provider" value={s(rate?.provider || "-")} tone="neutral" />
                <OverviewStat title="Son Güncelleme" value={fmtDate(rate?.fetchedAt)} tone={rateFreshnessTone(rate?.fetchedAt)} />
                <OverviewStat title="Kaç Veri" value={n(rate?.count, 0)} tone={n(rate?.count, 0) > 0 ? "ok" : "bad"} />
                <OverviewStat title="Ne kadar önce" value={timeAgo(rate?.fetchedAt)} tone={rateFreshnessTone(rate?.fetchedAt)} />
              </div>
            </div>
          ) : null}

          {centerTab === "support" ? (
            <div className={styles.centerTabContent}>
              <div className={styles.sectionMiniHead}>
                <h3 className={styles.panelTitle}>Destek Thread’leri</h3>
                <p className={styles.panelSub}>Müşteri iletişim akışı.</p>
              </div>

              <div className={styles.threadList}>
                {filteredSupport.length === 0 ? (
                  <div className={styles.empty}>Support thread görünmüyor.</div>
                ) : (
                  filteredSupport.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/support/${encodeURIComponent(t.id)}`}
                      className={styles.threadItem}
                    >
                      <div className={styles.threadTop}>
                        <strong>{s(t.name || "İsimsiz")}</strong>
                        <span
                          className={`${styles.healthPill} ${
                            styles[`tone_${s(t.status || "open") === "closed" ? "neutral" : "ok"}`]
                          }`}
                        >
                          {s(t.status || "open") === "closed" ? "kapalı" : "açık"}
                        </span>
                      </div>
                      <div className={styles.threadMeta}>
                        {s(t.phone || "-")} • {s(t.email || "-")} • Okunmamış: {n(t.unreadByAdmin, 0)}
                      </div>
                      <div className={styles.threadPreview}>
                        {s(t.lastText || "Önizleme yok")}
                      </div>
                      <div className={styles.threadTime}>
                        {fmtDate(t.lastMessageAt || t.updatedAt || t.createdAt)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {centerTab === "logs" ? (
            <div className={styles.centerTabContent}>
              <div className={styles.sectionMiniHead}>
                <h3 className={styles.panelTitle}>Kritik Loglar</h3>
                <p className={styles.panelSub}>Warn / error / critical kayıtları.</p>
              </div>

              <LogList logs={filteredLogs} />
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h3 className={styles.panelTitle}>Acil Müdahale</h3>
              <p className={styles.panelSub}>En sıcak sinyaller.</p>
            </div>
          </div>

          <div className={styles.logList}>
            {metrics.visibleLogs.slice(0, 8).length === 0 &&
            metrics.refundProblemRows.slice(0, 4).length === 0 &&
            metrics.shippingProblemRows.slice(0, 4).length === 0 ? (
              <div className={styles.empty}>Şu an acil sinyal yok.</div>
            ) : (
              <>
                {metrics.visibleLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className={styles.logItem}>
                    <div className={styles.logTop}>
                      <span className={`${styles.logLevel} ${styles[`level_${levelTone(log.level)}`]}`}>
                        {s(log.level || "info")}
                      </span>
                      <span className={styles.logSource}>{s(log.source || "system")}</span>
                      <span className={styles.logTime}>{fmtDate(log.createdAt)}</span>
                    </div>
                    <div className={styles.logMessage}>{s(log.message || log.code || "Mesaj yok")}</div>
                    <div className={styles.logCode}>{s(log.code || "-")}</div>
                  </div>
                ))}

                {metrics.refundProblemRows.slice(0, 3).map((x) => (
                  <div key={`refund-${x.row.id}`} className={styles.logItem}>
                    <div className={styles.logTop}>
                      <span className={`${styles.logLevel} ${styles.level_warn}`}>refund</span>
                      <span className={styles.logSource}>{x.row.id}</span>
                    </div>
                    <div className={styles.logMessage}>{x.issues.join(" • ")}</div>
                    <Link href="/admin/refunds" className={styles.rowLink}>İadeye git</Link>
                  </div>
                ))}

                {metrics.shippingProblemRows.slice(0, 3).map((x) => (
                  <div key={`ship-${x.row.id}`} className={styles.logItem}>
                    <div className={styles.logTop}>
                      <span className={`${styles.logLevel} ${styles.level_error}`}>shipping</span>
                      <span className={styles.logSource}>{x.row.id}</span>
                    </div>
                    <div className={styles.logMessage}>{x.issues.join(" • ")}</div>
                    <Link href={`/admin/orders/${encodeURIComponent(x.row.id)}`} className={styles.rowLink}>Siparişe git</Link>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {loading ? <div className={styles.loading}>Yükleniyor…</div> : null}
    </main>
  );
}

function MetricCard({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={`${styles.metricCard} ${warn && value > 0 ? styles.metricWarn : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  );
}

function OverviewStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={styles.sideStat}>
      <span>{title}</span>
      <b className={`${styles.healthPill} ${styles[`tone_${tone}`]}`}>{value}</b>
    </div>
  );
}

function ProblemList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    title: string;
    meta: string;
    issues: string[];
    href: string;
    side?: string;
  }>;
}) {
  return (
    <div className={styles.centerTabContent}>
      <div className={styles.sectionMiniHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        <p className={styles.panelSub}>Sorunlar önceliklendirilmiş şekilde listelenir.</p>
      </div>

      <div className={styles.auditList}>
        {rows.length === 0 ? (
          <div className={styles.empty}>{empty}</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className={styles.auditItem}>
              <div className={styles.auditMain}>
                <div className={styles.auditTitle}>{row.title}</div>
                <div className={styles.auditMeta}>{row.meta}</div>

                <div className={styles.issueBadges}>
                  {row.issues.map((issue, i) => (
                    <span key={`${row.id}-${issue}-${i}`} className={styles.issueBadge}>
                      {issue}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.auditSide}>
                {row.side ? <div className={styles.auditSub}>{row.side}</div> : null}

                <Link href={row.href} className={styles.rowLink}>
                  Aç
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LogList({ logs }: { logs: LogRow[] }) {
  return (
    <div className={styles.logList}>
      {logs.length === 0 ? (
        <div className={styles.empty}>Kritik log görünmüyor.</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className={styles.logItem}>
            <div className={styles.logTop}>
              <span className={`${styles.logLevel} ${styles[`level_${levelTone(log.level)}`]}`}>
                {s(log.level || "info")}
              </span>
              <span className={styles.logSource}>{s(log.source || "system")}</span>
              <span className={styles.logTime}>{fmtDate(log.createdAt)}</span>
            </div>

            <div className={styles.logMessage}>{s(log.message || log.code || "Mesaj yok")}</div>
            <div className={styles.logCode}>{s(log.code || "-")}</div>
          </div>
        ))
      )}
    </div>
  );
}