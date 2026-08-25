"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseAuth, getFirebaseDb, getFirebaseApp } from "@/lib/firebase.client";
import { removeFromCart } from "@/lib/cart";
import s from "./pay.module.css";

type PaymentMethod = "card" | "eft";

type OrderDoc = {
  id?: string;
  uid?: string;
  status?: string; // draft / pending_payment / paid / cancelled
  totalTry?: number;
  currency?: string; // TRY
  items?: Array<{ title?: any; qty?: number }>;
  createdAtIso?: string;
  createdAt?: any;
  payment?: {
    method?: PaymentMethod;
    provider?: string;
    lastError?: string;
  };
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    city?: string;
    district?: string;
    addressLine?: string;
  };
};
function num(v: any, fb = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  }
  
  function calcTotalTryFromOrder(o: any) {
    if (!o) return 0;
  
    // ✅ 1) yeni şema (Money)
    const moneyTotal = num(o?.total?.amount, NaN);
    if (Number.isFinite(moneyTotal) && moneyTotal > 0) return moneyTotal;
  
    // ✅ 2) eski düz alanlar (fallback)
    const a = num(o?.totalTry, NaN);
    const b = num(o?.totalTRY, NaN);
    const direct = Number.isFinite(a) ? a : Number.isFinite(b) ? b : NaN;
    if (Number.isFinite(direct) && direct > 0) return direct;
  
    // ✅ 3) items'tan hesapla (Money)
    const items = Array.isArray(o?.items) ? o.items : [];
    const sum = items.reduce((acc: number, it: any) => {
      const qty = Math.max(1, Math.floor(num(it?.qty, 1)));
      const unit =
        num(it?.unitPrice?.amount, NaN) ??
        num(it?.lineTotal?.amount, NaN); // bazen unit yoksa lineTotal’dan yürür
      if (Number.isFinite(unit)) return acc + unit * qty;
      return acc + num(it?.lineTotal?.amount, 0); // lineTotal direkt varsa
    }, 0);
  
    return num(sum, 0);
  }


function fmtTRY(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(x);
}

export default function CheckoutPayPage({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const orderId = decodeURIComponent(params.orderId);

  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [loc, setLoc] = useState<"tr" | "en">("tr");
  const [user, setUser] = useState<User | null>(null);

  const isRealUser = !!user && !user.isAnonymous;
  const uid = isRealUser ? user.uid : null;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const totalTry = useMemo(() => calcTotalTryFromOrder(order), [order]);
  const orderStatus = String(order?.status || "");
const orderStockApplied = (order as any)?.stockApplied === true;

const orderItems = useMemo(() => {
  return Array.isArray((order as any)?.items) ? (order as any).items : [];
}, [order]);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // locale (senin sistemin varsa burayı ona bağla)
    const raw = (typeof window !== "undefined" && localStorage.getItem("nci_locale")) || "tr";
    setLoc(raw === "en" ? "en" : "tr");
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  // order realtime
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
useEffect(() => {
  // Sipariş ödendiyse ve stok gerçekten işlendi ise sepetten düş.
  if (!uid) return;
  if (!order?.id) return;
  if (orderStatus !== "paid" || !orderStockApplied) return;

  try {
    for (const it of orderItems) {
      const pid = String(it?.productId || it?.id || "").trim();

      if (pid) {
        removeFromCart(pid, uid);
      }
    }

    window.dispatchEvent(new Event("cart:changed"));
  } catch {
    // ignore
  }
}, [uid, order?.id, orderStatus, orderStockApplied, orderItems]);
  const t = useMemo(() => {
    const en = loc === "en";
    return {
      title: en ? "Payment" : "Ödeme",
      subtitle: en ? "Choose a method and complete securely." : "Yöntem seç ve güvenle tamamla.",
      back: en ? "Back" : "Geri",
      order: en ? "Order" : "Sipariş",
      status: en ? "Status" : "Durum",
      amount: en ? "Amount" : "Tutar",
      method: en ? "Payment method" : "Ödeme yöntemi",
      card: en ? "Credit / Debit Card" : "Kredi / Banka Kartı",
      eft: en ? "EFT / Bank Transfer" : "EFT / Havale",
      secure: en ? "Secure payment" : "Güvenli ödeme",
      startCard: en ? "Pay with card (secure redirect)" : "Kartla öde (güvenli yönlendirme)",
      bankTitle: en ? "Bank transfer information" : "Havale/EFT bilgileri",
      bankNote:
        en
          ? "Use the order number as the transfer reference."
          : "Açıklama/Referans kısmına sipariş numarasını yaz.",
      copy: en ? "Copy" : "Kopyala",
      copied: en ? "Copied" : "Kopyalandı",
      loginReq: en ? "Please login to pay." : "Ödeme için giriş yapman gerekiyor.",
      notFound: en ? "Order not found." : "Sipariş bulunamadı.",
      notYours: en ? "This order does not belong to you." : "Bu sipariş sana ait değil.",
      paid: en ? "Paid" : "Ödendi",
      pending: en ? "Pending payment" : "Ödeme bekliyor",
      cancelled: en ? "Cancelled" : "İptal",
      draft: en ? "Draft" : "Taslak",
      cardHint:
        en
          ? "Card details are entered on the payment provider page (PCI compliant)."
          : "Kart bilgileri ödeme sağlayıcısının sayfasında girilir (PCI uyumlu).",
      eftHint:
        en
          ? "After transfer, your order will be confirmed once payment is verified."
          : "Havale sonrası ödeme doğrulamasıyla siparişin onaylanır.",
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

  // auth + ownership gate
  const gateError = useMemo(() => {
    if (!order && !loading) return t.notFound;
    if (!uid) return t.loginReq;
    if (order?.uid && order.uid !== uid) return t.notYours;
    return "";
  }, [order, loading, uid, t]);
  
async function confirmEftPayment() {
    if (!order?.id) return;
  
    setBusy(true);
    setErr("");
  
    try {
      const fn = httpsCallable(getFunctions(getFirebaseApp(), "europe-west1"), "confirmOrderPaymentV1");
     await fn({ orderId: order.id, paymentRef: `EFT-${order.id}` });
  
      // success
      router.push(`/checkout/success/${encodeURIComponent(order.id)}`);
    } catch (e: any) {
      setErr(e?.message || "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }
async function startCardPayment() {
  if (!uid) {
    setErr(t.loginReq);
    return;
  }

  if (!order?.id) {
    setErr(t.notFound);
    return;
  }

  if (order?.uid && order.uid !== uid) {
    setErr(t.notYours);
    return;
  }

  if (String(order?.status) === "paid") {
    return;
  }

  setBusy(true);
  setErr("");

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("unauthorized");
    }

    const idToken = await currentUser.getIdToken(true);

    const res = await fetch("/api/payments/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orderId: order.id,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "Ödeme başlatılamadı.");
    }

    const redirectUrl = String(data?.redirectUrl || "").trim();
    if (!redirectUrl) {
      throw new Error("redirectUrl yok.");
    }

    window.location.href = redirectUrl;
  } catch (e: any) {
    console.error("startCardPayment error:", e);
    setErr(e?.message || "Ödeme başlatılamadı.");
  } finally {
    setBusy(false);
  }
}

  function copyText(x: string) {
    navigator.clipboard.writeText(x).catch(() => {});
  }

  // bank info (sen bunu Firestore settings/public’dan da çekebilirsin)
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

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <div className={s.top}>
          <div>
            <div className={s.kicker}>Checkout</div>
            <h1 className={s.h1}>{t.title}</h1>
            <div className={s.sub}>{t.subtitle}</div>
          </div>

          <Link className={s.backBtn} href="/checkout">
            ← {t.back}
          </Link>
        </div>

        {loading ? (
          <div className={s.card}>Yükleniyor…</div>
        ) : gateError ? (
          <div className={s.card}>
            <div className={s.alertBad}>{gateError}</div>
            <div className={s.actionsRow}>
              <Link className={s.btnGhost} href="/login">Giriş Yap</Link>
              <Link className={s.btnPrimary} href="/shop">Mağazaya Dön</Link>
            </div>
          </div>
        ) : (
          <div className={s.grid}>
            {/* LEFT */}
            <section className={s.left}>
              <div className={s.card}>
                <div className={s.cardHead}>
                  <div className={s.cardTitle}>{t.order}</div>
                  <div className={`${s.pill} ${statusTone === "ok" ? s.pillOk : statusTone === "bad" ? s.pillBad : s.pillWarn}`}>
                    {statusLabel}
                  </div>
                </div>

                <div className={s.orderMeta}>
                  <div className={s.metaRow}>
                    <span>ID</span>
                    <b className={s.mono}>{orderId}</b>
                  </div>
                  <div className={s.metaRow}>
                    <span>{t.amount}</span>
                    <b className={s.total}>{fmtTRY(totalTry)}</b>
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

                {err ? <div className={s.alertBad} style={{ marginTop: 14 }}>{err}</div> : null}
              </div>
              
              {method === "card" ? (
                <div className={s.card}>
                  <div className={s.bigTitle}>Kart ile Ödeme</div>
                  <div className={s.text}>
                    Kart bilgileri bizim sunucumuza **gelmez**. Ödeme sağlayıcısının güvenli sayfasına yönlendirileceksin.
                  </div>

                  <button
                    type="button"
                    className={s.payBtn}
                    onClick={startCardPayment}
                    disabled={busy || String(order?.status) === "paid"}
                  >
                    {busy ? "Yönlendiriliyor…" : t.startCard}
                  </button>

                  <div className={s.miniNote}>
                    Güvenlik: Tokenized ödeme • PCI uyumlu yönlendirme • HTTPS • Idempotency koruması
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
                      <button className={s.copyBtn} type="button" onClick={() => copyText(bank.iban)}>
                        {t.copy}
                      </button>
                    </div>

                    <div className={s.bankRow}>
                      <span>Referans</span>
                      <b className={s.mono}>{bank.ref}</b>
                      <button className={s.copyBtn} type="button" onClick={() => copyText(bank.ref)}>
                        {t.copy}
                      </button>
                    </div>
                  </div>
                  <button
  type="button"
  className={s.payBtn}
  onClick={confirmEftPayment}
  disabled={busy || String(order?.status) === "paid"}
>
  {busy ? "İşleniyor…" : "Ödemeyi Tamamla"}
</button>
                  <div className={s.miniNote}>
                    Transfer sonrası ödeme kontrol edilince sipariş “Ödendi” olarak güncellenecek.
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT */}
            <aside className={s.right}>
              <div className={`${s.card} ${s.sticky}`}>
                <div className={s.cardTitle}>Özet</div>

                <div className={s.summaryLine}>
                  <span>Tutar</span>
                  <b className={s.total}>{fmtTRY(totalTry)}</b>
                </div>

                <div className={s.hr} />

                <div className={s.miniText}>
                  Teslimat:{" "}
                  <b>
                    {order?.shippingAddress?.city || "—"} / {order?.shippingAddress?.district || "—"}
                  </b>
                </div>

                <div className={s.miniText} style={{ marginTop: 8 }}>
                  Alıcı: <b>{order?.shippingAddress?.fullName || "—"}</b>
                </div>

                <div className={s.hr} />

                <div className={s.secBox}>
                  <div className={s.secTitle}>Güvenlik</div>
                  <ul className={s.secList}>
                    <li>Kart verisi saklanmaz</li>
                    <li>Provider yönlendirmesi (PCI)</li>
                    <li>Idempotency ile çift çekim koruması</li>
                    <li>Order/UID doğrulama</li>
                  </ul>
                </div>

                <div className={s.actionsRow}>
                  <Link className={s.btnGhost} href="/shop">Mağaza</Link>
                  <Link className={s.btnPrimary} href={`/checkout/success/${encodeURIComponent(orderId)}`}>
                    Sipariş Takip
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