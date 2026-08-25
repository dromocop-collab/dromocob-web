"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import styles from "./styles/profilePanel.module.css";

type Locale = "tr" | "en";

type Props = {
  open: boolean;
  loc: Locale;
  me: any;
  isRealUser: boolean;
  isEmailVerified: boolean;
  isAdminUser: boolean;
  userDoc: any;
  defaultAddr: any;
  recentOrder: any;
  stockAlertsCount: number;
  cartCount: number;
  wishCount: number;
  cartSubtotal: number;
  onClose: () => void;
  onSignOut: () => void;
  onSendVerify: () => void;
  money: (v: number, loc: Locale) => string;
};

type InboxNotification = {
  id: string;
  title: string;
  body: string;
  image: string;
  url: string;
  type: string;
  isRead: boolean;
  createdAt?: Timestamp | null;
};

function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function orderStatusLabel(status: any, loc: Locale) {
  const s = String(status || "pending_payment").trim();

  const tr: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };

  const en: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Pending Payment",
    paid: "Paid",
    preparing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return loc === "en" ? en[s] || s : tr[s] || s;
}

function orderStatusTone(status: any) {
  const s = String(status || "pending_payment").trim();

  if (s === "paid" || s === "delivered") return "ok";
  if (s === "cancelled" || s === "refunded") return "bad";
  if (s === "preparing" || s === "shipped") return "info";
  return "warn";
}
function safeInternalUrl(v: any) {
  const url = safeStr(v);
  if (!url) return "/";
  if (url.startsWith("/")) return url;
  return "/";
}
function fmtOrderDate(v: any, loc: Locale) {
  try {
    let d: Date | null = null;

    if (v?.createdAt?.toDate) d = v.createdAt.toDate();
    else if (typeof v?.createdAtIso === "string" && v.createdAtIso.trim()) {
      d = new Date(v.createdAtIso);
    } else if (typeof v?.createdAt === "string" && v.createdAt.trim()) {
      d = new Date(v.createdAt);
    } else if (typeof v?.createdAt === "number") {
      d = new Date(v.createdAt);
    }

    if (!d || Number.isNaN(d.getTime())) {
      return loc === "en" ? "No order yet" : "Henüz sipariş yok";
    }

    return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return loc === "en" ? "No order yet" : "Henüz sipariş yok";
  }
}

function fmtNotificationDate(v: Timestamp | null | undefined, loc: Locale) {
  try {
    if (!v?.toDate) return loc === "en" ? "Now" : "Şimdi";

    return v.toDate().toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return loc === "en" ? "Now" : "Şimdi";
  }
}

function notificationTypeLabel(type: string, loc: Locale) {
  const t = safeStr(type).toLowerCase();

  const tr: Record<string, string> = {
    support_thread: "Mesaj",
    support_message: "Mesaj",
    message: "Mesaj",
    notification: "Bildirim",

    refund_request: "İade Talebi",
    refund_pending: "İade İncelemesi",
    refund_processing: "İade İşleniyor",
    refund_approved: "İade Onaylandı",
    refund_failed: "İade Hatası",
    refund_rejected: "İade Reddedildi",
    refund_refunded: "Para İadesi",

    shipment: "Kargo",
    shipment_created: "Kargo Oluşturuldu",
    shipment_shipped: "Kargoya Verildi",
    shipment_delivered: "Teslim Edildi",
    shipment_cancelled: "Kargo İptali",

    order: "Sipariş",
    order_paid: "Sipariş Ödendi",
    order_preparing: "Hazırlanıyor",
    order_shipped: "Kargoda",
    order_delivered: "Teslim Edildi",
  };

  const en: Record<string, string> = {
    support_thread: "Message",
    support_message: "Message",
    message: "Message",
    notification: "Notification",

    refund_request: "Refund Request",
    refund_pending: "Refund Review",
    refund_processing: "Refund Processing",
    refund_approved: "Refund Approved",
    refund_failed: "Refund Failed",
    refund_rejected: "Refund Rejected",
    refund_refunded: "Refund Paid",

    shipment: "Shipment",
    shipment_created: "Shipment Created",
    shipment_shipped: "Shipped",
    shipment_delivered: "Delivered",
    shipment_cancelled: "Shipment Cancelled",

    order: "Order",
    order_paid: "Order Paid",
    order_preparing: "Preparing",
    order_shipped: "Shipped",
    order_delivered: "Delivered",
  };

  return loc === "en" ? en[t] || "General" : tr[t] || "Genel";
}

function notificationTone(type: string) {
  const t = safeStr(type).toLowerCase();

  if (t.includes("refund")) return "refund";
  if (t.includes("shipment") || t.includes("shipping") || t.includes("cargo")) return "shipment";
  if (t.includes("support") || t.includes("message")) return "message";
  if (t.includes("order")) return "order";

  return "default";
}

export default function ProfilePanel({
  open,
  loc,
  me,
  isRealUser,
  isEmailVerified,
  isAdminUser,
  userDoc,
  defaultAddr,
  recentOrder,
  stockAlertsCount,
  cartCount,
  wishCount,
  cartSubtotal,
  onClose,
  onSignOut,
  onSendVerify,
  money,
}: Props) {
  const db = useMemo(() => getFirebaseDb(), []);

  const [liveRole, setLiveRole] = useState<"admin" | "sub_admin" | "member">("member");
  const [inboxItems, setInboxItems] = useState<InboxNotification[]>([]);
  const [liveRecentOrder, setLiveRecentOrder] = useState<any>(null);
const [panelUserDoc, setPanelUserDoc] = useState<any>(null);
 useEffect(() => {
  let cancelled = false;

  async function loadUserPanelData() {
    try {
      if (!open || !me?.uid || !isRealUser) {
        if (!cancelled) {
          setPanelUserDoc(null);
          setLiveRole("member");
        }
        return;
      }

      const snap = await getDoc(doc(db, "users", me.uid));

      if (!snap.exists()) {
        if (!cancelled) {
          setPanelUserDoc(null);
          setLiveRole(isAdminUser ? "admin" : "member");
        }
        return;
      }

      const data = snap.data() as any;
      const rawRole = safeStr(data?.role).toLowerCase();

      if (!cancelled) {
        setPanelUserDoc(data);

        if (rawRole === "admin") setLiveRole("admin");
        else if (rawRole === "sub_admin") setLiveRole("sub_admin");
        else if (isAdminUser) setLiveRole("admin");
        else setLiveRole("member");
      }
    } catch (err) {
      console.error("ProfilePanel user panel data load error:", err);

      if (!cancelled) {
        setPanelUserDoc(null);
        setLiveRole(isAdminUser ? "admin" : "member");
      }
    }
  }

  loadUserPanelData();

  return () => {
    cancelled = true;
  };
}, [db, open, me?.uid, isRealUser, isAdminUser]);
async function handleOpenNotification(item: InboxNotification) {
  try {
    if (!me?.uid || item.isRead) return;

    await updateDoc(doc(db, "users", me.uid, "inbox_notifications", item.id), {
      isRead: true,
    });
  } catch (err) {
    console.error("ProfilePanel notification read error:", err);
  }
}

useEffect(() => {
  if (!open || !me?.uid || !isRealUser) {
    setInboxItems([]);
    return;
  }

    const qRef = query(
      collection(db, "users", me.uid, "inbox_notifications"),
      orderBy("createdAt", "desc"),
      limit(6)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const next: InboxNotification[] = snap.docs.map((d) => {
          const x = d.data() as any;

          return {
            id: d.id,
            title: safeStr(x?.title),
            body: safeStr(x?.body),
            image: safeStr(x?.image),
           url: safeInternalUrl(x?.url),
            type: safeStr(x?.type),
            isRead: x?.isRead === true,
            createdAt: (x?.createdAt as Timestamp) || null,
          };
        });

        setInboxItems(next);
      },
      (err) => {
        console.error("ProfilePanel inbox load error:", err);
        setInboxItems([]);
      }
    );

    return () => unsub();
 }, [db, open, me?.uid, isRealUser]);
useEffect(() => {

  if (!open || !me?.uid || !isRealUser) {

    setLiveRecentOrder(null);

    return;

  }

  const qRef = query(
    collection(db, "orders"),
    where("uid", "==", me.uid),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const unsub = onSnapshot(
    qRef,
    (snap) => {
      const first = snap.docs[0];

      if (!first) {
        setLiveRecentOrder(null);
        return;
      }

      setLiveRecentOrder({
        id: first.id,
        ...(first.data() as any),
      });
    },
    (err) => {
      console.error("ProfilePanel recent order load error:", err);
      setLiveRecentOrder(null);
    }
  );

  return () => unsub();
}, [db, open, me?.uid, isRealUser]);
  if (!open) return null;

const profileDoc = userDoc || panelUserDoc || {};

const firstName = safeStr(profileDoc?.firstName);
const lastName = safeStr(profileDoc?.lastName);
const displayName = safeStr(me?.displayName);

const cleanName =
  `${firstName} ${lastName}`.trim() ||
  displayName ||
  safeStr(me?.email).split("@")[0] ||
  (loc === "en" ? "customer" : "müşteri");

const fullName = loc === "en" ? `Hello, ${cleanName}` : `Merhaba, ${cleanName}`;

const email = safeStr(me?.email);
const phone = safeStr(profileDoc?.phone);

  const defaultAddressTitle = safeStr(defaultAddr?.title);
  const defaultAddressCity = safeStr(defaultAddr?.cityName);
  const defaultAddressDistrict = safeStr(defaultAddr?.districtName);

 const currentRecentOrder = liveRecentOrder || recentOrder || null;

const orderId = safeStr(currentRecentOrder?.id);
const orderShort = orderId ? `#${orderId.slice(0, 10).toUpperCase()}` : "";
const recentOrderStatus = orderStatusLabel(currentRecentOrder?.status, loc);
const recentOrderTone = orderStatusTone(currentRecentOrder?.status);

  const roleLabel =
    liveRole === "admin"
      ? "Admin"
      : liveRole === "sub_admin"
      ? "Sub Admin"
      : loc === "en"
      ? "Member"
      : "Üye";

  const canOpenAdmin = liveRole === "admin" || liveRole === "sub_admin";

  async function handleDismissNotification(id: string) {
    try {
      if (!me?.uid) return;
      await deleteDoc(doc(db, "users", me.uid, "inbox_notifications", id));
    } catch (err) {
      console.error("ProfilePanel notification delete error:", err);
    }
  }

  const quickLinks = [
    {
      key: "profile",
      href: "/hesabim",
      glyph: "◉",
      title: loc === "en" ? "Profile" : "Profil",
      desc: loc === "en" ? "Personal information" : "Kişisel bilgiler",
    },
    {
      key: "addresses",
      href: "/hesabim?tab=addresses",
      glyph: "⌂",
      title: loc === "en" ? "Addresses" : "Adresler",
      desc: defaultAddressTitle
        ? `${defaultAddressTitle}${defaultAddressCity ? ` • ${defaultAddressCity}` : ""}`
        : loc === "en"
        ? "Manage saved addresses"
        : "Kayıtlı adresleri yönet",
    },
    {
      key: "orders",
      href: "/hesabim?tab=orders",
      glyph: "◎",
      title: loc === "en" ? "Orders" : "Siparişler",
      desc: loc === "en" ? "Track order flow" : "Sipariş akışını takip et",
    },
    {
  key: "refunds",
  href: "/hesabim?tab=refunds",
  glyph: "↺",
  title: loc === "en" ? "Refund Requests" : "İade Talepleri",
  desc:
    loc === "en"
      ? "Create and track refund requests"
      : "İade taleplerini oluştur ve takip et",
},
{
  key: "shipping",
  href: "/hesabim?tab=orders",
  glyph: "▤",
  title: loc === "en" ? "Shipment Tracking" : "Kargo Takibi",
  desc:
    loc === "en"
      ? "Track shipment and delivery status"
      : "Kargo ve teslimat durumunu takip et",
},
  ];

  return (
    <aside
      className={`${styles.panel} ${styles.open}`}
      role="dialog"
      aria-modal="true"
      aria-label={loc === "en" ? "My Account" : "Hesabım"}
    >
      <div className={styles.head}>
        <div className={styles.headTitle}>{loc === "en" ? "My Account" : "Hesabım"}</div>

        <button
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
          aria-label={loc === "en" ? "Close panel" : "Paneli kapat"}
        >
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {!isRealUser ? (
          <div className={styles.guestWrap}>
            <section className={styles.guestHero}>
              <div className={styles.guestGlow} />

              <div className={styles.guestTop}>
                <div className={styles.guestEyebrow}>
                  {loc === "en" ? "Premium Account Experience" : "Premium Hesap Deneyimi"}
                </div>

                <h3 className={styles.guestTitle}>{loc === "en" ? "Welcome back" : "Hoş geldin"}</h3>

                <p className={styles.guestLead}>
                  {loc === "en"
                    ? "Sign in or create an account to manage your orders, addresses, favorites and stock alerts from one elegant panel."
                    : "Siparişlerini, adreslerini, favorilerini ve stok bildirimlerini tek bir şık panelden yönetmek için giriş yap veya kayıt ol."}
                </p>
              </div>

              <div className={styles.guestStats}>
                <div className={styles.guestStatCard}>
                  <strong>{loc === "en" ? "Order tracking" : "Sipariş takibi"}</strong>
                  <span>{loc === "en" ? "See every step instantly" : "Tüm süreci anında gör"}</span>
                </div>

                <div className={styles.guestStatCard}>
                  <strong>{loc === "en" ? "Saved addresses" : "Kayıtlı adresler"}</strong>
                  <span>{loc === "en" ? "Faster checkout flow" : "Daha hızlı ödeme akışı"}</span>
                </div>

                <div className={styles.guestStatCard}>
                  <strong>{loc === "en" ? "Favorites" : "Favoriler"}</strong>
                  <span>{loc === "en" ? "Keep your best picks ready" : "Beğendiklerin hep elinin altında"}</span>
                </div>
              </div>

              <div className={styles.guestActions}>
                <Link className={styles.primaryBtn} href="/login" onClick={onClose}>
                  {loc === "en" ? "Login" : "Giriş Yap"}
                </Link>

                <Link className={styles.softBtn} href="/register" onClick={onClose}>
                  {loc === "en" ? "Create Account" : "Kayıt Ol"}
                </Link>
              </div>

              <div className={styles.guestTrustRow}>
                <span className={styles.trustPill}>{loc === "en" ? "Secure login" : "Güvenli giriş"}</span>
                <span className={styles.trustPill}>{loc === "en" ? "Fast checkout" : "Hızlı ödeme"}</span>
                <span className={styles.trustPill}>{loc === "en" ? "Premium support" : "Premium destek"}</span>
              </div>
            </section>

            <section className={styles.guestBenefits}>
              <div className={styles.cardTitle}>
                {loc === "en" ? "Why create an account?" : "Neden hesap oluşturmalısın?"}
              </div>

              <div className={styles.guestBenefitList}>
                <div className={styles.guestBenefitItem}>
                  <div className={styles.guestBenefitIcon}>◎</div>
                  <div>
                    <strong>{loc === "en" ? "Track orders easily" : "Siparişlerini kolay takip et"}</strong>
                    <p>
                      {loc === "en"
                        ? "From payment to delivery, everything stays visible."
                        : "Ödemeden teslimata kadar tüm süreç görünür olur."}
                    </p>
                  </div>
                </div>

                <div className={styles.guestBenefitItem}>
                  <div className={styles.guestBenefitIcon}>◎</div>
                  <div>
                    <strong>{loc === "en" ? "Save favorites" : "Favorilerini sakla"}</strong>
                    <p>
                      {loc === "en"
                        ? "Build your own premium selection list."
                        : "Kendi premium seçki listen hep hazır dursun."}
                    </p>
                  </div>
                </div>

                <div className={styles.guestBenefitItem}>
                  <div className={styles.guestBenefitIcon}>◎</div>
                  <div>
                    <strong>{loc === "en" ? "Receive stock alerts" : "Stok bildirimi al"}</strong>
                    <p>
                      {loc === "en"
                        ? "Get notified when products come back."
                        : "Tükenen ürün geri gelince haberin olsun."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <>
         <section className={styles.vipAccountHero}>
  <div className={styles.vipAccountAura} />

  <div className={styles.vipAccountHeader}>
    <div className={styles.vipAccountText}>
      <div className={styles.vipAccountKicker}>
        {loc === "en" ? "Premium Account Area" : "Hesap Bilgileri"}
      </div>

      <h3 className={styles.vipAccountName}>{fullName}</h3>

      <div className={styles.vipAccountMeta}>
        {email ? <span>{email}</span> : null}
        {phone ? <span>{phone}</span> : null}
      </div>
    </div>

    <div className={styles.vipAccountSeal}>6</div>
  </div>

  <div className={styles.vipAccountActions}>
    <Link className={styles.vipAccountPrimary} href="/hesabim" onClick={onClose}>
      <span>{loc === "en" ? "Open account" : "Profilim"}</span>
      <b>→</b>
    </Link>

    {canOpenAdmin ? (
      <Link className={styles.vipAccountSecondary} href="/admin" onClick={onClose}>
        <span>Admin Panel</span>
        <b>↗</b>
      </Link>
    ) : null}
  </div>

  <div className={styles.vipAccountBadges}>
    <span
      className={`${styles.vipAccountBadge} ${
        isEmailVerified ? styles.vipAccountBadgeOk : styles.vipAccountBadgeWarn
      }`}
    >
      {isEmailVerified
        ? loc === "en"
          ? "Verified"
          : "Doğrulandı"
        : loc === "en"
        ? "Not verified"
        : "Doğrulanmadı"}
    </span>

    <span className={styles.vipAccountRole}>{roleLabel}</span>
  </div>

  {!isEmailVerified ? (
    <div className={styles.vipAccountVerify}>
      <p>
        {loc === "en"
          ? "Verify your email to save address information and complete orders securely."
          : "Adres bilgilerini kaydetmek ve siparişleri güvenli tamamlamak için e-postanı doğrula."}
      </p>

      <button className={styles.vipAccountPrimary} type="button" onClick={onSendVerify}>
        <span>{loc === "en" ? "Send verification code" : "Doğrulama kodu gönder"}</span>
        <b>→</b>
      </button>
    </div>
  ) : null}
</section>

            <section className={styles.stats}>
  <Link
    href="/cart"
    onClick={onClose}
    className={`${styles.stat} ${styles.statLink}`}
    title=""
  >
    <span>{loc === "en" ? "Cart" : "Sepet"}</span>
    <b>{cartCount}</b>
    <small>{loc === "en" ? "Open cart" : "Sepeti aç"}</small>
  </Link>

  <Link
    href="/hesabim?tab=favorites"
    onClick={onClose}
    className={`${styles.stat} ${styles.statLink}`}
    title=""
  >
    <span>{loc === "en" ? "Favorites" : "Favoriler"}</span>
    <b>{wishCount}</b>
    <small>{loc === "en" ? "View favorites" : "Favorileri gör"}</small>
  </Link>

 <Link
  href="/hesabim?tab=notifications"
  onClick={onClose}
  className={`${styles.stat} ${styles.statLink}`}
  title=""
>
  <span>{loc === "en" ? "Notifications" : "Bildirim"}</span>
  <b>{inboxItems.filter((x) => !x.isRead).length || stockAlertsCount}</b>
  <small>{loc === "en" ? "Open center" : "Merkezi aç"}</small>
</Link>

  <Link
    href="/cart"
    onClick={onClose}
    className={`${styles.stat} ${styles.statLink}`}
    title=""
  >
    <span>{loc === "en" ? "Subtotal" : "Tutar"}</span>
    <b>{money(cartSubtotal, loc)}</b>
    <small>{loc === "en" ? "Checkout" : "Ödemeye git"}</small>
  </Link>
</section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>{loc === "en" ? "Quick Links" : "Hızlı Linkler"}</div>

              <div className={styles.quickList}>
                {quickLinks.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={onClose}
                    className={styles.quickLink}
                    data-quick={item.key}
                  >
                    <div className={styles.quickIcon}>
                      <span className={styles.quickGlyph}>{item.glyph}</span>
                    </div>

                    <div className={styles.quickContent}>
                      <span>{item.title}</span>
                      <small>{item.desc}</small>
                    </div>

                    <div className={styles.quickArrow}>→</div>
                  </Link>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                {loc === "en" ? "Notification Center" : "Bildirim Merkezi"}
              </div>

              {inboxItems.length === 0 ? (
                <div className={styles.emptyMini}>
                  {loc === "en" ? "No notifications yet." : "Henüz bildirim yok."}
                </div>
              ) : (
                <div className={styles.notificationsList}>
                  {inboxItems.map((item) => (
                    <div key={item.id} className={styles.notificationCardWrap}>
                      <button
                        type="button"
                        className={styles.notificationCloseBtn}
                        aria-label={loc === "en" ? "Dismiss notification" : "Bildirimi kapat"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDismissNotification(item.id);
                        }}
                      >
                        ×
                      </button>

                     <Link
                      href={item.url || "/"}
                      onClick={() => {
                        handleOpenNotification(item);
                        onClose();
                      }}
                      className={styles.notificationItem}
                    >
                        <div className={styles.notificationTop}>
                          <strong>
                            {item.title || (loc === "en" ? "Notification" : "Bildirim")}
                          </strong>

                          <span className={styles.notificationDate}>
                            {fmtNotificationDate(item.createdAt, loc)}
                          </span>
                        </div>

                        <div className={styles.notificationBody}>
                          {item.body || (loc === "en" ? "Open details" : "Detayı aç")}
                        </div>

                        <div className={styles.notificationMeta}>
                          <span
                            className={`${styles.notificationTypePill} ${
                              styles[`notificationType_${notificationTone(item.type)}`]
                            }`}
                          >
                            {notificationTypeLabel(item.type, loc)}
                          </span>

                          {!item.isRead ? (
                            <span className={`${styles.pill} ${styles.infoPill}`}>
                              {loc === "en" ? "New" : "Yeni"}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                {loc === "en" ? "Account Summary" : "Hesap Özeti"}
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Last order" : "Son sipariş"}</span>

                  {orderId ? (
                    <Link
                      href={`/account/orders/${encodeURIComponent(orderId)}`}
                      onClick={onClose}
                      className={styles.infoLink}
                    >
                      {orderShort}
                    </Link>
                  ) : (
                    <b>{loc === "en" ? "No order yet" : "Henüz sipariş yok"}</b>
                  )}
                </div>

                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Order status" : "Sipariş durumu"}</span>

                  {orderId ? (
                    <b className={`${styles.statusBadge} ${styles[`status_${recentOrderTone}`]}`}>
                      {recentOrderStatus}
                    </b>
                  ) : (
                    <b>{loc === "en" ? "No active order" : "Aktif sipariş yok"}</b>
                  )}
                </div>

                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Order date" : "Sipariş tarihi"}</span>
                <b>{fmtOrderDate(currentRecentOrder, loc)}</b>
                </div>

                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Default address" : "Varsayılan adres"}</span>
                  <b>
                    {defaultAddressTitle
                      ? `${defaultAddressTitle}${
                          defaultAddressDistrict || defaultAddressCity
                            ? ` • ${[defaultAddressDistrict, defaultAddressCity]
                                .filter(Boolean)
                                .join(" / ")}`
                            : ""
                        }`
                      : loc === "en"
                      ? "Not defined"
                      : "Tanımlı değil"}
                  </b>
                </div>

                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Refund process" : "İade süreci"}</span>

                  <Link href="/hesabim?tab=refunds" onClick={onClose} className={styles.infoLink}>
                    {loc === "en" ? "View refund requests" : "İade taleplerini görüntüle"}
                  </Link>
                </div>

                <div className={styles.infoRow}>
                  <span>{loc === "en" ? "Shipment" : "Kargo takibi"}</span>

                 <Link href="/hesabim?tab=orders" onClick={onClose} className={styles.infoLink}>
                  {loc === "en" ? "Track shipments" : "Kargoları takip et"}
                </Link>
                </div>
              </div>
            </section>

            <div className={styles.actions}>
              <button className={styles.softBtn} type="button" onClick={onSignOut}>
                {loc === "en" ? "Sign out" : "Çıkış Yap"}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}