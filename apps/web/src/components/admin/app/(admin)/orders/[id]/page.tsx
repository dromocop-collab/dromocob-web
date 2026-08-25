"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  doc,
  collection,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase.client";
import { fmtTRY, statusTR, type OrderDoc, type OrderStatus } from "@/lib/orders";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import { toast } from "@/components/admin/ui/toast";
import s from "./orderDetail.module.css";
import { adminFetch } from "@/lib/adminFetch";

type ShippingAddress = {
  fullName?: string;
  phone?: string;
  city?: string;
  district?: string;
  addressLine?: string;
  postalCode?: string;
  note?: string;
  invoiceType?: "individual" | "company";
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
};

type BillingInfo = {
  invoiceType?: "individual" | "company";
  firstName?: string;
  lastName?: string;
  phone?: string;
  nationalId?: string;
  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
};

type PaymentInfo = {
  provider?: string;
  method?: string;
  paidAt?: any;
  ref?: string;
};

type DocT = OrderDoc & {
  id: string;

  createdAtIso?: string;
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

  transferPaymentApproved?: boolean;
  transferPaymentApprovedAt?: any;
  transferPaymentApprovedAtIso?: string;
  updatedAtIso?: string;
  stockApplied?: boolean;
  paymentStatus?: string;
  adminNote?: string;
  email?: string;
  nationalId?: string;

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

  serviceTotal?: {
    amount?: number;
    currency?: string;
  } | number;

  serviceTotalTry?: number;

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

  shippingAddress?: ShippingAddress;
  billing?: BillingInfo;
  payment?: PaymentInfo;

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
    clientQuote?: {
    totalTry?: number;
    subtotalTry?: number;
    discountTry?: number;
    shippingFeeTry?: number;
    serviceTotalTry?: number;
    selectedServices?: Array<{
      id?: string;
      code?: string;
      title?: any;
      priceTry?: number;
      isGiftPackage?: boolean;
    }>;
    items?: Array<{
      productId?: string;
      slug?: string;
      qty?: number;
      unitPriceTry?: number;
      resolvedUnitPrice?: number;
      priceTry?: number;
      lineTry?: number;
      lineTotalTry?: number;
      title?: any;
      image?: string;
      selectedSize?: string;
            customText?: string;
      productCustomText?: string;
      engravingText?: string;
      personalizationText?: string;
      selectedVariants?: Record<string, string> | null;
      selectedVariantItems?: Array<{
        groupId?: string;
        groupLabel?: string;
        value?: string;
        label?: string;
        priceDelta?: number;
        hasGram?: number;
        weightGram?: number;
        gram?: number;
      }>;
    }>;
  };
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
  status?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  refundPaymentFlow?: string;
  createdAt?: any;
  updatedAt?: any;
  rejectReason?: string;
  returnShipping?: {
    provider?: string;
    carrier?: string;
    status?: string;
    code?: string;
    returnCode?: string;
    trackingNo?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    lastError?: string;
    createdAt?: any;
    cancelledAt?: any;
  };
  returnShipment?: {
    provider?: string;
    carrier?: string;
    status?: string;
    code?: string;
    returnCode?: string;
    trackingNo?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    lastError?: string;
    createdAt?: any;
    cancelledAt?: any;
  };
  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};

function refundStatusLabel(raw: any): string {
  const v = String(raw || "").trim().toLowerCase();
  const map: Record<string, string> = {
    pending: "İnceleme Bekliyor",
    processing: "İşleniyor",
    approved: "İade Onaylandı",
    return_order_created: "İade Kargo Siparişi Açıldı",
    return_label_created: "İade Kargo Kodu Hazır",
    return_label_error: "İade Kargo Kodu Hatalı",
    return_label_failed: "İade Kargo Oluşturulamadı",
    return_label_cancelled: "İade Kargo İptal",
    refunded: "Para İadesi Tamamlandı",
    failed: "İade Başarısız",
    rejected: "Talep Reddedildi",
    cancelled: "Talep İptal Edildi",
  };
  return map[v] || v || "Bilinmiyor";
}

function refundTone(raw: any): "ok" | "bad" | "warn" | "info" | "neutral" {
  const v = String(raw || "").trim().toLowerCase();
  if (["approved", "return_order_created", "return_label_created", "refunded"].includes(v)) return "ok";
  if (["failed", "rejected", "cancelled", "return_label_error", "return_label_failed", "return_label_cancelled"].includes(v)) return "bad";
  if (v === "processing") return "info";
  return "warn";
}

function getReturnCode(r?: RefundRequestDoc | null) {
  const a = r?.returnShipping || r?.returnShipment || {} as any;
  const b = r?.returnShipment || r?.returnShipping || {} as any;
  return (
    safeStr(a.returnCode) || safeStr(a.code) ||
    safeStr(a.trackingNumber) || safeStr(a.trackingNo) ||
    safeStr(b.returnCode) || safeStr(b.code) ||
    safeStr(b.trackingNumber) || safeStr(b.trackingNo)
  );
}

const STATUS: { v: OrderStatus; label: string }[] = [
  { v: "draft", label: "Taslak" },
  { v: "pending_payment", label: "Ödeme Bekliyor" },
  { v: "paid", label: "Ödendi" },
  { v: "preparing", label: "Hazırlanıyor" },
  { v: "shipped", label: "Kargoda" },
  { v: "delivered", label: "Teslim" },
  { v: "cancelled", label: "İptal" },
  { v: "refunded", label: "İade" },
];

function toneOf(statusRaw: any): "neutral" | "warn" | "info" | "ok" | "bad" {
  const st = String(statusRaw || "pending_payment");
  if (st === "paid" || st === "delivered") return "ok";
  if (st === "cancelled" || st === "refunded") return "bad";
  if (st === "preparing" || st === "shipped") return "info";
  if (st === "pending_payment") return "warn";
  return "neutral";
}

function shippingTone(statusRaw: any): "neutral" | "warn" | "info" | "ok" | "bad" {
  const st = String(statusRaw || "").trim().toLowerCase();
  if (st === "created" || st === "shipped" || st === "delivered") return "ok";
  if (st === "cancelled") return "bad";
  if (st === "barcode_error") return "warn";
  return "neutral";
}

function shippingLabel(statusRaw: any): string {
  const st = String(statusRaw || "").trim().toLowerCase();
  const map: Record<string, string> = {
    created: "Kargo Oluşturuldu",
    barcode_error: "Barkod / Etiket Bekleniyor",
    shipped: "Kargoya Verildi",
    delivered: "Teslim Edildi",
    cancelled: "Kargo İptal Edildi",
  };
  return map[st] || (st ? st : "Henüz oluşturulmadı");
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "object" && String(v?._methodName || "").includes("serverTimestamp")) return null;
    return null;
  } catch {
    return null;
  }
}

function getBestDate(d: any): Date | null {
  return (
    toDateSafe(d?.createdAt) ||
    toDateSafe(d?.createdAtIso) ||
    toDateSafe(d?.updatedAt) ||
    toDateSafe(d?.updatedAtIso) ||
    null
  );
}

function fmtDate(d: any) {
  const x = getBestDate(d);
  if (!x) return "Tarih bekleniyor";
  return x.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMaybeDate(v: any) {
  const x = toDateSafe(v);
  if (!x) return "—";
  return x.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeStr(x: any) {
  const v = String(x ?? "").trim();
  return v && v !== "undefined" && v !== "null" ? v : "";
}

async function copyText(txt: string) {
  try {
    if (!txt) return;
    await navigator.clipboard.writeText(txt);
  } catch {
    //
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function moneyAmount(x: any) {
  const n = Number(x?.amount ?? x ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function quoteItemsOf(order: DocT | null) {
  return Array.isArray(order?.clientQuote?.items) ? order?.clientQuote?.items || [] : [];
}

function findQuoteItemForOrderItem(order: DocT | null, item: any) {
  const quoteItems = quoteItemsOf(order);

  const productId = safeStr(item?.productId);
  const slug = safeStr(item?.slug);
  const sku = safeStr(item?.sku);

  return (
    quoteItems.find((q: any) => productId && safeStr(q?.productId) === productId) ||
    quoteItems.find((q: any) => slug && safeStr(q?.slug) === slug) ||
    quoteItems.find((q: any) => sku && safeStr(q?.sku) === sku) ||
    null
  );
}

function moneyAmountSmart(x: any) {
  const n = Number(x?.amount ?? x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getAdminDisplayUnit(order: DocT | null, item: any) {
  const quoteItem = findQuoteItemForOrderItem(order, item);

  const fromOrder = moneyAmountSmart(item?.unitPrice);

  const fromQuote =
    Number(quoteItem?.unitPriceTry ?? 0) ||
    Number(quoteItem?.resolvedUnitPrice ?? 0) ||
    Number(quoteItem?.priceTry ?? 0) ||
    0;

  // Checkout quote varsa onu esas alıyoruz. Çünkü ölçülü fiyat checkout'ta kesinleşmiş oluyor.
  if (Number.isFinite(fromQuote) && fromQuote > 0) return fromQuote;

  return Number.isFinite(fromOrder) ? fromOrder : 0;
}

function getAdminDisplayLine(order: DocT | null, item: any) {
  const quoteItem = findQuoteItemForOrderItem(order, item);
  const qty = Math.max(1, Number(item?.qty || quoteItem?.qty || 1) || 1);

  const quoteLine =
    Number(quoteItem?.lineTry ?? 0) ||
    Number(quoteItem?.lineTotalTry ?? 0) ||
    0;

  if (Number.isFinite(quoteLine) && quoteLine > 0) {
    return quoteLine;
  }

  const quoteUnit =
    Number(quoteItem?.unitPriceTry ?? 0) ||
    Number(quoteItem?.resolvedUnitPrice ?? 0) ||
    Number(quoteItem?.priceTry ?? 0) ||
    0;

  if (Number.isFinite(quoteUnit) && quoteUnit > 0) {
    return Number((quoteUnit * qty).toFixed(2));
  }

  const fromOrder = moneyAmountSmart(item?.lineTotal);
  if (Number.isFinite(fromOrder) && fromOrder > 0) return fromOrder;

  const unit = moneyAmountSmart(item?.unitPrice);
  return Number((unit * qty).toFixed(2));
}

function getAdminDisplaySubtotal(order: DocT | null, items: any[]) {
  const quoteSubtotal = Number(order?.clientQuote?.subtotalTry || 0);
  if (Number.isFinite(quoteSubtotal) && quoteSubtotal > 0) return quoteSubtotal;

  return items.reduce((sum: number, item: any) => {
    return sum + getAdminDisplayLine(order, item);
  }, 0);
}

function getAdminDisplayServiceTotal(order: DocT | null) {
  const fromQuote = Number(order?.clientQuote?.serviceTotalTry || 0);
  if (Number.isFinite(fromQuote) && fromQuote > 0) return fromQuote;

  const fromOrder = moneyAmountSmart((order as any)?.serviceTotal);
  const fromRoot = Number((order as any)?.serviceTotalTry || 0);

  return Math.max(0, fromQuote || fromOrder || fromRoot || 0);
}

function getAdminDisplayDiscount(order: DocT | null) {
  const fromQuote = Number(order?.clientQuote?.discountTry || 0);
  if (Number.isFinite(fromQuote) && fromQuote > 0) return fromQuote;

  return moneyAmountSmart((order as any)?.discount);
}

function getAdminDisplayShipping(order: DocT | null) {
  const fromQuote = Number(order?.clientQuote?.shippingFeeTry || 0);
  if (Number.isFinite(fromQuote) && fromQuote > 0) return fromQuote;

  return moneyAmountSmart((order as any)?.shippingFee);
}

function getAdminDisplayTotal(order: DocT | null, items: any[]) {
  const quoteTotal = Number(order?.clientQuote?.totalTry || 0);
  if (Number.isFinite(quoteTotal) && quoteTotal > 0) return quoteTotal;

  const orderTotal = moneyAmountSmart((order as any)?.total);
  if (Number.isFinite(orderTotal) && orderTotal > 0) return orderTotal;

  const subtotal = getAdminDisplaySubtotal(order, items);
  const shipping = getAdminDisplayShipping(order);
  const serviceTotal = getAdminDisplayServiceTotal(order);
  const discount = getAdminDisplayDiscount(order);

  return Math.max(0, Number((subtotal + shipping + serviceTotal - discount).toFixed(2)));
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
  if (typeof v === "string") return safeStr(v);
  if (typeof v === "object") {
    return safeStr(v.tr) || safeStr(v.en) || safeStr(v.title) || "";
  }
  return "";
}

function resolveGiftInfo(order: DocT | null) {
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
      .map((x) => safeStr(x).toLocaleLowerCase("tr-TR"))
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
    safeStr(d.giftNote) ||
    safeStr(d.giftMessage) ||
    safeStr(d.giftPackageNote) ||
    safeStr(packaging.note) ||
    safeStr(packaging.message) ||
    safeStr(gift.note) ||
    safeStr(gift.message);

  const serviceTitle = giftService ? pickAnyText(giftService.title) : "";
  const servicePrice =
    giftService && Number.isFinite(Number(giftService.priceTry))
      ? Number(giftService.priceTry)
      : null;

  return {
    enabled,
    note,
    serviceTitle,
    servicePrice,
    label: enabled ? "Hediye paketi istendi" : "Hediye paketi istenmedi",
  };
}
function getItemCustomText(order: DocT | null, item: any) {
  const quoteItem = findQuoteItemForOrderItem(order, item);

  return safeStr(
    item?.customText ||
      item?.productCustomText ||
      item?.engravingText ||
      item?.personalizationText ||
      quoteItem?.customText ||
      quoteItem?.productCustomText ||
      quoteItem?.engravingText ||
      quoteItem?.personalizationText
  ).slice(0, 240);
}

function hasAnyCustomText(order: DocT | null, items: any[]) {
  return items.some((item) => Boolean(getItemCustomText(order, item)));
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function AdminOrderDetailPageInner({ params }: { params: { id: string } }) {
  const db = useMemo(() => getFirebaseDb(), []);
  const functions = useMemo(() => getFunctions(getFirebaseApp(), "europe-west1"), []);
  const id = decodeURIComponent(params.id || "");

  const [docx, setDocx] = useState<DocT | null>(null);
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [cancelingShipment, setCancelingShipment] = useState(false);
  const [note, setNote] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [refunds, setRefunds] = useState<RefundRequestDoc[]>([]);

  useEffect(() => {
    if (!id) return;

    const ref = doc(db, "orders", id);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOk(false);
          setDocx(null);
          return;
        }
        const d = snap.data() as any;
        setOk(true);
        setDocx({ id: snap.id, ...(d as any) });
        setNote(String(d?.adminNote || ""));
      },
      () => {
        setOk(false);
        setDocx(null);
      }
    );
  }, [db, id]);

  // ── İade talepleri dinle ──
  useEffect(() => {
    if (!id) {
      setRefunds([]);
      return;
    }

    const qy = query(
      collection(db, "refund_requests"),
      where("orderId", "==", id),
      orderBy("createdAt", "desc"),
      limit(20)
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
  }, [db, id]);

  async function setStatus(next: OrderStatus) {
    if (!docx) return;

    const current = String(docx.status || "pending_payment").trim();
    if (current === next) return;

    setBusy(true);
    try {
      if (next === "paid") {
        if (docx.stockApplied === true) {
          await updateDoc(doc(db, "orders", docx.id), {
            status: "paid",
            paymentStatus: "paid",
            updatedAt: serverTimestamp(),
            updatedAtIso: new Date().toISOString(),
          } as any);
        } else {
          const confirmOrderFn = httpsCallable(functions, "confirmOrderPaymentV1");
          await confirmOrderFn({
            orderId: docx.id,
            paymentRef: `ADMIN_${Date.now()}`,
          });
        }
        toast.success("Sipariş ödendi olarak güncellendi.");
        return;
      }

      if (next === "cancelled") {
        const cancelFn = httpsCallable(functions, "cancelOrderAndRestoreStockV1");
        await cancelFn({ orderId: docx.id });
        toast.success("Sipariş iptal edildi.");
        return;
      }

      await updateDoc(doc(db, "orders", docx.id), {
        status: next,
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      } as any);

      toast.success("Sipariş durumu güncellendi.");
    } catch (e) {
      console.error("set status error", e);
      toast.error("Durum güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!docx) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "orders", docx.id), {
        adminNote: note || "",
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      } as any);
      toast.success("Admin notu kaydedildi.");
    } catch (e) {
      console.error("save note error", e);
      toast.error("Not kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateShipment() {
    if (!docx) return;

    const ok = window.confirm(`Bu sipariş için MNG kargo kaydı oluşturulsun mu?\n\n#${docx.id}`);
    if (!ok) return;

    try {
      setCreatingShipment(true);

      const recipientRes = await adminFetch("/api/shipping/create-recipient", {
        method: "POST",
        body: JSON.stringify({ orderId: docx.id }),
        cache: "no-store",
      });
      const recipientJson = await recipientRes.json().catch(() => null);
      if (!recipientRes.ok || !recipientJson?.ok) {
        throw new Error(recipientJson?.error || "CreateRecipient başarısız.");
      }

      const orderRes = await adminFetch("/api/shipping/create-order", {
        method: "POST",
        body: JSON.stringify({ orderId: docx.id }),
        cache: "no-store",
      });
      const orderJson = await orderRes.json().catch(() => null);
      if (!orderRes.ok || !orderJson?.ok) {
        throw new Error(orderJson?.error || "CreateOrder başarısız.");
      }

      const referenceId = safeStr(orderJson?.referenceId);
      if (!referenceId) {
        throw new Error("CreateOrder başarılı ama referenceId dönmedi.");
      }

      toast.success("Sipariş kaydı açıldı. Barkod için kısa süre bekleniyor...");
      await sleep(15000);

      const barcodeRes = await adminFetch("/api/shipping/create-barcode", {
        method: "POST",
        body: JSON.stringify({
          orderId: docx.id,
          referenceId,
        }),
        cache: "no-store",
      });
      const barcodeJson = await barcodeRes.json().catch(() => null);
      if (!barcodeRes.ok || !barcodeJson?.ok) {
        throw new Error(barcodeJson?.error || "CreateBarcode başarısız.");
      }

      toast.success("Kargo, barkod ve takip bilgileri başarıyla oluşturuldu. Sipariş durumu 'Hazırlanıyor' olarak güncellendi.");
    } catch (e: any) {
      console.error("create shipment error", e);
      toast.error(String(e?.message || "Kargo oluşturulamadı."));
    } finally {
      setCreatingShipment(false);
    }
  }

  async function handleCancelShipment() {
    if (!docx) return;

    const referenceId = safeStr(docx.shippingReferenceId || docx.shipmentRef);
    const shipmentId = safeStr(docx.shipmentId);

    if (!referenceId || !shipmentId) {
      toast.error("Kargo iptali için referenceId ve shipmentId gerekli.");
      return;
    }

    const ok = window.confirm(
      `Bu kargo kaydı iptal edilsin mi?\n\n#${docx.id}\nReferenceId: ${referenceId}\nShipmentId: ${shipmentId}`
    );
    if (!ok) return;

    try {
      setCancelingShipment(true);

      const res = await adminFetch("/api/shipping/cancel-shipment", {
        method: "POST",
        body: JSON.stringify({
          orderId: docx.id,
          referenceId,
          shipmentId,
        }),
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Kargo iptali başarısız.");
      }

      toast.success("Kargo kaydı iptal edildi.");
    } catch (e: any) {
      console.error("cancel shipment error", e);
      toast.error(String(e?.message || "Kargo iptal edilemedi."));
    } finally {
      setCancelingShipment(false);
    }
  }
  async function handleApproveTransferPayment() {
    if (!docx) return;

    const ok = window.confirm(
      `Bu Havale/EFT ödemesini onaylamak istediğine emin misin?\n\n#${docx.id}`
    );

    if (!ok) return;

    try {
      setBusy(true);

      await updateDoc(doc(db, "orders", docx.id), {
        status: "paid",
        paymentStatus: "paid",

        "payment.provider": "manual",
        "payment.method": "transfer",
        "payment.paidAt": serverTimestamp(),

        transferPaymentApproved: true,
        transferPaymentApprovedAt: serverTimestamp(),
        transferPaymentApprovedAtIso: new Date().toISOString(),

        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      } as any);

      toast.success("Havale/EFT ödemesi onaylandı.");
    } catch (e) {
      console.error("approve transfer payment error", e);
      toast.error("Havale/EFT ödemesi onaylanamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function handleCopy(txt: string, label: string) {
    await copyText(txt);
    setCopyMsg(`${label} kopyalandı`);
    const timer = window.setTimeout(() => setCopyMsg(""), 1400);
    return () => window.clearTimeout(timer);
  }

  if (!ok || !docx) {
    return (
      <main className={s.page}>
        <div className={s.topBar}>
          <div>
            <div className={s.kicker}>Admin • Sipariş</div>
            <h1 className={s.h1}>Sipariş bulunamadı</h1>
          </div>
          <Link className={s.backBtn} href="/admin/orders">
            ← Siparişler
          </Link>
        </div>
      </main>
    );
  }

  const items = Array.isArray((docx as any)?.items) ? (docx as any).items : [];
    const subtotal = getAdminDisplaySubtotal(docx, items);
  const shipping = getAdminDisplayShipping(docx);
  const discount = getAdminDisplayDiscount(docx);
  const serviceTotal = getAdminDisplayServiceTotal(docx);
  const total = getAdminDisplayTotal(docx, items);

  const fullName = safeStr(docx.shippingAddress?.fullName);
  const phone = safeStr(docx.shippingAddress?.phone);
  const email = safeStr(docx.email);

  const invoiceType = safeStr(
    docx.billing?.invoiceType || docx.shippingAddress?.invoiceType || "individual"
  );

  const companyName = safeStr(docx.billing?.companyName || docx.shippingAddress?.companyName);
  const taxNumber = safeStr(docx.billing?.taxNumber || docx.shippingAddress?.taxNumber);
  const taxOffice = safeStr(docx.billing?.taxOffice || docx.shippingAddress?.taxOffice);
  const nationalId = safeStr(
    docx.billing?.nationalId ||
      docx.shippingAddress?.nationalId ||
      docx.nationalId
  );

  const city = safeStr(docx.shippingAddress?.city);
  const district = safeStr(docx.shippingAddress?.district);
  const addressLine = safeStr(docx.shippingAddress?.addressLine);
  const postal = safeStr(docx.shippingAddress?.postalCode);
  const customerNote = safeStr(docx.shippingAddress?.note);

  const paymentMethod = safeStr(docx.payment?.method || "card");
  const paymentProvider = safeStr(docx.payment?.provider || "none");
  const paymentRef = safeStr(docx.payment?.ref);
  const paymentStatus = safeStr(docx.paymentStatus || docx.status);
  const paidAt = fmtMaybeDate(docx.payment?.paidAt);
  const paymentMethodNorm = paymentMethod.toLocaleLowerCase("tr-TR");
  const paymentProviderNorm = paymentProvider.toLocaleLowerCase("tr-TR");

  const isTransferOrder =
    paymentProviderNorm === "manual" ||
    paymentMethodNorm === "transfer" ||
    paymentMethodNorm === "eft" ||
    paymentMethodNorm === "havale";

  const customerPaymentNotified =
    Boolean(docx.customerPaymentNotified) ||
    Boolean(docx.paymentNotification?.notified);

  const customerPaymentNotifiedAt = fmtMaybeDate(
    docx.customerPaymentNotifiedAt ||
      docx.customerPaymentNotifiedAtIso ||
      docx.paymentNotification?.notifiedAt ||
      docx.paymentNotification?.notifiedAtIso
  );

  const canApproveTransferPayment =
    isTransferOrder &&
    customerPaymentNotified &&
    String(docx.paymentStatus || "").toLocaleLowerCase("tr-TR") !== "paid" &&
    String(docx.status || "").toLocaleLowerCase("tr-TR") !== "paid";
  const shippingProvider = safeStr(docx.shippingProvider || "mng");
  const shippingStatus = safeStr(docx.shippingStatus);
  const trackingNumber = safeStr(docx.trackingNumber);
  const trackingUrl = safeStr(docx.trackingUrl);
  const labelUrl = safeStr(docx.labelUrl);
  const labelZpl = safeStr(docx.labelZpl);
  const shipmentId = safeStr(docx.shipmentId); // MNG shipmentId
  const shipmentDocId = safeStr(docx.shipmentDocId); // Firestore shipment doc id
  const shipmentRef = safeStr(docx.shipmentRef);
  const shippingReferenceId = safeStr(docx.shippingReferenceId);
  const shippingInvoiceId = safeStr(docx.shippingInvoiceId);
  const shippingCancelled = Boolean(docx.shippingCancelled) || shippingStatus === "cancelled";
  const shippingBarcodeError = safeStr(docx.shippingBarcodeError);
  const shippingCancelledAt = fmtMaybeDate(docx.shippingCancelledAtIso);

  const tone = toneOf(docx.status);
  const shipTone = shippingTone(shippingStatus);
  const giftInfo = resolveGiftInfo(docx);
  const createdText = fmtDate(docx);
  const itemQtyTotal = items.reduce((sum: number, it: any) => sum + Number(it?.qty || 1), 0);
const hasCustomText = hasAnyCustomText(docx, items);
  const hasShipment = Boolean(shipmentId);

  const cancelReason = safeStr((docx as any).cancelReason || (docx as any).cancellationReason);
  const isCancelled = String(docx.status || "").trim().toLowerCase() === "cancelled";
  const selectedServices = Array.isArray((docx as any).selectedServices) ? (docx as any).selectedServices : [];
  const customerBirthDate = safeStr((docx as any).customer?.birthDate);
  const canCreateShipment =
    !hasShipment && ["paid", "preparing"].includes(String(docx.status || ""));
  const canCancelShipment =
    hasShipment && !shippingCancelled && shippingStatus !== "cancelled";

  return (
    <main className={s.page}>
      {copyMsg ? <div className={s.toast}>{copyMsg}</div> : null}

      <div className={s.topBar}>
        <div className={s.headLeft}>
          <div className={s.kicker}>Admin • Sipariş Detayı</div>

          <div className={s.titleRow}>
            <div className={s.orderIdWrap}>
              <h1 className={s.h1}>{`#${String(docx.id || "").trim()}`}</h1>
              <button
                type="button"
                className={s.copyBtn}
                onClick={() => handleCopy(String(docx.id || "").trim(), "Sipariş numarası")}
              >
                Kopyala
              </button>
            </div>

            <span
              className={`${s.badge} ${
                tone === "ok"
                  ? s.badgeOk
                  : tone === "bad"
                  ? s.badgeBad
                  : tone === "info"
                  ? s.badgeInfo
                  : tone === "warn"
                  ? s.badgeWarn
                  : s.badgeNeutral
              }`}
            >
              {statusTR(docx.status)}
            </span>
          </div>

          <div className={s.metaRow}>
            <span className={s.metaItem}><b>Tarih:</b> {createdText}</span>
            <span className={s.metaItem}><b>Ürün:</b> {items.length} kalem / {itemQtyTotal} adet</span>
            <span className={s.metaItem}><b>Ödeme:</b> {paymentProvider} / {paymentMethod}</span>
            <span className={s.metaItem}><b>Stok işlendi:</b> {docx.stockApplied ? "Evet" : "Hayır"}</span>
          </div>
        </div>

        <div className={s.headRight}>
          <Link className={s.backBtn} href="/admin/orders">
            ← Siparişler
          </Link>
        </div>
      </div>

{/* ── İptal sebebi banner ── */}
{isCancelled ? (
  <div className={s.cancelBanner} style={{ maxWidth: 1480, margin: '0 auto 18px' }}>
    <div className={s.cancelBannerHead}>
      <div className={s.cancelBannerIcon}>✕</div>
      <div className={s.cancelBannerTitle}>
        Bu sipariş iptal edildi
        {cancelReason ? " — sebep aşağıda" : ""}
      </div>
    </div>
    {cancelReason ? (
      <div className={s.cancelBannerReason}>{cancelReason}</div>
    ) : null}
  </div>
) : null}

     <div className={s.heroGrid}>
  <div className={s.heroCard}>
    <span className={s.heroLabel}>Toplam</span>
    <b className={s.heroValue}>{fmtTRY(total)}</b>
  </div>

  <div className={s.heroCard}>
    <span className={s.heroLabel}>Müşteri</span>
    <b className={s.heroValueSmall}>{fullName || "—"}</b>
  </div>

  <div className={s.heroCard}>
    <span className={s.heroLabel}>Telefon</span>
    <b className={s.heroValueSmall}>{phone || "—"}</b>
  </div>

  <div className={`${s.heroCard} ${giftInfo.enabled ? s.giftHeroCard : ""}`}>
    <span className={s.heroLabel}>Hediye Paketi</span>
    <b className={s.heroValueSmall}>
      {giftInfo.enabled ? "Evet 🎁" : "Hayır"}
    </b>
  </div>
  <div className={`${s.heroCard} ${hasCustomText ? s.customHeroCard : ""}`}>
    <span className={s.heroLabel}>Ürün Yazısı</span>
    <b className={s.heroValueSmall}>
      {hasCustomText ? "Var ✍️" : "Yok"}
    </b>
  </div>
  <div className={s.heroCard}>
    <span className={s.heroLabel}>Durum</span>
    <b className={s.heroValueSmall}>{statusTR(docx.status)}</b>
  </div>
</div>

      <div className={s.grid}>
        <section className={s.leftCol}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Müşteri Bilgileri</h2>
                <p className={s.cardDesc}>Sipariş sahibinin iletişim ve teslimat özeti.</p>
              </div>
            </div>

            <div className={s.customerGrid}>
              <div className={s.infoBox}>
                <span className={s.infoLabel}>Ad Soyad</span>
                <div className={s.infoValue}>{fullName || "—"}</div>
              </div>

              <div className={s.infoBox}>
                <span className={s.infoLabel}>Telefon</span>
                <div className={s.infoValueRow}>
                  <div className={s.infoValue}>{phone || "—"}</div>
                  {phone ? (
                    <button className={s.copyBtn} type="button" onClick={() => handleCopy(phone, "Telefon")}>
                      Kopyala
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={s.infoBox}>
                <span className={s.infoLabel}>E-posta</span>
                <div className={s.infoValueRow}>
                  <div className={s.infoValue}>{email || "—"}</div>
                  {email ? (
                    <button className={s.copyBtn} type="button" onClick={() => handleCopy(email, "E-posta")}>
                      Kopyala
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={s.infoBox}>
                <span className={s.infoLabel}>Fatura Tipi</span>
                <div className={s.infoValue}>
                  {invoiceType === "company" ? "Kurumsal" : "Bireysel"}
                </div>
              </div>

              {invoiceType === "company" ? (
                <>
                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Firma Adı</span>
                    <div className={s.infoValue}>{companyName || "—"}</div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Vergi No</span>
                    <div className={s.infoValueRow}>
                      <div className={s.infoValue}>{taxNumber || "—"}</div>
                      {taxNumber ? (
                        <button
                          className={s.copyBtn}
                          type="button"
                          onClick={() => handleCopy(taxNumber, "Vergi No")}
                        >
                          Kopyala
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Vergi Dairesi</span>
                    <div className={s.infoValue}>{taxOffice || "—"}</div>
                  </div>
                </>
              ) : (
                <div className={s.infoBox}>
                  <span className={s.infoLabel}>TC Kimlik No</span>
                  <div className={s.infoValueRow}>
                    <div className={s.infoValue}>{nationalId || "—"}</div>
                    {nationalId ? (
                      <button
                        className={s.copyBtn}
                        type="button"
                        onClick={() => handleCopy(nationalId, "TC Kimlik No")}
                      >
                        Kopyala
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <div className={s.infoBox}>
                <span className={s.infoLabel}>Şehir / İlçe</span>
                <div className={s.infoValue}>
                  {[district, city].filter(Boolean).join(" / ") || "—"}
                </div>
              </div>

              {customerBirthDate ? (
                <div className={s.infoBox}>
                  <span className={s.infoLabel}>Doğum Tarihi</span>
                  <div className={s.infoValue}>{customerBirthDate}</div>
                </div>
              ) : null}
            </div>
          </div>

         <div className={`${s.card} ${giftInfo.enabled ? s.giftCard : ""}`}>
  <div className={s.cardHead}>
    <div>
      <h2 className={s.cardTitle}>Paketleme Talimatı</h2>
      <p className={s.cardDesc}>
        Sipariş hazırlanırken paketleme ekibinin dikkat etmesi gereken alan.
      </p>
    </div>

    <span
      className={`${s.badge} ${
        giftInfo.enabled ? s.badgeOk : s.badgeNeutral
      }`}
    >
      {giftInfo.enabled ? "Hediye Paketi" : "Standart Paket"}
    </span>
  </div>

  {giftInfo.enabled ? (
    <div className={s.giftBox}>
      <div className={s.giftIcon}>🎁</div>

      <div className={s.giftBody}>
        <div className={s.giftTitle}>
          Bu sipariş hediye paketi olarak hazırlanacak.
        </div>

        <div className={s.giftText}>
          Ürün paketlenirken fiyat etiketi, fatura görünürlüğü ve sunum detaylarına ekstra dikkat et.
        </div>

        {giftInfo.serviceTitle ? (
          <div className={s.giftService}>
            <b>Seçilen hizmet:</b> {giftInfo.serviceTitle}
            {giftInfo.servicePrice !== null ? ` • ${fmtTRY(giftInfo.servicePrice)}` : ""}
          </div>
        ) : null}

        {giftInfo.note ? (
          <div className={s.giftNote}>
            <b>Müşteri notu:</b> {giftInfo.note}
          </div>
        ) : (
          <div className={s.giftNoteMuted}>
            Müşteri özel hediye notu bırakmamış.
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className={s.emptyBox}>
      <div className={s.emptyTitle}>Standart paketleme</div>
      <div className={s.emptyDesc}>
        Bu siparişte hediye paketi seçimi görünmüyor.
      </div>
    </div>
  )}
</div>
{hasCustomText ? (
  <div className={`${s.card} ${s.customInstructionCard}`}>
    <div className={s.cardHead}>
      <div>
        <h2 className={s.cardTitle}>Kişiselleştirme Talimatı</h2>
        <p className={s.cardDesc}>
          Bu siparişte ürün üzerine yazılacak özel metin bulunuyor.
        </p>
      </div>

      <span className={`${s.badge} ${s.badgeWarn}`}>
        Yazı Kontrolü
      </span>
    </div>

    <div className={s.customInstructionBox}>
      <b>Üretim / paketleme notu:</b>
      <span>
        Ürünü hazırlamadan önce yazılacak metni ürün satırlarından kontrol et.
        Harf, boşluk, karakter ve büyük/küçük yazım müşteri talebine göre birebir uygulanmalı.
      </span>
    </div>
  </div>
) : null}
<div className={s.card}>
  <div className={s.cardHead}>
    <div>
      <h2 className={s.cardTitle}>Teslimat Adresi</h2>
      <p className={s.cardDesc}>Siparişte kayıtlı teslimat alanı.</p>
    </div>
  </div>

  <div className={s.addressCard}>
    <div className={s.addressMain}>{addressLine || "—"}</div>

    <div className={s.addressMeta}>
      {city || district ? (
        <span>{[district, city].filter(Boolean).join(" / ")}</span>
      ) : null}

      {postal ? <span>Posta Kodu: {postal}</span> : null}
    </div>

    {customerNote ? (
      <div className={s.customerNote}>
        <b>Müşteri Notu:</b> {customerNote}
      </div>
    ) : null}
  </div>
</div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Kargo Yönetimi</h2>
                <p className={s.cardDesc}>MNG gönderi kaydı, takip ve iptal işlemleri.</p>
              </div>

              <span
                className={`${s.badge} ${
                  shipTone === "ok"
                    ? s.badgeOk
                    : shipTone === "bad"
                    ? s.badgeBad
                    : shipTone === "warn"
                    ? s.badgeWarn
                    : s.badgeNeutral
                }`}
              >
                {shippingLabel(shippingStatus)}
              </span>
            </div>

            {!hasShipment ? (
              <div className={s.emptyBox}>
                <div className={s.emptyTitle}>Henüz aktif kargo kaydı yok</div>
                <div className={s.emptyDesc}>
                  Sipariş ödendiyse veya hazırlanıyorsa buradan MNG gönderisi başlatabilirsin.
                </div>
{giftInfo.enabled ? (
  <div className={s.giftMiniWarn}>
    🎁 Bu sipariş hediye paketli. Kargo oluşturmadan önce paketleme tamamlandı mı kontrol et.
  </div>
) : null}
                {canCreateShipment ? (
                  <button
                    type="button"
                    className={s.primaryBtn}
                    onClick={handleCreateShipment}
                    disabled={creatingShipment}
                  >
                    {creatingShipment ? "Kargo oluşturuluyor..." : "Kargo Oluştur"}
                  </button>
                ) : (
                  <div className={s.smallMuted}>
                    Kargo oluşturmak için sipariş durumu paid veya preparing olmalı.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={s.customerGrid}>
                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Sağlayıcı</span>
                    <div className={s.infoValue}>{shippingProvider.toUpperCase() || "—"}</div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Kargo Durumu</span>
                    <div className={s.infoValue}>{shippingLabel(shippingStatus)}</div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>Takip No</span>
                    <div className={s.infoValueRow}>
                      <div className={s.infoValue}>{trackingNumber || "—"}</div>
                      {trackingNumber ? (
                        <button
                          className={s.copyBtn}
                          type="button"
                          onClick={() => handleCopy(trackingNumber, "Takip No")}
                        >
                          Kopyala
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>ReferenceId</span>
                    <div className={s.infoValueRow}>
                      <div className={s.infoValue}>{shippingReferenceId || "—"}</div>
                      {shippingReferenceId ? (
                        <button
                          className={s.copyBtn}
                          type="button"
                          onClick={() => handleCopy(shippingReferenceId, "ReferenceId")}
                        >
                          Kopyala
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>ShipmentId (MNG)</span>
                    <div className={s.infoValueRow}>
                      <div className={s.infoValue}>{shipmentId || "—"}</div>
                      {shipmentId ? (
                        <button
                          className={s.copyBtn}
                          type="button"
                          onClick={() => handleCopy(shipmentId, "ShipmentId")}
                        >
                          Kopyala
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>ShipmentDocId</span>
                    <div className={s.infoValueRow}>
                      <div className={s.infoValue}>{shipmentDocId || "—"}</div>
                      {shipmentDocId ? (
                        <button
                          className={s.copyBtn}
                          type="button"
                          onClick={() => handleCopy(shipmentDocId, "ShipmentDocId")}
                        >
                          Kopyala
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>ShipmentRef</span>
                    <div className={s.infoValue}>{shipmentRef || "—"}</div>
                  </div>

                  <div className={s.infoBox}>
                    <span className={s.infoLabel}>InvoiceId</span>
                    <div className={s.infoValue}>{shippingInvoiceId || "—"}</div>
                  </div>

                  {shippingCancelled ? (
                    <div className={s.infoBox}>
                      <span className={s.infoLabel}>İptal Tarihi</span>
                      <div className={s.infoValue}>{shippingCancelledAt || "—"}</div>
                    </div>
                  ) : null}
                </div>

                {shippingBarcodeError ? (
                  <div className={s.warnBox}>
                    <b>Kargo Notu:</b> {shippingBarcodeError}
                  </div>
                ) : null}

                <div className={s.actionRow}>
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={s.secondaryBtn}
                    >
                      Takibi Aç
                    </a>
                  ) : null}

                  {trackingNumber ? (
                    <button
                      type="button"
                      className={s.secondaryBtn}
                      onClick={() => handleCopy(trackingNumber, "Takip No")}
                    >
                      Takip No Kopyala
                    </button>
                  ) : null}

                  {labelUrl ? (
                    <a
                      href={labelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={s.secondaryBtn}
                    >
                      Label Aç
                    </a>
                  ) : null}

                  {!labelUrl && labelZpl ? (
                    <button
                      type="button"
                      className={s.secondaryBtn}
                      onClick={() => handleCopy(labelZpl, "ZPL Label")}
                    >
                      ZPL Kopyala
                    </button>
                  ) : null}

                  {canCancelShipment ? (
                    <button
                      type="button"
                      className={s.dangerBtn}
                      onClick={handleCancelShipment}
                      disabled={cancelingShipment}
                    >
                      {cancelingShipment ? "Kargo iptal ediliyor..." : "Kargoyu İptal Et"}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>

{/* ── Seçilen hizmetler ── */}
{selectedServices.length > 0 ? (
  <div className={s.card}>
    <div className={s.cardHead}>
      <div>
        <h2 className={s.cardTitle}>Seçilen Hizmetler</h2>
        <p className={s.cardDesc}>Checkout sırasında müşterinin seçtiği ek hizmetler.</p>
      </div>
      <span className={s.countPill}>{selectedServices.length} hizmet</span>
    </div>

    <div className={s.servicesList}>
      {selectedServices.map((svc: any, idx: number) => {
        const title = pickAnyText(svc?.title) || safeStr(svc?.code) || safeStr(svc?.id) || "Hizmet";
        const price = Number(svc?.priceTry || 0);

        return (
          <div key={`svc-${idx}`} className={s.serviceItem}>
            <div className={s.serviceItemName}>
              {svc?.isGiftPackage ? "🎁 " : ""}{title}
            </div>
            {Number.isFinite(price) && price > 0 ? (
              <div className={s.serviceItemPrice}>{fmtTRY(price)}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
) : null}

{/* ── İade talepleri ── */}
<div className={`${s.card} ${s.refundCard}`}>
  <div className={s.cardHead}>
    <div>
      <h2 className={s.cardTitle}>İade Talepleri</h2>
      <p className={s.cardDesc}>Bu siparişe ait iade talepleri ve durumları.</p>
    </div>
    <span className={s.countPill}>{refunds.length} talep</span>
  </div>

  {refunds.length === 0 ? (
    <div className={s.emptyBox}>
      <div className={s.emptyTitle}>İade talebi yok</div>
      <div className={s.emptyDesc}>Bu sipariş için henüz iade talebi oluşturulmamış.</div>
    </div>
  ) : (
    <div className={s.refundList}>
      {refunds.map((r) => {
        const rTone = refundTone(r.status);
        const returnCode = getReturnCode(r);
        const returnShip = r.returnShipping || r.returnShipment;
        const returnCarrier = safeStr(returnShip?.carrier) || (safeStr(returnShip?.provider) === "mng" ? "MNG Kargo" : "");
        const returnTrackingUrl = safeStr(returnShip?.trackingUrl);
        const returnShipStatus = safeStr(returnShip?.status);

        return (
          <div key={r.id} className={s.refundItem}>
            <div className={s.refundItemHead}>
              <div className={s.refundItemTitle}>İade #{r.id.slice(0, 8)}…</div>
              <span className={`${s.badge} ${
                rTone === "ok" ? s.badgeOk :
                rTone === "bad" ? s.badgeBad :
                rTone === "info" ? s.badgeInfo :
                s.badgeWarn
              }`}>
                {refundStatusLabel(r.status)}
              </span>
            </div>

            <div className={s.refundItemGrid}>
              <div className={s.refundItemField}>
                <span>Tutar</span>
                <b>{fmtTRY(Number(String(r.amountTry || "0").replace(",", ".")))}</b>
              </div>
              <div className={s.refundItemField}>
                <span>Tür</span>
                <b>{r.type === "partial" ? "Kısmi" : "Tam"}</b>
              </div>
              <div className={s.refundItemField}>
                <span>Sebep</span>
                <b>{r.reason || "—"}</b>
              </div>
              <div className={s.refundItemField}>
                <span>Ödeme Yöntemi</span>
                <b>{r.refundPaymentFlow === "paytr" ? "PayTR (Kart)" : r.refundPaymentFlow === "manual" ? "Manuel (Havale)" : r.paymentProvider || "—"}</b>
              </div>
              {r.note ? (
                <div className={s.refundItemField} style={{ gridColumn: '1 / -1' }}>
                  <span>Müşteri Notu</span>
                  <b>{r.note}</b>
                </div>
              ) : null}
              {r.rejectReason ? (
                <div className={s.refundItemField} style={{ gridColumn: '1 / -1' }}>
                  <span>Ret Sebebi</span>
                  <b style={{ color: '#b42318' }}>{r.rejectReason}</b>
                </div>
              ) : null}
            </div>

            {returnCode ? (
              <div className={s.refundReturnBox}>
                <div className={s.refundItemGrid}>
                  <div className={s.refundItemField}>
                    <span>İade Kargo Kodu</span>
                    <b>{returnCode}</b>
                  </div>
                  <div className={s.refundItemField}>
                    <span>Kargo Firması</span>
                    <b>{returnCarrier || "—"}</b>
                  </div>
                  {returnShipStatus ? (
                    <div className={s.refundItemField}>
                      <span>Kargo Durumu</span>
                      <b>{returnShipStatus}</b>
                    </div>
                  ) : null}
                </div>
                {returnTrackingUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <a href={returnTrackingUrl} target="_blank" rel="noreferrer" className={s.secondaryBtn}>
                      İade Kargosunu Takip Et
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {r.paytr?.referenceNo ? (
              <div className={s.refundPaytrBox}>PayTR Ref: {r.paytr.referenceNo}</div>
            ) : null}

            {r.paytr?.error ? (
              <div className={s.refundPaytrError}>{r.paytr.error}</div>
            ) : null}

            {returnShip?.lastError ? (
              <div className={s.refundPaytrError}>{returnShip.lastError}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  )}
</div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Sipariş Ürünleri</h2>
                <p className={s.cardDesc}>Checkout anında kaydedilmiş ürün snapshot listesi.</p>
              </div>
              <span className={s.countPill}>{items.length} ürün</span>
            </div>

            <div className={s.items}>
              {items.map((it: any, i: number) => {
                const qty = Number(it?.qty || 1);
                const unit = getAdminDisplayUnit(docx, it);
                const line = getAdminDisplayLine(docx, it);
                const title = safeStr(it?.title?.tr || it?.title?.en || "Ürün");
                const sku = safeStr(it?.sku);
                const image = safeStr(it?.image);
                const slug = safeStr(it?.slug);
                const href = slug ? `/products/${encodeURIComponent(slug)}` : "";

                return (
                  <div key={i} className={s.itemRow}>
                    <div className={s.itemMedia}>
                      {image ? (
                        <img src={image} alt={title} />
                      ) : (
                        <div className={s.itemMediaPh}>✦</div>
                      )}
                    </div>

                    <div className={s.itemBody}>
                      {href ? (
                        <Link href={href} className={s.itemTitleLink}>
                          {title}
                        </Link>
                      ) : (
                        <div className={s.itemTitle}>{title}</div>
                      )}

                      <div className={s.itemMeta}>
                        <span>{qty} adet</span>
                        <span className={s.dot}>•</span>
                        <span>Birim {fmtTRY(unit)}</span>
                        {sku ? (
                          <>
                            <span className={s.dot}>•</span>
                            <span>SKU: {sku}</span>
                          </>
                        ) : null}
                      </div>

                   {(() => {
 const quoteItem = findQuoteItemForOrderItem(docx, it);

const selectedSize =
  safeStr(it?.selectedSize) ||
  safeStr(quoteItem?.selectedSize);

const selectedVariants =
  it?.selectedVariants && typeof it.selectedVariants === "object"
    ? it.selectedVariants
    : quoteItem?.selectedVariants && typeof quoteItem.selectedVariants === "object"
    ? quoteItem.selectedVariants
    : {};

const selectedVariantItems = Array.isArray(it?.selectedVariantItems) && it.selectedVariantItems.length
  ? it.selectedVariantItems
  : Array.isArray(quoteItem?.selectedVariantItems)
  ? quoteItem.selectedVariantItems
  : [];

  const ringSizeFromVariants = safeStr(
    selectedVariants.ring_size ||
      selectedVariants.ringSize ||
      selectedVariants.size
  );

  const ringSizeFromItems = safeStr(
    selectedVariantItems.find((v: any) => {
      const groupId = safeStr(v?.groupId).toLocaleLowerCase("tr-TR");
      const groupLabel = safeStr(v?.groupLabel).toLocaleLowerCase("tr-TR");

      return (
        groupId === "ring_size" ||
        groupId.includes("ring") ||
        groupLabel.includes("ölç") ||
        groupLabel.includes("size")
      );
    })?.label
  );

  const finalRingSize =
    selectedSize || ringSizeFromVariants || ringSizeFromItems;

  const visibleSelectedVariants = Object.entries(selectedVariants).filter(([k]) => {
    const key = safeStr(k).toLocaleLowerCase("tr-TR");
    return key !== "ring_size" && key !== "ringsize" && key !== "size";
  });

  const visibleVariantItems = selectedVariantItems.filter((v: any) => {
    const groupId = safeStr(v?.groupId).toLocaleLowerCase("tr-TR");
    const groupLabel = safeStr(v?.groupLabel).toLocaleLowerCase("tr-TR");

    return !(
      groupId === "ring_size" ||
      groupId.includes("ring") ||
      groupLabel.includes("ölç") ||
      groupLabel.includes("size")
    );
  });

  const hasAny =
    finalRingSize ||
    (it?.variant && Object.keys(it.variant).length) ||
    visibleSelectedVariants.length ||
    visibleVariantItems.length;

  if (!hasAny) return null;

  return (
    <div className={s.variantWrap}>
      {it?.variant && Object.keys(it.variant).length
        ? Object.entries(it.variant).map(([k, v]) => {
            const key = safeStr(k).toLocaleLowerCase("tr-TR");
            if (key === "ring_size" || key === "ringsize" || key === "size") {
              return null;
            }

            return (
              <span key={`variant-${k}`} className={s.variantChip}>
                {k}: {String(v)}
              </span>
            );
          })
        : null}

      {finalRingSize ? (
        <span className={s.variantChip}>
          Yüzük Ölçüsü: {finalRingSize}
        </span>
      ) : null}

      {visibleSelectedVariants.map(([k, v]) => (
        <span key={`selected-${k}`} className={s.variantChip}>
          {k}: {String(v)}
        </span>
      ))}

      {visibleVariantItems.map((v: any, idx: number) => {
        const groupLabel = safeStr(v?.groupLabel);
        const label = safeStr(v?.label || v?.value);
        const priceDelta = Number(v?.priceDelta || 0);

        if (!groupLabel && !label) return null;

        return (
          <span key={`variant-item-${idx}`} className={s.variantChip}>
            {groupLabel || "Seçenek"}: {label}
            {priceDelta > 0 ? ` +${fmtTRY(priceDelta)}` : ""}
          </span>
        );
      })}
    </div>
  );
})()}
              {getItemCustomText(docx, it) ? (
  <div className={s.customTextBox}>
    <div className={s.customTextHead}>
      <span>Ürün üzerine yazılacak metin</span>

      <button
        type="button"
        className={s.copyBtn}
        onClick={() =>
          handleCopy(getItemCustomText(docx, it), "Ürün yazısı")
        }
      >
        Kopyala
      </button>
    </div>

    <div className={s.customTextValue}>
      {getItemCustomText(docx, it)}
    </div>

    <div className={s.customTextHint}>
      Üretime geçmeden önce yazım, karakter ve boşluk kontrolü yap.
    </div>
  </div>
) : null}        
                    </div>

                    <div className={s.itemTotal}>{fmtTRY(line)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className={s.rightCol}>
          <div className={`${s.card} ${s.sticky}`}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Yönetim Paneli</h2>
                <p className={s.cardDesc}>Durum, not ve sipariş özeti.</p>
              </div>
            </div>

            <div className={s.summaryBox}>
              <div className={s.sumRow}>
                <span>Ara Toplam</span>
                <b>{fmtTRY(subtotal)}</b>
              </div>
              <div className={s.sumRow}>
                <span>Kargo</span>
                <b>{fmtTRY(shipping)}</b>
              </div>
              <div className={s.sumRow}>
                <span>İndirim</span>
                <b>{fmtTRY(discount)}</b>
              </div>
{serviceTotal > 0 ? (

  <div className={s.sumRow}>

    <span>Ek Hizmet / Paketleme</span>

    <b>{fmtTRY(serviceTotal)}</b>

  </div>

) : null}
              <div className={s.divider} />

              <div className={s.sumTotal}>
                <span>Toplam</span>
                <b>{fmtTRY(total)}</b>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.blockTitle}>Ödeme Bilgisi</div>
              <div className={s.payInfoGrid}>
                <div className={s.payInfoItem}>
                  <span>Sağlayıcı</span>
                  <b>{paymentProvider || "—"}</b>
                </div>
                <div className={s.payInfoItem}>
                  <span>Yöntem</span>
                  <b>{paymentMethod || "—"}</b>
                </div>
                <div className={s.payInfoItem}>
                  <span>Ödeme Durumu</span>
                  <b>{paymentStatus || "—"}</b>
                </div>
                <div className={s.payInfoItem}>
                  <span>Ödeme Tarihi</span>
                  <b>{paidAt}</b>
                </div>
              </div>

              {paymentRef ? (
                <div className={s.payRefRow}>
                  <span className={s.payRefText}>Ref: {paymentRef}</span>
                  <button
                    type="button"
                    className={s.copyBtn}
                    onClick={() => handleCopy(paymentRef, "Ödeme referansı")}
                  >
                    Kopyala
                  </button>
                </div>
              ) : null}
                            {customerPaymentNotified && isTransferOrder ? (
                <div className={s.transferNoticeBox}>
                  <div className={s.transferNoticeTop}>
                    <div>
                      <b>Müşteri ödeme yaptığını bildirdi</b>
                      <span>
                        Banka hesabını kontrol edip ödeme geldiyse siparişi onaylayın.
                      </span>
                    </div>

                    {canApproveTransferPayment ? (
                      <button
                        type="button"
                        className={s.primaryBtn}
                        onClick={handleApproveTransferPayment}
                        disabled={busy}
                      >
                        {busy ? "Onaylanıyor…" : "Ödemeyi Onayla"}
                      </button>
                    ) : (
                      <span className={`${s.badge} ${s.badgeOk}`}>
                        Ödeme onaylandı
                      </span>
                    )}
                  </div>

                  <div className={s.transferNoticeMeta}>
                    <span>Bildirim zamanı: {customerPaymentNotifiedAt}</span>
                    {docx.paymentNotification?.note ? (
                      <span>{docx.paymentNotification.note}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={s.block}>
              <div className={s.blockTitle}>Durum Güncelle</div>
              <select
                className={s.select}
                value={(docx.status as any) || "pending_payment"}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                disabled={busy}
              >
                {STATUS.map((x) => (
                  <option key={x.v} value={x.v}>
                    {x.label}
                  </option>
                ))}
              </select>
              <div className={s.smallMuted}>
                “Ödendi” seçilirse stok düşürme fonksiyonu da çalışır.
              </div>
            </div>

            <div className={s.block}>
              <div className={s.blockTitle}>Admin Notu</div>
              <textarea
                className={s.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Siparişle ilgili iç not yaz…"
              />
              <button className={s.primaryBtn} type="button" onClick={saveNote} disabled={busy}>
                {busy ? "Kaydediliyor…" : "Notu Kaydet"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminGate>
      <PermissionGate permission="orders">
        <AdminOrderDetailPageInner params={params} />
      </PermissionGate>
    </AdminGate>
  );
}