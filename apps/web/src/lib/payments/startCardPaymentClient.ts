import { getIdToken } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase.client";

type StartCardPaymentItem = {
  productId: string;
  slug?: string;
  qty: number;
  variant?: Record<string, string>;
  selectedSize?: string;
  selectedVariants?: Record<string, string>;
  selectedVariantItems?: Array<{
    groupId: string;
    groupLabel: string;
    value: string;
    label: string;
    priceDelta?: number;
  }>;
};

type StartCardPaymentCustomerProfile = {
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

type StartCardPaymentShippingAddress = {
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

type StartCardPaymentPackaging = {
  giftPackage?: boolean;
  giftWrap?: boolean;
  gift?: boolean;
  serviceId?: string;
  code?: string;
  title?: any;
  priceTry?: number;
  note?: string;
  message?: string;
};

type StartCardPaymentClientQuote = {
  totalTry?: number;
  subtotalTry?: number;
  discountTry?: number;
  serviceTotalTry?: number;

  selectedServices?: Array<{
    id?: string;
    code?: string;
    title?: any;
    priceTry?: number;
    freeOverTry?: number;
    isGiftPackage?: boolean;
  }>;

  items?: Array<{
    productId?: string;
    slug?: string;
    qty?: number;
    unitPriceTry?: number;
    title?: any;
    image?: string;
    selectedSize?: string;
    selectedVariants?: Record<string, string> | null;
    selectedVariantItems?: Array<{
      groupId?: string;
      groupLabel?: string;
      value?: string;
      label?: string;
      priceDelta?: number;
    }>;
  }>;
};

export type StartCardPaymentInput = {
  locale: "tr" | "en";
  customerProfile?: StartCardPaymentCustomerProfile;
  shippingAddress?: StartCardPaymentShippingAddress;
  items: StartCardPaymentItem[];
  userAgent?: string;

  // Checkout ekstra hizmetleri / hediye paketi
  packaging?: StartCardPaymentPackaging | null;

  // Root fallback alanları: backend hangi taraftan okursa yakalasın
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
    freeOverTry?: number;
    isGiftPackage?: boolean;
  }>;

  serviceTotalTry?: number;

  // Checkout ekranındaki hesaplanmış toplamlar ve seçili servisler
  clientQuote?: StartCardPaymentClientQuote | null;
  productTexts?: Array<{
  productKey?: string;
  productId?: string;
  slug?: string;
  sku?: string;
  title?: any;
  serviceId?: string;
  serviceCode?: string;
  label?: string;
  text?: string;
}>;

productCustomText?: Record<string, string>;
};

export type StartCardPaymentResponse =
  | {
      ok: true;
      provider: "paytr";
      mode: "redirect";
      sessionId: string;
      redirectUrl: string;
      merchantOid?: string;
      paymentIntentId?: string;
    }
  | {
      ok: true;
      provider: "paytr";
      mode: "form_post";
      sessionId: string;
      postUrl: string;
      fields: Record<string, string>;
      merchantOid?: string;
      paymentIntentId?: string;
    };

export async function startCardPaymentClient(
  payload: StartCardPaymentInput
): Promise<StartCardPaymentResponse> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error("Ödeme için giriş yapman gerekiyor.");
  }

  const token = await getIdToken(user, true);

  const res = await fetch("/api/payments/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: unknown }).error || "")
        : "";

    throw new Error(err || "Kartlı ödeme başlatılamadı.");
  }

  const result = data as Partial<StartCardPaymentResponse>;

  if (!result.ok || result.provider !== "paytr" || !result.mode || !result.sessionId) {
    throw new Error("Geçersiz ödeme başlatma yanıtı alındı.");
  }

  if (result.mode === "redirect") {
    if (!result.redirectUrl) {
      throw new Error("Redirect URL eksik.");
    }

    return {
      ok: true,
      provider: "paytr",
      mode: "redirect",
      sessionId: result.sessionId,
      redirectUrl: result.redirectUrl,
      merchantOid: result.merchantOid,
      paymentIntentId: result.paymentIntentId,
    };
  }

  if (result.mode === "form_post") {
    if (!result.postUrl || !result.fields) {
      throw new Error("Form post verisi eksik.");
    }

    return {
      ok: true,
      provider: "paytr",
      mode: "form_post",
      sessionId: result.sessionId,
      postUrl: result.postUrl,
      fields: result.fields,
      merchantOid: result.merchantOid,
      paymentIntentId: result.paymentIntentId,
    };
  }

  throw new Error("Desteklenmeyen ödeme modu.");
}