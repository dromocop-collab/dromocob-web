"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect } from "react";
import { getFirebaseDb } from "@/lib/firebase.client";
import styles from "@/styles/notifications-center.module.css";

type Locale = "tr" | "en";

type InboxNotification = {
  id: string;
  title: string;
  body: string;
  image: string;
  url: string;
  type: string;
  isRead: boolean;
  data?: any;
  createdAt?: Timestamp | null;
};

function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function safeCustomerUrl(v: any, data?: any) {
  const url = safeStr(v);

  const orderId =
    safeStr(data?.orderId) ||
    safeStr(data?.orderDocId) ||
    safeStr(data?.id);

  // Admin sipariş linki geldiyse müşteriye uygun sipariş detayına çevir.
  const adminOrderMatch = url.match(/^\/admin\/orders\/([^/?#]+)/);
  if (adminOrderMatch?.[1]) {
    return `/account/orders/${encodeURIComponent(adminOrderMatch[1])}`;
  }

  // Direkt orderId varsa müşteri sipariş detayına git.
  if (orderId) {
    return `/account/orders/${encodeURIComponent(orderId)}`;
  }

  // Admin tarafına asla götürme.
  if (url.startsWith("/admin")) {
    return "/hesabim?tab=notifications";
  }

  if (url.startsWith("/account/")) return url;
  if (url.startsWith("/hesabim")) return url;
  if (url.startsWith("/products/")) return url;
  if (url.startsWith("/shop")) return url;

  return "/hesabim?tab=notifications";
}

function fmtDate(v: Timestamp | null | undefined, loc: Locale) {
  try {
    if (!v?.toDate) return loc === "en" ? "Now" : "Şimdi";

    return v.toDate().toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return loc === "en" ? "Now" : "Şimdi";
  }
}

function notificationTone(type: string) {
  const t = safeStr(type).toLowerCase();

  if (t.includes("refund") || t.includes("iade")) return "refund";
  if (
    t.includes("shipment") ||
    t.includes("shipping") ||
    t.includes("cargo") ||
    t.includes("kargo")
  ) {
    return "shipment";
  }
  if (t.includes("support") || t.includes("message") || t.includes("chat")) {
    return "message";
  }
  if (t.includes("order") || t.includes("sipariş") || t.includes("new_order")) {
    return "order";
  }

  return "default";
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
    new_order: "Sipariş",
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
    new_order: "Order",
    order_paid: "Order Paid",
    order_preparing: "Preparing",
    order_shipped: "Shipped",
    order_delivered: "Delivered",
  };

  return loc === "en" ? en[t] || "General" : tr[t] || "Genel";
}
function isCustomerNotification(x: any) {
  const type = safeStr(x?.type).toLowerCase();
  const url = safeStr(x?.url).toLowerCase();
  const title = safeStr(x?.title).toLocaleLowerCase("tr-TR");
  const body = safeStr(x?.body).toLocaleLowerCase("tr-TR");
  const data = x?.data || {};

  const targetPermission = safeStr(x?.targetPermission || data?.targetPermission).toLowerCase();
  const targetRole = safeStr(x?.targetRole || data?.targetRole).toLowerCase();

  // Admin panel linkleri müşteri bildirim merkezinde görünmesin.
  if (url.startsWith("/admin")) return false;

  // Admin sipariş bildirimi: "Yeni sipariş geldi" müşteri bildirimi değildir.
  if (type === "new_order") return false;

  // Admin permission/role hedefli bildirimleri ele.
  if (targetPermission) return false;
  if (targetRole === "admin" || targetRole === "sub_admin") return false;

  // Metinsel güvenlik filtresi.
  const hay = `${title} ${body}`;

  if (
    hay.includes("yeni havale") ||
    hay.includes("yeni eft") ||
    hay.includes("siparişi geldi") ||
    hay.includes("yeni sipariş geldi") ||
    hay.includes("admin")
  ) {
    return false;
  }

  return true;
}
export default function NotificationsCenterPanel({
  uid,
  loc,
}: {
  uid: string;
  loc: Locale;
}) {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "order" | "refund" | "shipment" | "message"
  >("all");

  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qRef = query(
      collection(db, "users", uid, "inbox_notifications"),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
       const next: InboxNotification[] = snap.docs
  .map((d) => {
    const x: any = d.data();

    return {
      id: d.id,
      title: safeStr(x?.title),
      body: safeStr(x?.body),
      image: safeStr(x?.image),
      url: safeCustomerUrl(x?.url, x?.data),
      type: safeStr(x?.type),
      isRead: x?.isRead === true,
      data: x?.data || null,
      createdAt: (x?.createdAt as Timestamp) || null,
    };
  })
  .filter(isCustomerNotification);

setRows(next);
        setLoading(false);
      },
      (err) => {
        console.error("notifications center load error:", err);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid]);

  function fireToast(msg: string) {
    setToast(msg);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 2200);
  }

  async function markRead(item: InboxNotification) {
    if (!uid || item.isRead) return;

    try {
      await updateDoc(doc(db, "users", uid, "inbox_notifications", item.id), {
        isRead: true,
      });
    } catch (err) {
      console.error("notification mark read error:", err);
    }
  }

  async function deleteItem(id: string) {
    if (!uid) return;

    try {
      setBusy(id);
      await deleteDoc(doc(db, "users", uid, "inbox_notifications", id));
      fireToast(loc === "en" ? "Notification deleted." : "Bildirim silindi.");
    } catch (err) {
      console.error("notification delete error:", err);
      fireToast(loc === "en" ? "Could not delete." : "Silinemedi.");
    } finally {
      setBusy("");
    }
  }

  async function markAllRead() {
    if (!uid) return;

    const unread = rows.filter((x) => !x.isRead);

    if (!unread.length) {
      fireToast(loc === "en" ? "No unread notifications." : "Okunmamış bildirim yok.");
      return;
    }

    try {
      setBusy("mark_all");

      const batch = writeBatch(db);

      unread.slice(0, 450).forEach((item) => {
        batch.update(doc(db, "users", uid, "inbox_notifications", item.id), {
          isRead: true,
        });
      });

      await batch.commit();
      fireToast(loc === "en" ? "All marked as read." : "Tümü okundu işaretlendi.");
    } catch (err) {
      console.error("mark all read error:", err);
      fireToast(loc === "en" ? "Could not update." : "Güncellenemedi.");
    } finally {
      setBusy("");
    }
  }

  async function clearRead() {
    if (!uid) return;

    const read = rows.filter((x) => x.isRead);

    if (!read.length) {
      fireToast(loc === "en" ? "No read notifications." : "Silinecek okunmuş bildirim yok.");
      return;
    }

    const ok = window.confirm(
      loc === "en" ? "Delete all read notifications?" : "Okunmuş tüm bildirimler silinsin mi?"
    );

    if (!ok) return;

    try {
      setBusy("clear_read");

      const batch = writeBatch(db);

      read.slice(0, 450).forEach((item) => {
        batch.delete(doc(db, "users", uid, "inbox_notifications", item.id));
      });

      await batch.commit();
      fireToast(loc === "en" ? "Read notifications deleted." : "Okunmuş bildirimler silindi.");
    } catch (err) {
      console.error("clear read notifications error:", err);
      fireToast(loc === "en" ? "Could not delete." : "Silinemedi.");
    } finally {
      setBusy("");
    }
  }

  const unreadCount = rows.filter((x) => !x.isRead).length;

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "unread") return rows.filter((x) => !x.isRead);

    return rows.filter((x) => notificationTone(x.type) === filter);
  }, [rows, filter]);

  if (loading) {
    return (
      <section className={styles.stateCard}>
        <b>{loc === "en" ? "Loading notifications..." : "Bildirimler yükleniyor..."}</b>
        <span>{loc === "en" ? "Please wait." : "Bir saniye, bildirim merkezi hazırlanıyor."}</span>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <div className={styles.hero}>
        <div>
          <div className={styles.kicker}>
            {loc === "en" ? "PREMIUM NOTIFICATION AREA" : "PREMİUM BİLDİRİM ALANI"}
          </div>

          <h1>{loc === "en" ? "Notification Center" : "Bildirim Merkezi"}</h1>

          <p>
            {loc === "en"
              ? "Track order, refund, shipment and support updates from one elegant center."
              : "Sipariş, iade, kargo ve destek güncellemelerini tek merkezden takip et."}
          </p>
        </div>

        <div className={styles.heroStats}>
          <div>
            <b>{rows.length}</b>
            <span>{loc === "en" ? "Total" : "Toplam"}</span>
          </div>

          <div>
            <b>{unreadCount}</b>
            <span>{loc === "en" ? "Unread" : "Yeni"}</span>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            ["all", loc === "en" ? "All" : "Tümü"],
            ["unread", loc === "en" ? "Unread" : "Yeni"],
            ["order", loc === "en" ? "Orders" : "Sipariş"],
            ["refund", loc === "en" ? "Refunds" : "İade"],
            ["shipment", loc === "en" ? "Shipment" : "Kargo"],
            ["message", loc === "en" ? "Messages" : "Mesaj"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as any)}
              className={filter === key ? styles.filterActive : ""}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarActions}>
          <button type="button" onClick={markAllRead} disabled={busy === "mark_all"}>
            {busy === "mark_all"
              ? loc === "en"
                ? "Updating..."
                : "Güncelleniyor..."
              : loc === "en"
              ? "Mark all read"
              : "Tümünü okundu yap"}
          </button>

          <button type="button" onClick={clearRead} disabled={busy === "clear_read"}>
            {busy === "clear_read"
              ? loc === "en"
                ? "Deleting..."
                : "Siliniyor..."
              : loc === "en"
              ? "Clear read"
              : "Okunmuşları sil"}
          </button>
        </div>
      </div>

      <div className={styles.listPanel}>
        {filteredRows.length ? (
          <div className={styles.list}>
            {filteredRows.map((item) => {
              const tone = notificationTone(item.type);

              return (
                <article
                  key={item.id}
                  className={`${styles.card} ${!item.isRead ? styles.cardUnread : ""}`}
                >
                  <Link
                    href={item.url || "/"}
                    className={styles.cardLink}
                    onClick={() => markRead(item)}
                  >
                    <div className={`${styles.iconBox} ${styles[`tone_${tone}`]}`}>
                      {tone === "order"
                        ? "◩"
                        : tone === "refund"
                        ? "↺"
                        : tone === "shipment"
                        ? "▤"
                        : tone === "message"
                        ? "✉"
                        : "✦"}
                    </div>

                    <div className={styles.content}>
                      <div className={styles.topLine}>
                        <span className={`${styles.typePill} ${styles[`pill_${tone}`]}`}>
                          {notificationTypeLabel(item.type, loc)}
                        </span>

                        <time>{fmtDate(item.createdAt, loc)}</time>
                      </div>

                      <h2>{item.title || (loc === "en" ? "Notification" : "Bildirim")}</h2>

                      <p>{item.body || (loc === "en" ? "Open details" : "Detayı aç")}</p>

                      <div className={styles.bottomLine}>
                        {!item.isRead ? (
                          <span className={styles.newPill}>
                            {loc === "en" ? "New" : "Yeni"}
                          </span>
                        ) : (
                          <span className={styles.readPill}>
                            {loc === "en" ? "Read" : "Okundu"}
                          </span>
                        )}

                        <span className={styles.openText}>
                          {loc === "en" ? "Open detail" : "Detayı aç"} →
                        </span>
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => deleteItem(item.id)}
                    disabled={busy === item.id}
                    aria-label={loc === "en" ? "Delete notification" : "Bildirimi sil"}
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <b>{loc === "en" ? "No notifications found." : "Bildirim bulunamadı."}</b>
            <span>
              {loc === "en"
                ? "When there is an update about your order, shipment, refund or support messages, it will appear here."
                : "Sipariş, kargo, iade veya destek mesajlarında güncelleme olduğunda burada görünecek."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}