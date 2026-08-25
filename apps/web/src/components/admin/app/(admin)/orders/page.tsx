"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseApp } from "@/lib/firebase.client";
import { fmtTRY, statusTR, type OrderDoc, type OrderStatus } from "@/lib/orders";
import { toast } from "@/components/admin/ui/toast";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./orders.module.css";
import { adminFetch } from "@/lib/adminFetch";

type Row = OrderDoc & {
  id: string;
  createdAtIso?: string;
  updatedAtIso?: string;
  shippingProvider?: string;
  shippingStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  labelZpl?: string;
  shipmentId?: string;
  shipmentRef?: string;
  shipmentDocId?: string;
  shippingReferenceId?: string;
  shippingOrderInvoiceId?: string;
  shippingOrderInvoiceDetailId?: string;
  shippingShipperBranchCode?: string;
  shippingInvoiceId?: string;
  shippingBarcodeInvoiceId?: string;
  shippingBarcodeError?: string;
  shippingOrderAlreadyExists?: boolean;
  shippingOrderDuplicateAt?: any;
  shippingCancelled?: boolean;
  shippingCancelledAt?: any;
  shippingOrderRaw?: any;
  shippingBarcodeRaw?: any;
};

const STATUS_META: {
  v: OrderStatus | "all";
  label: string;
  tone: "neutral" | "warn" | "info" | "ok" | "bad";
}[] = [
  { v: "all", label: "Hepsi", tone: "neutral" },
  { v: "pending_payment", label: "Ödeme Bekliyor", tone: "warn" },
  { v: "paid", label: "Ödendi", tone: "ok" },
  { v: "preparing", label: "Hazırlanıyor", tone: "info" },
  { v: "shipped", label: "Kargoda", tone: "info" },
  { v: "delivered", label: "Teslim", tone: "ok" },
  { v: "cancelled", label: "İptal", tone: "bad" },
  { v: "refunded", label: "İade", tone: "bad" },
];

function toneOf(statusRaw: any): "neutral" | "warn" | "info" | "ok" | "bad" {
  const st = String(statusRaw || "pending_payment");
  if (st === "paid" || st === "delivered") return "ok";
  if (st === "cancelled" || st === "refunded") return "bad";
  if (st === "preparing" || st === "shipped") return "info";
  if (st === "pending_payment") return "warn";
  return "neutral";
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "object" && String(v?._methodName || "").includes("serverTimestamp")) {
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

function getOrderDate(r: any): Date | null {
  return (
    toDateSafe(r?.createdAt) ||
    toDateSafe(r?.createdAtIso) ||
    toDateSafe(r?.updatedAt) ||
    toDateSafe(r?.updatedAtIso) ||
    null
  );
}

function fmtDateFromRow(r: any) {
  const d = getOrderDate(r);
  if (!d) return "Tarih bekleniyor";

  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normMoneyTotal(r: any) {
  const amt = Number(r?.total?.amount ?? 0);
  return Number.isFinite(amt) ? amt : 0;
}

function normName(r: any) {
  return String(r?.shippingAddress?.fullName || "").trim();
}

function normEmail(r: any) {
  return String(r?.email || "").trim();
}

function normPhone(r: any) {
  return String(r?.shippingAddress?.phone || "").trim();
}

function normCity(r: any) {
  const city = String(r?.shippingAddress?.city || "").trim();
  const district = String(r?.shippingAddress?.district || "").trim();
  return [district, city].filter(Boolean).join(" / ");
}

function itemCountOf(r: any) {
  if (!Array.isArray(r?.items)) return 0;
  return r.items.reduce((sum: number, it: any) => sum + Number(it?.qty || 1), 0);
}

function shortId(id: string) {
  const clean = String(id || "").trim();
  if (!clean) return "#";
  if (clean.length <= 14) return `#${clean}`;
  return `#${clean.slice(0, 6)}…${clean.slice(-6)}`;
}
function customerSaysPaid(r: any) {
  const payment = r?.payment || {};

  const flags = [
    r?.customerPaymentNotified,
    r?.paymentNotified,
    r?.paymentSubmitted,
    r?.transferPaymentNotified,
    r?.bankTransferNotified,
    r?.paidNotification,
    payment?.customerNotified,
    payment?.paymentNotified,
    payment?.transferNotified,
    payment?.submitted,
  ];

  const hasTrueFlag = flags.some((x) => x === true);

  const hasDate =
    Boolean(r?.customerPaymentNotifiedAt) ||
    Boolean(r?.paymentNotifiedAt) ||
    Boolean(r?.paymentSubmittedAt) ||
    Boolean(r?.transferPaymentNotifiedAt) ||
    Boolean(payment?.customerNotifiedAt) ||
    Boolean(payment?.submittedAt);

  const status = String(r?.status || "").toLowerCase();
  const paymentStatus = String(r?.paymentStatus || "").toLowerCase();

  return status === "pending_payment" && paymentStatus !== "paid" && (hasTrueFlag || hasDate);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function AdminOrdersPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const functions = useMemo(() => getFunctions(getFirebaseApp(), "europe-west1"), []);

  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [creatingShipmentId, setCreatingShipmentId] = useState<string>("");
  const [cancelShipmentId, setCancelShipmentId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string>("");
  const [inspectRow, setInspectRow] = useState<Row | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLimit, setPageLimit] = useState(100);

  const [qText, setQText] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "settings", "shipping"));
        const data = snap.exists() ? (snap.data() as any) : null;

        if (!alive) return;

        const enabled =
          data?.activeProvider === "mng" &&
          data?.features?.createShipment !== false &&
          data?.providers?.mng?.isActive !== false;

        setShippingEnabled(enabled);
      } catch (e) {
        console.error("shipping settings read error", e);
        if (alive) setShippingEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
    setLoading(true);

    const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(pageLimit));

    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.error("orders snapshot error", err);
        setRows([]);
        setLoading(false);
      }
    );
  }, [db, pageLimit]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();

    return rows
      .filter((r) => (status === "all" ? true : String(r.status) === status))
      .filter((r) => {
        if (!q) return true;

        const hay = [
          r.id,
          normEmail(r),
          normName(r),
          normPhone(r),
          normCity(r),
          String(r?.shippingAddress?.addressLine || ""),
          String(r?.trackingNumber || ""),
          String(r?.shippingReferenceId || ""),
          String(r?.shipmentId || ""),
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      })
      .sort((a, b) => {
        const da = getOrderDate(a)?.getTime() || 0;
        const dbb = getOrderDate(b)?.getTime() || 0;
        return dbb - da;
      });
  }, [rows, status, qText]);

  const stats = useMemo(() => {
    const totalCount = rows.length;
    const pending = rows.filter((r) => String(r.status) === "pending_payment").length;
    const paid = rows.filter((r) => String(r.status) === "paid").length;
    const preparing = rows.filter((r) => String(r.status) === "preparing").length;
    const shipped = rows.filter((r) => String(r.status) === "shipped").length;
    const delivered = rows.filter((r) => String(r.status) === "delivered").length;
    const cancelled = rows.filter((r) => String(r.status) === "cancelled").length;
    const refunded = rows.filter((r) => String(r.status) === "refunded").length;
    const gross = rows.reduce((sum, r: any) => sum + normMoneyTotal(r), 0);

    return { totalCount, pending, paid, preparing, shipped, delivered, cancelled, refunded, gross };
  }, [rows]);

  async function handleCreateShipment(id: string) {
    const ok = window.confirm(`Bu sipariş için MNG gönderisi oluşturulsun mu?\n\n${shortId(id)}`);
    if (!ok) return;

    try {
      setCreatingShipmentId(id);

      const recipientRes = await adminFetch("/api/shipping/create-recipient", {
        method: "POST",
        body: JSON.stringify({ orderId: id }),
        cache: "no-store",
      });

      const recipientJson = await recipientRes.json().catch(() => null);

      if (!recipientRes.ok || !recipientJson?.ok) {
        throw new Error(recipientJson?.error || "CreateRecipient başarısız.");
      }

      const orderRes = await adminFetch("/api/shipping/create-order", {
        method: "POST",
        body: JSON.stringify({ orderId: id }),
        cache: "no-store",
      });

      const orderJson = await orderRes.json().catch(() => null);

      if (!orderRes.ok || !orderJson?.ok) {
        throw new Error(orderJson?.error || "CreateOrder başarısız.");
      }

      const referenceId = String(orderJson?.referenceId || "").trim();
      if (!referenceId) {
        throw new Error("CreateOrder başarılı ama referenceId dönmedi.");
      }

      toast.success("Sipariş kaydı açıldı. Barkod için kısa süre bekleniyor...");
      await sleep(15000);

      const barcodeRes = await adminFetch("/api/shipping/create-barcode", {
        method: "POST",
        body: JSON.stringify({
          orderId: id,
          referenceId,
        }),
        cache: "no-store",
      });

      const barcodeJson = await barcodeRes.json().catch(() => null);

      if (!barcodeRes.ok || !barcodeJson?.ok) {
        throw new Error(barcodeJson?.error || "CreateBarcode başarısız.");
      }

      if (barcodeJson?.alreadyExists) {
        toast.success("Bu sipariş için kargo zaten oluşturulmuş.");
        return;
      }

      toast.success("Recipient, sipariş kaydı ve barkod başarıyla oluşturuldu. Sipariş durumu 'Hazırlanıyor' olarak güncellendi.");
    } catch (e: any) {
      console.error("create shipment error", e);

      const rawMsg = String(e?.message || "");
      const msg = rawMsg.toLowerCase();

      if (msg.includes("createrecipient")) {
        toast.error("Alıcı kaydı oluşturulamadı. Adres / il / ilçe bilgilerini kontrol et.");
        return;
      }

      if (msg.includes("token")) {
        toast.error("MNG token alınamadı. Müşteri numarası, şifre ve uygulama yetkilerini kontrol et.");
        return;
      }

      if (msg.includes("createorder")) {
        toast.error(`Sipariş kaydı oluşturulamadı: ${rawMsg || "CreateOrder başarısız."}`);
        return;
      }

      if (msg.includes("createbarcode")) {
        toast.error(`Barkod oluşturulamadı: ${rawMsg || "CreateBarcode başarısız."}`);
        return;
      }

      toast.error(rawMsg || "Kargo oluşturulamadı.");
    } finally {
      setCreatingShipmentId("");
    }
  }

async function handleCancelShipment(row: Row) {
    const shipmentId = String(row?.shipmentId || "").trim();
    const referenceId = String(row?.shippingReferenceId || row?.shipmentRef || "").trim();

    if (!referenceId || !shipmentId) {
      toast.error("İptal için referenceId ve shipmentId bulunamadı.");
      return;
    }

    const choice = window.confirm(
      `Bu kargo kaydı iptal edilsin mi?\n\n${shortId(row.id)}\n${shipmentId ? `ShipmentId: ${shipmentId}` : ""}\n\nNOT: Sadece kargo iptali yapılır, sipariş durumu değişmez.\nSiparişi de iptal etmek istersen ayrıca "İptal Et" butonunu kullan.`
    );
    if (!choice) return;

    try {
      setCancelShipmentId(row.id);

      const res = await adminFetch("/api/shipping/cancel-shipment", {
        method: "POST",
        body: JSON.stringify({
          orderId: row.id,
          referenceId,
          shipmentId,
        }),
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Kargo iptali başarısız.");
      }

      // Sadece kargo bilgilerini sıfırla, sipariş durumuna dokunma
      await updateDoc(doc(db, "orders", row.id), {
        shippingStatus: "cancelled",
        shippingCancelled: true,
        shippingCancelledAt: serverTimestamp(),
        shippingCancelledAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      });

      toast.success("Kargo kaydı iptal edildi. Sipariş durumu değişmedi.");
    } catch (e: any) {
      console.error("cancel shipment error", e);
      toast.error(String(e?.message || "Kargo iptal edilemedi."));
    } finally {
      setCancelShipmentId("");
    }
  }

  async function handleConfirmPayment(id: string) {
    const ok = window.confirm(`Bu sipariş için ödeme onaylansın mı?\n\n${shortId(id)}`);
    if (!ok) return;

    try {
      const confirmOrderFn = httpsCallable(functions, "confirmOrderPaymentV1");

      await confirmOrderFn({
        orderId: id,
        paymentRef: `ADMIN_${Date.now()}`,
      });

      toast.success("Ödeme onaylandı. Sipariş paid oldu ve stok düşürüldü.");
    } catch (e) {
      console.error("confirm payment error", e);
      toast.error("Ödeme onayı başarısız.");
    }
  }

  async function handleCancelOrder(id: string) {
    const ok = window.confirm(
      `Bu sipariş iptal edilsin mi?\n\n${shortId(id)}\n\nHavale siparişiyse stok geri verilecektir.`
    );
    if (!ok) return;

    try {
      setDeletingId(id);

      const cancelOrderFn = httpsCallable(functions, "cancelOrderAndRestoreStockV1");
      await cancelOrderFn({ orderId: id });

      toast.success("Sipariş iptal edildi. Uygunsa stok geri verildi.");
    } catch (e: any) {
      console.error("cancel order error", e);

      const msg = e?.message || e?.details || e?.code || "Sipariş iptal edilemedi.";
      toast.error(String(msg));
    } finally {
      setDeletingId("");
    }
  }

  async function handleQuickStatus(
    id: string,
    nextStatus: "preparing" | "shipped" | "delivered" | "cancelled"
  ) {
    try {
      if (!id) {
        toast.error("Sipariş bulunamadı.");
        return;
      }

      if (nextStatus === "cancelled") {
        await handleCancelOrder(id);
        return;
      }

      await updateDoc(doc(db, "orders", id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      });

      toast.success("Sipariş durumu güncellendi.");
    } catch (e: any) {
      console.error("quick status update error", e);

      const msg =
        e?.code === "permission-denied"
          ? "Yetkin yok. Admin girişi kontrol et."
          : "Sipariş durumu güncellenemedi.";

      toast.error(msg);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.top}>
        <div className={s.headLeft}>
          <div className={s.kicker}>Admin • Sipariş Yönetimi</div>
          <h1 className={s.h1}>Siparişler</h1>
          <p className={s.subText}>
            Sipariş akışını, ödeme durumlarını ve müşteri teslimat bilgilerini tek panelden yönet.
          </p>

          <div className={s.statsRow}>
            <div className={s.statChip}>
              <span>Toplam</span>
              <b>{stats.totalCount}</b>
            </div>
            <div className={`${s.statChip} ${s.statWarn}`}>
              <span>Bekleyen</span>
              <b>{stats.pending}</b>
            </div>
            <div className={`${s.statChip} ${s.statOk}`}>
              <span>Ödendi</span>
              <b>{stats.paid}</b>
            </div>
            <div className={`${s.statChip} ${s.statInfo}`}>
              <span>Hazırlanıyor</span>
              <b>{stats.preparing}</b>
            </div>
            <div className={`${s.statChip} ${s.statInfo}`}>
              <span>Kargoda</span>
              <b>{stats.shipped}</b>
            </div>
            <div className={`${s.statChip} ${s.statOk}`}>
              <span>Teslim</span>
              <b>{stats.delivered}</b>
            </div>
            <div className={`${s.statChip} ${s.statBad}`}>
              <span>İptal</span>
              <b>{stats.cancelled}</b>
            </div>
            <div className={`${s.statChip} ${s.statBad}`}>
              <span>İade</span>
              <b>{stats.refunded}</b>
            </div>
            <div className={s.statMoney}>
              <span>Toplam Ciro</span>
              <b>{fmtTRY(stats.gross)}</b>
            </div>
          </div>
        </div>

        <div className={s.tools}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Link href="/admin/orders/cancelled" className={s.secondaryBtn}>
              İptal Edilenler
            </Link>
          </div>

          <div className={s.searchWrap}>
            <input
              className={s.search}
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Ara… (id / isim / mail / telefon / şehir / takip no)"
            />
          </div>

          <div className={s.filterRow}>
            {STATUS_META.map((x) => (
              <button
                key={x.v}
                type="button"
                onClick={() => setStatus(x.v as any)}
                className={[
                  s.filterBtn,
                  status === x.v ? s.filterBtnOn : "",
                  x.tone === "warn" ? s.filterWarn : "",
                  x.tone === "ok" ? s.filterOk : "",
                  x.tone === "info" ? s.filterInfo : "",
                  x.tone === "bad" ? s.filterBad : "",
                ].join(" ")}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={s.skeletonGrid}>
          <div className={s.skelCard} />
          <div className={s.skelCard} />
          <div className={s.skelCard} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyTitle}>Sonuç bulunamadı</div>
          <div className={s.emptyDesc}>Arama terimini ya da filtreleri değiştir.</div>
          <button
            className={s.secondaryBtn}
            type="button"
            onClick={() => {
              setQText("");
              setStatus("all");
            }}
          >
            Filtreleri temizle
          </button>
        </div>
      ) : (
        <div className={s.cardGrid}>
          {filtered.map((r: Row) => {
            const id = String(r.id || "");
            const name = normName(r) || "İsimsiz müşteri";
            const email = normEmail(r);
            const phone = normPhone(r);
            const city = normCity(r);
            const total = normMoneyTotal(r);
            const itemsCount = itemCountOf(r);
            const tone = toneOf(r.status);
            const paymentNotify = customerSaysPaid(r);
            const hasShipment = Boolean(String(r.shipmentId || "").trim());
            const hasReference = Boolean(String(r.shippingReferenceId || "").trim());
            const hasBarcodeError = String(r.shippingStatus || "") === "barcode_error";
            const canCreateShipment =
              shippingEnabled &&
              !hasShipment &&
              !hasBarcodeError &&
              !hasReference &&
              ["paid", "preparing"].includes(String(r.status || ""));

            const canCancelShipment =
              (hasShipment || hasReference) &&
              !["cancelled", "delivered"].includes(String(r.status || "")) &&
              String(r.shippingStatus || "") !== "cancelled";

            return (
              <article

  key={id}

  className={`${s.orderCard} ${paymentNotify ? s.paymentNotifyCard : ""}`}
  style={{ position: 'relative' }}

>
                {/* Kargo Durum Kontrol Butonu */}
                <button
                  type="button"
                  className={s.inspectBtn}
                  title="Kargo durumu detayı"
                  onClick={() => setInspectRow(r)}
                >
                  ⚠
                </button>
                <div className={s.cardTop}>
                  <div className={s.cardTopLeft}>
                    <div className={s.orderId}>{shortId(id)}</div>
                    <div className={s.orderDate}>
                      <span>Tarih</span>
                      <b>{fmtDateFromRow(r)}</b>
                    </div>
                  </div>

                  <div
                    className={[
                      s.statusBadge,
                      tone === "ok" ? s.badgeOk : "",
                      tone === "warn" ? s.badgeWarn : "",
                      tone === "info" ? s.badgeInfo : "",
                      tone === "bad" ? s.badgeBad : "",
                    ].join(" ")}
                  >
                    {statusTR(r.status)}
                  </div>
                </div>
{paymentNotify ? (

  <div className={s.paymentNotifyBox}>

    <span className={s.paymentPulseDot} />

    <div>

      <b>Müşteri ödemeyi yaptığını bildirdi</b>

      <small>Havale/EFT kontrolü bekliyor. Banka hesabını doğrulayıp “Ödemeyi Onayla” işlemini yap.</small>

    </div>

  </div>

) : null}
                <div className={s.shipmentBox}>
                  <div className={s.shipmentHead}>
                    <span className={s.shipmentTitle}>Kargo</span>

                    {r.shippingStatus ? (
                      <span className={s.shipmentBadge}>{r.shippingStatus}</span>
                    ) : (
                      <span className={s.shipmentMuted}>Henüz oluşturulmadı</span>
                    )}
                  </div>

                  {(() => {
                    const _s = (v: unknown) => String(v ?? "").trim();
                    const cTrackingNumber =
                      _s(r.trackingNumber) ||
                      _s((r.shippingBarcodeRaw as any)?.barcodes?.[0]?.barcode);
                    const cShipmentId =
                      _s(r.shipmentId) ||
                      _s((r.shippingBarcodeRaw as any)?.shipmentId);
                    const cReferenceId =
                      _s(r.shippingReferenceId) ||
                      _s(r.shipmentRef) ||
                      _s((r.shippingBarcodeRaw as any)?.referenceId);
                    const cInvoiceId =
                      _s(r.shippingInvoiceId) ||
                      _s(r.shippingOrderInvoiceId) ||
                      _s(r.shippingBarcodeInvoiceId) ||
                      _s((r.shippingBarcodeRaw as any)?.invoiceId);
                    const cTrackingUrl = cTrackingNumber
                      ? `https://www.mngkargo.com.tr/gonderitakip?takipno=${encodeURIComponent(cTrackingNumber)}`
                      : _s(r.trackingUrl);

                    return (
                      <>
                        <div className={s.shipmentMeta}>
                          {r.shippingProvider ? <span>Provider: {r.shippingProvider}</span> : null}
                          {cTrackingNumber ? <span>Takip No: {cTrackingNumber}</span> : null}
                          {cShipmentId ? <span>ShipmentId: {cShipmentId}</span> : null}
                          {cReferenceId ? <span>Ref: {cReferenceId}</span> : null}
                          {cInvoiceId ? <span>Invoice: {cInvoiceId}</span> : null}
                        </div>

                        <div className={s.shipmentActionsInline}>
                          {cTrackingUrl ? (
                            <a
                              href={cTrackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={s.secondaryBtn}
                            >
                              Takibi Aç
                            </a>
                          ) : null}

                          {r.labelUrl ? (
                            <a
                              href={r.labelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={s.secondaryBtn}
                            >
                              Label
                            </a>
                          ) : null}

                          {!r.labelUrl && r.labelZpl ? (
                            <button
                              type="button"
                              className={s.secondaryBtn}
                              onClick={() => {
                                navigator.clipboard.writeText(String(r.labelZpl || ""));
                                toast.success("ZPL label panoya kopyalandı.");
                              }}
                            >
                              ZPL Kopyala
                            </button>
                          ) : null}

                          {cTrackingNumber ? (
                            <button
                              type="button"
                              className={s.secondaryBtn}
                              onClick={() => {
                                navigator.clipboard.writeText(cTrackingNumber);
                                toast.success("Takip No kopyalandı.");
                              }}
                            >
                              Takip No Kopyala
                            </button>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className={s.cardMid}>
                  <div className={s.customerBox}>
                    <div className={s.boxLabel}>Müşteri</div>
                    <div className={s.customerName}>{name}</div>
                    <div className={s.customerMeta}>
                      {email ? <span>{email}</span> : null}
                      {phone ? <span>{phone}</span> : null}
                      {city ? <span>{city}</span> : null}
                    </div>
                  </div>

                  <div className={s.summaryBox}>
                    <div className={s.metric}>
                      <span>Ürün</span>
                      <b>{itemsCount}</b>
                    </div>
                    <div className={s.metric}>
                      <span>Tutar</span>
                      <b>{fmtTRY(total)}</b>
                    </div>
                  </div>
                </div>

                <div className={s.cardBottom}>
                  <div className={s.leftActions}>
                    <Link href={`/admin/orders/${encodeURIComponent(id)}`} className={s.primaryBtn}>
                      Detay
                    </Link>

                    <Link href={`/admin/orders/${encodeURIComponent(id)}/edit`} className={s.secondaryBtn}>
                      Düzenle
                    </Link>

                    {String(r.status || "") === "pending_payment" ? (
                      <button
                        type="button"
                        className={`${s.successBtn} ${paymentNotify ? s.confirmPaymentHot : ""}`}
                        onClick={() => handleConfirmPayment(id)}
                      >
                        Ödemeyi Onayla
                      </button>
                    ) : null}

                    {canCreateShipment ? (
                      <button
                        type="button"
                        className={s.infoBtn}
                        disabled={creatingShipmentId === id}
                        onClick={() => handleCreateShipment(id)}
                      >
                        {creatingShipmentId === id
                          ? "Recipient / order / barkod oluşturuluyor..."
                          : "Kargo Oluştur"}
                      </button>
                    ) : null}

                    {hasBarcodeError ? (
                      <button
                        type="button"
                        className={s.warnBtn || s.infoBtn}
                        disabled={creatingShipmentId === id}
                        onClick={async () => {
                          const ok = window.confirm(
                            `Kargo bilgileri sıfırlanıp tekrar oluşturulsun mu?\n\n${shortId(id)}\n\nMevcut hatalı kargo kaydı silinip yeniden denenecek.`
                          );
                          if (!ok) return;
                          try {
                            setCreatingShipmentId(id);
                            // Kargo bilgilerini sıfırla
                            await updateDoc(doc(db, "orders", id), {
                              shippingStatus: "",
                              shippingProvider: "",
                              shippingReferenceId: "",
                              shippingOrderInvoiceId: "",
                              shippingOrderInvoiceDetailId: "",
                              shippingShipperBranchCode: "",
                              shippingBarcodeError: "",
                              shippingBarcodeRaw: null,
                              shippingOrderRaw: null,
                              shipmentId: "",
                              shipmentDocId: "",
                              shipmentRef: "",
                              trackingNumber: "",
                              trackingUrl: "",
                              labelUrl: "",
                              labelZpl: "",
                              shippingCancelled: false,
                              updatedAt: serverTimestamp(),
                              updatedAtIso: new Date().toISOString(),
                            });
                            toast.success("Kargo bilgileri sıfırlandı. Şimdi tekrar oluşturabilirsiniz.");
                          } catch (e: any) {
                            console.error("reset shipment error", e);
                            toast.error(String(e?.message || "Kargo sıfırlanamadı."));
                          } finally {
                            setCreatingShipmentId("");
                          }
                        }}
                      >
                        {creatingShipmentId === id ? "Sıfırlanıyor..." : "Kargo Sıfırla"}
                      </button>
                    ) : null}

                    {canCancelShipment ? (
                      <button
                        type="button"
                        className={s.dangerBtn}
                        disabled={cancelShipmentId === id}
                        onClick={() => handleCancelShipment(r)}
                      >
                        {cancelShipmentId === id ? "Kargo iptal ediliyor..." : "Kargoyu İptal Et"}
                      </button>
                    ) : null}

                    {String(r.status || "") === "paid" && !hasShipment ? (
                      <button
                        type="button"
                        className={s.infoBtn}
                        onClick={() => handleQuickStatus(id, "preparing")}
                      >
                        Hazırlanıyor
                      </button>
                    ) : null}

                    {String(r.status || "") === "preparing" && !hasShipment ? (
                      <button
                        type="button"
                        className={s.infoBtn}
                        onClick={() => handleQuickStatus(id, "shipped")}
                      >
                        Kargoya Ver
                      </button>
                    ) : null}

                    {String(r.status || "") === "shipped" ? (
                      <button
                        type="button"
                        className={s.successBtn}
                        onClick={() => handleQuickStatus(id, "delivered")}
                      >
                        Teslim Edildi
                      </button>
                    ) : null}

                    {!["cancelled", "delivered", "paid"].includes(String(r.status || "")) && !hasShipment ? (
                      <button
                        type="button"
                        className={s.dangerBtn}
                        disabled={deletingId === id}
                        onClick={() => handleQuickStatus(id, "cancelled")}
                      >
                        {deletingId === id ? "İptal ediliyor..." : "İptal Et"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && rows.length > 0 ? (
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          padding: "24px 0 8px",
        }}>
          {rows.length >= pageLimit ? (
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => setPageLimit((p) => p + 100)}
            >
              Daha fazla yükle ({pageLimit} / {rows.length} görüntüleniyor)
            </button>
          ) : null}
          {pageLimit > 100 ? (
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => setPageLimit(100)}
            >
              İlk 100'e dön
            </button>
          ) : null}
        </div>
      ) : null}
      {/* ── Kargo Durum Kontrol Modalı ── */}
      {inspectRow ? (() => {
        const ir = inspectRow;
        const sid = shortId(ir.id);

        const stages: { label: string; ok: boolean; detail: string }[] = [
          {
            label: "Sipariş Kaydı",
            ok: !!ir.shippingProvider,
            detail: ir.shippingProvider
              ? `Provider: ${ir.shippingProvider}`
              : "Henüz kargo sağlayıcı atanmamış.",
          },
          {
            label: "Create Order (MNG)",
            ok: !!ir.shippingReferenceId,
            detail: ir.shippingReferenceId
              ? `ReferenceId: ${ir.shippingReferenceId}`
              : "MNG sipariş kaydı oluşturulmamış.",
          },
          {
            label: "InvoiceId",
            ok: !!(ir.shippingInvoiceId || ir.shippingOrderInvoiceId || ir.shippingBarcodeInvoiceId || (ir.shippingBarcodeRaw as any)?.invoiceId),
            detail:
              ir.shippingInvoiceId ||
              ir.shippingOrderInvoiceId ||
              ir.shippingBarcodeInvoiceId ||
              String((ir.shippingBarcodeRaw as any)?.invoiceId || "") ||
              "Yok",
          },
          {
            label: "Barkod",
            ok: !!ir.shipmentId && !ir.shippingBarcodeError,
            detail: ir.shippingBarcodeError
              ? `Hata: ${ir.shippingBarcodeError}`
              : ir.shipmentId
              ? `ShipmentId: ${ir.shipmentId}`
              : "Barkod henüz oluşturulmamış.",
          },
          {
            label: "Tracking Number",
            ok: !!ir.trackingNumber,
            detail: ir.trackingNumber || "Henüz atanmamış.",
          },
          {
            label: "Tracking URL",
            ok: !!ir.trackingUrl,
            detail: ir.trackingUrl || "Yok",
          },
          {
            label: "Label (Etiket)",
            ok: !!(ir.labelUrl || ir.labelZpl),
            detail: ir.labelUrl
              ? "PDF mevcut"
              : ir.labelZpl
              ? "ZPL mevcut"
              : "Etiket yok.",
          },
        ];

        const hasCriticalError = !!ir.shippingBarcodeError || ir.shippingStatus === "barcode_error";
        const isDuplicate = !!ir.shippingOrderAlreadyExists;
        const isCancelled = !!ir.shippingCancelled;
        const overallOk = stages.every((st) => st.ok) && !hasCriticalError && !isCancelled;

        return (
          <div className={s.inspectOverlay} onClick={() => setInspectRow(null)}>
            <div className={s.inspectModal} onClick={(e) => e.stopPropagation()}>
              <div className={s.inspectHead}>
                <div>
                  <div className={s.inspectTitle}>Kargo Durum Kontrolü</div>
                  <div className={s.inspectSub}>{sid} • {ir.shippingProvider?.toUpperCase() || "—"}</div>
                </div>
                <button type="button" className={s.inspectClose} onClick={() => setInspectRow(null)}>✕</button>
              </div>

              {/* Overall Status */}
              <div className={`${s.inspectBanner} ${overallOk ? s.inspectBannerOk : hasCriticalError ? s.inspectBannerBad : s.inspectBannerWarn}`}>
                {overallOk
                  ? "✅ Tüm adımlar başarıyla tamamlanmış. Kargo MNG'ye iletilmiş görünüyor."
                  : hasCriticalError
                  ? "❌ Kargo oluşturma sürecinde hata var. Aşağıdaki adımları kontrol et."
                  : isCancelled
                  ? "🚫 Bu kargo iptal edilmiş."
                  : "⚠️ Bazı adımlar eksik. Detayları aşağıda incele."}
              </div>

              {isDuplicate ? (
                <div className={s.inspectNote}>
                  ℹ️ MNG tarafında bu sipariş numarasına ait kayıt zaten vardı. Sistem duplicate olarak işaretledi.
                </div>
              ) : null}

              {/* Step-by-step */}
              <div className={s.inspectSteps}>
                {stages.map((st, i) => (
                  <div key={i} className={`${s.inspectStep} ${st.ok ? s.inspectStepOk : s.inspectStepFail}`}>
                    <div className={s.inspectStepIcon}>{st.ok ? "✅" : "❌"}</div>
                    <div className={s.inspectStepBody}>
                      <div className={s.inspectStepLabel}>{st.label}</div>
                      <div className={s.inspectStepDetail}>{st.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw Fields */}
              <details className={s.inspectDetails}>
                <summary>Ham Veriler (Debug)</summary>
                <div className={s.inspectRaw}>
                  <div><b>orderId:</b> {ir.id}</div>
                  <div><b>status:</b> {String(ir.status || "—")}</div>
                  <div><b>shippingStatus:</b> {String(ir.shippingStatus || "—")}</div>
                  <div><b>shippingProvider:</b> {String(ir.shippingProvider || "—")}</div>
                  <div><b>shippingReferenceId:</b> {String(ir.shippingReferenceId || "—")}</div>
                  <div><b>shippingOrderInvoiceId:</b> {String(ir.shippingOrderInvoiceId || "—")}</div>
                  <div><b>shippingOrderInvoiceDetailId:</b> {String(ir.shippingOrderInvoiceDetailId || "—")}</div>
                  <div><b>shippingShipperBranchCode:</b> {String(ir.shippingShipperBranchCode || "—")}</div>
                  <div><b>shipmentId:</b> {String(ir.shipmentId || "—")}</div>
                  <div><b>shipmentDocId:</b> {String(ir.shipmentDocId || "—")}</div>
                  <div><b>shipmentRef:</b> {String(ir.shipmentRef || "—")}</div>
                  <div><b>trackingNumber:</b> {String(ir.trackingNumber || "—")}</div>
                  <div><b>trackingUrl:</b> {String(ir.trackingUrl || "—")}</div>
                  <div><b>labelUrl:</b> {String(ir.labelUrl || "—")}</div>
                  <div><b>labelZpl:</b> {ir.labelZpl ? `${String(ir.labelZpl).slice(0, 60)}…` : "—"}</div>
                  <div><b>shippingBarcodeError:</b> {String(ir.shippingBarcodeError || "—")}</div>
                  <div><b>shippingCancelled:</b> {String(ir.shippingCancelled ?? "—")}</div>
                  <div><b>shippingOrderAlreadyExists:</b> {String(ir.shippingOrderAlreadyExists ?? "—")}</div>
                  {ir.shippingOrderRaw ? (
                    <div style={{ marginTop: 8 }}>
                      <b>shippingOrderRaw:</b>
                      <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 200, background: "#f1f5f9", padding: 8, borderRadius: 8, marginTop: 4 }}>
                        {JSON.stringify(ir.shippingOrderRaw, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {ir.shippingBarcodeRaw ? (
                    <div style={{ marginTop: 8 }}>
                      <b>shippingBarcodeRaw:</b>
                      <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 200, background: "#f1f5f9", padding: 8, borderRadius: 8, marginTop: 4 }}>
                        {JSON.stringify(ir.shippingBarcodeRaw, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className={s.inspectFooter}>
                <Link href={`/admin/orders/${ir.id}`} className={s.primaryBtn}>
                  Detay Sayfasına Git
                </Link>
                <button type="button" className={s.secondaryBtn} onClick={() => setInspectRow(null)}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

    </main>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminGate>
      <PermissionGate permission="orders">
        <AdminOrdersPageInner />
      </PermissionGate>
    </AdminGate>
  );
}