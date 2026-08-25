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
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./accountPanels.module.css";

type Locale = "tr" | "en";

type RefundStatus =
  | "pending"
  | "processing"
  | "approved"
  | "refunded"
  | "failed"
  | "rejected"
  | "cancelled"
  | "return_order_created"
  | "return_label_created"
  | "return_label_error"
  | "return_label_failed"
  | "return_label_cancelled"
  | string;

type ReturnShipment = {
  provider?: string;
  carrier?: string;

  trackingNo?: string;
  trackingNumber?: string;
  trackingUrl?: string;

  code?: string;
  returnCode?: string;

  shipmentId?: string;
  shipmentRef?: string;
  shipmentDocId?: string;
  referenceId?: string;
  invoiceId?: string;

  labelUrl?: string;
  labelZpl?: string;

  systemGenerated?: boolean;

  status?:
    | "creating"
    | "order_created"
    | "waiting_customer"
    | "barcode_created"
    | "label_error"
    | "cancelled"
    | "cancel_failed"
    | "failed"
    | "shipped_by_customer"
    | "received_by_store"
    | string;

  createdAt?: any;
  createdAtIso?: string;
  shippedAt?: any;
  shippedAtIso?: string;
  receivedAt?: any;
  receivedAtIso?: string;
  cancelledAt?: any;
  cancelledAtIso?: string;
  updatedAt?: any;
  lastError?: string;
};

type RefundRequest = {
  id: string;
  uid?: string;
  orderId?: string;
  orderDocId?: string;
  merchantOid?: string;
  amountTry?: string | number;
  reason?: string;
  note?: string;
  type?: "full" | "partial" | string;
  status?: RefundStatus;
  createdAt?: any;
  updatedAt?: any;
  approvedAt?: any;
  failedAt?: any;
  rejectReason?: string;
paymentMethod?: string;
paymentProvider?: string;
refundPaymentFlow?: "paytr" | "manual" | string;
refundKind?: "return" | "cancel" | string;
  returnShipment?: ReturnShipment;
  returnShipping?: ReturnShipment;

  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};

type OrderItemMini = {
  productId?: string;
  sku?: string;
  slug?: string;
  image?: string;
  qty?: number;
  title?: {
    tr?: string;
    en?: string;
  };
  unitPrice?: {
    amount?: number;
    currency?: string;
  } | number;
  lineTotal?: {
    amount?: number;
    currency?: string;
  } | number;
};

type OrderMini = {
  id: string;
  uid?: string;
  items?: OrderItemMini[];
  total?: {
    amount?: number;
    currency?: string;
  } | number;
  status?: string;
  createdAt?: any;
  createdAtIso?: string;
};

type Props = {
  uid: string;
  loc: Locale;
};

const RETURN_ADDRESS_TR =
  "DROMOCOB DEMO MAĞAZACILIK A.Ş., İstanbul · Demo Showroom";

const RETURN_ADDRESS_EN =
  "DROMOCOB DEMO MAĞAZACILIK A.Ş., İstanbul · Demo Showroom";

const CARRIERS = [
  "Yurtiçi Kargo",
  "MNG Kargo",
  "Aras Kargo",
  "Sürat Kargo",
  "PTT Kargo",
  "Trendyol Express",
  "Hepsijet",
  "DHL",
  "UPS",
  "Diğer",
];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNumber(v: unknown) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtTRY(v: unknown, loc: Locale) {
  const amount = toNumber(v);

  return new Intl.NumberFormat(loc === "en" ? "en-US" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

function toDate(v: any) {
  try {
    if (v?.toDate) return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "string" && v.trim()) return new Date(v);
    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any, loc: Locale) {
  const d = toDate(v);

  if (!d || Number.isNaN(d.getTime())) {
    return loc === "en" ? "Date pending" : "Tarih bekleniyor";
  }

  return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: RefundStatus, loc: Locale) {
  const v = safeStr(status).toLowerCase();

  const tr: Record<string, string> = {
    pending: "İnceleme bekliyor",
    processing: "İşleniyor",
    approved: "İade onaylandı",
    return_order_created: "İade kargo siparişi oluşturuldu",
    return_label_created: "İade kargo kodu hazır",
    return_label_error: "İade kargo kodunda hata",
    return_label_failed: "İade kargo oluşturulamadı",
    return_label_cancelled: "İade kargo kodu iptal edildi",
    refunded: "Para iadesi tamamlandı",
    failed: "İade başarısız",
    rejected: "Talep reddedildi",
    cancelled: "Talep iptal edildi",
  };

  const en: Record<string, string> = {
    pending: "Pending review",
    processing: "Processing",
    approved: "Refund approved",
    return_order_created: "Return shipment order created",
    return_label_created: "Return shipping code ready",
    return_label_error: "Return shipping code error",
    return_label_failed: "Return shipment failed",
    return_label_cancelled: "Return shipping code cancelled",
    refunded: "Refund completed",
    failed: "Refund failed",
    rejected: "Request rejected",
    cancelled: "Request cancelled",
  };

  return loc === "en" ? en[v] || v || "Unknown" : tr[v] || v || "Bilinmiyor";
}

function statusTone(status: RefundStatus) {
  const v = safeStr(status).toLowerCase();

  if (
    v === "approved" ||
    v === "refunded" ||
    v === "return_order_created" ||
    v === "return_label_created"
  ) {
    return "ok";
  }

  if (
    v === "failed" ||
    v === "rejected" ||
    v === "cancelled" ||
    v === "return_label_error" ||
    v === "return_label_failed" ||
    v === "return_label_cancelled"
  ) {
    return "bad";
  }

  if (v === "processing") return "info";

  return "warn";
}

function typeLabel(type: any, loc: Locale) {
  return safeStr(type) === "partial"
    ? loc === "en"
      ? "Partial refund"
      : "Kısmi iade"
    : loc === "en"
    ? "Full refund"
    : "Tam iade";
}

function pickTitle(loc: Locale, item?: OrderItemMini) {
  const title = item?.title;

  if (loc === "en") {
    return safeStr(title?.en) || safeStr(title?.tr) || "Product";
  }

  return safeStr(title?.tr) || safeStr(title?.en) || "Ürün";
}

function safeImage(src?: string) {
  const v = safeStr(src);
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return v;
  return `/${v.replace(/^\/+/, "")}`;
}

function moneyFromAny(v: any) {
  if (v && typeof v === "object") {
    return Number(v.amount || 0);
  }

  return Number(v || 0);
}

function getReturnShip(row: RefundRequest): ReturnShipment {
  return (row.returnShipping || row.returnShipment || {}) as ReturnShipment;
}

function getMirrorShip(row: RefundRequest): ReturnShipment {
  return (row.returnShipment || row.returnShipping || {}) as ReturnShipment;
}

function getReturnCode(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return (
    safeStr(a.returnCode) ||
    safeStr(a.code) ||
    safeStr(a.trackingNumber) ||
    safeStr(a.trackingNo) ||
    safeStr(b.returnCode) ||
    safeStr(b.code) ||
    safeStr(b.trackingNumber) ||
    safeStr(b.trackingNo)
  );
}

function getTrackingUrl(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return safeStr(a.trackingUrl) || safeStr(b.trackingUrl);
}

function getCarrier(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return (
    safeStr(a.carrier) ||
    safeStr(b.carrier) ||
    (safeStr(a.provider || b.provider) === "mng" ? "MNG Kargo" : "") ||
    "MNG Kargo"
  );
}

function getShipmentStatus(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return safeStr(b.status || a.status);
}

function isGeneratedReturnCodeReady(row: RefundRequest) {
  const status = safeStr(row.status).toLowerCase();
  const shipStatus = getShipmentStatus(row);
  const code = getReturnCode(row);

  return Boolean(
    code &&
      status === "return_label_created" &&
      shipStatus !== "cancelled"
  );
}

function isCancelledReturnCode(row: RefundRequest) {
  const status = safeStr(row.status).toLowerCase();
  const shipStatus = getShipmentStatus(row);

  return status === "return_label_cancelled" || shipStatus === "cancelled";
}

function isReturnLabelError(row: RefundRequest) {
  const status = safeStr(row.status).toLowerCase();
  const shipStatus = getShipmentStatus(row);

  return (
    status === "return_label_error" ||
    status === "return_label_failed" ||
    shipStatus === "label_error" ||
    shipStatus === "failed"
  );
}

function isReceivedByStore(row: RefundRequest) {
  return getShipmentStatus(row) === "received_by_store";
}

export default function RefundRequestsPanel({ uid, loc }: Props) {
  const db = useMemo(() => getFirebaseDb(), []);

  const [rows, setRows] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [ordersById, setOrdersById] = useState<Record<string, OrderMini>>({});

  const [carrierById, setCarrierById] = useState<Record<string, string>>({});
  const [trackingById, setTrackingById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    const qy = query(
      collection(db, "refund_requests"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as RefundRequest[];

        setRows(next);
        setLoading(false);
      },
      (e) => {
        console.error("refund requests panel load error:", e);
        setErr(
          loc === "en"
            ? "Refund requests could not be loaded."
            : "İade talepleri yüklenemedi."
        );
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid, loc]);

  useEffect(() => {
    if (!uid) {
      setOrdersById({});
      return;
    }

    const qy = query(collection(db, "orders"), where("uid", "==", uid), limit(80));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const map: Record<string, OrderMini> = {};

        snap.docs.forEach((d) => {
          map[d.id] = {
            id: d.id,
            ...(d.data() as any),
          };
        });

        setOrdersById(map);
      },
      (e) => {
        console.error("refund panel orders load error:", e);
        setOrdersById({});
      }
    );

    return () => unsub();
  }, [db, uid]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const st = safeStr(row.status || "pending").toLowerCase();

        acc.total += 1;

        if (
          st === "approved" ||
          st === "return_order_created" ||
          st === "return_label_created"
        ) {
          acc.approved += 1;
        } else if (st === "refunded") {
          acc.refunded += 1;
        } else if (
          st === "failed" ||
          st === "rejected" ||
          st === "cancelled" ||
          st === "return_label_error" ||
          st === "return_label_failed" ||
          st === "return_label_cancelled"
        ) {
          acc.closed += 1;
        } else {
          acc.active += 1;
        }

        return acc;
      },
      { total: 0, active: 0, approved: 0, refunded: 0, closed: 0 }
    );
  }, [rows]);

  async function submitReturnShipment(row: RefundRequest) {
    const refundId = safeStr(row.id);
    if (!refundId) return;

    const carrier = safeStr(carrierById[refundId]) || safeStr(row.returnShipment?.carrier);
    const trackingNo = safeStr(trackingById[refundId]) || safeStr(row.returnShipment?.trackingNo);

    if (!carrier) {
      setErr(loc === "en" ? "Please select a shipping company." : "Lütfen kargo firmasını seç.");
      return;
    }

    if (!trackingNo) {
      setErr(loc === "en" ? "Please enter the tracking number." : "Lütfen takip numarasını gir.");
      return;
    }

    if (trackingNo.length < 4) {
      setErr(
        loc === "en"
          ? "Tracking number looks too short."
          : "Takip numarası çok kısa görünüyor."
      );
      return;
    }

    try {
      setSavingId(refundId);
      setErr("");
      setOk("");

      await updateDoc(doc(db, "refund_requests", refundId), {
        "returnShipment.carrier": carrier,
        "returnShipment.trackingNo": trackingNo,
        "returnShipment.trackingNumber": trackingNo,
        "returnShipment.status": "shipped_by_customer",
        "returnShipment.shippedAt": serverTimestamp(),
        "returnShipment.shippedAtIso": new Date().toISOString(),
        "returnShipment.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOk(
        loc === "en"
          ? "Return shipment information has been sent. We will track your package."
          : "İade kargo bilgilerin gönderildi. Paketi takip edeceğiz."
      );
    } catch (e) {
      console.error("submit return shipment error:", e);
      setErr(
        loc === "en"
          ? "Return shipment information could not be saved."
          : "İade kargo bilgileri kaydedilemedi."
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className={s.panel}>
      <div className={s.hero}>
        <div>
          <div className={s.kicker}>
            {loc === "en" ? "Refund Center" : "İade Merkezi"}
          </div>

          <h2 className={s.title}>
            {loc === "en" ? "Refund Requests" : "İade Taleplerim"}
          </h2>

          <p className={s.desc}>
            {loc === "en"
              ? "Track your refund requests, return shipment and payment refund status from one secure area."
              : "İade taleplerini, iade kargo sürecini ve para iadesi durumunu tek güvenli alandan takip edebilirsin."}
          </p>
        </div>

        <div className={s.stats}>
          <div className={s.stat}>
            <span>{loc === "en" ? "Total" : "Toplam"}</span>
            <b>{counts.total}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "Active" : "Aktif"}</span>
            <b>{counts.active}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "Approved" : "Onaylı"}</span>
            <b>{counts.approved}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "Refunded" : "İade"}</span>
            <b>{counts.refunded}</b>
          </div>
        </div>
      </div>

      {err ? <div className={s.alertBad}>{err}</div> : null}
      {ok ? <div className={s.alertOk}>{ok}</div> : null}

      <div className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h3>{loc === "en" ? "Request history" : "Talep geçmişi"}</h3>
            <p>
              {loc === "en"
                ? "The latest 50 refund requests are listed."
                : "Son 50 iade talebi listelenir."}
            </p>
          </div>

          <span className={s.livePill}>
            <span />
            {loc === "en" ? "Live" : "Canlı"}
          </span>
        </div>

        {loading ? (
          <div className={s.empty}>
            {loc === "en" ? "Loading refund requests..." : "İade talepleri yükleniyor..."}
          </div>
        ) : rows.length === 0 ? (
          <div className={s.empty}>
            <b>{loc === "en" ? "No refund request yet." : "Henüz iade talebin yok."}</b>
            <small>
              {loc === "en"
                ? "You can create a request from an eligible order detail page."
                : "Uygun sipariş detay sayfasından iade talebi oluşturabilirsin."}
            </small>
          </div>
        ) : (
          <div className={s.list}>
            {rows.map((row) => {
              const refundId = safeStr(row.id);
              const status = safeStr(row.status || "pending").toLowerCase();
              const tone = statusTone(row.status || "pending");
const paymentProvider = safeStr(row.paymentProvider).toLowerCase();
const refundFlow = safeStr(row.refundPaymentFlow).toLowerCase();
const paymentMethod = safeStr(row.paymentMethod).toLowerCase();

const isPaytrRefund =
  refundFlow === "paytr" ||
  paymentProvider === "paytr" ||
  paymentMethod === "card";

const isManualRefund =
  refundFlow === "manual" ||
  paymentProvider === "manual" ||
  paymentMethod === "eft" ||
  paymentMethod === "havale" ||
  paymentMethod === "transfer";

const isOrderCancelRefund =
  safeStr(row.reason).toLocaleLowerCase("tr-TR").includes("sipariş iptali") ||
  safeStr(row.refundKind).toLowerCase() === "cancel";
              const referenceNo =
                safeStr(row.paytr?.referenceNo) ||
                safeStr(row.paytr?.response?.reference_no);

              const orderKey = safeStr(row.orderDocId || row.orderId);
              const order = ordersById[orderKey];

              const firstItem = Array.isArray(order?.items) ? order.items[0] : null;

              const productTitle = pickTitle(loc, firstItem || undefined);
              const productImage = safeImage(firstItem?.image);
              const productQty = Number(firstItem?.qty || 1) || 1;
              const productSku = safeStr(firstItem?.sku);
              const productSlug = safeStr(firstItem?.slug);

              const productHref = productSlug
                ? `/products/${encodeURIComponent(productSlug)}`
                : "/shop";

              const productLineTotal = moneyFromAny(firstItem?.lineTotal);

              const returnCode = getReturnCode(row);
              const carrier = getCarrier(row);
              const trackingUrl = getTrackingUrl(row);
              const generatedReady = isGeneratedReturnCodeReady(row);
              const cancelledCode = isCancelledReturnCode(row);
              const labelError = isReturnLabelError(row);
              const receivedByStore = isReceivedByStore(row);

              const shipmentStatus = getShipmentStatus(row);
              const existingCarrier = safeStr(row.returnShipment?.carrier);
              const existingTrackingNo =
                safeStr(row.returnShipment?.trackingNo) ||
                safeStr(row.returnShipment?.trackingNumber);

              const isApproved = status === "approved";
              const isRefunded = status === "refunded";

              const hasManualShipment =
                shipmentStatus === "shipped_by_customer" && existingTrackingNo;

              const shouldShowManualFallback =
                isApproved &&
                !isOrderCancelRefund &&
                !isRefunded &&
                !generatedReady &&
                !cancelledCode &&
                !labelError &&
                !hasManualShipment;

              return (
                <article key={row.id} className={s.rowCard}>
                  <div className={s.rowTop}>
                    <div>
                      <div className={s.rowTitle}>
                        {typeLabel(row.type, loc)} • {fmtTRY(row.amountTry, loc)}
                      </div>

                      <div className={s.rowMeta}>
                        <span>
                          {loc === "en" ? "Order" : "Sipariş"}:{" "}
                          <Link href={`/account/orders/${encodeURIComponent(orderKey)}`}>
                            #{orderKey.slice(0, 12).toUpperCase()}
                          </Link>
                        </span>

                        <span>•</span>

                        <span>{fmtDate(row.createdAt, loc)}</span>
                      </div>
                    </div>

                    <span className={`${s.badge} ${s[`badge_${tone}`]}`}>
                      {statusLabel(row.status || "pending", loc)}
                    </span>
                  </div>

                  <div className={s.productMini}>
                    <Link href={productHref} className={s.productImageBox}>
                      {productImage ? (
                        <img src={productImage} alt={productTitle} />
                      ) : (
                        <span>✦</span>
                      )}
                    </Link>

                    <div className={s.productMiniBody}>
                      <Link href={productHref} className={s.productMiniTitle}>
                        {productTitle}
                      </Link>

                      <div className={s.productMiniMeta}>
                        <span>
                          {loc === "en" ? "Qty" : "Adet"}: <b>{productQty}</b>
                        </span>

                        {productSku ? (
                          <>
                            <span>•</span>
                            <span>
                              SKU: <b>{productSku}</b>
                            </span>
                          </>
                        ) : null}

                        {productLineTotal > 0 ? (
                          <>
                            <span>•</span>
                            <span>
                              {loc === "en" ? "Product total" : "Ürün toplamı"}:{" "}
                              <b>{fmtTRY(productLineTotal, loc)}</b>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className={s.infoGrid}>
                    <div className={s.infoBox}>
                      <span>{loc === "en" ? "Reason" : "Sebep"}</span>
                      <b>{safeStr(row.reason) || "—"}</b>
                    </div>

                   <div className={s.infoBox}>
  <span>{isPaytrRefund ? "PayTR OID" : loc === "en" ? "Refund Ref" : "İade Referansı"}</span>
  <b>{safeStr(row.merchantOid) || "—"}</b>
</div>

<div className={s.infoBox}>
  <span>{isPaytrRefund ? "PayTR Ref" : loc === "en" ? "Refund Flow" : "İade Akışı"}</span>
  <b>
    {isPaytrRefund
      ? referenceNo || "—"
      : loc === "en"
      ? "Manual store refund"
      : "Mağaza tarafından manuel iade"}
  </b>
</div>
                  </div>

                  {safeStr(row.note) ? (
                    <div className={s.noteBox}>
                      <b>{loc === "en" ? "Your note" : "Notun"}:</b>{" "}
                      {safeStr(row.note)}
                    </div>
                  ) : null}

                  {safeStr(row.rejectReason) ? (
                    <div className={s.alertBadSmall}>
                      {loc === "en" ? "Rejection reason" : "Red sebebi"}:{" "}
                      {safeStr(row.rejectReason)}
                    </div>
                  ) : null}

                  {generatedReady ? (
                    <div className={s.returnTrackingBox}>
                      <div>
                        <span>
                          {loc === "en" ? "Return shipping code" : "İade kargo kodun"}
                        </span>
                        <b>
                          {carrier} • {returnCode}
                        </b>
                      </div>

                      <small>
                        {loc === "en"
                          ? "You can deliver the product to the contracted MNG branch with this code."
                          : "Bu kod ile ürünü anlaşmalı MNG Kargo şubesinden ücretsiz iade gönderebilirsin."}
                      </small>

                      {trackingUrl ? (
                        <Link href={trackingUrl} target="_blank" rel="noreferrer">
                          {loc === "en" ? "Track return shipment" : "İade kargosunu takip et"}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}

                  {cancelledCode ? (
                    <div className={s.alertBadSmall}>
                      {loc === "en"
                        ? "Your return shipping code has been cancelled. Please contact support if you need a new code."
                        : "İade kargo kodun iptal edildi. Yeni kod gerekiyorsa destek ekibimizle iletişime geçebilirsin."}
                    </div>
                  ) : null}

                  {labelError ? (
                    <div className={s.alertBadSmall}>
                      {safeStr(row.returnShipment?.lastError || row.returnShipping?.lastError) ||
                        (loc === "en"
                          ? "Return shipping code could not be created. Our team will contact you."
                          : "İade kargo kodu oluşturulamadı. Ekibimiz seninle iletişime geçecek.")}
                    </div>
                  ) : null}

                  {receivedByStore ? (
                    <div className={s.alertOkSmall}>
                      {loc === "en"
                        ? "Your return package has been received by our team. Refund review is in progress."
                        : "İade paketin ekibimiz tarafından teslim alındı. Para iadesi kontrol süreci devam ediyor."}
                    </div>
                  ) : null}

                  {shouldShowManualFallback ? (
                    <div className={s.returnShipBox}>
                      <div className={s.returnShipHead}>
                        <div>
                          <h4>
                            {loc === "en"
                              ? "Send the product to the return address"
                              : "Ürünü iade adresine gönder"}
                          </h4>
                          <p>
                            {loc === "en"
                              ? "Your refund request has been approved. If you were not given a contracted return code, ship the product and enter your tracking number."
                              : "İade talebin onaylandı. Anlaşmalı iade kodu görünmüyorsa ürünü kargoya verip takip numaranı buraya girebilirsin."}
                          </p>
                        </div>
                      </div>

                      <div className={s.returnAddressBox}>
                        <span>{loc === "en" ? "Return address" : "İade adresi"}</span>
                        <b>{loc === "en" ? RETURN_ADDRESS_EN : RETURN_ADDRESS_TR}</b>
                      </div>

                      <div className={s.returnForm}>
                        <label className={s.returnField}>
                          <span>{loc === "en" ? "Shipping company" : "Kargo firması"}</span>
                          <select
                            value={carrierById[refundId] || existingCarrier || ""}
                            onChange={(e) =>
                              setCarrierById((prev) => ({
                                ...prev,
                                [refundId]: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {loc === "en" ? "Select carrier" : "Kargo firması seç"}
                            </option>
                            {CARRIERS.map((carrierName) => (
                              <option key={carrierName} value={carrierName}>
                                {carrierName}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={s.returnField}>
                          <span>{loc === "en" ? "Tracking number" : "Takip numarası"}</span>
                          <input
                            value={trackingById[refundId] || existingTrackingNo || ""}
                            onChange={(e) =>
                              setTrackingById((prev) => ({
                                ...prev,
                                [refundId]: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder={
                              loc === "en"
                                ? "Enter your tracking number"
                                : "Takip numaranı yaz"
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className={s.returnSubmitBtn}
                          disabled={savingId === refundId}
                          onClick={() => submitReturnShipment(row)}
                        >
                          {savingId === refundId
                            ? loc === "en"
                              ? "Saving..."
                              : "Kaydediliyor..."
                            : loc === "en"
                            ? "I shipped the product"
                            : "Kargoya verdim"}
                        </button>
                      </div>

                      <div className={s.returnShipNote}>
                        {loc === "en"
                          ? "After we receive and inspect the product, the payment refund will be processed."
                          : "Ürün bize ulaşıp kontrol edildikten sonra para iadesi işlemi başlatılır."}
                      </div>
                    </div>
                  ) : null}

                  {hasManualShipment ? (
                    <div className={s.returnTrackingBox}>
                      <div>
                        <span>
                          {loc === "en" ? "Return shipment sent" : "İade kargosu gönderildi"}
                        </span>
                        <b>
                          {existingCarrier || carrier} • {existingTrackingNo}
                        </b>
                      </div>
                      <small>
                        {loc === "en" ? "Shipment date" : "Kargoya veriliş"}:{" "}
                        {fmtDate(row.returnShipment?.shippedAt || row.returnShipment?.shippedAtIso, loc)}
                      </small>
                    </div>
                  ) : null}

                 {isRefunded ? (
                    <div className={s.alertOkSmall}>
                      {isManualRefund
                        ? loc === "en"
                          ? "Your refund has been completed manually by the store."
                          : "Para iaden mağaza tarafından manuel olarak tamamlandı."
                        : loc === "en"
                        ? "Your payment refund has been completed."
                        : "Para iaden tamamlandı."}
                    </div>
                  ) : null}

                  {safeStr(row.paytr?.error) ? (
                    <div className={s.alertBadSmall}>{safeStr(row.paytr?.error)}</div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}