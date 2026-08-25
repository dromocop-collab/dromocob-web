import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";

type MoneyMap = {
  amount?: number;
  currency?: string;
};

type RefundRequestDoc = {
  uid?: string;
  orderId?: string;
  merchantOid?: string;
  amountTry?: string | number;
  reason?: string;
  type?: "full" | "partial" | string;
  status?:
  | "pending"
  | "approved"
  | "processing"
  | "refunded"
  | "failed"
  | "cancelled"
  | "rejected"
  | string;
  paytr?: {
    referenceNo?: string;
    error?: string;
    response?: any;
  };
};

type OrderDoc = {
  uid?: string;
  status?: string;
  paymentStatus?: string;
  payment?: {
    provider?: string;
    method?: string;
    ref?: string;
  };
  meta?: {
    paymentSessionId?: string;
  };
  total?: MoneyMap;
  refundedTotal?: MoneyMap;
  refundStatus?: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function safePaytrReferenceNo(v: unknown, fallbackSeed: string) {
  const raw = safeStr(v).replace(/[^a-zA-Z0-9]/g, "");
  if (raw) return raw.slice(0, 64);

  const seed =
    safeStr(fallbackSeed).replace(/[^a-zA-Z0-9]/g, "").slice(0, 48) ||
    Date.now().toString();

  return `RF${seed}`.slice(0, 64);
}
function reqEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new HttpsError("failed-precondition", `${name} eksik.`);
  }
  return v;
}

function toAmountNumber(v: unknown): number {
  const raw = safeStr(v).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function money(amount: number) {
  return {
    amount: Number(Number(amount || 0).toFixed(2)),
    currency: "TRY",
  };
}

function formatPaytrAmount(v: unknown): string {
  const n = toAmountNumber(v);

  if (!Number.isFinite(n) || n <= 0) {
    throw new HttpsError("invalid-argument", "İade tutarı geçersiz.");
  }

  return n.toFixed(2);
}

function getAdminStatus(req: any) {
  const claims = req.auth?.token || {};
  const role = safeStr(claims.role);
  const roles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];

  return (
    claims.admin === true ||
    role === "admin" ||
    role === "sub_admin" ||
    roles.includes("admin") ||
    roles.includes("sub_admin")
  );
}

function buildPaytrRefundToken(params: {
  merchantId: string;
  merchantOid: string;
  returnAmount: string;
  merchantSalt: string;
  merchantKey: string;
}) {
  const raw =
    params.merchantId +
    params.merchantOid +
    params.returnAmount +
    params.merchantSalt;

  return createHmac("sha256", params.merchantKey).update(raw).digest("base64");
}

async function postPaytrRefund(params: {
  merchantId: string;
  merchantOid: string;
  returnAmount: string;
  paytrToken: string;
  referenceNo?: string;
}) {
  const body = new URLSearchParams();

  body.set("merchant_id", params.merchantId);
  body.set("merchant_oid", params.merchantOid);
  body.set("return_amount", params.returnAmount);
  body.set("paytr_token", params.paytrToken);

  if (params.referenceNo) {
    body.set("reference_no", params.referenceNo);
  }

  const res = await fetch("https://www.paytr.com/odeme/iade", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();

  let json: any = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = {
      status: "failed",
      err_msg: text || `PayTR HTTP ${res.status}`,
    };
  }

  return {
    httpStatus: res.status,
    ok: res.ok,
    rawText: text,
    json,
  };
}

async function resolveOrderForRefundTx(params: {
  db: FirebaseFirestore.Firestore;
  tx: FirebaseFirestore.Transaction;
  orderId: string;
  merchantOid: string;
}) {
  const { db, tx } = params;

  const orderId = safeStr(params.orderId);
  const merchantOid = safeStr(params.merchantOid);

  if (orderId) {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await tx.get(orderRef);

    if (orderSnap.exists) {
      return {
        orderRef,
        orderSnap,
        resolvedOrderId: orderSnap.id,
      };
    }
  }

  if (!merchantOid) {
    throw new HttpsError("not-found", "Order not found and merchantOid missing.");
  }

  const byPaymentRef = await tx.get(
    db.collection("orders").where("payment.ref", "==", merchantOid).limit(1)
  );

  if (!byPaymentRef.empty) {
    const found = byPaymentRef.docs[0];

    return {
      orderRef: found.ref,
      orderSnap: found,
      resolvedOrderId: found.id,
    };
  }

  const bySessionId = await tx.get(
    db.collection("orders").where("meta.paymentSessionId", "==", merchantOid).limit(1)
  );

  if (!bySessionId.empty) {
    const found = bySessionId.docs[0];

    return {
      orderRef: found.ref,
      orderSnap: found,
      resolvedOrderId: found.id,
    };
  }

  throw new HttpsError("not-found", "Order not found.");
}

export const approvePaytrRefundRequestV1 = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req) => {
    const authUid = safeStr(req.auth?.uid);

    if (!authUid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    if (!getAdminStatus(req)) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const refundId = safeStr(req.data?.refundId);
    const overrideAmountTry = req.data?.amountTry;

    if (!refundId) {
      throw new HttpsError("invalid-argument", "refundId required.");
    }

    const merchantId = reqEnv("PAYTR_MERCHANT_ID");
    const merchantKey = reqEnv("PAYTR_MERCHANT_KEY");
    const merchantSalt = reqEnv("PAYTR_MERCHANT_SALT");

    const db = admin.firestore();
    const refundRef = db.collection("refund_requests").doc(refundId);

    const lockResult = await db.runTransaction(async (tx) => {
      const refundSnap = await tx.get(refundRef);

      if (!refundSnap.exists) {
        throw new HttpsError("not-found", "Refund request not found.");
      }

      const refund = refundSnap.data() as RefundRequestDoc;
      const currentStatus = safeStr(refund.status);

      if (currentStatus !== "approved" && currentStatus !== "failed") {
  throw new HttpsError(
    "failed-precondition",
    `Para iadesi için talep önce onaylanmalı. Mevcut status: ${currentStatus}`
  );
}

      const requestOrderId = safeStr(refund.orderId);
      const requestMerchantOid = safeStr(refund.merchantOid);

      if (!requestOrderId && !requestMerchantOid) {
        throw new HttpsError(
          "failed-precondition",
          "refund_requests.orderId veya merchantOid eksik."
        );
      }

      const resolved = await resolveOrderForRefundTx({
        db,
        tx,
        orderId: requestOrderId,
        merchantOid: requestMerchantOid,
      });

      const order = resolved.orderSnap.data() as OrderDoc;

      if (safeStr(order.payment?.provider) !== "paytr") {
        throw new HttpsError("failed-precondition", "Bu sipariş PayTR siparişi değil.");
      }

      if (safeStr(order.payment?.method) !== "card") {
        throw new HttpsError("failed-precondition", "Sadece kart ödemesi iade edilebilir.");
      }

      if (safeStr(order.paymentStatus) !== "paid") {
        throw new HttpsError("failed-precondition", "Sipariş ödeme durumu paid değil.");
      }

      const orderStatus = safeStr(order.status);

      if (!["paid", "preparing", "shipped", "delivered", "refunded"].includes(orderStatus)) {
        throw new HttpsError(
          "failed-precondition",
          `Sipariş iade için uygun durumda değil. status=${orderStatus}`
        );
      }

      const merchantOid =
        requestMerchantOid ||
        safeStr(order.payment?.ref) ||
        safeStr(order.meta?.paymentSessionId);

      if (!merchantOid) {
        throw new HttpsError("failed-precondition", "merchantOid bulunamadı.");
      }

      const refundAmount = toAmountNumber(overrideAmountTry ?? refund.amountTry);
      const orderTotal = toAmountNumber(order.total?.amount);
      const alreadyRefunded = toAmountNumber(order.refundedTotal?.amount);

      if (refundAmount <= 0) {
        throw new HttpsError("invalid-argument", "İade tutarı sıfırdan büyük olmalı.");
      }

      if (orderTotal > 0 && alreadyRefunded + refundAmount > orderTotal + 0.001) {
        throw new HttpsError(
          "failed-precondition",
          "Toplam iade tutarı sipariş tutarını aşamaz."
        );
      }

      const nowIso = new Date().toISOString();
const referenceNo = safePaytrReferenceNo(refund.paytr?.referenceNo, refundId);
      tx.update(refundRef, {
        status: "processing",
        orderId: resolved.resolvedOrderId,
        merchantOid,
        amountTry: refundAmount.toFixed(2),
        "paytr.referenceNo": referenceNo,
        "paytr.error": "",
        "paytr.response": null,
        processingAt: FieldValue.serverTimestamp(),
        processingAtIso: nowIso,
        processedBy: authUid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      });

      return {
        orderId: resolved.resolvedOrderId,
        merchantOid,
        refundAmount,
        orderTotal,
        alreadyRefunded,
        referenceNo,
      };
    });

    const returnAmount = formatPaytrAmount(lockResult.refundAmount);

    const paytrToken = buildPaytrRefundToken({
      merchantId,
      merchantOid: lockResult.merchantOid,
      returnAmount,
      merchantSalt,
      merchantKey,
    });

    const paytrResult = await postPaytrRefund({
      merchantId,
      merchantOid: lockResult.merchantOid,
      returnAmount,
      paytrToken,
      referenceNo: lockResult.referenceNo,
    });

    const paytrJson = paytrResult.json || {};
    const paytrStatus = safeStr(paytrJson.status).toLowerCase();

    const orderRef = db.collection("orders").doc(lockResult.orderId);

    if (paytrStatus === "success") {
      const finalRefunded = Number(
        (lockResult.alreadyRefunded + lockResult.refundAmount).toFixed(2)
      );

      const fullRefund =
        lockResult.orderTotal > 0 &&
        finalRefunded >= lockResult.orderTotal - 0.001;

      const nowIso = new Date().toISOString();

      await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
          throw new HttpsError("not-found", "Order not found after PayTR refund.");
        }

       tx.update(refundRef, {
        status: "refunded",

        refundedAt: FieldValue.serverTimestamp(),
        refundedAtIso: nowIso,

        processedAt: FieldValue.serverTimestamp(),
        processedAtIso: nowIso,

        failedAt: FieldValue.delete(),
        failedAtIso: FieldValue.delete(),

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,

        "paytr.error": "",
        "paytr.response": paytrJson,
      });

        tx.update(orderRef, {
          refundStatus: fullRefund ? "full_refunded" : "partial_refunded",
          refundedTotal: money(finalRefunded),
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: nowIso,
          ...(fullRefund
            ? {
                status: "refunded",
                paymentStatus: "paid",
                refundedAt: FieldValue.serverTimestamp(),
                refundedAtIso: nowIso,
              }
            : {}),
        });
      });

      return {
        ok: true,
        status: "success",
        refundId,
        orderId: lockResult.orderId,
        merchantOid: lockResult.merchantOid,
        returnAmount,
        referenceNo: lockResult.referenceNo,
        paytr: paytrJson,
      };
    }

    const errMsg =
      safeStr(paytrJson.err_msg) ||
      safeStr(paytrJson.error) ||
      safeStr(paytrResult.rawText) ||
      "PayTR iade başarısız.";

    await refundRef.update({
      status: "failed",
      failedAt: FieldValue.serverTimestamp(),
      failedAtIso: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
      "paytr.error": errMsg,
      "paytr.response": paytrJson,
    });

    throw new HttpsError("internal", errMsg, {
      refundId,
      orderId: lockResult.orderId,
      merchantOid: lockResult.merchantOid,
      paytr: paytrJson,
    });
  }
);
export const approveRefundRequestOnlyV1 = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req) => {
    const authUid = safeStr(req.auth?.uid);

    if (!authUid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    if (!getAdminStatus(req)) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const refundId = safeStr(req.data?.refundId);

    if (!refundId) {
      throw new HttpsError("invalid-argument", "refundId required.");
    }

    const db = admin.firestore();
    const refundRef = db.collection("refund_requests").doc(refundId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(refundRef);

      if (!snap.exists) {
        throw new HttpsError("not-found", "Refund request not found.");
      }

      const data = snap.data() as RefundRequestDoc;
      const currentStatus = safeStr(data.status || "pending");

      if (currentStatus !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `Sadece bekleyen iade talepleri onaylanabilir. Mevcut status: ${currentStatus}`
        );
      }

      const nowIso = new Date().toISOString();

      tx.update(refundRef, {
        status: "approved",
        approvedAt: FieldValue.serverTimestamp(),
        approvedAtIso: nowIso,
        approvedBy: authUid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      });
    });

    return {
      ok: true,
      refundId,
      status: "approved",
    };
  }
);