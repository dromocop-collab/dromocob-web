"use client";

import Link from "next/link";
import styles from "@/styles/order-tab.module.css";

type Money = { amount: number; currency: string };

type OrderRow = {
  id: string;
  status?: string;
  total?: Money | number;
  currency?: string;
  createdAt?: any;
  createdAtIso?: string;
  itemCount?: number;
};

function getTotalAmount(order: OrderRow) {
  if (order?.total && typeof order.total === "object") {
    const n = Number(order.total.amount ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(order?.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getTotalCurrency(order: OrderRow) {
  if (order?.total && typeof order.total === "object") {
    return String(order.total.currency || "TRY");
  }
  return String(order?.currency || "TRY");
}

export default function OrdersTab({
  loc,
  orders,
  oBusy,
  fmtMoney,
  fmtOrderDate,
  statusLabel,
  statusTone,
}: {
  loc: "tr" | "en";
  orders: OrderRow[];
  oBusy: boolean;
  fmtMoney: (v: number, loc: "tr" | "en", currency?: string) => string;
  fmtOrderDate: (v: any, loc: "tr" | "en", fallbackIso?: string) => string;
  statusLabel: (status: any, loc: "tr" | "en") => string;
  statusTone: (status: any) => string;
}) {
  const hasOrders = Array.isArray(orders) && orders.length > 0;

  return (
    <div className={styles.contentCard}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            {loc === "en" ? "Orders" : "Siparişler"}
          </h2>
          <p className={styles.sectionDesc}>
            {loc === "en"
              ? "Track your recent orders, payment status and delivery updates."
              : "Son siparişlerini, ödeme durumunu ve teslimat güncellemelerini takip et."}
          </p>
        </div>

        {!oBusy && hasOrders ? (
          <div className={styles.ordersHeadMeta}>
            <span className={styles.ordersHeadPill}>
              {orders.length} {loc === "en" ? "record(s)" : "kayıt"}
            </span>
          </div>
        ) : null}
      </div>

      {oBusy ? (
        <div className={`${styles.emptyStateCard} ${styles.ordersStateCard}`}>
          <div className={styles.emptyStateTitle}>
            {loc === "en" ? "Loading..." : "Yükleniyor..."}
          </div>
          <div className={styles.emptyStateText}>
            {loc === "en"
              ? "Your orders are being prepared."
              : "Siparişlerin hazırlanıyor, bir saniye."}
          </div>
        </div>
      ) : !hasOrders ? (
        <div className={`${styles.emptyStateCard} ${styles.ordersStateCard}`}>
          <div className={styles.emptyStateTitle}>
            {loc === "en" ? "No orders yet." : "Henüz sipariş yok."}
          </div>
          <div className={styles.emptyStateText}>
            {loc === "en"
              ? "Once you place your first order, it will appear here with status tracking."
              : "İlk siparişini verdiğinde burada durum takibiyle birlikte görünecek."}
          </div>

          <div className={styles.sectionActions}>
            <Link href="/shop" className={styles.heroPrimaryBtn}>
              {loc === "en" ? "Go to shop" : "Mağazaya git"}
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.ordersGrid}>
          {orders.map((o) => {
            const id = String(o?.id || "").trim();
            if (!id) return null;

            const shortId = `#${id.slice(0, 10).toUpperCase()}`;
            const totalAmount = getTotalAmount(o);
            const totalCur = getTotalCurrency(o);
            const toneKey = String(statusTone(o?.status) || "warn");
            const toneClass =
              styles[`tone_${toneKey}` as keyof typeof styles] || styles.tone_warn;

            return (
              <Link
                key={id}
                href={`/account/orders/${encodeURIComponent(id)}`}
                className={`${styles.orderCard} ${styles.orderCardPremium}`}
              >
                <div className={styles.orderTop}>
                  <div className={styles.orderHeadBlock}>
                    <div className={styles.orderId}>{shortId}</div>

                    <div className={styles.orderDate}>
                      {loc === "en" ? "Date" : "Tarih"}:{" "}
                      {fmtOrderDate(o?.createdAt, loc, o?.createdAtIso)}
                    </div>
                  </div>

                  <div className={`${styles.orderStatus} ${toneClass}`}>
                    {statusLabel(o?.status, loc)}
                  </div>
                </div>

                <div className={styles.orderBottom}>
                  <div className={styles.orderMetaBlock}>
                    <div className={styles.orderMetaLabel}>
                      {loc === "en" ? "Products" : "Ürünler"}
                    </div>
                    <div className={styles.orderMeta}>
                      {Number(o?.itemCount || 0)} {loc === "en" ? "item(s)" : "ürün"}
                    </div>
                  </div>

                  <div className={styles.orderTotalBlock}>
                    <div className={styles.orderMetaLabel}>
                      {loc === "en" ? "Total" : "Toplam"}
                    </div>
                    <div className={styles.orderTotal}>
                      {fmtMoney(totalAmount, loc, totalCur)}
                    </div>
                  </div>
                </div>

                <div className={styles.orderLink}>
                  {loc === "en"
                    ? "View order details →"
                    : "Sipariş detayını görüntüle →"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}