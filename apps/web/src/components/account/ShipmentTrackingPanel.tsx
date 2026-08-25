"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./accountPanels.module.css";

type Locale = "tr" | "en";

type OrderItem = {
  productId?: string;
  sku?: string;
  slug?: string;
  image?: string;
  qty?: number;
  title?: {
    tr?: string;
    en?: string;
  };
  unitPrice?: { amount?: number; currency?: string } | number;
  lineTotal?: { amount?: number; currency?: string } | number;
};

type OrderDoc = {
  id: string;
  uid?: string;
  status?: string;
  paymentStatus?: string;
  total?: { amount?: number; currency?: string } | number;
  createdAt?: any;
  createdAtIso?: string;
  items?: OrderItem[];

  shippingProvider?: string;
  shippingStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shipmentId?: string;
  shipmentRef?: string;
  shipmentDocId?: string;
  shippingReferenceId?: string;
  shippingInvoiceId?: string;
  shippingCancelled?: boolean;
  shippingCancelledAtIso?: string;
  shippingBarcodeError?: string;
shipmentHiddenByCustomer?: boolean;
shipmentHiddenByCustomerAt?: any;
  shippingAddress?: {
    fullName?: string;
    city?: string;
    district?: string;
    phone?: string;
    addressLine?: string;
  };
};

type Props = {
  uid: string;
  loc: Locale;
};

function safeStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function moneyAmount(v: any) {
  const n = Number(v?.amount ?? v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtTRY(v: any, loc: Locale) {
  return new Intl.NumberFormat(loc === "en" ? "en-US" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(moneyAmount(v));
}

function toDate(v: any, fallbackIso?: string) {
  try {
    if (v?.toDate) return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "string" && v.trim()) return new Date(v);
    if (fallbackIso) return new Date(fallbackIso);
    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any, loc: Locale, fallbackIso?: string) {
  const d = toDate(v, fallbackIso);

  if (!d || Number.isNaN(d.getTime())) {
    return loc === "en" ? "Date pending" : "Tarih bekleniyor";
  }

  return d.toLocaleString(loc === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickTitle(loc: Locale, item?: OrderItem | null) {
  if (loc === "en") {
    return safeStr(item?.title?.en) || safeStr(item?.title?.tr) || "Product";
  }

  return safeStr(item?.title?.tr) || safeStr(item?.title?.en) || "Ürün";
}

function safeImage(src?: string) {
  const v = safeStr(src);
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) {
    return v;
  }

  return `/${v.replace(/^\/+/, "")}`;
}

function orderStatusLabel(status: any, loc: Locale) {
  const v = safeStr(status).toLowerCase();

  const tr: Record<string, string> = {
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim edildi",
    cancelled: "İptal",
    refunded: "İade edildi",
    pending_payment: "Ödeme bekliyor",
  };

  const en: Record<string, string> = {
    paid: "Paid",
    preparing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    pending_payment: "Pending payment",
  };

  return loc === "en" ? en[v] || v || "Unknown" : tr[v] || v || "Bilinmiyor";
}

function hasRealShipment(order: OrderDoc) {
  const shippingStatus = safeStr(order.shippingStatus).toLowerCase();

  return Boolean(
    ["created", "barcode_error", "shipped", "delivered"].includes(shippingStatus) ||
      safeStr(order.trackingNumber) ||
      safeStr(order.trackingUrl) ||
      safeStr(order.shipmentId) ||
      safeStr(order.shipmentRef) ||
      safeStr(order.shippingReferenceId)
  );
}

function isClosedOrder(order: OrderDoc) {
  const st = safeStr(order.status).toLowerCase();
  const shippingStatus = safeStr(order.shippingStatus).toLowerCase();

  return (
    st === "cancelled" ||
    st === "refunded" ||
    order.shippingCancelled === true ||
    shippingStatus === "cancelled"
  );
}

function shipmentVisualState(order: OrderDoc) {
  const st = safeStr(order.status).toLowerCase();
  const ship = safeStr(order.shippingStatus).toLowerCase();
  const hasShipment = hasRealShipment(order);
  const closed = isClosedOrder(order);

  if (closed) return "closed";
  if (ship === "delivered" || st === "delivered") return "delivered";
  if (ship === "shipped" || st === "shipped") return "shipped";
  if (hasShipment) return "created";
  if (st === "paid" || st === "preparing") return "waiting";
  return "neutral";
}

function shipmentTitle(order: OrderDoc, loc: Locale) {
  const state = shipmentVisualState(order);
  const ship = safeStr(order.shippingStatus).toLowerCase();

  const tr: Record<string, string> = {
    waiting: "Kargo hazırlanıyor",
    created: "Kargo oluşturuldu",
    shipped: "Kargoya verildi",
    delivered: "Teslim edildi",
    closed: "Kargo süreci kapandı",
    neutral: "Kargo bekleniyor",
  };

  const en: Record<string, string> = {
    waiting: "Shipment is being prepared",
    created: "Shipment created",
    shipped: "Shipped",
    delivered: "Delivered",
    closed: "Shipment flow closed",
    neutral: "Shipment pending",
  };

  if (ship === "barcode_error") {
    return loc === "en" ? "Label pending" : "Etiket bekleniyor";
  }

  return loc === "en" ? en[state] : tr[state];
}

function shipmentDesc(order: OrderDoc, loc: Locale) {
  const state = shipmentVisualState(order);

  const tr: Record<string, string> = {
    waiting:
      "Siparişin alındı. Mağaza ürünü hazırladıktan sonra kargo takip bilgileri burada görünecek.",
    created:
      "Kargo kaydı oluşturuldu. Takip numarası aktif olduğunda buradan izleyebilirsin.",
    shipped:
      "Paket kargoya verildi. Takip linki varsa teslimat hareketlerini görüntüleyebilirsin.",
    delivered:
      "Paket teslim edilmiş görünüyor. Herhangi bir sorun varsa destek ekibimizle iletişime geçebilirsin.",
    closed:
      "Bu sipariş için aktif kargo süreci bulunmuyor. Sipariş iptal/iade sürecine alınmış olabilir.",
    neutral:
      "Bu sipariş için henüz kargo kaydı oluşturulmadı.",
  };

  const en: Record<string, string> = {
    waiting:
      "Your order has been received. Tracking details will appear here after the store prepares the package.",
    created:
      "Shipment record has been created. Tracking details will appear when available.",
    shipped:
      "Your package has been handed to the carrier. You can track it if a tracking link is available.",
    delivered:
      "Your package appears to be delivered. Contact support if you need help.",
    closed:
      "There is no active shipment flow for this order. It may have been cancelled or refunded.",
    neutral:
      "No shipment record has been created yet.",
  };

  return loc === "en" ? en[state] : tr[state];
}

function shipmentBadgeTone(order: OrderDoc) {
  const state = shipmentVisualState(order);
  if (state === "delivered") return "ok";
  if (state === "shipped" || state === "created") return "info";
  if (state === "waiting") return "warn";
  if (state === "closed") return "bad";
  return "neutral";
}

function regionText(order: OrderDoc) {
  const district = safeStr(order.shippingAddress?.district);
  const city = safeStr(order.shippingAddress?.city);
  return [district, city].filter(Boolean).join(" / ") || "—";
}

function sortOrdersDesc(list: OrderDoc[]) {
  return [...list].sort((a, b) => {
    const aTime =
      a?.createdAt?.toMillis?.() ||
      (a?.createdAtIso ? new Date(a.createdAtIso).getTime() : 0);

    const bTime =
      b?.createdAt?.toMillis?.() ||
      (b?.createdAtIso ? new Date(b.createdAtIso).getTime() : 0);

    return bTime - aTime;
  });
}

function shouldShowInShipmentCenter(order: OrderDoc) {
  const st = safeStr(order.status).toLowerCase();

  return [
    "paid",
    "preparing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ].includes(st);
}

export default function ShipmentTrackingPanel({ uid, loc }: Props) {
  const db = useMemo(() => getFirebaseDb(), []);

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    const qy = query(collection(db, "orders"), where("uid", "==", uid), limit(80));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as OrderDoc[];

        setOrders(sortOrdersDesc(list));
        setLoading(false);
      },
      (e) => {
        console.error("shipment tracking panel load error:", e);
        setErr(
          loc === "en"
            ? "Shipment records could not be loaded."
            : "Kargo kayıtları yüklenemedi."
        );
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid, loc]);

const shipmentOrders = useMemo(() => {
  return orders.filter((order) => {
    if (order.shipmentHiddenByCustomer === true) return false;
    return shouldShowInShipmentCenter(order);
  });
}, [orders]);

  const counts = useMemo(() => {
    return shipmentOrders.reduce(
      (acc, order) => {
        acc.total += 1;

        const state = shipmentVisualState(order);

        if (state === "delivered") acc.delivered += 1;
        else if (state === "shipped") acc.inTransit += 1;
        else if (state === "created") acc.created += 1;
        else if (state === "waiting") acc.pending += 1;
        else if (state === "closed") acc.closed += 1;

        return acc;
      },
      { total: 0, created: 0, inTransit: 0, delivered: 0, pending: 0, closed: 0 }
    );
  }, [shipmentOrders]);
async function hideClosedShipment(order: OrderDoc) {
  const closed = isClosedOrder(order);

  if (!closed) return;

  const ok = window.confirm(
    loc === "en"
      ? "Remove this closed shipment from your shipment tracking list?"
      : "Bu kapanan kargoyu kargo takip listesinden kaldırmak istiyor musun?"
  );

  if (!ok) return;

  try {
    await updateDoc(doc(db, "orders", order.id), {
      shipmentHiddenByCustomer: true,
      shipmentHiddenByCustomerAt: serverTimestamp(),
      shipmentHiddenByCustomerAtIso: new Date().toISOString(),
    });
  } catch (e) {
    console.error("hide closed shipment error:", e);
    setErr(
      loc === "en"
        ? "Closed shipment could not be removed from the list."
        : "Kapanan kargo listeden kaldırılamadı."
    );
  }
}
  return (
    <section className={`${s.panel} ${s.shipmentPanel}`}>
      <div className={`${s.hero} ${s.shipmentHero}`}>
        <div>
          <div className={s.kicker}>
            {loc === "en" ? "Shipment Center" : "Kargo Merkezi"}
          </div>

          <h2 className={s.title}>
            {loc === "en" ? "Shipment Tracking" : "Kargo Takibi"}
          </h2>

          <p className={s.desc}>
            {loc === "en"
              ? "Follow your package preparation, shipment status, tracking number and delivery flow."
              : "Paket hazırlık sürecini, kargo durumunu, takip numaranı ve teslimat akışını buradan takip edebilirsin."}
          </p>
        </div>

        <div className={s.stats}>
          <div className={s.stat}>
            <span>{loc === "en" ? "Orders" : "Sipariş"}</span>
            <b>{counts.total}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "Preparing" : "Hazırlık"}</span>
            <b>{counts.pending}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "In transit" : "Yolda"}</span>
            <b>{counts.inTransit}</b>
          </div>

          <div className={s.stat}>
            <span>{loc === "en" ? "Delivered" : "Teslim"}</span>
            <b>{counts.delivered}</b>
          </div>
        </div>
      </div>

      {err ? <div className={s.alertBad}>{err}</div> : null}

      <div className={`${s.card} ${s.shipmentListCard}`}>
        <div className={s.cardHead}>
          <div>
            <h3>{loc === "en" ? "Shipment list" : "Kargo listesi"}</h3>
            <p>
              {loc === "en"
                ? "Orders are separated by preparation, shipment and delivery status."
                : "Siparişler hazırlık, kargo ve teslimat durumuna göre ayrılır."}
            </p>
          </div>

          <span className={s.livePill}>
            <span />
            {loc === "en" ? "Live" : "Canlı"}
          </span>
        </div>

        {loading ? (
          <div className={s.empty}>
            {loc === "en" ? "Loading shipments..." : "Kargo kayıtları yükleniyor..."}
          </div>
        ) : shipmentOrders.length === 0 ? (
          <div className={s.empty}>
            <b>{loc === "en" ? "No shipment yet." : "Henüz kargo kaydı yok."}</b>
            <small>
              {loc === "en"
                ? "Shipment details will appear after your first paid order."
                : "İlk ödemesi tamamlanan siparişinden sonra kargo bilgileri burada görünür."}
            </small>
          </div>
        ) : (
          <div className={s.list}>
            {shipmentOrders.map((order) => {
              const hasShipment = hasRealShipment(order);
              const state = shipmentVisualState(order);
              const tone = shipmentBadgeTone(order);

              const trackingUrl = safeStr(order.trackingUrl);
              const trackingNumber = safeStr(order.trackingNumber);
              const provider = safeStr(order.shippingProvider || "mng");

              const items = Array.isArray(order.items) ? order.items : [];
              const firstItem = items[0] || null;
              const extraCount = Math.max(0, items.length - 1);

              const productTitle = pickTitle(loc, firstItem);
              const productImage = safeImage(firstItem?.image);
              const productQty = Number(firstItem?.qty || 1) || 1;
              const productSku = safeStr(firstItem?.sku);
              const productSlug = safeStr(firstItem?.slug);

              const productHref = productSlug
                ? `/products/${encodeURIComponent(productSlug)}`
                : "/shop";

              const productLineTotal = moneyAmount(firstItem?.lineTotal);

              return (
                <article
                  key={order.id}
                  className={`${s.rowCard} ${s.shipmentRowCard} ${s[`shipmentState_${state}`] || ""}`}
                >
                  <div className={s.rowTop}>
                    <div>
                      <div className={s.rowTitle}>
                        #{safeStr(order.id).slice(0, 12).toUpperCase()}
                      </div>

                      <div className={s.rowMeta}>
                        <span>{fmtDate(order.createdAt, loc, order.createdAtIso)}</span>
                        <span>•</span>
                        <span>{orderStatusLabel(order.status, loc)}</span>
                        <span>•</span>
                        <span>{fmtTRY(order.total, loc)}</span>
                      </div>
                    </div>

                    <span className={`${s.badge} ${s[`badge_${tone}`]}`}>
                      {shipmentTitle(order, loc)}
                    </span>
                  </div>

                  <div className={s.productMini}>
                    <Link href={productHref} className={s.productImageBox}>
                      {productImage ? (
                        <img src={productImage} alt={productTitle} />
                      ) : (
                        <span>✦</span>
                      )}
                    </Link>

                    <div className={s.productMiniBody}>
                      <Link href={productHref} className={s.productMiniTitle}>
                        {productTitle}
                      </Link>

                      <div className={s.productMiniMeta}>
                        <span>
                          {loc === "en" ? "Qty" : "Adet"}: <b>{productQty}</b>
                        </span>

                        {productSku ? (
                          <>
                            <span>•</span>
                            <span>
                              SKU: <b>{productSku}</b>
                            </span>
                          </>
                        ) : null}

                        {productLineTotal > 0 ? (
                          <>
                            <span>•</span>
                            <span>
                              {loc === "en" ? "Product total" : "Ürün toplamı"}:{" "}
                              <b>{fmtTRY(productLineTotal, loc)}</b>
                            </span>
                          </>
                        ) : null}

                        {extraCount > 0 ? (
                          <>
                            <span>•</span>
                            <span>
                              <b>
                                +{extraCount} {loc === "en" ? "more item" : "ürün daha"}
                              </b>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className={`${s.shipmentStatusBox} ${s[`shipmentBox_${state}`] || ""}`}>
                    <div>
                      <b>{shipmentTitle(order, loc)}</b>
                      <span>{shipmentDesc(order, loc)}</span>
                    </div>
                  </div>

                  <div className={s.timeline}>
                    <div className={`${s.step} ${s.stepDone}`}>
                      <span />
                      <b>{loc === "en" ? "Order received" : "Sipariş alındı"}</b>
                    </div>

                    <div
                      className={`${s.step} ${
                        hasShipment || ["created", "shipped", "delivered"].includes(state)
                          ? s.stepDone
                          : ""
                      }`}
                    >
                      <span />
                      <b>{loc === "en" ? "Shipment created" : "Kargo oluşturuldu"}</b>
                    </div>

                    <div
                      className={`${s.step} ${
                        state === "shipped" || state === "delivered" ? s.stepDone : ""
                      }`}
                    >
                      <span />
                      <b>{loc === "en" ? "In transit" : "Yolda"}</b>
                    </div>

                    <div className={`${s.step} ${state === "delivered" ? s.stepDone : ""}`}>
                      <span />
                      <b>{loc === "en" ? "Delivered" : "Teslim"}</b>
                    </div>
                  </div>

                  {hasShipment ? (
                    <div className={s.infoGrid}>
                      <div className={s.infoBox}>
                        <span>{loc === "en" ? "Provider" : "Sağlayıcı"}</span>
                        <b>{provider.toUpperCase()}</b>
                      </div>

                      <div className={s.infoBox}>
                        <span>{loc === "en" ? "Tracking no" : "Takip no"}</span>
                        <b>{trackingNumber || "—"}</b>
                      </div>

                      <div className={s.infoBox}>
                        <span>{loc === "en" ? "Delivery region" : "Teslimat bölgesi"}</span>
                        <b>{regionText(order)}</b>
                      </div>
                    </div>
                  ) : (
                    <div className={s.infoGrid}>
                      <div className={s.infoBox}>
                        <span>{loc === "en" ? "Delivery region" : "Teslimat bölgesi"}</span>
                        <b>{regionText(order)}</b>
                      </div>

                      <div className={s.infoBox}>
                        <span>{loc === "en" ? "Tracking no" : "Takip no"}</span>
                        <b>{loc === "en" ? "Not assigned yet" : "Henüz atanmadı"}</b>
                      </div>
                    </div>
                  )}

                  {safeStr(order.shippingBarcodeError) ? (
                    <div className={s.alertWarnSmall}>
                      {safeStr(order.shippingBarcodeError)}
                    </div>
                  ) : null}

                 <div className={s.actions}>
  <Link
    href={`/account/orders/${encodeURIComponent(order.id)}`}
    className={s.secondaryBtn}
  >
    {loc === "en" ? "Order detail" : "Sipariş detayı"}
  </Link>

  {trackingUrl && hasShipment && state !== "closed" ? (
    <a
      href={trackingUrl}
      target="_blank"
      rel="noreferrer"
      className={s.primaryBtn}
    >
      {loc === "en" ? "Track shipment" : "Kargoyu takip et"}
    </a>
  ) : null}

  {state === "closed" ? (
    <button
      type="button"
      className={s.dangerSoftBtn}
      onClick={() => hideClosedShipment(order)}
    >
      {loc === "en" ? "Remove from list" : "Listeden kaldır"}
    </button>
  ) : null}
</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}