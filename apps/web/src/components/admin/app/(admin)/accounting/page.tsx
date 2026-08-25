"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";import {
  addDoc,
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
import { fmtTRY, statusTR } from "@/lib/orders";
import { toast } from "@/components/admin/ui/toast";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./accounting.module.css";

type Money = { amount?: number; currency?: string };

type OrderRow = {
  id: string;
  uid?: string;
  email?: string;
  status?: string;
  paymentStatus?: string;
  createdAt?: any;
  createdAtIso?: string;
  updatedAt?: any;
  updatedAtIso?: string;
  total?: Money | number;
  subtotal?: Money | number;
  shippingFee?: Money | number;
  discount?: Money | number;
  serviceTotal?: Money | number;
  serviceTotalTry?: number;
  payment?: {
    provider?: string;
    method?: string;
    ref?: string;
  };
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    city?: string;
    district?: string;
  };
  items?: Array<{
    qty?: number;
    title?: { tr?: string; en?: string } | string;
    sku?: string;
    lineTotal?: Money | number;
  }>;
};

type RefundRow = {
  id: string;
  orderId?: string;
  orderDocId?: string;
  uid?: string;
  amountTry?: string | number;
  status?: string;
  reason?: string;
  createdAt?: any;
  updatedAt?: any;
};

type ExpenseRow = {
  id: string;
  title?: string;
  amountTry?: number;
  category?: string;
  paymentMethod?: string;
  note?: string;
  dateIso?: string;
  createdAt?: any;
  updatedAt?: any;
};

type RangeKey = "today" | "7d" | "30d" | "month" | "year" | "all";
type PaymentFilter = "all" | "card" | "transfer" | "manual" | "paytr";
type StatusFilter =
  | "all"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const STATUS_FILTERS: Array<{ v: StatusFilter; label: string }> = [
  { v: "all", label: "Hepsi" },
  { v: "pending_payment", label: "Ödeme Bekliyor" },
  { v: "paid", label: "Ödendi" },
  { v: "preparing", label: "Hazırlanıyor" },
  { v: "shipped", label: "Kargoda" },
  { v: "delivered", label: "Teslim" },
  { v: "cancelled", label: "İptal" },
  { v: "refunded", label: "İade" },
];

const RANGE_FILTERS: Array<{ v: RangeKey; label: string }> = [
  { v: "today", label: "Bugün" },
  { v: "7d", label: "7 Gün" },
  { v: "30d", label: "30 Gün" },
  { v: "month", label: "Bu Ay" },
  { v: "year", label: "Bu Yıl" },
  { v: "all", label: "Tümü" },
];

const PAYMENT_FILTERS: Array<{ v: PaymentFilter; label: string }> = [
  { v: "all", label: "Tüm Ödemeler" },
  { v: "card", label: "Kart" },
  { v: "transfer", label: "Havale/EFT" },
  { v: "paytr", label: "PayTR" },
  { v: "manual", label: "Manuel" },
];

const EXPENSE_CATEGORIES = [
  "Kargo",
  "Reklam",
  "Komisyon",
  "Personel",
  "Paketleme",
  "Tedarik",
  "Ofis",
  "Yazılım",
  "Diğer",
];

function safeStr(v: any) {
  const x = String(v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : "";
}

function moneyAmount(v: any): number {
  if (v && typeof v === "object") {
    const n = Number(v.amount ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function getBestDate(x: any): Date | null {
  return (
    toDateSafe(x?.createdAt) ||
    toDateSafe(x?.createdAtIso) ||
    toDateSafe(x?.dateIso) ||
    toDateSafe(x?.updatedAt) ||
    toDateSafe(x?.updatedAtIso) ||
    null
  );
}

function fmtDate(x: any) {
  const d = getBestDate(x);
  if (!d) return "Tarih yok";

  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfRange(range: RangeKey): Date | null {
  const now = new Date();

  if (range === "all") return null;

  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }

  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }

  if (range === "year") {
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0);
  }

  return null;
}

function orderTotal(order: OrderRow) {
  return moneyAmount(order.total);
}

function orderSubtotal(order: OrderRow) {
  return moneyAmount(order.subtotal);
}

function orderDiscount(order: OrderRow) {
  return moneyAmount(order.discount);
}

function orderShipping(order: OrderRow) {
  return moneyAmount(order.shippingFee);
}

function orderServiceTotal(order: OrderRow) {
  return moneyAmount(order.serviceTotal) || Number(order.serviceTotalTry || 0);
}

function isIncomeOrder(order: OrderRow) {
  const status = safeStr(order.status).toLowerCase();
  const paymentStatus = safeStr(order.paymentStatus).toLowerCase();

  return (
    paymentStatus === "paid" ||
    ["paid", "preparing", "shipped", "delivered"].includes(status)
  );
}

function isCancelledLike(order: OrderRow) {
  const status = safeStr(order.status).toLowerCase();
  return status === "cancelled" || status === "refunded";
}

function paymentKind(order: OrderRow): "card" | "transfer" | "unknown" {
  const provider = safeStr(order.payment?.provider).toLowerCase();
  const method = safeStr(order.payment?.method).toLowerCase();

  if (provider === "paytr" || method === "card") return "card";
  if (provider === "manual" || method === "transfer" || method === "eft" || method === "havale") {
    return "transfer";
  }

  return "unknown";
}

function paymentLabel(order: OrderRow) {
  const provider = safeStr(order.payment?.provider).toLowerCase();
  const method = safeStr(order.payment?.method).toLowerCase();

  if (provider === "paytr" || method === "card") return "Kart / PayTR";
  if (provider === "manual" || method === "transfer") return "Havale / EFT";
  return "Belirtilmedi";
}

function itemCount(order: OrderRow) {
  if (!Array.isArray(order.items)) return 0;
  return order.items.reduce((sum, it) => sum + Number(it.qty || 1), 0);
}

function firstItemTitle(order: OrderRow) {
  const first = Array.isArray(order.items) ? order.items[0] : null;
  const title = first?.title;

  if (typeof title === "string") return safeStr(title);
  if (title && typeof title === "object") return safeStr(title.tr) || safeStr(title.en);

  return safeStr(first?.sku) || "Ürün";
}

function shortId(id: string) {
  const x = safeStr(id);
  if (!x) return "#";
  if (x.length <= 14) return `#${x}`;
  return `#${x.slice(0, 6)}…${x.slice(-6)}`;
}

function refundAmount(r: RefundRow) {
  const n = Number(String(r.amountTry ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isRefundActiveForAccounting(r: RefundRow) {
  const st = safeStr(r.status).toLowerCase();
  return ["approved", "refunded", "processing", "return_label_created", "received_by_store"].includes(st);
}

function downloadCsv(filename: string, rows: Array<Record<string, any>>) {
  const headerSet = rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>());

  const headers = Array.from(headerSet);

  const esc = (v: any) => {
    const raw = String(v ?? "");
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AdminAccountingPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingRefunds, setLoadingRefunds] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  const [range, setRange] = useState<RangeKey>("30d");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [qText, setQText] = useState("");

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amountTry: "",
    category: "Diğer",
    paymentMethod: "Kart",
    dateIso: new Date().toISOString().slice(0, 10),
    note: "",
  });

  useEffect(() => {
    const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500));

    return onSnapshot(
      qy,
      (snap) => {
        const list: OrderRow[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setOrders(list);
        setLoadingOrders(false);
      },
      (err) => {
        console.error("accounting orders snapshot error", err);
        setOrders([]);
        setLoadingOrders(false);
      }
    );
  }, [db]);

  useEffect(() => {
    const qy = query(collection(db, "refund_requests"), orderBy("createdAt", "desc"), limit(500));

    return onSnapshot(
      qy,
      (snap) => {
        const list: RefundRow[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setRefunds(list);
        setLoadingRefunds(false);
      },
      (err) => {
        console.error("accounting refunds snapshot error", err);
        setRefunds([]);
        setLoadingRefunds(false);
      }
    );
  }, [db]);

  useEffect(() => {
    const qy = query(collection(db, "accounting_expenses"), orderBy("createdAt", "desc"), limit(500));

    return onSnapshot(
      qy,
      (snap) => {
        const list: ExpenseRow[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setExpenses(list);
        setLoadingExpenses(false);
      },
      (err) => {
        console.error("accounting expenses snapshot error", err);
        setExpenses([]);
        setLoadingExpenses(false);
      }
    );
  }, [db]);

  const filteredOrders = useMemo(() => {
    const start = startOfRange(range);
    const q = qText.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (!start) return true;
        const d = getBestDate(order);
        return d ? d >= start : false;
      })
      .filter((order) => {
        if (status === "all") return true;
        return safeStr(order.status).toLowerCase() === status;
      })
      .filter((order) => {
        if (payment === "all") return true;

        const provider = safeStr(order.payment?.provider).toLowerCase();
        const method = safeStr(order.payment?.method).toLowerCase();
        const kind = paymentKind(order);

        if (payment === "card") return kind === "card";
        if (payment === "transfer") return kind === "transfer";
        if (payment === "paytr") return provider === "paytr";
        if (payment === "manual") return provider === "manual" || method === "transfer";

        return true;
      })
      .filter((order) => {
        if (!q) return true;

        const hay = [
          order.id,
          order.email,
          order.shippingAddress?.fullName,
          order.shippingAddress?.phone,
          order.shippingAddress?.city,
          order.shippingAddress?.district,
          order.payment?.provider,
          order.payment?.method,
          order.payment?.ref,
          firstItemTitle(order),
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      })
      .sort((a, b) => (getBestDate(b)?.getTime() || 0) - (getBestDate(a)?.getTime() || 0));
  }, [orders, range, status, payment, qText]);

  const filteredRefunds = useMemo(() => {
    const start = startOfRange(range);

    return refunds
      .filter((r) => {
        if (!start) return true;
        const d = getBestDate(r);
        return d ? d >= start : false;
      })
      .filter(isRefundActiveForAccounting);
  }, [refunds, range]);

  const filteredExpenses = useMemo(() => {
    const start = startOfRange(range);
    const q = qText.trim().toLowerCase();

    return expenses
      .filter((e) => {
        if (!start) return true;
        const d = getBestDate(e);
        return d ? d >= start : false;
      })
      .filter((e) => {
        if (!q) return true;

        const hay = [
          e.title,
          e.category,
          e.paymentMethod,
          e.note,
          e.id,
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      })
      .sort((a, b) => (getBestDate(b)?.getTime() || 0) - (getBestDate(a)?.getTime() || 0));
  }, [expenses, range, qText]);

  const summary = useMemo(() => {
    const incomeOrders = filteredOrders.filter((o) => isIncomeOrder(o) && !isCancelledLike(o));

    const grossRevenue = incomeOrders.reduce((sum, o) => sum + orderTotal(o), 0);
    const subtotal = incomeOrders.reduce((sum, o) => sum + orderSubtotal(o), 0);
    const shipping = incomeOrders.reduce((sum, o) => sum + orderShipping(o), 0);
    const discounts = incomeOrders.reduce((sum, o) => sum + orderDiscount(o), 0);
    const services = incomeOrders.reduce((sum, o) => sum + orderServiceTotal(o), 0);

    const refundTotal = filteredRefunds.reduce((sum, r) => sum + refundAmount(r), 0);
    const expenseTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amountTry || 0), 0);

    const netRevenue = Math.max(0, grossRevenue - refundTotal);
    const estimatedProfit = netRevenue - expenseTotal;

    const cardRevenue = incomeOrders
      .filter((o) => paymentKind(o) === "card")
      .reduce((sum, o) => sum + orderTotal(o), 0);

    const transferRevenue = incomeOrders
      .filter((o) => paymentKind(o) === "transfer")
      .reduce((sum, o) => sum + orderTotal(o), 0);

    const pendingRevenue = filteredOrders
      .filter((o) => safeStr(o.status) === "pending_payment")
      .reduce((sum, o) => sum + orderTotal(o), 0);

    return {
      orderCount: incomeOrders.length,
      allOrderCount: filteredOrders.length,
      grossRevenue,
      subtotal,
      shipping,
      discounts,
      services,
      refundTotal,
      expenseTotal,
      netRevenue,
      estimatedProfit,
      cardRevenue,
      transferRevenue,
      pendingRevenue,
    };
  }, [filteredOrders, filteredRefunds, filteredExpenses]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();

    for (const e of filteredExpenses) {
      const key = safeStr(e.category) || "Diğer";
      map.set(key, (map.get(key) || 0) + Number(e.amountTry || 0));
    }

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const paymentBreakdown = useMemo(() => {
    const incomeOrders = filteredOrders.filter((o) => isIncomeOrder(o) && !isCancelledLike(o));

    return [
      {
        label: "Kart / PayTR",
        amount: incomeOrders
          .filter((o) => paymentKind(o) === "card")
          .reduce((sum, o) => sum + orderTotal(o), 0),
      },
      {
        label: "Havale / EFT",
        amount: incomeOrders
          .filter((o) => paymentKind(o) === "transfer")
          .reduce((sum, o) => sum + orderTotal(o), 0),
      },
      {
        label: "Belirsiz",
        amount: incomeOrders
          .filter((o) => paymentKind(o) === "unknown")
          .reduce((sum, o) => sum + orderTotal(o), 0),
      },
    ].filter((x) => x.amount > 0);
  }, [filteredOrders]);

  const recentMovements = useMemo(() => {
    const orderMovements = filteredOrders
      .filter((o) => isIncomeOrder(o) && !isCancelledLike(o))
      .map((o) => ({
        id: `order_${o.id}`,
        kind: "income" as const,
        title: `Sipariş ${shortId(o.id)}`,
        desc: `${safeStr(o.shippingAddress?.fullName) || "Müşteri"} • ${paymentLabel(o)}`,
        amount: orderTotal(o),
        date: getBestDate(o),
        href: `/admin/orders/${encodeURIComponent(o.id)}`,
      }));

    const refundMovements = filteredRefunds.map((r) => ({
      id: `refund_${r.id}`,
      kind: "refund" as const,
      title: `İade ${shortId(r.orderId || r.orderDocId || r.id)}`,
      desc: safeStr(r.reason) || "İade talebi",
      amount: refundAmount(r),
      date: getBestDate(r),
      href: `/admin/refunds`,
    }));

    const expenseMovements = filteredExpenses.map((e) => ({
      id: `expense_${e.id}`,
      kind: "expense" as const,
      title: safeStr(e.title) || "Gider",
      desc: `${safeStr(e.category) || "Diğer"} • ${safeStr(e.paymentMethod) || "Belirtilmedi"}`,
      amount: Number(e.amountTry || 0),
      date: getBestDate(e),
      href: "",
    }));

    return [...orderMovements, ...refundMovements, ...expenseMovements]
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 60);
  }, [filteredOrders, filteredRefunds, filteredExpenses]);

  const loading = loadingOrders || loadingRefunds || loadingExpenses;

  function resetExpenseForm() {
    setExpenseForm({
      title: "",
      amountTry: "",
      category: "Diğer",
      paymentMethod: "Kart",
      dateIso: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setEditingExpenseId("");
  }

  function editExpense(expense: ExpenseRow) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: safeStr(expense.title),
      amountTry: String(expense.amountTry || ""),
      category: safeStr(expense.category) || "Diğer",
      paymentMethod: safeStr(expense.paymentMethod) || "Kart",
      dateIso: safeStr(expense.dateIso).slice(0, 10) || new Date().toISOString().slice(0, 10),
      note: safeStr(expense.note),
    });
    setExpenseOpen(true);
  }

  async function saveExpense() {
    const title = safeStr(expenseForm.title);
    const amountTry = Number(String(expenseForm.amountTry || "").replace(",", "."));
    const category = safeStr(expenseForm.category) || "Diğer";
    const paymentMethod = safeStr(expenseForm.paymentMethod) || "Belirtilmedi";
    const dateIso = expenseForm.dateIso
      ? new Date(`${expenseForm.dateIso}T12:00:00`).toISOString()
      : new Date().toISOString();

    if (!title) {
      toast.error("Gider başlığı gerekli.");
      return;
    }

    if (!Number.isFinite(amountTry) || amountTry <= 0) {
      toast.error("Geçerli bir gider tutarı gir.");
      return;
    }

    try {
      setExpenseBusy(true);

      const payload = {
        title,
        amountTry: Number(amountTry.toFixed(2)),
        category,
        paymentMethod,
        note: safeStr(expenseForm.note),
        dateIso,
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      };

      if (editingExpenseId) {
        await updateDoc(doc(db, "accounting_expenses", editingExpenseId), payload as any);
        toast.success("Gider güncellendi.");
      } else {
        await addDoc(collection(db, "accounting_expenses"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdAtIso: new Date().toISOString(),
        } as any);
        toast.success("Gider eklendi.");
      }

      resetExpenseForm();
      setExpenseOpen(false);
    } catch (e: any) {
      console.error("save expense error", e);
      toast.error(String(e?.message || "Gider kaydedilemedi."));
    } finally {
      setExpenseBusy(false);
    }
  }

  async function deleteExpense(id: string) {
    const ok = window.confirm("Bu gider kaydı silinsin mi?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "accounting_expenses", id));
      toast.success("Gider silindi.");
    } catch (e: any) {
      console.error("delete expense error", e);
      toast.error(String(e?.message || "Gider silinemedi."));
    }
  }

  function exportCsv() {
    const rows = recentMovements.map((m) => ({
      tarih: m.date ? m.date.toISOString() : "",
      tip:
        m.kind === "income"
          ? "Gelir"
          : m.kind === "refund"
          ? "İade"
          : "Gider",
      baslik: m.title,
      aciklama: m.desc,
      tutar: m.amount,
    }));

    downloadCsv(`muhasebe-raporu-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("CSV raporu indirildi.");
  }

  return (
    <main className={s.page}>
      <section className={s.top}>
        <div className={s.headLeft}>
          <div className={s.kicker}>Admin • Finans Merkezi</div>
          <h1 className={s.h1}>Muhasebe</h1>
          <p className={s.subText}>
            Sipariş gelirleri, iade tutarları ve manuel gider kayıtlarını tek panelden izle.
          </p>

          <div className={s.quickStats}>
            <div className={`${s.quickCard} ${s.quickIncome}`}>
              <span>Brüt Gelir</span>
              <b>{fmtTRY(summary.grossRevenue)}</b>
              <small>{summary.orderCount} ödenmiş sipariş</small>
            </div>

            <div className={`${s.quickCard} ${s.quickRefund}`}>
              <span>İade / Geri Ödeme</span>
              <b>{fmtTRY(summary.refundTotal)}</b>
              <small>{filteredRefunds.length} muhasebe hareketi</small>
            </div>

            <div className={`${s.quickCard} ${s.quickExpense}`}>
              <span>Gider</span>
              <b>{fmtTRY(summary.expenseTotal)}</b>
              <small>{filteredExpenses.length} gider kaydı</small>
            </div>

            <div className={`${s.quickCard} ${summary.estimatedProfit >= 0 ? s.quickNet : s.quickLoss}`}>
              <span>Tahmini Net</span>
              <b>{fmtTRY(summary.estimatedProfit)}</b>
              <small>Gelir - iade - gider</small>
            </div>
          </div>
        </div>

        <div className={s.tools}>
          <div className={s.toolActions}>
            <button type="button" className={s.secondaryBtn} onClick={exportCsv}>
              CSV İndir
            </button>

            <button
              type="button"
              className={s.primaryBtn}
              onClick={() => {
                resetExpenseForm();
                setExpenseOpen(true);
              }}
            >
              + Gider Ekle
            </button>
          </div>

          <div className={s.searchWrap}>
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              className={s.search}
              placeholder="Ara… sipariş / müşteri / ödeme / gider"
            />
          </div>

          <div className={s.filterBlock}>
            <div className={s.filterTitle}>Tarih</div>
            <div className={s.filterRow}>
              {RANGE_FILTERS.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  onClick={() => setRange(x.v)}
                  className={`${s.filterBtn} ${range === x.v ? s.filterBtnOn : ""}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.filterBlock}>
            <div className={s.filterTitle}>Sipariş Durumu</div>
            <div className={s.filterRow}>
              {STATUS_FILTERS.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  onClick={() => setStatus(x.v)}
                  className={`${s.filterBtn} ${status === x.v ? s.filterBtnOn : ""}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.filterBlock}>
            <div className={s.filterTitle}>Ödeme</div>
            <div className={s.filterRow}>
              {PAYMENT_FILTERS.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  onClick={() => setPayment(x.v)}
                  className={`${s.filterBtn} ${payment === x.v ? s.filterBtnOn : ""}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {expenseOpen ? (
        <section className={s.expensePanel}>
          <div className={s.expensePanelHead}>
            <div>
              <div className={s.panelKicker}>Gider Kaydı</div>
              <h2>{editingExpenseId ? "Gideri Düzenle" : "Yeni Gider Ekle"}</h2>
            </div>

            <button
              type="button"
              className={s.iconBtn}
              onClick={() => {
                resetExpenseForm();
                setExpenseOpen(false);
              }}
              disabled={expenseBusy}
            >
              ×
            </button>
          </div>

          <div className={s.expenseGrid}>
            <label className={s.field}>
              <span>Başlık</span>
              <input
                value={expenseForm.title}
                onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Örn: Kargo faturası"
              />
            </label>

            <label className={s.field}>
              <span>Tutar</span>
              <input
                value={expenseForm.amountTry}
                onChange={(e) =>
                  setExpenseForm((p) => ({
                    ...p,
                    amountTry: e.target.value.replace(/[^\d.,]/g, ""),
                  }))
                }
                placeholder="0,00"
                inputMode="decimal"
              />
            </label>

            <label className={s.field}>
              <span>Kategori</span>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className={s.field}>
              <span>Ödeme Tipi</span>
              <input
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                placeholder="Kart / Nakit / Havale"
              />
            </label>

            <label className={s.field}>
              <span>Tarih</span>
              <input
                type="date"
                value={expenseForm.dateIso}
                onChange={(e) => setExpenseForm((p) => ({ ...p, dateIso: e.target.value }))}
              />
            </label>

            <label className={`${s.field} ${s.fieldWide}`}>
              <span>Not</span>
              <input
                value={expenseForm.note}
                onChange={(e) => setExpenseForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Opsiyonel açıklama"
              />
            </label>
          </div>

          <div className={s.expenseActions}>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => {
                resetExpenseForm();
                setExpenseOpen(false);
              }}
              disabled={expenseBusy}
            >
              Vazgeç
            </button>

            <button
              type="button"
              className={s.primaryBtn}
              onClick={saveExpense}
              disabled={expenseBusy}
            >
              {expenseBusy ? "Kaydediliyor..." : editingExpenseId ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className={s.skeletonGrid}>
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
        </div>
      ) : (
        <>
          <section className={s.kpiGrid}>
            <div className={s.kpiCard}>
              <span>Ara Toplam</span>
              <b>{fmtTRY(summary.subtotal)}</b>
              <small>Ürün toplamı</small>
            </div>

            <div className={s.kpiCard}>
              <span>Kargo Geliri</span>
              <b>{fmtTRY(summary.shipping)}</b>
              <small>Sipariş kargo kalemi</small>
            </div>

            <div className={s.kpiCard}>
              <span>Ek Hizmet</span>
              <b>{fmtTRY(summary.services)}</b>
              <small>Hediye paketi vb.</small>
            </div>

            <div className={s.kpiCard}>
              <span>İndirim</span>
              <b>{fmtTRY(summary.discounts)}</b>
              <small>Kupon/kampanya</small>
            </div>

            <div className={s.kpiCard}>
              <span>Kart Geliri</span>
              <b>{fmtTRY(summary.cardRevenue)}</b>
              <small>PayTR / kart</small>
            </div>

            <div className={s.kpiCard}>
              <span>Havale Geliri</span>
              <b>{fmtTRY(summary.transferRevenue)}</b>
              <small>Manuel ödeme</small>
            </div>

            <div className={s.kpiCard}>
              <span>Bekleyen Tutar</span>
              <b>{fmtTRY(summary.pendingRevenue)}</b>
              <small>Ödeme bekleyen</small>
            </div>

            <div className={`${s.kpiCard} ${summary.estimatedProfit >= 0 ? s.kpiGood : s.kpiBad}`}>
              <span>Net Durum</span>
              <b>{fmtTRY(summary.estimatedProfit)}</b>
              <small>{summary.estimatedProfit >= 0 ? "Pozitif akış" : "Negatif akış"}</small>
            </div>
          </section>

          <section className={s.contentGrid}>
            <div className={s.leftCol}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <h2 className={s.cardTitle}>Son Finans Hareketleri</h2>
                    <p className={s.cardDesc}>Gelir, iade ve gider kayıtlarının birleşik akışı.</p>
                  </div>
                  <span className={s.countPill}>{recentMovements.length} hareket</span>
                </div>

                {recentMovements.length ? (
                  <div className={s.movementList}>
                    {recentMovements.map((m) => {
                      const sign = m.kind === "income" ? "+" : "-";
                      const tone =
                        m.kind === "income"
                          ? s.moveIncome
                          : m.kind === "refund"
                          ? s.moveRefund
                          : s.moveExpense;

                      const inner = (
                        <>
                          <div className={`${s.moveIcon} ${tone}`}>
                            {m.kind === "income" ? "₺" : m.kind === "refund" ? "↩" : "−"}
                          </div>

                          <div className={s.moveMain}>
                            <div className={s.moveTitle}>{m.title}</div>
                            <div className={s.moveDesc}>{m.desc}</div>
                            <div className={s.moveDate}>
                              {m.date
                                ? m.date.toLocaleString("tr-TR", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Tarih yok"}
                            </div>
                          </div>

                          <div className={`${s.moveAmount} ${tone}`}>
                            {sign} {fmtTRY(m.amount)}
                          </div>
                        </>
                      );

                      return m.href ? (
                        <Link key={m.id} href={m.href} className={s.moveRow}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={m.id} className={s.moveRow}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={s.emptyMini}>Bu filtrede finans hareketi yok.</div>
                )}
              </div>

              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <h2 className={s.cardTitle}>Sipariş Gelirleri</h2>
                    <p className={s.cardDesc}>Filtreye göre sipariş muhasebe listesi.</p>
                  </div>
                  <span className={s.countPill}>{filteredOrders.length} sipariş</span>
                </div>

                <div className={s.orderList}>
                  {filteredOrders.slice(0, 80).map((order) => {
                    const income = isIncomeOrder(order) && !isCancelledLike(order);
                    const customer = safeStr(order.shippingAddress?.fullName) || "İsimsiz müşteri";

                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${encodeURIComponent(order.id)}`}
                        className={s.orderRow}
                      >
                        <div className={s.orderLeft}>
                          <div className={s.orderId}>{shortId(order.id)}</div>
                          <div className={s.orderTitle}>{customer}</div>
                          <div className={s.orderMeta}>
                            <span>{fmtDate(order)}</span>
                            <span>•</span>
                            <span>{paymentLabel(order)}</span>
                            <span>•</span>
                            <span>{itemCount(order)} ürün</span>
                          </div>
                        </div>

                        <div className={s.orderRight}>
                          <span className={`${s.orderStatus} ${income ? s.statusOk : s.statusWarn}`}>
                            {statusTR(order.status as any)}
                          </span>
                          <b>{fmtTRY(orderTotal(order))}</b>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className={s.rightCol}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <h2 className={s.cardTitle}>Ödeme Dağılımı</h2>
                    <p className={s.cardDesc}>Gelirin ödeme tiplerine göre ayrımı.</p>
                  </div>
                </div>

                {paymentBreakdown.length ? (
                  <div className={s.breakList}>
                    {paymentBreakdown.map((x) => {
                      const pct = summary.grossRevenue > 0 ? (x.amount / summary.grossRevenue) * 100 : 0;

                      return (
                        <div key={x.label} className={s.breakItem}>
                          <div className={s.breakTop}>
                            <span>{x.label}</span>
                            <b>{fmtTRY(x.amount)}</b>
                          </div>

                          <div className={s.progress}>
                            <span style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>

                          <small>%{pct.toFixed(1)}</small>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={s.emptyMini}>Gelir dağılımı yok.</div>
                )}
              </div>

              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <h2 className={s.cardTitle}>Gider Kategorileri</h2>
                    <p className={s.cardDesc}>Manuel giderlerin kategori özeti.</p>
                  </div>
                </div>

                {expenseByCategory.length ? (
                  <div className={s.categoryList}>
                    {expenseByCategory.map((x) => (
                      <div key={x.category} className={s.categoryRow}>
                        <span>{x.category}</span>
                        <b>{fmtTRY(x.amount)}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.emptyMini}>Henüz gider kaydı yok.</div>
                )}
              </div>

              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <h2 className={s.cardTitle}>Gider Kayıtları</h2>
                    <p className={s.cardDesc}>Düzenlenebilir manuel gider listesi.</p>
                  </div>
                </div>

                {filteredExpenses.length ? (
                  <div className={s.expenseList}>
                    {filteredExpenses.slice(0, 50).map((e) => (
                      <div key={e.id} className={s.expenseRow}>
                        <div>
                          <div className={s.expenseTitle}>{safeStr(e.title) || "Gider"}</div>
                          <div className={s.expenseMeta}>
                            {safeStr(e.category) || "Diğer"} • {fmtDate(e)}
                          </div>
                          {e.note ? <div className={s.expenseNote}>{e.note}</div> : null}
                        </div>

                        <div className={s.expenseRight}>
                          <b>- {fmtTRY(Number(e.amountTry || 0))}</b>

                          <div className={s.expenseBtns}>
                            <button type="button" onClick={() => editExpense(e)}>
                              Düzenle
                            </button>

                            <button type="button" onClick={() => deleteExpense(e.id)}>
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.emptyMini}>Bu filtrede gider yok.</div>
                )}
              </div>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

export default function AdminAccountingPage() {
  return (
    <AdminGate>
      <PermissionGate permission="orders">
        <AdminAccountingPageInner />
      </PermissionGate>
    </AdminGate>
  );
}