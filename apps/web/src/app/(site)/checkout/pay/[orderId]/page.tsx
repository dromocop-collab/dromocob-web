"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import s from "../pay.module.css";

type PaymentMethod = "card" | "eft";

type OrderDoc = {
  id?: string;
  uid?: string;
  status?: string;
  totalTry?: number;
  currency?: string;
  items?: Array<{ title?: any; qty?: number }>;
  createdAtIso?: string;
  createdAt?: any;
  payment?: {
    method?: PaymentMethod;
    provider?: string;
    lastError?: string;
    ref?: string;
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
};

function fmtTRY(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(x);
}
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
export default function CheckoutPayPage({ params }: { params: { orderId: string } }) {
  const orderId = decodeURIComponent(params.orderId);
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [loc, setLoc] = useState<"tr" | "en">("tr");
  const [user, setUser] = useState<User | null>(null);

  const isRealUser = !!user && !user.isAnonymous;
  const uid = isRealUser ? user.uid : null;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiedKey, setCopiedKey] = useState<"" | "iban" | "ref">("");

  useEffect(() => {
    const raw = (typeof window !== "undefined" && localStorage.getItem("nci_locale")) || "tr";
    setLoc(raw === "en" ? "en" : "tr");
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    setLoading(true);
    setErr("");

    const ref = doc(db, "orders", orderId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOrder(null);
          setLoading(false);
          return;
        }
        const d = snap.data() as any;
        setOrder({ id: snap.id, ...d });
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || "Sipariş okunamadı.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, orderId]);

  const t = useMemo(() => {
    const en = loc === "en";
    return {
      title: en ? "Payment" : "Ödeme",
      subtitle: en ? "Choose a payment method and complete securely." : "Ödeme yöntemini seç ve güvenle tamamla.",
      back: en ? "Back to order" : "Siparişe dön",
      order: en ? "Order" : "Sipariş",
      amount: en ? "Amount" : "Tutar",
      method: en ? "Payment method" : "Ödeme yöntemi",
      card: en ? "Credit / Debit Card" : "Kredi / Banka Kartı",
      eft: en ? "Bank Transfer" : "Havale / EFT",
      startCard: en ? "Pay securely by card" : "Kartla güvenli öde",
      secure: en ? "Secure redirect" : "Güvenli yönlendirme",
      bankTitle: en ? "Bank transfer details" : "Havale / EFT bilgileri",
      bankNote: en
        ? "Use your order number as the transfer reference."
        : "Açıklama / referans kısmına sipariş numaranı yaz.",
      copy: en ? "Copy" : "Kopyala",
      copied: en ? "Copied" : "Kopyalandı",
      loginReq: en ? "Please login to continue payment." : "Ödeme için giriş yapman gerekiyor.",
      notFound: en ? "Order not found." : "Sipariş bulunamadı.",
      notYours: en ? "This order does not belong to you." : "Bu sipariş sana ait değil.",
      paid: en ? "Paid" : "Ödendi",
      pending: en ? "Pending payment" : "Ödeme bekliyor",
      cancelled: en ? "Cancelled" : "İptal",
      draft: en ? "Draft" : "Taslak",
      cardHint: en
        ? "Card details are entered on the payment provider page."
        : "Kart bilgileri ödeme sağlayıcısının güvenli sayfasında girilir.",
      eftHint: en
        ? "Your order is confirmed after the transfer is verified."
        : "Transfer doğrulandıktan sonra siparişin onaylanır.",
      summary: en ? "Summary" : "Özet",
      tracking: en ? "Order tracking" : "Sipariş takibi",
      shop: en ? "Shop" : "Mağaza",
    };
  }, [loc]);

  const statusLabel = useMemo(() => {
    const st = String(order?.status || "pending_payment");
    if (st === "paid") return t.paid;
    if (st === "cancelled") return t.cancelled;
    if (st === "draft") return t.draft;
    return t.pending;
  }, [order?.status, t]);

  const statusTone = useMemo(() => {
    const st = String(order?.status || "pending_payment");
    if (st === "paid") return "ok";
    if (st === "cancelled") return "bad";
    return "warn";
  }, [order?.status]);

  const gateError = useMemo(() => {
    
    if (!order && !loading) return t.notFound;
    if (!uid) return t.loginReq;
    if (order?.uid && order.uid !== uid) return t.notYours;
    return "";
  }, [order, loading, uid, t]);

  async function startCardPayment() {
    if (!uid) return setErr(t.loginReq);
    if (!order?.id) return setErr(t.notFound);
    if (order?.uid && order.uid !== uid) return setErr(t.notYours);
    if (String(order?.status) === "paid") return;

    setBusy(true);
    setErr("");

    try {
      const res = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, method: "card" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ödeme başlatılamadı.");

      const url = String(data?.redirectUrl || "");
      if (!url) throw new Error("redirectUrl yok.");

      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message || "Ödeme başlatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  function copyText(key: "iban" | "ref", value: string) {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1400);
  }

  const bank = useMemo(() => {
    return {
      company: "Dromocob",
      iban: "TR00 0000 0000 0000 0000 0000 00",
      bankName: "Banka Adı",
      branch: "Şube",
      account: "Hesap No",
      ref: `SIP-${orderId}`,
    };
  }, [orderId]);

const itemCount = Array.isArray(order?.items) ? order?.items.length : 0;

const invoiceType =
  order?.shippingAddress?.invoiceType === "company" ? "company" : "individual";

const nationalId = safeStr(order?.shippingAddress?.nationalId);
const companyName = safeStr(order?.shippingAddress?.companyName);
const taxNumber = safeStr(order?.shippingAddress?.taxNumber);
const taxOffice = safeStr(order?.shippingAddress?.taxOffice);

return (
    <main className={s.page}>
      <div className={s.wrap}>
        <section className={s.hero}>
          <div className={s.heroLeft}>
            <div className={s.kicker}>CHECKOUT</div>
            <h1 className={s.h1}>{t.title}</h1>
            <div className={s.sub}>{t.subtitle}</div>

            <div className={s.heroBadges}>
              <span className={s.heroBadge}>{t.secure}</span>
              <span className={s.heroBadge}>SSL</span>
              <span className={s.heroBadge}>3D Secure</span>
            </div>
          </div>

          <div className={s.heroRight}>
            <Link className={s.backBtn} href={`/account/orders/${encodeURIComponent(orderId)}`}>
              ← {t.back}
            </Link>
          </div>
        </section>

        {loading ? (
          <div className={s.card}>Yükleniyor…</div>
        ) : gateError ? (
          <div className={s.card}>
            <div className={s.alertBad}>{gateError}</div>
            <div className={s.actionsRow}>
              <Link className={s.btnGhost} href="/login">Giriş Yap</Link>
              <Link className={s.btnPrimary} href="/shop">{t.shop}</Link>
            </div>
          </div>
        ) : (
          <div className={s.grid}>
            <section className={s.left}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div className={s.cardTitle}>{t.order}</div>
                  <div className={`${s.pill} ${statusTone === "ok" ? s.pillOk : statusTone === "bad" ? s.pillBad : s.pillWarn}`}>
                    {statusLabel}
                  </div>
                </div>

                <div className={s.orderMeta}>
                  <div className={s.metaBox}>
                    <span>ID</span>
                    <b className={s.mono}>{orderId}</b>
                  </div>
                  <div className={s.metaBox}>
                    <span>{t.amount}</span>
                    <b className={s.total}>{fmtTRY(order?.totalTry)}</b>
                  </div>
                  <div className={s.metaBox}>
                    <span>{loc === "en" ? "Items" : "Ürünler"}</span>
                    <b>{itemCount}</b>
                  </div>
                </div>

                <div className={s.hr} />

                <div className={s.methodTitle}>{t.method}</div>
                <div className={s.methodGrid}>
                  <button
                    type="button"
                    className={`${s.methodCard} ${method === "card" ? s.methodOn : ""}`}
                    onClick={() => setMethod("card")}
                  >
                    <div className={s.methodName}>{t.card}</div>
                    <div className={s.methodDesc}>{t.cardHint}</div>
                  </button>

                  <button
                    type="button"
                    className={`${s.methodCard} ${method === "eft" ? s.methodOn : ""}`}
                    onClick={() => setMethod("eft")}
                  >
                    <div className={s.methodName}>{t.eft}</div>
                    <div className={s.methodDesc}>{t.eftHint}</div>
                  </button>
                </div>

                {err ? <div className={s.alertBad}>{err}</div> : null}
              </div>

              {method === "card" ? (
                <div className={s.card}>
                  <div className={s.bigTitle}>{loc === "en" ? "Card payment" : "Kart ile ödeme"}</div>
                  <div className={s.text}>
                    {loc === "en"
                      ? "You will be redirected to the payment provider’s secure page. Card data never reaches our server."
                      : "Ödeme sağlayıcısının güvenli sayfasına yönlendirilirsin. Kart verisi bizim sunucumuza gelmez."}
                  </div>

                  <button
                    type="button"
                    className={s.payBtn}
                    id="fb-pay-card-btn"
                    data-fb="Purchase"
                    onClick={startCardPayment}
                    disabled={busy || String(order?.status) === "paid"}
                  >
                    {busy ? (loc === "en" ? "Redirecting…" : "Yönlendiriliyor…") : t.startCard}
                  </button>

                  <div className={s.miniNote}>
                    {loc === "en"
                      ? "Security: HTTPS • Tokenized flow • Provider redirect • Double-charge protection"
                      : "Güvenlik: HTTPS • Tokenized akış • Provider yönlendirmesi • Çift çekim koruması"}
                  </div>
                </div>
              ) : (
                <div className={s.card}>
                  <div className={s.bigTitle}>{t.bankTitle}</div>
                  <div className={s.text}>{t.bankNote}</div>

                  <div className={s.bankBox}>
                    <div className={s.bankRow}>
                      <span>Alıcı</span>
                      <b>{bank.company}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>Banka</span>
                      <b>{bank.bankName}</b>
                    </div>

                    <div className={s.bankRow}>
                      <span>IBAN</span>
                      <b className={s.mono}>{bank.iban}</b>
                      <button className={s.copyBtn} type="button" onClick={() => copyText("iban", bank.iban)}>
                        {copiedKey === "iban" ? t.copied : t.copy}
                      </button>
                    </div>

                    <div className={s.bankRow}>
                      <span>Referans</span>
                      <b className={s.mono}>{bank.ref}</b>
                      <button className={s.copyBtn} type="button" onClick={() => copyText("ref", bank.ref)}>
                        {copiedKey === "ref" ? t.copied : t.copy}
                      </button>
                    </div>
                  </div>

                  <div className={s.miniNote}>
                    {loc === "en"
                      ? "After transfer verification, your order will be marked as paid."
                      : "Transfer doğrulandıktan sonra siparişin ödendi durumuna alınır."}
                  </div>
                </div>
              )}
            </section>

            <aside className={s.right}>
              <div className={`${s.card} ${s.sticky}`}>
                <div className={s.cardTitle}>{t.summary}</div>

                <div className={s.summaryLine}>
                  <span>{t.amount}</span>
                  <b className={s.total}>{fmtTRY(order?.totalTry)}</b>
                </div>

                <div className={s.hr} />

                <div className={s.miniText}>
                  {loc === "en" ? "Receiver" : "Alıcı"}: <b>{order?.shippingAddress?.fullName || "—"}</b>
                </div>

                <div className={s.miniText}>
                  {loc === "en" ? "Region" : "Bölge"}:{" "}
                  <b>{order?.shippingAddress?.city || "—"} / {order?.shippingAddress?.district || "—"}</b>
                </div>

                <div className={s.miniText}>
                  {loc === "en" ? "Phone" : "Telefon"}: <b>{order?.shippingAddress?.phone || "—"}</b>
                </div>
<div className={s.miniText}>
  {loc === "en" ? "Invoice type" : "Fatura Tipi"}:{" "}
  <b>{invoiceType === "company" ? "Kurumsal" : "Bireysel"}</b>
</div>

{invoiceType === "individual" ? (
  <div className={s.miniText}>
    {loc === "en" ? "National ID" : "TC Kimlik No"}: <b>{nationalId || "—"}</b>
  </div>
) : (
  <>
    <div className={s.miniText}>
      {loc === "en" ? "Company" : "Firma Adı"}: <b>{companyName || "—"}</b>
    </div>

    <div className={s.miniText}>
      {loc === "en" ? "Tax Number" : "Vergi Numarası"}: <b>{taxNumber || "—"}</b>
    </div>

    <div className={s.miniText}>
      {loc === "en" ? "Tax Office" : "Vergi Dairesi"}: <b>{taxOffice || "—"}</b>
    </div>
  </>
)}
                <div className={s.hr} />

                <div className={s.secBox}>
                  <div className={s.secTitle}>{loc === "en" ? "Security" : "Güvenlik"}</div>
                  <ul className={s.secList}>
                    <li>{loc === "en" ? "Card data is not stored" : "Kart verisi saklanmaz"}</li>
                    <li>{loc === "en" ? "Provider redirect flow" : "Provider yönlendirmesi"}</li>
                    <li>{loc === "en" ? "Double-charge protection" : "Çift çekim koruması"}</li>
                    <li>{loc === "en" ? "Order / UID validation" : "Order / UID doğrulama"}</li>
                  </ul>
                </div>

                <div className={s.actionsRow}>
                  <Link className={s.btnGhost} href="/shop">{t.shop}</Link>
                  <Link className={s.btnPrimary} href={`/account/orders/${encodeURIComponent(orderId)}`}>
                    {t.tracking}
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}