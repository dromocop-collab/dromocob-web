"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { signInWithCustomToken, sendPasswordResetEmail } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb, getFirebaseAuth } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import { getCart, mergeGuestCartToUser, type CartItem as LocalCartItem } from "@/lib/cart";
import { fmtTRY, type Address } from "@/lib/orders";
import CheckoutRow from "./components/CheckoutRow";
import CheckoutToast from "./components/CheckoutToast";
import CheckoutHero from "./components/CheckoutHero";
import GuestCheckoutModal from "./components/GuestCheckoutModal";
import {
  calcCampaignDiscount,
  normalizeCampaigns,
  pickCampaignText,
  type StoreCampaign,
} from "@/lib/campaigns";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import CheckoutProgressBar from "@/components/CheckoutProgressBar";
import { runCartExpiryCheck } from "@/lib/cartExpiry";
import s from "./checkout.module.css";

type CheckoutCartItem = {
  id?: string;
  productId: string;
  title?: { tr?: string; en?: string };
  qty: number;
  unitPrice?: number;

  lockedUnitPriceTry?: number;
  resolvedUnitPrice?: number;
  unitPriceTry?: number;
  priceTry?: number;
  finalPrice?: number;
  price?: number;

  image?: string;
  slug?: string;
  sku?: string;
  selectedSize?: string;
  variant?: Record<string, string>;
  selectedVariants?: Record<string, string>;
  selectedVariantItems?: Array<{
    groupId: string;
    groupLabel: string;
    value: string;
    label: string;
    priceDelta?: number;
    hasGram?: number;
    weightGram?: number;
  }>;
};

type UserAddressDoc = {
  title?: string;

  invoiceType?: "individual" | "company";

  firstName?: string;
  lastName?: string;
  phone?: string;

  nationalId?: string;

  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;

  line1?: string;
  line2?: string;
  cityName?: string;
  districtName?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  note?: string;

  fullName?: string;
  city?: string;
  district?: string;
  addressLine?: string;
};

type UiAddr = {
  id: string;
  title: string;

  invoiceType: "individual" | "company";

  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;

  nationalId: string;

  companyName: string;
  taxNumber: string;
  taxOffice: string;

  city: string;
  district: string;
  addressLine: string;
  postalCode: string;
  note: string;
  isDefault: boolean;
};

type TimerState = { nextAt: number; total: number };

const TIMER_KEY = "nci_cart_timer_v1";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toNum(v: any, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function pickTitle(it: CheckoutCartItem) {
  return {
    tr: String(it.title?.tr || "Ürün").trim(),
    en: String(it.title?.en || "Product").trim(),
  };
}

function getCategoryPricingFromProduct(product: any) {
  const raw = product?.categoryPricing || product?.resolvedCategoryPricing || null;
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

function getCategoryPricingForProduct(
  product: any,
  catPricingMap: Record<string, any>
) {
  const direct = getCategoryPricingFromProduct(product);
  if (direct) return direct;

  const catIds = extractCategoryIdsFromProduct(product);

  for (const key of catIds) {
    const pricing = catPricingMap[key];
    if (pricing && typeof pricing === "object") return pricing;
  }

  return null;
}

function extractCategoryIdsFromProduct(p: any): string[] {
  const raw = p?.categoryIds ?? p?.categories ?? p?.categoryId ?? [];

  if (typeof raw === "string") {
    return raw.trim() ? [raw.trim()] : [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x?.id ?? x ?? "").trim())
      .filter(Boolean);
  }

  if (raw && typeof raw === "object") {
    return Object.values(raw)
      .map((x: any) => String(x?.id ?? x ?? "").trim())
      .filter(Boolean);
  }

  return [];
}

function productMapKey(item: { productId?: string; slug?: string; sku?: string }) {
  return String(item?.productId || item?.slug || item?.sku || "").trim();
}

function getProductFromMap(productMap: Record<string, any>, item: any) {
  const keys = [
    item?.productId,
    item?.id,
    item?.slug,
    item?.productSlug,
    item?.sku,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  for (const key of keys) {
    if (productMap[key]) return productMap[key];
  }

  return null;
}

function addProductAliases(
  target: Record<string, any>,
  lookupKey: string,
  product: any
) {
  if (!product) return;

  const cleanProduct = {
    ...product,
    id: String(product?.id || lookupKey || "").trim(),
  };

  const keys = [
    lookupKey,
    cleanProduct.id,
    cleanProduct.slug,
    cleanProduct.sku,
    cleanProduct.productId,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  for (const key of keys) {
    target[key] = cleanProduct;
  }
}

function loadTimer(total: number): TimerState {
  const t = nowSec();

  try {
    const raw = localStorage.getItem(TIMER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<TimerState>) : null;
    const storedNextAt = Number(parsed?.nextAt ?? 0);
    const storedTotal = Number(parsed?.total ?? 0);

    if (!Number.isFinite(storedTotal) || storedTotal !== total) {
      const st = { nextAt: t + total, total };
      localStorage.setItem(TIMER_KEY, JSON.stringify(st));
      return st;
    }

    if (Number.isFinite(storedNextAt) && storedNextAt > t) {
      return { nextAt: storedNextAt, total };
    }

    const st = { nextAt: t + total, total };
    localStorage.setItem(TIMER_KEY, JSON.stringify(st));
    return st;
  } catch {
    return { nextAt: t + total, total };
  }
}
const FALLBACK_IMG = "/dromocob-mark.svg";

function pickOrderItemImage(it: any, productMap: Record<string, any>) {
  const fromCart = String(it?.image || "").trim();
  if (fromCart) return fromCart;

  const p = getProductFromMap(productMap, it) || null;
  const fromProduct =
    String(
      p?.image ||
      p?.mainImage ||
      p?.cover ||
      p?.thumbnail ||
      (Array.isArray(p?.images) ? p.images[0] : "") ||
      ""
    ).trim();

  return fromProduct || FALLBACK_IMG;
}
function saveTimer(st: TimerState) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(st));
  } catch {
    //
  }
}
function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}
function compactText(v: any) {
  return safeStr(v)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

function normalizeAddressLine(...parts: any[]) {
  const chunks = parts
    .flatMap((p) => compactText(p).split("/"))
    .map((x) => compactText(x))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];

  for (const chunk of chunks) {
    const key = chunk
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}]+/gu, "");

    if (!key) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(chunk);
  }

  return out.join(" / ");
}
function getProfileTc(profile: any) {
  return (
    safeStr(profile?.tcNo) ||
    safeStr(profile?.tcKimlikNo) ||
    safeStr(profile?.identityNo) ||
    safeStr(profile?.identityNumber) ||
    safeStr(profile?.nationalId)
  );
}

function getProfileBirthDate(profile: any) {
  return (
    safeStr(profile?.birthDate) ||
    safeStr(profile?.dateOfBirth) ||
    safeStr(profile?.dogumTarihi)
  );
}

async function triggerRatesRefreshAndWait(db: any, currentFetchedAt?: string) {
 

  const res = await fetch("/api/rates/refresh", {
    method: "POST",
    cache: "no-store",
  });

  const txt = await res.text().catch(() => "");
  

  if (!res.ok) {
    throw new Error(`rates refresh failed: ${res.status} ${txt}`);
  }

  const started = Date.now();
  const timeoutMs = 15000;

  while (Date.now() - started < timeoutMs) {
    const snap = await getDoc(doc(db, "rates", "latest"));
    const data = snap.exists() ? (snap.data() as any) : null;
    const fetchedAt = String(data?.fetchedAt || "").trim();

    if (fetchedAt && fetchedAt !== String(currentFetchedAt || "").trim()) {
     
      return data;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("rates/latest güncellenmedi veya geç geldi.");
}
function sameJson(a: any, b: any) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
function mapAddrDoc(id: string, a: UserAddressDoc | null | undefined): UiAddr {
  const title = String(a?.title || "Adres").trim();

  const firstName = String(a?.firstName || "").trim();
  const lastName = String(a?.lastName || "").trim();

  const fullName =
    String(a?.fullName || "").trim() ||
    `${firstName} ${lastName}`.trim();

  const phone = String(a?.phone || "").trim();
  const city = String(a?.city || a?.cityName || "").trim();
  const district = String(a?.district || a?.districtName || "").trim();

const addressLine = normalizeAddressLine(

  a?.addressLine,

  a?.line1,

  a?.line2

);

  const postalCode = String(a?.postalCode || "").trim();
  const note = String(a?.note || "").trim();

  const invoiceType =
    String(a?.invoiceType || "").trim() === "company" ? "company" : "individual";

  return {
    id,
    title: title || "Adres",

    invoiceType,

    firstName,
    lastName,
    fullName,
    phone,

    nationalId: String(a?.nationalId || "").trim(),

    companyName: String(a?.companyName || "").trim(),
    taxNumber: String(a?.taxNumber || "").trim(),
    taxOffice: String(a?.taxOffice || "").trim(),

    city,
    district,
    addressLine,
    postalCode,
    note,
    isDefault: Boolean(a?.isDefault),
  };
}
function getRefreshModeFromProduct(
  product: any,
  catPricingMap: Record<string, any>
): "auto" | "manual" {
  const pricing = getCategoryPricingForProduct(product, catPricingMap);
  return String(pricing?.refreshMode || "").toLowerCase() === "auto" ? "auto" : "manual";
}

function getCartCountdownEnabledFromProduct(
  product: any,
  catPricingMap: Record<string, any>
): boolean {
  const pricing = getCategoryPricingForProduct(product, catPricingMap);
  return pricing?.cartCountdownEnabled === true;
}
function categoryUsesRates(c: any) {
  const pricing = c?.pricing || {};
  return pricing?.enabled === true;
}
function normalizeTcNo(v: any) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

function normalizeBirthDate(v: any) {
  if (!v) return "";

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "";

    // yyyy-mm-dd ise direkt kabul
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // dd.mm.yyyy -> yyyy-mm-dd çevir
    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    return s;
  }

  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  return "";
}

function isAdultBirthDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

  return age >= 18;
}
function validateGuestCheckoutForm(
  form: {
    email: string;
    invoiceType: "individual" | "company";
    firstName: string;
    lastName: string;
    phone: string;
    cityId: string;
    cityName: string;
    districtId: string;
    districtName: string;
    line1: string;
    line2: string;
    postalCode: string;
    nationalId: string;
    companyName: string;
    taxNumber: string;
    taxOffice: string;
  },
  loc: "tr" | "en"
) {
  const email = String(form.email || "").trim();
  const firstName = String(form.firstName || "").trim();
  const lastName = String(form.lastName || "").trim();
  const phone = String(form.phone || "").replace(/\D+/g, "");
  const cityId = String(form.cityId || "").trim();
  const districtId = String(form.districtId || "").trim();
  const line1 = String(form.line1 || "").trim();
  const postalCode = String(form.postalCode || "").replace(/\D+/g, "");
  const nationalId = String(form.nationalId || "").replace(/\D+/g, "");
  const companyName = String(form.companyName || "").trim();
  const taxNumber = String(form.taxNumber || "").replace(/\D+/g, "");
  const taxOffice = String(form.taxOffice || "").trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return loc === "en" ? "Enter a valid email." : "Geçerli bir e-posta gir.";
  }

  if (!firstName) {
    return loc === "en" ? "Recipient first name is required." : "Alıcı adı zorunlu.";
  }

  if (!lastName) {
    return loc === "en" ? "Recipient last name is required." : "Alıcı soyadı zorunlu.";
  }

  if (!(phone.length === 10 || phone.length === 11)) {
    return loc === "en" ? "Enter a valid phone number." : "Geçerli bir telefon gir.";
  }

  if (!cityId) {
    return loc === "en" ? "Select city." : "Şehir seç.";
  }

  if (!districtId) {
    return loc === "en" ? "Select district." : "İlçe seç.";
  }

  if (!line1) {
    return loc === "en" ? "Address line is required." : "Adres satırı zorunlu.";
  }

  if (postalCode.length !== 5) {
    return loc === "en" ? "Postal code must be 5 digits." : "Posta kodu 5 haneli olmalı.";
  }

  if (form.invoiceType === "individual") {
    if (nationalId && nationalId.length !== 11) {
      return loc === "en"
        ? "National ID must be 11 digits."
        : "TC kimlik no 11 haneli olmalı.";
    }
  }

  if (form.invoiceType === "company") {
    if (!companyName) {
      return loc === "en" ? "Company name is required." : "Firma adı zorunlu.";
    }
    if (!(taxNumber.length === 10 || taxNumber.length === 11)) {
      return loc === "en"
        ? "Enter a valid tax number."
        : "Geçerli bir vergi numarası gir.";
    }
    if (!taxOffice) {
      return loc === "en" ? "Tax office is required." : "Vergi dairesi zorunlu.";
    }
  }

  return "";
}

function getMissingProfileFields(profile: any, user: any) {
  const missing: string[] = [];

  const firstName = safeStr(profile?.firstName);
  const lastName = safeStr(profile?.lastName);
  const phone = safeStr(profile?.phone);
  const email = safeStr(user?.email);

  const tcNo = normalizeTcNo(getProfileTc(profile));
  const birthDate = normalizeBirthDate(getProfileBirthDate(profile));

  if (!firstName) missing.push("Ad");
  if (!lastName) missing.push("Soyad");
  if (!phone) missing.push("Telefon");
  if (!email) missing.push("E-posta");
  if (tcNo.length !== 11) missing.push("TC Kimlik No");
  if (!birthDate) missing.push("Doğum Tarihi");
  else if (!isAdultBirthDate(birthDate)) missing.push("18 yaş doğrulaması");

  return missing;
}
function productUsesRates(
  product: any,
  catPricingMap: Record<string, any>
) {
  const pricing = getCategoryPricingForProduct(product, catPricingMap);
  return pricing?.enabled === true;
}
async function resolveCategoryPricingForProduct(db: any, product: any) {
  const ids = extractCategoryIdsFromProduct(product);
  if (!ids.length) return null;

  // 1) category doc id ile dene
  for (const id of ids) {
    const snap = await getDoc(doc(db, "categories", String(id)));
    if (snap.exists()) return (snap.data() as any)?.pricing || null;
  }

  // 2) slug ile dene
  for (const slug of ids) {
    const qs = await getDocs(
      query(collection(db, "categories"), where("slug", "==", String(slug)), limit(1))
    );
    if (!qs.empty) return (qs.docs[0].data() as any)?.pricing || null;
  }

  return null;
}

async function getProductDocFlexible(
  db: any,
  item: { productId?: string; slug?: string; sku?: string; id?: string }
) {
  const candidates = [
    item?.productId,
    item?.id,
    item?.slug,
    item?.sku,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  for (const key of candidates) {
    const byIdSnap = await getDoc(doc(db, "products", key));

    if (byIdSnap.exists()) {
      return {
        id: byIdSnap.id,
        ...(byIdSnap.data() as any),
      };
    }
  }

  for (const key of candidates) {
    const bySlug = await getDocs(
      query(collection(db, "products"), where("slug", "==", key), limit(1))
    );

    if (!bySlug.empty) {
      const d = bySlug.docs[0];

      return {
        id: d.id,
        ...(d.data() as any),
      };
    }
  }

  for (const key of candidates) {
    const bySku = await getDocs(
      query(collection(db, "products"), where("sku", "==", key), limit(1))
    );

    if (!bySku.empty) {
      const d = bySku.docs[0];

      return {
        id: d.id,
        ...(d.data() as any),
      };
    }
  }

  return null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [loc, setLoc] = useState<Locale>("tr");
  const [showRatesBox, setShowRatesBox] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [email, setEmail] = useState<string | undefined>(undefined); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
const [guestCouponDoc, setGuestCouponDoc] = useState<AccountCouponRow | null>(null);
const [guestCouponChecking, setGuestCouponChecking] = useState(false);
  const isRealUser = !!user && !user.isAnonymous;
  const uid = isRealUser ? user.uid : null;
  const cartUid = isRealUser ? user.uid : null;
const [guestOpen, setGuestOpen] = useState(false);
const [guestBusy, setGuestBusy] = useState(false);
const [guestErr, setGuestErr] = useState("");

const [guestForm, setGuestForm] = useState({
  email: "",

  invoiceType: "individual" as "individual" | "company",

  firstName: "",
  lastName: "",
  phone: "",

  cityId: "",
  cityName: "",
  districtId: "",
  districtName: "",

  line1: "",
  line2: "",
  postalCode: "",

  nationalId: "",

  companyName: "",
  taxNumber: "",
  taxOffice: "",
});
  const [items, setItems] = useState<CheckoutCartItem[]>([]);
  const [productMap, setProductMap] = useState<Record<string, any>>({});
 const [catPricingMap, setCatPricingMap] = useState<Record<string, any>>({});
  const [ratesDoc, setRatesDoc] = useState<RatesLatest | null>(null);
const [checkoutEnabled, setCheckoutEnabled] = useState<boolean>(true);
const [cartExpirySettings, setCartExpirySettings] = useState<{
  enabled: boolean;
  hours: number;
  moveToFavorites: boolean;
}>({ enabled: true, hours: 24, moveToFavorites: true });
const [cartExpirySettingsReady, setCartExpirySettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
const [profileLoading, setProfileLoading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
const [profileData, setProfileData] = useState<any>(null);
  const [addrList, setAddrList] = useState<UiAddr[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
 const [addrSaving, setAddrSaving] = useState(false);
const [addrMsg, setAddrMsg] = useState("");
 const [addr, setAddr] = useState<Address>({
  fullName: "",
  phone: "",
  city: "",
  district: "",
  addressLine: "",
  postalCode: "",
  note: "",

  invoiceType: "individual",

  firstName: "",
  lastName: "",

  nationalId: "",

  companyName: "",
  taxNumber: "",
  taxOffice: "",
});

  const [refreshMinutes, setRefreshMinutes] = useState<number>(3);
  const [ratesEnabled, setRatesEnabled] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [leftSec, setLeftSec] = useState<number>(refreshMinutes * 60);
const [campaigns, setCampaigns] = useState<StoreCampaign[]>([]);
const SERVICE_KEY = "nci_selected_services_v1";
const GIFT_NOTE_KEY = "nci_gift_package_note_v1";
const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
const [giftPackageNote, setGiftPackageNote] = useState("");
const PRODUCT_TEXT_KEY = "nci_product_custom_text_v1";
const [productCustomText, setProductCustomText] = useState<Record<string, string>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshLockRef = useRef(false);
  const lastTriggeredAtRef = useRef<number>(0); // eslint-disable-line @typescript-eslint/no-unused-vars
useEffect(() => {
  try {
    const raw = localStorage.getItem("nci_selected_services_v1");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      setSelectedServices(parsed);
    }
  } catch {
    //
  }
}, []);
useEffect(() => {
  function loadSelectedServices() {
    try {
      const raw = localStorage.getItem(SERVICE_KEY);
    
      if (!raw) {
        setSelectedServices({});
        return;
      }

      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setSelectedServices(parsed as Record<string, boolean>);
      } else {
        setSelectedServices({});
      }
    } catch {
      setSelectedServices({});
    }
  }

  loadSelectedServices();

  window.addEventListener("storage", loadSelectedServices);
  window.addEventListener("nci:selected-services-changed", loadSelectedServices);

  return () => {
    window.removeEventListener("storage", loadSelectedServices);
    window.removeEventListener("nci:selected-services-changed", loadSelectedServices);
  };
}, []);
useEffect(() => {
  try {
    const raw = localStorage.getItem(GIFT_NOTE_KEY);
    if (raw) setGiftPackageNote(raw);
  } catch {
    //
  }
}, []);
useEffect(() => {
  try {
    const raw = localStorage.getItem(PRODUCT_TEXT_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      setProductCustomText(parsed as Record<string, string>);
    }
  } catch {
    //
  }
}, []);
useEffect(() => {
  try {
    localStorage.setItem(GIFT_NOTE_KEY, giftPackageNote);
  } catch {
    //
  }
}, [giftPackageNote]);
useEffect(() => {
  try {
    localStorage.setItem(PRODUCT_TEXT_KEY, JSON.stringify(productCustomText));
  } catch {
    //
  }
}, [productCustomText]);
useEffect(() => {
  try {
    localStorage.setItem("nci_selected_services_v1", JSON.stringify(selectedServices));
  } catch {
    //
  }
}, [selectedServices]);
  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => setLoc(((e as any)?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", handler as any);
    return () => window.removeEventListener("locale-changed", handler as any);
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u);
      setEmail(u?.email || undefined);
      setEmailVerified(!!u?.emailVerified);
      setAuthReady(true);
    });

    return () => unsub();
  }, [auth]);
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "site_options", "campaign_settings"),
    (snap) => {
      setCampaigns(normalizeCampaigns(snap.exists() ? snap.data() : null));
    },
    () => setCampaigns([])
  );

  return () => unsub();
}, [db]);
  useEffect(() => {
    const refresh = () => {
      const raw = getCart(cartUid);

      const list: CheckoutCartItem[] = raw
 .map((x: LocalCartItem) => {
  const lockedUnitPriceTry = toNum(
    (x as any).lockedUnitPriceTry ??
      (x as any).resolvedUnitPrice ??
      (x as any).unitPriceTry ??
      (x as any).priceTry ??
      (x as any).finalPrice ??
      (x as any).price,
    0
  );

  return {
    id: String((x as any).id || "").trim(),
    productId: String((x as any).productId || x.id || "").trim(),

    title:
      typeof (x as any)?.title === "object"
        ? (x as any).title
        : {
            tr: String((x as any)?.title || x.title || "Ürün"),
            en: String((x as any)?.titleEn || (x as any)?.title || "Product"),
          },

    qty: Math.max(1, Math.min(99, Math.floor(toNum((x as any).qty, 1)))),

    unitPrice: lockedUnitPriceTry,
    lockedUnitPriceTry,
    resolvedUnitPrice: lockedUnitPriceTry,
    unitPriceTry: lockedUnitPriceTry,
    priceTry: lockedUnitPriceTry,

    image: String((x as any).image || "").trim(),
    slug: String((x as any).slug || "").trim(),
    sku: String((x as any).sku || "").trim(),

    selectedSize: String((x as any).selectedSize || "").trim(),

    variant: (x as any).variant || undefined,
    selectedVariants: (x as any).selectedVariants || undefined,
    selectedVariantItems: Array.isArray((x as any).selectedVariantItems)
      ? (x as any).selectedVariantItems
      : undefined,
  };
})
        .filter((z) => z.productId && z.qty > 0);

      setItems(list);
    };

    refresh();
    window.addEventListener("cart:changed", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("cart:changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [cartUid]);

  useEffect(() => {
    if (!cartExpirySettingsReady || !cartExpirySettings.enabled) return;

    const expiryResult = runCartExpiryCheck(cartUid, {
      enabled: cartExpirySettings.enabled,
      expiryHours: cartExpirySettings.hours,
      moveToFavorites: cartExpirySettings.moveToFavorites,
    });

    if (expiryResult.expired.length > 0) {
      window.dispatchEvent(new Event("cart:changed"));
    }
  }, [
    cartExpirySettings.enabled,
    cartExpirySettings.hours,
    cartExpirySettings.moveToFavorites,
    cartExpirySettingsReady,
    cartUid,
  ]);

  useEffect(() => {
    if (!uid) {
      setAddrList([]);
      setSelectedAddrId("");
      return;
    }

    const uref = doc(db, "users", uid);
    let unsubAddrs: (() => void) | null = null;

    const unsubUser = onSnapshot(
      uref,
      (usnap) => {
        const udata: any = usnap.exists() ? usnap.data() : null;
        const defaultId = String(udata?.defaultAddressId || "").trim();

        const aq = query(collection(db, "users", uid, "addresses"), orderBy("updatedAt", "desc"));

        if (unsubAddrs) unsubAddrs();

        unsubAddrs = onSnapshot(
          aq,
          (asnap) => {
            const list = asnap.docs.map((d) => mapAddrDoc(d.id, d.data() as any));
            list.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
            setAddrList(list);

            setSelectedAddrId((cur) => {
              if (cur && list.some((x) => x.id === cur)) return cur;
              if (defaultId && list.some((x) => x.id === defaultId)) return defaultId;
              const byFlag = list.find((x) => x.isDefault)?.id;
              return byFlag || list[0]?.id || "";
            });
          },
          () => setAddrList([])
        );
      },
      () => {
        setAddrList([]);
        setSelectedAddrId("");
      }
    );

    return () => {
      try {
        unsubUser?.();
      } catch {
        //
      }
      try {
        unsubAddrs?.();
      } catch {
        //
      }
    };
  }, [db, uid]);

  useEffect(() => {
    if (!selectedAddrId) return;
    const a = addrList.find((x) => x.id === selectedAddrId);
    if (!a) return;

   setAddr({
  fullName: a.fullName || "",
  phone: a.phone || "",
  city: a.city || "",
  district: a.district || "",
addressLine: normalizeAddressLine(a.addressLine),
  postalCode: a.postalCode || "",
  note: a.note || "",

  invoiceType: a.invoiceType || "individual",

  firstName: a.firstName || "",
  lastName: a.lastName || "",

  nationalId: a.nationalId || "",

  companyName: a.companyName || "",
  taxNumber: a.taxNumber || "",
  taxOffice: a.taxOffice || "",
});
  }, [selectedAddrId, addrList]);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      if (!items.length) {
        if (alive) {
          setProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
        }
        return;
      }

      const next: Record<string, any> = {};

      for (const it of items) {
        const pdoc = await getProductDocFlexible(db, it as any);

        if (pdoc) {
          const catPricing = await resolveCategoryPricingForProduct(db, pdoc);

          const enriched = {
            ...pdoc,
            resolvedCategoryPricing: catPricing,
          };

          addProductAliases(next, productMapKey(it), enriched);
          addProductAliases(next, String((it as any).id || ""), enriched);
          addProductAliases(next, String(it.productId || ""), enriched);
          addProductAliases(next, String(it.slug || ""), enriched);
          addProductAliases(next, String(it.sku || ""), enriched);
        }
      }

      if (alive) {
        setProductMap((prev) => (sameJson(prev, next) ? prev : next));
      }
    } catch (error) {
      console.error("checkout productMap load error:", error);
      if (alive) {
        setProductMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      }
    }
  })();

  return () => {
    alive = false;
  };
}, [db, items]);
async function applyGuestCoupon() {
  const code = guestCouponCode.trim().toUpperCase();

  if (!code) {
setCouponErr(tUI.enterCoupon); 
   setGuestCouponDoc(null);
    return;
  }

  try {
    setGuestCouponChecking(true);
    setCouponErr("");

    const functions = getFunctions(getFirebaseApp(), "europe-west1");
    const callable = httpsCallable(functions, "verifyGuestWheelCoupon");

    const res: any = await callable({ code });
    const data = res?.data || {};

    if (!data?.found) {
      setGuestCouponDoc(null);
setCouponErr(tUI.couponNotFound);
      return;
    }

    const c = data.coupon || {};

    setGuestCouponDoc({
      id: String(c.code || code),
      code: String(c.code || code),
      label: String(c.label || ""),
      status: "active",
      discountType: String(c.discountType || "fixed") as "percent" | "fixed",
      discountValue: Number(c.discountValue || 0),
      campaignTitle: String(c.campaignTitle || ""),
      minCartAmount: Number(c.minCartAmount || 0),
      expiresAt: c.expiresAt || null,
    });
} catch (e) {
  console.error("guest coupon verify error:", e);
  setGuestCouponDoc(null);
  setCouponErr(tUI.couponCheckFailed);
} finally {
  setGuestCouponChecking(false);
}
}
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const products = Object.values(productMap || {});
      const catIds = uniq(products.flatMap(extractCategoryIdsFromProduct)).filter(Boolean);

      if (!catIds.length) {
        if (alive) {
          setCatPricingMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
        }
        return;
      }

      const out: Record<string, any> = {};
      const chunks: string[][] = [];

      for (let i = 0; i < catIds.length; i += 10) {
        chunks.push(catIds.slice(i, i + 10));
      }

      for (const part of chunks) {
        const snap = await getDocs(
          query(collection(db, "categories"), where("__name__", "in", part))
        );

        snap.forEach((d) => {
          const data: any = d.data();
          const pricing = data?.pricing || null;

          out[d.id] = pricing;
          if (data?.slug) out[String(data.slug)] = pricing;
        });
      }

      if (alive) {
        setCatPricingMap((prev) => (sameJson(prev, out) ? prev : out));
      }
    } catch (e) {
      console.error("catPricingMap load error:", e);
      if (alive) {
        setCatPricingMap((prev) => (Object.keys(prev || {}).length ? {} : prev));
      }
    }
  })();

  return () => {
    alive = false;
  };
}, [db, productMap]);
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "rates", "latest"),
    (snap) => {
      const next = snap.exists() ? (snap.data() as RatesLatest) : null;
     
      setRatesDoc(next);
    },
    () => setRatesDoc(null)
  );

  return () => unsub();
}, [db]);

 useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "settings", "public"),
    (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};

      const m = Number(d?.cartRefreshMinutes ?? 3);
      if (Number.isFinite(m) && m > 0 && m <= 60) {
        setRefreshMinutes(m);
      } else {
        setRefreshMinutes(3);
      }

      setRatesEnabled(d?.ratesEnabled !== false);
      setAutoRefresh(d?.cartRatesAutoRefresh !== false);
      setCheckoutEnabled(d?.checkoutEnabled !== false);

      // 24 saat kuralı ayarları
      const ce = d?.cartExpiry && typeof d.cartExpiry === "object" ? d.cartExpiry : {};
      setCartExpirySettings({
        enabled: ce.enabled !== false,
        hours: Number(ce.hours) > 0 ? Number(ce.hours) : 24,
        moveToFavorites: ce.moveToFavorites !== false,
      });
      setCartExpirySettingsReady(true);
    },
    (err) => {
      console.error("settings/public snapshot error:", err);
      setCheckoutEnabled(true);
      setCartExpirySettingsReady(true);
    }
  );

  return () => unsub();
}, [db]);
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      if (!uid) {
        if (alive) setProfileData(null);
        return;
      }

      setProfileLoading(true);

      const snap = await getDoc(doc(db, "users", uid));
      if (!alive) return;

      setProfileData(snap.exists() ? (snap.data() as any) : null);
    } catch (e) {
      console.error("checkout profile load error:", e);
      if (alive) setProfileData(null);
    } finally {
      if (alive) setProfileLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [db, uid]);
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!items.length) {
          if (alive) setShowRatesBox(false);
          return;
        }

        const productDocs: any[] = [];

        for (const it of items) {
          const pdoc = await getProductDocFlexible(db, it);
          if (!alive) return;
          if (pdoc) productDocs.push(pdoc);
        }

        if (!alive) return;

const anyProductWantsRates = productDocs.some((p) => productUsesRates(p, catPricingMap));
        const catIds = uniq(productDocs.flatMap(extractCategoryIdsFromProduct));

        let anyCategoryWantsRates = false;

        // ürün özelinde açık yoksa kategoriye bak
        if (!anyProductWantsRates && catIds.length) {
          const chunks: string[][] = [];
          for (let i = 0; i < catIds.length; i += 10) {
            chunks.push(catIds.slice(i, i + 10));
          }

          for (const part of chunks) {
            const qs = query(collection(db, "categories"), where("__name__", "in", part));
            const snap = await getDocs(qs);

            snap.forEach((d: any) => {
              const c = d.data();
              if (categoryUsesRates(c)) {
                anyCategoryWantsRates = true;
              }
            });

            if (anyCategoryWantsRates) break;
          }
        }

        if (alive) {
          setShowRatesBox(anyProductWantsRates || anyCategoryWantsRates);
        }
      } catch (error) {
        console.error("showRatesBox detect error:", error);
        if (alive) setShowRatesBox(false);
      }
    })();

    return () => {
      alive = false;
    };
}, [db, items, catPricingMap]);
function getVariantDeltaFromItem(it: CheckoutCartItem) {
  return Array.isArray(it.selectedVariantItems)
    ? it.selectedVariantItems.reduce(
        (sum, v) => sum + Number(v?.priceDelta || 0),
        0
      )
    : 0;
}
function productIdentityKeys(item: any, product: any = null) {
  return [
    item?.productId,
    item?.id,
    item?.slug,
    item?.productSlug,
    item?.sku,
    product?.id,
    product?.slug,
    product?.sku,
    product?.productId,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function campaignMatchesProduct(service: any, item: any, product: any) {
  const target = String(service?.target || "cart").trim();

  if (target === "cart") return true;

  const keys = productIdentityKeys(item, product).map((x) =>
    x.toLocaleLowerCase("tr-TR")
  );

  if (target === "product") {
    const productIds = Array.isArray(service?.productIds) ? service.productIds : [];

    if (!productIds.length) return false;

    return productIds
      .map((x: any) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
      .filter(Boolean)
      .some((x: string) => keys.includes(x));
  }

  if (target === "category") {
    const allowed = Array.isArray(service?.categoryIds) ? service.categoryIds : [];

    if (!allowed.length) return false;

    const allowedKeys = allowed
      .map((x: any) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
      .filter(Boolean);

    const catKeys = [
      ...(Array.isArray(product?.categoryIds) ? product.categoryIds : []),
      ...(Array.isArray(product?.categorySlugs) ? product.categorySlugs : []),
      product?.categoryId,
      product?.categorySlug,
    ]
      .map((x: any) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
      .filter(Boolean);

    return catKeys.some((x: string) => allowedKeys.includes(x));
  }

  return true;
}

function serviceRequiresProductText(service: any) {
  return service?.requiresProductText === true;
}

function getProductTextKey(item: any, product: any = null) {
  return String(
    item?.productId ||
      item?.id ||
      item?.slug ||
      item?.sku ||
      product?.id ||
      product?.slug ||
      product?.sku ||
      ""
  ).trim();
}

function getProductTextLabel(service: any, loc: Locale) {
  const raw = service?.productTextLabel;

  if (raw && typeof raw === "object") {
    return String(raw?.[loc] || raw?.tr || raw?.en || "").trim();
  }

  return loc === "en" ? "Text to be written on product" : "Ürüne yazılacak metin";
}

function getProductTextPlaceholder(service: any, loc: Locale) {
  const raw = service?.productTextPlaceholder;

  if (raw && typeof raw === "object") {
    return String(raw?.[loc] || raw?.tr || raw?.en || "").trim();
  }

  return loc === "en"
    ? "Example: Ayşe & Mehmet"
    : "Örn: Ayşe & Mehmet";
}

function getProductTextMaxLength(service: any) {
  const n = Number(service?.productTextMaxLength || 30);
  return Number.isFinite(n) ? Math.max(1, Math.min(80, n)) : 30;
}
function getSelectedVariantGramFromItem(it: CheckoutCartItem) {
  if (!Array.isArray(it.selectedVariantItems)) return 0;

  const found = it.selectedVariantItems.find((v: any) => {
    const gram = Number(v?.hasGram ?? v?.weightGram ?? 0);
    return Number.isFinite(gram) && gram > 0;
  });

  const gram = Number((found as any)?.hasGram ?? (found as any)?.weightGram ?? 0);
  return Number.isFinite(gram) && gram > 0 ? gram : 0;
}

function applySelectedGramToProduct(product: any, selectedGram: number) {
  if (!product || !selectedGram || selectedGram <= 0) return product;

  // Varyant gramı base gramdan farklıysa sabit fiyatları sıfırla
  const baseProductGram = Math.max(0, Number(
    product?.hasGram ?? product?.gram ?? product?.weightGram ?? product?.weightGr ?? 0
  ));
  const gramChanged = selectedGram > 0 && Math.abs(selectedGram - baseProductGram) > 0.001;

  return {
    ...product,
    gram: selectedGram,
    hasGram: selectedGram,
    weightGram: selectedGram,
    weightGr: selectedGram,

    // Gram değiştiyse sabit fiyatları sıfırla → dinamik hesaplama devreye girsin
    ...(gramChanged ? { finalPrice: 0, priceTry: 0, final: 0, price: 0, rawPrice: 0 } : {}),

    pricing: product?.pricing
      ? {
          ...product.pricing,
          hasGram: selectedGram,
          weightGram: selectedGram,
          gram: selectedGram,
        }
      : product?.pricing,

    dynamicPricing: product?.dynamicPricing
      ? {
          ...product.dynamicPricing,
          hasGram: selectedGram,
          weightGram: selectedGram,
          gram: selectedGram,
        }
      : product?.dynamicPricing,
  };
}
const productMapReady = useMemo(() => {
  if (!items.length) return true;

  return items.every((it: any) => {
    return !!getProductFromMap(productMap, it);
  });
}, [items, productMap]);
const pricedItems = useMemo(() => {
  return items.map((it) => {
    const product = getProductFromMap(productMap, it);
    const variantDelta = getVariantDeltaFromItem(it);
    const selectedVariantGram = getSelectedVariantGramFromItem(it);

    const lockedUnitPrice = toNum(
      (it as any).lockedUnitPriceTry ??
        (it as any).resolvedUnitPrice ??
        (it as any).unitPriceTry ??
        (it as any).priceTry ??
        (it as any).unitPrice ??
        (it as any).finalPrice ??
        (it as any).price,
      0
    );

    const hasLockedPrice = Number.isFinite(lockedUnitPrice) && lockedUnitPrice > 0;

    const hasSelectedVariant =
      !!safeStr((it as any).selectedSize) ||
      (Array.isArray((it as any).selectedVariantItems) &&
        (it as any).selectedVariantItems.length > 0);

    const pricingProduct = applySelectedGramToProduct(product, selectedVariantGram);

    if (!hasLockedPrice && !hasSelectedVariant && pricingProduct && productUsesRates(pricingProduct, catPricingMap)) {
      const resolved = resolveProductPriceTRY(pricingProduct, ratesDoc);
      const livePrice = Number(resolved?.price ?? 0);

      const refreshMode = getRefreshModeFromProduct(product, catPricingMap);
      const cartCountdownEnabled = getCartCountdownEnabledFromProduct(product, catPricingMap);

      const resolvedUnitPrice =
        Number.isFinite(livePrice) && livePrice > 0
          ? Math.max(0, livePrice + variantDelta)
          : 0;

      return {
        ...it,
        lockedUnitPriceTry: resolvedUnitPrice,
        resolvedUnitPrice,
        unitPriceTry: resolvedUnitPrice,
        priceTry: resolvedUnitPrice,
        isDynamicPrice: true,
        refreshMode,
        cartCountdownEnabled,
        variantDelta,
        selectedVariantGram,
      };
    }

    return {
      ...it,
      lockedUnitPriceTry: lockedUnitPrice,
      resolvedUnitPrice: lockedUnitPrice,
      unitPriceTry: lockedUnitPrice,
      priceTry: lockedUnitPrice,
      isDynamicPrice: false,
      refreshMode: "manual" as const,
      cartCountdownEnabled: false,
      variantDelta,
      selectedVariantGram,
    };
  });
}, [items, productMap, ratesDoc, catPricingMap]);
type AccountCouponRow = {
  id: string;
  code: string;
  label: string;
  status: "active" | "used" | "expired" | "cancelled";
  discountType: "percent" | "fixed";
  discountValue: number;
  campaignTitle?: string;
  minCartAmount?: number;
  expiresAt?: any;
};

const [accountCoupons, setAccountCoupons] = useState<AccountCouponRow[]>([]);
const [selectedCouponCode, setSelectedCouponCode] = useState("");
const [guestCouponCode, setGuestCouponCode] = useState("");
const [couponErr, setCouponErr] = useState("");
const activeCoupon = useMemo(() => {
  if (uid) {
    return accountCoupons.find((c) => c.code === selectedCouponCode) || null;
  }
  return guestCouponDoc;
}, [uid, accountCoupons, selectedCouponCode, guestCouponDoc]);
const campaignResult = useMemo(() => {
  const subtotal = pricedItems.reduce(
    (sum, it: any) => sum + toNum(it.resolvedUnitPrice, 0) * toNum(it.qty, 0),
    0
  );

  return calcCampaignDiscount({
    campaigns,
    placement: "checkout",
    subtotal,
    items: pricedItems.map((it: any) => {
      const product = getProductFromMap(productMap, it) || {};

      return {
        id: String(it.productId || ""),
        productId: String(it.productId || ""),
        slug: String(it.slug || product?.slug || ""),
        qty: Number(it.qty || 1),
        resolvedUnitPrice: Number(it.resolvedUnitPrice || 0),
        categoryIds: Array.isArray(product?.categoryIds) ? product.categoryIds : [],
        categorySlugs: Array.isArray(product?.categorySlugs) ? product.categorySlugs : [],
      };
    }),
  });
}, [campaigns, pricedItems, productMap]);
const serviceCampaigns = useMemo(() => {
  return campaigns.filter((c: any) => {
    const kind = String((c as any).kind || "discount");
    const placement = Array.isArray((c as any).placement) ? (c as any).placement : [];

    if (
      kind !== "service" ||
      !placement.includes("checkout") ||
      c.isActive === false ||
      c.enabled === false
    ) {
      return false;
    }

    // productIds doluysa, sepette o ürünlerden en az biri olmalı
    const serviceProductIds = Array.isArray(c?.productIds) ? c.productIds : [];
    const hasSpecificProducts = serviceProductIds.filter((x: any) => String(x || "").trim()).length > 0;

    if (hasSpecificProducts) {
      const normalizedServiceIds = serviceProductIds
        .map((x: any) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
        .filter(Boolean);

      const cartHasMatch = pricedItems.some((it: any) => {
        const product = getProductFromMap(productMap, it);
        const keys = productIdentityKeys(it, product).map((x) =>
          x.toLocaleLowerCase("tr-TR")
        );
        return normalizedServiceIds.some((sid: string) => keys.includes(sid));
      });

      if (!cartHasMatch) return false;
    }

    return true;
  });
}, [campaigns, pricedItems, productMap]);
const giftPackageInfo = useMemo(() => {
  const selectedGiftService = serviceCampaigns.find((service: any) => {
    const id = String(service.id || "").trim();
    if (!id || selectedServices[id] !== true) return false;

    const hay = [
      service.id,
      service.code,
      typeof service.title === "string" ? service.title : service.title?.tr,
      typeof service.title === "string" ? service.title : service.title?.en,
      typeof service.subtitle === "string" ? service.subtitle : service.subtitle?.tr,
      typeof service.subtitle === "string" ? service.subtitle : service.subtitle?.en,
      typeof service.description === "string" ? service.description : service.description?.tr,
      typeof service.description === "string" ? service.description : service.description?.en,
    ]
      .map((x) => String(x || "").toLocaleLowerCase("tr-TR"))
      .join(" ");

    return (
      hay.includes("hediye") ||
      hay.includes("gift") ||
      hay.includes("paket")
    );
  });

  return {
    enabled: Boolean(selectedGiftService),
    serviceId: String(selectedGiftService?.id || ""),
    code: String(selectedGiftService?.code || ""),
    title: selectedGiftService?.title || null,
    priceTry: Number((selectedGiftService as any)?.servicePriceTry || 0),
  };
}, [serviceCampaigns, selectedServices]);
const productTextServices = useMemo(() => {
  return serviceCampaigns.filter((service: any) => {
    const id = String(service.id || "").trim();
    if (!id) return false;
    if (selectedServices[id] !== true) return false;
    return serviceRequiresProductText(service);
  });
}, [serviceCampaigns, selectedServices]);

const productTextRows = useMemo(() => {
  if (!productTextServices.length) return [];

  const rows: Array<{
    key: string;
    item: any;
    product: any;
    service: any;
    label: string;
    placeholder: string;
    maxLength: number;
  }> = [];

  pricedItems.forEach((it: any) => {
    const product = getProductFromMap(productMap, it);

    productTextServices.forEach((service: any) => {
      // requiresProductText açık ve productIds doluysa,
      // sadece o ürünlerde metin alanı göster (target ne olursa olsun)
      const serviceProductIds = Array.isArray(service?.productIds) ? service.productIds : [];
      const hasSpecificProducts = serviceProductIds.filter((x: any) => String(x || "").trim()).length > 0;

      if (hasSpecificProducts) {
        const keys = productIdentityKeys(it, product).map((x) =>
          x.toLocaleLowerCase("tr-TR")
        );
        const matchesProduct = serviceProductIds
          .map((x: any) => String(x || "").trim().toLocaleLowerCase("tr-TR"))
          .filter(Boolean)
          .some((x: string) => keys.includes(x));

        if (!matchesProduct) return;
      } else {
        // productIds boşsa genel campaign eşleşme kurallarını uygula
        if (!campaignMatchesProduct(service, it, product)) return;
      }

      const key = getProductTextKey(it, product);
      if (!key) return;

      rows.push({
        key,
        item: it,
        product,
        service,
        label: getProductTextLabel(service, loc),
        placeholder: getProductTextPlaceholder(service, loc),
        maxLength: getProductTextMaxLength(service),
      });
    });
  });

  const seen = new Set<string>();

  return rows.filter((row) => {
    const uniqKey = `${row.service.id}_${row.key}`;
    if (seen.has(uniqKey)) return false;
    seen.add(uniqKey);
    return true;
  });
}, [productTextServices, pricedItems, productMap, loc]);
const totals = useMemo(() => {
  const subtotal = pricedItems.reduce((sum, it: any) => {
    const unit = toNum(it.resolvedUnitPrice, 0);
    const qty = toNum(it.qty, 0);

    return sum + unit * qty;
  }, 0);

  const shippingFee = subtotal > 0 ? 0 : 0;

  let couponDiscount = 0;

  if (activeCoupon) {
    const couponValue = Number(activeCoupon.discountValue || 0);

    if (activeCoupon.discountType === "percent") {
      couponDiscount = subtotal * (couponValue / 100);
    } else {
      couponDiscount = couponValue;
    }
  }

  const campaignDiscount = Number(campaignResult?.discount || 0);

  const serviceTotal = serviceCampaigns.reduce((sum: number, service: any) => {
    const id = String(service.id || "").trim();
    if (!id) return sum;

    const selected = selectedServices[id] === true;
    if (!selected) return sum;

    const freeOverTry = Number(service.freeOverTry || 0);
    const servicePriceTry = Number(service.servicePriceTry || 0);

    const isFree = freeOverTry > 0 && subtotal >= freeOverTry;

    return sum + (isFree ? 0 : Math.max(0, servicePriceTry));
  }, 0);

  const rawDiscount = couponDiscount + campaignDiscount;
  const discount = Math.max(0, Math.min(rawDiscount, subtotal));

  const total = Math.max(0, subtotal + shippingFee + serviceTotal - discount);

  return {
    subtotal,
    shippingFee,
    couponDiscount,
    campaignDiscount,
    serviceTotal,
    discount,
    total,
  };
}, [pricedItems, activeCoupon, campaignResult, serviceCampaigns, selectedServices]);

const hasAutoDynamic = useMemo(() => {
  return pricedItems.some(
    (it: any) =>
      it.isDynamicPrice &&
      it.refreshMode === "auto" &&
      it.cartCountdownEnabled === true
  );
}, [pricedItems]);
const showRateBox = ratesEnabled && autoRefresh && hasAutoDynamic;
  const totalQty = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.qty || 1), 0),
    [items]
  );
  
useEffect(() => {
  if (!uid) {
    setAccountCoupons([]);
    setSelectedCouponCode("");
    return;
  }

  const qy = query(
    collection(db, "users", uid, "wheel_coupons"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(
    qy,
    (snap) => {
      const list: AccountCouponRow[] = snap.docs.map((d) => {
        const x: any = d.data();
        return {
          id: d.id,
          code: String(x?.code || d.id),
          label: String(x?.label || ""),
          status: (x?.status || "active") as AccountCouponRow["status"],
          discountType: String(x?.discountType || "fixed") as "percent" | "fixed",
          discountValue: Number(x?.discountValue || 0),
          campaignTitle: String(x?.campaignTitle || ""),
          minCartAmount: Number(x?.minCartAmount || 0),
          expiresAt: x?.expiresAt,
        };
      }).filter((coupon) => {
        const expiresAt = coupon.expiresAt;
        const expiryMs = typeof expiresAt?.toMillis === "function"
          ? expiresAt.toMillis()
          : expiresAt
          ? new Date(expiresAt).getTime()
          : 0;
        return !expiryMs || expiryMs > Date.now();
      });

      setAccountCoupons(list);

      setSelectedCouponCode((prev) => {
        if (prev && list.some((c) => c.code === prev)) return prev;
        return "";
      });
    },
    (error) => {
      console.error("member coupons load error:", error);
      setAccountCoupons([]);
      setSelectedCouponCode("");
    }
  );

  return () => unsub();
}, [db, uid]);
  useEffect(() => {
    const total = refreshMinutes * 60;

    if (!hasAutoDynamic || !ratesEnabled || !autoRefresh) {
      setLeftSec(total);
      return;
    }

    const st = loadTimer(total);
    const t = nowSec();
    setLeftSec(Math.max(0, st.nextAt - t));
  }, [refreshMinutes, ratesEnabled, autoRefresh, hasAutoDynamic]);
useEffect(() => {
  const total = refreshMinutes * 60;

  if (!hasAutoDynamic || !ratesEnabled || !autoRefresh) return;
  if (leftSec > 0) return;
  if (refreshLockRef.current) return;

  refreshLockRef.current = true;

  const nextAt = nowSec() + total;
  saveTimer({ nextAt, total });
  setLeftSec(total);

  triggerRatesRefreshAndWait(db, String((ratesDoc as any)?.fetchedAt || ""))
    .then((freshRates) => {
      if (freshRates) {
        setRatesDoc(freshRates as RatesLatest);
      }
    })
    .catch((e) => {
      console.error("[checkout] auto refresh error:", e);
    })
    .finally(() => {
      refreshLockRef.current = false;
    });
}, [leftSec, hasAutoDynamic, ratesEnabled, autoRefresh, refreshMinutes, db, ratesDoc]);
 useEffect(() => {
  if (tickRef.current) clearInterval(tickRef.current);

  const total = refreshMinutes * 60;

  if (!hasAutoDynamic || !ratesEnabled || !autoRefresh) {
    setLeftSec(total);
    return;
  }

const st = loadTimer(total);
setLeftSec(Math.max(0, st.nextAt - nowSec()));

tickRef.current = setInterval(() => {
  const current = readTimer();

  if (!current) {
    setLeftSec(0);
    return;
  }

  const left = Math.max(0, current.nextAt - nowSec());
  setLeftSec(left);
}, 1000);

  return () => {
    if (tickRef.current) clearInterval(tickRef.current);
  };
}, [refreshMinutes, ratesEnabled, autoRefresh, hasAutoDynamic]);
function saveSelectedServices(next: Record<string, boolean>) {
  setSelectedServices(next);

  try {
    localStorage.setItem(SERVICE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nci:selected-services-changed"));
  } catch {
    //
  }
}
function readTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TimerState>;
    const nextAt = Number(parsed?.nextAt ?? 0);
    const total = Number(parsed?.total ?? 0);

    if (!Number.isFinite(nextAt) || !Number.isFinite(total) || total <= 0) {
      return null;
    }

    return { nextAt, total };
  } catch {
    return null;
  }
}

const countdownItems = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  return pricedItems.filter(
    (it: any) =>
      it.isDynamicPrice &&
      it.refreshMode === "auto" &&
      it.cartCountdownEnabled === true
  );
}, [pricedItems]);
  const mmss = useMemo(() => {
    const m = Math.floor(leftSec / 60);
    const s2 = leftSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
  }, [leftSec]);

  function validate() {
    if (!checkoutEnabled) {
  return loc === "en"
    ? "Checkout is temporarily disabled."
    : "Satış şu anda geçici olarak kapalı.";
}
  if (!uid) return loc === "en" ? "Please sign in." : "Giriş yapman gerekiyor.";
  if (!items.length) return loc === "en" ? "Cart is empty." : "Sepet boş.";

  // Stok, aktiflik ve fiyat kontrolü
  for (const it of pricedItems) {
    const product = getProductFromMap(productMap, it);
    const title = safeStr(
      typeof it.title === "object" ? it.title?.tr : it.title
    ) || "Ürün";
    const qty = Math.max(1, Math.floor(Number(it.qty || 1)));

    // Disabled ürün kontrolü
    if (product && product.isActive === false) {
      return loc === "en"
        ? `"${title}" is no longer available.`
        : `"${title}" artık satışta değil.`;
    }

    // Stok kontrolü
    if (product) {
      const stock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
      if (stock <= 0) {
        return loc === "en"
          ? `"${title}" is out of stock.`
          : `"${title}" stokta yok.`;
      }
      if (qty > stock) {
        return loc === "en"
          ? `"${title}" has only ${stock} in stock but ${qty} in cart.`
          : `"${title}" stokta ${stock} adet var, sepette ${qty} adet.`;
      }
    }

    // Fiyat 0 kontrolü
    const unitPrice = Number((it as any).resolvedUnitPrice || (it as any).priceTry || 0);
    if (unitPrice <= 0) {
      return loc === "en"
        ? `Price for "${title}" could not be calculated.`
        : `"${title}" fiyatı hesaplanamadı.`;
    }
  }

  if (!addr.fullName.trim()) return loc === "en" ? "Full name is required." : "Ad Soyad zorunlu.";
  if (!addr.phone.trim()) return loc === "en" ? "Phone is required." : "Telefon zorunlu.";
  if (!addr.city.trim()) return loc === "en" ? "City is required." : "Şehir zorunlu.";
  if (!addr.district.trim()) return loc === "en" ? "District is required." : "İlçe zorunlu.";
  if (!addr.addressLine.trim()) return loc === "en" ? "Address is required." : "Adres zorunlu.";
if ((addr.invoiceType || "individual") === "company") {
  if (!String(addr.companyName || "").trim()) {
    return loc === "en" ? "Company name is required." : "Firma adı zorunlu.";
  }
  if (!String(addr.taxNumber || "").trim()) {
    return loc === "en" ? "Tax number is required." : "Vergi numarası zorunlu.";
  }
  if (!String(addr.taxOffice || "").trim()) {
    return loc === "en" ? "Tax office is required." : "Vergi dairesi zorunlu.";
  }
}
if ((addr.invoiceType || "individual") === "individual") {
  const tc = String(addr.nationalId || "").replace(/\D+/g, "");
  if (tc && tc.length !== 11) {
    return loc === "en"
      ? "National ID must be 11 digits."
      : "TC kimlik no 11 haneli olmalı.";
  }
}
  return "";
}

async function saveEditedAddress() {
  setErr("");
  setAddrMsg("");

  const cleaned = {
    ...addr,
    fullName:
      `${String(addr.firstName || "").trim()} ${String(addr.lastName || "").trim()}`.trim() ||
      String(addr.fullName || "").trim(),

    phone: String(addr.phone || "").trim(),
    city: String(addr.city || "").trim(),
    district: String(addr.district || "").trim(),
    addressLine: normalizeAddressLine(addr.addressLine),
    postalCode: String(addr.postalCode || "").trim(),
    note: String(addr.note || "").trim(),

    invoiceType: addr.invoiceType === "company" ? "company" : "individual",

    firstName: String(addr.firstName || "").trim(),
    lastName: String(addr.lastName || "").trim(),

    nationalId:
      addr.invoiceType === "individual"
        ? String(addr.nationalId || "").replace(/\D+/g, "").slice(0, 11)
        : "",

    companyName:
      addr.invoiceType === "company"
        ? String(addr.companyName || "").trim()
        : "",

    taxNumber:
      addr.invoiceType === "company"
        ? String(addr.taxNumber || "").replace(/\D+/g, "").slice(0, 11)
        : "",

    taxOffice:
      addr.invoiceType === "company"
        ? String(addr.taxOffice || "").trim()
        : "",
  };

  if (!cleaned.fullName) {
setErr(`${tUI.fullName} ${loc === "en" ? "is required." : "zorunlu."}`);
    return;
  }

  if (!cleaned.phone) {
    setErr(loc === "en" ? "Phone is required." : "Telefon zorunlu.");
    return;
  }

  if (!cleaned.city) {
    setErr(loc === "en" ? "City is required." : "Şehir zorunlu.");
    return;
  }

  if (!cleaned.district) {
    setErr(loc === "en" ? "District is required." : "İlçe zorunlu.");
    return;
  }

  if (!cleaned.addressLine) {
    setErr(loc === "en" ? "Address is required." : "Adres zorunlu.");
    return;
  }

  if (cleaned.invoiceType === "company") {
    if (!cleaned.companyName) {
      setErr(loc === "en" ? "Company name is required." : "Firma adı zorunlu.");
      return;
    }

    if (!cleaned.taxNumber) {
      setErr(loc === "en" ? "Tax number is required." : "Vergi numarası zorunlu.");
      return;
    }

    if (!cleaned.taxOffice) {
      setErr(loc === "en" ? "Tax office is required." : "Vergi dairesi zorunlu.");
      return;
    }
  }

  if (cleaned.invoiceType === "individual" && cleaned.nationalId && cleaned.nationalId.length !== 11) {
    setErr(loc === "en" ? "National ID must be 11 digits." : "TC kimlik no 11 haneli olmalı.");
    return;
  }

  setAddr(cleaned as Address);

  const canUpdateSavedAddress = !!uid && !!selectedAddrId;

  if (!canUpdateSavedAddress) {
   setFormOpen(false);
setAddrMsg(loc === "en" ? "Address prepared for checkout." : "Adres checkout için hazırlandı.");

window.setTimeout(() => {
  setAddrMsg("");
}, 2200);

return;
  }

  try {
    setAddrSaving(true);

    await updateDoc(doc(db, "users", uid, "addresses", selectedAddrId), {
      fullName: cleaned.fullName,
      phone: cleaned.phone,
      city: cleaned.city,
      district: cleaned.district,
      addressLine: cleaned.addressLine,
      postalCode: cleaned.postalCode,
      note: cleaned.note,

      invoiceType: cleaned.invoiceType,

      firstName: cleaned.firstName,
      lastName: cleaned.lastName,

      nationalId: cleaned.invoiceType === "individual" ? cleaned.nationalId : "",

      companyName: cleaned.invoiceType === "company" ? cleaned.companyName : "",
      taxNumber: cleaned.invoiceType === "company" ? cleaned.taxNumber : "",
      taxOffice: cleaned.invoiceType === "company" ? cleaned.taxOffice : "",

      line1: cleaned.addressLine,
      line2: "",

      updatedAt: serverTimestamp(),
    });

   setFormOpen(false);
setAddrMsg(loc === "en" ? "Address updated." : "Adres güncellendi.");

window.setTimeout(() => {
  setAddrMsg("");
}, 2200);
  } catch (e) {
    console.error("address update error:", e);
    setErr(loc === "en" ? "Address could not be saved." : "Adres kaydedilemedi.");
  } finally {
    setAddrSaving(false);
  }
}
async function proceedToPayment() {
  if (!cartExpirySettingsReady) {
    setErr(
      loc === "en"
        ? "Cart protection settings are still loading. Please try again in a moment."
        : "Sepet koruma ayarları yükleniyor. Lütfen kısa bir süre sonra tekrar deneyin."
    );
    return;
  }

  // 24 saat kuralı: ödeme öncesi kontrol
  const expiryResult = runCartExpiryCheck(cartUid, {
    enabled: cartExpirySettings.enabled,
    expiryHours: cartExpirySettings.hours,
    moveToFavorites: cartExpirySettings.moveToFavorites,
  });
  if (expiryResult.movedToFavorites > 0) {
    setErr(
      `Sepette ${cartExpirySettings.hours} saati dolduran ${expiryResult.movedToFavorites} ürün, güncel kur değişimi nedeniyle favorilere taşındı. Lütfen sepetinizi güncelleyin.`
    );
    // Sepeti yenile — cart:changed event'i tetiklenecek
    window.dispatchEvent(new Event("cart:changed"));
    return;
  } else if (expiryResult.expired.length > 0) {
    setErr(
      `Sepette ${cartExpirySettings.hours} saati dolduran ${expiryResult.expired.length} ürün kaldırıldı. Lütfen sepetinizi güncelleyin.`
    );
    window.dispatchEvent(new Event("cart:changed"));
    return;
  }

  const v = validate();
  if (v) {
    setErr(v);
    return;
  }

  try {
    setSaving(true);

    const checkoutDraft = {
      locale: loc === "en" ? "en" : "tr",
   packaging: {
  giftPackage: giftPackageInfo.enabled,
  giftWrap: giftPackageInfo.enabled,
  gift: giftPackageInfo.enabled,
  serviceId: giftPackageInfo.serviceId,
  code: giftPackageInfo.code,
  title: giftPackageInfo.title,
  priceTry: giftPackageInfo.priceTry,
  note: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
  message: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
},
giftPackage: giftPackageInfo.enabled,
giftWrap: giftPackageInfo.enabled,
giftNote: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
giftMessage: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
giftPackageNote: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
productCustomText,
productTexts: productTextRows.map((row) => ({
  productKey: row.key,
  productId: String(row.item?.productId || row.product?.id || "").trim(),
  slug: String(row.item?.slug || row.product?.slug || "").trim(),
  sku: String(row.item?.sku || row.product?.sku || "").trim(),
  title: row.item?.title || row.product?.title || null,
  serviceId: String(row.service?.id || "").trim(),
  serviceCode: String(row.service?.code || "").trim(),
  label: row.label,
  text: safeStr(productCustomText[row.key]),
})),
      customerProfile: {
        firstName: String(profileData?.firstName || "").trim(),
        lastName: String(profileData?.lastName || "").trim(),
        phone: String(profileData?.phone || "").trim(),
        email: String(user?.email || "").trim(),
        tcNo: normalizeTcNo(getProfileTc(profileData)),
        birthDate: normalizeBirthDate(getProfileBirthDate(profileData)),
        coupon: activeCoupon
          ? {
              code: activeCoupon.code,
              label: activeCoupon.label,
              discountType: activeCoupon.discountType,
              discountValue: activeCoupon.discountValue,
            }
          : null,
      },

      shippingAddress: {
        fullName:
          `${String(addr.firstName || "").trim()} ${String(addr.lastName || "").trim()}`.trim() ||
          String(addr.fullName || "").trim(),

        phone: addr.phone?.trim() || "",
        city: addr.city?.trim() || "",
        district: addr.district?.trim() || "",
        addressLine: normalizeAddressLine(addr.addressLine),
        postalCode: addr.postalCode?.trim() || "",
        note: addr.note?.trim() || "",

        invoiceType: addr.invoiceType === "company" ? "company" : "individual",

        firstName: String(addr.firstName || "").trim(),
        lastName: String(addr.lastName || "").trim(),

        nationalId:
          addr.invoiceType === "individual"
            ? String(addr.nationalId || "").trim()
            : "",

        companyName:
          addr.invoiceType === "company"
            ? String(addr.companyName || "").trim()
            : "",

        taxNumber:
          addr.invoiceType === "company"
            ? String(addr.taxNumber || "").trim()
            : "",

        taxOffice:
          addr.invoiceType === "company"
            ? String(addr.taxOffice || "").trim()
            : "",
      },

      items: pricedItems.map((it: any) => ({
  productId: String(it.productId || "").trim(),
  slug: String(it.slug || "").trim(),
  qty: Math.max(1, Math.min(99, Math.floor(Number(it.qty || 1)))),

  unitPriceTry: Math.max(0, Number(it.resolvedUnitPrice || 0)),
  resolvedUnitPrice: Math.max(0, Number(it.resolvedUnitPrice || 0)),
  priceTry: Math.max(0, Number(it.resolvedUnitPrice || 0)),
  lineTry:
    Math.max(0, Number(it.resolvedUnitPrice || 0)) *
    Math.max(1, Math.min(99, Math.floor(Number(it.qty || 1)))),

  selectedSize: String(it.selectedSize || "").trim(),

  ...(it.variant && Object.keys(it.variant).length ? { variant: it.variant } : {}),
  ...(it.selectedVariants && Object.keys(it.selectedVariants).length
    ? { selectedVariants: it.selectedVariants }
    : {}),
  ...(Array.isArray(it.selectedVariantItems) && it.selectedVariantItems.length
    ? { selectedVariantItems: it.selectedVariantItems }
    : {}),

  selectedVariantGram: Number(it.selectedVariantGram || 0),
  weightGram: Number(it.selectedVariantGram || 0),
  hasGram: Number(it.selectedVariantGram || 0),
  customText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
productCustomText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
engravingText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
})),

    clientQuote: {
  totalTry: totals.total,
  subtotalTry: totals.subtotal,
  shippingFeeTry: totals.shippingFee,
  discountTry: totals.discount,
  serviceTotalTry: totals.serviceTotal,

  giftNote: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
  giftMessage: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
  giftPackageNote: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
  note: giftPackageInfo.enabled ? safeStr(giftPackageNote) : "",
  productCustomText,
productTexts: productTextRows.map((row) => ({
  productKey: row.key,
  productId: String(row.item?.productId || row.product?.id || "").trim(),
  slug: String(row.item?.slug || row.product?.slug || "").trim(),
  sku: String(row.item?.sku || row.product?.sku || "").trim(),
  title: row.item?.title || row.product?.title || null,
  serviceId: String(row.service?.id || "").trim(),
  serviceCode: String(row.service?.code || "").trim(),
  label: row.label,
  text: safeStr(productCustomText[row.key]),
})),
  selectedServices: serviceCampaigns
    .filter((service: any) => {
      
      const id = String(service.id || "").trim();
      return id && selectedServices[id] === true;
    })
    .map((service: any) => {
      const freeOverTry = Number(service.freeOverTry || 0);
      const servicePriceTry = Number(service.servicePriceTry || 0);
      const isFree = freeOverTry > 0 && totals.subtotal >= freeOverTry;

    return {

  id: String(service.id || "").trim(),

  code: String(service.code || "").trim(),

  title: service.title || null,

  priceTry: isFree ? 0 : Math.max(0, servicePriceTry),

  freeOverTry,

  isGiftPackage:

    String(service.code || "").toLocaleLowerCase("tr-TR").includes("gift") ||

    String(service.code || "").toLocaleLowerCase("tr-TR").includes("hediye") ||

    pickCampaignText(service.title, "tr").toLocaleLowerCase("tr-TR").includes("hediye") ||

    pickCampaignText(service.title, "en").toLocaleLowerCase("tr-TR").includes("gift"),

};
    }),
items: pricedItems.map((it: any) => {
  const qty = Math.max(1, Math.min(99, Math.floor(Number(it.qty || 1))));
  const unitPriceTry = Math.max(0, Number(it.resolvedUnitPrice || 0));
  const selectedVariantGram = Number(it.selectedVariantGram || getSelectedVariantGramFromItem(it) || 0);

  return {
    productId: String(it.productId || "").trim(),
    slug: String(it.slug || "").trim(),
    qty,

    unitPriceTry,
    resolvedUnitPrice: unitPriceTry,
    priceTry: unitPriceTry,
    lineTry: unitPriceTry * qty,

    title: it.title || null,
    image: pickOrderItemImage(it, productMap),

    selectedSize: String(it.selectedSize || "").trim(),

    ...(it.variant && Object.keys(it.variant).length ? { variant: it.variant } : {}),
    ...(it.selectedVariants && Object.keys(it.selectedVariants).length
      ? { selectedVariants: it.selectedVariants }
      : {}),
    ...(Array.isArray(it.selectedVariantItems) && it.selectedVariantItems.length
      ? { selectedVariantItems: it.selectedVariantItems }
      : {}),

    selectedVariantGram,
    weightGram: selectedVariantGram,
    hasGram: selectedVariantGram,
    customText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
productCustomText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
engravingText: safeStr(productCustomText[getProductTextKey(it, getProductFromMap(productMap, it))]),
  };
}),
      },
    };

    sessionStorage.setItem("nci_checkout_draft_v1", JSON.stringify(checkoutDraft));
    router.push("/checkout/pay");
  } catch (e) {
    console.error("checkout draft error:", e);
    setErr(loc === "en" ? "Checkout could not be prepared." : "Checkout hazırlanamadı.");
  } finally {
    setSaving(false);
  }
}
const missingProfileFields = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!isRealUser) return [];
  return getMissingProfileFields(profileData, user);
}, [isRealUser, profileData, user]);

const profileReadyForCheckout = true; // eslint-disable-line @typescript-eslint/no-unused-vars

const tUI = useMemo(() => {
  const en = loc === "en";

  return {
    title: en ? "Secure Checkout" : "Güvenli Alışveriş",
    subtitle: en
      ? "Review your delivery details and complete your order securely."
      : "Teslimat bilgilerini kontrol et, siparişi güvenle tamamla.",

    orderKicker: en ? "Order" : "Sipariş",
    back: en ? "Back to cart" : "Sepete dön",

    ssl: en ? "SSL Secure" : "SSL Güvenli",
    freeShipping: en ? "Free Shipping" : "Ücretsiz Kargo",
    orderProtection: en ? "Order Protection" : "Sipariş Koruması",

    delivery: en ? "Delivery Details" : "Teslimat Bilgileri",
    deliveryDesc: en
      ? "Select or update your delivery address."
      : "Teslimat adresini seç veya güncelle.",

    saved: en ? "Saved Addresses" : "Kayıtlı Adresler",
    savedDesc: en
      ? "The default / selected address is shown. You can change it."
      : "Varsayılan / seçili adres gösterilir. İstersen değiştir.",

    addAddr: en ? "Add / edit addresses" : "Adres ekle / düzenle",

    loadingTitle: en ? "Loading" : "Yükleniyor",
    loadingDesc: en
      ? "Checking account details…"
      : "Hesap bilgileri kontrol ediliyor…",

    signInTitle: en ? "Please sign in" : "Giriş yap",
    signInDesc: en
      ? "You need an account to continue checkout."
      : "Siparişinize devam etmek için hesabınızla giriş yapmanız gerekiyor.",
    login: en ? "Login" : "Giriş Yap",
    register: en ? "Register" : "Kayıt Ol",
    guestContinue: en ? "Continue without account" : "Kayıt olmadan devam et",

    hide: en ? "Hide" : "Kapat",
    change: en ? "Change" : "Değiştir",
    edit: en ? "Edit" : "Düzenle",

    defaultAddr: en ? "Default" : "Varsayılan",

    deliveryForm: en ? "Delivery Form" : "Teslimat Formu",
    deliveryFormDesc: en
      ? "Check the selected address fields. Edit if needed."
      : "Seçilen adres alanlarını kontrol et. Gerekirse düzenle.",

    invoiceType: en ? "Invoice Type" : "Fatura Tipi",
    individual: en ? "Individual" : "Bireysel",
    company: en ? "Company" : "Kurumsal",

    fullName: en ? "Full name" : "Ad Soyad",
    phone: en ? "Phone" : "Telefon",
    city: en ? "City" : "Şehir",
    district: en ? "District" : "İlçe",
    address: en ? "Address" : "Adres",
    postal: en ? "Postal code" : "Posta Kodu",
    postalOptional: en ? "Postal code (optional)" : "Posta Kodu (opsiyonel)",
    note: en ? "Note" : "Not",
    noteOptional: en ? "Note (optional)" : "Not (opsiyonel)",

    nationalId: en ? "National ID" : "TC Kimlik No",
    nationalIdOptional: en ? "National ID (optional)" : "TC Kimlik No (opsiyonel)",
    companyName: en ? "Company Name" : "Firma Adı",
    taxNumber: en ? "Tax Number" : "Vergi Numarası",
    taxOffice: en ? "Tax Office" : "Vergi Dairesi",

    verifiedNote: en
      ? "Your account is verified. You are ready to create an order."
      : "Hesabın doğrulanmış. Sipariş oluşturmaya hazırsın.",
    verifyHint: en
      ? "You can also make email verification required before checkout."
      : "İstersen sipariş öncesi e-posta doğrulamasını zorunlu hale de getiririz.",

    cancel: en ? "Cancel" : "Vazgeç",
    saveAddress: en ? "Save Address" : "Adresi Kaydet",
    savingAddress: en ? "Saving..." : "Kaydediliyor...",
    addressUpdated: en ? "Address updated." : "Adres güncellendi.",
    addressPrepared: en
      ? "Address prepared for checkout."
      : "Adres checkout için hazırlandı.",

    summary: en ? "Order Summary" : "Sipariş Özeti",
    productCount: en ? "products" : "ürün",
    qtyCount: en ? "pcs" : "adet",
    emptyCart: en ? "Cart is empty." : "Sepet boş.",

    coupon: en ? "Coupon" : "Kupon",
    couponDesc: en
      ? "Apply your campaign coupon before payment."
      : "Ödeme öncesi kampanya kuponunu uygula.",
    myCoupons: en ? "My Coupons" : "Kuponlarım",
    noCouponSelected: en ? "No coupon selected" : "Kupon seçilmedi",
    noActiveCoupons: en
      ? "No active coupons found in your account."
      : "Hesabında aktif kupon görünmüyor.",
    enterCoupon: en ? "Enter coupon code" : "Kupon kodu gir",
    apply: en ? "Apply" : "Uygula",
    checking: en ? "Checking..." : "Kontrol ediliyor...",
    applied: en ? "Applied:" : "Uygulandı:",
    couponNotFound: en ? "Coupon not found." : "Kupon bulunamadı.",
    couponCheckFailed: en ? "Coupon check failed." : "Kupon kontrolü başarısız.",

    dynamicPrice: en ? "Rate based" : "Kur bazlı",

    subtotal: en ? "Subtotal" : "Ara Toplam",
    shipping: en ? "Shipping" : "Kargo",
    discount: en ? "Discount" : "İndirim",
    total: en ? "Total" : "Toplam",

    rateTitle: en ? "Rate Refresh" : "Kur Güncelleme",
    rateSubOn: en
      ? "Rate-based product prices refresh automatically."
      : "Kur bazlı ürün fiyatları otomatik yenilenir.",

    checkoutDisabled: en
      ? "Checkout is temporarily disabled."
      : "Satış şu anda geçici olarak kapalı.",
    salesClosedTitle: en ? "Sales are temporarily closed" : "Satış şu anda kapalı",
    salesClosedText: en
      ? "Order creation has been temporarily disabled by the store."
      : "Mağaza tarafından sipariş oluşturma geçici olarak durduruldu.",

    create: en ? "Proceed to payment" : "Ödemeye Geç",
    creating: en ? "Redirecting to payment…" : "Ödemeye yönlendiriliyor…",

    assuranceOrder: en ? "Secure order record" : "Güvenli sipariş kaydı",
    assuranceTracking: en ? "Post-order tracking screen" : "Sipariş sonrası takip ekranı",
    assuranceShipping: en ? "Free shipping support" : "Ücretsiz kargo desteği",

    paymentNote: en
      ? "Your checkout details are prepared securely first, then you continue to the payment step."
      : "Sipariş bilgilerin önce güvenli şekilde hazırlanır, ardından ödeme adımına geçersin.",

    guestModalKicker: "CHECKOUT",
    guestModalTitle: en ? "Continue without account" : "Kayıt olmadan devam et",
    guestModalDesc: en
      ? "Fill in your email and delivery details. Your account will be created automatically."
      : "E-posta ve teslimat bilgilerini doldur. Hesabın otomatik oluşturulsun.",
    email: en ? "Email" : "E-posta",
    emailPlaceholder: "ornek@mail.com",
    firstName: en ? "Recipient first name" : "Alıcı adı",
    lastName: en ? "Recipient last name" : "Alıcı soyadı",
    phonePlaceholder: "05xx xxx xx xx",
    selectCity: en ? "Select city" : "Şehir seç",
    selectDistrict: en ? "Select district" : "İlçe seç",
    selectCityFirst: en ? "Select city first" : "Önce şehir seç",
    addressLine1: en ? "Address line" : "Adres satırı",
    addressLine1Placeholder: en
      ? "Neighborhood, street, building no..."
      : "Mahalle, sokak, bina no...",
    addressLine2: en ? "Address line 2 (optional)" : "Adres satırı 2 (opsiyonel)",
    addressLine2Placeholder: en ? "Apartment, floor..." : "Daire, kat...",
    createAccountAndContinue: en
      ? "Create account and continue"
      : "Hesabı oluştur ve devam et",
    creatingAccount: en ? "Creating account..." : "Hesap oluşturuluyor...",

    validationEmail: en ? "Enter a valid email." : "Geçerli bir e-posta gir.",
    validationFirstName: en ? "Recipient first name is required." : "Alıcı adı zorunlu.",
    validationLastName: en ? "Recipient last name is required." : "Alıcı soyadı zorunlu.",
    validationPhone: en ? "Enter a valid phone number." : "Geçerli bir telefon gir.",
    validationCity: en ? "Select city." : "Şehir seç.",
    validationDistrict: en ? "Select district." : "İlçe seç.",
    validationAddress: en ? "Address line is required." : "Adres satırı zorunlu.",
    validationPostal: en ? "Postal code must be 5 digits." : "Posta kodu 5 haneli olmalı.",
    validationNationalId: en
      ? "National ID must be 11 digits."
      : "TC kimlik no 11 haneli olmalı.",
    validationCompanyName: en ? "Company name is required." : "Firma adı zorunlu.",
    validationTaxNumber: en ? "Enter a valid tax number." : "Geçerli bir vergi numarası gir.",
    validationTaxOffice: en ? "Tax office is required." : "Vergi dairesi zorunlu.",
    addressSaveFailed: en ? "Address could not be saved." : "Adres kaydedilemedi.",
    guestCheckoutFailed: en
      ? "Guest checkout could not be started."
      : "Misafir checkout başlatılamadı.",
  };
}, [loc]);
async function startGuestCheckout() {
  const v = validateGuestCheckoutForm(guestForm, loc);
  if (v) {
    setGuestErr(v);
    return;
  }

  try {
    setGuestBusy(true);
    setGuestErr("");

    const functions = getFunctions(getFirebaseApp(), "europe-west1");
    const callable = httpsCallable(functions, "guestCheckoutStartV1");

    const res: any = await callable({
      email: guestForm.email.trim(),
      invoiceType: guestForm.invoiceType,

      firstName: guestForm.firstName.trim(),
      lastName: guestForm.lastName.trim(),
      phone: guestForm.phone.replace(/\D+/g, ""),

      cityId: guestForm.cityId,
      cityName: guestForm.cityName,
      districtId: guestForm.districtId,
      districtName: guestForm.districtName,

      line1: normalizeAddressLine(guestForm.line1),
line2:
  normalizeAddressLine(guestForm.line2) === normalizeAddressLine(guestForm.line1)
    ? ""
    : normalizeAddressLine(guestForm.line2),
      postalCode: guestForm.postalCode.replace(/\D+/g, ""),

      nationalId:
        guestForm.invoiceType === "individual"
          ? guestForm.nationalId.replace(/\D+/g, "")
          : "",

      companyName:
        guestForm.invoiceType === "company"
          ? guestForm.companyName.trim()
          : "",

      taxNumber:
        guestForm.invoiceType === "company"
          ? guestForm.taxNumber.replace(/\D+/g, "")
          : "",

      taxOffice:
        guestForm.invoiceType === "company"
          ? guestForm.taxOffice.trim()
          : "",
    });

    const data = res?.data || {};
    const customToken = String(data.customToken || "").trim();
    const uid = String(data.uid || "").trim();
    const addressId = String(data.addressId || "").trim();

    if (!customToken || !uid) {
      throw new Error(
        loc === "en"
          ? "Account could not be created."
          : "Hesap oluşturulamadı."
      );
    }

    await signInWithCustomToken(auth, customToken);

    // Guest sepeti yeni kullanıcının sepetine taşı
    // (localStorage key nci_cart_guest → nci_cart_{uid})
    mergeGuestCartToUser(uid);

    try {
      await sendPasswordResetEmail(auth, guestForm.email.trim());
    } catch (e) {
      console.error("password reset mail send error:", e);
    }

    setGuestOpen(false);

    if (addressId) {
      setSelectedAddrId(addressId);
    }

    // Adresi doğrudan guestForm'dan set et — Firestore snapshot'ı beklemeye gerek yok
    setAddr({
      fullName: `${guestForm.firstName.trim()} ${guestForm.lastName.trim()}`.trim(),
      phone: guestForm.phone.replace(/\D+/g, ""),
      city: guestForm.cityName,
      district: guestForm.districtName,
      addressLine: normalizeAddressLine(guestForm.line1),
      postalCode: guestForm.postalCode.replace(/\D+/g, ""),
      note: "",
      invoiceType: guestForm.invoiceType === "company" ? "company" : "individual",
      firstName: guestForm.firstName.trim(),
      lastName: guestForm.lastName.trim(),
      nationalId:
        guestForm.invoiceType === "individual"
          ? guestForm.nationalId.replace(/\D+/g, "")
          : "",
      companyName:
        guestForm.invoiceType === "company" ? guestForm.companyName.trim() : "",
      taxNumber:
        guestForm.invoiceType === "company"
          ? guestForm.taxNumber.replace(/\D+/g, "")
          : "",
      taxOffice:
        guestForm.invoiceType === "company" ? guestForm.taxOffice.trim() : "",
    });

    // Kısa bekleme: auth token'ın oturmasını bekle, ardından ödeme sayfasına git
    setTimeout(() => {
      proceedToPayment();
    }, 800);
} catch (e: any) {
  console.error("guest checkout start error full:", e);

  const code = String(e?.code || "");
  const message =
    typeof e?.message === "string" && e.message.trim()
      ? e.message.trim()
      : "";

  const details =
    typeof e?.details === "string"
      ? e.details
      : e?.details?.message || "";

  setGuestErr(
    details ||
      message ||
      (code
        ? `Hata: ${code}`
        : "Misafir checkout başlatılamadı.")
  );
} finally {
  setGuestBusy(false);
}
}
  return (
    <main className={s.page}>
      <CheckoutHero
  orderKicker={tUI.orderKicker}
  title={tUI.title}
  subtitle={tUI.subtitle}
  ssl={tUI.ssl}
  freeShipping={tUI.freeShipping}
  orderProtection={tUI.orderProtection}
  back={tUI.back}
/>

      <CheckoutProgressBar currentStep="info" />

      {err ? <div className={s.alert}>{err}</div> : null}

      <div className={s.grid}>
        <section className={s.leftCol}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>{tUI.delivery}</h2>
               <p className={s.cardDesc}>{tUI.deliveryDesc}</p>
              </div>

              {uid ? (
                <Link className={s.miniLink} href="/hesabim?tab=addresses">
                  {tUI.addAddr} →
                </Link>
              ) : null}
            </div>

            {!authReady ? (
              <div className={s.signCard}>
                <div className={s.signTitle}>{tUI.loadingTitle}</div>
<div className={s.signDesc}>{tUI.loadingDesc}</div>
              </div>
            ) : !isRealUser ? (
              <div className={s.signCard}>
                <div className={s.signTitle}>{tUI.signInTitle}</div>
                <div className={s.signDesc}>{tUI.signInDesc}</div>
                <div className={s.signActions}>
                  <Link className={s.primaryBtn} href="/login">
                    {tUI.login}
                  </Link>

                  <Link className={s.ghostBtn} href="/register">
                    {tUI.register}
                  </Link>

                  <button
                    type="button"
                    className={s.ghostBtn}
                    onClick={() => {
                      setGuestErr("");
                      setGuestOpen(true);
                    }}
                  >
                    {loc === "en" ? "Continue without account" : "Kayıt olmadan devam et"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                        {addrList.length ? (
          <div className={s.accordion}>
            <div className={s.accHead}>
              <div>
                <div className={s.accTitle}>{tUI.saved}</div>
               <div className={s.accSub}>{tUI.savedDesc}</div>
              </div>

              <button
                type="button"
                className={s.accToggle}
                onClick={() => setAddrOpen((v) => !v)}
                aria-expanded={addrOpen}
              >
                {addrOpen ? (loc === "en" ? "Hide" : "Kapat") : (loc === "en" ? "Change" : "Değiştir")}
              </button>
            </div>

          {/* seçili adres kartı */}
          {(() => {
            const selected = addrList.find((x) => x.id === selectedAddrId) || addrList[0];
            if (!selected) return null;

            return (
              <div className={s.addrSelected}>
                <div className={s.addrTop}>
                  <div className={s.addrName}>
                    {selected.title}
                {selected.isDefault ? <span className={s.addrPill}>{tUI.defaultAddr}</span> : null}                  </div>
                </div>
                <div className={s.addrLine}>
                  <b>{selected.fullName || "—"}</b> • {selected.phone || "—"}
                </div>
                <div className={s.addrLineMuted}>
                  {selected.city || "—"} / {selected.district || "—"}
                </div>
                <div className={s.addrLineMuted} title={selected.addressLine}>
                  {selected.addressLine || "—"}
                </div>
              </div>
            );
          })()}

          {/* açılınca tüm adres listesi */}
          {addrOpen ? (
            <div className={s.addrGrid}>
              {addrList.slice(0, 8).map((a) => {
                const on = a.id === selectedAddrId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`${s.addrCard} ${on ? s.addrCardOn : ""}`}
                    onClick={() => {
                      setSelectedAddrId(a.id);
                      setAddrOpen(false); // seçince kapat
                    }}
                  >
                    <div className={s.addrTop}>
                      <div className={s.addrName}>
                        {a.title}
                        {a.isDefault ? <span className={s.addrPill}>Varsayılan</span> : null}
                      </div>
                      <span className={`${s.addrCheck} ${on ? s.addrCheckOn : ""}`} />
                    </div>

                    <div className={s.addrLine}>
                      <b>{a.fullName || "—"}</b> • {a.phone || "—"}
                    </div>
                    <div className={s.addrLineMuted}>
                      {a.city || "—"} / {a.district || "—"}
                    </div>
                    <div className={s.addrLineMuted} title={a.addressLine}>
                      {a.addressLine || "—"}
                    </div>
                  </button>
                );
                    })}
            </div>
          ) : null}
        </div>
      ) : null}

<div className={s.accordion}>
  <div className={s.accHead}>
    <div>
      <div className={s.accTitle}>{tUI.deliveryForm}</div>
<div className={s.accSub}>{tUI.deliveryFormDesc}</div>
    </div>

    <button
      type="button"
      className={s.sectionToggleBtn}
      onClick={() => setFormOpen((v) => !v)}
    >
      {formOpen ? (loc === "en" ? "Hide" : "Kapat") : (loc === "en" ? "Edit" : "Düzenle")}
    </button>
  </div>

  {formOpen ? (
    <div className={s.formWrap}>
      <div className={s.form}>
      <div className={s.grid2}>
        <div className={s.grid2}>
  <label className={s.field}>
    <span>{tUI.invoiceType}</span>
    <select
      value={addr.invoiceType || "individual"}
      onChange={(e) =>
        setAddr((p) => ({
          ...p,
          invoiceType: e.target.value === "company" ? "company" : "individual",
          ...(e.target.value === "company"
            ? { nationalId: "" }
            : { companyName: "", taxNumber: "", taxOffice: "" }),
        }))
      }
    >
     <option value="individual">{tUI.individual}</option>
<option value="company">{tUI.company}</option>
    </select>
  </label>
</div>
        <label className={s.field}>
          <span>{tUI.fullName}</span>
          <input
            value={addr.fullName}
            onChange={(e) => setAddr((p) => ({ ...p, fullName: e.target.value }))}
          />
        </label>

        <label className={s.field}>
          <span>{tUI.phone}</span>
          <input
            value={addr.phone}
            onChange={(e) => setAddr((p) => ({ ...p, phone: e.target.value }))}
          />
        </label>

        <label className={s.field}>
          <span>{tUI.city}</span>
          <input
            value={addr.city}
            onChange={(e) => setAddr((p) => ({ ...p, city: e.target.value }))}
          />
        </label>

        <label className={s.field}>
          <span>{tUI.district}</span>
          <input
            value={addr.district}
            onChange={(e) => setAddr((p) => ({ ...p, district: e.target.value }))}
          />
        </label>
      </div>

      <label className={s.field}>
        <span>{tUI.address}</span>
       <textarea
  value={addr.addressLine}
  onChange={(e) =>
    setAddr((p) => ({
      ...p,
      addressLine: e.target.value,
    }))
  }
  onBlur={() =>
    setAddr((p) => ({
      ...p,
      addressLine: normalizeAddressLine(p.addressLine),
    }))
  }
  rows={5}
/>
      </label>

      <div className={s.grid2}>
        <label className={s.field}>
          <span>{tUI.postal}</span>
          <input
            value={addr.postalCode || ""}
            onChange={(e) => setAddr((p) => ({ ...p, postalCode: e.target.value }))}
          />
        </label>
{(addr.invoiceType || "individual") === "individual" ? (
  <div className={s.grid2}>
    <label className={s.field}>
     <span>{tUI.nationalId}</span>
      <input
        value={addr.nationalId || ""}
        onChange={(e) =>
          setAddr((p) => ({
            ...p,
            nationalId: e.target.value.replace(/\D+/g, "").slice(0, 11),
          }))
        }
      />
    </label>
  </div>
) : null}
{(addr.invoiceType || "individual") === "company" ? (
  <div className={s.grid2}>
    <label className={s.field}>
     <span>{tUI.companyName}</span>
      <input
        value={addr.companyName || ""}
        onChange={(e) =>
          setAddr((p) => ({ ...p, companyName: e.target.value }))
        }
      />
    </label>

    <label className={s.field}>
      <span>{tUI.taxNumber}</span>
      <input
        value={addr.taxNumber || ""}
        onChange={(e) =>
          setAddr((p) => ({
            ...p,
            taxNumber: e.target.value.replace(/\D+/g, "").slice(0, 11),
          }))
        }
      />
    </label>

    <label className={s.field}>
      <span>{tUI.taxOffice}</span>
      <input
        value={addr.taxOffice || ""}
        onChange={(e) =>
          setAddr((p) => ({ ...p, taxOffice: e.target.value }))
        }
      />
    </label>
  </div>
) : null}
        <label className={s.field}>
          <span>{tUI.note}</span>
          <input
            value={addr.note || ""}
            onChange={(e) => setAddr((p) => ({ ...p, note: e.target.value }))}
          />
        </label>
      </div>

      {!emailVerified ? (
        <div className={s.miniNote}>{tUI.verifyHint}</div>
      ) : (
        <div className={s.okNote}>{tUI.verifiedNote}</div>
      )}
      <div className={s.formActions}>
  <button
    type="button"
    className={s.ghostBtn}
    onClick={() => {
      setFormOpen(false);
      setAddrMsg("");
    }}
    disabled={addrSaving}
  >
    {tUI.cancel}
  </button>

  <button
    type="button"
    className={s.primaryBtn}
    onClick={saveEditedAddress}
    disabled={addrSaving}
  >
{addrSaving ? tUI.savingAddress : tUI.saveAddress}  </button>
</div>
    </div>
  </div>
) : (
  <div className={s.formPreviewBox}>
    <div className={s.formPreviewRow}>
      <b>{tUI.fullName}:</b> {addr.fullName || "—"}
    </div>
    <div className={s.formPreviewRow}>
      <b>{tUI.phone}:</b> {addr.phone || "—"}
    </div>
    <div className={s.formPreviewRow}>
      <b>{tUI.city}/{tUI.district}:</b> {[addr.city, addr.district].filter(Boolean).join(" / ") || "—"}
    </div>
    <div className={s.formPreviewRow}>
     <b>{tUI.address}:</b> {addr.addressLine || "—"}
    </div>
    {addr.postalCode ? (
      <div className={s.formPreviewRow}>
       <b>{tUI.postal}:</b> {addr.postalCode}
      </div>
    ) : null}
    {addr.note ? (
      <div className={s.formPreviewRow}>
       <b>{tUI.note}:</b> {addr.note}
      </div>
    ) : null}
    
    <div className={s.formPreviewRow}>
 <b>{tUI.invoiceType}:</b> {addr.invoiceType === "company" ? tUI.company : tUI.individual}
</div>

{(addr.invoiceType || "individual") === "individual" && addr.nationalId ? (
  <div className={s.formPreviewRow}>
   <b>{tUI.nationalId}:</b> {addr.nationalId}
  </div>
) : null}

{(addr.invoiceType || "individual") === "company" ? (
  <>
    <div className={s.formPreviewRow}>
     <b>{tUI.companyName}:</b> {addr.companyName || "—"}
    </div>
    <div className={s.formPreviewRow}>
      <b>{tUI.taxNumber}:</b> {addr.taxNumber || "—"}
    </div>
    <div className={s.formPreviewRow}>
     <b>{tUI.taxOffice}:</b> {addr.taxOffice || "—"}
    </div>
  </>
) : null}
  </div>
)}
</div>
              </>
            )}
          </div>
        </section>

        <aside className={s.rightCol}>
          <div className={`${s.card} ${s.sticky}`}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>{tUI.summary}</h2>
                <p className={s.cardDesc}>
                 {items.length} {tUI.productCount} • {totalQty} {tUI.qtyCount}
                </p>
              </div>
            </div>
<div className={s.hr} />

<div className={s.couponBox}>
  <div className={s.couponHead}>
    <div className={s.couponTitle}>{tUI.coupon}</div>
<div className={s.couponSub}>{tUI.couponDesc}</div>
  </div>

  {uid ? (
    accountCoupons.length ? (
      <label className={s.field}>
      <span>{tUI.myCoupons}</span>
        <select
          value={selectedCouponCode}
          onChange={(e) => {
            setSelectedCouponCode(e.target.value);
            setCouponErr("");
          }}
        >
        <option value="">{tUI.noCouponSelected}</option>
          {accountCoupons.map((c) => (
            <option
              key={c.code}
              value={c.code}
              disabled={Number(c.minCartAmount || 0) > totals.subtotal}
            >
              {c.label} — {c.code}
              {Number(c.minCartAmount || 0) > totals.subtotal
                ? ` (Min. ${fmtTRY(Number(c.minCartAmount || 0))})`
                : ""}
            </option>
          ))}
        </select>
      </label>
    ) : (
<div className={s.miniNote}>{tUI.noActiveCoupons}</div>    )
  ) : (
    <>
      <div className={s.couponInline}>
        <input
          className={s.couponInput}
          value={guestCouponCode}
          onChange={(e) => {
            setGuestCouponCode(e.target.value.toUpperCase());
            setCouponErr("");
          }}
          placeholder={tUI.enterCoupon}
        />
        <button
          type="button"
          className={s.ghostBtn}
          onClick={applyGuestCoupon}
          disabled={guestCouponChecking}
        >
          {guestCouponChecking ? tUI.checking : tUI.apply}
        </button>
      </div>
    </>
  )}

  {activeCoupon ? (
    <div className={s.couponApplied}>
      <strong>{tUI.applied}</strong>{activeCoupon.label} ({activeCoupon.code})
    </div>
  ) : null}

  {couponErr ? <div className={s.alert}>{couponErr}</div> : null}
</div>
            {items.length === 0 ? (
              <div className={s.empty}>{tUI.emptyCart}</div>
            ) : (
              <>
                <div className={s.sumList}>
                  {pricedItems.map((it: any, i) => (
                   <div key={`${it.productId}-${i}`} className={s.sumRowCard}>
                   <div className={s.sumThumb}>
                     <img
                       src={pickOrderItemImage(it, productMap)}
                       alt={loc === "en" ? pickTitle(it).en : pickTitle(it).tr}
                       loading="lazy"
                     />
                   </div>
                 
                   <div className={s.sumMid}>
                     <div className={s.sumNameRow}>
                       <div className={s.sumName}>
                         {loc === "en" ? pickTitle(it).en : pickTitle(it).tr}
                       </div>
                       <span className={s.mul}>× {it.qty}</span>
                     </div>
                 
                     {it.sku ? <div className={s.sumSku}>SKU: {it.sku}</div> : null}

                  {it.selectedSize ? (
                    <div className={s.sumOptionPill}>
                      {loc === "en" ? "Ring size" : "Yüzük Ölçünüz"}: {it.selectedSize}
                    </div>
                  ) : null}
{Number(it.selectedVariantGram || 0) > 0 ? (
  <div className={s.sumOptionPill}>
    {loc === "en" ? "Weight" : "Gram"}: {Number(it.selectedVariantGram).toFixed(2)} gr
  </div>
) : null}
                  {Array.isArray(it.selectedVariantItems) &&
                  it.selectedVariantItems.filter((v: any) => String(v?.groupId || "").trim() !== "ring_size").length ? (
                    <div className={s.sumOptionLine}>
                      {it.selectedVariantItems
                        .filter((v: any) => String(v?.groupId || "").trim() !== "ring_size")
                        .map((v: any) => `${v.groupLabel}: ${v.label}`)
                        .join(" • ")}
                    </div>
                  ) : null}
                </div>
                 
                   <div className={s.sumVal}>
                     {fmtTRY(toNum(it.resolvedUnitPrice, 0) * toNum(it.qty, 0))}
                   </div>
                 </div>
                  ))}
                </div>

                <div className={s.hr} />

               <div className={s.totals}>
  <CheckoutRow label={tUI.subtotal} val={fmtTRY(totals.subtotal)} />
  <CheckoutRow label={tUI.shipping} val={fmtTRY(totals.shippingFee)} />

  {totals.serviceTotal > 0 ? (
    <CheckoutRow label={loc === "en" ? "Extra service" : "Ek hizmet"} val={fmtTRY(totals.serviceTotal)} />
  ) : null}

  <CheckoutRow label={tUI.discount} val={fmtTRY(totals.discount)} />
  <CheckoutRow label={tUI.total} val={fmtTRY(totals.total)} strong />
</div>
{campaignResult.campaign ? (
  <div className={s.campaignBox}>
    <div>
      <span className={s.campaignKicker}>Kampanya</span>
      <b>{pickCampaignText(campaignResult.campaign.title, loc)}</b>
      <small>{pickCampaignText(campaignResult.campaign.description, loc)}</small>
    </div>

    <strong>
      {String(campaignResult.campaign.discountType) === "fixed"
        ? fmtTRY(campaignResult.campaign.discountValue || 0)
        : `%${campaignResult.campaign.discountValue || 0}`}
    </strong>
  </div>
) : null}
{serviceCampaigns.length ? (
  <div className={s.serviceList}>
    {serviceCampaigns.map((service: any) => {
      const id = String(service.id || "").trim();
      if (!id) return null;

      const selected = selectedServices[id] === true;

      const title =
        pickCampaignText(service.title, loc) ||
        (loc === "en" ? "Extra service" : "Ek hizmet");

      const desc = pickCampaignText(service.subtitle || service.description, loc);

      const freeOverTry = Number(service.freeOverTry || 0);
      const servicePriceTry = Number(service.servicePriceTry || 0);
      const isFree = freeOverTry > 0 && totals.subtotal >= freeOverTry;

      return (
        <div key={id} className={s.serviceBox}>
          <div className={s.serviceText}>
            <span className={s.serviceKicker}>
              {loc === "en" ? "Extra Service" : "Ek Hizmet"}
            </span>

            <b>{title}</b>

            {desc ? <small>{desc}</small> : null}

            <em>
              {isFree
                ? loc === "en"
                  ? "Free for this order"
                  : "Bu sipariş için ücretsiz"
                : servicePriceTry > 0
                ? `${loc === "en" ? "Extra fee" : "Ek ücret"}: ${fmtTRY(servicePriceTry)}`
                : loc === "en"
                ? "Free"
                : "Ücretsiz"}
            </em>
          </div>

          <div className={s.serviceChoice}>
            <button
              type="button"
              className={`${s.serviceChoiceBtn} ${
                selected ? s.serviceChoiceBtnOn : ""
              }`}
             onClick={() => {
  const next = {
    ...selectedServices,
    [id]: true,
  };

  saveSelectedServices(next);
}}
            >
              <span className={s.serviceCheckIcon} />
              {loc === "en" ? "Yes" : "Evet"}
            </button>

            <button
              type="button"
              className={`${s.serviceChoiceBtn} ${
                !selected ? s.serviceChoiceBtnOffOn : ""
              }`}
             onClick={() => {
  const next = {
    ...selectedServices,
    [id]: false,
  };

  saveSelectedServices(next);
}}
            >
              <span className={s.serviceXIcon} />
              {loc === "en" ? "No" : "Hayır"}
            </button>
          </div>
          {selected && serviceRequiresProductText(service) ? (
  <div className={s.giftNoteBox}>
    <div className={s.giftNoteHead}>
      <span className={s.giftNoteIcon}>✒️</span>
      <div>
        <b>{getProductTextLabel(service, loc)}</b>
        <small>
          {loc === "en"
            ? "This text will be prepared for eligible products in your order."
            : "Bu metin, siparişindeki uygun ürünler için hazırlanır."}
        </small>
      </div>
    </div>

    {productTextRows.filter((row) => row.service.id === service.id).length ? (
      productTextRows
        .filter((row) => row.service.id === service.id)
        .map((row) => {
          const titleObj = row.item?.title;
          const productTitle =
            typeof titleObj === "string"
              ? titleObj
              : String(titleObj?.[loc] || titleObj?.tr || titleObj?.en || row.product?.name || "Ürün");

          return (
            <div key={`${row.service.id}_${row.key}`} className={s.productTextItem}>
              <label className={s.productTextLabel}>
                <span>{productTitle}</span>
                <textarea
                  className={s.giftNoteTextarea}
                  value={productCustomText[row.key] || ""}
                  onChange={(e) => {
                    const nextValue = e.target.value.slice(0, row.maxLength);

                    setProductCustomText((prev) => ({
                      ...prev,
                      [row.key]: nextValue,
                    }));
                  }}
                  placeholder={row.placeholder}
                  rows={3}
                />
              </label>

              <div className={s.giftNoteFoot}>
                <span>
                  {loc === "en"
                    ? "Please check spelling carefully."
                    : "Yazım hatası olmaması için metni dikkatlice kontrol et."}
                </span>
                <strong>
                  {(productCustomText[row.key] || "").length}/{row.maxLength}
                </strong>
              </div>
            </div>
          );
        })
    ) : (
      <div className={s.miniNote}>
        {loc === "en"
          ? "No eligible product found for this text option."
          : "Bu yazı seçeneği için uygun ürün bulunamadı."}
      </div>
    )}
  </div>
) : null}
          {selected &&
  (
    String(service.code || "").toLocaleLowerCase("tr-TR").includes("gift") ||
    String(service.code || "").toLocaleLowerCase("tr-TR").includes("hediye") ||
    pickCampaignText(service.title, "tr").toLocaleLowerCase("tr-TR").includes("hediye") ||
    pickCampaignText(service.title, "en").toLocaleLowerCase("tr-TR").includes("gift")
  ) ? (
  <div className={s.giftNoteBox}>
    <div className={s.giftNoteHead}>
      <span className={s.giftNoteIcon}>✍️</span>
      <div>
        <b>{loc === "en" ? "Gift note" : "Hediye notu"}</b>
        <small>
          {loc === "en"
            ? "Write a short message to be included with the package."
            : "Paketin içine eklenmesini istediğin kısa notu yaz."}
        </small>
      </div>
    </div>

    <textarea
      className={s.giftNoteTextarea}
      value={giftPackageNote}
      onChange={(e) => setGiftPackageNote(e.target.value.slice(0, 240))}
      placeholder={
        loc === "en"
          ? "Example: Happy birthday, with love..."
          : "Örn: Nice mutlu yıllara, sevgiyle..."
      }
      rows={4}
    />

    <div className={s.giftNoteFoot}>
      <span>
        {loc === "en"
          ? "Optional. Leave empty if you do not want a note."
          : "Opsiyonel. Not istemiyorsan boş bırakabilirsin."}
      </span>
      <strong>{giftPackageNote.length}/240</strong>
    </div>
  </div>
) : null}
        </div>
      );
    })}
  </div>
) : null}
               {showRateBox ? (
  <div className={s.rateBox} aria-live="polite">
    <div className={s.rateTop}>
      <div className={s.rateLabel}>{tUI.rateTitle}</div>
      <span className={`${s.rateDot} ${s.rateDotOn}`} />
    </div>

    <div className={s.rateTime}>{mmss}</div>

    <div className={s.rateSub}>
      {tUI.rateSubOn}
    </div>
  </div>
) : null}

{!checkoutEnabled ? (
  <div className={s.salesClosedBox}>
    <div className={s.salesClosedTitle}>
{tUI.salesClosedTitle}    </div>
    <div className={s.salesClosedText}>
      {tUI.salesClosedText}
    </div>
  </div>
) : null}
   <button
  className={s.payBtn}
  type="button"
  id="fb-purchase-btn"
  data-fb="Purchase"
  onClick={() => {
  setErr("");

  if (!authReady) return;

  if (!isRealUser) {
    setGuestErr("");
    setGuestOpen(true);
    return;
  }

  proceedToPayment();
}}
 disabled={
  saving ||
  !checkoutEnabled ||
  !productMapReady
}
>
  {saving
  ? tUI.creating
  : !productMapReady
  ? "Fiyatlar hazırlanıyor..."
  : tUI.create}
</button>

                <div className={s.assuranceList}>
                  <div className={s.assuranceItem}>• {tUI.assuranceOrder}</div>
<div className={s.assuranceItem}>• {tUI.assuranceTracking}</div>
<div className={s.assuranceItem}>• {tUI.assuranceShipping}</div>
                </div>

                <div className={s.payHint}>{tUI.paymentNote}</div>


 
              </>
            )}
          </div>
                </aside>
      </div>

     <GuestCheckoutModal
  open={guestOpen}
  busy={guestBusy}
  err={guestErr}
  tUI={tUI}
  form={guestForm}
  setForm={setGuestForm}
  onClose={() => setGuestOpen(false)}
  onSubmit={startGuestCheckout}
/>
<CheckoutToast message={addrMsg} />
    </main>
  );
}
