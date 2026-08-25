"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getIdTokenResult, onIdTokenChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
} from "@/lib/firebase.client";
import s from "./refunds.module.css";
import { adminFetch } from "@/lib/adminFetch";

type RefundStatus =
  | "pending"
  | "approved"
  | "processing"
  | "refunded"
  | "rejected"
  | "failed"
  | "cancelled"
  | "return_order_created"
  | "return_label_created"
  | "return_label_error"
  | "return_label_failed"
  | "return_label_cancelled"
  | string;

type RefundType = "full" | "partial";

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
  receivedBy?: string;
  cancelledAt?: any;
  cancelledAtIso?: string;
  updatedAt?: any;
  lastError?: string;
};

type RefundRequest = {
  id: string;
  orderId?: string;
  orderDocId?: string;
  uid?: string;
  merchantOid?: string;
  amountTry?: string | number;
  type?: RefundType;
  reason?: string;
  note?: string;
  status?: RefundStatus;
  createdAt?: any;
  updatedAt?: any;
  approvedAt?: any;
  processedAt?: any;
  processedAtIso?: string;
  processedBy?: string;
  rejectReason?: string;

  returnShipment?: ReturnShipment;
  returnShipping?: ReturnShipment;

  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};

type AdminCheckState = "loading" | "allowed" | "denied";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeAmount(v: any) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtTRY(v: any) {
  const n = normalizeAmount(v);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(n);
}

function fmtDate(v: any) {
  try {
    if (v?.toDate) {
      return new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(v.toDate());
    }

    if (typeof v === "string" && v) {
      return new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v));
    }

    if (typeof v?.seconds === "number") {
      return new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v.seconds * 1000));
    }
  } catch {
    //
  }

  return "—";
}

function getStatusLabel(status: RefundStatus) {
  const st = safeStr(status);

  switch (st) {
    case "pending":
      return "Bekliyor";
    case "approved":
      return "Talep Onaylandı";
    case "processing":
      return "İade İşleniyor";
    case "refunded":
      return "Para İade Edildi";
    case "rejected":
      return "Reddedildi";
    case "failed":
      return "İade Hatalı";
    case "cancelled":
      return "İptal";
    case "return_order_created":
      return "İade Kargo Siparişi Oluştu";
    case "return_label_created":
      return "İade Kodu Hazır";
    case "return_label_error":
      return "İade Kodu Hatalı";
    case "return_label_failed":
      return "İade Kodu Oluşturulamadı";
    case "return_label_cancelled":
      return "İade Kodu İptal";
    default:
      return st || "Bekliyor";
  }
}

function getTypeLabel(type?: RefundType) {
  return type === "partial" ? "Kısmi İade" : "Tam İade";
}

function getStatusClass(status: RefundStatus) {
  const st = safeStr(status);

  if (st === "refunded") return s.statusRefunded;
  if (
    st === "approved" ||
    st === "return_order_created" ||
    st === "return_label_created"
  ) {
    return s.statusApproved;
  }
  if (st === "processing") return s.statusProcessing;
  if (
    st === "failed" ||
    st === "return_label_failed" ||
    st === "return_label_error"
  ) {
    return s.statusFailed;
  }
  if (st === "rejected") return s.statusRejected;
  if (st === "cancelled" || st === "return_label_cancelled") {
    return s.statusCancelled;
  }

  return s.statusPending;
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

function getShipmentId(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return (
    safeStr(a.shipmentId) ||
    safeStr(a.shipmentRef) ||
    safeStr(b.shipmentId) ||
    safeStr(b.shipmentRef)
  );
}

function getReferenceId(row: RefundRequest) {
  const a = getReturnShip(row);
  const b = getMirrorShip(row);

  return safeStr(a.referenceId) || safeStr(b.referenceId);
}
function isOrderCancellationReason(row: RefundRequest) {
  const reason = safeStr(row.reason).toLocaleLowerCase("tr-TR");

  return (
    reason.includes("sipariş iptali") ||
    reason.includes("siparis iptali") ||
    reason.includes("order cancellation") ||
    reason.includes("iptal")
  );
}

function refundNeedsReturnShipment(row: RefundRequest) {
  const reasonIsCancel = isOrderCancellationReason(row);

  const ship = getMirrorShip(row);
  const hasReturnCode = Boolean(getReturnCode(row));
  const hasReturnShipment = Boolean(getShipmentId(row) || getReferenceId(row));
  const shipStatus = safeStr(ship.status);

  // Sipariş iptaliyse ve henüz iade kargo oluşmamışsa kargo gerekmez.
  if (reasonIsCancel && !hasReturnCode && !hasReturnShipment) {
    return false;
  }

  // Daha önce kargo kodu oluşmuşsa artık kargo akışıdır.
  if (hasReturnCode || hasReturnShipment) {
    return true;
  }

  // Müşteri ürünü göndermiş / mağaza teslim almışsa kargo akışıdır.
  if (
    shipStatus === "shipped_by_customer" ||
    shipStatus === "received_by_store" ||
    shipStatus === "waiting_customer" ||
    shipStatus === "barcode_created"
  ) {
    return true;
  }

  return true;
}

function isNoReturnShipmentFlow(row: RefundRequest) {
  return !refundNeedsReturnShipment(row);
}
function getShipmentLabel(row: RefundRequest) {
  if (isNoReturnShipmentFlow(row)) {
    return "Kargo Gerekmiyor";
  }

  const status = safeStr(row.status);
  const ship = getMirrorShip(row);
  const shipStatus = safeStr(ship.status);

  if (status === "return_label_created") return "İade Kodu Hazır";
  if (status === "return_label_cancelled") return "İade Kodu İptal";
  if (status === "return_label_error") return "İade Kodu Hatalı";
  if (status === "return_label_failed") return "İade Kodu Oluşturulamadı";
  if (shipStatus === "received_by_store") return "Ürün Teslim Alındı";
  if (shipStatus === "shipped_by_customer") return "Müşteri Kargoya Verdi";
  if (shipStatus === "waiting_customer") return "Müşteri Bekleniyor";
  if (shipStatus === "creating") return "Kod Oluşturuluyor";
  if (shipStatus === "cancelled") return "İade Kargo İptal";

  return "Kargo Bekleniyor";
}

function getShipmentTone(row: RefundRequest) {
  if (isNoReturnShipmentFlow(row)) {
    return s.shipmentOk;
  }

  const status = safeStr(row.status);
  const shipStatus = safeStr(getMirrorShip(row).status);

  if (status === "return_label_created" || shipStatus === "received_by_store") {
    return s.shipmentOk;
  }

  if (
    status === "return_label_error" ||
    status === "return_label_failed" ||
    status === "return_label_cancelled" ||
    shipStatus === "cancelled" ||
    shipStatus === "failed"
  ) {
    return s.shipmentWarn;
  }

  if (shipStatus === "shipped_by_customer" || shipStatus === "creating") {
    return s.shipmentInfo;
  }

  return s.shipmentWarn;
}

function canCreateReturnShipment(row: RefundRequest) {
  if (isNoReturnShipmentFlow(row)) return false;

  const st = safeStr(row.status);
  const ship = getReturnShip(row);

  if (
    ![
      "approved",
      "return_approved",
      "return_label_failed",
      "return_label_error",
      "return_label_cancelled",
    ].includes(st)
  ) {
    return false;
  }

  const shipStatus = safeStr(ship.status);

  if (st === "return_label_cancelled" || shipStatus === "cancelled") {
    return true;
  }

  const hasCode = Boolean(getReturnCode(row));
  const hasShipment = Boolean(getShipmentId(row));

  return !hasCode && !hasShipment;
}

function canCancelReturnShipment(row: RefundRequest) {
  const st = safeStr(row.status);
  const ship = getReturnShip(row);

  const shipStatus = safeStr(ship.status);

  if (st !== "return_label_created" && shipStatus !== "barcode_created") {
    return false;
  }

  return Boolean(getReferenceId(row) && getShipmentId(row));
}

function canMarkReturnReceived(row: RefundRequest) {
  if (isNoReturnShipmentFlow(row)) return false;

  const st = safeStr(row.status);
  const ship = getMirrorShip(row);
  const shipStatus = safeStr(ship.status);

  return (
    st === "return_label_created" ||
    st === "approved" ||
    shipStatus === "shipped_by_customer" ||
    shipStatus === "waiting_customer"
  );
}
function getRefundPaymentFlow(row: RefundRequest) {
  const flow = safeStr((row as any).refundPaymentFlow).toLowerCase();
  const provider = safeStr((row as any).paymentProvider).toLowerCase();
  const method = safeStr((row as any).paymentMethod).toLowerCase();
  const merchantOid = safeStr(row.merchantOid);

  if (flow === "paytr") return "paytr";
  if (flow === "manual") return "manual";

  if (provider === "paytr" || method === "card") return "paytr";
  if (provider === "manual" || method === "eft" || method === "havale" || method === "transfer") {
    return "manual";
  }

  // merchantOid yoksa büyük ihtimal havale/manual
  if (!merchantOid) return "manual";

  return "paytr";
}

function isManualRefund(row: RefundRequest) {
  return getRefundPaymentFlow(row) === "manual";
}
async function restoreOrderStockOnce(db: any, orderId: string) {
  const cleanOrderId = safeStr(orderId);
  if (!cleanOrderId) return;

  const orderRef = doc(db, "orders", cleanOrderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Sipariş bulunamadı, stok geri yüklenemedi.");
  }

  const orderData: any = orderSnap.data();

  if (orderData.stockRestored === true) {
    return;
  }

  const items = Array.isArray(orderData.items) ? orderData.items : [];

  for (const item of items) {
    const productId = safeStr(item?.productId);
    const slug = safeStr(item?.slug);
    const qty = Number(item?.qty || 1);

    if (!Number.isFinite(qty) || qty <= 0) continue;

    let productRef: any = null;

    if (productId) {
      const directRef = doc(db, "products", productId);
      const directSnap = await getDoc(directRef);

      if (directSnap.exists()) {
        productRef = directRef;
      }
    }

    if (!productRef && slug) {
      const slugSnap = await getDocs(
        query(collection(db, "products"), where("slug", "==", slug), limit(1))
      );

      if (!slugSnap.empty) {
        productRef = doc(db, "products", slugSnap.docs[0].id);
      }
    }

    if (!productRef) {
      console.warn("restoreOrderStockOnce product not found:", {
        productId,
        slug,
        qty,
      });
      continue;
    }

    await updateDoc(productRef, {
      stock: increment(qty),
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    });
  }

  await updateDoc(orderRef, {
    stockRestored: true,
    stockRestoredAt: serverTimestamp(),
    stockRestoredAtIso: new Date().toISOString(),
    stockRestoredReason: "manual_refund_completed",
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
  });
}
function canExecutePaytrRefund(row: RefundRequest) {
  const st = safeStr(row.status);
  const shipmentStatus = safeStr(getMirrorShip(row).status);

  // Sipariş iptali / kargo gerekmeyen akışta onaylandıysa işlem yapılabilir.
  if (isNoReturnShipmentFlow(row)) {
    return st === "approved" || st === "failed";
  }

  // Normal ürün iadesinde ürün mağazaya gelmeden para/manual iade yok.
  return (
    (st === "approved" && shipmentStatus === "received_by_store") ||
    (st === "return_label_created" && shipmentStatus === "received_by_store") ||
    st === "failed"
  );
}

export default function AdminRefundsPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);
  const functions = useMemo(
    () => getFunctions(getFirebaseApp(), "europe-west1"),
    []
  );

  const [user, setUser] = useState<User | null>(null);
  const [adminState, setAdminState] = useState<AdminCheckState>("loading");

  const [rows, setRows] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [busyId, setBusyId] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      setAdminState("loading");

      if (!u || u.isAnonymous) {
        setAdminState("denied");
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(u, true);
        const claims = tokenResult.claims as Record<string, any>;

        const roles = Array.isArray(claims.roles)
          ? claims.roles.map(String)
          : [];

        const role = safeStr(claims.role);

        const claimAllowed =
          claims.admin === true ||
          role === "admin" ||
          role === "sub_admin" ||
          roles.includes("admin") ||
          roles.includes("sub_admin");

        if (claimAllowed) {
          setAdminState("allowed");
          return;
        }

        const email = safeStr(u.email).toLowerCase();

        if (!email) {
          setAdminState("denied");
          return;
        }

        const adminSnap = await getDoc(doc(db, "admins", email));
        const adminDoc = adminSnap.exists() ? (adminSnap.data() as any) : null;

        const docAllowed =
          adminDoc?.enabled === true &&
          ["admin", "sub_admin"].includes(safeStr(adminDoc?.role));

        setAdminState(docAllowed ? "allowed" : "denied");
      } catch (e) {
        console.error("refund admin permission error:", e);
        setAdminState("denied");
      }
    });

    return () => unsub();
  }, [auth, db]);

  useEffect(() => {
    if (adminState !== "allowed") {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qy = query(
      collection(db, "refund_requests"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as RefundRequest[];

        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error("refund_requests snapshot error:", e);
        setErr("İade talepleri yüklenemedi.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [adminState, db]);

  const counts = useMemo(() => {
    const base = {
      total: 0,
      pending: 0,
      approved: 0,
      labelCreated: 0,
      labelCancelled: 0,
      processing: 0,
      refunded: 0,
      rejected: 0,
      failed: 0,
      returnReceived: 0,
    };

    for (const row of rows) {
      const status = safeStr(row.status || "pending");
      const shipmentStatus = safeStr(getMirrorShip(row).status);

      base.total += 1;

      if (status === "pending") base.pending += 1;
      if (status === "approved") base.approved += 1;
      if (status === "return_label_created") base.labelCreated += 1;
      if (status === "return_label_cancelled") base.labelCancelled += 1;
      if (status === "processing") base.processing += 1;
      if (status === "refunded") base.refunded += 1;
      if (status === "rejected") base.rejected += 1;
      if (
        status === "failed" ||
        status === "return_label_failed" ||
        status === "return_label_error"
      ) {
        base.failed += 1;
      }

      if (shipmentStatus === "received_by_store") {
        base.returnReceived += 1;
      }
    }

    return base;
  }, [rows]);

  async function approveRefund(row: RefundRequest) {
    const status = safeStr(row.status || "pending");

    if (status !== "pending") return;

    const amount = fmtTRY(row.amountTry);
    const orderId = safeStr(row.orderId);

    const confirmed = window.confirm(
      `${orderId} siparişi için ${amount} iade talebi ONAYLANSIN mı?\n\nBu işlem para iadesi yapmaz. Sadece müşterinin iade talebi onaylanır. Sonrasında MNG iade kargo kodu oluşturabilirsiniz.`
    );

    if (!confirmed) return;

    try {
      setBusyId(row.id);
      setErr("");
      setOk("");

      const callable = httpsCallable(functions, "approveRefundRequestOnlyV1");
      await callable({ refundId: row.id });

     const noShipmentFlow = isNoReturnShipmentFlow(row);

await updateDoc(doc(db, "refund_requests", row.id), {
  ...(noShipmentFlow
    ? {
        "returnShipment.provider": "",
        "returnShipment.carrier": "",
        "returnShipment.status": "not_required",
        "returnShipment.systemGenerated": false,
        "returnShipment.updatedAt": serverTimestamp(),

        "returnShipping.provider": "",
        "returnShipping.carrier": "",
        "returnShipping.status": "not_required",
        "returnShipping.systemGenerated": false,
        "returnShipping.updatedAt": serverTimestamp(),
      }
    : {
        "returnShipment.provider": "mng",
        "returnShipment.carrier": "MNG Kargo",
        "returnShipment.status": "waiting_customer",
        "returnShipment.systemGenerated": true,
        "returnShipment.updatedAt": serverTimestamp(),
      }),

  rejectReason: "",
  updatedAt: serverTimestamp(),
  updatedAtIso: new Date().toISOString(),
});

      setOk(
  noShipmentFlow
    ? "Sipariş iptali onaylandı. Bu talep için iade kargo gerekmiyor; para iadesini başlatabilirsiniz."
    : "İade talebi onaylandı. Şimdi MNG iade kargo kodu oluşturabilirsiniz."
);
    } catch (e: any) {
      console.error("approve refund request error:", e);
      setErr(e?.message || "İade talebi onaylanamadı.");
    } finally {
      setBusyId("");
    }
  }

  async function rejectRefund(row: RefundRequest) {
    const status = safeStr(row.status || "pending");

    if (status !== "pending") return;

    const rejectReason = window.prompt(
      "İade red sebebi yaz:",
      "Talep uygun bulunmadı."
    );

    if (rejectReason === null) return;

    try {
      setBusyId(row.id);
      setErr("");
      setOk("");

      await updateDoc(doc(db, "refund_requests", row.id), {
        status: "rejected",
        rejectReason: safeStr(rejectReason) || "Talep uygun bulunmadı.",
        rejectedAt: serverTimestamp(),
        rejectedAtIso: new Date().toISOString(),
        rejectedBy: user?.email || user?.uid || "admin",
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      });

      setOk("İade talebi reddedildi.");
    } catch (e) {
      console.error("reject refund error:", e);
      setErr("İade talebi reddedilemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function createReturnShipment(row: RefundRequest) {
    if (!canCreateReturnShipment(row)) return;

    const confirmed = window.confirm(
      "Bu talep için MNG iade kargo kodu oluşturulsun mu?\n\nMüşteri bu kod ile anlaşmalı MNG şubesinden ürünü ücretsiz iade gönderebilir."
    );

    if (!confirmed) return;

    try {
      setBusyId(row.id);
      setErr("");
      setOk("");

      const res = await adminFetch("/api/returns/create-shipment", {
        method: "POST",
        body: JSON.stringify({
          refundId: row.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(
          safeStr(data?.error) ||
            safeStr(data?.message) ||
            "İade kargo kodu oluşturulamadı."
        );
      }

      const code =
        safeStr(data?.returnCode) ||
        safeStr(data?.trackingNumber) ||
        safeStr(data?.trackingNo) ||
        "—";

      setOk(`MNG iade kargo kodu oluşturuldu: ${code}`);
    } catch (e: any) {
      console.error("create return shipment error:", e);
      setErr(e?.message || "MNG iade kargo kodu oluşturulamadı.");
    } finally {
      setBusyId("");
    }
  }

  async function cancelReturnShipment(row: RefundRequest) {
    if (!canCancelReturnShipment(row)) return;

    const code = getReturnCode(row);

    const confirmed = window.confirm(
      `${code || "Bu"} iade kargo kodu iptal edilsin mi?\n\nİptal sonrası müşteri bu kodla gönderim yapamaz. Gerekirse yeni kod oluşturabilirsiniz.`
    );

    if (!confirmed) return;

    try {
      setBusyId(row.id);
      setErr("");
      setOk("");

      const res = await adminFetch("/api/returns/cancel-shipment", {
        method: "POST",
        body: JSON.stringify({
          refundId: row.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(
          safeStr(data?.error) ||
            safeStr(data?.message) ||
            "İade kargo kodu iptal edilemedi."
        );
      }

      setOk("MNG iade kargo kodu iptal edildi.");
    } catch (e: any) {
      console.error("cancel return shipment error:", e);
      setErr(e?.message || "MNG iade kargo kodu iptal edilemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function markReturnReceived(row: RefundRequest) {
    if (!canMarkReturnReceived(row)) {
      setErr("Bu talep şu anda teslim alındı olarak işaretlenemez.");
      return;
    }

    const confirmed = window.confirm(
      "İade ürünü mağazaya/deponuza ulaştı ve kontrol edildi mi?\n\nBu işlemden sonra PayTR para iadesi başlatılabilir."
    );

    if (!confirmed) return;

    try {
      setBusyId(row.id);
      setErr("");
      setOk("");

      await updateDoc(doc(db, "refund_requests", row.id), {
        "returnShipment.status": "received_by_store",
        "returnShipment.receivedAt": serverTimestamp(),
        "returnShipment.receivedAtIso": new Date().toISOString(),
        "returnShipment.receivedBy": user?.email || user?.uid || "admin",
        "returnShipment.updatedAt": serverTimestamp(),

        "returnShipping.receivedAt": serverTimestamp(),
        "returnShipping.receivedAtIso": new Date().toISOString(),

        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
      });

      setOk("İade ürünü teslim alındı olarak işaretlendi. Para iadesi başlatılabilir.");
    } catch (e) {
      console.error("mark return received error:", e);
      setErr("İade ürünü teslim alındı olarak işaretlenemedi.");
    } finally {
      setBusyId("");
    }
  }

 async function executePaytrRefund(row: RefundRequest) {
  if (!canExecutePaytrRefund(row)) {
    setErr(
      isNoReturnShipmentFlow(row)
        ? "Bu talep henüz iade için uygun değil."
        : "Para iadesi için önce iade ürününü teslim alındı olarak işaretlemelisiniz."
    );
    return;
  }

  const amount = fmtTRY(row.amountTry);
  const orderId = safeStr(row.orderId);
  const manual = isManualRefund(row);

  const confirmed = window.confirm(
    manual
      ? `${orderId} siparişi için ${amount} MANUEL İADE tamamlandı olarak işaretlensin mi?\n\nBu işlem PayTR’ye gönderilmez. Havale/EFT iadesini bankanızdan yaptıysanız devam edin.`
      : `${orderId} siparişi için ${amount} GERÇEK PARA İADESİ yapılsın mı?\n\nBu işlem PayTR tarafına gerçek iade talebi gönderir. Ürün kontrol edildiyse devam edin.`
  );

  if (!confirmed) return;

  try {
    setBusyId(row.id);
    setErr("");
    setOk("");

 if (manual) {
  const nowIso = new Date().toISOString();

  if (safeStr(row.type) === "full" && orderId) {
    await restoreOrderStockOnce(db, orderId);
  }

  await updateDoc(doc(db, "refund_requests", row.id), {
        status: "refunded",
        processedAt: serverTimestamp(),
        processedAtIso: nowIso,
        processedBy: user?.email || user?.uid || "admin",

        manualRefund: {
          completed: true,
          amountTry: safeStr(row.amountTry),
          completedAt: serverTimestamp(),
          completedAtIso: nowIso,
          completedBy: user?.email || user?.uid || "admin",
          note: "Havale/EFT iadesi admin tarafından manuel tamamlandı olarak işaretlendi.",
        },

        updatedAt: serverTimestamp(),
        updatedAtIso: nowIso,
      });

     if (orderId) {
  await updateDoc(doc(db, "orders", orderId), {
    status: "refunded",
    refundStatus: "full_refunded",
    refundedTotal: {
      amount: normalizeAmount(row.amountTry),
      currency: "TRY",
    },
    manualRefundCompleted: true,
    manualRefundCompletedAt: serverTimestamp(),
    manualRefundCompletedAtIso: nowIso,

    stockRestored: true,
    stockRestoredReason: "manual_refund_completed",

    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso,
  } as any);
}

      setOk("Havale/EFT iadesi manuel olarak tamamlandı işaretlendi. PayTR’ye gönderim yapılmadı.");
      return;
    }

    const callable = httpsCallable(functions, "approvePaytrRefundRequestV1");
    const res: any = await callable({ refundId: row.id });

    // PayTR iadesi başarılı → tam iade ise stok geri ekle
    const refundOrderId = safeStr(row.orderId);
    if (safeStr(row.type) === "full" && refundOrderId) {
      try {
        await restoreOrderStockOnce(db, refundOrderId);
      } catch (stockErr: any) {
        console.error("PayTR iade sonrası stok geri ekleme hatası:", stockErr);
        // Para iadesi başarılı oldu, stok hatası kullanıcıya bildirilsin ama işlem dursun
        setErr(`Para iadesi başarılı fakat stok geri eklenemedi: ${stockErr?.message || "Bilinmeyen hata"}`);
      }
    }

    const referenceNo =
      safeStr(res?.data?.referenceNo) ||
      safeStr(res?.data?.paytr?.reference_no) ||
      safeStr(res?.data?.result?.reference_no) ||
      "—";

    setOk(`PayTR para iadesi yapıldı. PayTR referans: ${referenceNo}`);
  } catch (e: any) {
    console.error("execute refund error:", e);
    setErr(e?.message || "Para iadesi tamamlanamadı.");
  } finally {
    setBusyId("");
  }
}

  if (adminState === "loading") {
    return (
      <main className={s.page}>
        <div className={s.stateCard}>Yetki kontrol ediliyor…</div>
      </main>
    );
  }

  if (adminState === "denied") {
    return (
      <main className={s.page}>
        <div className={s.deniedCard}>
          <div className={s.deniedIcon}>⛔</div>
          <h1>Yetkisiz erişim</h1>
          <p>Bu sayfayı görüntülemek için admin veya sub_admin yetkisi gerekiyor.</p>
          <span>{user?.email || "Oturum bulunamadı"}</span>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.heroText}>
          <div className={s.kicker}>İADE / MNG KARGO / PAYTR</div>
          <h1>İade Operasyon Merkezi</h1>
          <p>
            Talebi onayla, MNG iade kodu oluştur, ürün mağazaya ulaşınca teslim al ve PayTR para iadesini güvenle başlat.
          </p>
        </div>

        <div className={s.stats}>
          <div className={s.statCard}>
            <span>Toplam</span>
            <b>{counts.total}</b>
          </div>

          <div className={s.statCard}>
            <span>Bekleyen</span>
            <b>{counts.pending}</b>
          </div>

          <div className={s.statCard}>
            <span>Onaylanan</span>
            <b>{counts.approved}</b>
          </div>

          <div className={s.statCard}>
            <span>Kod Hazır</span>
            <b>{counts.labelCreated}</b>
          </div>

          <div className={s.statCard}>
            <span>Kod İptal</span>
            <b>{counts.labelCancelled}</b>
          </div>

          <div className={s.statCard}>
            <span>Teslim Alındı</span>
            <b>{counts.returnReceived}</b>
          </div>

          <div className={s.statCard}>
            <span>İade Tamam</span>
            <b>{counts.refunded}</b>
          </div>
        </div>
      </section>

      {err ? <div className={s.alertBad}>{err}</div> : null}
      {ok ? <div className={s.alertOk}>{ok}</div> : null}

      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2>Talep Listesi</h2>
            <p>Son 100 iade talebi listelenir. Kargo kodu ve para iadesi ayrı ayrı yönetilir.</p>
          </div>
          <span className={s.livePill}>Canlı</span>
        </div>

        {loading ? (
          <div className={s.empty}>İade talepleri yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className={s.empty}>Henüz iade talebi yok.</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Sipariş</th>
                  <th>Tutar</th>
                  <th>Tip</th>
                  <th>Sebep</th>
                  <th>İade Kargo</th>
                  <th>PayTR</th>
                  <th>Tarih</th>
                  <th className={s.thRight}>İşlem</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const status = safeStr(row.status || "pending");
                  const busy = busyId === row.id;

                  const shipment = getMirrorShip(row);
                  const code = getReturnCode(row);
                  const trackingUrl = getTrackingUrl(row);
                  const shipmentId = getShipmentId(row);
                  const referenceId = getReferenceId(row);

                  const canCreate = canCreateReturnShipment(row);
                  const canCancel = canCancelReturnShipment(row);
                  const canReceive = canMarkReturnReceived(row);
                  const canRefund = canExecutePaytrRefund(row);

                  return (
                    <tr key={row.id}>
                      <td>
                        <span className={`${s.statusPill} ${getStatusClass(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      </td>

                      <td>
                        <div className={s.mainText}>{safeStr(row.orderId) || "—"}</div>
                        <div className={s.subText}>{safeStr(row.uid) || "—"}</div>
                        {safeStr(row.merchantOid) ? (
                          <code className={s.code}>{safeStr(row.merchantOid)}</code>
                        ) : null}
                      </td>

                      <td>
                        <strong className={s.amount}>{fmtTRY(row.amountTry)}</strong>
                      </td>

                      <td>{getTypeLabel(row.type)}</td>

                      <td>
                        <div className={s.reason}>{safeStr(row.reason) || "—"}</div>

                        {safeStr(row.note) ? (
                          <div className={s.subText}>Not: {safeStr(row.note)}</div>
                        ) : null}

                        {safeStr(row.rejectReason) ? (
                          <div className={s.rejectReason}>Red: {safeStr(row.rejectReason)}</div>
                        ) : null}

                        {safeStr(shipment.lastError) ? (
                          <div className={s.errorText}>Kargo: {safeStr(shipment.lastError)}</div>
                        ) : null}
                      </td>

                      <td>
                        <div className={`${s.shipmentBox} ${getShipmentTone(row)}`}>
                          <div className={s.shipmentTitle}>{getShipmentLabel(row)}</div>

                         {isNoReturnShipmentFlow(row) ? (
  <>
    <div className={s.shipmentLine}>
      Bu talep sipariş iptali olarak işlenir.
    </div>
    <div className={s.shipmentLine}>
      MNG iade kodu gerekmez.
    </div>
  </>
) : (
  <>
    <div className={s.shipmentLine}>
      Firma: <b>{safeStr(shipment.carrier) || "MNG Kargo"}</b>
    </div>

    <div className={s.shipmentLine}>
      Kod: <b>{code || "—"}</b>
    </div>

    <div className={s.shipmentLine}>
      Shipment: <b>{shipmentId || "—"}</b>
    </div>

    <div className={s.shipmentLine}>
      Ref: <b>{referenceId || "—"}</b>
    </div>
  </>
)}
                          {trackingUrl ? (
                            <Link
                              className={s.code}
                              href={trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              MNG takip linki
                            </Link>
                          ) : null}

                          {shipment.receivedAt || shipment.receivedAtIso ? (
                            <div className={s.shipmentDate}>
                              Teslim alındı: {fmtDate(shipment.receivedAt || shipment.receivedAtIso)}
                            </div>
                          ) : null}

                          {shipment.cancelledAt || shipment.cancelledAtIso ? (
                            <div className={s.shipmentDate}>
                              İptal: {fmtDate(shipment.cancelledAt || shipment.cancelledAtIso)}
                            </div>
                          ) : null}
                        </div>
                      </td>

                     <td>
  {isManualRefund(row) ? (
    <div>
      <div className={s.mainText}>Manuel</div>
      <div className={s.subText}>Havale/EFT iadesi</div>
    </div>
  ) : row.paytr?.referenceNo ? (
    <div>
      <div className={s.mainText}>Ref: {row.paytr.referenceNo}</div>
      <div className={s.subText}>Başarılı</div>
    </div>
  ) : row.paytr?.error ? (
    <div className={s.errorText}>{row.paytr.error}</div>
  ) : (
    <span className={s.subText}>—</span>
  )}
</td>

                      <td>{fmtDate(row.createdAt)}</td>

                      <td>
                        <div className={s.actions}>
                          {status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className={s.primaryBtn}
                                disabled={busy}
                                onClick={() => approveRefund(row)}
                              >
                                {busy ? "İşleniyor…" : "Talebi Onayla"}
                              </button>

                              <button
                                type="button"
                                className={s.ghostBtn}
                                disabled={busy}
                                onClick={() => rejectRefund(row)}
                              >
                                Reddet
                              </button>
                            </>
                          ) : null}

                          {canCreate ? (
                            <button
                              type="button"
                              className={s.primaryBtn}
                              disabled={busy}
                              onClick={() => createReturnShipment(row)}
                            >
                              {busy ? "Oluşturuluyor…" : "İade Kodu Oluştur"}
                            </button>
                          ) : null}

                          {canCancel ? (
                            <button
                              type="button"
                              className={s.ghostBtn}
                              disabled={busy}
                              onClick={() => cancelReturnShipment(row)}
                            >
                              {busy ? "İptal ediliyor…" : "Kodu İptal Et"}
                            </button>
                          ) : null}

                          {canReceive && status !== "refunded" && status !== "rejected" ? (
                            <button
                              type="button"
                              className={s.receiveBtn}
                              disabled={busy}
                              onClick={() => markReturnReceived(row)}
                            >
                              {busy ? "İşleniyor…" : "Ürün Teslim Alındı"}
                            </button>
                          ) : null}

                          {canRefund ? (
                            <button
                              type="button"
                              className={s.refundBtn}
                              disabled={busy}
                              onClick={() => executePaytrRefund(row)}
                            >
                             {busy
                          ? isManualRefund(row)
                            ? "Manuel işleniyor…"
                            : "PayTR işleniyor…"
                          : isManualRefund(row)
                          ? "Manuel İade Tamamla"
                          : "PayTR İadesini Yap"}
                            </button>
                          ) : null}

                          {status === "refunded" ? (
                            <span className={s.doneText}>İade tamamlandı</span>
                          ) : null}

                          {status === "rejected" ? (
                            <span className={s.doneText}>Talep reddedildi</span>
                          ) : null}

                          {!canCreate &&
                          !canCancel &&
                          !canReceive &&
                          !canRefund &&
                          status !== "pending" &&
                          status !== "refunded" &&
                          status !== "rejected" ? (
                            <span className={s.waitText}>Operasyon beklemede</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}