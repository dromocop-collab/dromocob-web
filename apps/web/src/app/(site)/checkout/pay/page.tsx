"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getIdTokenResult, onIdTokenChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
} from "@/lib/firebase.client";
import { startCardPaymentClient } from "@/lib/payments/startCardPaymentClient";
import { clearCartEverywhere } from "@/lib/cartFirestore";
import CheckoutProgressBar from "@/components/CheckoutProgressBar";
import s from "./pay.module.css";

type Locale = "tr" | "en";
type PaymentMethod = "card" | "eft";

type PaymentSettingsDoc = {
  card?: {
    isActive?: boolean;
    adminPreviewEnabled?: boolean;
    provider?: "none" | "paytr";
    merchantTitle?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  bankTransfer?: {
    isActive?: boolean;
    adminPreviewEnabled?: boolean;
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
};

type CheckoutDraft = {
  locale?: Locale;
  productCustomText?: Record<string, string>;

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
  giftPackage?: boolean;
giftWrap?: boolean;
giftNote?: string;
giftMessage?: string;
giftPackageNote?: string;
    packaging?: {

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
  customerProfile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    tcNo?: string;
    birthDate?: string;
  };
  shippingAddress?: {
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
items?: Array<{
  productId: string;
  slug?: string;
  qty?: number;

  unitPriceTry?: number;
  unitPrice?: number;
  priceTry?: number;
  price?: number;
  resolvedUnitPrice?: number;
  finalPrice?: number;
  lineTry?: number;
  totalTry?: number;

  title?: any;
  image?: string;
  selectedSize?: string;
  customText?: string;
productCustomText?: string;
engravingText?: string;
selectedVariantGram?: number;
weightGram?: number;
hasGram?: number;
  selectedVariants?: Record<string, string> | null;
  selectedVariantItems?: Array<{
    groupId?: string;
    groupLabel?: string;
    value?: string;
    label?: string;
    priceDelta?: number;
  }>;
}>;
    clientQuote?: {
    totalTry?: number;
    subtotalTry?: number;
    discountTry?: number;
    shippingFeeTry?: number;
    serviceTotalTry?: number;
productCustomText?: Record<string, string>;

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
    selectedServices?: Array<{
      id?: string;
      code?: string;
      title?: any;
      priceTry?: number;
      freeOverTry?: number;
      isGiftPackage?: boolean;
    }>;

items?: Array<{
  productId: string;
  slug?: string;
  qty?: number;

  unitPriceTry?: number;
  unitPrice?: number;
  priceTry?: number;
  price?: number;
  resolvedUnitPrice?: number;
  finalPrice?: number;
  lineTry?: number;
  totalTry?: number;

  title?: any;
  image?: string;
  selectedSize?: string;
  customText?: string;
productCustomText?: string;
engravingText?: string;
selectedVariantGram?: number;
weightGram?: number;
hasGram?: number;
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
};

const DRAFT_KEY = "nci_checkout_draft_v1";
const FALLBACK_IMG = "/dromocob-mark.svg";

function fmtTRY(n: unknown) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "₺0,00";

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(x);
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function escapeRegExp(v: string) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAddressParts(shippingAddress?: {
  addressLine?: string;
  district?: string;
  city?: string;
}) {
  const addressLine = safeStr(shippingAddress?.addressLine)
    .replace(/\s+/g, " ")
    .trim();

  const district = safeStr(shippingAddress?.district)
    .replace(/\s+/g, " ")
    .trim();

  const city = safeStr(shippingAddress?.city)
    .replace(/\s+/g, " ")
    .trim();

  let cleanLine = addressLine;

  if (district) {
    cleanLine = cleanLine.replace(new RegExp(escapeRegExp(district), "ig"), "").trim();
  }

  if (city) {
    cleanLine = cleanLine.replace(new RegExp(escapeRegExp(city), "ig"), "").trim();
  }

  cleanLine = cleanLine
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/(\/\s*){2,}/g, "/ ")
    .replace(/^\/|\/$/g, "")
    .trim();

  const parts = [cleanLine, district, city].map((x) => x.trim()).filter(Boolean);

  const uniqueParts = parts.filter(
    (part, index) =>
      parts.findIndex(
        (p) => p.toLocaleLowerCase("tr-TR") === part.toLocaleLowerCase("tr-TR")
      ) === index
  );

  return uniqueParts.join(" / ") || "—";
}

function pickText(v: any, loc: Locale) {
  if (!v) return "";
  if (typeof v === "string") return v;

  const tr = String(v?.tr ?? "").trim();
  const en = String(v?.en ?? "").trim();

  return loc === "en" ? en || tr : tr || en;
}

function safeImage(v: unknown) {
  const src = String(v ?? "").trim();
  if (!src) return FALLBACK_IMG;
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }

  return `/${src.replace(/^\/+/, "")}`;
}
function safeNumber(v: any, fallback = 0) {
  const n =
    typeof v === "string"
      ? Number(v.trim().replace(/\./g, "").replace(",", "."))
      : Number(v);

  return Number.isFinite(n) ? n : fallback;
}

function resolvePreviewUnitPrice(q: any, matchingDraftItem: any, qty: number) {
  const direct = safeNumber(
    q?.unitPriceTry ??
      q?.resolvedUnitPrice ??
      q?.unitPrice ??
      q?.priceTry ??
      q?.finalPrice ??
      q?.price ??
      matchingDraftItem?.unitPriceTry ??
      matchingDraftItem?.resolvedUnitPrice ??
      matchingDraftItem?.unitPrice ??
      matchingDraftItem?.priceTry ??
      matchingDraftItem?.finalPrice ??
      matchingDraftItem?.price,
    0
  );

  if (direct > 0) return direct;

  const line = safeNumber(
    q?.lineTry ??
      q?.totalTry ??
      matchingDraftItem?.lineTry ??
      matchingDraftItem?.totalTry,
    0
  );

  if (line > 0 && qty > 0) return line / qty;

  return 0;
}
function resolveGiftPackageFromDraft(draft?: CheckoutDraft | null) {
  const packaging = draft?.packaging || {};
  const selectedServices = Array.isArray((draft?.clientQuote as any)?.selectedServices)
    ? (draft?.clientQuote as any).selectedServices
    : [];

  const serviceGift = selectedServices.find((service: any) => {
    const hay = [
      service?.id,
      service?.code,
      typeof service?.title === "string" ? service.title : service?.title?.tr,
      typeof service?.title === "string" ? service.title : service?.title?.en,
    ]
      .map((x) => String(x || "").toLocaleLowerCase("tr-TR"))
      .join(" ");

    return (
      service?.isGiftPackage === true ||
      hay.includes("hediye") ||
      hay.includes("gift") ||
      hay.includes("paket")
    );
  });

  const enabled =
    packaging.giftPackage === true ||
    packaging.giftWrap === true ||
    packaging.gift === true ||
    Boolean(serviceGift);

  return {
    giftPackage: enabled,
    giftWrap: enabled,
    gift: enabled,
    serviceId: safeStr(packaging.serviceId || serviceGift?.id),
    code: safeStr(packaging.code || serviceGift?.code),
    title: packaging.title || serviceGift?.title || null,
    priceTry: Number(packaging.priceTry ?? serviceGift?.priceTry ?? 0) || 0,
      note: enabled
  ? safeStr(packaging.note) ||
    safeStr(packaging.message) ||
    safeStr((draft as any)?.giftNote) ||
    safeStr((draft as any)?.giftMessage) ||
    safeStr((draft as any)?.giftPackageNote)
  : "",
  };
}
function resolveProductTextsFromDraft(draft?: CheckoutDraft | null) {
  const fromDraft = Array.isArray((draft as any)?.productTexts)
    ? (draft as any).productTexts
    : [];

  const fromQuote = Array.isArray((draft as any)?.clientQuote?.productTexts)
    ? (draft as any).clientQuote.productTexts
    : [];

  const merged = [...fromDraft, ...fromQuote];

  const seen = new Set<string>();

  return merged
    .map((x: any) => ({
      productKey: safeStr(x?.productKey),
      productId: safeStr(x?.productId),
      slug: safeStr(x?.slug),
      sku: safeStr(x?.sku),
      title: x?.title || null,
      serviceId: safeStr(x?.serviceId),
      serviceCode: safeStr(x?.serviceCode),
      label: safeStr(x?.label),
      text: safeStr(x?.text),
    }))
    .filter((x: any) => x.text)
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

function resolveProductCustomTextFromDraft(draft?: CheckoutDraft | null) {
  const fromDraft =
    (draft as any)?.productCustomText &&
    typeof (draft as any).productCustomText === "object"
      ? (draft as any).productCustomText
      : {};

  const fromQuote =
    (draft as any)?.clientQuote?.productCustomText &&
    typeof (draft as any).clientQuote.productCustomText === "object"
      ? (draft as any).clientQuote.productCustomText
      : {};

  return {
    ...fromQuote,
    ...fromDraft,
  } as Record<string, string>;
}
export default function CheckoutPayPage() {
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);
  const functions = useMemo(() => getFunctions(getFirebaseApp(), "europe-west1"), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);

  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiedKey, setCopiedKey] = useState<"" | "iban" | "ref">("");
  const [createdOrderId, setCreatedOrderId] = useState("");
const [agreementModal, setAgreementModal] = useState<"" | "sales" | "preinfo">("");
const [acceptedSalesContract, setAcceptedSalesContract] = useState(false);
const [acceptedPreInfo, setAcceptedPreInfo] = useState(false);

const agreementsAccepted = acceptedSalesContract && acceptedPreInfo;
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettingsDoc | null>(null);
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);

  const isRealUser = !!user && !user.isAnonymous;
  const uid = isRealUser ? user.uid : null;

  useEffect(() => {
    const raw =
      (typeof window !== "undefined" && localStorage.getItem("nci_locale")) || "tr";

    setLoc(raw === "en" ? "en" : "tr");

    const handler = (e: Event) => {
      const next = ((e as any)?.detail || localStorage.getItem("nci_locale") || "tr") as Locale;
      setLoc(next === "en" ? "en" : "tr");
    };

    window.addEventListener("locale-changed", handler as any);
    window.addEventListener("storage", handler as any);

    return () => {
      window.removeEventListener("locale-changed", handler as any);
      window.removeEventListener("storage", handler as any);
    };
  }, []);

  const t = useMemo(() => {
    const en = loc === "en";

    return {
      title: en ? "Payment" : "Ödeme",
      subtitle: en
        ? "Choose your payment method and continue securely."
        : "Ödeme yöntemini seç ve güvenli şekilde devam et.",

      checkoutKicker: "CHECKOUT",
      back: en ? "Back to checkout" : "Sepet’e dön",
      loading: en ? "Loading…" : "Yükleniyor…",
agreementsTitle: en ? "Agreements" : "Sözleşmeler",
salesContract: en ? "Distance Sales Agreement" : "Mesafeli Satış Sözleşmesi",
preInfoForm: en ? "Preliminary Information Form" : "Ön Bilgilendirme Formu",
readAndAccept: en ? "I have read and accept" : "Okudum ve onaylıyorum",
mustAcceptAgreements: en
  ? "Please read and accept the agreements before continuing."
  : "Devam etmek için sözleşmeleri okuyup onaylamalısın.",
openAgreement: en ? "Open" : "Aç",
close: en ? "Close" : "Kapat",
      preview: en ? "Secure Checkout" : "Güvenli Ödeme",
      order: en ? "Order" : "Sipariş",
      amount: en ? "Amount" : "Tutar",
      items: en ? "Items" : "Ürünler",
      productPreview: en ? "Products preview" : "Ürün önizleme",
      qty: en ? "Qty" : "Adet",
      method: en ? "Payment Method" : "Ödeme Yöntemi",

      card: en ? "Credit / Debit Card" : "Kredi / Banka Kartı",
      eft: en ? "Bank Transfer" : "Havale / EFT",

      startCard: en ? "Pay securely by card" : "Kartla güvenli öde",
      startEft: en ? "Create transfer order" : "Havale siparişini oluştur",

      secure: en ? "Secure checkout" : "Güvenli ödeme",
      ssl: "SSL",
      secure3d: "3D Secure",

      copy: en ? "Copy" : "Kopyala",
      copied: en ? "Copied" : "Kopyalandı",

      loginReq: en ? "Please login to continue payment." : "Ödeme için giriş yapman gerekiyor.",
      login: en ? "Login" : "Giriş Yap",
      noDraft: en ? "Checkout data not found." : "Checkout verisi bulunamadı.",
      noDraftLong: en
        ? "Payment data was not found. Please return to checkout."
        : "Ödeme verisi bulunamadı. Lütfen checkout ekranına geri dön.",
      draftReadFailed: en ? "Payment data could not be read." : "Ödeme verisi okunamadı.",
      missingDraftAction: en ? "Go to checkout" : "Sepet’e dön",

      cartDataMissing: en ? "Cart data not found." : "Sepet verisi bulunamadı.",
      orderNoMissing: en ? "Order number was not returned." : "Sipariş numarası dönmedi.",
      createError: en ? "Order could not be created." : "Sipariş oluşturulamadı.",

      cardHint: en
        ? "Card details are entered on the secure payment provider page."
        : "Kart bilgileri güvenli ödeme sağlayıcısı sayfasında girilir.",
      eftHint: en
        ? "Order is created first, then you complete the transfer."
        : "Önce sipariş oluşur, sonra havaleyi tamamlarsın.",

      cardNotConfigured: en
        ? "Online payment has not been configured yet."
        : "Online ödeme henüz yapılandırılmamış.",
      cardClosedPublic: en
        ? "Online payment is currently closed to customers."
        : "Online ödeme şu anda müşterilere kapalı.",
      cardAdminPreview: en
        ? "Card payment is closed on storefront, admin test mode is active."
        : "Kart ödeme mağazada kapalı, admin test modu açık.",
      cardInactive: en
        ? "Card payment flow is not active right now."
        : "Kart ödeme akışı şu an aktif değil.",
      onlineInactive: en
        ? "Online payment is not active right now."
        : "Online ödeme şu anda aktif değil.",
      cardStartFailed: en
        ? "Card payment could not be started."
        : "Kartlı ödeme başlatılamadı.",
      unsupportedPaymentMode: en
        ? "Unsupported payment mode."
        : "Desteklenmeyen ödeme modu.",

      bankClosedPublic: en
        ? "Bank transfer is currently closed to customers."
        : "Havale / EFT şu anda müşterilere kapalı.",
      bankAdminPreview: en
        ? "Bank transfer is closed on storefront, admin test mode is active."
        : "Havale / EFT mağazada kapalı, admin test modu açık.",
      bankInactive: en
        ? "Bank transfer is not active right now."
        : "Havale / EFT şu anda aktif değil.",
      bankBlockedAdmin: en
        ? "Bank transfer is closed to customers. It cannot be opened outside admin test mode."
        : "Havale / EFT müşterilere kapalı. Admin test modu dışında açılamaz.",
      cardBlockedAdmin: en
        ? "Card payment is closed to customers. It cannot be opened outside admin test mode."
        : "Kart ödeme müşterilere kapalı. Admin test modu dışında açılamaz.",

      summary: en ? "Summary" : "Özet",
      status: en ? "Status" : "Durum",
      notCreated: en ? "Ready for payment" : "Ödemeye hazır",
      created: en ? "Order created" : "Sipariş oluşturuldu",
      orderPreviewInfo: en
        ? "The order has not been created yet. This is a payment preview."
        : "Sipariş henüz oluşturulmadı. Bu ekran ödeme önizlemesidir.",
      paymentPreview: en ? "Waiting for payment" : "Ödeme bekleniyor",
      orderNo: en ? "Order No" : "Sipariş No",

      redirecting: en ? "Redirecting..." : "Yönlendiriliyor...",
      creating: en ? "Creating..." : "Oluşturuluyor...",

      cardBlockTitle: en ? "Card Payment" : "Kart ile ödeme",
      cardBlockText: en
        ? "You are redirected to the secure payment provider page. Your order is created after successful payment confirmation."
        : "Güvenli ödeme sağlayıcısı sayfasına yönlendirilirsin. Siparişin, ödeme başarıyla onaylandıktan sonra oluşturulur.",

      bankTitle: en ? "Bank Transfer Details" : "Havale / EFT Bilgileri",
      bankNote: en
        ? "Your order is created first. Then complete the transfer using the order reference."
        : "Önce sipariş oluşturulur. Sonra referans numarasıyla havaleyi tamamlarsın.",
      eftBlockText: en
        ? "After the order is created, complete the transfer using the generated reference code."
        : "Sipariş oluştuktan sonra üretilen referans koduyla havaleyi tamamla.",

      receiver: en ? "Receiver" : "Alıcı",
      bank: en ? "Bank" : "Banka",
      branch: en ? "Branch" : "Şube",
      accountHolder: en ? "Account Holder" : "Hesap Sahibi",
      account: en ? "Account" : "Hesap",
      currency: en ? "Currency" : "Para Birimi",
      reference: en ? "Reference" : "Referans",
      afterOrderCreated: en ? "Generated after order creation" : "Siparişten sonra oluşur",
      defaultBankName: en ? "Bank Name" : "Banka Adı",
      defaultBranch: en ? "Branch" : "Şube",
      defaultAccountHolder: en ? "Account Holder" : "Hesap Sahibi",
      defaultAccount: en ? "Account No" : "Hesap No",
      defaultBankNote: en
        ? "Please write the reference code in the transfer description."
        : "Lütfen açıklama alanına referans kodunu yazınız.",

      supportPhone: en ? "Support Phone" : "Destek Tel",
      whatsapp: "WhatsApp",

      deliveryInfo: en ? "Delivery Information" : "Teslimat Bilgisi",
      invoiceType: en ? "Invoice Type" : "Fatura Tipi",
      individual: en ? "Individual" : "Bireysel",
      company: en ? "Company" : "Kurumsal",
      nationalId: en ? "National ID" : "TC Kimlik No",
      companyName: en ? "Company Name" : "Firma Adı",
      taxNumber: en ? "Tax Number" : "Vergi Numarası",
      taxOffice: en ? "Tax Office" : "Vergi Dairesi",
      phone: en ? "Phone" : "Telefon",
      address: en ? "Address" : "Adres",

      security: en ? "Security" : "Güvenlik",
      secNoCardStore: en ? "Card data is not stored" : "Kart verisi saklanmaz",
      secProviderRedirect: en ? "Provider redirect flow" : "Provider yönlendirmesi",
      secOrderUid: en ? "Order / UID verification" : "Order / UID doğrulama",
      secSafeFlow: en ? "Secure order flow" : "Güvenli sipariş akışı",

      sideNote: en
        ? "At the payment step, the order flow is handled securely. Card payments redirect to the provider; bank transfer creates a reference code."
        : "Ödeme adımında sipariş akışı güvenli şekilde yürütülür. Kart ödemede sağlayıcıya yönlendirilirsin, havalede ise referans kodu üretilir.",

      cardInfoStrip: en
        ? "HTTPS • Tokenized flow • Provider redirect • Duplicate charge protection"
        : "HTTPS • Tokenized akış • Provider yönlendirmesi • Çift çekim koruması",
      eftInfoStrip: en
        ? "Order is created • Reference is generated • Transfer is completed afterwards"
        : "Sipariş oluşturulur • Referans üretilir • Sonra havale tamamlanır",

      tracking: en ? "Order tracking" : "Sipariş takibi",
      shop: en ? "Shop" : "Mağaza",
      productAlt: en ? "Product" : "Ürün",
    };
  }, [loc]);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);

      if (!u || u.isAnonymous) {
        setIsAdminUser(false);
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(u, true);
        const claims = tokenResult.claims as Record<string, unknown>;

        const roles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];
        const role = String(claims.role || "").trim();

        const adminLike =
          claims.admin === true ||
          role === "admin" ||
          role === "sub_admin" ||
          roles.includes("admin") ||
          roles.includes("sub_admin");

        setIsAdminUser(adminLike);
      } catch (e) {
        console.error("admin claim read error:", e);
        setIsAdminUser(false);
      }
    });

    return () => unsub();
  }, [auth]);
useEffect(() => {
  if (typeof window === "undefined") return;
  if (!agreementModal) return;

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  const html = document.documentElement;

  const prevBodyStyle = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    touchAction: body.style.touchAction,
  };

  const prevHtmlStyle = {
    overflow: html.style.overflow,
    overscrollBehavior: html.style.overscrollBehavior,
  };

  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.touchAction = "none";

  return () => {
    html.style.overflow = prevHtmlStyle.overflow;
    html.style.overscrollBehavior = prevHtmlStyle.overscrollBehavior;

    body.style.position = prevBodyStyle.position;
    body.style.top = prevBodyStyle.top;
    body.style.left = prevBodyStyle.left;
    body.style.right = prevBodyStyle.right;
    body.style.width = prevBodyStyle.width;
    body.style.overflow = prevBodyStyle.overflow;
    body.style.touchAction = prevBodyStyle.touchAction;

    window.scrollTo(0, scrollY);
  };
}, [agreementModal]);
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setPaymentSettingsLoading(true);

        const snap = await getDoc(doc(db, "settings", "payment"));
        if (!alive) return;

        setPaymentSettings(snap.exists() ? (snap.data() as PaymentSettingsDoc) : null);
      } catch (e) {
        console.error("payment settings read error:", e);
        if (!alive) return;
        setPaymentSettings(null);
      } finally {
        if (alive) setPaymentSettingsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? sessionStorage.getItem(DRAFT_KEY) : null;

      if (!raw) {
        setErr(t.noDraftLong);
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(raw) as CheckoutDraft;
      setDraft(parsed);
      setLoading(false);
    } catch (error) {
      console.error("checkout draft read error:", error);
      setErr(t.draftReadFailed);
      setLoading(false);
    }
  }, [t.noDraftLong, t.draftReadFailed]);

  const previewRef = useMemo(() => {
    return `PRE-${Date.now().toString().slice(-6)}`;
  }, []);

  const totalTry = Number(draft?.clientQuote?.totalTry ?? 0);
  const shippingAddress = draft?.shippingAddress;
const giftPackageInfo = useMemo(() => {
  return resolveGiftPackageFromDraft(draft);
}, [draft]);
const productTexts = useMemo(() => {
  return resolveProductTextsFromDraft(draft);
}, [draft]);

const productCustomText = useMemo(() => {
  return resolveProductCustomTextFromDraft(draft);
}, [draft]);
  const invoiceType =
    shippingAddress?.invoiceType === "company" ? "company" : "individual";

  const companyName = safeStr(shippingAddress?.companyName);
  const taxNumber = safeStr(shippingAddress?.taxNumber);
  const taxOffice = safeStr(shippingAddress?.taxOffice);
  const nationalId = safeStr(shippingAddress?.nationalId);

const previewItems = useMemo(() => {
  const quoteItems = Array.isArray(draft?.clientQuote?.items)
    ? draft.clientQuote.items
    : [];

  const draftItems = Array.isArray(draft?.items) ? draft.items : [];

  if (quoteItems.length) {
    return quoteItems.map((q: any) => {
      const matchingDraftItem = draftItems.find((d: any) => {
        const qProductId = safeStr(q?.productId);
        const qSlug = safeStr(q?.slug);
        const dProductId = safeStr(d?.productId);
        const dSlug = safeStr(d?.slug);

        return (
          (qProductId && qProductId === dProductId) ||
          (qSlug && qSlug === dSlug)
        );
      });

      const qty = Math.max(
        1,
        safeNumber(q?.qty ?? matchingDraftItem?.qty, 1)
      );

      const unitPriceTry = resolvePreviewUnitPrice(q, matchingDraftItem, qty);

      return {
        ...matchingDraftItem,
        ...q,
        qty,
        unitPriceTry,
        customText:
  safeStr((q as any)?.customText) ||
  safeStr((q as any)?.productCustomText) ||
  safeStr((q as any)?.engravingText) ||
  safeStr((matchingDraftItem as any)?.customText) ||
  safeStr((matchingDraftItem as any)?.productCustomText) ||
  safeStr((matchingDraftItem as any)?.engravingText),

productCustomText:
  safeStr((q as any)?.productCustomText) ||
  safeStr((q as any)?.customText) ||
  safeStr((q as any)?.engravingText) ||
  safeStr((matchingDraftItem as any)?.productCustomText) ||
  safeStr((matchingDraftItem as any)?.customText) ||
  safeStr((matchingDraftItem as any)?.engravingText),

engravingText:
  safeStr((q as any)?.engravingText) ||
  safeStr((q as any)?.productCustomText) ||
  safeStr((q as any)?.customText) ||
  safeStr((matchingDraftItem as any)?.engravingText) ||
  safeStr((matchingDraftItem as any)?.productCustomText) ||
  safeStr((matchingDraftItem as any)?.customText),
        image: safeStr(q?.image) || safeStr(matchingDraftItem?.image),
        title: q?.title || matchingDraftItem?.title,
        selectedSize:
          safeStr(q?.selectedSize) || safeStr(matchingDraftItem?.selectedSize),
        selectedVariants:
          q?.selectedVariants || matchingDraftItem?.selectedVariants || null,
        selectedVariantItems: Array.isArray(q?.selectedVariantItems)
          ? q.selectedVariantItems
          : Array.isArray(matchingDraftItem?.selectedVariantItems)
          ? matchingDraftItem.selectedVariantItems
          : [],
      };
    });
  }

  return draftItems.map((it: any) => {
    const qty = Math.max(1, safeNumber(it?.qty, 1));
    const unitPriceTry = resolvePreviewUnitPrice(it, null, qty);

    return {
      ...it,
      qty,
      unitPriceTry,
      customText:
  safeStr((it as any)?.customText) ||
  safeStr((it as any)?.productCustomText) ||
  safeStr((it as any)?.engravingText),

productCustomText:
  safeStr((it as any)?.productCustomText) ||
  safeStr((it as any)?.customText) ||
  safeStr((it as any)?.engravingText),

engravingText:
  safeStr((it as any)?.engravingText) ||
  safeStr((it as any)?.productCustomText) ||
  safeStr((it as any)?.customText),
      image: safeStr(it?.image),
      title: it?.title,
      selectedSize: safeStr(it?.selectedSize),
      selectedVariants: it?.selectedVariants || null,
      selectedVariantItems: Array.isArray(it?.selectedVariantItems)
        ? it.selectedVariantItems
        : [],
    };
  });
}, [draft]);

const itemCount = previewItems.reduce(
  (sum: number, it: any) => sum + Math.max(1, Number(it?.qty || 1)),
  0
);

  const cardSettings = paymentSettings?.card || {};
  const cardProvider = safeStr(cardSettings.provider) || "none";

  const cardPublicActive = cardSettings.isActive !== false && cardProvider === "paytr";
  const cardAdminPreviewEnabled = cardSettings.adminPreviewEnabled !== false;

  const canUseCard =
    cardPublicActive ||
    (isAdminUser && cardAdminPreviewEnabled && cardProvider === "paytr");

  const cardBlockedForPublic = !cardPublicActive && !isAdminUser;
  const cardBlockedForEveryone = cardProvider !== "paytr";

  const cardHintText = cardBlockedForEveryone
    ? t.cardNotConfigured
    : cardBlockedForPublic
      ? t.cardClosedPublic
      : isAdminUser && !cardPublicActive
        ? t.cardAdminPreview
        : t.cardHint;

  const bankSettings = paymentSettings?.bankTransfer || {};
  const bankPublicActive = bankSettings.isActive !== false;
  const bankAdminPreviewEnabled = bankSettings.adminPreviewEnabled !== false;

  const canUseBankTransfer =
    bankPublicActive || (isAdminUser && bankAdminPreviewEnabled);

  const bankBlockedForPublic = !bankPublicActive && !isAdminUser;

  const bankHintText = bankBlockedForPublic
    ? t.bankClosedPublic
    : isAdminUser && !bankPublicActive
      ? t.bankAdminPreview
      : t.eftHint;

  const bank = useMemo(() => {
    const raw = paymentSettings?.bankTransfer || {};

    return {
      isActive: canUseBankTransfer,
      company: safeStr(raw.companyName) || "Dromocob",
      bankName: safeStr(raw.bankName) || t.defaultBankName,
      branch: safeStr(raw.branchName) || t.defaultBranch,
      accountName: safeStr(raw.accountName) || t.defaultAccountHolder,
      account: safeStr(raw.accountNumber) || t.defaultAccount,
      iban: safeStr(raw.iban) || "TR00 0000 0000 0000 0000 0000 00",
      currency: safeStr(raw.currency) || "TRY",
      note: safeStr(raw.note) || t.defaultBankNote,
      supportPhone: safeStr(raw.supportPhone),
      supportWhatsApp: safeStr(raw.supportWhatsApp),
      ref: createdOrderId ? `SIP-${createdOrderId}` : t.afterOrderCreated,
    };
  }, [
    paymentSettings,
    createdOrderId,
    canUseBankTransfer,
    t.defaultBankName,
    t.defaultBranch,
    t.defaultAccountHolder,
    t.defaultAccount,
    t.defaultBankNote,
    t.afterOrderCreated,
  ]);

  const gateError = useMemo(() => {
    if (!uid) return t.loginReq;
    if (!draft && !loading) return t.noDraft;
    return "";
  }, [uid, draft, loading, t.loginReq, t.noDraft]);

  async function ensureTransferOrderCreated() {
    if (createdOrderId) return createdOrderId;
    if (!uid) throw new Error(t.loginReq);
    if (!draft) throw new Error(t.noDraft);

    const items = Array.isArray(draft.items) ? draft.items : [];

    if (!items.length) {
      throw new Error(t.cartDataMissing);
    }

    const createOrderFn = httpsCallable(functions, "createOrderV1");

const res: any = await createOrderFn({
  locale: draft.locale === "en" ? "en" : "tr",
  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  customerProfile: draft.customerProfile || {},
  shippingAddress: draft.shippingAddress || {},
  items: items.map((it: any) => ({
  ...it,
  customText:
    safeStr(it?.customText) ||
    safeStr(it?.productCustomText) ||
    safeStr(it?.engravingText),

  productCustomText:
    safeStr(it?.productCustomText) ||
    safeStr(it?.customText) ||
    safeStr(it?.engravingText),

  engravingText:
    safeStr(it?.engravingText) ||
    safeStr(it?.productCustomText) ||
    safeStr(it?.customText),
})),

  paymentMethod: "transfer",
  paymentProvider: "manual",

  clientQuote: draft.clientQuote || null,
  productTexts,
productCustomText,
  shippingFeeTry: Number(draft.clientQuote?.shippingFeeTry || 0),
  discountTry: Number(draft.clientQuote?.discountTry || 0),

  packaging: giftPackageInfo,
  giftPackage: giftPackageInfo.giftPackage,
  giftWrap: giftPackageInfo.giftWrap,
  giftNote: giftPackageInfo.note || "",
  giftMessage: giftPackageInfo.note || "",
  giftPackageNote: giftPackageInfo.note || "",

  selectedServices: draft.clientQuote?.selectedServices || [],
  serviceTotalTry: Number(draft.clientQuote?.serviceTotalTry || 0),
});

   const newOrderId = String(res?.data?.orderId || "").trim();

if (!newOrderId) {
  throw new Error(t.orderNoMissing);
}

setCreatedOrderId(newOrderId);

try {
  sessionStorage.removeItem(DRAFT_KEY);
} catch {
  //
}

await clearCartEverywhere(uid);
try {
  localStorage.removeItem("nci_product_custom_text_v1");
  localStorage.removeItem("nci_gift_package_note_v1");
  localStorage.removeItem("nci_selected_services_v1");
} catch {
  //
}
window.dispatchEvent(new Event("cart:changed"));
window.dispatchEvent(new Event("storage"));

return newOrderId;
  }

  async function startCardPayment() {
    if (!agreementsAccepted) {
  setErr(t.mustAcceptAgreements);
  return;
}
    if (!canUseCard) {
      setErr(isAdminUser ? t.cardInactive : t.onlineInactive);
      return;
    }

    if (!uid) {
      setErr(t.loginReq);
      return;
    }

    if (!draft) {
      setErr(t.noDraft);
      return;
    }

    if (!Array.isArray(draft.items) || draft.items.length === 0) {
      setErr(t.cartDataMissing);
      return;
    }

    setBusy(true);
    setErr("");

    try {
    const result = await startCardPaymentClient({
  locale: draft.locale === "en" ? "en" : "tr",
  customerProfile: draft.customerProfile ?? {},
  shippingAddress: draft.shippingAddress ?? {},
  items: draft.items.map((it: any) => ({
  productId: String(it.productId || "").trim(),
  slug: String(it.slug || "").trim(),
  qty: Math.max(1, Math.min(99, Math.floor(Number(it.qty || 1)))),
customText:
  safeStr(it?.customText) ||
  safeStr(it?.productCustomText) ||
  safeStr(it?.engravingText),

productCustomText:
  safeStr(it?.productCustomText) ||
  safeStr(it?.customText) ||
  safeStr(it?.engravingText),

engravingText:
  safeStr(it?.engravingText) ||
  safeStr(it?.productCustomText) ||
  safeStr(it?.customText),
  ...(it.variant && typeof it.variant === "object"
    ? { variant: it.variant }
    : {}),

  ...(String(it.selectedSize || "").trim()
    ? { selectedSize: String(it.selectedSize || "").trim() }
    : {}),

  ...(it.selectedVariants && typeof it.selectedVariants === "object"
    ? { selectedVariants: it.selectedVariants }
    : {}),

  ...(Array.isArray(it.selectedVariantItems) && it.selectedVariantItems.length
    ? {
        selectedVariantItems: it.selectedVariantItems
          .map((v: any) => ({
            groupId: String(v?.groupId || "").trim(),
            groupLabel: String(v?.groupLabel || "").trim(),
            value: String(v?.value || "").trim(),
            label: String(v?.label || "").trim(),
            priceDelta: Number(v?.priceDelta || 0),
          }))
          .filter((v: any) => v.groupId || v.label),
      }
    : {}),
})),
  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",

  packaging: giftPackageInfo,
  clientQuote: draft.clientQuote || null,
  productTexts,
productCustomText,
  
});

   sessionStorage.setItem(
  "nci_pending_card_payment_v1",
  JSON.stringify({
    merchantOid: (result as any).merchantOid || "",
    paymentIntentId: (result as any).paymentIntentId || "",
    items: draft.items,
    clientQuote: draft.clientQuote || null,
    packaging: giftPackageInfo,
    productTexts,
productCustomText,
  })
);



      if (result.mode === "redirect") {
        window.location.href = result.redirectUrl;
        return;
      }

      if (result.mode === "form_post") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = result.postUrl;

        for (const [key, value] of Object.entries(result.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
        return;
      }

      throw new Error(t.unsupportedPaymentMode);
    } catch (e: any) {
      console.error("startCardPayment error:", e);
      setErr(e?.message || t.cardStartFailed);
    } finally {
      setBusy(false);
    }
  }

async function createTransferOrder() {

  if (!agreementsAccepted) {

    setErr(t.mustAcceptAgreements);

    return;

  }

  if (!uid) {

    setErr(t.loginReq);

    return;

  }

    if (!draft) {
      setErr(t.noDraft);
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const orderId = await ensureTransferOrderCreated();
      router.push(`/account/orders/${encodeURIComponent(orderId)}`);
    } catch (e: any) {
      console.error("createTransferOrder error:", e);
      setErr(e?.message || t.createError);
    } finally {
      setBusy(false);
    }
  }

  function copyText(key: "iban" | "ref", value: string) {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1400);
  }



  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.kicker}>{t.checkoutKicker}</div>
            <h1 className={s.h1}>{t.title}</h1>
            <p className={s.sub}>{t.subtitle}</p>

            <div className={s.heroBadges}>
              <span className={s.heroBadge}>{t.secure}</span>
              <span className={s.heroBadge}>{t.ssl}</span>
              <span className={s.heroBadge}>{t.secure3d}</span>
            </div>
          </div>

          <div className={s.heroRight}>
            <Link className={s.backBtn} href="/checkout">
              ← {t.back}
            </Link>
          </div>
        </section>

        <CheckoutProgressBar currentStep="payment" />

        {loading || paymentSettingsLoading ? (
          <div className={s.stateCard}>{t.loading}</div>
        ) : gateError ? (
          <div className={s.stateCard}>
            <div className={s.alertBad}>{gateError}</div>

            <div className={s.actionsRow}>
              <Link className={s.btnGhost} href="/login">
                {t.login}
              </Link>

              <Link className={s.btnPrimary} href="/checkout">
                {t.missingDraftAction}
              </Link>
            </div>
          </div>
        ) : (
          <div className={s.grid}>
            <section className={s.left}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div>
                    <div className={s.cardEyebrow}>{t.preview}</div>
                    <div className={s.cardTitle}>{t.order}</div>
                  </div>

                  <div
                    className={`${s.statusPill} ${
                      method === "eft" && createdOrderId ? s.statusOk : s.statusWarn
                    }`}
                  >
                    {method === "eft" && createdOrderId ? t.created : t.notCreated}
                  </div>
                </div>

                {!createdOrderId ? (
  <div className={s.previewNotice}>
    {loc === "en"
      ? "Your order will be confirmed after successful payment."
      : "Siparişin, ödeme başarıyla tamamlandıktan sonra onaylanacaktır."}
  </div>
) : null}

                <div className={s.metaGrid}>
                  <div className={s.metaBox}>
                    <span>ID</span>
                    <b className={s.mono}>{createdOrderId || previewRef}</b>
                  </div>

                  <div className={s.metaBox}>
                    <span>{t.amount}</span>
                    <b className={s.totalStrong}>{fmtTRY(totalTry)}</b>
                  </div>

                  <div className={s.metaBox}>
                    <span>{t.items}</span>
                    <b>{itemCount}</b>
                  </div>
                </div>

                {!!previewItems.length ? (
                  <>
                    <div className={s.sectionMiniTitle}>{t.productPreview}</div>

                    <div className={s.productList}>
                      {previewItems.map((it, i) => {
                     const qty = Math.max(1, safeNumber(it.qty, 1));
const unit = Math.max(0, safeNumber(it.unitPriceTry, 0));
const line = unit * qty;

                        return (
                          <div key={`${it.productId}-${i}`} className={s.productRow}>
                            <div className={s.productImageWrap}>
                              <img
                                src={safeImage(it.image)}
                                alt={pickText(it.title, loc) || t.productAlt}
                                className={s.productImage}
                                loading="lazy"
                              />
                            </div>

                            <div className={s.productMain}>
                              <div className={s.productName}>
                                {pickText(it.title, loc) || t.productAlt}
                              </div>

                              <div className={s.productMeta}>
                                <span>
                                  {t.qty}: {qty}
                                </span>
                                {safeStr(it.slug) ? <span>{safeStr(it.slug)}</span> : null}
                              </div>
                              {safeStr((it as any).selectedSize) ? (
  <div className={s.productMeta}>
    <span>
      {loc === "en" ? "Ring Size" : "Yüzük Ölçüsü"}:{" "}
      {safeStr((it as any).selectedSize)}
    </span>
  </div>
) : null}

{Array.isArray((it as any).selectedVariantItems) &&
(it as any).selectedVariantItems.length ? (
  <div className={s.productMeta}>
    {(it as any).selectedVariantItems
      .filter((v: any) => safeStr(v?.groupId) !== "ring_size")
      .map((v: any) => (
        <span key={`${safeStr(v?.groupId)}_${safeStr(v?.value)}`}>
          {safeStr(v?.groupLabel)}: {safeStr(v?.label)}
        </span>
      ))}
  </div>
) : null}
{safeStr((it as any).customText || (it as any).productCustomText || (it as any).engravingText) ? (
  <div className={s.productMeta}>
    <span>
      {loc === "en" ? "Product text" : "Ürün Yazısı"}:{" "}
      {safeStr((it as any).customText || (it as any).productCustomText || (it as any).engravingText)}
    </span>
  </div>
) : null}
                            </div>

                            <div className={s.productPrice}>{fmtTRY(line)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                <div className={s.hr} />

                <div className={s.sectionTitle}>{t.method}</div>

                <div className={s.methodGrid}>
                  <button
                    type="button"
                    className={`${s.methodCard} ${
                      method === "card" ? s.methodOn : ""
                    } ${!canUseCard ? s.methodDisabled : ""}`}
                    onClick={() => {
                      if (!canUseCard) return;
                      setMethod("card");
                    }}
                    disabled={!canUseCard}
                  >
                    <div className={s.methodIcon}>💳</div>
                    <div className={s.methodName}>{t.card}</div>
                    <div className={s.methodDesc}>{cardHintText}</div>
                  </button>

                  <button
                    type="button"
                    className={`${s.methodCard} ${
                      method === "eft" ? s.methodOn : ""
                    } ${!bank.isActive ? s.methodDisabled : ""}`}
                    onClick={() => {
                      if (!bank.isActive) return;
                      setMethod("eft");
                    }}
                    disabled={!bank.isActive}
                  >
                    <div className={s.methodIcon}>🏦</div>
                    <div className={s.methodName}>{t.eft}</div>
                    <div className={s.methodDesc}>
                      {bank.isActive ? bankHintText : t.bankInactive}
                    </div>
                  </button>
                </div>

                {err ? <div className={s.alertBad}>{err}</div> : null}
              </div>

              {method === "card" ? (
                <div className={s.card}>
                  <div className={s.bigTitle}>{t.cardBlockTitle}</div>
                  <p className={s.text}>{t.cardBlockText}</p>
<AgreementBox
  t={t}
  acceptedSalesContract={acceptedSalesContract}
  acceptedPreInfo={acceptedPreInfo}
  setAcceptedSalesContract={setAcceptedSalesContract}
  setAcceptedPreInfo={setAcceptedPreInfo}
  setAgreementModal={setAgreementModal}
/>
          <button
  type="button"
  id="fb-pay-card-btn"
  data-fb="Purchase"
  className={`${s.payBtn} ${!agreementsAccepted ? s.payBtnNeedAgreement : ""}`}
  onClick={startCardPayment}
  disabled={busy || !canUseCard}
>
  {busy ? t.redirecting : t.startCard}
</button>

                  {!canUseCard ? (
                    <div className={s.alertBad}>
                      {isAdminUser ? t.cardBlockedAdmin : t.onlineInactive}
                    </div>
                  ) : null}

                  <div className={s.infoStrip}>{t.cardInfoStrip}</div>
                </div>
              ) : (
                <div className={s.card}>
                  <div className={s.bigTitle}>{t.bankTitle}</div>
                  <p className={s.text}>{t.bankNote}</p>

                  <div className={s.bankBox}>
                    <div className={s.bankRow}>
                      <span>{t.receiver}</span>
                      <b>{bank.company}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.bank}</span>
                      <b>{bank.bankName}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.branch}</span>
                      <b>{bank.branch}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.accountHolder}</span>
                      <b>{bank.accountName}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.account}</span>
                      <b>{bank.account}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.currency}</span>
                      <b>{bank.currency}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>IBAN</span>
                      <b className={s.mono}>{bank.iban}</b>
                      <button
                        className={s.copyBtn}
                        type="button"
                        onClick={() => copyText("iban", bank.iban)}
                      >
                        {copiedKey === "iban" ? t.copied : t.copy}
                      </button>
                    </div>

                    <div className={s.bankRow}>
                      <span>{t.reference}</span>
                      <b className={s.mono}>{bank.ref}</b>
                      <button
                        className={s.copyBtn}
                        type="button"
                        onClick={() => copyText("ref", bank.ref)}
                        disabled={!createdOrderId}
                      >
                        {copiedKey === "ref" ? t.copied : t.copy}
                      </button>
                    </div>
                  </div>

                  {bank.note ? <div className={s.bankNoteBox}>{bank.note}</div> : null}

                  {bank.supportPhone || bank.supportWhatsApp ? (
                    <div className={s.supportMiniBox}>
                      {bank.supportPhone ? (
                        <div className={s.supportMiniRow}>
                          <span>{t.supportPhone}</span>
                          <b>{bank.supportPhone}</b>
                        </div>
                      ) : null}

                      {bank.supportWhatsApp ? (
                        <div className={s.supportMiniRow}>
                          <span>{t.whatsapp}</span>
                          <b>{bank.supportWhatsApp}</b>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
<AgreementBox
  t={t}
  acceptedSalesContract={acceptedSalesContract}
  acceptedPreInfo={acceptedPreInfo}
  setAcceptedSalesContract={setAcceptedSalesContract}
  setAcceptedPreInfo={setAcceptedPreInfo}
  setAgreementModal={setAgreementModal}
/>
     <button
  type="button"
  id="fb-pay-eft-btn"
  data-fb="Purchase"
  className={`${s.payBtn} ${!agreementsAccepted ? s.payBtnNeedAgreement : ""}`}
  onClick={createTransferOrder}
  disabled={busy || !bank.isActive}
>
  {busy ? t.creating : t.startEft}
</button>

                  {!bank.isActive ? (
                    <div className={s.alertBad}>
                      {isAdminUser ? t.bankBlockedAdmin : t.bankInactive}
                    </div>
                  ) : isAdminUser && !bankPublicActive ? (
                    <div className={s.previewNotice}>{t.bankAdminPreview}</div>
                  ) : null}

                  <div className={s.infoStrip}>{t.eftInfoStrip}</div>
                </div>
              )}
            </section>

            <aside className={s.right}>
              <div className={`${s.card} ${s.sticky} ${s.sideCard}`}>
                <div className={s.sideTop}>
                  <div>
                    <div className={s.sideEyebrow}>{t.checkoutKicker}</div>
                    <div className={s.sideTitle}>{t.summary}</div>
                  </div>

                  <div
                    className={`${s.sideStatusPill} ${
                      createdOrderId ? s.sideStatusOk : s.sideStatusWarn
                    }`}
                  >
                    {createdOrderId ? t.created : t.notCreated}
                  </div>
                </div>

                <div className={s.summaryHero}>
                  <span className={s.summaryHeroLabel}>{t.amount}</span>
                  <strong className={s.summaryHeroValue}>{fmtTRY(totalTry)}</strong>
                </div>

                {method === "eft" && createdOrderId ? (
                  <div className={s.orderMiniBox}>
                    <span>{t.orderNo}</span>
                    <b className={s.mono}>{createdOrderId}</b>
                  </div>
                ) : (
                  <div className={s.orderMiniBox}>
  <span>{t.status}</span>
  <b>{loc === "en" ? "Awaiting secure payment" : "Güvenli ödeme bekleniyor"}</b>
</div>
                )}

                <div className={s.hr} />

                <div className={s.sideSection}>
                  <div className={s.sideSectionTitle}>{t.deliveryInfo}</div>

                  <div className={s.sideInfoItem}>
                    <span>{t.invoiceType}</span>
                    <b>{invoiceType === "company" ? t.company : t.individual}</b>
                  </div>

                  {invoiceType === "individual" ? (
                    <div className={s.sideInfoItem}>
                      <span>{t.nationalId}</span>
                      <b>{nationalId || "—"}</b>
                    </div>
                  ) : (
                    <>
                      <div className={s.sideInfoItem}>
                        <span>{t.companyName}</span>
                        <b>{companyName || "—"}</b>
                      </div>

                      <div className={s.sideInfoItem}>
                        <span>{t.taxNumber}</span>
                        <b>{taxNumber || "—"}</b>
                      </div>

                      <div className={s.sideInfoItem}>
                        <span>{t.taxOffice}</span>
                        <b>{taxOffice || "—"}</b>
                      </div>
                    </>
                  )}

                  <div className={s.sideInfoGrid}>
                    <div className={s.sideInfoItem}>
                      <span>{t.receiver}</span>
                      <b>{safeStr(shippingAddress?.fullName) || "—"}</b>
                    </div>

                    <div className={s.sideInfoItem}>
                      <span>{t.phone}</span>
                      <b>{safeStr(shippingAddress?.phone) || "—"}</b>
                    </div>

                    <div className={s.sideInfoItem}>
                      <span>{t.address}</span>
                      <b>{normalizeAddressParts(shippingAddress)}</b>
                    </div>
                  </div>
                </div>

                <div className={s.hr} />
{productTexts.length ? (
  <>
    <div className={s.hr} />

    <div className={s.sideSection}>
      <div className={s.sideSectionTitle}>
        {loc === "en" ? "Product Texts" : "Ürün Yazıları"}
      </div>

      <div className={s.sideInfoGrid}>
        {productTexts.map((x: any, index: number) => (
          <div key={`${x.productKey || x.productId || x.slug || index}`} className={s.sideInfoItem}>
            <span>
              {safeStr(x.label) ||
                (loc === "en" ? "Text to be written" : "Yazılacak metin")}
            </span>
            <b>{safeStr(x.text) || "—"}</b>
          </div>
        ))}
      </div>
    </div>
  </>
) : null}
                <div className={s.secBox}>
                  <div className={s.secTitle}>{t.security}</div>

                  <ul className={s.secList}>
                    <li>{t.secNoCardStore}</li>
                    <li>{t.secProviderRedirect}</li>
                    <li>{t.secOrderUid}</li>
                    <li>{t.secSafeFlow}</li>
                  </ul>
                </div>

                <div className={s.sideNote}>{t.sideNote}</div>

                <div className={s.actionsRow}>
                  <Link className={s.btnGhost} href="/shop">
                    {t.shop}
                  </Link>

                  {createdOrderId ? (
                    <Link
                      className={s.btnPrimary}
                      href={`/account/orders/${encodeURIComponent(createdOrderId)}`}
                    >
                      {t.tracking}
                    </Link>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
      <AgreementModal
  type={agreementModal}
  t={t}
  onClose={() => setAgreementModal("")}
/>
    </main>
  );
}
function AgreementBox({
  t,
  acceptedSalesContract,
  acceptedPreInfo,
  setAcceptedSalesContract,
  setAcceptedPreInfo,
  setAgreementModal,
}: {
  t: any;
  acceptedSalesContract: boolean;
  acceptedPreInfo: boolean;
  setAcceptedSalesContract: (v: boolean) => void;
  setAcceptedPreInfo: (v: boolean) => void;
  setAgreementModal: (v: "" | "sales" | "preinfo") => void;
}) {
  return (
    <div className={s.agreementBox}>
      <div className={s.agreementTitle}>{t.agreementsTitle}</div>

      <label className={s.agreementRow}>
        <input
          type="checkbox"
          checked={acceptedSalesContract}
          onChange={(e) => setAcceptedSalesContract(e.target.checked)}
        />

        <span>
          <button
            type="button"
            className={s.agreementLink}
            onClick={() => setAgreementModal("sales")}
          >
            {t.salesContract}
          </button>{" "}
          {t.readAndAccept}
        </span>
      </label>

      <label className={s.agreementRow}>
        <input
          type="checkbox"
          checked={acceptedPreInfo}
          onChange={(e) => setAcceptedPreInfo(e.target.checked)}
        />

        <span>
          <button
            type="button"
            className={s.agreementLink}
            onClick={() => setAgreementModal("preinfo")}
          >
            {t.preInfoForm}
          </button>{" "}
          {t.readAndAccept}
        </span>
      </label>

      <div style={{
        marginTop: 8,
        padding: "10px 12px",
        fontSize: "11.5px",
        lineHeight: 1.55,
        color: "rgba(11,15,25,0.5)",
        background: "rgba(11,15,25,0.025)",
        borderRadius: 8,
        border: "1px solid rgba(11,15,25,0.06)",
      }}>
        Siparişinizi tamamlayarak kişisel verilerinizin sipariş, ödeme, kargo ve yasal
        süreçler kapsamında işleneceğini; reklam ölçümleme ve dönüşüm eşleştirme amacıyla
        e-posta, telefon ve ad-soyad bilgilerinizin şifrelenmiş (hash) hâlde Google ve Meta
        gibi platformlara aktarılabileceğini kabul etmiş olursunuz.{" "}
        <a href="/kvkk-aydinlatma-metni" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "2px" }}>
          KVKK Aydınlatma Metni
        </a>{" "}
        •{" "}
        <a href="/gizlilik-politikasi" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "2px" }}>
          Gizlilik Politikası
        </a>{" "}
        •{" "}
        <a href="/cerez-politikasi" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "2px" }}>
          Çerez Politikası
        </a>
      </div>
    </div>
  );
}

function AgreementModal({
  type,
  t,
  onClose,
}: {
  type: "" | "sales" | "preinfo";
  t: any;
  onClose: () => void;
}) {
  if (!type) return null;

  const isSales = type === "sales";

  return (
    <div className={s.agreementModalBackdrop} onClick={onClose}>
      <div className={s.agreementModal} onClick={(e) => e.stopPropagation()}>
        <div className={s.agreementModalHead}>
          <h2>{isSales ? t.salesContract : t.preInfoForm}</h2>

          <button type="button" onClick={onClose} className={s.agreementModalClose}>
            ✕
          </button>
        </div>

       <div className={s.agreementModalBody}>

  {isSales ? (

    <>

      <p>

        İşbu Mesafeli Satış Sözleşmesi, BİZİM 6 e-ticaret İNŞAAT EMLAK SANAYİ

        TİCARET LİMİTED ŞİRKETİ ile ALICI arasında, Dromocob internet

        sitesi üzerinden elektronik ortamda verilen siparişe ilişkin tarafların

        hak ve yükümlülüklerini düzenlemek amacıyla hazırlanmıştır.

      </p>

      <p>

        SATICI bilgileri: BİZİM 6 e-ticaret İNŞAAT EMLAK SANAYİ TİCARET LİMİTED

        ŞİRKETİ. Adres: İstanbul · Demo Showroom.

        E-posta: info@dromocob.tr.

      </p>

      <p>

        ALICI, siparişini onaylamadan önce ürün adı, ürün adedi, ürün özellikleri,

        varsa gram/ayar bilgisi, satış fiyatı, ek hizmetler, indirimler, kargo

        bilgileri, teslimat adresi, fatura bilgileri ve toplam ödeme tutarını

        kontrol ettiğini kabul eder.

      </p>

      <p>

        Sipariş konusu ürünlerin fiyatı, ödeme ekranında gösterilen nihai tutardır.

        Canlı kura veya değerli maden fiyatlarına bağlı ürünlerde fiyat, sipariş

        onayı ve ödeme anındaki sistem verilerine göre hesaplanır. Sipariş

        tamamlandıktan sonra kur, altın, döviz veya piyasa değişimleri geçmiş

        sipariş bedelini geriye dönük olarak değiştirmez.

      </p>

      <p>

        Ödeme; kredi/banka kartı, havale/EFT veya sistemde aktif olan diğer ödeme

        yöntemleriyle yapılabilir. Kartlı ödemelerde işlem, güvenli ödeme altyapısı

        üzerinden gerçekleştirilir. Havale/EFT siparişlerinde ödeme açıklamasında

        sipariş numarasının belirtilmesi önerilir.

      </p>

      <p>

        Teslimat, sipariş sırasında belirtilen adrese yapılır. Kargo süreci,

        siparişin ödeme onayı, stok uygunluğu ve ürün hazırlık sürecine bağlı olarak

        başlatılır. Teslimat sırasında paket üzerinde hasar, ezilme veya şüpheli bir

        durum görülürse ALICI’nın kargo görevlisi huzurunda tutanak tutturması

        önerilir.

      </p>

      <p>

        ALICI, mevzuatta öngörülen hallerde ürünün tesliminden itibaren 14 gün

        içinde cayma hakkını kullanabilir. Ancak fiyatı finansal piyasalardaki

        dalgalanmalara bağlı olarak değişen altın, ziynet, değerli maden içerikli

        ürünler ile ALICI’nın özel istekleri doğrultusunda hazırlanan, kişiselleştirilen,

        ölçülendirilen veya hijyen/ambalaj bütünlüğü bozulan ürünlerde cayma hakkı

        mevzuattaki istisnalar kapsamında kullanılamayabilir.

      </p>

      <p>

        Cayma hakkı istisnası, ayıplı, hatalı veya siparişe aykırı gönderilen ürünler

        bakımından tüketicinin yasal haklarını ortadan kaldırmaz. Üründe üretim

        kaynaklı hata, yanlış ürün gönderimi veya teslimat kaynaklı sorun bulunması

        halinde ALICI, destek kanalları üzerinden başvuru yapabilir.

      </p>

      <p>

        İade/değişim süreçlerinde ürünün kullanılmamış, hasar görmemiş, tüm aksesuar,

        sertifika, fatura, kutu ve ambalaj unsurlarıyla birlikte gönderilmesi gerekir.

        İade talebi onaylandığında, ALICI’ya iade süreci ve kargo yönlendirmesi

        sistem üzerinden veya destek kanalları aracılığıyla bildirilir.

      </p>

      <p>

        ALICI, siparişi tamamlayarak bu Mesafeli Satış Sözleşmesi’ni, Ön

        Bilgilendirme Formu’nu, ürün/fiyat/teslimat/iade koşullarını okuduğunu,

        anladığını ve elektronik ortamda kabul ettiğini beyan eder.

      </p>

    </>

  ) : (

    <>

      <p>

        Bu Ön Bilgilendirme Formu, Dromocob internet sitesi üzerinden

        sipariş verilmeden önce ALICI’nın ürün, satıcı, ödeme, teslimat, iade,

        cayma hakkı ve başvuru yolları hakkında açık şekilde bilgilendirilmesi

        amacıyla hazırlanmıştır.

      </p>

      <p>

        SATICI bilgileri: BİZİM 6 e-ticaret İNŞAAT EMLAK SANAYİ TİCARET LİMİTED

        ŞİRKETİ. Adres: İstanbul · Demo Showroom.

        E-posta: info@dromocob.tr.

      </p>

      <p>

        Siparişe konu ürünün temel nitelikleri, ürün adı, görselleri, varsa SKU,

        gram, ayar, ölçü, varyant, stok durumu, satış fiyatı ve toplam ödeme tutarı

        ürün sayfasında, sepet ekranında ve ödeme ekranında ALICI’ya gösterilir.

      </p>

      <p>

        Ürün bedeli, kargo ücreti, varsa ek hizmetler, kampanya/indirim tutarı ve

        toplam ödeme bedeli ödeme ekranında ayrı ayrı belirtilir. ALICI, ödeme

        işlemine devam etmeden önce bu bilgileri kontrol etmekle yükümlüdür.

      </p>

      <p>

        Dromocob’ta bazı ürünlerin fiyatı canlı altın/değerli maden kuru

        veya piyasa verilerine göre hesaplanabilir. Bu tür ürünlerde ödeme ekranında

        gösterilen tutar, sipariş onayı anındaki nihai bedeldir. Kur değişimleri,

        ödeme sonrası tamamlanmış siparişe geriye dönük fiyat farkı oluşturmaz.

      </p>

      <p>

        Teslimat, ALICI’nın sipariş sırasında belirttiği adrese yapılır. Teslimat

        süresi; ödeme onayı, stok durumu, ürün hazırlık süreci, kargo operasyonu

        ve mücbir sebeplere göre değişebilir. Kargo takip bilgisi oluştuğunda

        sipariş ekranında veya bildirim kanalları üzerinden paylaşılabilir.

      </p>

      <p>

        ALICI, mevzuatta öngörülen hallerde ürünün tesliminden itibaren 14 gün

        içinde cayma hakkına sahip olabilir. Ancak fiyatı finansal piyasalardaki

        dalgalanmalara bağlı olarak değişen altın, ziynet ve değerli maden içerikli

        ürünler; özel ölçü, kişiselleştirme veya kullanıcı talebine göre hazırlanan

        ürünler; ambalaj, hijyen veya güvenlik bütünlüğü bozulan ürünler bakımından

        cayma hakkı istisnaları uygulanabilir.

      </p>

      <p>

        Ayıplı, hasarlı, eksik veya siparişe aykırı ürünlerde ALICI’nın kanuni

        hakları saklıdır. Böyle bir durumda ALICI, ürün tesliminden sonra makul süre

        içinde destek kanalları üzerinden başvuru yapmalı; mümkünse ürün, paket ve

        kargo durumunu gösteren görselleri başvurusuna eklemelidir.

      </p>

      <p>

        İade talebinin onaylanması halinde ürünün kullanılmamış, zarar görmemiş,

        sertifika, fatura, kutu ve tüm tamamlayıcı unsurlarıyla birlikte iade

        edilmesi gerekir. İade kargo süreci ve gönderim adresi, onay sonrası ALICI’ya

        ayrıca bildirilir.

      </p>

      <p>

        ALICI, ödeme adımına geçerek bu Ön Bilgilendirme Formu’nu okuduğunu,

        siparişe ilişkin temel nitelikler, toplam fiyat, teslimat, cayma hakkı,

        iade koşulları ve satıcı bilgileri hakkında bilgilendirildiğini kabul eder.

      </p>

    </>

  )}

</div>

        <button type="button" className={s.agreementModalBtn} onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}