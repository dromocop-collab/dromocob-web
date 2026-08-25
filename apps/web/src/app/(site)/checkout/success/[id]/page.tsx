"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { removeFromCart } from "@/lib/cart";
import { clearCartEverywhere } from "@/lib/cartFirestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import { formatOrderId } from "@/lib/orderId";
import { getWhatsAppNumber, onWhatsAppNumberChange } from "@/lib/whatsapp";
import s from "./success.module.css";
import { trackMetaPurchase } from "@/lib/metaPixel";
import { trackPurchase } from "@/components/AnalyticsTracker";

type PaymentSessionItem = {
  productId?: string;
  slug?: string;
  qty?: number;
};

type PaymentSessionDoc = {
  uid?: string;
  email?: string;
  status?: string;
  paymentStatus?: string;
  orderCreated?: boolean;
  orderId?: string;
  items?: PaymentSessionItem[];
  resolvedItems?: PaymentSessionItem[];
  amountTry?: number;
  callbackData?: Record<string, unknown>;
};

type OrderDoc = {
  uid?: string;
  status?: string;
  paymentStatus?: string;
  items?: Array<{
    productId?: string;
    slug?: string;
    title?: any;
    name?: string;
    qty?: number;
    priceTry?: number;
    unitPrice?: number | { amount?: number };
  }>;
  total?: number | { amount?: number };
  subtotal?: number | { amount?: number };
  discount?: number | { amount?: number };
  shippingFee?: number | { amount?: number };
  coupon?: {
    code?: string;
    label?: string;
    discountType?: string;
    discountValue?: number;
  };
  payment?: {
    provider?: string;
    method?: string;
    ref?: string;
  };
  meta?: {
    paymentSessionId?: string;
  };
};

const CHECKOUT_DRAFT_KEY = "nci_checkout_draft_v1";
const PENDING_CARD_KEY = "nci_pending_card_payment_v1";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function cleanCartByItems(
  uid: string,
  items: Array<{ productId?: string; slug?: string }> = []
) {
  if (!uid) return;

  for (const it of items) {
    // Sadece ilk bulunan key ile sil — hem productId hem slug ile silmek
    // farklı ürünün yanlışlıkla silinmesine yol açabilir
    const key = safeStr(it?.productId) || safeStr(it?.slug);
    if (!key) continue;

    try {
      removeFromCart(key, uid);
    } catch (e) {
      console.error("[checkout/success] removeFromCart failed:", e);
    }
  }

  try {
    window.dispatchEvent(new Event("cart:changed"));
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    sessionStorage.removeItem(PENDING_CARD_KEY);
  } catch {
    // noop
  }
}

function getPendingItemsFromStorage(): Array<{ productId?: string }> {
  try {
    const raw = sessionStorage.getItem(PENDING_CARD_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function getSessionIdFromStorage(fallback: string) {
  const routeId = safeStr(fallback);

  // En güvenlisi: PayTR dönüş URL’sindeki id her zaman öncelikli olmalı.
  if (routeId) return routeId;

  try {
    const raw = sessionStorage.getItem(PENDING_CARD_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return (
      safeStr(parsed?.merchantOid) ||
      safeStr(parsed?.paymentIntentId) ||
      ""
    );
  } catch {
    return "";
  }
}



function getOrderStatusText(order: OrderDoc | null, loc: Locale) {
  const status = safeStr(order?.status).toLowerCase();
  const paymentStatus = safeStr(order?.paymentStatus).toLowerCase();

  if (status === "refunded") return loc === "en" ? "Refunded" : "İade edildi";
  if (paymentStatus === "paid" || status === "paid") return loc === "en" ? "Paid" : "Ödendi";
  if (status === "preparing") return loc === "en" ? "Preparing" : "Hazırlanıyor";
  if (status === "shipped") return loc === "en" ? "Shipped" : "Kargoda";
  if (status === "delivered") return loc === "en" ? "Delivered" : "Teslim edildi";
  if (status === "cancelled") return loc === "en" ? "Cancelled" : "İptal";

  return loc === "en" ? "Being checked" : "Kontrol ediliyor";
}

export default function CheckoutSuccess({ params }: { params: { id: string } }) {
  const routeSessionId = decodeURIComponent(params.id || "");

  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [session, setSession] = useState<PaymentSessionDoc | null>(null);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [realOrderId, setRealOrderId] = useState("");

  const [phase, setPhase] = useState<"checking" | "paid" | "order-found" | "failed" | "waiting">(
    "checking"
  );
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [fx, setFx] = useState(false);
  const [waNumber, setWaNumber] = useState(getWhatsAppNumber);

  const redirectedRef = useRef(false);
  const cleanedRef = useRef(false);
const pollingRef = useRef<number | null>(null);
  const isRealUser = !!user && !user.isAnonymous;
  const uid = isRealUser ? user.uid : "";

  const sessionId = useMemo(
    () => getSessionIdFromStorage(routeSessionId),
    [routeSessionId]
  );

  const displayId = realOrderId || sessionId;
  const shortId = useMemo(() => formatOrderId(displayId, "short"), [displayId]);

  const t = useMemo(() => {
    const en = loc === "en";

    return {
      brand: "Dromocob",
      brandSub: en ? "Premium order experience" : "Premium sipariş deneyimi",
      badgeChecking: en ? "Payment result is being checked" : "Ödeme sonucu kontrol ediliyor",
      badgePaid: en ? "Payment received" : "Ödeme alındı",
      badgeOrder: en ? "Order created successfully" : "Sipariş başarıyla oluşturuldu",
      badgeFailed: en ? "Payment failed" : "Ödeme başarısız",
      titleChecking: en ? "We are checking your payment result." : "Ödeme sonucunu kontrol ediyoruz.",
      titlePaid: en ? "Payment received, order is being prepared." : "Ödeme alındı, siparişin hazırlanıyor.",
      titleOrder: en ? "Thank you, your order is confirmed." : "Teşekkürler, siparişin bizde. ✨",
      titleFailed: en ? "Payment could not be completed." : "Ödeme tamamlanamadı.",
      textChecking: en
        ? "The payment callback may take a few seconds. We are also checking your order records automatically."
        : "Ödeme bildirimi birkaç saniye sürebilir. Sistem aynı anda sipariş kayıtlarını da otomatik kontrol ediyor.",
      textPaid: en
        ? "Payment is confirmed. Your order record is being finalized."
        : "Ödeme onaylandı. Sipariş kaydı son hale getiriliyor.",
      textOrder: en
        ? "Your order has been created successfully. You can follow all updates from your order detail page."
        : "Siparişin başarıyla oluşturuldu. Tüm gelişmeleri sipariş detay ekranından takip edebilirsin.",
      textFailed: en
        ? "The payment seems unsuccessful. Please try again or contact support."
        : "Ödeme başarısız görünüyor. Tekrar deneyebilir veya destek alabilirsin.",
      orderNo: en ? "Order Number" : "Sipariş Numarası",
      sessionNo: en ? "Payment Session" : "Ödeme Oturumu",
      copy: en ? "Copy" : "Kopyala",
      copied: en ? "Copied ✓" : "Kopyalandı ✓",
      detail: en ? "Order Detail" : "Sipariş Detayı",
      orders: en ? "My Orders" : "Siparişlerim",
      shop: en ? "Continue Shopping" : "Alışverişe Devam Et",
      home: en ? "Home" : "Anasayfa",
      status: en ? "Order Status" : "Sipariş Durumu",
      support: en ? "Fast Support" : "Hızlı Destek",
      secure: en ? "Secure Record" : "Güvenli Kayıt",
      statusChecking: en ? "Order record is being checked." : "Sipariş kaydı kontrol ediliyor.",
      statusFound: en ? "Order record has been created." : "Sipariş kaydı oluşturuldu.",
      supportText: en ? "Contact us directly if there is an issue." : "Bir sorun olursa bize direkt ulaş.",
      secureText: en
        ? "Your payment and order data are processed securely."
        : "Ödeme ve sipariş bilgilerin güvenli şekilde işlenir.",
      next: en ? "Next step" : "Sonraki adım",
      sideTitle: en ? "You are not left alone after payment" : "Müşteriyi boş bırakmayalım",
      sideText: en
        ? "You can review your order, track updates, or continue discovering new pieces."
        : "Sipariş detayını inceleyebilir, gelişmeleri takip edebilir veya yeni ürünlere göz atabilirsin.",
      side1: en ? "Review order detail" : "Sipariş detayını incele",
      side2: en ? "Check new products" : "Yeni ürünlere göz at",
      side3: en ? "Add products to favorites" : "Favorilerine ürün ekle",
      side4: en ? "Update address/profile info" : "Adres / profil bilgilerini güncelle",
      help: en ? "Need support?" : "Destek lazım mı?",
      helpText: en
        ? "Use our support channels for order confirmation or process updates."
        : "Sipariş teyidi veya süreç bilgisi için destek kanallarını kullanabilirsin.",
      contact: en ? "Contact" : "İletişim",
      picked: en ? "Selected for you" : "Senin için seçtik",
      pickedTitle: en ? "Want to keep shopping?" : "Alışverişe devam etmek ister misin?",
      pickedText: en
        ? "A calm return point after checkout improves the shopping experience."
        : "Sipariş sonrası müşteriye sakin ve güvenli bir dönüş alanı sunuyoruz.",
      allProducts: en ? "See all products →" : "Tüm ürünleri gör →",
      toast: en ? "Number copied" : "Numara kopyalandı",
      step1: en ? "Payment result received" : "Ödeme sonucu alındı",
      step1Text: en ? "The provider sends the payment result." : "Ödeme sağlayıcısı sonucu sisteme bildirir.",
      step2: en ? "Order record" : "Sipariş kaydı",
      step2Text: en ? "The order is created after payment confirmation." : "Ödeme onaylanınca sipariş kaydı oluşturulur.",
      step3: en ? "Delivery process" : "Teslimat süreci",
      step3Text: en ? "You can track status updates from your account." : "Durum güncellemelerini hesabından görebilirsin.",
    };
  }, [loc]);

  const badgeText =
    phase === "order-found"
      ? t.badgeOrder
      : phase === "paid"
        ? t.badgePaid
        : phase === "failed"
          ? t.badgeFailed
          : t.badgeChecking;

  const titleText =
    phase === "order-found"
      ? t.titleOrder
      : phase === "paid"
        ? t.titlePaid
        : phase === "failed"
          ? t.titleFailed
          : t.titleChecking;

  const subText =
    phase === "order-found"
      ? t.textOrder
      : phase === "paid"
        ? t.textPaid
        : phase === "failed"
          ? t.textFailed
          : t.textChecking;

  const detailHref = realOrderId
    ? `/account/orders/${encodeURIComponent(realOrderId)}`
    : "/account/orders";

  async function copyId() {
    try {
      await navigator.clipboard.writeText(displayId);
      setCopied(true);
    } catch {
      setCopied(false);
    } finally {
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

 const findOrderOnce = useCallback(
  async (currentUid: string, sid: string) => {
    if (!currentUid || !sid) return null;

    const qy = query(
      collection(db, "orders"),
      where("uid", "==", currentUid),
      where("payment.ref", "==", sid),
      limit(1)
    );

    const snap = await getDocs(qy);

    if (!snap.empty) {
      const d = snap.docs[0];
      return {
        id: d.id,
        data: d.data() as OrderDoc,
      };
    }

    const qy2 = query(
      collection(db, "orders"),
      where("uid", "==", currentUid),
      where("meta.paymentSessionId", "==", sid),
      limit(1)
    );

    const snap2 = await getDocs(qy2);

    if (!snap2.empty) {
      const d = snap2.docs[0];
      return {
        id: d.id,
        data: d.data() as OrderDoc,
      };
    }

    return null;
  },
  [db]
);

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      setLoc((((e as any)?.detail as Locale) || "tr") as Locale);
    };

    window.addEventListener("locale-changed", handler as any);
    return () => window.removeEventListener("locale-changed", handler as any);
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });

    return () => unsub();
  }, [auth]);

  useEffect(() => {
    const timer = window.setTimeout(() => setFx(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return onWhatsAppNumberChange(setWaNumber);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setPhase("waiting");
      setMessage(loc === "en" ? "Payment session not found." : "Ödeme oturumu bulunamadı.");
      return;
    }

    const ref = doc(db, "payment_sessions", sessionId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setMessage(
            loc === "en"
              ? "Payment session is not visible yet. Checking order records..."
              : "Ödeme oturumu henüz görünmüyor. Sipariş kayıtları kontrol ediliyor..."
          );
          return;
        }

        const data = snap.data() as PaymentSessionDoc;
        setSession(data);

        const ps = safeStr(data.paymentStatus);
        const oid = safeStr(data.orderId);

        if (ps === "failed") {
          setPhase("failed");
          setMessage(loc === "en" ? "Payment failed." : "Ödeme başarısız.");
          return;
        }

        if (ps === "paid" && oid) {
          setPhase("order-found");
          setRealOrderId(oid);
          setMessage(loc === "en" ? "Order created." : "Sipariş oluşturuldu.");
          return;
        }

        if (ps === "paid") {
          setPhase("paid");
          setMessage(
            loc === "en"
              ? "Payment received, order is being created."
              : "Ödeme alındı, sipariş kaydı oluşturuluyor."
          );
          return;
        }

        setPhase("checking");
        setMessage(
          loc === "en"
            ? "Waiting for payment result."
            : "Ödeme sonucu bekleniyor."
        );
      },
      (e) => {
        console.warn("[checkout/success] payment session read skipped:", e);
        setMessage(
          loc === "en"
            ? "Payment session could not be read. Checking order records..."
            : "Ödeme oturumu okunamadı. Sipariş kayıtları kontrol ediliyor..."
        );
      }
    );

    return () => unsub();
  }, [db, sessionId, loc]);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) return;
    if (!sessionId) return;
    if (realOrderId) return;

    let cancelled = false;

    async function run() {
      try {
        const found = await findOrderOnce(uid, sessionId);

        if (cancelled) return;

        if (found?.id) {
          setOrder(found.data);
          setRealOrderId(found.id);
          setPhase("order-found");
          setMessage(loc === "en" ? "Order record found." : "Sipariş kaydı bulundu.");
          return;
        }

        setPhase((prev) => (prev === "paid" ? "paid" : "checking"));
        setMessage(
          loc === "en"
            ? "Order is not visible yet. We keep checking automatically."
            : "Sipariş henüz görünmüyor. Otomatik kontrol devam ediyor."
        );
      } catch (e) {
        console.error("[checkout/success] order fallback failed:", e);
        setMessage(
          loc === "en"
            ? "Order result could not be read yet. Please check My Orders shortly."
            : "Ödeme sonucu henüz okunamadı. Biraz sonra Siparişlerim sayfasını kontrol et."
        );
      }
    }

    run();

    pollingRef.current = window.setInterval(run, 2500);

    const stopTimer = window.setTimeout(() => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 60000);

    return () => {
      cancelled = true;
      window.clearTimeout(stopTimer);

      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
}, [authReady, uid, sessionId, realOrderId, loc, findOrderOnce]);
  useEffect(() => {
    if (!authReady) return;
    if (!uid) return;
    if (!realOrderId) return;

    if (!cleanedRef.current) {
      cleanedRef.current = true;

      const sessionItems = Array.isArray(session?.items) ? session.items : [];
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      const pendingItems = getPendingItemsFromStorage();

      // Meta Pixel: Purchase event
      const purchaseItems = sessionItems.length ? sessionItems : orderItems.length ? orderItems : pendingItems;
      const contentIds = purchaseItems.map((it: any) => String(it?.productId || it?.slug || "")).filter(Boolean);
      const contents = purchaseItems.map((it: any) => ({
        id: String(it?.productId || it?.slug || ""),
        quantity: Number(it?.qty || 1),
      }));
      // Sipariş toplam tutarı: session.amountTry öncelikli, yoksa order.total fallback
      const orderTotalRaw = order?.total;
      const orderTotalNum = typeof orderTotalRaw === "object" ? Number((orderTotalRaw as any)?.amount || 0) : Number(orderTotalRaw || 0);
      const purchaseValue = Number(session?.amountTry || 0) || orderTotalNum;

      // Discount & shipping from order doc
      const orderDiscountRaw = order?.discount;
      const orderDiscount = typeof orderDiscountRaw === "object" ? Number((orderDiscountRaw as any)?.amount || 0) : Number(orderDiscountRaw || 0);
      const orderShippingRaw = order?.shippingFee;
      const orderShipping = typeof orderShippingRaw === "object" ? Number((orderShippingRaw as any)?.amount || 0) : Number(orderShippingRaw || 0);
      const orderCouponCode = String(order?.coupon?.code || "").trim();

      if (contentIds.length > 0 && purchaseValue > 0) {
        trackMetaPurchase({
          value: purchaseValue,
          currency: "TRY",
          content_ids: contentIds,
          contents,
          num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
        });

        // Internal analytics: satın alma kaydı
        trackPurchase(purchaseValue);
      }

      // GA4: purchase event (dataLayer → GTM → GA4)
      // sessionStorage ile aynı orderId için duplicate engellenir
      const ga4PurchaseKey = `nci_ga4_purchase_sent_${realOrderId}`;
      try {
        if (purchaseValue > 0 && !sessionStorage.getItem(ga4PurchaseKey)) {
          sessionStorage.setItem(ga4PurchaseKey, "1");

          const dl = ((window as any).dataLayer = (window as any).dataLayer || []);
          dl.push({ ecommerce: null });
          dl.push({
            event: "purchase",
            ecommerce: {
              transaction_id: realOrderId,
              currency: "TRY",
              value: purchaseValue,
              tax: 0,
              shipping: orderShipping,
              ...(orderCouponCode ? { coupon: orderCouponCode } : {}),
              items: purchaseItems.map((it: any) => {
                const unitRaw = it?.unitPrice;
                const unitNum = typeof unitRaw === "object" ? Number((unitRaw as any)?.amount || 0) : Number(unitRaw || 0);
                const titleStr = typeof it?.title === "object" ? String(it.title?.tr || it.title?.en || "") : String(it?.title || it?.name || "");
                return {
                  item_id: String(it?.productId || it?.slug || ""),
                  item_name: titleStr,
                  item_brand: "Dromocob",
                  price: Number(it?.priceTry || unitNum || 0),
                  quantity: Number(it?.qty || 1),
                };
              }),
            },
          });
        }
      } catch {
        // GA4 event hatası UX'i etkilememeli
      }

      cleanCartByItems(uid, sessionItems.length ? sessionItems : orderItems.length ? orderItems : pendingItems);

      // Tam temizlik: Firestore cart + localStorage + drawer state
      clearCartEverywhere(uid).catch((e) =>
        console.error("[checkout/success] clearCartEverywhere error:", e)
      );

      // Ek temizlik
      try {
        localStorage.removeItem("nci_product_custom_text_v1");
        localStorage.removeItem("nci_gift_package_note_v1");
        localStorage.removeItem("nci_selected_services_v1");
      } catch {
        //
      }
    }

    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const timer = window.setTimeout(() => {
      router.replace(`/account/orders/${encodeURIComponent(realOrderId)}`);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [authReady, uid, realOrderId, session, order, router]);

  return (
    <main className={s.page}>
      <div className={s.shell}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.brandRow}>
              <div className={s.brandMark}>6</div>
              <div>
                <div className={s.brandName}>{t.brand}</div>
                <div className={s.brandSub}>{t.brandSub}</div>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.glow} aria-hidden="true" />

              <div className={`${s.confetti} ${fx ? s.confettiOn : ""}`} aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>

              <div className={s.successIconWrap}>
                <div
                  className={`${s.successIcon} ${
                    phase === "failed" ? s.successIconBad : ""
                  }`}
                >
                  {phase === "failed" ? "!" : realOrderId ? "✓" : "…"}
                </div>
              </div>

              <div className={s.badge}>
                <span className={s.badgeDot} />
                {badgeText}
              </div>

              <h1 className={s.h1}>{titleText}</h1>
              <p className={s.sub}>{subText}</p>

              <div
                className={`${s.messageBox} ${
                  phase === "failed" ? s.messageBad : realOrderId ? s.messageOk : ""
                }`}
              >
                {message}
              </div>

              <div className={s.idBox}>
                <div className={s.idMeta}>
                  <div className={s.idLabel}>{realOrderId ? t.orderNo : t.sessionNo}</div>
                  <div className={s.idValue} title={displayId}>
                    {shortId || "—"}
                  </div>
                  <div className={s.idHint}>
                    {realOrderId
                      ? loc === "en"
                        ? "You will be redirected to the order detail page."
                        : "Birazdan sipariş detay sayfasına yönlendirileceksin."
                      : loc === "en"
                        ? "The order number will appear automatically when created."
                        : "Sipariş numarası oluşturulunca otomatik görünecek."}
                  </div>
                </div>

                <button type="button" className={s.copyBtn} onClick={copyId}>
                  {copied ? t.copied : t.copy}
                </button>
              </div>

              <div className={s.quickGrid}>
                <div className={s.quickCard}>
                  <div className={s.quickTitle}>{t.status}</div>
                  <div className={s.quickText}>
                    {realOrderId ? getOrderStatusText(order, loc) : t.statusChecking}
                  </div>
                </div>

                <div className={s.quickCard}>
                  <div className={s.quickTitle}>{t.support}</div>
                  <div className={s.quickText}>{t.supportText}</div>
                </div>

                <div className={s.quickCard}>
                  <div className={s.quickTitle}>{t.secure}</div>
                  <div className={s.quickText}>{t.secureText}</div>
                </div>
              </div>

              <div className={s.actions}>
                <Link className={s.btnGhost} href={detailHref}>
                  {t.detail}
                </Link>

                <Link className={s.btnPrimary} href="/account/orders">
                  {t.orders} →
                </Link>

                <Link className={s.btnSoft} href="/shop">
                  {t.shop}
                </Link>
              </div>

              <div className={s.steps}>
                <div className={s.step}>
                  <div className={s.stepNo}>01</div>
                  <div>
                    <div className={s.stepTitle}>{t.step1}</div>
                    <div className={s.stepText}>{t.step1Text}</div>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNo}>02</div>
                  <div>
                    <div className={s.stepTitle}>{t.step2}</div>
                    <div className={s.stepText}>{t.step2Text}</div>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNo}>03</div>
                  <div>
                    <div className={s.stepTitle}>{t.step3}</div>
                    <div className={s.stepText}>{t.step3Text}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.bottomLinks}>
              <Link href="/" className={s.miniLink}>
                {t.home}
              </Link>
              <span className={s.sep}>•</span>
              <Link href="/account/orders" className={s.miniLink}>
                {t.orders}
              </Link>
              <span className={s.sep}>•</span>
              <Link href="/shop" className={s.miniLink}>
                {t.shop}
              </Link>
            </div>
          </div>

          <aside className={s.heroRight}>
            <div className={s.sideCard}>
              <div className={s.sideKicker}>{t.next}</div>
              <h2 className={s.sideTitle}>{t.sideTitle}</h2>
              <p className={s.sideText}>{t.sideText}</p>

              <div className={s.sideList}>
                <div className={s.sideListItem}>• {t.side1}</div>
                <div className={s.sideListItem}>• {t.side2}</div>
                <div className={s.sideListItem}>• {t.side3}</div>
                <div className={s.sideListItem}>• {t.side4}</div>
              </div>

              <div className={s.supportBox}>
                <div className={s.supportTitle}>{t.help}</div>
                <div className={s.supportText}>{t.helpText}</div>

                <div className={s.supportActions}>
                  <a
                    className={s.supportBtn}
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>

                  <Link className={s.supportBtnGhost} href="/iletisim">
                    {t.contact}
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className={s.recommendSection}>
          <div className={s.sectionHead}>
            <div>
              <div className={s.sectionKicker}>{t.picked}</div>
              <h2 className={s.sectionTitle}>{t.pickedTitle}</h2>
              <p className={s.sectionSub}>{t.pickedText}</p>
            </div>

            <Link href="/shop" className={s.sectionLink}>
              {t.allProducts}
            </Link>
          </div>

          <div className={s.recGrid}>
            {[
              {
                title: loc === "en" ? "Gold Rings" : "özel tasarımler",
                text: loc === "en" ? "Elegant daily pieces" : "Zarif günlük parçalar",
                href: "/shop",
              },
              {
                title: loc === "en" ? "Necklaces" : "Kolyeler",
                text: loc === "en" ? "Modern premium styles" : "Modern premium stiller",
                href: "/shop",
              },
              {
                title: loc === "en" ? "Bracelets" : "Bileklikler",
                text: loc === "en" ? "Timeless choices" : "Zamansız seçimler",
                href: "/shop",
              },
            ].map((item) => (
              <Link key={item.title} href={item.href} className={s.recCard}>
                <div className={s.recImageWrap}>
                  <div className={s.recMark}>6</div>
                </div>

                <div className={s.recBody}>
                  <div className={s.recTitle}>{item.title}</div>
                  <div className={s.recPrice}>{item.text}</div>
                  <div className={s.recCta}>{loc === "en" ? "Explore →" : "İncele →"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={s.infoBand}>
          <div className={s.infoItem}>
            <span className={s.infoIcon}>🔒</span>
            <div>
              <div className={s.infoTitle}>{t.secure}</div>
              <div className={s.infoText}>{t.secureText}</div>
            </div>
          </div>

          <div className={s.infoItem}>
            <span className={s.infoIcon}>🚚</span>
            <div>
              <div className={s.infoTitle}>{t.step3}</div>
              <div className={s.infoText}>{t.step3Text}</div>
            </div>
          </div>

          <div className={s.infoItem}>
            <span className={s.infoIcon}>💬</span>
            <div>
              <div className={s.infoTitle}>{t.support}</div>
              <div className={s.infoText}>{t.supportText}</div>
            </div>
          </div>
        </section>
      </div>

      <div className={`${s.toast} ${copied ? s.toastOn : ""}`} role="status" aria-live="polite">
        {t.toast}
      </div>
    </main>
  );
}