import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

type Tone = "ok" | "warn" | "error";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tsMillis(v: any): number {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return Number(v.toMillis());
    if (typeof v?.seconds === "number") return Number(v.seconds) * 1000;
    if (typeof v === "number") return v;

    const parsed = Date.parse(String(v));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function moneyAmount(v: any): number {
  if (v && typeof v === "object") {
    return num(v.amount, 0);
  }

  return num(v, 0);
}

function pickLocaleText(v: any): string {
  if (typeof v === "string") return safeStr(v);
  return safeStr(v?.tr || v?.en || "");
}

function productPrice(p: any): number {
  return num(p?.finalPrice ?? p?.computedPrice ?? p?.priceTry ?? p?.price ?? 0, 0);
}

function hasProductImage(p: any): boolean {
  if (Array.isArray(p?.images) && p.images.some((x: unknown) => safeStr(x))) {
    return true;
  }

  return Boolean(safeStr(p?.image));
}

function hasProductCategory(p: any): boolean {
  return Array.isArray(p?.categoryIds) && p.categoryIds.length > 0;
}

function hasProductDescription(p: any): boolean {
  return Boolean(
    pickLocaleText(p?.description) ||
      pickLocaleText(p?.shortDescription) ||
      pickLocaleText(p?.seoDescription)
  );
}

function getRatesStatus(ratesData: any): {
  status: Tone;
  ageMin: number;
  fetchedAt: any;
  provider: string;
  count: number;
} {
  const fetchedAt = ratesData?.fetchedAt ?? null;
  const fetchedMs = tsMillis(fetchedAt);
  const ageMin = fetchedMs ? Math.floor((Date.now() - fetchedMs) / 60000) : 999999;
  const count = num(ratesData?.count, 0);
  const provider = safeStr(ratesData?.provider);

  let status: Tone = "error";

  if (fetchedMs && count > 0) {
    const ageHours = ageMin / 60;

    if (ageHours <= 24) status = "ok";
    else if (ageHours <= 48) status = "warn";
    else status = "error";
  }

  return {
    status,
    ageMin,
    fetchedAt,
    provider,
    count,
  };
}

function orderIssues(order: any): string[] {
  const issues: string[] = [];

  const status = safeStr(order?.status).toLowerCase();
  const paymentStatus = safeStr(order?.paymentStatus).toLowerCase();
  const provider = safeStr(order?.payment?.provider).toLowerCase();
  const method = safeStr(order?.payment?.method).toLowerCase();
  const shippingStatus = safeStr(order?.shippingStatus).toLowerCase();

  const total = moneyAmount(order?.total);

  if (!status) issues.push("order_status_empty");
  if (!Array.isArray(order?.items) || order.items.length === 0) {
    issues.push("order_items_empty");
  }

  if (total <= 0) issues.push("order_total_zero");

  if (
    provider === "paytr" &&
    method === "card" &&
    paymentStatus !== "paid" &&
    status !== "cancelled"
  ) {
    issues.push("paytr_payment_not_paid");
  }

  if (["paid", "preparing", "shipped", "delivered"].includes(status) && !provider) {
    issues.push("payment_provider_empty");
  }

  if (status === "shipped" && !safeStr(order?.trackingNumber)) {
    issues.push("shipped_without_tracking_number");
  }

  if (shippingStatus === "barcode_error") {
    issues.push("shipping_barcode_error");
  }

  if (safeStr(order?.shippingBarcodeError)) {
    issues.push("shipping_barcode_error_text");
  }

  if (order?.shippingCancelled === true && status === "shipped") {
    issues.push("shipment_cancelled_but_order_shipped");
  }

  if (safeStr(order?.refundStatus).toLowerCase() === "full_refunded" && status !== "refunded") {
    issues.push("full_refunded_but_order_not_refunded");
  }

  return issues;
}

function shippingIssues(order: any): string[] {
  const issues: string[] = [];

  const status = safeStr(order?.status).toLowerCase();
  const shippingStatus = safeStr(order?.shippingStatus).toLowerCase();

  if (["paid", "preparing"].includes(status) && !shippingStatus) {
    issues.push("shipment_not_created");
  }

  if (shippingStatus === "created" && !safeStr(order?.trackingNumber)) {
    issues.push("shipment_created_without_tracking_number");
  }

  if (shippingStatus === "barcode_error") {
    issues.push("shipment_barcode_error");
  }

  if (shippingStatus === "cancelled" && order?.shippingCancelled !== true) {
    issues.push("shipment_cancelled_without_flag");
  }

  if (safeStr(order?.shipmentId) && !safeStr(order?.shippingReferenceId)) {
    issues.push("shipment_without_reference_id");
  }

  return issues;
}

function refundIssues(refund: any): string[] {
  const issues: string[] = [];

  const status = safeStr(refund?.status).toLowerCase();
  const returnShipping = refund?.returnShipping || {};
  const returnShipment = refund?.returnShipment || {};
  const shipmentStatus = safeStr(returnShipment?.status || returnShipping?.status).toLowerCase();

  if (!safeStr(refund?.orderDocId || refund?.orderId)) issues.push("refund_order_id_empty");
  if (!safeStr(refund?.uid)) issues.push("refund_uid_empty");
  if (moneyAmount(refund?.amountTry) <= 0) issues.push("refund_amount_zero");

  if (status === "approved" && !shipmentStatus) {
    issues.push("refund_approved_without_return_shipment_status");
  }

  if (status === "return_label_created") {
    const returnCode = safeStr(
      returnShipping?.returnCode ||
        returnShipping?.code ||
        returnShipping?.trackingNumber ||
        returnShipping?.trackingNo ||
        returnShipment?.returnCode ||
        returnShipment?.code ||
        returnShipment?.trackingNumber ||
        returnShipment?.trackingNo
    );

    if (!returnCode) issues.push("return_label_created_but_code_empty");
    if (!safeStr(returnShipping?.shipmentId || returnShipment?.shipmentId)) {
      issues.push("return_label_created_but_shipment_id_empty");
    }
    if (!safeStr(returnShipping?.referenceId || returnShipment?.referenceId)) {
      issues.push("return_label_created_but_reference_id_empty");
    }
  }

  if (["return_label_error", "return_label_failed"].includes(status)) {
    issues.push("return_label_create_failed");
  }

  if (status === "return_label_cancelled" && shipmentStatus !== "cancelled") {
    issues.push("return_label_cancelled_but_shipment_not_cancelled");
  }

  if (safeStr(refund?.paytr?.error)) {
    issues.push("paytr_refund_error");
  }

  if (status === "refunded" && !safeStr(refund?.paytr?.referenceNo)) {
    issues.push("refunded_without_paytr_reference");
  }

  return issues;
}

async function countQuerySafe(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
): Promise<number> {
  try {
    const snap = await query.count().get();
    return snap.data().count || 0;
  } catch {
    const snap = await query.get();
    return snap.size;
  }
}

async function maybeWriteDigestLog(params: {
  db: FirebaseFirestore.Firestore;
  nowIso: string;
  criticalScore: number;
  counters: Record<string, any>;
}) {
  const { db, nowIso, criticalScore, counters } = params;

  // Sadece gerçekten güçlü bozulmada log aç.
  if (criticalScore < 30) return;

  // Günlük tek digest: 5 dakikada bir yeni kart basmaz, aynı logu günceller.
  const bucket = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const digestId = `SYSTEM_HEALTH_${bucket}`;

  const ref = db.collection("system_logs").doc(digestId);
  const snap = await ref.get();

  const payload = {
    level: criticalScore >= 60 ? "critical" : "warn",
    status: "open",
    source: "system_health",
    code: "SYSTEM_HEALTH_DEGRADED",
    message: `Sistem sağlık skoru yüksek: ${criticalScore}`,
    details: {
      criticalScore,
      counters,
      updatedByScheduler: true,
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtIso: nowIso,
  };

  if (snap.exists) {
    await ref.set(payload, { merge: true });
    return;
  }

  await ref.set({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: nowIso,
  });
}

export const updateSystemHealth = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Europe/Istanbul",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 120,
    retryCount: 0,
  },
  async () => {
    const db = admin.firestore();
    const nowIso = new Date().toISOString();

    const [
      ratesSnap,
      productsSnap,
      ordersSnap,
      refundsSnap,
      supportOpenCount,
      supportUnreadSnap,
      logsOpenSnap,
    ] = await Promise.all([
      db.collection("rates").doc("latest").get(),

      db.collection("products").limit(900).get(),

      db.collection("orders").orderBy("createdAt", "desc").limit(500).get(),

      db.collection("refund_requests").orderBy("createdAt", "desc").limit(300).get(),

      countQuerySafe(
        db.collection("support_threads").where("status", "!=", "closed")
      ).catch(() => 0),

      db.collection("support_threads").orderBy("lastMessageAt", "desc").limit(100).get(),

      db.collection("system_logs").orderBy("createdAt", "desc").limit(120).get(),
    ]);

    const ratesData = ratesSnap.exists ? (ratesSnap.data() as any) : null;
    const ratesHealth = getRatesStatus(ratesData);

    const products = productsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const orders = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const refunds = refundsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const logs = logsOpenSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const activeProducts = products.filter((p) => p.isActive !== false);

    const zeroPriceProducts = activeProducts.filter((p) => productPrice(p) <= 0);
    const imageMissingProducts = activeProducts.filter((p) => !hasProductImage(p));
    const categoryMissingProducts = activeProducts.filter((p) => !hasProductCategory(p));
    const descriptionMissingProducts = activeProducts.filter((p) => !hasProductDescription(p));

    const lowStockProducts = activeProducts.filter((p) => {
      const stock = num(p?.stock, 0);
      const stockAlarm = num(p?.stockAlarm, 0);

      if (stockAlarm > 0) return stock <= stockAlarm;
      return stock > 0 && stock <= 3;
    });

    const orderProblemRows = orders
      .map((order) => ({
        id: order.id,
        issues: orderIssues(order),
      }))
      .filter((x) => x.issues.length > 0);

    const shippingProblemRows = orders
      .map((order) => ({
        id: order.id,
        issues: shippingIssues(order),
      }))
      .filter((x) => x.issues.length > 0);

    const refundProblemRows = refunds
      .map((refund) => ({
        id: refund.id,
        issues: refundIssues(refund),
      }))
      .filter((x) => x.issues.length > 0);

const openLogs = logs.filter((log) => {

  const status = safeStr(log?.status || "open").toLowerCase();

  const level = safeStr(log?.level).toLowerCase();

  const source = safeStr(log?.source).toLowerCase();

  const code = safeStr(log?.code).toUpperCase();

  const isSystemHealthSelfLog =

    source === "system_health" || code === "SYSTEM_HEALTH_DEGRADED";

  return (

    status !== "resolved" &&

    !isSystemHealthSelfLog &&

    ["warn", "error", "critical"].includes(level)

  );

});

    const criticalErrors = openLogs.filter(
      (log) => safeStr(log?.level).toLowerCase() === "critical"
    );

    const errorLogs = openLogs.filter(
      (log) => safeStr(log?.level).toLowerCase() === "error"
    );

    const unreadSupport = supportUnreadSnap.docs.reduce((acc, d) => {
      return acc + num((d.data() as any)?.unreadByAdmin, 0);
    }, 0);

    const criticalScore =
      criticalErrors.length * 10 +
      errorLogs.length * 5 +
      orderProblemRows.length * 3 +
      refundProblemRows.length * 3 +
      shippingProblemRows.length * 2 +
      zeroPriceProducts.length * 2 +
      lowStockProducts.length +
      imageMissingProducts.length +
      categoryMissingProducts.length +
      descriptionMissingProducts.length +
      (ratesHealth.status === "error" ? 10 : ratesHealth.status === "warn" ? 4 : 0) +
      unreadSupport;

    const overallStatus: Tone =
      criticalScore >= 30 ? "error" : criticalScore >= 12 ? "warn" : "ok";

    const counters = {
      activeProducts: activeProducts.length,
      zeroPriceProducts: zeroPriceProducts.length,
      imageMissingProducts: imageMissingProducts.length,
      categoryMissingProducts: categoryMissingProducts.length,
      descriptionMissingProducts: descriptionMissingProducts.length,
      lowStockProducts: lowStockProducts.length,

      recentOrdersScanned: orders.length,
      orderProblems: orderProblemRows.length,
      shippingProblems: shippingProblemRows.length,

      recentRefundsScanned: refunds.length,
      refundProblems: refundProblemRows.length,

      openSupportThreads: supportOpenCount,
      unreadSupportMessages: unreadSupport,

      openLogs: openLogs.length,
      criticalErrors: criticalErrors.length,
      errorLogs: errorLogs.length,

      criticalScore,
    };

    const samples = {
      orderProblems: orderProblemRows.slice(0, 10),
      shippingProblems: shippingProblemRows.slice(0, 10),
      refundProblems: refundProblemRows.slice(0, 10),
      zeroPriceProducts: zeroPriceProducts.slice(0, 10).map((p) => ({
        id: p.id,
        sku: p.sku || "",
        title: pickLocaleText(p.title) || p.slug || p.id,
      })),
      lowStockProducts: lowStockProducts.slice(0, 10).map((p) => ({
        id: p.id,
        sku: p.sku || "",
        stock: num(p.stock, 0),
        stockAlarm: num(p.stockAlarm, 0),
      })),
    };

    await db.collection("system_health").doc("current").set(
      {
        overall: {
          status: overallStatus,
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          criticalScore,
        },

        web: {
          status: "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
        },

        firestore: {
          status: "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
        },

        storage: {
          status: "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
        },

        functions: {
          status: "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
        },

        support: {
          status: supportOpenCount > 20 || unreadSupport > 10 ? "warn" : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          openSupportThreads: supportOpenCount,
          unreadSupportMessages: unreadSupport,
        },

        rates: {
          status: ratesHealth.status,
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          fetchedAt: ratesHealth.fetchedAt,
          ageMin: ratesHealth.ageMin,
          provider: ratesHealth.provider,
          count: ratesHealth.count,
        },

        products: {
          status:
            zeroPriceProducts.length > 0 || imageMissingProducts.length > 20
              ? "warn"
              : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          activeProducts: activeProducts.length,
          zeroPriceProducts: zeroPriceProducts.length,
          imageMissingProducts: imageMissingProducts.length,
          categoryMissingProducts: categoryMissingProducts.length,
          descriptionMissingProducts: descriptionMissingProducts.length,
          lowStockProducts: lowStockProducts.length,
        },

        orders: {
          status: orderProblemRows.length > 0 ? "warn" : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          scanned: orders.length,
          problems: orderProblemRows.length,
        },

        shipping: {
          status: shippingProblemRows.length > 0 ? "warn" : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          scanned: orders.length,
          problems: shippingProblemRows.length,
        },

        refunds: {
          status: refundProblemRows.length > 0 ? "warn" : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          scanned: refunds.length,
          problems: refundProblemRows.length,
        },

        logs: {
          status:
            criticalErrors.length > 0
              ? "error"
              : errorLogs.length > 0
              ? "warn"
              : "ok",
          checkedAt: FieldValue.serverTimestamp(),
          checkedAtIso: nowIso,
          openLogs: openLogs.length,
          criticalErrors: criticalErrors.length,
          errorLogs: errorLogs.length,
        },

        counters,
        samples,

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      },
      { merge: true }
    );

    await maybeWriteDigestLog({
      db,
      nowIso,
      criticalScore,
      counters,
    });

    console.log("[updateSystemHealth] system_health/current updated", {
      overallStatus,
      criticalScore,
      ratesStatus: ratesHealth.status,
      ratesAgeMin: ratesHealth.ageMin,
      openSupportThreads: supportOpenCount,
      unreadSupport,
      productProblems:
        zeroPriceProducts.length +
        imageMissingProducts.length +
        categoryMissingProducts.length +
        descriptionMissingProducts.length +
        lowStockProducts.length,
      orderProblems: orderProblemRows.length,
      shippingProblems: shippingProblemRows.length,
      refundProblems: refundProblemRows.length,
      openLogs: openLogs.length,
    });
  }
);