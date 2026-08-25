"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import {
  addDoc,
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
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "@/styles/order-detail.module.css";

type Money = { amount: number; currency?: string };
type LocaleText = { tr?: string; en?: string };

type OrderItem = {
  productId: string;
  sku?: string;
  title?: { tr?: string; en?: string };
  qty: number;
  unitPrice?: Money | number;
  lineTotal?: Money | number;
  image?: string;
  slug?: string;
  customText?: string;
  productCustomText?: string;
  engravingText?: string;
  personalizationText?: string;
  variant?: Record<string, string>;

  selectedSize?: string;
  selectedVariants?: Record<string, string>;
  selectedVariantItems?: Array<{
    groupId?: string;
    groupLabel?: string;
    value?: string;
    label?: string;
    priceDelta?: number;
  }>;
};

type Address = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;

  city?: string;
  district?: string;
  cityName?: string;
  districtName?: string;

  addressLine?: string;
  line1?: string;
  line2?: string;
  postalCode?: string;
  note?: string;

  invoiceType?: "individual" | "company";

  nationalId?: string;

  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
};

type CustomerInfo = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
};
type BankTransferSettings = {
  isActive?: boolean;
  companyName?: string;
  bankName?: string;
  branchName?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  currency?: string;
  note?: string;
  supportPhone?: string;
  supportWhatsApp?: string;
};
type OrderDoc = {
  uid: string;
  email?: string;
  status?: string;
  items?: OrderItem[];
  subtotal?: Money | number;
  shippingFee?: Money | number;
  discount?: Money | number;
  total?: Money | number;
  shippingAddress?: Address;
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
  shippingInvoiceId?: string;
  shippingCancelled?: boolean;
  shippingCancelledAtIso?: string;
  shippingBarcodeError?: string;
  customer?: CustomerInfo;
  billing?: {
    invoiceType?: "individual" | "company";
    firstName?: string;
    lastName?: string;
    phone?: string;
    nationalId?: string;
    companyName?: string;
    taxNumber?: string;
    taxOffice?: string;
  };
  payment?: {
    provider?: string;
    method?: string;
    paidAt?: any;
    ref?: string;
  };
    customerPaymentNotified?: boolean;
  customerPaymentNotifiedAt?: any;
  customerPaymentNotifiedAtIso?: string;
  customerPaymentNote?: string;

  paymentNotification?: {
    notified?: boolean;
    notifiedAt?: any;
    notifiedAtIso?: string;
    note?: string;
    source?: string;
  };
  giftPackage?: boolean;
giftWrap?: boolean;
giftNote?: string;
giftMessage?: string;
giftPackageNote?: string;

selectedServices?: Array<{
  id?: string;
  code?: string;
  title?: any;
  priceTry?: number;
  isGiftPackage?: boolean;
}>;

packaging?: {
  gift?: boolean;
  giftPackage?: boolean;
  giftWrap?: boolean;
  note?: string;
  message?: string;
};

gift?: {
  enabled?: boolean;
  note?: string;
  message?: string;
};
  paymentStatus?: string;
  refundStatus?: string;
  refundedTotal?: Money | number;
  createdAt?: any;
  createdAtIso?: string;
  updatedAt?: any;
  updatedAtIso?: string;
  adminNote?: string;
};
type ReturnShipmentInfo = {
  provider?: string;
  carrier?: string;

  status?: string;

  code?: string;
  returnCode?: string;

  trackingNo?: string;
  trackingNumber?: string;
  trackingUrl?: string;

  shipmentId?: string;
  shipmentRef?: string;
  shipmentDocId?: string;
  referenceId?: string;
  invoiceId?: string;

  systemGenerated?: boolean;

  createdAt?: any;
  createdAtIso?: string;
  cancelledAt?: any;
  cancelledAtIso?: string;
  receivedAt?: any;
  receivedAtIso?: string;

  lastError?: string;
};

type RefundRequestDoc = {
  id: string;
  uid?: string;
  orderId?: string;
  orderDocId?: string;
  merchantOid?: string;
  amountTry?: string | number;
  reason?: string;
  note?: string;
  type?: "full" | "partial" | string;
  status?:
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

  createdAt?: any;
  updatedAt?: any;

  returnShipping?: ReturnShipmentInfo;
  returnShipment?: ReturnShipmentInfo;

  rejectReason?: string;

  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};
function pickLT(loc: Locale, v?: LocaleText, fb = "") {
  const t = loc === "en" ? String(v?.en ?? "") : String(v?.tr ?? "");
  return t.trim() || fb;
}

function moneyVal(x: any): { amount: number; currency: string } {
  if (x && typeof x === "object") {
    const amount = Number(x.amount ?? 0);
    const currency = String(x.currency || "TRY");
    return { amount: Number.isFinite(amount) ? amount : 0, currency };
  }
  const amount = Number(x ?? 0);
  return { amount: Number.isFinite(amount) ? amount : 0, currency: "TRY" };
}

function fmtMoney(x: any, loc: Locale) {
  const m = moneyVal(x);
  const locale = loc === "en" ? "en-US" : "tr-TR";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency || "TRY",
    }).format(m.amount);
  } catch {
    return `${m.amount.toFixed(2)} ${m.currency || "TRY"}`;
  }
}

function toDateSafe(v: any, fallbackIso?: string) {
  try {
    if (v?.toDate && typeof v.toDate === "function") {
      const d = v.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (fallbackIso && typeof fallbackIso === "string") {
      const d = new Date(fallbackIso);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any, loc: Locale, fallbackIso?: string) {
  const d = toDateSafe(v, fallbackIso);
  if (!d) return loc === "en" ? "Date unavailable" : "Tarih bekleniyor";

  try {
    return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function statusLabel(statusRaw: string, loc: Locale) {
  const v = (statusRaw || "").trim() || "pending_payment";

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

  return loc === "en" ? en[v] || v : tr[v] || v;
}

function statusTone(statusRaw: string) {
  const v = (statusRaw || "").trim();
  if (v === "paid" || v === "delivered") return "ok";
  if (v === "cancelled" || v === "refunded") return "bad";
  if (v === "shipped" || v === "preparing") return "mid";
  return "warn";
}

function maskNationalId(v?: string) {
  const s = String(v || "").replace(/\D+/g, "");
  if (s.length !== 11) return "—";
  return `${s.slice(0, 3)}******${s.slice(-2)}`;
}

function safeImage(src?: string) {
  const v = String(src || "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return v;
  return `/${v.replace(/^\/+/, "")}`;
}
function boolFromAny(v: any): boolean {
  if (v === true) return true;

  if (typeof v === "string") {
    const x = v.trim().toLowerCase();
    return ["true", "1", "yes", "evet", "on", "gift", "hediye"].includes(x);
  }

  if (typeof v === "number") return v === 1;

  return false;
}

function pickAnyText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return String(v || "").trim();

  if (typeof v === "object") {
    return (
      String(v.tr || "").trim() ||
      String(v.en || "").trim() ||
      String(v.title || "").trim() ||
      String(v.label || "").trim() ||
      ""
    );
  }

  return "";
}

function resolveGiftInfo(order: OrderDoc | null) {
  const d: any = order || {};
  const packaging = d.packaging || {};
  const gift = d.gift || {};
  const services = Array.isArray(d.selectedServices) ? d.selectedServices : [];

  const giftService = services.find((service: any) => {
    const hay = [
      service?.id,
      service?.code,
      pickAnyText(service?.title),
      service?.label,
      service?.name,
    ]
      .map((x) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
      .join(" ");

    return (
      service?.isGiftPackage === true ||
      hay.includes("hediye") ||
      hay.includes("gift") ||
      hay.includes("paket")
    );
  });

  const enabled =
    boolFromAny(d.giftPackage) ||
    boolFromAny(d.giftWrap) ||
    boolFromAny(packaging.gift) ||
    boolFromAny(packaging.giftPackage) ||
    boolFromAny(packaging.giftWrap) ||
    boolFromAny(gift.enabled) ||
    Boolean(giftService);

  const note =
    String(d.giftNote || "").trim() ||
    String(d.giftMessage || "").trim() ||
    String(d.giftPackageNote || "").trim() ||
    String(packaging.note || "").trim() ||
    String(packaging.message || "").trim() ||
    String(gift.note || "").trim() ||
    String(gift.message || "").trim();

  const serviceTitle = giftService ? pickAnyText(giftService.title) : "";

  return {
    enabled,
    note,
    serviceTitle,
  };
}
function getItemCustomText(item: any) {
  return String(
    item?.customText ||
      item?.productCustomText ||
      item?.engravingText ||
      item?.personalizationText ||
      ""
  )
    .trim()
    .slice(0, 240);
}
function fullAddress(a?: Address) {
  if (!a) return "—";
  const line1 = String(a.addressLine || a.line1 || "").trim();
  const line2 = String(a.line2 || "").trim();
  return [line1, line2].filter(Boolean).join(" / ") || "—";
}

function fullNameFromAddress(a?: Address) {
  if (!a) return "—";
  const full = String(a.fullName || "").trim();
  if (full) return full;
  const composed = `${String(a.firstName || "").trim()} ${String(a.lastName || "").trim()}`.trim();
  return composed || "—";
}

function cityDistrict(a?: Address) {
  if (!a) return "—";
  const district = String(a.district || a.districtName || "").trim();
  const city = String(a.city || a.cityName || "").trim();
  return [district, city].filter(Boolean).join(" / ") || "—";
}

function getPaymentKind(order: OrderDoc | null): "card" | "transfer" | "unknown" {
  const method = String(order?.payment?.method || "").trim().toLowerCase();
  const provider = String(order?.payment?.provider || "").trim().toLowerCase();
  const ref = String(order?.payment?.ref || "").trim().toLowerCase();

  if (provider === "paytr") return "card";
  if (method === "card") return "card";
  if (ref.includes("paytr")) return "card";

  if (provider === "manual") return "transfer";
  if (method === "eft" || method === "havale" || method === "transfer") {
    return "transfer";
  }

  return "unknown";
}
function refundStatusLabel(raw: any, loc: Locale) {
  const v = String(raw || "").trim().toLowerCase();

  const tr: Record<string, string> = {
    pending: "İnceleme bekliyor",
    processing: "İşleniyor",
    approved: "İade onaylandı",
    return_order_created: "İade kargo siparişi oluşturuldu",
    return_label_created: "İade kargo kodu hazır",
    return_label_error: "İade kargo kodu hatalı",
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

function refundTone(raw: any) {
  const v = String(raw || "").trim().toLowerCase();

  if (
    v === "approved" ||
    v === "return_order_created" ||
    v === "return_label_created" ||
    v === "refunded"
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

  if (v === "processing") return "mid";

  return "warn";
}
function getRefundShip(r?: RefundRequestDoc | null): ReturnShipmentInfo {
  return ((r?.returnShipping || r?.returnShipment || {}) as ReturnShipmentInfo);
}

function getRefundMirrorShip(r?: RefundRequestDoc | null): ReturnShipmentInfo {
  return ((r?.returnShipment || r?.returnShipping || {}) as ReturnShipmentInfo);
}

function getReturnCode(r?: RefundRequestDoc | null) {
  const a = getRefundShip(r);
  const b = getRefundMirrorShip(r);

  return (
    String(a.returnCode || "").trim() ||
    String(a.code || "").trim() ||
    String(a.trackingNumber || "").trim() ||
    String(a.trackingNo || "").trim() ||
    String(b.returnCode || "").trim() ||
    String(b.code || "").trim() ||
    String(b.trackingNumber || "").trim() ||
    String(b.trackingNo || "").trim()
  );
}

function getReturnTrackingUrl(r?: RefundRequestDoc | null) {
  const a = getRefundShip(r);
  const b = getRefundMirrorShip(r);

  return String(a.trackingUrl || b.trackingUrl || "").trim();
}

function getReturnCarrier(r?: RefundRequestDoc | null) {
  const a = getRefundShip(r);
  const b = getRefundMirrorShip(r);

  return (
    String(a.carrier || "").trim() ||
    String(b.carrier || "").trim() ||
    (String(a.provider || b.provider || "").trim() === "mng" ? "MNG Kargo" : "") ||
    "MNG Kargo"
  );
}

function getReturnShipmentStatus(r?: RefundRequestDoc | null) {
  const a = getRefundShip(r);
  const b = getRefundMirrorShip(r);

  return String(b.status || a.status || "").trim().toLowerCase();
}

function isReturnCodeReady(r?: RefundRequestDoc | null) {
  const status = String(r?.status || "").trim().toLowerCase();
  const shipStatus = getReturnShipmentStatus(r);
  const code = getReturnCode(r);

  return Boolean(code && status === "return_label_created" && shipStatus !== "cancelled");
}

function isReturnCodeCancelled(r?: RefundRequestDoc | null) {
  const status = String(r?.status || "").trim().toLowerCase();
  const shipStatus = getReturnShipmentStatus(r);

  return status === "return_label_cancelled" || shipStatus === "cancelled";
}

function isReturnCodeError(r?: RefundRequestDoc | null) {
  const status = String(r?.status || "").trim().toLowerCase();
  const shipStatus = getReturnShipmentStatus(r);

  return (
    status === "return_label_error" ||
    status === "return_label_failed" ||
    shipStatus === "label_error" ||
    shipStatus === "failed"
  );
}

function isReturnReceived(r?: RefundRequestDoc | null) {
  return getReturnShipmentStatus(r) === "received_by_store";
}
function canRequestRefund(order: OrderDoc | null) {
  if (!order) return false;

  const status = String(order.status || "").trim().toLowerCase();
  const paymentStatus = String((order as any).paymentStatus || "").trim().toLowerCase();
  const provider = String(order.payment?.provider || "").trim().toLowerCase();
  const method = String(order.payment?.method || "").trim().toLowerCase();
  const refundStatus = String((order as any).refundStatus || "").trim().toLowerCase();

  const isCardPaytr =
    provider === "paytr" || method === "card";

  const isTransfer =
    provider === "manual" ||
    method === "transfer" ||
    method === "eft" ||
    method === "havale";

  const allowedStatus = [
    "paid",
    "preparing",
    "shipped",
    "delivered",
  ].includes(status);

  if (!allowedStatus) return false;

  if (refundStatus === "full_refunded") return false;

  // Kartlı siparişlerde ödeme gerçekten paid olmalı.
  if (isCardPaytr) {
    if (paymentStatus && paymentStatus !== "paid") return false;
    return true;
  }

  // Havale/EFT siparişlerde mağaza ödemeyi onayladıysa iade talebi açılabilir.
  if (isTransfer) {
    if (paymentStatus && paymentStatus !== "paid") return false;
    return true;
  }

  return false;
}
function paymentMethodLabel(order: OrderDoc | null, loc: Locale) {
  const kind = getPaymentKind(order);

  if (kind === "card") return loc === "en" ? "Card" : "Kart";
  if (kind === "transfer") return loc === "en" ? "Bank Transfer" : "Havale / EFT";

  return loc === "en" ? "Not specified" : "Belirtilmedi";
}

function displayStatusRaw(order: OrderDoc | null) {
  const status = String(order?.status || "").trim().toLowerCase();
  const paymentStatus = String((order as any)?.paymentStatus || "").trim().toLowerCase();
  const kind = getPaymentKind(order);

  if (kind === "card") {
    if (paymentStatus === "failed" || status === "cancelled") return status || "cancelled";
    if (paymentStatus === "paid" || status === "paid") return "paid";

    // Kart siparişinde kullanıcı ödeme ekranından döndüyse “Ödeme Bekliyor” göstermeyelim.
    // Callback geç kaldıysa bile müşteri tarafında daha doğru ifade bu.
    return "paid";
  }

  return status || "pending_payment";
}
function invoiceTypeLabel(raw: any, loc: Locale) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "company") return loc === "en" ? "Company" : "Kurumsal";
  return loc === "en" ? "Individual" : "Bireysel";
}
function shippingStatusLabel(raw: any, loc: Locale) {
  const v = String(raw || "").trim().toLowerCase();

  const tr: Record<string, string> = {
    created: "Kargo oluşturuldu",
    barcode_error: "Kargo etiketi bekleniyor",
    cancelled: "Kargo iptal edildi",
    shipped: "Kargoya verildi",
    delivered: "Teslim edildi",
  };

  const en: Record<string, string> = {
    created: "Shipment created",
    barcode_error: "Label pending",
    cancelled: "Shipment cancelled",
    shipped: "Shipped",
    delivered: "Delivered",
  };

  return loc === "en" ? en[v] || (v || "Not specified") : tr[v] || (v || "Belirtilmedi");
}

function shippingTone(raw: any) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "created" || v === "shipped") return "ok";
  if (v === "cancelled") return "bad";
  if (v === "barcode_error") return "warn";
  return "mid";
}
export default function OrderDetailClient({ id }: { id: string }) {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [docData, setDocData] = useState<OrderDoc | null>(null);
const [authReady, setAuthReady] = useState(false);
const [refunds, setRefunds] = useState<RefundRequestDoc[]>([]);
const [refundOpen, setRefundOpen] = useState(false);
const [refundBusy, setRefundBusy] = useState(false);
const [refundErr, setRefundErr] = useState("");
const [refundMsg, setRefundMsg] = useState("");
const [refundForm, setRefundForm] = useState({
  type: "full" as "full" | "partial",
  amountTry: "",
  reason: "Ürün İadesi",
  note: "",
});
const [bankSettings, setBankSettings] = useState<BankTransferSettings | null>(null);
const [paymentNotifyBusy, setPaymentNotifyBusy] = useState(false);
const [paymentNotifyMsg, setPaymentNotifyMsg] = useState("");
const [paymentNotifyErr, setPaymentNotifyErr] = useState("");
  const fullOrderCode = `#${String(id || "").toUpperCase()}`;

  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => setLoc((((e as any)?.detail as Locale) || "tr") as Locale);
    window.addEventListener("locale-changed", handler as any);
    return () => window.removeEventListener("locale-changed", handler as any);
  }, []);

useEffect(() => {
  const unsub = onIdTokenChanged(auth, (u) => {
    setUid(u?.uid || null);
    setAuthReady(true);
  });
  return () => unsub();
}, [auth]);

  useEffect(() => {
    setBusy(true);
    setErr("");
    setDocData(null);

    if (!id) {
      setErr(loc === "en" ? "Missing order id." : "Sipariş id eksik.");
      setBusy(false);
      return;
    }

    const ref = doc(db, "orders", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setErr(loc === "en" ? "Order not found." : "Sipariş bulunamadı.");
          setDocData(null);
          setBusy(false);
          return;
        }

        const d = snap.data() as OrderDoc;
        setDocData(d);
        setBusy(false);
      },
      (e) => {
        setErr(e?.message || (loc === "en" ? "Failed to load." : "Yüklenemedi."));
        setDocData(null);
        setBusy(false);
      }
    );

    return () => unsub();
  }, [db, id, loc]);

const isMine = authReady && !!uid && !!docData?.uid && docData.uid === uid;

const items = useMemo(() => {
  return Array.isArray(docData?.items) ? docData.items : [];
}, [docData?.items]);

const giftInfo = useMemo(() => {
  return resolveGiftInfo(docData);
}, [docData]);

// ── GA4 purchase fallback ──
// Success sayfasında purchase event tetiklenememişse (hızlı redirect, tab kapanması vs.)
// burada sipariş detayı açıldığında bir kere gönder.
useEffect(() => {
  if (!id || !docData || !isMine) return;
  if (typeof window === "undefined") return;

  // Sadece ödeme tamamlanmış siparişlerde
  const paymentStatus = String((docData as any)?.paymentStatus || "").trim().toLowerCase();
  const orderStatus = String(docData?.status || "").trim().toLowerCase();
  const isPaid = paymentStatus === "paid" || orderStatus === "paid" || orderStatus === "preparing" || orderStatus === "shipped" || orderStatus === "delivered";
  if (!isPaid) return;

  const ga4Key = `nci_ga4_purchase_sent_${id}`;
  try {
    if (sessionStorage.getItem(ga4Key)) return; // Zaten gönderilmiş
    sessionStorage.setItem(ga4Key, "1");

    const orderItems = Array.isArray(docData?.items) ? docData.items : [];
    if (!orderItems.length) return;

    const totalRaw = docData?.total;
    const totalNum = typeof totalRaw === "object" ? Number((totalRaw as any)?.amount || 0) : Number(totalRaw || 0);
    if (totalNum <= 0) return;

    const discountRaw = docData?.discount;
    const discountNum = typeof discountRaw === "object" ? Number((discountRaw as any)?.amount || 0) : Number(discountRaw || 0);
    const shippingRaw = docData?.shippingFee;
    const shippingNum = typeof shippingRaw === "object" ? Number((shippingRaw as any)?.amount || 0) : Number(shippingRaw || 0);
    const couponCode = String((docData as any)?.coupon?.code || "").trim();

    const dl = ((window as any).dataLayer = (window as any).dataLayer || []);
    dl.push({ ecommerce: null });
    dl.push({
      event: "purchase",
      ecommerce: {
        transaction_id: id,
        currency: "TRY",
        value: totalNum,
        tax: 0,
        shipping: shippingNum,
        ...(couponCode ? { coupon: couponCode } : {}),
        items: orderItems.map((it: any) => {
          const unitRaw = it?.unitPrice;
          const unitNum = typeof unitRaw === "object" ? Number((unitRaw as any)?.amount || 0) : Number(unitRaw || 0);
          const titleStr = typeof it?.title === "object" ? String(it.title?.tr || it.title?.en || "") : String(it?.title || it?.name || "");
          return {
            item_id: String(it?.productId || it?.sku || it?.slug || ""),
            item_name: titleStr,
            item_brand: "Dromocob",
            price: Number(it?.priceTry || unitNum || 0),
            quantity: Number(it?.qty || 1),
          };
        }),
      },
    });
  } catch {
    // GA4 hatası UX'i etkilememeli
  }
}, [id, docData, isMine]);


useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "settings", "payment"),
    (snap) => {
      const data: any = snap.exists() ? snap.data() : {};
      setBankSettings(data?.bankTransfer || null);
    },
    (e) => {
      console.error("bank transfer settings load error:", e);
      setBankSettings(null);
    }
  );

  return () => unsub();
}, [db]);

useEffect(() => {
  if (!authReady || !uid || !id) {
    setRefunds([]);
    return;
  }

  const qy = query(
    collection(db, "refund_requests"),
    where("uid", "==", uid),
    where("orderId", "==", id),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  const unsub = onSnapshot(
    qy,
    (snap) => {
      const list: RefundRequestDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setRefunds(list);
    },
    (e) => {
      console.error("refund requests load error:", e);
      setRefunds([]);
    }
  );

  return () => unsub();
}, [authReady, uid, id, db]);
const status = displayStatusRaw(docData);
const tone = statusTone(status);

  const createdText = fmtDate(docData?.createdAt, loc, docData?.createdAtIso);
  const updatedText = fmtDate(docData?.updatedAt, loc, docData?.updatedAtIso);
const paidText =
  getPaymentKind(docData) === "card" && status === "paid"
    ? fmtDate(docData?.payment?.paidAt, loc, (docData as any)?.paidAtIso) !==
      (loc === "en" ? "Date unavailable" : "Tarih bekleniyor")
      ? fmtDate(docData?.payment?.paidAt, loc, (docData as any)?.paidAtIso)
      : loc === "en"
      ? "Confirmed"
      : "Onaylandı"
    : fmtDate(docData?.payment?.paidAt, loc, (docData as any)?.paidAtIso);  const adminNote = String(docData?.adminNote || "").trim();

const paymentMethod = paymentMethodLabel(docData, loc);  
const paymentProviderRaw = String(docData?.payment?.provider || "").trim().toLowerCase();

const paymentProvider =
  paymentProviderRaw === "paytr"
    ? "PayTR"
    : paymentProviderRaw === "manual"
    ? loc === "en"
      ? "Manual"
      : "Manuel"
    : paymentProviderRaw || (loc === "en" ? "Not specified" : "Belirtilmedi");
const invoiceTypeRaw =
  docData?.billing?.invoiceType ||
  docData?.shippingAddress?.invoiceType ||
  "individual";

const invoiceType = invoiceTypeLabel(invoiceTypeRaw, loc);

const billingNationalId =
  String(
    docData?.billing?.nationalId ||
    docData?.shippingAddress?.nationalId ||
    docData?.customer?.nationalId ||
    ""
  ).trim();

const billingCompanyName = String(
  docData?.billing?.companyName ||
  docData?.shippingAddress?.companyName ||
  ""
).trim();

const billingTaxNumber = String(
  docData?.billing?.taxNumber ||
  docData?.shippingAddress?.taxNumber ||
  ""
).trim();

const billingTaxOffice = String(
  docData?.billing?.taxOffice ||
  docData?.shippingAddress?.taxOffice ||
  ""
).trim();
  const paymentRef = String(docData?.payment?.ref || "").trim() || "—";
  const shippingProvider = String(docData?.shippingProvider || "").trim() || "mng";
  const shippingStatusRaw = String(docData?.shippingStatus || "").trim();
  const shippingStatusText = shippingStatusLabel(shippingStatusRaw, loc);
  const shippingToneClass = shippingTone(shippingStatusRaw);

  const trackingNumber = String(docData?.trackingNumber || "").trim();
  const trackingUrl = String(docData?.trackingUrl || "").trim();
  const shipmentId = String(docData?.shipmentId || "").trim();
  const shipmentRef = String(docData?.shipmentRef || "").trim();
  const shippingReferenceId = String(docData?.shippingReferenceId || "").trim();
  const shippingInvoiceId = String(docData?.shippingInvoiceId || "").trim();
  const shippingBarcodeError = String(docData?.shippingBarcodeError || "").trim();

  const hasShippingInfo =
    !!shippingStatusRaw ||
    !!trackingNumber ||
    !!trackingUrl ||
    !!shipmentId ||
    !!shipmentRef ||
    !!shippingReferenceId;

  const shippingCancelled = Boolean(docData?.shippingCancelled) || shippingStatusRaw === "cancelled";
  const customerName =
    `${String(docData?.customer?.firstName || "").trim()} ${String(docData?.customer?.lastName || "").trim()}`.trim() ||
    fullNameFromAddress(docData?.shippingAddress);
const latestRefund = refunds[0] || null;

const hasActiveRefund = refunds.some((r) => {
  const st = String(r.status || "").trim().toLowerCase();

  return [
    "pending",
    "processing",
    "approved",
    "return_order_created",
    "return_label_created",
    "return_label_error",
    "return_label_failed",
  ].includes(st);
});

const orderTotalNumber = moneyVal(docData?.total).amount;
const refundedNumber = moneyVal((docData as any)?.refundedTotal).amount;
const refundableAmount = Math.max(0, Number((orderTotalNumber - refundedNumber).toFixed(2)));

const canOpenRefund =
  isMine &&
  canRequestRefund(docData) &&
  refundableAmount > 0 &&
  !hasActiveRefund;

const isTransferOrder = getPaymentKind(docData) === "transfer";

const orderStatusRaw = String(docData?.status || "").trim().toLowerCase();
const paymentStatusRaw = String((docData as any)?.paymentStatus || "").trim().toLowerCase();

const isPaymentConfirmed =
  orderStatusRaw === "paid" ||
  orderStatusRaw === "preparing" ||
  orderStatusRaw === "shipped" ||
  orderStatusRaw === "delivered" ||
  paymentStatusRaw === "paid";

const isPaymentPending =
  !isPaymentConfirmed &&
  (
    orderStatusRaw === "pending_payment" ||
    paymentStatusRaw === "pending" ||
    paymentStatusRaw === ""
  );

const customerPaymentNotified =
  Boolean(docData?.customerPaymentNotified) ||
  Boolean(docData?.paymentNotification?.notified);

const bankIban = String(bankSettings?.iban || "").trim();

const bankCompanyName = String(
  bankSettings?.companyName ||
    bankSettings?.accountName ||
    "DROMOCOB DEMO MAĞAZACILIK A.Ş."
).trim();

const bankName = String(bankSettings?.bankName || "").trim();
const bankNote = String(bankSettings?.note || "").trim();

const shouldShowBankTransferBox =
  isMine &&
  isTransferOrder &&
  isPaymentPending &&
  !customerPaymentNotified;

const refundButtonText =
  loc === "en" ? "Create refund request" : "İade Talebi Oluştur";
async function copyPaymentText(value: string, successMessage: string, errorMessage: string) {
  const clean = String(value || "").trim();

  if (!clean) {
    setPaymentNotifyErr(errorMessage);
    window.setTimeout(() => setPaymentNotifyErr(""), 2200);
    return;
  }

  try {
    await navigator.clipboard.writeText(clean);
    setPaymentNotifyMsg(successMessage);
    window.setTimeout(() => setPaymentNotifyMsg(""), 1800);
  } catch {
    setPaymentNotifyErr(errorMessage);
    window.setTimeout(() => setPaymentNotifyErr(""), 2200);
  }
}
async function notifyTransferPaymentDone() {
  setPaymentNotifyErr("");
  setPaymentNotifyMsg("");

  if (!uid || !docData || !isMine) {
    setPaymentNotifyErr(
      loc === "en"
        ? "This order is not accessible."
        : "Bu sipariş erişilebilir değil."
    );
    return;
  }

  if (!isTransferOrder) {
    setPaymentNotifyErr(
      loc === "en"
        ? "This action is only available for bank transfer orders."
        : "Bu işlem yalnızca Havale / EFT siparişleri için kullanılabilir."
    );
    return;
  }

  try {
    setPaymentNotifyBusy(true);

    await updateDoc(doc(db, "orders", id), {
      customerPaymentNotified: true,
      customerPaymentNotifiedAt: serverTimestamp(),
      customerPaymentNotifiedAtIso: new Date().toISOString(),
      customerPaymentNote: "Müşteri Havale/EFT ödemesini yaptığını bildirdi.",

      paymentNotification: {
        notified: true,
        notifiedAt: serverTimestamp(),
        notifiedAtIso: new Date().toISOString(),
        note: "Müşteri Havale/EFT ödemesini yaptığını bildirdi.",
        source: "customer_order_detail",
      },

      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    });

    setPaymentNotifyMsg(
      loc === "en"
        ? "Your payment notification has been sent to the store."
        : "Ödeme bildiriminiz mağazaya iletildi."
    );

    window.setTimeout(() => setPaymentNotifyMsg(""), 4000);
  } catch (e: any) {
    console.error("transfer payment notify error:", e);
    setPaymentNotifyErr(
      e?.message ||
        (loc === "en"
          ? "Payment notification could not be sent."
          : "Ödeme bildirimi gönderilemedi.")
    );
  } finally {
    setPaymentNotifyBusy(false);
  }
}


  async function submitRefundRequest() {
  setRefundErr("");
  setRefundMsg("");

  if (!uid || !docData || !isMine) {
    setRefundErr(loc === "en" ? "This order is not accessible." : "Bu sipariş erişilebilir değil.");
    return;
  }

  if (!canOpenRefund) {
    setRefundErr(
      loc === "en"
        ? "Refund request cannot be created for this order."
        : "Bu sipariş için iade talebi oluşturulamaz."
    );
    return;
  }



  const type = refundForm.type === "partial" ? "partial" : "full";
  const amount =
    type === "full"
      ? refundableAmount
      : Number(String(refundForm.amountTry || "").replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    setRefundErr(loc === "en" ? "Enter a valid refund amount." : "Geçerli bir iade tutarı gir.");
    return;
  }

  if (amount > refundableAmount + 0.001) {
    setRefundErr(
      loc === "en"
        ? "Refund amount cannot exceed refundable amount."
        : "İade tutarı iade edilebilir tutarı aşamaz."
    );
    return;
  }

  const reason = String(refundForm.reason || "").trim();
  if (!reason) {
    setRefundErr(loc === "en" ? "Refund reason is required." : "İade sebebi zorunlu.");
    return;
  }

  try {
    setRefundBusy(true);
const paymentKind = getPaymentKind(docData);
const merchantOid = String(docData.payment?.ref || "").trim();

if (paymentKind === "card" && !merchantOid) {
  setRefundErr(
    loc === "en"
      ? "Payment reference not found."
      : "Ödeme referansı bulunamadı."
  );
  return;
}
   await addDoc(collection(db, "refund_requests"), {
  uid,

  orderId: id,
  orderDocId: id,

  // Kartta PayTR merchantOid/ref gerekir, havalede boş olabilir.
  merchantOid: merchantOid || "",

  paymentMethod: String(docData.payment?.method || ""),
  paymentProvider: String(docData.payment?.provider || ""),
  refundPaymentFlow: paymentKind === "card" ? "paytr" : "manual",

  amountTry: amount.toFixed(2),
  reason,
  note: String(refundForm.note || "").trim(),
  type,
  status: "pending",

  returnShipment: {
    provider: "mng",
    carrier: "MNG Kargo",
    status: "waiting_approval",
    systemGenerated: true,
    updatedAt: serverTimestamp(),
  },

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  updatedAtIso: new Date().toISOString(),
});

    setRefundOpen(false);
    setRefundForm({
      type: "full",
      amountTry: "",
      reason: "Ürün İadesi",
      note: "",
    });

    setRefundMsg(
      loc === "en"
        ? "Refund request has been sent."
        : "İade talebiniz mağazaya iletildi."
    );

    window.setTimeout(() => setRefundMsg(""), 3500);
  } catch (e: any) {
    console.error("refund request create error:", e);
    setRefundErr(
      e?.message ||
        (loc === "en" ? "Refund request could not be created." : "İade talebi oluşturulamadı.")
    );
  } finally {
    setRefundBusy(false);
  }
}

  return (
    <main className={s.page}>
      <div className={s.shell}>
       {busy ? (
  <div className={s.stateCard}>
    <div className={s.stateTitle}>{loc === "en" ? "Loading order..." : "Sipariş yükleniyor..."}</div>
    <div className={s.stateText}>
      {loc === "en" ? "Please wait a moment." : "Bir saniye, sipariş detayları geliyor."}
    </div>
  </div>
) : err ? (
          <div className={`${s.stateCard} ${s.stateError}`}>
            <div className={s.stateTitle}>{loc === "en" ? "Error" : "Hata"}</div>
            <div className={s.stateText}>{err}</div>
            <div className={s.stateActions}>
              <Link href="/account/orders" className={s.secondaryBtn}>
                {loc === "en" ? "Back to orders" : "Siparişlere dön"}
              </Link>
            </div>
          </div>
        ) : !docData ? (
  <div className={`${s.stateCard} ${s.stateError}`}>
    <div className={s.stateTitle}>{loc === "en" ? "Not available" : "Bulunamadı"}</div>
    <div className={s.stateText}>
      {loc === "en" ? "Order not found." : "Sipariş bulunamadı."}
    </div>
  </div>
  
) : !isMine ? (
  <div className={`${s.stateCard} ${s.stateError}`}>
    <div className={s.stateTitle}>{loc === "en" ? "Not available" : "Görüntülenemiyor"}</div>
    <div className={s.stateText}>
      {loc === "en" ? "This order is not accessible." : "Bu sipariş erişilebilir değil."}
    </div>
  </div>
) : (
          <>
          
            <section className={s.hero}>
              <div className={s.heroLeft}>
                <Link className={s.backBtn} href="/account/orders">
                  ← {loc === "en" ? "Back to orders" : "Siparişlere dön"}
                </Link>

                <div className={s.heroKicker}>
                  {loc === "en" ? "Order details" : "Sipariş detayı"}
                </div>

                <h1 className={s.heroTitle}>
                  {loc === "en" ? "Order" : "Sipariş"} <span className={s.heroCode}>{fullOrderCode}</span>
                </h1>

                <div className={s.heroMeta}>
                  <span className={`${s.statusBadge} ${s[`status_${tone}`]}`}>
                    {statusLabel(status, loc)}
                  </span>

                  <span className={s.metaItem}>
                    <b>{loc === "en" ? "Created" : "Oluşturma"}</b>
                    <span>{createdText}</span>
                  </span>

                  <span className={s.metaItem}>
                    <b>{loc === "en" ? "Updated" : "Güncelleme"}</b>
                    <span>{updatedText}</span>
                  </span>
                </div>
              </div>

              <div className={s.heroRight}>
                <div className={s.totalCard}>
                  <div className={s.totalLabel}>{loc === "en" ? "Total amount" : "Toplam tutar"}</div>
                  <div className={s.totalValue}>{fmtMoney(docData?.total, loc)}</div>
                  <div className={s.totalSub}>
                    {loc === "en"
                      ? "Your order record has been securely created."
                      : "Sipariş kaydın güvenli şekilde oluşturuldu."}
                  </div>
                </div>
              </div>
            </section>

            <div className={s.topInfoGrid}>
              <div className={s.infoCard}>
                <div className={s.infoCardTitle}>{loc === "en" ? "Customer info" : "Müşteri bilgisi"}</div>
                <div className={s.infoLine}><span>{loc === "en" ? "Name" : "Ad Soyad"}</span><b>{customerName || "—"}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Email" : "E-posta"}</span><b>{docData?.customer?.email || docData?.email || "—"}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Phone" : "Telefon"}</span><b>{docData?.customer?.phone || docData?.shippingAddress?.phone || "—"}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Turkish ID" : "TC Kimlik No"}</span><b>{maskNationalId(billingNationalId)}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Birth date" : "Doğum tarihi"}</span><b>{docData?.customer?.birthDate || "—"}</b></div>
              </div>

              <div className={s.infoCard}>
                <div className={s.infoCardTitle}>{loc === "en" ? "Payment details" : "Ödeme bilgileri"}</div>
                <div className={s.infoLine}><span>{loc === "en" ? "Method" : "Yöntem"}</span><b>{paymentMethod}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Provider" : "Sağlayıcı"}</span><b>{paymentProvider}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Reference" : "Referans"}</span><b>{paymentRef}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Paid at" : "Ödeme tarihi"}</span><b>{paidText}</b></div>
              </div>
                  <div className={s.infoCard}>
                    <div className={s.infoCardTitle}>
                      {loc === "en" ? "Invoice info" : "Fatura bilgisi"}
                    </div>

                    <div className={s.infoLine}>
                      <span>{loc === "en" ? "Invoice type" : "Fatura tipi"}</span>
                      <b>{invoiceType}</b>
                    </div>

                    {String(invoiceTypeRaw).trim().toLowerCase() === "company" ? (
                      <>
                        <div className={s.infoLine}>
                          <span>{loc === "en" ? "Company name" : "Firma adı"}</span>
                          <b>{billingCompanyName || "—"}</b>
                        </div>

                        <div className={s.infoLine}>
                          <span>{loc === "en" ? "Tax number" : "Vergi numarası"}</span>
                          <b>{billingTaxNumber || "—"}</b>
                        </div>

                        <div className={s.infoLine}>
                          <span>{loc === "en" ? "Tax office" : "Vergi dairesi"}</span>
                          <b>{billingTaxOffice || "—"}</b>
                        </div>
                      </>
                    ) : (
                      <div className={s.infoLine}>
                        <span>{loc === "en" ? "Turkish ID" : "TC Kimlik No"}</span>
                        <b>{maskNationalId(billingNationalId)}</b>
                      </div>
                    )}
                  </div>
              <div className={s.infoCard}>
                <div className={s.infoCardTitle}>{loc === "en" ? "Delivery summary" : "Teslimat özeti"}</div>
                <div className={s.infoLine}><span>{loc === "en" ? "Receiver" : "Alıcı"}</span><b>{fullNameFromAddress(docData?.shippingAddress)}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Phone" : "Telefon"}</span><b>{docData?.shippingAddress?.phone || "—"}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Region" : "Bölge"}</span><b>{cityDistrict(docData?.shippingAddress)}</b></div>
                <div className={s.infoLine}><span>{loc === "en" ? "Postal code" : "Posta kodu"}</span><b>{docData?.shippingAddress?.postalCode || "—"}</b></div>
              </div>
                            <div className={s.infoCard}>
                <div className={s.infoCardTitle}>{loc === "en" ? "Shipment info" : "Kargo bilgisi"}</div>

                {!hasShippingInfo ? (
                  <div className={s.infoEmpty}>
                    {loc === "en"
                      ? "Your shipment record has not been created yet."
                      : "Kargo kaydınız henüz oluşturulmadı."}
                  </div>
                ) : (
                  <>
                    <div className={s.infoLine}>
                      <span>{loc === "en" ? "Provider" : "Sağlayıcı"}</span>
                      <b>{shippingProvider.toUpperCase()}</b>
                    </div>

                    <div className={s.infoLine}>
                      <span>{loc === "en" ? "Shipment status" : "Kargo durumu"}</span>
                      <b className={`${s.inlineStatus} ${s[`status_${shippingToneClass}`]}`}>
                        {shippingStatusText}
                      </b>
                    </div>

                    {trackingNumber ? (
                      <div className={s.infoLine}>
                        <span>{loc === "en" ? "Tracking no" : "Takip no"}</span>
                        <b>{trackingNumber}</b>
                      </div>
                    ) : null}

                    {shippingReferenceId ? (
                      <div className={s.infoLine}>
                        <span>{loc === "en" ? "Reference id" : "Referans kodu"}</span>
                        <b>{shippingReferenceId}</b>
                      </div>
                    ) : null}

                    {shipmentId ? (
                      <div className={s.infoLine}>
                        <span>{loc === "en" ? "Shipment id" : "Gönderi id"}</span>
                        <b>{shipmentId}</b>
                      </div>
                    ) : null}

                    {shippingInvoiceId ? (
                      <div className={s.infoLine}>
                        <span>{loc === "en" ? "Invoice id" : "Kargo fatura no"}</span>
                        <b>{shippingInvoiceId}</b>
                      </div>
                    ) : null}

                    {trackingUrl && !shippingCancelled ? (
                      <div className={s.infoActions}>
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={s.primaryBtn}
                        >
                          {loc === "en" ? "Track shipment" : "Kargomu takip et"}
                        </a>

                        {trackingNumber ? (
                          <button
                            type="button"
                            className={s.secondaryBtn}
                            onClick={() =>
                              copyPaymentText(
                                trackingNumber,
                                loc === "en" ? "Tracking number copied." : "Takip numarası kopyalandı.",
                                loc === "en" ? "Tracking number could not be copied." : "Takip numarası kopyalanamadı."
                              )
                            }
                          >
                            {loc === "en" ? "Copy tracking number" : "Takip No Kopyala"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {shippingCancelled ? ( 
                      <div className={s.noteCard}>
                        <div className={s.noteCardBadge}>
                          {loc === "en" ? "Cancelled" : "İptal"}
                        </div>
                        <div className={s.noteCardText}>
                          {loc === "en"
                            ? "This shipment has been cancelled. If needed, our store will create a new shipment record."
                            : "Bu kargo kaydı iptal edilmiştir. Gerekirse mağazamız yeni bir gönderi kaydı oluşturacaktır."}
                        </div>
                      </div>
                    ) : null}

                    {shippingBarcodeError ? (
                      <div className={s.noteCard}>
                        <div className={s.noteCardBadge}>
                          {loc === "en" ? "Shipment note" : "Kargo notu"}
                        </div>
                        <div className={s.noteCardText}>{shippingBarcodeError}</div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className={s.grid}>
              <section className={s.mainCol}>
                <div className={s.card}>
                  <div className={s.cardHead}>
                    <div>
                      <div className={s.cardTitle}>{loc === "en" ? "Products" : "Ürünler"}</div>
                      <div className={s.cardDesc}>
                        {loc === "en" ? "Products included in this order." : "Bu siparişe dahil edilen ürünler."}
                      </div>
                    </div>

                    <div className={s.cardBadge}>
                      {items.length} {loc === "en" ? "item(s)" : "ürün"}
                    </div>
                  </div>

                  <div className={s.productList}>
                    {items.map((it, idx) => {
                      const qty = Number(it?.qty || 1) || 1;
                      const title = pickLT(loc, it?.title, loc === "en" ? "Product" : "Ürün");
                      const unit = fmtMoney(it?.unitPrice, loc);
                      const line = fmtMoney(it?.lineTotal, loc);

                      const href = it?.slug
                        ? `/products/${encodeURIComponent(it.slug)}`
                        : it?.productId
                        ? `/products/${encodeURIComponent(it.productId)}`
                        : "/shop";

                      return (
                        <article key={`${it.productId}-${idx}`} className={s.productItem}>
                          <div className={s.productMedia}>
                            {safeImage(it.image) ? (
                              <img src={safeImage(it.image)} alt={title} />
                            ) : (
                              <div className={s.productMediaPh}>✦</div>
                            )}
                          </div>

                          <div className={s.productBody}>
                            <div className={s.productTop}>
                              <div>
                                <Link href={href} className={s.productTitle}>
                                  {title}
                                </Link>

                                <div className={s.productMeta}>
                                  <span>{loc === "en" ? "Qty" : "Adet"}: <b>{qty}</b></span>
                                  <span className={s.dotSm} />
                                  <span>{loc === "en" ? "Unit" : "Birim"}: <b>{unit}</b></span>
                                </div>
                              </div>

                              <div className={s.productLine}>{line}</div>
                            </div>

                           {(() => {
  const selectedSize = String(it.selectedSize || "").trim();

  const selectedVariantItems = Array.isArray(it.selectedVariantItems)
    ? it.selectedVariantItems
    : [];

  const ringSizeFromVariantItem =
    selectedVariantItems.find((v: any) => {
      const hay = [
        v?.groupId,
        v?.groupLabel,
        v?.label,
        v?.value,
      ]
        .map((x) => String(x || "").toLocaleLowerCase("tr-TR"))
        .join(" ");

      return (
        hay.includes("ring_size") ||
        hay.includes("yüzük") ||
        hay.includes("yuzuk") ||
        hay.includes("ölçü") ||
        hay.includes("olcu")
      );
    }) || null;

  const ringSize =
    selectedSize ||
    String(ringSizeFromVariantItem?.label || ringSizeFromVariantItem?.value || "").trim() ||
    String(it.selectedVariants?.ring_size || it.variant?.ring_size || "").trim();

  const otherVariantItems = selectedVariantItems.filter((v: any) => {
    const hay = [
      v?.groupId,
      v?.groupLabel,
      v?.label,
      v?.value,
    ]
      .map((x) => String(x || "").toLocaleLowerCase("tr-TR"))
      .join(" ");

    return !(
      hay.includes("ring_size") ||
      hay.includes("yüzük") ||
      hay.includes("yuzuk") ||
      hay.includes("ölçü") ||
      hay.includes("olcu")
    );
  });

  return (
    <>
      {ringSize ? (
        <div className={s.variantRow}>
          <span className={s.variantChip}>
            {loc === "en" ? "Ring Size" : "Yüzük Ölçüsü"}: {ringSize}
          </span>
        </div>
      ) : null}

      {otherVariantItems.length ? (
        <div className={s.variantRow}>
          {otherVariantItems.slice(0, 6).map((v: any, ix: number) => (
            <span key={`${v.groupId || "variant"}-${ix}`} className={s.variantChip}>
              {String(v.groupLabel || "Seçenek")}: {String(v.label || v.value || "")}
            </span>
          ))}
        </div>
      ) : null}

      {it.variant && Object.keys(it.variant).length > 0 ? (
        <div className={s.variantRow}>
          {Object.entries(it.variant)
            .filter(([k]) => String(k).toLowerCase() !== "ring_size")
            .slice(0, 5)
            .map(([k, v]) => (
              <span key={k} className={s.variantChip}>
                {k}: {String(v)}
              </span>
            ))}
        </div>
      ) : null}
    </>
  );
})()}
{getItemCustomText(it) ? (
  <div className={s.customTextBox}>
    <span className={s.customTextLabel}>
      {loc === "en" ? "Text to be written on product" : "Ürün üzerine yazılacak metin"}
    </span>

    <strong className={s.customTextValue}>
      {getItemCustomText(it)}
    </strong>
  </div>
) : null}
                            {it.sku ? <div className={s.sku}>SKU: {it.sku}</div> : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>

              <aside className={s.sideCol}>
                <div className={s.card}>
                  <div className={s.sideTitle}>{loc === "en" ? "Payment summary" : "Ödeme özeti"}</div>

                  <div className={s.sumRow}>
                    <span>{loc === "en" ? "Subtotal" : "Ara toplam"}</span>
                    <b>{fmtMoney(docData?.subtotal, loc)}</b>
                  </div>

                  <div className={s.sumRow}>
                    <span>{loc === "en" ? "Shipping" : "Kargo"}</span>
                    <b>{fmtMoney(docData?.shippingFee, loc)}</b>
                  </div>

                  <div className={s.sumRow}>
                    <span>{loc === "en" ? "Discount" : "İndirim"}</span>
                    <b>{fmtMoney(docData?.discount, loc)}</b>
                  </div>

                  <div className={s.hr} />

                  <div className={s.sumTotal}>
                    <span>{loc === "en" ? "Total" : "Toplam"}</span>
                    <strong>{fmtMoney(docData?.total, loc)}</strong>
                  </div>

                  <div className={s.noteBox}>
                    {loc === "en"
                      ? "Order amount and status are kept in sync with store records."
                      : "Sipariş tutarı ve durum bilgisi mağaza kayıtlarıyla senkron tutulur."}
                  </div>
                </div>
                {shouldShowBankTransferBox ? (
  <div className={`${s.card} ${s.bankTransferCard}`}>
    <div className={s.sideTitle}>
      {loc === "en" ? "Bank transfer payment" : "Havale / EFT Ödemesi"}
    </div>

    <div className={s.noteBox}>
      {loc === "en"
        ? "Please make your transfer using the order number as the payment description."
        : "Lütfen ödeme açıklamasına sipariş numaranızı yazarak havale/EFT işlemini tamamlayın."}
    </div>

   <div className={s.infoLine}>
  <span>{loc === "en" ? "Company" : "Firma adı"}</span>

  <b className={s.copyRefWrap}>
    <span>{bankCompanyName}</span>

    <button
      type="button"
      className={s.copyRefBtn}
      aria-label={loc === "en" ? "Copy company name" : "Firma adını kopyala"}
      title={loc === "en" ? "Copy" : "Kopyala"}
      onClick={() =>
        copyPaymentText(
          bankCompanyName,
          loc === "en" ? "Company name copied." : "Firma adı kopyalandı.",
          loc === "en" ? "Company name could not be copied." : "Firma adı kopyalanamadı."
        )
      }
    >
      ⧉
    </button>
  </b>
</div>

{bankName ? (
  <div className={s.infoLine}>
    <span>{loc === "en" ? "Bank" : "Banka"}</span>
    <b>{bankName}</b>
  </div>
) : null}

<div className={s.infoLine}>
  <span>IBAN</span>

  <b className={s.copyRefWrap}>
    <span>{bankIban || "IBAN bilgisi hazırlanıyor"}</span>

    {bankIban ? (
      <button
        type="button"
        className={s.copyRefBtn}
        aria-label={loc === "en" ? "Copy IBAN" : "IBAN kopyala"}
        title={loc === "en" ? "Copy" : "Kopyala"}
        onClick={() =>
          copyPaymentText(
            bankIban,
            loc === "en" ? "IBAN copied." : "IBAN kopyalandı.",
            loc === "en" ? "IBAN could not be copied." : "IBAN kopyalanamadı."
          )
        }
      >
        ⧉
      </button>
    ) : null}
  </b>
</div>

    <div className={s.infoLine}>
      <span>{loc === "en" ? "Amount" : "Ödenecek tutar"}</span>
      <b>{fmtMoney(docData?.total, loc)}</b>
    </div>

    <div className={s.infoLine}>
  <span>{loc === "en" ? "Description" : "Açıklama"}</span>

  <b className={s.copyRefWrap}>
    <span>{fullOrderCode}</span>

    <button
      type="button"
      className={s.copyRefBtn}
      aria-label={loc === "en" ? "Copy reference code" : "Referans kodunu kopyala"}
      title={loc === "en" ? "Copy" : "Kopyala"}
      onClick={() =>
        copyPaymentText(
          fullOrderCode,
          loc === "en" ? "Reference code copied." : "Referans kodu kopyalandı.",
          loc === "en" ? "Reference code could not be copied." : "Referans kodu kopyalanamadı."
        )
      }
    >
      ⧉
    </button>
  </b>
</div>

    {bankNote ? (
      <div className={s.addressNote}>{bankNote}</div>
    ) : null}

    {paymentNotifyMsg ? <div className={s.refundOk}>{paymentNotifyMsg}</div> : null}
    {paymentNotifyErr ? <div className={s.refundError}>{paymentNotifyErr}</div> : null}

    <button
      type="button"
      className={s.primaryBtn}
      onClick={notifyTransferPaymentDone}
      disabled={paymentNotifyBusy || !bankIban}
    >
      {paymentNotifyBusy
        ? loc === "en"
          ? "Sending..."
          : "Gönderiliyor..."
        : loc === "en"
        ? "I completed the payment"
        : "Ödemeyi Yaptım"}
    </button>
  </div>
) : isTransferOrder && isPaymentConfirmed ? (
  <div className={`${s.card} ${s.bankTransferCard}`}>
    <div className={s.sideTitle}>
      {loc === "en" ? "Payment confirmed" : "Ödeme onaylandı"}
    </div>

    <div className={s.refundOk}>
      {loc === "en"
        ? "Your bank transfer payment has been confirmed. Your order is now being processed."
        : "Havale / EFT ödemeniz onaylandı. Siparişiniz işleme alınmıştır."}
    </div>
  </div>
) : customerPaymentNotified && isTransferOrder && isPaymentPending ? (
  <div className={`${s.card} ${s.bankTransferCard}`}>
    <div className={s.sideTitle}>
      {loc === "en" ? "Payment notification" : "Ödeme bildirimi"}
    </div>

    <div className={s.refundOk}>
      {loc === "en"
        ? "Your payment notification has been sent to the store. Your order will be processed after confirmation."
        : "Ödeme bildiriminiz mağazaya iletildi. Onay sonrası siparişiniz işleme alınacak."}
    </div>
  </div>
) : null}
                <div className={s.card}>
  <div className={s.sideTitle}>
    {loc === "en" ? "Packaging preference" : "Paketleme tercihi"}
  </div>

  {giftInfo.enabled ? (
    <div className={s.noteCard}>
      <div className={s.noteCardBadge}>
        {loc === "en" ? "Gift package" : "Hediye paketi"}
      </div>

      <div className={s.noteCardText}>
        {loc === "en"
          ? "This order will be prepared as a gift package."
          : "Bu sipariş hediye paketi olarak hazırlanacak."}
      </div>

      {giftInfo.serviceTitle ? (
        <div className={s.addressNote}>
          <b>{loc === "en" ? "Selected service" : "Seçilen hizmet"}:</b>{" "}
          {giftInfo.serviceTitle}
        </div>
      ) : null}

      {giftInfo.note ? (
        <div className={s.addressNote}>
          <b>{loc === "en" ? "Gift note" : "Hediye notu"}:</b>{" "}
          {giftInfo.note}
        </div>
      ) : (
        <div className={s.addressNote}>
          {loc === "en"
            ? "No gift note was added."
            : "Hediye notu eklenmemiş."}
        </div>
      )}
    </div>
  ) : (
    <div className={s.noteBox}>
      {loc === "en"
        ? "Standard packaging was selected for this order."
        : "Bu siparişte standart paketleme seçildi."}
    </div>
  )}
</div>
           <div className={`${s.card} ${s.refundCard}`}>
  <div className={s.refundHead}>
    <div>
      <div className={s.sideTitle}>
        {loc === "en" ? "Refund request" : "İade talebi"}
      </div>

      <p className={s.refundDesc}>
       {loc === "en"
  ? "You can create a refund request for eligible paid orders."
  : "Uygun ödemesi tamamlanmış siparişler için iade talebi oluşturabilirsiniz."}
      </p>
    </div>

    {latestRefund ? (
      <span className={`${s.refundBadge} ${s[`status_${refundTone(latestRefund.status)}`]}`}>
        {refundStatusLabel(latestRefund.status, loc)}
      </span>
    ) : null}
  </div>

  {latestRefund ? (
    <div className={s.refundStatusBox}>
      <div className={s.refundMiniLine}>
        <span>{loc === "en" ? "Amount" : "Tutar"}</span>
        <b>
          {fmtMoney(
            {
              amount: Number(String(latestRefund.amountTry || "0").replace(",", ".")),
              currency: "TRY",
            },
            loc
          )}
        </b>
      </div>

      <div className={s.refundMiniLine}>
        <span>{loc === "en" ? "Reason" : "Sebep"}</span>
        <b>{latestRefund.reason || "—"}</b>
      </div>
{isReturnCodeReady(latestRefund) ? (
  <div className={s.refundShipBox}>
    <div className={s.refundMiniLine}>
      <span>{loc === "en" ? "Return code" : "İade kodu"}</span>
      <b>{getReturnCode(latestRefund)}</b>
    </div>

    <div className={s.refundMiniLine}>
      <span>{loc === "en" ? "Carrier" : "Kargo"}</span>
      <b>{getReturnCarrier(latestRefund)}</b>
    </div>

    <div className={s.noteBox}>
      {loc === "en"
        ? "You can deliver the product to the contracted MNG branch with this return code."
        : "Bu iade kodu ile ürünü anlaşmalı MNG Kargo şubesinden ücretsiz gönderebilirsin."}
    </div>

    {getReturnTrackingUrl(latestRefund) ? (
      <a
        href={getReturnTrackingUrl(latestRefund)}
        target="_blank"
        rel="noreferrer"
        className={s.primaryBtn}
      >
        {loc === "en" ? "Track return shipment" : "İade kargosunu takip et"}
      </a>
    ) : null}
  </div>
) : null}

{isReturnCodeCancelled(latestRefund) ? (
  <div className={s.refundError}>
    {loc === "en"
      ? "Your return shipping code has been cancelled. Please contact support if you need a new code."
      : "İade kargo kodun iptal edildi. Yeni kod gerekiyorsa destek ekibimizle iletişime geçebilirsin."}
  </div>
) : null}

{isReturnCodeError(latestRefund) ? (
  <div className={s.refundError}>
    {String(
      latestRefund.returnShipment?.lastError ||
        latestRefund.returnShipping?.lastError ||
        ""
    ).trim() ||
      (loc === "en"
        ? "Return shipping code could not be created. Our team will contact you."
        : "İade kargo kodu oluşturulamadı. Ekibimiz seninle iletişime geçecek.")}
  </div>
) : null}

{isReturnReceived(latestRefund) ? (
  <div className={s.refundOk}>
    {loc === "en"
      ? "Your return package has been received. Refund review is in progress."
      : "İade paketin teslim alındı. Para iadesi kontrol süreci devam ediyor."}
  </div>
) : null}
      {latestRefund.paytr?.referenceNo ? (
        <div className={s.refundMiniLine}>
          <span>PayTR Ref</span>
          <b>{latestRefund.paytr.referenceNo}</b>
        </div>
      ) : null}

      {latestRefund.paytr?.error ? (
        <div className={s.refundError}>{latestRefund.paytr.error}</div>
      ) : null}
    </div>
  ) : (
    <div className={s.noteBox}>
      {loc === "en"
        ? "No refund request has been created for this order yet."
        : "Bu sipariş için henüz iade talebi oluşturulmadı."}
    </div>
  )}

  {refundMsg ? <div className={s.refundOk}>{refundMsg}</div> : null}
  {refundErr ? <div className={s.refundError}>{refundErr}</div> : null}

  {canOpenRefund ? (
    <button
      type="button"
      className={s.primaryBtn}
      onClick={() => {
        setRefundErr("");
        setRefundOpen((v) => !v);
        setRefundForm((p) => ({
          ...p,
          amountTry: refundableAmount.toFixed(2),
        }));
      }}
    >
      {refundOpen
        ? loc === "en"
          ? "Close form"
          : "Formu kapat"
        : refundButtonText}
    </button>
  ) : hasActiveRefund ? (
    <div className={s.refundLockedBox}>
      {loc === "en"
        ? "There is already an active refund request for this order."
        : "Bu sipariş için aktif bir iade talebi mevcut."}
    </div>
  ) : (
    <div className={s.refundLockedBox}>
      {loc === "en"
        ? "Refund request is not available for this order."
        : "Bu sipariş için iade talebi şu anda uygun değil."}
    </div>
  )}

  {refundOpen && canOpenRefund ? (
    <div className={s.refundForm}>
      <div className={s.refundGrid}>
        <label className={s.refundField}>
          <span>{loc === "en" ? "Refund type" : "İade türü"}</span>
          <select
            value={refundForm.type}
            onChange={(e) =>
              setRefundForm((p) => ({
                ...p,
                type: e.target.value === "partial" ? "partial" : "full",
                amountTry:
                  e.target.value === "partial"
                    ? p.amountTry || refundableAmount.toFixed(2)
                    : refundableAmount.toFixed(2),
              }))
            }
          >
            <option value="full">{loc === "en" ? "Full refund" : "Tam iade"}</option>
            <option value="partial">{loc === "en" ? "Partial refund" : "Kısmi iade"}</option>
          </select>
        </label>

        <label className={s.refundField}>
          <span>{loc === "en" ? "Refund amount" : "İade tutarı"}</span>
          <input
            value={refundForm.type === "full" ? refundableAmount.toFixed(2) : refundForm.amountTry}
            disabled={refundForm.type === "full"}
            onChange={(e) =>
              setRefundForm((p) => ({
                ...p,
                amountTry: e.target.value.replace(/[^\d.,]/g, ""),
              }))
            }
            inputMode="decimal"
          />
        </label>
      </div>

      <label className={s.refundField}>
        <span>{loc === "en" ? "Reason" : "Sebep"}</span>
        <select
          value={refundForm.reason}
          onChange={(e) =>
            setRefundForm((p) => ({
              ...p,
              reason: e.target.value,
            }))
          }
        >
          <option value="Ürün İadesi">{loc === "en" ? "Product return" : "Ürün İadesi"}</option>
          <option value="Yanlış ürün">{loc === "en" ? "Wrong product" : "Yanlış ürün"}</option>
          <option value="Hasarlı ürün">{loc === "en" ? "Damaged product" : "Hasarlı ürün"}</option>
          <option value="Sipariş iptali">{loc === "en" ? "Order cancellation" : "Sipariş iptali"}</option>
          <option value="Diğer">{loc === "en" ? "Other" : "Diğer"}</option>
        </select>
      </label>

      <label className={s.refundField}>
        <span>{loc === "en" ? "Note" : "Not"}</span>
        <textarea
          value={refundForm.note}
          onChange={(e) =>
            setRefundForm((p) => ({
              ...p,
              note: e.target.value.slice(0, 600),
            }))
          }
          rows={4}
          placeholder={
            loc === "en"
              ? "Add details about your refund request..."
              : "İade talebinizle ilgili detay ekleyin..."
          }
        />
      </label>

      <button
        type="button"
        className={s.primaryBtn}
        onClick={submitRefundRequest}
        disabled={refundBusy}
      >
        {refundBusy
          ? loc === "en"
            ? "Sending..."
            : "Gönderiliyor..."
          : loc === "en"
          ? "Send refund request"
          : "İade talebini gönder"}
      </button>
    </div>
  ) : null}
</div>
                <div className={s.card}>
                  <div className={s.sideTitle}>{loc === "en" ? "Delivery address" : "Teslimat adresi"}</div>

                  <div className={s.addressCard}>
                  <div className={s.addressLine}>{fullAddress(docData?.shippingAddress)}</div>
                  <div className={s.addressLine}>
                    {loc === "en" ? "Invoice type" : "Fatura tipi"}: {invoiceType}
                  </div>
                    <div className={s.addressName}>{fullNameFromAddress(docData?.shippingAddress)}</div>
                    <div className={s.addressLine}>{docData?.shippingAddress?.phone || "—"}</div>
                    <div className={s.addressLine}>{cityDistrict(docData?.shippingAddress)}</div>
                    {String(invoiceTypeRaw).trim().toLowerCase() === "company" ? (
                      <div className={s.addressLine}>
                        {billingCompanyName || "—"} • {billingTaxOffice || "—"}
                      </div>
                    ) : null}
                    {docData?.shippingAddress?.postalCode ? (
                      <div className={s.addressLine}>
                        {loc === "en" ? "Postal code" : "Posta kodu"}: {docData.shippingAddress.postalCode}
                      </div>
                    ) : null}

                    {docData?.shippingAddress?.note ? (
                      <div className={s.addressNote}>
                        <b>{loc === "en" ? "Note" : "Not"}:</b> {docData.shippingAddress.note}
                      </div>
                    ) : null}
                  </div>
                </div>

                {adminNote ? (
                  <div className={s.card}>
                    <div className={s.sideTitle}>{loc === "en" ? "Store note" : "Mağaza notu"}</div>
                    <div className={s.noteCard}>
                      <div className={s.noteCardBadge}>
                        {loc === "en" ? "Info from store" : "Mağazadan bilgi"}
                      </div>
                      <div className={s.noteCardText}>{adminNote}</div>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}