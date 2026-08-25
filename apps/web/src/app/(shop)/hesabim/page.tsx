"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  onIdTokenChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  limit,
  type DocumentData,
} from "firebase/firestore";
import RefundRequestsPanel from "@/components/account/RefundRequestsPanel";
import ShipmentTrackingPanel from "@/components/account/ShipmentTrackingPanel";
import { sendVerifyCodeClient } from "@/lib/emailVerifyClient";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { getDistrictsByCity, findCity, findDistrict } from "@/lib/trLocations";

import AccountShell from "@/components/account/AccountShell";
import AccountVerifyBanner from "@/components/account/AccountVerifyBanner";
import ProfileTab from "@/components/account/ProfileTab";
import AddressesTab from "@/components/account/AddressesTab";
import OrdersTab from "@/components/account/OrdersTab";
import SecurityTab from "@/components/account/SecurityTab";
import AccountGuestView from "@/components/account/AccountGuestView";
import AdminEntryButton from "@/components/account/AdminEntryButton";
import styles from "@/styles/auth.module.css";
import AccountSidebar from "@/components/account/AccountSidebar";
import NotificationsCenterPanel from "@/components/account/NotificationsCenterPanel";import AccountHero from "@/components/account/AccountHero";
// AccountStats reserved for future use
import StockAlertsTab from "@/components/account/StockAlertsTab";
import type { AccountTab } from "@/components/account/types";
import AccountCouponsPanel from "@/components/account/AccountCouponsPanel";
import AccountFavoritesPanel from "@/components/account/AccountFavoritesPanel";
import AccountAppointmentsPanel from "@/components/account/AccountAppointmentsPanel";
type Profile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
  defaultAddressId?: string;
  consentApproved?: boolean;
};

type Address = {
  id: string;
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
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
};

type Money = { amount: number; currency: string };

type OrderRow = {
  id: string;
  status?: string;
  total?: Money;
  currency?: string;
  createdAt?: any;
  createdAtIso?: string;
  itemCount?: number;
};

function toStr(v: any) {
  return typeof v === "string" ? v : "";
}
function toBool(v: any) {
  return typeof v === "boolean" ? v : false;
}
function trimPhone(s: string) {
  return String(s || "").replace(/[^\d+]/g, "");
}
function fmtMoney(v: number, loc: Locale, currency = "TRY") {
  const locale = loc === "en" ? "en-US" : "tr-TR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}
function toDateSafe(v: any, fallbackIso?: string): Date | null {
  try {
    if (!v) {
      if (fallbackIso) {
        const d = new Date(fallbackIso);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    }

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }

    if (v instanceof Date) {
      return isNaN(v.getTime()) ? null : v;
    }

    if (typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    if (fallbackIso) {
      const d = new Date(fallbackIso);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function fmtOrderDate(v: any, loc: Locale, fallbackIso?: string) {
  const d = toDateSafe(v, fallbackIso);

  if (!d) return loc === "en" ? "Date pending" : "Tarih bekleniyor";

  return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function statusLabel(statusRaw: any, loc: Locale) {
  const s = String(statusRaw || "pending_payment").trim();

  const trMap: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };
  const enMap: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Pending payment",
    paid: "Paid",
    preparing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return (loc === "en" ? enMap[s] : trMap[s]) || s;
}
function statusTone(statusRaw: any) {
  const s = String(statusRaw || "pending_payment").trim();
  if (s === "paid" || s === "delivered") return "ok";
  if (s === "cancelled" || s === "refunded") return "bad";
  if (s === "shipped" || s === "preparing") return "info";
  return "warn";
}

export default function HesabimPage() {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loc, setLoc] = useState<Locale>("tr");
  const msg = (loc === "tr" ? (tr as any) : (en as any)) ?? {};
  const t = (key: string, trFallback: string, enFallback: string) =>
    String(msg?.[key] ?? (loc === "en" ? enFallback : trFallback));

  useEffect(() => {
    setLoc(getLocale());
    const on = (e: any) => setLoc((e?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", on);
    return () => window.removeEventListener("locale-changed", on);
  }, []);

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const isRealUser = !!user && !user.isAnonymous;
  const isEmailVerified = isRealUser && Boolean(user?.emailVerified);
  const canWrite = isRealUser && isEmailVerified;

  const [tab, setTab] = useState<AccountTab>("profile");

  useEffect(() => {
    if (typeof window === "undefined") return;
  
    const params = new URLSearchParams(window.location.search);
    const qTab = String(params.get("tab") || "").trim();
  
if (
  qTab === "profile" ||
  qTab === "addresses" ||
  qTab === "orders" ||
  qTab === "appointments" ||
  qTab === "refunds" ||
  qTab === "shipments" ||
  qTab === "coupons" ||
  qTab === "favorites" ||
  qTab === "security" ||
  qTab === "stock-alerts" ||
  qTab === "notifications"
) {
  setTab(qTab as AccountTab);
} else {
  setTab("profile");
}
  }, []);

  function changeTab(next: AccountTab) {
    setTab(next);
    setSidebarOpen(false);
  
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    }
  }
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    }
  
    if (sidebarOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
  
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarOpen]);
  useEffect(() => {
  const root = document.documentElement;
  const body = document.body;

  if (sidebarOpen) {
    root.classList.add("nci-account-sidebar-open");
    body.classList.add("nci-account-sidebar-open");
  } else {
    root.classList.remove("nci-account-sidebar-open");
    body.classList.remove("nci-account-sidebar-open");
  }

  return () => {
    root.classList.remove("nci-account-sidebar-open");
    body.classList.remove("nci-account-sidebar-open");
  };
}, [sidebarOpen]);
  const [profile, setProfile] = useState<Profile>({});
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [aBusy, setABusy] = useState(false);
  const [aMsg, setAMsg] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [oBusy, setOBusy] = useState(false);

  const [sBusy, setSBusy] = useState(false);
  const [sMsg, setSMsg] = useState<string | null>(null);

  const districtOptions = useMemo(() => {
    const cityId = editing?.cityId || "";
    if (!cityId) return [];
    return getDistrictsByCity(cityId);
  }, [editing?.cityId]);

  useEffect(() => {
    if (!isRealUser || !user?.uid) {
      setProfile({});
      setAddresses([]);
      setOrders([]);
      return;
    }

    const uid = user.uid;

    const profRef = doc(db, "users", uid);
    const unsubProfile = onSnapshot(
      profRef,
      (snap) => {
        const d = (snap.data() as DocumentData) || {};
        setProfile({
  firstName: toStr(d.firstName),
  lastName: toStr(d.lastName),
  phone: toStr(d.phone),
  email: toStr(d.email) || user.email || "",
  nationalId: toStr(d.nationalId),
  birthDate: toStr(d.birthDate),
  defaultAddressId: toStr(d.defaultAddressId),
  consentApproved: toBool(d.consentApproved),
});
      },
      () => setProfile({ email: user.email || "" })
    );

    const addrRef = collection(db, "users", uid, "addresses");
    const unsubAddr = onSnapshot(
  addrRef,
  (snap) => {
    const list: Address[] = snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        title: toStr(x.title),

        invoiceType: (toStr(x.invoiceType) as "individual" | "company") || "individual",

        firstName: toStr(x.firstName),
        lastName: toStr(x.lastName),
        phone: toStr(x.phone),

        nationalId: toStr(x.nationalId),

        companyName: toStr(x.companyName),
        taxNumber: toStr(x.taxNumber),
        taxOffice: toStr(x.taxOffice),

        line1: toStr(x.line1),
        line2: toStr(x.line2),
        cityId: toStr(x.cityId),
        cityName: toStr(x.cityName),
        districtId: toStr(x.districtId),
        districtName: toStr(x.districtName),
        postalCode: toStr(x.postalCode),
        country: toStr(x.country) || "TR",
        isDefault: toBool(x.isDefault),
      };
    });

    list.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
    setAddresses(list);
  },
  () => setAddresses([])
);

    setOBusy(true);

const oq = query(
  collection(db, "orders"),
  where("uid", "==", uid),
  limit(50)
);

const unsubOrders = onSnapshot(
  oq,
  (snap) => {
    const list: OrderRow[] = snap.docs.map((d) => {
      const x = d.data() as any;

      const totalObj =
        x?.total && typeof x.total === "object"
          ? { amount: Number(x.total.amount || 0), currency: String(x.total.currency || "TRY") }
          : { amount: Number(x?.total || 0), currency: String(x?.currency || "TRY") };

      const itemCount = Array.isArray(x?.items)
        ? x.items.reduce((sum: number, it: any) => sum + Number(it?.qty || 0), 0)
        : 0;

      return {
        id: d.id,
        status: String(x?.status || "pending_payment").trim(),
        total: totalObj,
        createdAt: x?.createdAt ?? null,
        createdAtIso: String(x?.createdAtIso || "").trim(),
        itemCount,
      };
    });

    // ✅ client-side sort (createdAt varsa onu, yoksa createdAtIso)
    list.sort((a: any, b: any) => {
      const aTime = a?.createdAt?.toMillis?.() || (a?.createdAtIso ? new Date(a.createdAtIso).getTime() : 0);
      const bTime = b?.createdAt?.toMillis?.() || (b?.createdAtIso ? new Date(b.createdAtIso).getTime() : 0);
      return bTime - aTime;
    });

    setOrders(list);
    setOBusy(false);
  },
  (err) => {
    console.error("orders snapshot error:", err);
    setOrders([]);
    setOBusy(false);
  }
);

    return () => {
      unsubProfile();
      unsubAddr();
      unsubOrders();
    };
  }, [db, user, isRealUser]);

  function lockMsg() {
    return loc === "en" ? "Please verify your email first." : "Önce e-postanı doğrula.";
  }

  async function doLogout() {
    try {
      await signOut(auth);
      window.dispatchEvent(new Event("cart:changed"));
      window.dispatchEvent(new Event("storage"));
      router.push("/");
    } catch (e) {
      console.error("logout failed", e);
    }
  }

  async function saveProfile() {
  if (!user?.uid) return;

  if (!canWrite) {
    setPMsg(lockMsg());
    return;
  }

  const firstName = (profile.firstName || "").trim();
  const lastName = (profile.lastName || "").trim();
  const phone = trimPhone(profile.phone || "");
  const nationalId = String(profile.nationalId || "").replace(/\D+/g, "").slice(0, 11);
  const birthDate = String(profile.birthDate || "").trim(); // YYYY-MM-DD olmalı
  const consentApproved = profile.consentApproved === true;



  setPBusy(true);
  setPMsg(null);

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        firstName,
        lastName,
        phone,
        email: user.email || profile.email || "",
        nationalId,
        birthDate,
        consentApproved,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    setProfile((prev) => ({
      ...prev,
      firstName,
      lastName,
      phone,
      email: user.email || profile.email || "",
      nationalId,
      birthDate,
      consentApproved,
    }));

    setPMsg(loc === "en" ? "Saved." : "Kaydedildi.");
  } catch (e) {
    console.error("saveProfile error:", e);
    setPMsg(loc === "en" ? "Save failed." : "Kaydedilemedi.");
  } finally {
    setPBusy(false);
    setTimeout(() => setPMsg(null), 2500);
  }
}

  function startAddAddress() {
  if (!canWrite) {
    setAMsg(lockMsg());
    return;
  }

  const firstIsDefault = addresses.length === 0;

  setEditing({
    id: "new",
    title: "",
    invoiceType: "individual",

    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    phone: profile.phone || "",

    nationalId: profile.nationalId || "",

    companyName: "",
    taxNumber: "",
    taxOffice: "",

    line1: "",
    line2: "",
    cityId: "",
    cityName: "",
    districtId: "",
    districtName: "",
    postalCode: "",
    country: "TR",
    isDefault: firstIsDefault,
  });

  changeTab("addresses");
  setAMsg(null);
}

  function startEditAddress(a: Address) {
    if (!canWrite) {
      setAMsg(lockMsg());
      return;
    }
    setEditing({ ...a });
    changeTab("addresses");
    setAMsg(null);
  }

  function setCity(cityId: string) {
    const city = findCity(cityId);
    setEditing((x) => {
      if (!x) return x;
      return {
        ...x,
        cityId,
        cityName: city?.sehir_adi || "",
        districtId: "",
        districtName: "",
      };
    });
  }

  function setDistrict(districtId: string) {
    const d = findDistrict(districtId);
    setEditing((x) => {
      if (!x) return x;
      return {
        ...x,
        districtId,
        districtName: d?.ilce_adi || "",
      };
    });
  }

function validateAddress(a: Address) {
  const title = (a.title || "").trim();
  const invoiceType = a.invoiceType === "company" ? "company" : "individual";

  const firstName = (a.firstName || "").trim();
  const lastName = (a.lastName || "").trim();
  const phone = trimPhone(a.phone || "");
  const line1 = (a.line1 || "").trim();
  const cityId = (a.cityId || "").trim();
  const districtId = (a.districtId || "").trim();
  const postal = (a.postalCode || "").trim();

  const nationalId = String(a.nationalId || "").replace(/\D+/g, "").slice(0, 11);
  const companyName = (a.companyName || "").trim();
  const taxNumber = String(a.taxNumber || "").replace(/\D+/g, "").slice(0, 11);
  const taxOffice = (a.taxOffice || "").trim();

  if (!title) return loc === "en" ? "Title is required." : "Adres başlığı gerekli.";
  if (!firstName) return loc === "en" ? "First name is required." : "Alıcı adı gerekli.";
  if (!lastName) return loc === "en" ? "Last name is required." : "Alıcı soyadı gerekli.";
  if (phone.length < 10) return loc === "en" ? "Phone looks invalid." : "Telefon hatalı görünüyor.";
  if (line1.length < 6) return loc === "en" ? "Address line is too short." : "Adres satırı çok kısa.";
  if (!cityId) return loc === "en" ? "Select a city." : "Şehir seç.";
  if (!districtId) return loc === "en" ? "Select a district." : "İlçe seç.";
  if (postal && postal.length < 4) return loc === "en" ? "Postal code looks invalid." : "Posta kodu hatalı görünüyor.";

  if (invoiceType === "individual") {
    if (nationalId && nationalId.length !== 11) {
      return loc === "en"
        ? "National ID must be 11 digits."
        : "TC kimlik no 11 haneli olmalı.";
    }
  }

  if (invoiceType === "company") {
    if (!companyName) {
      return loc === "en" ? "Company name is required." : "Firma adı gerekli.";
    }
    if (!taxNumber) {
      return loc === "en" ? "Tax number is required." : "Vergi numarası gerekli.";
    }
    if (!(taxNumber.length === 10 || taxNumber.length === 11)) {
      return loc === "en"
        ? "Tax number looks invalid."
        : "Vergi numarası hatalı görünüyor.";
    }
    if (!taxOffice) {
      return loc === "en" ? "Tax office is required." : "Vergi dairesi gerekli.";
    }
  }

  return null;
}

  async function saveAddress() {
    if (!canWrite) {
      setAMsg(lockMsg());
      return;
    }
    if (!user?.uid || !editing) return;

    const err = validateAddress(editing);
    if (err) {
      setAMsg(err);
      return;
    }

    const uid = user.uid;
    const city = findCity(editing.cityId || "");
    const dist = findDistrict(editing.districtId || "");

const invoiceType =
  editing.invoiceType === "company" ? "company" : "individual";

const payload = {
  title: (editing.title || "").trim(),

  invoiceType,

  firstName: (editing.firstName || "").trim(),
  lastName: (editing.lastName || "").trim(),
  phone: trimPhone(editing.phone || ""),

  nationalId:
    invoiceType === "individual"
      ? String(editing.nationalId || "").replace(/\D+/g, "").slice(0, 11)
      : "",

  companyName:
    invoiceType === "company"
      ? (editing.companyName || "").trim()
      : "",

  taxNumber:
    invoiceType === "company"
      ? String(editing.taxNumber || "").replace(/\D+/g, "").slice(0, 11)
      : "",

  taxOffice:
    invoiceType === "company"
      ? (editing.taxOffice || "").trim()
      : "",

  line1: (editing.line1 || "").trim(),
  line2: (editing.line2 || "").trim(),
  cityId: String(editing.cityId || ""),
  cityName: city?.sehir_adi || (editing.cityName || ""),
  districtId: String(editing.districtId || ""),
  districtName: dist?.ilce_adi || (editing.districtName || ""),
  postalCode: (editing.postalCode || "").trim(),
  country: "TR",
  isDefault: Boolean(editing.isDefault),
  updatedAt: new Date().toISOString(),
  ...(editing.id === "new" ? { createdAt: new Date().toISOString() } : {}),
};

    setABusy(true);
    setAMsg(null);

    try {
      if (editing.id === "new") {
        const ref = await addDoc(collection(db, "users", uid, "addresses"), payload);
        if (payload.isDefault) await ensureOnlyOneDefault(ref.id);
      } else {
        await setDoc(doc(db, "users", uid, "addresses", editing.id), payload, { merge: true });
        if (payload.isDefault) await ensureOnlyOneDefault(editing.id);
      }

      setEditing(null);
      setAMsg(loc === "en" ? "Saved." : "Kaydedildi.");
      setTimeout(() => setAMsg(null), 2000);
    } catch (e: any) {
      const m = String(e?.code || e?.message || e);
      setAMsg(
        m.includes("permission")
          ? loc === "en"
            ? "No permission (check Firestore Rules)."
            : "Yetki yok (Firestore Rules kontrol)."
          : loc === "en"
          ? "Save failed."
          : "Kaydedilemedi."
      );
    } finally {
      setABusy(false);
    }
  }

  async function ensureOnlyOneDefault(defaultId: string) {
    if (!user?.uid) return;
    if (!canWrite) {
      setAMsg(lockMsg());
      return;
    }
    const uid = user.uid;

    await setDoc(
      doc(db, "users", uid, "addresses", defaultId),
      { isDefault: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    await Promise.all(
      addresses
        .filter((a) => a.id !== defaultId && a.isDefault)
        .map((a) =>
          setDoc(
            doc(db, "users", uid, "addresses", a.id),
            { isDefault: false, updatedAt: new Date().toISOString() },
            { merge: true }
          )
        )
    );

    await setDoc(doc(db, "users", uid), { defaultAddressId: defaultId }, { merge: true });
  }

  async function removeAddress(id: string) {
    if (!user?.uid) return;
    if (!canWrite) {
      setAMsg(lockMsg());
      return;
    }

    setABusy(true);
    setAMsg(null);
    try {
      await deleteDoc(doc(db, "users", user.uid, "addresses", id));
      if (profile.defaultAddressId === id) {
        await setDoc(doc(db, "users", user.uid), { defaultAddressId: "" }, { merge: true });
      }
      setAMsg(loc === "en" ? "Deleted." : "Silindi.");
      setTimeout(() => setAMsg(null), 1500);
    } finally {
      setABusy(false);
    }
  }

  async function goVerify() {
    try {
      await sendVerifyCodeClient();
      router.push("/verify-email");
    } catch (e: any) {
      alert(e?.message || (loc === "en" ? "Email could not be sent." : "Mail gönderilemedi."));
    }
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
 async function startPasswordReset() {
  if (!user?.email) {
    setSMsg(loc === "en" ? "No email on this account." : "Bu hesapta e-posta yok.");
    return;
  }

  setSBusy(true);
  setSMsg(null);

  try {
    await sendVerifyCodeClient();

    setSMsg(
      loc === "en"
        ? "Verification code sent. You can continue on the verification screen."
        : "Doğrulama kodu gönderildi. Doğrulama ekranından devam edebilirsin."
    );

    router.push("/verify-email");
  } catch (e: any) {
    setSMsg(
      String(
        e?.message ||
          (loc === "en" ? "Code could not be sent." : "Kod gönderilemedi.")
      )
    );
  } finally {
    setSBusy(false);
    setTimeout(() => setSMsg(null), 3000);
  }
}

  const orderCount = orders.length;
  const addressCount = addresses.length;
  const defaultAddress = addresses.find((x) => x.isDefault) || null; // eslint-disable-line @typescript-eslint/no-unused-vars
  const lastOrder = orders[0] || null;

  return (
    <AccountShell>
      {!isRealUser ? (
        <AccountGuestView
          loc={loc}
          title={t("account_title", "Hesabım", "My Account")}
          homeLabel={t("nav_home", "Anasayfa", "Home")}
        />
      ) : (
        <>
    <div className={`${styles.mobileSidebarToggleWrap} ${sidebarOpen ? styles.mobileSidebarToggleWrapOpen : ""}`}>
  <button
    type="button"
    className={`${styles.mobileSidebarToggle} ${sidebarOpen ? styles.mobileSidebarToggleActive : ""}`}
    onClick={() => setSidebarOpen(true)}
    aria-label={loc === "en" ? "Open account menu" : "Hesap menüsünü aç"}
  >
   <span className={styles.mobileSidebarToggleIcon}>
  <span />
</span>
    <span className={styles.mobileSidebarToggleText}>
      {loc === "en" ? "My Account" : "Hesabım"}
    </span>
  </button>
</div>
<AccountSidebar
  loc={loc}
  tab={tab}
  onTabChange={changeTab}
  title={t("account_title", "Hesabım", "My Account")}
  breadcrumbHome={t("nav_home", "Anasayfa", "Home")}
  onLogout={async () => {
    setSidebarOpen(false);
    await doLogout();
  }}
  adminButton={<AdminEntryButton />}
  isOpen={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
/>

          <section className={styles.accountMain}>
          <AccountHero
  loc={loc}
  name={profile.firstName || user?.email || "Müşteri"}
  isEmailVerified={isEmailVerified}
  orderCount={orderCount}
  addressCount={addressCount}
  lastOrderText={
    lastOrder
      ? fmtOrderDate(lastOrder.createdAt, loc)
      : (loc === "en" ? "No orders" : "Sipariş yok")
  }
/>

            {!isEmailVerified ? (
              <AccountVerifyBanner loc={loc} onVerify={goVerify} />
            ) : null}

            {tab === "profile" ? (
              <ProfileTab
                loc={loc}
                profile={profile}
                setProfile={setProfile}
                userEmail={user?.email || ""}
                canWrite={canWrite}
                pBusy={pBusy}
                pMsg={pMsg}
                lockMsg={lockMsg()}
                onSave={saveProfile}
              />
            ) : null}

            {tab === "addresses" ? (
              <AddressesTab
                loc={loc}
                editing={editing}
                setEditing={setEditing}
                addresses={addresses}
                districtOptions={districtOptions}
                aBusy={aBusy}
                aMsg={aMsg}
                canWrite={canWrite}
                lockMsg={lockMsg()}
                onStartAdd={startAddAddress}
                onStartEdit={startEditAddress}
                onSave={saveAddress}
                onCancel={() => setEditing(null)}
                onSetCity={setCity}
                onSetDistrict={setDistrict}
                onMakeDefault={ensureOnlyOneDefault}
                onDelete={removeAddress}
              />
            ) : null}

            {tab === "orders" ? (
              <OrdersTab
                loc={loc}
                orders={orders}
                oBusy={oBusy}
                fmtMoney={fmtMoney}
                fmtOrderDate={fmtOrderDate}
                statusLabel={statusLabel}
                statusTone={statusTone}
              />
            ) : null}
{tab === "appointments" ? <AccountAppointmentsPanel loc={loc} /> : null}
{tab === "refunds" && user?.uid ? (
  <RefundRequestsPanel uid={user.uid} loc={loc} />
) : null}

{tab === "shipments" && user?.uid ? (
  <ShipmentTrackingPanel uid={user.uid} loc={loc} />
) : null}
   {tab === "security" ? (
  <SecurityTab
    loc={loc}
    sBusy={sBusy}
    sMsg={sMsg}
   onStartPasswordReset={() => router.push("/forgot")}
    onLogout={doLogout}
  />
) : null}
{tab === "coupons" && user?.uid ? (
  <AccountCouponsPanel uid={user.uid} loc={loc} />
) : null}

{tab === "favorites" && user?.uid ? (
  <AccountFavoritesPanel uid={user.uid} loc={loc} />
) : null}

{tab === "notifications" && user?.uid ? (

  <NotificationsCenterPanel uid={user.uid} loc={loc} />

) : null}

{tab === "stock-alerts" ? (
  user?.uid ? <StockAlertsTab uid={user.uid} /> : null
) : null}
            
          </section>
        </>
      )}
    </AccountShell>
  );
}
