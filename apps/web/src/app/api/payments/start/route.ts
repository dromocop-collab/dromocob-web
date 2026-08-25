import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "@/lib/firebase.admin";
import { getPaymentBaseUrl, getPaymentProvider } from "@/lib/payments/config";
import { startPayment } from "@/lib/payments/start-payment";

type PaymentItem = {
  productId: string;
  slug?: string;
  qty: number;
  variant?: Record<string, string>;
  customText?: string;
  productCustomText?: string;
  engravingText?: string;
  selectedSize?: string;
  selectedVariants?: Record<string, string>;
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

  selectedVariantGram?: number;
  weightGram?: number;
  hasGram?: number;
};

type CustomerProfile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  tcNo?: string;
  birthDate?: string;
  coupon?: {
    code?: string;
    label?: string;
    discountType?: "percent" | "fixed" | string;
    discountValue?: number;
  } | null;
};

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

type ClientQuoteItem = {
  productId?: string;
  slug?: string;
  qty?: number;
  customText?: string;
  productCustomText?: string;
  engravingText?: string;
  unitPriceTry?: number;
  resolvedUnitPrice?: number;
  priceTry?: number;
  lineTry?: number;
  lineTotalTry?: number;

  title?: any;
  image?: string;

  selectedSize?: string;
  selectedVariants?: Record<string, string> | null;
  selectedVariantItems?: SelectedVariantItem[];

  selectedVariantGram?: number;
  weightGram?: number;
  hasGram?: number;
};

type SelectedService = {
  id?: string;
  code?: string;
  title?: any;
  priceTry?: number;
  freeOverTry?: number;
  isGiftPackage?: boolean;
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
type ClientQuote = {
  totalTry?: number;
  subtotalTry?: number;
  discountTry?: number;
  shippingFeeTry?: number;
  serviceTotalTry?: number;

  productCustomText?: Record<string, string>;
  productTexts?: ProductTextRow[];

  selectedServices?: SelectedService[];
  items?: ClientQuoteItem[];
};

type PackagingInfo = {
  giftPackage?: boolean;
  giftWrap?: boolean;
  gift?: boolean;
  serviceId?: string;
  code?: string;
  title?: any;
  priceTry?: number;
  note?: string;
  message?: string;
} | null;

type Body = {
  locale?: "tr" | "en";
  customerProfile?: CustomerProfile;
  shippingAddress?: ShippingAddress;
  items?: PaymentItem[];
  userAgent?: string;

  clientQuote?: ClientQuote | null;
  packaging?: PackagingInfo;

  productCustomText?: Record<string, string>;
  productTexts?: ProductTextRow[];
};

type ResolvedCartItem = {
  productId: string;
  slug: string;
  title: string;
  qty: number;
    customText?: string;
  productCustomText?: string;
  engravingText?: string;
  unitPriceTry: number;
  lineTotalTry: number;
  image: string;

  selectedSize: string;
  selectedVariants: Record<string, string> | null;
  selectedVariantItems: SelectedVariantItem[];

  selectedVariantGram?: number;
  weightGram?: number;
  hasGram?: number;

  variant?: Record<string, string>;
};

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

function normalizeLocale(v: unknown): "tr" | "en" {
  return v === "en" ? "en" : "tr";
}

function cleanObject<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      out[key] = value
        .map((x) =>
          x && typeof x === "object" && !Array.isArray(x)
            ? cleanObject(x as Record<string, any>)
            : x
        )
        .filter((x) => x !== undefined);
      continue;
    }

    if (value && typeof value === "object") {
      out[key] = cleanObject(value as Record<string, any>);
      continue;
    }

    out[key] = value;
  }

  return out as T;
}

function cleanStringMap(v: any): Record<string, string> | null {
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

function cleanSelectedVariantItems(raw: any): SelectedVariantItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const groupId = safeStr(item?.groupId);
      const groupLabel = safeStr(item?.groupLabel);
      const value = safeStr(item?.value);
      const label = safeStr(item?.label);

      const gram = Math.max(
        0,
        toNum(item?.hasGram ?? item?.weightGram ?? item?.gram, 0)
      );

      return cleanObject({
        groupId,
        groupLabel,
        value,
        label,
        priceDelta: Math.max(0, toNum(item?.priceDelta, 0)),
        ...(gram > 0
          ? {
              hasGram: gram,
              weightGram: gram,
              gram,
            }
          : {}),
      });
    })
    .filter(
      (item) =>
        safeStr(item.groupId) ||
        safeStr(item.groupLabel) ||
        safeStr(item.value) ||
        safeStr(item.label)
    );
}

function getVariantGramFromItems(items: SelectedVariantItem[]): number {
  const found = items.find((item) => {
    const gram = toNum(item?.hasGram ?? item?.weightGram ?? item?.gram, 0);
    return gram > 0;
  });

  return Math.max(
    0,
    toNum(found?.hasGram ?? found?.weightGram ?? found?.gram, 0)
  );
}

function pickCustomerName(
  profile?: CustomerProfile,
  shipping?: ShippingAddress
): string {
  const byProfile =
    `${safeStr(profile?.firstName)} ${safeStr(profile?.lastName)}`.trim();

  if (byProfile) return byProfile;

  const byShipping = safeStr(shipping?.fullName);
  if (byShipping) return byShipping;

  return "Müşteri";
}

function pickCustomerPhone(
  profile?: CustomerProfile,
  shipping?: ShippingAddress
): string {
  return safeStr(profile?.phone) || safeStr(shipping?.phone) || "";
}

function pickCustomerEmail(
  decodedEmail: string,
  profile?: CustomerProfile
): string {
  return safeStr(profile?.email) || safeStr(decodedEmail);
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

function timestampToMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function validateCheckoutCoupon(params: {
  db: FirebaseFirestore.Firestore;
  uid: string;
  email: string;
  rawCoupon: CustomerProfile["coupon"];
  subtotalTry: number;
}) {
  const { db, uid, email, rawCoupon, subtotalTry } = params;
  const code = safeStr(rawCoupon?.code).toUpperCase();
  if (!code) return null;

  let data: Record<string, any> | null = null;
  let source: "member" | "guest" = "guest";

  if (uid) {
    const memberSnap = await db
      .collection("users")
      .doc(uid)
      .collection("wheel_coupons")
      .doc(code)
      .get();

    if (memberSnap.exists) {
      source = "member";
      data = memberSnap.data() || {};
    }
  }

  if (!data) {
    const guestSnap = await db
      .collection("wheel_leads")
      .where("couponCode", "==", code)
      .where("couponStatus", "==", "active")
      .limit(1)
      .get();

    if (!guestSnap.empty) {
      const guestData = guestSnap.docs[0].data() || {};
      const ownerEmail = safeStr(guestData.email).toLowerCase();
      if (ownerEmail && ownerEmail === email.toLowerCase()) data = guestData;
    }
  }

  if (!data) throw new Error("Kupon bulunamadı veya bu hesaba ait değil.");

  const status = safeStr(data.status || data.couponStatus || "active");
  if (status !== "active") throw new Error("Kupon artık aktif değil.");

  const expiresAtMs = timestampToMillis(data.expiresAt);
  if (expiresAtMs && expiresAtMs <= Date.now()) {
    throw new Error("Kuponun kullanım süresi dolmuş.");
  }

  const minCartAmount = Math.max(0, toNum(data.minCartAmount, 0));
  if (subtotalTry < minCartAmount) {
    throw new Error(`Bu kupon için sepet tutarı en az ${minCartAmount.toFixed(2)} TL olmalı.`);
  }

  const discountType = safeStr(data.discountType || data.rewardType || "fixed");
  const discountValue = Math.max(0, toNum(data.discountValue ?? data.rewardValue, 0));
  if (!['percent', 'fixed', 'free_shipping', 'gift'].includes(discountType)) {
    throw new Error("Kupon indirim tipi geçersiz.");
  }
  if (discountType === "percent" && discountValue > 100) {
    throw new Error("Kupon indirim oranı geçersiz.");
  }

  return cleanObject({
    code,
    label: safeStr(data.label || data.rewardLabel || rawCoupon?.label),
    discountType,
    discountValue,
    minCartAmount,
    singleUse: data.singleUse !== false,
    campaignId: safeStr(data.campaignId),
    campaignTitle: safeStr(data.campaignTitle),
    source,
    verifiedAt: new Date().toISOString(),
  });
}

function pickLocalizedTitle(v: any, locale: "tr" | "en", fallback = "") {
  if (typeof v === "string") return safeStr(v) || fallback;

  if (v && typeof v === "object") {
    return (
      safeStr(v[locale]) ||
      safeStr(v.tr) ||
      safeStr(v.en) ||
      fallback
    );
  }

  return fallback;
}

function findQuoteItem(
  quoteItems: ClientQuoteItem[],
  productId: string,
  slug: string
): ClientQuoteItem | null {
  return (
    quoteItems.find((x) => safeStr(x.productId) === productId) ||
    quoteItems.find((x) => safeStr(x.slug) === slug) ||
    null
  );
}

function normalizeSelectedServices(clientQuote?: ClientQuote | null) {
  const services = Array.isArray(clientQuote?.selectedServices)
    ? clientQuote?.selectedServices || []
    : [];

  return services
    .map((service) => {
      const id = safeStr(service?.id);
      const code = safeStr(service?.code);
      const title = service?.title ?? null;

      const hay = `${id} ${code} ${pickLocalizedTitle(
        title,
        "tr"
      )} ${pickLocalizedTitle(title, "en")}`.toLocaleLowerCase("tr-TR");

      return cleanObject({
        id,
        code,
        title,
        priceTry: Math.max(0, toNum(service?.priceTry, 0)),
        freeOverTry: Math.max(0, toNum(service?.freeOverTry, 0)),
        isGiftPackage:
          service?.isGiftPackage === true ||
          hay.includes("gift") ||
          hay.includes("hediye") ||
          hay.includes("paket"),
      });
    })
    .filter((service) => service.id || service.code || service.title);
}

function resolvePackagingFromQuote(
  clientQuote?: ClientQuote | null,
  explicitPackaging?: PackagingInfo
): PackagingInfo {
  if (explicitPackaging && typeof explicitPackaging === "object") {
    const giftEnabled =
      explicitPackaging.giftPackage === true ||
      explicitPackaging.giftWrap === true ||
      explicitPackaging.gift === true;

    return cleanObject({
      giftPackage: giftEnabled,
      giftWrap: giftEnabled,
      gift: giftEnabled,
      serviceId: safeStr(explicitPackaging.serviceId),
      code: safeStr(explicitPackaging.code),
      title: explicitPackaging.title ?? null,
      priceTry: Math.max(0, toNum(explicitPackaging.priceTry, 0)),
      note: safeStr(explicitPackaging.note),
      message: safeStr(explicitPackaging.message),
    });
  }

  const selectedServices = normalizeSelectedServices(clientQuote);

  const giftService = selectedServices.find((service) => {
    const hay = `${service.id} ${service.code} ${pickLocalizedTitle(
      service.title,
      "tr"
    )} ${pickLocalizedTitle(service.title, "en")}`.toLocaleLowerCase("tr-TR");

    return service.isGiftPackage === true || hay.includes("gift") || hay.includes("hediye") || hay.includes("paket");
  });

  if (!giftService) {
    return {
      giftPackage: false,
      giftWrap: false,
      gift: false,
      serviceId: "",
      code: "",
      title: null,
      priceTry: 0,
      note: "",
      message: "",
    };
  }

  return cleanObject({
    giftPackage: true,
    giftWrap: true,
    gift: true,
    serviceId: giftService.id,
    code: giftService.code,
    title: giftService.title ?? null,
    priceTry: Math.max(0, toNum(giftService.priceTry, 0)),
    note: "",
    message: "",
  });
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
    .map((x: any) => {
      const row = cleanObject({
        productKey: safeStr(x?.productKey),
        productId: safeStr(x?.productId),
        slug: safeStr(x?.slug),
        sku: safeStr(x?.sku),
        title: x?.title ?? null,
        serviceId: safeStr(x?.serviceId),
        serviceCode: safeStr(x?.serviceCode),
        label: safeStr(x?.label),
        text: safeStr(x?.text).slice(0, 240),
      });

      return row;
    })
    .filter((x) => safeStr(x.text))
    .filter((x) => {
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

function pickItemCustomText(raw: any, quoteItem?: ClientQuoteItem | null): string {
  return (
    safeStr(raw?.customText) ||
    safeStr(raw?.productCustomText) ||
    safeStr(raw?.engravingText) ||
    safeStr(quoteItem?.customText) ||
    safeStr(quoteItem?.productCustomText) ||
    safeStr(quoteItem?.engravingText)
  ).slice(0, 240);
}
function normalizeClientQuote(clientQuote?: ClientQuote | null): ClientQuote | null {
  if (!clientQuote || typeof clientQuote !== "object") return null;

  return cleanObject({
    totalTry: Math.max(0, toNum(clientQuote.totalTry, 0)),
    subtotalTry: Math.max(0, toNum(clientQuote.subtotalTry, 0)),
    discountTry: Math.max(0, toNum(clientQuote.discountTry, 0)),
    shippingFeeTry: Math.max(0, toNum(clientQuote.shippingFeeTry, 0)),
    serviceTotalTry: Math.max(0, toNum(clientQuote.serviceTotalTry, 0)),
       productCustomText: normalizeProductCustomText(clientQuote.productCustomText),
    productTexts: normalizeProductTexts(clientQuote.productTexts),
    selectedServices: normalizeSelectedServices(clientQuote),
    items: Array.isArray(clientQuote.items)
      ? clientQuote.items.map((item) => {
          const variantItems = cleanSelectedVariantItems(item.selectedVariantItems);
          const gramFromItems = getVariantGramFromItems(variantItems);

          const selectedVariantGram = Math.max(
            0,
            toNum(
              item.selectedVariantGram ??
                item.weightGram ??
                item.hasGram ??
                gramFromItems,
              0
            )
          );

          const unitPriceTry = Math.max(
            0,
            toNum(
              item.unitPriceTry ??
                item.resolvedUnitPrice ??
                item.priceTry,
              0
            )
          );

          const qty = clampInt(item.qty, 1, 99);

          const lineTry = Math.max(
            0,
            toNum(
              item.lineTry ??
                item.lineTotalTry ??
                (unitPriceTry > 0 ? unitPriceTry * qty : 0),
              0
            )
          );

          const customText = pickItemCustomText(item, null);

return cleanObject({
  productId: safeStr(item.productId),
  slug: safeStr(item.slug),
  qty,

  ...(customText
    ? {
        customText,
        productCustomText: customText,
        engravingText: customText,
      }
    : {}),

  unitPriceTry,
            resolvedUnitPrice: Math.max(0, toNum(item.resolvedUnitPrice, 0)),
            priceTry: Math.max(0, toNum(item.priceTry, 0)),
            lineTry: Number(lineTry.toFixed(2)),
            lineTotalTry: Number(lineTry.toFixed(2)),
            title: item.title ?? null,
            image: safeStr(item.image),
            selectedSize: safeStr(item.selectedSize),
            selectedVariants: cleanStringMap(item.selectedVariants) || null,
            selectedVariantItems: variantItems,
            ...(selectedVariantGram > 0
              ? {
                  selectedVariantGram,
                  weightGram: selectedVariantGram,
                  hasGram: selectedVariantGram,
                }
              : {}),
          });
        })
      : [],
  });
}

function getQuoteUnitPriceTry(quoteItem: ClientQuoteItem | null): number {
  return Math.max(
    0,
    toNum(
      quoteItem?.unitPriceTry ??
        quoteItem?.resolvedUnitPrice ??
        quoteItem?.priceTry,
      0
    )
  );
}

function getQuoteLineTry(
  quoteItem: ClientQuoteItem | null,
  unitPriceTry: number,
  qty: number
): number {
  const fromQuote = Math.max(
    0,
    toNum(quoteItem?.lineTry ?? quoteItem?.lineTotalTry, 0)
  );

  if (fromQuote > 0) return Number(fromQuote.toFixed(2));

  return Number((unitPriceTry * qty).toFixed(2));
}

async function resolveCart(
  db: FirebaseFirestore.Firestore,
  items: PaymentItem[],
  locale: "tr" | "en",
  clientQuote?: ClientQuote | null
): Promise<{ totalTry: number; resolvedItems: ResolvedCartItem[] }> {
  if (!Array.isArray(items) || !items.length) {
    return { totalTry: 0, resolvedItems: [] };
  }

  let total = 0;
  const resolvedItems: ResolvedCartItem[] = [];
  const quoteItems = Array.isArray(clientQuote?.items) ? clientQuote.items || [] : [];

  for (const raw of items) {
    const productId = safeStr(raw?.productId);
    const qty = clampInt(raw?.qty, 1, 99);

    if (!productId) continue;

    const snap = await db.collection("products").doc(productId).get();
    if (!snap.exists) {
      throw new Error(`Ürün bulunamadı: ${productId}`);
    }

    const p = snap.data() as Record<string, unknown>;

    // Aktiflik kontrolü — devre dışı ürünle ödeme başlatılamaz
    if ((p as any).isActive === false) {
      const pTitle = pickLocalizedTitle((p as any).title, locale, productId);
      throw new Error(`"${pTitle}" artık satışta değil.`);
    }

    // Stok kontrolü — ödeme başlatılmadan önce stok yeterliliği kontrol edilir
    const currentStock = Math.max(0, Math.floor(toNum((p as any).stock, 0)));
    if (currentStock <= 0) {
      const pTitle = pickLocalizedTitle((p as any).title, locale, productId);
      throw new Error(`"${pTitle}" stokta yok.`);
    }
    if (qty > currentStock) {
      const pTitle = pickLocalizedTitle((p as any).title, locale, productId);
      throw new Error(
        `"${pTitle}" stokta ${currentStock} adet var, sepette ${qty} adet.`
      );
    }

    const slug = safeStr((p as any).slug) || safeStr(raw.slug) || productId;
    const quoteItem = findQuoteItem(quoteItems, productId, slug);

    const rawVariantItems = cleanSelectedVariantItems(raw.selectedVariantItems);
    const quoteVariantItems = cleanSelectedVariantItems(quoteItem?.selectedVariantItems);

    const selectedVariantItems = rawVariantItems.length
      ? rawVariantItems
      : quoteVariantItems;

    const selectedVariantGram = Math.max(
      0,
      toNum(
        raw.selectedVariantGram ??
          raw.weightGram ??
          raw.hasGram ??
          quoteItem?.selectedVariantGram ??
          quoteItem?.weightGram ??
          quoteItem?.hasGram ??
          getVariantGramFromItems(selectedVariantItems),
        0
      )
    );

    const quoteUnitPrice = getQuoteUnitPriceTry(quoteItem);

    const productUnitPrice =
      toNum((p as any).finalPrice, 0) ||
      toNum((p as any).priceTry, 0) ||
      toNum((p as any).price, 0) ||
      toNum((p as any).salePrice, 0);

    const unitPrice = quoteUnitPrice > 0 ? quoteUnitPrice : productUnitPrice;

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Geçersiz ürün fiyatı: ${productId}`);
    }

    let title = "";
    const titleRaw = quoteItem?.title || (p as any).title;

    if (typeof titleRaw === "string") {
      title = titleRaw;
    } else if (titleRaw && typeof titleRaw === "object") {
      const t = titleRaw as Record<string, unknown>;
      title = safeStr(t[locale]) || safeStr(t.tr) || safeStr(t.en);
    }

    if (!title) title = slug;

    const image =
      safeStr(quoteItem?.image) ||
      safeStr((p as any).image) ||
      safeStr((p as any).mainImage) ||
      (Array.isArray((p as any).images) ? safeStr((p as any).images[0]) : "");

    const selectedSize =
      safeStr(raw.selectedSize) ||
      safeStr(quoteItem?.selectedSize);

    const selectedVariants =
      cleanStringMap(raw.selectedVariants) ||
      cleanStringMap(quoteItem?.selectedVariants) ||
      null;
    const customText = pickItemCustomText(raw, quoteItem);
    const lineTotalTry = getQuoteLineTry(quoteItem, unitPrice, qty);
    total += lineTotalTry;

    resolvedItems.push(
      cleanObject({
        productId,
        slug,
        title,
        qty,
                ...(customText
          ? {
              customText,
              productCustomText: customText,
              engravingText: customText,
            }
          : {}),
        unitPriceTry: Number(unitPrice.toFixed(2)),
        lineTotalTry,
        image,
        selectedSize,
        selectedVariants,
        selectedVariantItems,
        ...(selectedVariantGram > 0
          ? {
              selectedVariantGram,
              weightGram: selectedVariantGram,
              hasGram: selectedVariantGram,
            }
          : {}),
        ...(raw.variant && Object.keys(raw.variant).length
          ? { variant: raw.variant }
          : {}),
      })
    );
  }

  return {
    totalTry: Number(total.toFixed(2)),
    resolvedItems,
  };
}

export async function POST(req: Request) {
  try {
    initAdmin();
    const db = getFirestore();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const uid = safeStr(decoded?.uid);
    const emailFromToken = safeStr(decoded?.email);

    if (!uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const roles = Array.isArray((decoded as any)?.roles)
      ? (decoded as any).roles.map(String)
      : [];

    const role = String((decoded as any)?.role || "").trim();

    const isAdminUser =
      (decoded as any)?.admin === true ||
      role === "admin" ||
      role === "sub_admin" ||
      roles.includes("admin") ||
      roles.includes("sub_admin");

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const locale = normalizeLocale(body.locale);
    const customerProfileRaw = body.customerProfile || {};
    const shippingAddress = body.shippingAddress || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const userAgent = safeStr(body.userAgent);

    const customerEmail = pickCustomerEmail(emailFromToken, customerProfileRaw);

    let customerProfile = cleanObject({
      ...customerProfileRaw,
      email: customerEmail,
      firstName: safeStr(customerProfileRaw.firstName),
      lastName: safeStr(customerProfileRaw.lastName),
      phone: safeStr(customerProfileRaw.phone),
      tcNo: safeStr(customerProfileRaw.tcNo),
      birthDate: safeStr(customerProfileRaw.birthDate),
      coupon: customerProfileRaw.coupon || null,
    });

const clientQuote = normalizeClientQuote(body.clientQuote);

const productTexts = normalizeProductTexts([
  ...(Array.isArray(body.productTexts) ? body.productTexts : []),
  ...(Array.isArray(clientQuote?.productTexts) ? clientQuote.productTexts : []),
]);

const productCustomText = normalizeProductCustomText({
  ...(clientQuote?.productCustomText || {}),
  ...(body.productCustomText || {}),
});

const selectedServices = normalizeSelectedServices(clientQuote);
const packaging = resolvePackagingFromQuote(clientQuote, body.packaging || null);
const giftPackage = packaging?.giftPackage === true || packaging?.giftWrap === true;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "E-posta bilgisi eksik." },
        { status: 400 }
      );
    }

    if (!items.length) {
      return NextResponse.json({ error: "cart empty" }, { status: 400 });
    }

    const resolved = await resolveCart(db, items, locale, clientQuote);

    const quoteTotalTry = Math.max(0, toNum(clientQuote?.totalTry, 0));
    const resolvedTotalTry = Math.max(0, toNum(resolved.totalTry, 0));

    try {
      const verifiedCoupon = await validateCheckoutCoupon({
        db,
        uid,
        email: customerEmail,
        rawCoupon: customerProfileRaw.coupon || null,
        subtotalTry: resolvedTotalTry,
      });
      customerProfile = cleanObject({
        ...customerProfile,
        coupon: verifiedCoupon,
      });
    } catch (couponError: any) {
      return NextResponse.json(
        { error: couponError?.message || "Kupon doğrulanamadı." },
        { status: 400 }
      );
    }

    const totalTry =
      quoteTotalTry > 0 ? Number(quoteTotalTry.toFixed(2)) : resolvedTotalTry;

    const resolvedItems = resolved.resolvedItems;

    if (!Number.isFinite(totalTry) || totalTry <= 0) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }

    const customerName = pickCustomerName(customerProfile, shippingAddress);
    const customerPhone = pickCustomerPhone(customerProfile, shippingAddress);

    const sessionRef = db.collection("payment_sessions").doc();
    const sessionId = sessionRef.id;

    const baseUrl = getPaymentBaseUrl();
    const customerIp = getClientIp(req);
    const provider = getPaymentProvider();

    const paymentSnap = await db.collection("settings").doc("payment").get();
    const paymentSettings = paymentSnap.exists
      ? (paymentSnap.data() as Record<string, any>)
      : {};

    const cardSettings = paymentSettings?.card || {};
    const cardProvider = String(cardSettings?.provider || "").trim();
    const cardPublicActive =
      cardSettings?.isActive !== false && cardProvider === "paytr";
    const cardAdminPreviewEnabled =
      cardSettings?.adminPreviewEnabled !== false;

    const canUseCard =
      cardPublicActive ||
      (isAdminUser &&
        cardAdminPreviewEnabled &&
        cardProvider === "paytr");

    if (!canUseCard) {
      return NextResponse.json(
        { error: "Online ödeme şu anda aktif değil." },
        { status: 403 }
      );
    }

    const result = await startPayment({
      orderId: sessionId,
      amountTry: totalTry,
      customerEmail,
      customerName,
      customerPhone,
      successUrl: `${baseUrl}/checkout/success/${encodeURIComponent(
        sessionId
      )}`,
      failUrl: `${baseUrl}/checkout/pay?sessionId=${encodeURIComponent(
        sessionId
      )}&status=failed`,
      callbackUrl: `${baseUrl}/api/payments/paytr/callback`,
      customerIp,
      currency: "TL",
      testMode: process.env.NODE_ENV !== "production",
      items: resolvedItems.map((item) => ({
        name: item.title,
        priceTry: item.unitPriceTry,
        qty: item.qty,
      })),
    });

    const providerSessionUrl =
      result.mode === "redirect"
        ? safeStr(result.redirectUrl)
        : safeStr(result.postUrl);

    const providerPayload =
      result.mode === "form_post"
        ? {
            mode: result.mode,
            postUrl: result.postUrl,
            fields: result.fields,
            callbackUrl: `${baseUrl}/api/payments/paytr/callback`,
          }
        : {
            mode: result.mode,
            redirectUrl: result.redirectUrl,
            callbackUrl: `${baseUrl}/api/payments/paytr/callback`,
          };

    const nowIso = new Date().toISOString();

  console.log("[payments/start] session payload check", {
  sessionId,
  totalTry,
  customerEmail,
  items,
  resolvedItems,
  clientQuote,
  selectedServices,
  packaging,
  giftPackage,
  productTexts,
  productCustomText,
});

    await sessionRef.set(
      cleanObject({
        uid,
        email: customerEmail,
        locale,
        status: "processing",
        paymentStatus: "processing",
        provider,
        method: "card",

        amountTry: totalTry,
        currency: "TRY",

        customerProfile,
        shippingAddress,
        items: items.map((item) => {
  const quoteItem = findQuoteItem(
    clientQuote?.items || [],
    safeStr(item.productId),
    safeStr(item.slug)
  );

  const customText = pickItemCustomText(item, quoteItem);

  return cleanObject({
    ...item,
    ...(customText
      ? {
          customText,
          productCustomText: customText,
          engravingText: customText,
        }
      : {}),
  });
}),
resolvedItems,

        clientQuote,
        selectedServices,
        packaging,
        giftPackage,
        giftWrap: giftPackage,
        productTexts,
        productCustomText,
        meta: {
          userAgent,
          customerIp,
        },

        providerOrderId: safeStr(result.providerOrderId),
        providerSessionId: safeStr(result.providerSessionId),
        providerSessionUrl,
        providerPayload,
        providerRaw: result.raw ?? null,

        orderCreated: false,
        orderId: "",

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      })
    );

    if (result.mode === "redirect") {
      return NextResponse.json({
        ok: true,
        provider: result.provider,
        mode: result.mode,
        sessionId,
        merchantOid: sessionId,
        paymentIntentId: sessionId,
        redirectUrl: result.redirectUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      mode: result.mode,
      sessionId,
      merchantOid: sessionId,
      paymentIntentId: sessionId,
      postUrl: result.postUrl,
      fields: result.fields,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "payment start failed";

    console.error("[payments/start] failed:", e);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
