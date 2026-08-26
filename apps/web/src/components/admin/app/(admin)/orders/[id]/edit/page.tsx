// apps/web/src/app/admin/(admin)/orders/[id]/edit/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type PaymentMethod = "card" | "transfer" | "cod";
type PaymentProvider = "none" | "manual" | "iyzico" | "kuveyt";

type Money =
  | number
  | {
      amount?: number;
      currency?: string;
    };

type OrderDoc = {
  id?: string;
  uid?: string;
  email?: string;
  status?: OrderStatus;
  paymentStatus?: "pending" | "paid" | "failed" | string;
  stockApplied?: boolean;
  adminNote?: string;
  createdAt?: any;
  createdAtIso?: string;
  updatedAt?: any;
  updatedAtIso?: string;
  subtotal?: Money;
  shippingFee?: Money;
  discount?: Money;
  total?: Money;
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
billing?: {
  invoiceType?: "individual" | "company";
  firstName?: string;
  lastName?: string;
  phone?: string;
  nationalId?: string;
  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
};
  payment?: {
    provider?: PaymentProvider;
    method?: PaymentMethod;
    ref?: string;
    paidAt?: any;
  };
};

type FormState = {
  status: OrderStatus;
  paymentStatus: string;
  provider: PaymentProvider;
  method: PaymentMethod;

  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
  postalCode: string;
  shippingNote: string;

  invoiceType: "individual" | "company";
  nationalId: string;
  companyName: string;
  taxNumber: string;
  taxOffice: string;

  adminNote: string;
};

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "draft", label: "Taslak" },
  { value: "pending_payment", label: "Ödeme Bekliyor" },
  { value: "paid", label: "Ödendi" },
  { value: "preparing", label: "Hazırlanıyor" },
  { value: "shipped", label: "Kargoda" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
  { value: "refunded", label: "İade" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

const PROVIDER_OPTIONS: Array<{ value: PaymentProvider; label: string }> = [
  { value: "none", label: "none" },
  { value: "manual", label: "manual" },
  { value: "iyzico", label: "iyzico" },
  { value: "kuveyt", label: "kuveyt" },
];

const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "card", label: "card" },
  { value: "transfer", label: "transfer" },
  { value: "cod", label: "cod" },
];

function safeStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "undefined" && s !== "null" ? s : "";
}

function moneyAmount(v: Money) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtTRY(v: Money) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(moneyAmount(v));
}

function toDateSafe(v: any, fallbackIso?: string) {
  try {
    if (v?.toDate && typeof v.toDate === "function") {
      const d = v.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (fallbackIso) {
      const d = new Date(fallbackIso);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any, fallbackIso?: string) {
  const d = toDateSafe(v, fallbackIso);
  if (!d) return "—";

  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toFormState(data: OrderDoc): FormState {
  const invoiceType =
    (safeStr(data?.billing?.invoiceType || data?.shippingAddress?.invoiceType) as
      | "individual"
      | "company") || "individual";

  return {
    status: (data?.status as OrderStatus) || "pending_payment",
    paymentStatus: safeStr(data?.paymentStatus) || "pending",
    provider: (safeStr(data?.payment?.provider) as PaymentProvider) || "none",
    method: (safeStr(data?.payment?.method) as PaymentMethod) || "card",

    fullName: safeStr(data?.shippingAddress?.fullName),
    phone: safeStr(data?.shippingAddress?.phone),
    city: safeStr(data?.shippingAddress?.city),
    district: safeStr(data?.shippingAddress?.district),
    addressLine: safeStr(data?.shippingAddress?.addressLine),
    postalCode: safeStr(data?.shippingAddress?.postalCode),
    shippingNote: safeStr(data?.shippingAddress?.note),

    invoiceType,
    nationalId: safeStr(data?.billing?.nationalId || data?.shippingAddress?.nationalId),
    companyName: safeStr(data?.billing?.companyName || data?.shippingAddress?.companyName),
    taxNumber: safeStr(data?.billing?.taxNumber || data?.shippingAddress?.taxNumber),
    taxOffice: safeStr(data?.billing?.taxOffice || data?.shippingAddress?.taxOffice),

    adminNote: safeStr(data?.adminNote),
  };
}
function tone(status: string) {
  if (status === "paid" || status === "delivered") return "#166534";
  if (status === "cancelled" || status === "refunded") return "#991b1b";
  if (status === "preparing" || status === "shipped") return "#1d4ed8";
  return "#92400e";
}

export default function AdminOrderEditPage({
  params,
}: {
  params: { id: string };
}) {
  const db = useMemo(() => getFirebaseDb(), []);
  const id = decodeURIComponent(params.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorText("");
        setSuccessText("");

        if (!id) {
          throw new Error("Sipariş id eksik.");
        }

        const snap = await getDoc(doc(db, "orders", id));
        if (!snap.exists()) {
          throw new Error("Sipariş bulunamadı.");
        }

        const data = { id: snap.id, ...(snap.data() as OrderDoc) };

        if (!alive) return;

        setOrder(data);
        setForm(toFormState(data));
      } catch (err: any) {
        if (!alive) return;
        setErrorText(err?.message || "Sipariş okunamadı.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, id]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form || !id) return;

    if (!form.fullName || !form.phone || !form.city || !form.district || !form.addressLine) {
      setErrorText("Ad, telefon, şehir, ilçe ve adres satırı zorunlu.");
      setSuccessText("");
      return;
    }

    try {
      setSaving(true);
      setErrorText("");
      setSuccessText("");

      await updateDoc(doc(db, "orders", id), {
  status: form.status,
  paymentStatus: form.paymentStatus,
  adminNote: form.adminNote,

  shippingAddress: {
    fullName: form.fullName,
    phone: form.phone,
    city: form.city,
    district: form.district,
    addressLine: form.addressLine,
    postalCode: form.postalCode,
    note: form.shippingNote,

    invoiceType: form.invoiceType,
    nationalId: form.invoiceType === "individual" ? form.nationalId : "",
    companyName: form.invoiceType === "company" ? form.companyName : "",
    taxNumber: form.invoiceType === "company" ? form.taxNumber : "",
    taxOffice: form.invoiceType === "company" ? form.taxOffice : "",
  },

  billing: {
    invoiceType: form.invoiceType,
    firstName: "",
    lastName: "",
    phone: form.phone,
    nationalId: form.invoiceType === "individual" ? form.nationalId : "",
    companyName: form.invoiceType === "company" ? form.companyName : "",
    taxNumber: form.invoiceType === "company" ? form.taxNumber : "",
    taxOffice: form.invoiceType === "company" ? form.taxOffice : "",
  },

  payment: {
    ...(order?.payment || {}),
    provider: form.provider,
    method: form.method,
  },

  updatedAt: serverTimestamp(),
  updatedAtIso: new Date().toISOString(),
});

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: form.status,
              paymentStatus: form.paymentStatus,
              adminNote: form.adminNote,
              shippingAddress: {
                ...(prev.shippingAddress || {}),
                fullName: form.fullName,
                phone: form.phone,
                city: form.city,
                district: form.district,
                addressLine: form.addressLine,
                postalCode: form.postalCode,
                note: form.shippingNote,
              },
              payment: {
                ...(prev.payment || {}),
                provider: form.provider,
                method: form.method,
              },
            }
          : prev
      );

      setSuccessText("Sipariş başarıyla güncellendi.");
    } catch (err) {
      console.error("order edit save error:", err);
      setErrorText("Sipariş güncellenemedi.");
      setSuccessText("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Sipariş Düzenle</h1>
          <p>Yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (errorText && !form) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Sipariş Düzenle</h1>
          <div style={badAlert}>{errorText}</div>
          <Link href="/admin/orders" style={linkBtn}>
            ← Siparişlere dön
          </Link>
        </div>
      </main>
    );
  }

  if (!order || !form) {
    return null;
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <div style={topRow}>
          <div>
            <div style={kickerStyle}>ADMIN • SİPARİŞ DÜZENLE</div>
            <h1 style={titleStyle}>Sipariş Düzenle</h1>
            <div style={subStyle}>
              #{order.id} · {safeStr(order.email) || "mail yok"} ·{" "}
              <span
                style={{
                  color: tone(form.status),
                  fontWeight: 800,
                }}
              >
                {form.status}
              </span>
            </div>
          </div>

          <div style={actionsTop}>
            <Link href={`/admin/orders/${encodeURIComponent(id)}`} style={ghostBtn}>
              Detay
            </Link>
            <Link href="/admin/orders" style={ghostBtn}>
              ← Siparişler
            </Link>
            <button type="button" onClick={handleSave} style={primaryBtn} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        {errorText ? <div style={badAlert}>{errorText}</div> : null}
        {successText ? <div style={okAlert}>{successText}</div> : null}

        <div style={gridStyle}>
          <section style={leftCol}>
            <div style={cardStyle}>
              <h2 style={sectionTitle}>Sipariş Özeti</h2>

              <div style={miniGrid}>
  <div style={miniBox}>
    <span style={miniLabel}>Ara Toplam</span>
    <strong>{fmtTRY(order.subtotal ?? 0)}</strong>
  </div>
  <div style={miniBox}>
    <span style={miniLabel}>Kargo</span>
    <strong>{fmtTRY(order.shippingFee ?? 0)}</strong>
  </div>
  <div style={miniBox}>
    <span style={miniLabel}>İndirim</span>
    <strong>{fmtTRY(order.discount ?? 0)}</strong>
  </div>
  <div style={miniBox}>
    <span style={miniLabel}>Toplam</span>
    <strong>{fmtTRY(order.total ?? 0)}</strong>
  </div>
</div>

              <div style={metaText}>
                Oluşturma: {fmtDate(order.createdAt, order.createdAtIso)}
              </div>
              <div style={metaText}>
                Güncelleme: {fmtDate(order.updatedAt, order.updatedAtIso)}
              </div>
              <div style={metaText}>
                Paid At: {fmtDate(order.payment?.paidAt)}
              </div>
              <div style={metaText}>
                Ref: {safeStr(order.payment?.ref) || "—"}
              </div>
              <div style={metaText}>
                Stock Applied: {order.stockApplied ? "Evet" : "Hayır"}
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitle}>Müşteri ve Adres</h2>
<SelectField
  label="Fatura Tipi"
  value={form.invoiceType}
  onChange={(v) => patch("invoiceType", v as "individual" | "company")}
  options={[
    { value: "individual", label: "Bireysel" },
    { value: "company", label: "Kurumsal" },
  ]}
/>
              <div style={formGrid}>
                <Field
                  label="Ad Soyad"
                  value={form.fullName}
                  onChange={(v) => patch("fullName", v)}
                />
                <Field
                  label="Telefon"
                  value={form.phone}
                  onChange={(v) => patch("phone", v)}
                />
                <Field
                  label="Şehir"
                  value={form.city}
                  onChange={(v) => patch("city", v)}
                />
                <Field
                  label="İlçe"
                  value={form.district}
                  onChange={(v) => patch("district", v)}
                />
                <Field
                  label="Posta Kodu"
                  value={form.postalCode}
                  onChange={(v) => patch("postalCode", v)}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <TextAreaField
                  label="Adres Satırı"
                  value={form.addressLine}
                  onChange={(v) => patch("addressLine", v)}
                  rows={3}
                />
              </div>
{form.invoiceType === "individual" ? (
  <Field
    label="TC Kimlik No"
    value={form.nationalId}
    onChange={(v) => patch("nationalId", v)}
  />
) : (
  <>
    <Field
      label="Firma Adı"
      value={form.companyName}
      onChange={(v) => patch("companyName", v)}
    />
    <Field
      label="Vergi No"
      value={form.taxNumber}
      onChange={(v) => patch("taxNumber", v)}
    />
    <Field
      label="Vergi Dairesi"
      value={form.taxOffice}
      onChange={(v) => patch("taxOffice", v)}
    />
  </>
)}
              <div style={{ marginTop: 14 }}>
                <TextAreaField
                  label="Müşteri Notu"
                  value={form.shippingNote}
                  onChange={(v) => patch("shippingNote", v)}
                  rows={3}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitle}>Admin Notu</h2>
              <TextAreaField
                label="İç not"
                value={form.adminNote}
                onChange={(v) => patch("adminNote", v)}
                rows={6}
              />
            </div>
          </section>

          <aside style={rightCol}>
            <div style={cardStyle}>
              <h2 style={sectionTitle}>Durum ve Ödeme</h2>

              <div style={stack12}>
                <SelectField
                  label="Sipariş Durumu"
                  value={form.status}
                  onChange={(v) => patch("status", v as OrderStatus)}
                  options={STATUS_OPTIONS}
                />

                <SelectField
                  label="Payment Status"
                  value={form.paymentStatus}
                  onChange={(v) => patch("paymentStatus", v)}
                  options={PAYMENT_STATUS_OPTIONS}
                />

                <SelectField
                  label="Provider"
                  value={form.provider}
                  onChange={(v) => patch("provider", v as PaymentProvider)}
                  options={PROVIDER_OPTIONS}
                />

                <SelectField
                  label="Method"
                  value={form.method}
                  onChange={(v) => patch("method", v as PaymentMethod)}
                  options={METHOD_OPTIONS}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitle}>Hızlı Linkler</h2>
              <div style={stack10}>
                <Link href={`/admin/orders/${encodeURIComponent(id)}`} style={ghostBtnFull}>
                  Sipariş Detayı
                </Link>
                <Link href="/admin/orders" style={ghostBtnFull}>
                  Sipariş Listesi
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <input
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <textarea
        style={{ ...inputStyle, resize: "vertical", minHeight: rows * 24 }}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
};

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const kickerStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.12em",
  color: "#6366f1",
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 42,
  lineHeight: 1.05,
  fontWeight: 900,
  margin: 0,
  color: "#0f172a",
};

const subStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#475569",
  fontWeight: 600,
};

const actionsTop: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.9fr)",
  gap: 20,
};

const leftCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const rightCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const miniGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const miniBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const miniLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const metaText: React.CSSProperties = {
  color: "#334155",
  fontWeight: 600,
  marginTop: 6,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const fieldWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dbe2ea",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 15,
  fontWeight: 600,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
};

const stack12: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const stack10: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const primaryBtn: React.CSSProperties = {
  border: "none",
  background: "#0f172a",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: 14,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const ghostBtn: React.CSSProperties = {
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#0f172a",
  padding: "12px 18px",
  borderRadius: 14,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const ghostBtnFull: React.CSSProperties = {
  ...ghostBtn,
  display: "block",
  textAlign: "center",
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  textDecoration: "none",
  fontWeight: 800,
  color: "#0f172a",
};

const badAlert: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  padding: 14,
  borderRadius: 14,
  fontWeight: 700,
};

const okAlert: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  padding: 14,
  borderRadius: 14,
  fontWeight: 700,
};