"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "@/components/admin/app/(admin)/adminDashboard.module.css";
import AdminAnalyticsPanel from "@/components/admin/AdminAnalyticsPanel";

type RateLatest = {
  provider?: string;
  fetchedAt?: any;
  count?: number;
  items?: any[];
};

type ProductDoc = {
  isActive?: boolean;
  active?: boolean;
  stock?: number;
  sku?: string;
  title?: { tr?: string; en?: string } | string;
  name?: string;
  priceTry?: number;
  updatedAt?: any;
  createdAt?: any;
};

type OrderDoc = {
  status?: string;
  totalTry?: number;
  total?: { amount?: number };
  createdAt?: any;
  createdAtIso?: string;
  email?: string;
  shippingAddress?: {
    fullName?: string;
    city?: string;
    district?: string;
  };
};

type ReviewDoc = {
  approved?: boolean;
  rating?: number;
  createdAt?: any;
};

type StockAlertDoc = {
  status?: string;
  createdAt?: any;
};

type SupportThreadDoc = {
  status?: string;
  unreadByAdmin?: number;
  lastText?: string;
  lastMessageAt?: any;
  userName?: string;
  userEmail?: string;
};

type VisitorDoc = {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  page?: string;
  locale?: string;
  screenWidth?: number;
  lastSeen?: any;
  online?: boolean;
  deviceType?: string;
  browser?: string;
  os?: string;
};

type AppointmentDoc = {
  fullName?: string;
  appointmentDate?: string;
  timeSlot?: string;
  meetingType?: string;
  interest?: string;
  status?: string;
  createdAt?: any;
};

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (x instanceof Timestamp) return x.toDate();
  if (typeof x?.toDate === "function") return x.toDate();
  if (typeof x === "string") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTRY(n: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${Number(n || 0).toFixed(2)} ₺`;
  }
}

function fmtCompact(n: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return String(n);
  }
}

function fmtDate(dt: Date | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

function pickTitle(p: ProductDoc) {
  const t = p?.title;
  if (typeof t === "string") return t.trim() || "Ürün";
  if (t && typeof t === "object") return (t.tr || t.en || p.name || "Ürün").trim();
  return (p.name || "Ürün").trim();
}

function normStatus(st: any) {
  return String(st || "").trim().toLowerCase();
}

function statusTR(st: string) {
  const map: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim",
    cancelled: "İptal",
    refunded: "İade",
  };
  return map[st] || st || "—";
}

function isOpenOrderStatus(st: string) {
  return !["delivered", "cancelled", "refunded"].includes(st);
}

function minutesAgo(dt: Date | null) {
  if (!dt) return null;
  const diff = Date.now() - dt.getTime();
  return Math.max(0, Math.round(diff / 60000));
}

function customerName(o: OrderDoc) {
  return o?.shippingAddress?.fullName || o?.email || "Müşteri";
}

function customerCity(o: OrderDoc) {
  const district = o?.shippingAddress?.district || "";
  const city = o?.shippingAddress?.city || "";
  return [district, city].filter(Boolean).join(" / ") || "—";
}

export default function AdminHomePage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [loading, setLoading] = useState(true);

  const [productCount, setProductCount] = useState(0);
  const [activeProductCount, setActiveProductCount] = useState(0);
  const [inactiveProductCount, setInactiveProductCount] = useState(0);
  const [stockTotal, setStockTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [avgStock, setAvgStock] = useState(0);

  const [orderCount, setOrderCount] = useState(0);
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [todayRevenueTry, setTodayRevenueTry] = useState(0);
  const [weekRevenueTry, setWeekRevenueTry] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);

  const [rates, setRates] = useState<RateLatest | null>(null);

  const [_reviewCount, setReviewCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [supportOpenCount, setSupportOpenCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);

  const [latestProducts, setLatestProducts] = useState<Array<{ id: string } & ProductDoc>>([]);
  const [latestOrders, setLatestOrders] = useState<Array<{ id: string } & OrderDoc>>([]);
  const [criticalProducts, setCriticalProducts] = useState<Array<{ id: string } & ProductDoc>>([]);
  const [latestThreads, setLatestThreads] = useState<Array<{ id: string } & SupportThreadDoc>>([]);
  const [visitors, setVisitors] = useState<Array<{ id: string } & VisitorDoc>>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string } & AppointmentDoc>>([]);
  const [tab, setTab] = useState<"overview" | "sales" | "catalog" | "operations" | "analytics">("overview");

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    setLoading(true);

    unsubs.push(
      onSnapshot(
        collection(db, "products"),
        (snap) => {
          let total = 0;
          let active = 0;
          let inactive = 0;
          let stockSum = 0;
          let low = 0;
          let out = 0;

          const crit: Array<{ id: string } & ProductDoc> = [];

          snap.forEach((d) => {
            total++;
            const p = d.data() as ProductDoc;
            const isActive = p?.isActive !== false && p?.active !== false;

            if (isActive) active++;
            else inactive++;

            const st = Math.max(0, Math.floor(safeNum(p?.stock, 0)));
            stockSum += st;

            if (isActive && st <= 3) low++;
            if (isActive && st <= 0) out++;

            if (isActive && st <= 3) crit.push({ id: d.id, ...p });
          });

          crit.sort((a, b) => safeNum(a.stock, 0) - safeNum(b.stock, 0));

          setProductCount(total);
          setActiveProductCount(active);
          setInactiveProductCount(inactive);
          setStockTotal(stockSum);
          setLowStockCount(low);
          setOutOfStockCount(out);
          setAvgStock(active > 0 ? Math.round(stockSum / active) : 0);
          setCriticalProducts(crit.slice(0, 6));
          setLoading(false);
        },
        () => setLoading(false)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(6)),
        (snap) => {
          const arr: Array<{ id: string } & ProductDoc> = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as ProductDoc) }));
          setLatestProducts(arr);
        }
      )
    );

    unsubs.push(
      onSnapshot(collection(db, "orders"), (snap) => {
        let total = 0;
        let open = 0;
        let todayCount = 0;
        let todayRev = 0;
        let weekRev = 0;
        let pendingPayment = 0;

        const today = startOfToday().getTime();
        const week = startOfWeek().getTime();

        snap.forEach((d) => {
          total++;
          const o = d.data() as OrderDoc;
          const st = normStatus(o?.status);

          if (isOpenOrderStatus(st)) open++;
          if (st === "pending_payment") pendingPayment++;

          const created = toDate(o?.createdAt) || toDate(o?.createdAtIso);
          const totalTry = safeNum(o?.totalTry, 0) || safeNum(o?.total?.amount, 0);

          if (created && created.getTime() >= today) {
            todayCount++;
            todayRev += totalTry;
          }

          if (created && created.getTime() >= week) {
            weekRev += totalTry;
          }
        });

        setOrderCount(total);
        setOpenOrderCount(open);
        setTodayOrderCount(todayCount);
        setTodayRevenueTry(todayRev);
        setWeekRevenueTry(weekRev);
        setPendingPaymentCount(pendingPayment);
      })
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(6)),
        (snap) => {
          const arr: Array<{ id: string } & OrderDoc> = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as OrderDoc) }));
          setLatestOrders(arr);
        }
      )
    );

    unsubs.push(
      onSnapshot(doc(db, "rates", "latest"), (snap) => {
        setRates(snap.exists() ? (snap.data() as RateLatest) : null);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, "product_reviews"), (snap) => {
        let total = 0;
        let pending = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        snap.forEach((d) => {
          total++;
          const r = d.data() as ReviewDoc;
          if (r.approved !== true) pending++;

          const rating = safeNum(r.rating, 0);
          if (rating > 0) {
            ratingSum += rating;
            ratingCount++;
          }
        });

        setReviewCount(total);
        setPendingReviewCount(pending);
        setAvgRating(ratingCount ? Number((ratingSum / ratingCount).toFixed(1)) : 0);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, "stock_alerts"), (snap) => {
        let activeAlerts = 0;
        snap.forEach((d) => {
          const x = d.data() as StockAlertDoc;
          if (String(x?.status || "active") === "active") activeAlerts++;
        });
        setStockAlertCount(activeAlerts);
      })
    );

    unsubs.push(
      onSnapshot(collection(db, "support_threads"), (snap) => {
        let open = 0;
        let unread = 0;
        snap.forEach((d) => {
          const x: any = d.data() || {};
          if (String(x?.status || "open") !== "closed") open++;
          unread += safeNum(x?.unreadByAdmin, 0);
        });
        setSupportOpenCount(open);
        setSupportUnreadCount(unread);
      })
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "support_threads"), orderBy("lastMessageAt", "desc"), limit(5)),
        (snap) => {
          const arr: Array<{ id: string } & SupportThreadDoc> = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as SupportThreadDoc) }));
          setLatestThreads(arr);
        }
      )
    );

    // Aktif ziyaretçiler — son 3 dakika içinde heartbeat gönderenler
    unsubs.push(
      onSnapshot(
        query(collection(db, "site_visitors"), orderBy("lastSeen", "desc"), limit(50)),
        (snap) => {
          const cutoff = Date.now() - 45 * 1000;
          const arr: Array<{ id: string } & VisitorDoc> = [];
          snap.forEach((d) => {
            const v = d.data() as VisitorDoc;
            const lastSeen = toDate(v?.lastSeen);
            if (v.online !== false && lastSeen && lastSeen.getTime() >= cutoff) {
              arr.push({ id: d.id, ...v });
            }
          });
          setVisitors(arr);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "appointments"), orderBy("createdAt", "desc"), limit(50)),
        (snap) => {
          const arr: Array<{ id: string } & AppointmentDoc> = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as AppointmentDoc) }));
          setAppointments(arr);
        },
        () => setAppointments([])
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [db]);

  const fetchedAtDate = toDate(rates?.fetchedAt);
  const fetchedAtText = fmtDate(fetchedAtDate);
  const agoMin = minutesAgo(fetchedAtDate);

  const rateTone: "ok" | "warn" | "bad" =
    agoMin == null ? "bad" : agoMin <= 10 ? "ok" : agoMin <= 60 ? "warn" : "bad";

  const healthScore = useMemo(() => {
    // Operasyon Sağlığı — sadece operasyonel metrikleri ölç.
    // Ürün açıklama/resim/stok eksikleri katalog sorunu, operasyon değil.
    let score = 100;

    // Kur güncelliği (en kritik): 60dk+ eskiyse -20
    if ((agoMin ?? 9999) > 60) score -= 20;

    // Ödeme bekleyen siparişler: 3'ten fazlaysa -5, 10'dan fazlaysa -15
    if (pendingPaymentCount > 10) score -= 15;
    else if (pendingPaymentCount > 3) score -= 5;

    // Destek okunmamış mesajlar: 3'ten fazlaysa -5, 10'dan fazlaysa -15
    if (supportUnreadCount > 10) score -= 15;
    else if (supportUnreadCount > 3) score -= 5;

    // Açık destek thread sayısı: 15'ten fazlaysa -10
    if (supportOpenCount > 15) score -= 10;

    // Onay bekleyen yorum: 5'ten fazlaysa -5, 15'ten fazlaysa -10
    if (pendingReviewCount > 15) score -= 10;
    else if (pendingReviewCount > 5) score -= 5;

    // Stok alert (aktif bildirim talepleri): varsa -5
    if (stockAlertCount > 0) score -= 5;

    // Tükenen AKTİF ürünler: sadece hafif uyarı, -5 max
    if (outOfStockCount > 5) score -= 5;

    return Math.max(0, Math.min(100, score));
  }, [agoMin, pendingPaymentCount, supportUnreadCount, supportOpenCount, pendingReviewCount, stockAlertCount, outOfStockCount]);

  const orderStatusStats = useMemo(() => {
    const buckets = [
      { key: "pending_payment", label: "Ödeme Bekliyor", value: 0 },
      { key: "paid", label: "Ödendi", value: 0 },
      { key: "preparing", label: "Hazırlanıyor", value: 0 },
      { key: "shipped", label: "Kargoda", value: 0 },
      { key: "delivered", label: "Teslim", value: 0 },
      { key: "cancelled", label: "İptal", value: 0 },
    ];

    latestOrders.forEach((o) => {
      const st = normStatus(o.status);
      const found = buckets.find((x) => x.key === st);
      if (found) found.value += 1;
    });

    const max = Math.max(1, ...buckets.map((x) => x.value));
    return buckets.map((x) => ({
      ...x,
      percent: Math.max(8, Math.round((x.value / max) * 100)),
    }));
  }, [latestOrders]);

  const stockHealthBars = useMemo(() => {
    const totalBase = Math.max(1, activeProductCount);
    return [
      {
        label: "Sağlıklı stok",
        value: Math.max(0, activeProductCount - lowStockCount),
        percent: Math.round((Math.max(0, activeProductCount - lowStockCount) / totalBase) * 100),
        tone: "ok",
      },
      {
        label: "Düşük stok",
        value: lowStockCount,
        percent: Math.round((lowStockCount / totalBase) * 100),
        tone: "warn",
      },
      {
        label: "Tükenen",
        value: outOfStockCount,
        percent: Math.round((outOfStockCount / totalBase) * 100),
        tone: "bad",
      },
    ];
  }, [activeProductCount, lowStockCount, outOfStockCount]);

  const revenueCompare = useMemo(() => {
    const day = todayRevenueTry;
    const week = weekRevenueTry;
    const max = Math.max(1, day, week);

    return {
      day,
      week,
      dayPct: Math.max(8, Math.round((day / max) * 100)),
      weekPct: Math.max(8, Math.round((week / max) * 100)),
    };
  }, [todayRevenueTry, weekRevenueTry]);

  const supportHealth = useMemo(() => {
    return [
      {
        label: "Açık thread",
        value: supportOpenCount,
        tone: supportOpenCount > 10 ? "warn" : "ok",
      },
      {
        label: "Okunmamış mesaj",
        value: supportUnreadCount,
        tone: supportUnreadCount > 5 ? "warn" : "ok",
      },
      {
        label: "Onay bekleyen yorum",
        value: pendingReviewCount,
        tone: pendingReviewCount > 5 ? "warn" : "ok",
      },
      {
        label: "Aktif stock alert",
        value: stockAlertCount,
        tone: stockAlertCount > 0 ? "bad" : "ok",
      },
    ];
  }, [supportOpenCount, supportUnreadCount, pendingReviewCount, stockAlertCount]);

  const healthTone = healthScore >= 85 ? "ok" : healthScore >= 60 ? "warn" : "bad";
  const newAppointmentCount = appointments.filter((x) => normStatus(x.status) === "new").length;
  const confirmedAppointmentCount = appointments.filter((x) => normStatus(x.status) === "confirmed").length;
  const todayAppointmentCount = appointments.filter((x) => {
    const created = toDate(x.createdAt);
    return !!created && created.getTime() >= startOfToday().getTime();
  }).length;

  return (
    <main className={s.page}>
      <div className={s.bgGlowA} />
      <div className={s.bgGlowB} />

      <header className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.eyebrow}>ULTIMATE CONTROL PANEL</div>
          <h1 className={s.heroTitle}>Admin Dashboard</h1>
          <p className={s.heroText}>
            Operasyon, stok, sipariş, kur, yorum ve destek akışını tek ekranda izle.
            Burası artık panel değil, tam anlamıyla kontrol kulesi.
          </p>

          <div className={s.heroActions}>
            <Link className={s.primaryBtn} href="/admin/products">Ürünler</Link>
            <Link className={s.softBtn} href="/admin/orders">Siparişler</Link>
            <Link className={s.softBtn} href="/admin/stock">Stok</Link>
            <Link className={s.softBtn} href="/admin/rates-provider">Kurlar</Link>
            <Link className={s.softBtn} href="/admin/support">Destek</Link>
            <Link className={s.softBtn} href="/admin/appointments">Randevular</Link>
          </div>
        </div>

        <div className={s.heroRight}>
          <div
            className={`${s.healthCard} ${
              healthTone === "ok" ? s.healthOk : healthTone === "warn" ? s.healthWarn : s.healthBad
            }`}
          >
            <div className={s.healthLabel}>Operasyon Sağlığı</div>
            <div className={s.healthValue}>{healthScore}</div>
            <div className={s.healthSub}>100 üzerinden canlı skor</div>
          </div>

          <div className={s.quickGrid}>
            <MiniStat label="Kur Satırı" value={String(safeNum(rates?.count, 0))} />
            <MiniStat label="Açık Destek" value={String(supportOpenCount)} />
            <MiniStat label="Yorum Bekliyor" value={String(pendingReviewCount)} />
            <MiniStat label="Aktif Alert" value={String(stockAlertCount)} />
            <MiniStat label="Yeni Randevu" value={String(newAppointmentCount)} />
          </div>
        </div>
      </header>

      <section className={s.kpiGrid}>
        <KpiCard title="Toplam Ürün" value={loading ? "—" : fmtCompact(productCount)} sub={`Aktif: ${activeProductCount} • Pasif: ${inactiveProductCount}`} tone="blue" />
        <KpiCard title="Toplam Stok" value={loading ? "—" : fmtCompact(stockTotal)} sub={`Ort. stok: ${avgStock}`} tone="emerald" />
        <KpiCard title="Kritik Stok" value={String(lowStockCount)} sub={`Tükenen: ${outOfStockCount}`} tone="amber" />
        <KpiCard title="Toplam Sipariş" value={fmtCompact(orderCount)} sub={`Açık: ${openOrderCount}`} tone="violet" />
        <KpiCard title="Bugün Sipariş" value={String(todayOrderCount)} sub={`Ciro: ${fmtTRY(todayRevenueTry)}`} tone="pink" />
        <KpiCard title="Haftalık Ciro" value={fmtTRY(weekRevenueTry)} sub={`Bekleyen ödeme: ${pendingPaymentCount}`} tone="cyan" />
        <KpiCard title="Özel Randevular" value={String(appointments.length)} sub={`Yeni: ${newAppointmentCount} • Bugün: ${todayAppointmentCount}`} tone="amber" />
        <KpiCard title="Onaylı Randevu" value={String(confirmedAppointmentCount)} sub="Müşteri görüşmesi planlandı" tone="emerald" />
      </section>

      <section className={s.quickActionsBoard}>
        <QuickAction href="/admin/products/new" title="Yeni Ürün" text="Hızlı ürün ekle" />
        <QuickAction href="/admin/categories" title="Kategori Yönet" text="Kategori düzenle" />
        <QuickAction href="/admin/orders" title="Sipariş Aç" text="Yeni siparişleri kontrol et" />
        <QuickAction href="/admin/home-promos" title="Slider Güncelle" text="Vitrini tazele" />
        <QuickAction href="/admin/wheel/campaigns" title="Çark Kampanyası" text="Kampanya başlat" />
        <QuickAction href="/admin/support" title="Destek Cevapla" text="Mesajları temizle" />
        <QuickAction href="/admin/appointments" title="Randevuları Yönet" text={`${newAppointmentCount} yeni talebi kontrol et`} />
        <QuickAction href="/admin/settings" title="Mobil Uygulama" text="App Store kampanyasını yönet" />
      </section>

      <section className={s.strip}>
        <div className={s.stripItem}>
          <span className={s.stripLabel}>Kur Sağlığı</span>
          <span className={`${s.stripBadge} ${rateTone === "ok" ? s.badgeOk : rateTone === "warn" ? s.badgeWarn : s.badgeBad}`}>
            {agoMin == null ? "Unknown" : `${agoMin} dk`}
          </span>
        </div>

        <div className={s.stripItem}>
          <span className={s.stripLabel}>Provider</span>
          <span className={s.stripValue}>{rates?.provider || "—"}</span>
        </div>

        <div className={s.stripItem}>
          <span className={s.stripLabel}>Son Çekim</span>
          <span className={s.stripValue}>{fetchedAtText}</span>
        </div>

        <div className={s.stripItem}>
          <span className={s.stripLabel}>Realtime</span>
          <span className={s.stripValue}>Aktif</span>
        </div>

        <div className={s.stripItem}>
          <span className={s.stripLabel}>Support Unread</span>
          <span className={s.stripValue}>{supportUnreadCount}</span>
        </div>

        <div className={s.stripItem}>
          <span className={s.stripLabel}>Rating</span>
          <span className={s.stripValue}>{avgRating ? `${avgRating} / 5` : "—"}</span>
        </div>
      </section>

      <section className={s.tabBar}>
        <button type="button" className={`${s.tabBtn} ${tab === "overview" ? s.tabBtnActive : ""}`} onClick={() => setTab("overview")}>
          Genel Bakış
        </button>
        <button type="button" className={`${s.tabBtn} ${tab === "sales" ? s.tabBtnActive : ""}`} onClick={() => setTab("sales")}>
          Satış
        </button>
        <button type="button" className={`${s.tabBtn} ${tab === "catalog" ? s.tabBtnActive : ""}`} onClick={() => setTab("catalog")}>
          Katalog
        </button>
        <button type="button" className={`${s.tabBtn} ${tab === "operations" ? s.tabBtnActive : ""}`} onClick={() => setTab("operations")}>
          Operasyon
        </button>
        <button type="button" className={`${s.tabBtn} ${tab === "analytics" ? s.tabBtnActive : ""}`} onClick={() => setTab("analytics")}>
          📊 Analitik
        </button>
      </section>

      {tab === "overview" ? (
        <>
          <section className={s.grid2}>
            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>Gelir Karşılaştırma</div>
                  <div className={s.cardSub}>Bugün vs hafta toplamı</div>
                </div>
              </div>

              <div className={s.chartBars}>
                <div className={s.chartRow}>
                  <div className={s.chartMeta}>
                    <span>Bugün</span>
                    <b>{fmtTRY(revenueCompare.day)}</b>
                  </div>
                  <div className={s.chartTrack}>
                    <div className={`${s.chartFill} ${s.fillPink}`} style={{ width: `${revenueCompare.dayPct}%` }} />
                  </div>
                </div>

                <div className={s.chartRow}>
                  <div className={s.chartMeta}>
                    <span>Hafta</span>
                    <b>{fmtTRY(revenueCompare.week)}</b>
                  </div>
                  <div className={s.chartTrack}>
                    <div className={`${s.chartFill} ${s.fillCyan}`} style={{ width: `${revenueCompare.weekPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>Sipariş Durum Dağılımı</div>
                  <div className={s.cardSub}>Son sipariş akış resmi</div>
                </div>
              </div>

              <div className={s.statusBars}>
                {orderStatusStats.map((x) => (
                  <div className={s.statusRow} key={x.key}>
                    <div className={s.statusRowTop}>
                      <span>{x.label}</span>
                      <b>{x.value}</b>
                    </div>
                    <div className={s.statusTrack}>
                      <div className={s.statusFill} style={{ width: `${x.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={s.grid2}>
            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>Son Siparişler</div>
                  <div className={s.cardSub}>createdAt desc • 6 kayıt</div>
                </div>
                <Link className={s.ghostLink} href="/admin/orders">Hepsini gör →</Link>
              </div>

              <div className={s.table}>
                <div className={`${s.tr} ${s.th}`}>
                  <div>Müşteri</div>
                  <div>Durum</div>
                  <div>Şehir</div>
                  <div>Tutar</div>
                </div>

                {latestOrders.length === 0 ? (
                  <div className={s.empty}>Henüz sipariş yok.</div>
                ) : (
                  latestOrders.map((o) => {
                    const st = normStatus(o.status) || "draft";
                    const total = fmtTRY(safeNum(o.totalTry, 0) || safeNum(o.total?.amount, 0));
                    const badgeCls =
                      st === "cancelled" || st === "refunded"
                        ? s.badgeMuted
                        : st === "pending_payment"
                        ? s.badgeWarn
                        : st === "preparing" || st === "shipped"
                        ? s.badgeInfo
                        : s.badgeOk;

                    return (
                      <div className={s.tr} key={o.id}>
                        <div>
                          <div className={s.strong}>{customerName(o)}</div>
                          <div className={s.tableSub}>{fmtDate(toDate(o.createdAt) || toDate(o.createdAtIso))}</div>
                        </div>
                        <div className={badgeCls}>{statusTR(st)}</div>
                        <div className={s.mono}>{customerCity(o)}</div>
                        <div className={s.strong}>{total}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>Aktif Ziyaretçiler</div>
                  <div className={s.cardSub}>Son 3 dakika — canlı takip</div>
                </div>
                <div>
                  <span className={s.visitorLiveDot} />
                  <span className={s.visitorCountBig}>{visitors.length}</span>
                  <div className={s.visitorCountSub}>şu an sitede</div>
                </div>
              </div>

              {visitors.length === 0 ? (
                <div className={s.empty}>Şu an aktif ziyaretçi yok.</div>
              ) : (
                <div className={s.visitorList}>
                  {visitors.slice(0, 10).map((v) => {
                    const name = v.displayName || v.email || (v.isAnonymous !== false ? "Misafir" : "Kullanıcı");
                    const ago = minutesAgo(toDate(v.lastSeen));
                    const agoText = ago === 0 ? "Şimdi" : `${ago} dk önce`;

                    return (
                      <div key={v.id} className={s.visitorRow}>
                        <div>
                          <div className={s.visitorName}>
                            <span className={s.visitorLiveDot} />
                            {name}
                          </div>
                          {v.email ? <div className={s.visitorEmail}>{v.email}</div> : null}
                        </div>
                        <div className={s.visitorPage}>{v.page || "/"}</div>
                        <div className={s.visitorTime}>{agoText}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className={s.grid2}>
            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardTitle}>Kritik Operasyon Uyarıları</div>
                  <div className={s.cardSub}>İlk müdahale burada başlar</div>
                </div>
              </div>

              <div className={s.alertStack}>
                <AlertLine
                  tone={outOfStockCount > 0 ? "bad" : "ok"}
                  title="Tükenen ürün"
                  value={String(outOfStockCount)}
                  text={outOfStockCount > 0 ? "Vitrin ve kampanyaları kontrol et." : "Temiz."}
                />
                <AlertLine
                  tone={pendingPaymentCount > 0 ? "warn" : "ok"}
                  title="Ödeme bekleyen sipariş"
                  value={String(pendingPaymentCount)}
                  text={pendingPaymentCount > 0 ? "Ödeme akışına göz at." : "Temiz."}
                />
                <AlertLine
                  tone={pendingReviewCount > 0 ? "warn" : "ok"}
                  title="Onay bekleyen yorum"
                  value={String(pendingReviewCount)}
                  text={pendingReviewCount > 0 ? "Moderasyon kuyruğu var." : "Temiz."}
                />
                <AlertLine
                  tone={supportUnreadCount > 0 ? "warn" : "ok"}
                  title="Destek okunmamış"
                  value={String(supportUnreadCount)}
                  text={supportUnreadCount > 0 ? "Canlı sohbeti kontrol et." : "Temiz."}
                />
                <AlertLine
                  tone={newAppointmentCount > 0 ? "warn" : "ok"}
                  title="Yeni randevu talebi"
                  value={String(newAppointmentCount)}
                  text={newAppointmentCount > 0 ? "Müşteriye dönüş ve sonuç notu bekliyor." : "Temiz."}
                />
              </div>
            </div>
          </section>

          <section className={s.grid2}>
            <div className={s.card}>
              <div className={s.cardHead}><div><div className={s.cardTitle}>Son Özel Randevular</div><div className={s.cardSub}>Müşteri concierge akışı</div></div><Link className={s.ghostLink} href="/admin/appointments">Hepsini yönet →</Link></div>
              {appointments.length === 0 ? <div className={s.empty}>Henüz randevu talebi yok.</div> : <div className={s.feedList}>{appointments.slice(0, 6).map((a) => <div className={s.feedItem} key={a.id}><div className={s.feedMain}><div className={s.feedTitle}>{a.fullName || "Müşteri"}</div><div className={s.feedText}>{a.interest || "Özel özel ürün danışmanlığı"} • {a.appointmentDate || "—"} {a.timeSlot || ""}</div></div><div className={s.feedMeta}><span className={normStatus(a.status) === "new" ? s.badgeWarn : normStatus(a.status) === "cancelled" ? s.badgeBad : s.badgeOk}>{normStatus(a.status) === "new" ? "Yeni" : normStatus(a.status) === "confirmed" ? "Onaylı" : normStatus(a.status) === "completed" ? "Tamamlandı" : normStatus(a.status) === "cancelled" ? "İptal" : "İşlemde"}</span><span className={s.tableSub}>{fmtDate(toDate(a.createdAt))}</span></div></div>)}</div>}
            </div>
            <div className={s.card}>
              <div className={s.cardTitle}>Mobil Uygulama Kampanyası</div><div className={s.cardSub}>App Store indirme yüzeyleri</div>
              <div className={s.pulseGrid}><PulseBox label="İlk Giriş Reklamı" value="Aktif" /><PulseBox label="Sol Alt Balon" value="Aktif" /><PulseBox label="Anasayfa Vitrini" value="Aktif" /><PulseBox label="Tekrar Gösterim" value="7 Gün" /></div>
              <div className={s.noteBox}>Tüm uygulama indirme alanları Bizim Dromocob App Store sayfasına yönlendiriliyor.</div>
            </div>
          </section>
        </>
      ) : null}

      {tab === "sales" ? (
        <section className={s.grid2}>
          <div className={s.card}>
            <div className={s.cardTitle}>Satış KPI Özeti</div>
            <div className={s.pulseGrid}>
              <PulseBox label="Bugün Sipariş" value={String(todayOrderCount)} />
              <PulseBox label="Bugün Ciro" value={fmtTRY(todayRevenueTry)} />
              <PulseBox label="Haftalık Ciro" value={fmtTRY(weekRevenueTry)} />
              <PulseBox label="Bekleyen Ödeme" value={String(pendingPaymentCount)} />
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>Son Destek Hareketleri</div>
            {latestThreads.length === 0 ? (
              <div className={s.empty}>Henüz destek hareketi yok.</div>
            ) : (
              <div className={s.feedList}>
                {latestThreads.map((t) => (
                  <div key={t.id} className={s.feedItem}>
                    <div className={s.feedMain}>
                      <div className={s.feedTitle}>{t.userName || t.userEmail || "Kullanıcı"}</div>
                      <div className={s.feedText}>{t.lastText || "Son mesaj yok"}</div>
                    </div>
                    <div className={s.feedMeta}>
                      <span className={safeNum(t.unreadByAdmin, 0) > 0 ? s.badgeWarn : s.badgeOk}>
                        {safeNum(t.unreadByAdmin, 0)} unread
                      </span>
                      <span className={s.tableSub}>{fmtDate(toDate(t.lastMessageAt))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "catalog" ? (
        <section className={s.grid2}>
          <div className={s.card}>
            <div className={s.cardTitle}>Stok Sağlığı</div>
            <div className={s.statusBars}>
              {stockHealthBars.map((x) => (
                <div className={s.statusRow} key={x.label}>
                  <div className={s.statusRowTop}>
                    <span>{x.label}</span>
                    <b>{x.value}</b>
                  </div>
                  <div className={s.statusTrack}>
                    <div
                      className={`${s.statusFill} ${
                        x.tone === "ok" ? s.fillOk : x.tone === "warn" ? s.fillWarn : s.fillBad
                      }`}
                      style={{ width: `${Math.max(8, x.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Son Güncellenen Ürünler</div>
                <div className={s.cardSub}>updatedAt desc • 6 kayıt</div>
              </div>
              <Link className={s.ghostLink} href="/admin/products">Hepsini gör →</Link>
            </div>

            <div className={s.table}>
              <div className={`${s.tr} ${s.th}`}>
                <div>Ürün</div>
                <div>SKU</div>
                <div>Stok</div>
                <div>Durum</div>
              </div>

              {latestProducts.length === 0 ? (
                <div className={s.empty}>Henüz ürün yok.</div>
              ) : (
                latestProducts.map((p) => {
                  const title = pickTitle(p);
                  const stock = Math.max(0, Math.floor(safeNum(p.stock, 0)));
                  const active = p?.isActive !== false && p?.active !== false;

                  return (
                    <div className={s.tr} key={p.id}>
                      <div className={s.strong}>{title}</div>
                      <div className={s.mono}>{p.sku || "—"}</div>
                      <div className={stock <= 3 ? (stock === 0 ? s.badgeBad : s.badgeWarn) : s.badgeOk}>
                        {stock}
                      </div>
                      <div className={active ? s.badgeOk : s.badgeMuted}>{active ? "aktif" : "pasif"}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "operations" ? (
        <section className={s.grid2}>
          <div className={s.card}>
            <div className={s.cardTitle}>Destek & Moderasyon</div>
            <div className={s.pulseGrid}>
              {supportHealth.map((x) => (
                <div className={s.pulseBox} key={x.label}>
                  <div className={s.pulseLabel}>{x.label}</div>
                  <div className={s.pulseValue}>{x.value}</div>
                </div>
              ))}
            </div>

            <div className={s.noteBox}>
              <div className={s.noteTitle}>Operasyon Yorumu</div>
              <div className={s.noteText}>
                Destek unread yükselirse cevap SLA düşer. Pending review arttığında ürün güveni etkilenir.
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>Kritik Stok Listesi</div>

            {criticalProducts.length === 0 ? (
              <div className={s.empty}>Kritik stok yok. Mis gibi.</div>
            ) : (
              <div className={s.alertList}>
                {criticalProducts.map((p) => {
                  const st = Math.max(0, Math.floor(safeNum(p.stock, 0)));
                  const active = p?.isActive !== false && p?.active !== false;

                  return (
                    <div key={p.id} className={s.alertRow}>
                      <div className={s.alertLeft}>
                        <div className={s.alertTitle}>{pickTitle(p)}</div>
                        <div className={s.alertMeta}>
                          <span className={s.mono}>SKU: {p.sku || "—"}</span>
                          <span className={active ? s.badgeOk : s.badgeMuted}>
                            {active ? "aktif" : "pasif"}
                          </span>
                        </div>
                      </div>
                      <div className={st === 0 ? s.badgeBad : s.badgeWarn}>{st}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className={s.quickLinksSection}>
        <div className={s.quickCard}>
          <div className={s.quickTitle}>Katalog</div>
          <div className={s.quickText}>Ürün, kategori, stok ve vitrin akışı.</div>
          <div className={s.quickActions}>
            <Link href="/admin/products">Ürünler</Link>
            <Link href="/admin/categories">Kategoriler</Link>
            <Link href="/admin/stock">Stok</Link>
            <Link href="/admin/mobile-product-drafts">📱 Mobil Taslaklar</Link>
          </div>
        </div>

        <div className={s.quickCard}>
          <div className={s.quickTitle}>İçerik</div>
          <div className={s.quickText}>Anasayfa, slider, sosyal alan, footer, SEO.</div>
          <div className={s.quickActions}>
            <Link href="/admin/home-promos">Slider</Link>
            <Link href="/admin/social">Sosyal</Link>
            <Link href="/admin/seo">SEO</Link>
          </div>
        </div>

        <div className={s.quickCard}>
          <div className={s.quickTitle}>Operasyon</div>
          <div className={s.quickText}>Sipariş, destek, kur ve yorum yönetimi.</div>
          <div className={s.quickActions}>
            <Link href="/admin/orders">Siparişler</Link>
            <Link href="/admin/support">Destek</Link>
            <Link href="/admin/rates-provider">Kurlar</Link>
          </div>
        </div>
      </section>

      <section className={s.footerNote}>
        <div className={s.footerNoteTitle}>Dip not</div>
        <div className={s.footerNoteText}>
          Bu ekran gerçek zamanlı güçlü ama pahalıdır. Sistem büyüyünce aggregation + günlük summary collection geçilir.
          Şimdilik kuvvetli, net ve operasyona dönük.
        </div>
      </section>

      {tab === "analytics" ? (
        <section>
          <AdminAnalyticsPanel />
        </section>
      ) : null}
    </main>
  );
}

function KpiCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  tone: "blue" | "emerald" | "amber" | "violet" | "pink" | "cyan";
}) {
  return (
    <div className={`${s.kpi} ${s[`kpi_${tone}`]}`}>
      <div className={s.kpiTitle}>{title}</div>
      <div className={s.kpiValue}>{value}</div>
      <div className={s.kpiSub}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.miniStat}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function PulseBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={s.pulseBox}>
      <div className={s.pulseLabel}>{label}</div>
      <div className={s.pulseValue}>{value}</div>
    </div>
  );
}

function AlertLine({
  tone,
  title,
  value,
  text,
}: {
  tone: "ok" | "warn" | "bad";
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className={`${s.alertLine} ${tone === "ok" ? s.lineOk : tone === "warn" ? s.lineWarn : s.lineBad}`}>
      <div>
        <div className={s.alertLineTitle}>{title}</div>
        <div className={s.alertLineText}>{text}</div>
      </div>
      <div className={s.alertLineValue}>{value}</div>
    </div>
  );
}

function QuickAction({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className={s.quickActionBtn}>
      <span className={s.quickActionTitle}>{title}</span>
      <span className={s.quickActionText}>{text}</span>
    </Link>
  );
}
