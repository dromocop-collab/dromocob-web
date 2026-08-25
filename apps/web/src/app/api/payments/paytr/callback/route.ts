import crypto from "crypto";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
} from "firebase-admin/firestore";
import { initAdmin } from "@/lib/firebase.admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Money = {
  amount: number;
  currency: "TRY";
};

type SelectedVariantItem = {
  groupId?: string;
  groupLabel?: string;
  value?: string;
  label?: string;
  priceDelta?: number;
  hasGram?: number;
  weightGram?: number;
  gram?: number;
};

type SessionItem = {
  productId?: string;
  slug?: string;
  qty?: number;
  variant?: Record<string, string>;
  selectedSize?: string;
    customText?: string;
  productCustomText?: string;
  engravingText?: string;
  selectedVariants?: Record<string, string>;
  selectedVariantItems?: SelectedVariantItem[];
};

type ResolvedItem = {
  productId?: string;
  slug?: string;
  title?: string;
  qty?: number;
    customText?: string;
  productCustomText?: string;
  engravingText?: string;
  unitPriceTry?: number;
  lineTotalTry?: number;
  image?: string;
  selectedSize?: string;
  selectedVariants?: Record<string, string> | null;
  selectedVariantItems?: SelectedVariantItem[];
};
type ProductTextRow = {
  productKey?: string;
  productId?: string;
  slug?: string;
  sku?: string;
  title?: any;
  serviceId?: string;
  serviceCode?: string;
  label?: string;
  text?: string;
};
type SelectedService = {
  id?: string;
  code?: string;
  title?: any;
  priceTry?: number;
  freeOverTry?: number;
  isGiftPackage?: boolean;
};

function reqEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} eksik`);
  return v;
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.floor(toNum(v, min));
  return Math.max(min, Math.min(max, n));
}

function money(amount: number): Money {
  return {
    amount: Number(Number(amount || 0).toFixed(2)),
    currency: "TRY",
  };
}

function deepClean<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj
      .map((x) => deepClean(x))
      .filter((x) => x !== undefined) as any;
  }

  if (typeof obj === "object") {
    const out: any = {};

    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue;
      out[k] = deepClean(v);
    }

    return out;
  }

  return obj;
}

function buildCallbackHash(params: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}) {
  const raw =
    params.merchantOid +
    params.merchantSalt +
    params.status +
    params.totalAmount;

  return crypto
    .createHmac("sha256", params.merchantKey)
    .update(raw)
    .digest("base64");
}

function pickTitle(product: any, resolvedTitle: string) {
  const tr =
    safeStr(product?.title?.tr) ||
    safeStr(product?.titleTR) ||
    safeStr(product?.name?.tr) ||
    safeStr(product?.nameTR) ||
    safeStr(product?.title) ||
    safeStr(product?.name) ||
    resolvedTitle ||
    "Ürün";

  const en =
    safeStr(product?.title?.en) ||
    safeStr(product?.titleEN) ||
    safeStr(product?.name?.en) ||
    safeStr(product?.nameEN) ||
    safeStr(product?.title) ||
    safeStr(product?.name) ||
    resolvedTitle ||
    "Product";

  return { tr, en };
}

function cleanVariant(v: any): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(v)) {
    const k = safeStr(key);
    const val = safeStr(value);
    if (!k || !val) continue;
    out[k] = val;
  }

  return Object.keys(out).length ? out : undefined;
}
function cleanSelectedVariants(v: any): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(v)) {
    const k = safeStr(key);
    const val = safeStr(value);
    if (!k || !val) continue;
    out[k] = val;
  }

  return Object.keys(out).length ? out : null;
}

function cleanSelectedVariantItems(v: any): SelectedVariantItem[] {
  if (!Array.isArray(v)) return [];

  return v
    .map((item) => {
      const gram = Math.max(
        0,
        toNum(item?.hasGram ?? item?.weightGram ?? item?.gram, 0)
      );

      return deepClean({
        groupId: safeStr(item?.groupId),
        groupLabel: safeStr(item?.groupLabel),
        value: safeStr(item?.value),
        label: safeStr(item?.label),
        priceDelta: toNum(item?.priceDelta, 0),
        ...(gram > 0
          ? {
              hasGram: gram,
              weightGram: gram,
              gram,
            }
          : {}),
      });
    })
    .filter((item) => item.groupId || item.groupLabel || item.value || item.label);
}

function pickText(v: any, locale: "tr" | "en" = "tr"): string {
  if (typeof v === "string") return safeStr(v);

  if (v && typeof v === "object") {
    return (
      safeStr(v[locale]) ||
      safeStr(v.tr) ||
      safeStr(v.en) ||
      ""
    );
  }

  return "";
}
function normalizeProductCustomText(v: any): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(v)) {
    const k = safeStr(key);
    const text = safeStr(value);

    if (!k || !text) continue;

    out[k] = text.slice(0, 240);
  }

  return out;
}

function normalizeProductTexts(v: any): ProductTextRow[] {
  if (!Array.isArray(v)) return [];

  const seen = new Set<string>();

  return v
    .map((x: any) =>
      deepClean({
        productKey: safeStr(x?.productKey),
        productId: safeStr(x?.productId),
        slug: safeStr(x?.slug),
        sku: safeStr(x?.sku),
        title: x?.title ?? null,
        serviceId: safeStr(x?.serviceId),
        serviceCode: safeStr(x?.serviceCode),
        label: safeStr(x?.label),
        text: safeStr(x?.text).slice(0, 240),
      })
    )
    .filter((x: any) => safeStr(x.text))
    .filter((x: any) => {
      const key = [
        x.serviceId,
        x.serviceCode,
        x.productKey,
        x.productId,
        x.slug,
        x.sku,
        x.text,
      ]
        .filter(Boolean)
        .join("_");

      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    });
}

function pickItemCustomText(original: any, resolved: any): string {
  return (
    safeStr(original?.customText) ||
    safeStr(original?.productCustomText) ||
    safeStr(original?.engravingText) ||
    safeStr(resolved?.customText) ||
    safeStr(resolved?.productCustomText) ||
    safeStr(resolved?.engravingText)
  ).slice(0, 240);
}
function normalizeSelectedServices(v: any): SelectedService[] {
  if (!Array.isArray(v)) return [];

  return v
    .map((service) => {
      const code = safeStr(service?.code);
      const titleTr = pickText(service?.title, "tr");
      const titleEn = pickText(service?.title, "en");

      const hay = `${code} ${titleTr} ${titleEn}`.toLocaleLowerCase("tr-TR");

      return {
        id: safeStr(service?.id),
        code,
        title: service?.title ?? null,
        priceTry: Math.max(0, toNum(service?.priceTry, 0)),
        freeOverTry: Math.max(0, toNum(service?.freeOverTry, 0)),
        isGiftPackage:
          service?.isGiftPackage === true ||
          hay.includes("hediye") ||
          hay.includes("gift"),
      };
    })
    .filter((service) => service.id || service.code || service.title);
}

function resolveGiftPackageFromSession(session: Record<string, any>) {
  const packaging =
    session?.packaging && typeof session.packaging === "object"
      ? session.packaging
      : null;

  const clientQuote =
    session?.clientQuote && typeof session.clientQuote === "object"
      ? session.clientQuote
      : null;

  const selectedServices = normalizeSelectedServices(
    session?.selectedServices ||
      clientQuote?.selectedServices ||
      []
  );

  const serviceGift = selectedServices.some((service) => service.isGiftPackage);

  const explicitGift =
    session?.giftPackage === true ||
    session?.giftWrap === true ||
    packaging?.giftPackage === true ||
    packaging?.giftWrap === true ||
    packaging?.gift === true;

  const giftPackage = explicitGift || serviceGift;

  const giftService =
    selectedServices.find((service) => service.isGiftPackage) || null;

  const note =
    safeStr(session?.giftNote) ||
    safeStr(session?.giftMessage) ||
    safeStr(session?.giftPackageNote) ||
    safeStr(packaging?.note) ||
    safeStr(packaging?.message) ||
    safeStr(clientQuote?.giftNote) ||
    safeStr(clientQuote?.giftMessage) ||
    safeStr(clientQuote?.giftPackageNote);

  const finalPackaging = deepClean({
    ...(packaging || {}),
    giftPackage,
    giftWrap: giftPackage,
    gift: giftPackage,
    serviceId: safeStr(packaging?.serviceId) || safeStr(giftService?.id),
    code: safeStr(packaging?.code) || safeStr(giftService?.code),
    title: packaging?.title ?? giftService?.title ?? null,
    priceTry:
      toNum(packaging?.priceTry, -1) >= 0
        ? Math.max(0, toNum(packaging?.priceTry, 0))
        : Math.max(0, toNum(giftService?.priceTry, 0)),
    note,
    message: note,
  });

  return {
    giftPackage,
    giftWrap: giftPackage,
    packaging: finalPackaging,
    selectedServices,
    giftNote: note,
    giftMessage: note,
    giftPackageNote: note,
  };
}
function buildCallbackData(formValues: {
  status: string;
  totalAmount: string;
  paymentType: string;
  testMode: string;
  paymentAmount: string;
  currency: string;
  failedReasonMsg: string;
}) {
  return {
    status: formValues.status,
    totalAmount: formValues.totalAmount,
    paymentType: formValues.paymentType,
    testMode: formValues.testMode,
    paymentAmount: formValues.paymentAmount,
    currency: formValues.currency,
    failedReasonMsg: formValues.failedReasonMsg,
  };
}

async function createPaidOrderFromSessionTx(params: {
  merchantOid: string;
  callbackData: Record<string, unknown>;
}) {
  const db = getFirestore();

  const sessionRef = db.collection("payment_sessions").doc(params.merchantOid);

  return db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);

    if (!sessionSnap.exists) {
      return {
        ok: false,
        reason: "session_not_found",
        orderId: "",
      };
    }

    const session = sessionSnap.data() as Record<string, any>;

    const existingOrderId = safeStr(session.orderId);
    const orderCreated = session.orderCreated === true;

    if (orderCreated && existingOrderId) {
      tx.set(
        sessionRef,
        {
          paymentStatus: "paid",
          status: "paid",
          paidAt: FieldValue.serverTimestamp(),
          paidAtIso: safeStr(session.paidAtIso) || new Date().toISOString(),
          callbackData: params.callbackData,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),
        },
        { merge: true }
      );

      return {
        ok: true,
        alreadyCreated: true,
        orderId: existingOrderId,
      };
    }

    const uid = safeStr(session.uid);
    const email = safeStr(session.email);
    const locale = session.locale === "en" ? "en" : "tr";

    if (!uid) {
      throw new Error("payment session uid eksik");
    }

    const rawItems: SessionItem[] = Array.isArray(session.items)
      ? session.items
      : [];

    const resolvedItems: ResolvedItem[] = Array.isArray(session.resolvedItems)
      ? session.resolvedItems
      : [];

    if (!resolvedItems.length) {
      throw new Error("payment session resolvedItems boş");
    }

    const productRefs = resolvedItems.map((item) => {
      const productId = safeStr(item.productId);

      if (!productId) {
        throw new Error("resolved item productId eksik");
      }

      return db.collection("products").doc(productId);
    });

    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    const orderItems: any[] = [];
   const stockPlan: Array<{
  ref: DocumentReference;
  nextStock: number;
}> = [];

    for (let i = 0; i < resolvedItems.length; i++) {
      const resolved = resolvedItems[i];
      const original = rawItems.find(
        (x) => safeStr(x.productId) === safeStr(resolved.productId)
      );

      const productSnap = productSnaps[i];

      if (!productSnap.exists) {
        throw new Error(`Ürün bulunamadı: ${safeStr(resolved.productId)}`);
      }

      const product = productSnap.data() as any;

      const qty = clampInt(resolved.qty ?? original?.qty, 1, 99);
      const currentStock = Math.max(0, Math.floor(toNum(product?.stock, 0)));

      if (currentStock < qty) {
        throw new Error(
          `Stok yetersiz: ${productSnap.id} stock=${currentStock} need=${qty}`
        );
      }

      stockPlan.push({
        ref: productRefs[i],
        nextStock: currentStock - qty,
      });

      const unitPriceTry = Math.max(0, toNum(resolved.unitPriceTry, 0));
      const lineTotalTry =
        Math.max(0, toNum(resolved.lineTotalTry, 0)) ||
        Number((unitPriceTry * qty).toFixed(2));

 const image =
  safeStr(resolved?.image) ||
  safeStr(product?.image) ||
  safeStr(product?.mainImage) ||
  (Array.isArray(product?.images) ? safeStr(product.images[0]) : "");

const sku = safeStr(product?.sku);
const slug = safeStr(product?.slug) || safeStr(resolved.slug);

const variant = cleanVariant(original?.variant);

const selectedSize =
  safeStr(original?.selectedSize) ||
  safeStr(resolved?.selectedSize);

const selectedVariants =
  cleanSelectedVariants(original?.selectedVariants) ||
  cleanSelectedVariants(resolved?.selectedVariants);

const selectedVariantItems =
  cleanSelectedVariantItems(original?.selectedVariantItems).length
    ? cleanSelectedVariantItems(original?.selectedVariantItems)
    : cleanSelectedVariantItems(resolved?.selectedVariantItems);

    const customText = pickItemCustomText(original, resolved);
orderItems.push(
  deepClean({
    productId: productSnap.id,
    title: pickTitle(product, safeStr(resolved.title)),
    qty,
    unitPrice: money(unitPriceTry),
    lineTotal: money(lineTotalTry),

    ...(sku ? { sku } : {}),
    ...(image ? { image } : {}),
    ...(slug ? { slug } : {}),
    ...(variant ? { variant } : {}),
    ...(selectedSize ? { selectedSize } : {}),
    ...(selectedVariants ? { selectedVariants } : {}),
    ...(selectedVariantItems.length ? { selectedVariantItems } : {}),

    ...(customText
      ? {
          customText,
          productCustomText: customText,
          engravingText: customText,
        }
      : {}),
  })
);
    }

    const subtotalTry = orderItems.reduce(
  (sum, item) => sum + toNum(item?.lineTotal?.amount, 0),
  0
);

const clientQuote =
  session?.clientQuote && typeof session.clientQuote === "object"
    ? session.clientQuote
    : null;
const productTexts = normalizeProductTexts([

  ...(Array.isArray(session?.productTexts) ? session.productTexts : []),

  ...(Array.isArray(clientQuote?.productTexts) ? clientQuote.productTexts : []),

]);

const productCustomText = normalizeProductCustomText({

  ...(clientQuote?.productCustomText || {}),

  ...(session?.productCustomText || {}),

});
const serviceTotalTry = Math.max(0, toNum(clientQuote?.serviceTotalTry, 0));
const discountTry = Math.max(0, toNum(clientQuote?.discountTry, 0));
const shippingFeeTry = Math.max(0, toNum(clientQuote?.shippingFeeTry, 0));
const quotedTotalTry = Math.max(0, toNum(clientQuote?.totalTry, 0));
const sessionAmountTry = Math.max(0, toNum(session.amountTry, 0));

const totalTry =
  sessionAmountTry > 0
    ? sessionAmountTry
    : quotedTotalTry > 0
      ? quotedTotalTry
      : Math.max(0, subtotalTry + shippingFeeTry + serviceTotalTry - discountTry);

const shippingAddress = session.shippingAddress || {};
const customerProfile = session.customerProfile || {};

    const invoiceType =
      safeStr(shippingAddress.invoiceType) === "company"
        ? "company"
        : "individual";

   const nowIso = new Date().toISOString();
const orderRef = db.collection("orders").doc();

const giftInfo = resolveGiftPackageFromSession(session);


const orderPayload = deepClean({
      uid,
      email,
      status: "paid",
      paymentStatus: "paid",

     items: orderItems,
subtotal: money(subtotalTry),
shippingFee: money(shippingFeeTry),
discount: money(discountTry),
serviceTotal: money(serviceTotalTry),
total: money(totalTry),

clientQuote,
selectedServices: giftInfo.selectedServices,
packaging: giftInfo.packaging,
giftPackage: giftInfo.giftPackage,
giftWrap: giftInfo.giftWrap,
giftNote: giftInfo.giftNote,
giftMessage: giftInfo.giftMessage,
giftPackageNote: giftInfo.giftPackageNote,
productTexts,
productCustomText,
 
      shippingAddress: {
        fullName: safeStr(shippingAddress.fullName),
        phone: safeStr(shippingAddress.phone),
        city: safeStr(shippingAddress.city),
        district: safeStr(shippingAddress.district),
        addressLine: safeStr(shippingAddress.addressLine),
        postalCode: safeStr(shippingAddress.postalCode),
        note: safeStr(shippingAddress.note),

        invoiceType,

        firstName: safeStr(shippingAddress.firstName),
        lastName: safeStr(shippingAddress.lastName),

        nationalId: safeStr(shippingAddress.nationalId),

        companyName: safeStr(shippingAddress.companyName),
        taxNumber: safeStr(shippingAddress.taxNumber),
        taxOffice: safeStr(shippingAddress.taxOffice),
      },

      billing: {
        invoiceType,
        firstName: safeStr(shippingAddress.firstName),
        lastName: safeStr(shippingAddress.lastName),
        phone: safeStr(shippingAddress.phone),
        nationalId: safeStr(shippingAddress.nationalId),
        companyName: safeStr(shippingAddress.companyName),
        taxNumber: safeStr(shippingAddress.taxNumber),
        taxOffice: safeStr(shippingAddress.taxOffice),
      },

      customer: {
        firstName: safeStr(customerProfile.firstName),
        lastName: safeStr(customerProfile.lastName),
        phone: safeStr(customerProfile.phone) || safeStr(shippingAddress.phone),
        email: safeStr(customerProfile.email) || email,
        nationalId:
          safeStr(customerProfile.tcNo) || safeStr(shippingAddress.nationalId),
        birthDate: safeStr(customerProfile.birthDate),
      },

      payment: {
        provider: "paytr",
        method: "card",
        ref: params.merchantOid,
        paidAt: FieldValue.serverTimestamp(),
      },

      meta: {
        locale,
        userAgent: safeStr(session?.meta?.userAgent),
        ip: safeStr(session?.meta?.customerIp),
        paymentSessionId: params.merchantOid,
      },

      stockApplied: true,
      stockAppliedAt: FieldValue.serverTimestamp(),
      stockRestored: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      paidAtIso: nowIso,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    });

    for (const plan of stockPlan) {
      tx.update(plan.ref, {
        stock: plan.nextStock,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(orderRef, orderPayload as any);

    tx.set(
      sessionRef,
      {
        paymentStatus: "paid",
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        paidAtIso: nowIso,
        callbackData: params.callbackData,
productTexts,
    productCustomText,
        orderCreated: true,
        orderId: orderRef.id,

        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
      },
      { merge: true }
    );

    return {
      ok: true,
      alreadyCreated: false,
      orderId: orderRef.id,
    };
  });
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const db = getFirestore();

    const merchantKey = reqEnv("PAYTR_MERCHANT_KEY");
    const merchantSalt = reqEnv("PAYTR_MERCHANT_SALT");

    const form = await req.formData();

    const merchantOid = safeStr(form.get("merchant_oid"));
    const status = safeStr(form.get("status"));
    const totalAmount = safeStr(form.get("total_amount"));
    const receivedHash = safeStr(form.get("hash"));
    const failedReasonMsg = safeStr(form.get("failed_reason_msg"));
    const paymentType = safeStr(form.get("payment_type"));
    const testMode = safeStr(form.get("test_mode"));
    const paymentAmount = safeStr(form.get("payment_amount"));
    const currency = safeStr(form.get("currency"));

    if (!merchantOid || !status || !totalAmount || !receivedHash) {
      return new Response("bad request", { status: 400 });
    }

    const expectedHash = buildCallbackHash({
      merchantOid,
      merchantSalt,
      status,
      totalAmount,
      merchantKey,
    });

    if (expectedHash !== receivedHash) {
      console.error("[paytr/callback] bad hash", {
        merchantOid,
        status,
        totalAmount,
      });

      return new Response("bad hash", { status: 400 });
    }

    const callbackData = buildCallbackData({
      status,
      totalAmount,
      paymentType,
      testMode,
      paymentAmount,
      currency,
      failedReasonMsg,
    });

    const sessionRef = db.collection("payment_sessions").doc(merchantOid);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      console.error("[paytr/callback] session not found", { merchantOid });
      return new Response("OK", { status: 200 });
    }

    const session = sessionSnap.data() as Record<string, unknown>;
    const currentPaymentStatus = safeStr(session.paymentStatus);
    const existingOrderId = safeStr((session as any).orderId);

    if (currentPaymentStatus === "paid" && existingOrderId) {
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (status === "success") {
      const result = await createPaidOrderFromSessionTx({
        merchantOid,
        callbackData,
      });

      // Kupon kullanıldıysa "used" olarak işaretle
      if (result.ok && !result.alreadyCreated) {
        try {
          const coupon = (session as any)?.customerProfile?.coupon;
          const couponCode = safeStr(coupon?.code);
          const sessionUid = safeStr((session as any)?.uid);

          if (couponCode && coupon?.singleUse !== false) {
            // wheel_leads'te couponStatus → used
            const wheelSnap = await db
              .collection("wheel_leads")
              .where("couponCode", "==", couponCode)
              .where("couponStatus", "==", "active")
              .limit(1)
              .get();

            if (!wheelSnap.empty) {
              await wheelSnap.docs[0].ref.update({
                couponStatus: "used",
                usedAt: FieldValue.serverTimestamp(),
                usedOrderId: result.orderId || "",
              });
            }

            // Üye kuponlarında status → used
            if (sessionUid) {
              const couponRef = db
                .collection("users")
                .doc(sessionUid)
                .collection("wheel_coupons")
                .doc(couponCode);

              const couponSnap = await couponRef.get();
              if (couponSnap.exists) {
                await couponRef.update({
                  status: "used",
                  usedAt: FieldValue.serverTimestamp(),
                  usedOrderId: result.orderId || "",
                });
              }
            }
          }
        } catch (couponErr) {
          console.error("[paytr/callback] coupon mark-used error:", couponErr);
          // Kupon işaretleme hatası sipariş oluşturmayı engellememeli
        }
      }
    } else {
      await sessionRef.set(
        {
          paymentStatus: "failed",
          status: "failed",
          failedAt: FieldValue.serverTimestamp(),
          failedAtIso: new Date().toISOString(),
          callbackData,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    console.error("[paytr/callback] failed:", e);

    return new Response("error", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
