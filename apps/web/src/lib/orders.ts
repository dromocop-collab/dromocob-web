import { Timestamp } from "firebase/firestore";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type Money = { amount: number; currency: "TRY" };

export type OrderItem = {
  productId: string;
  sku?: string;
  title: { tr: string; en: string };
  qty: number;
  unitPrice: Money;
  lineTotal: Money;
  image?: string;
  slug?: string;
  variant?: Record<string, string>;
};

export type Address = {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
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

export type BillingInfo = {
  invoiceType?: "individual" | "company";
  firstName?: string;
  lastName?: string;
  phone?: string;
  nationalId?: string;
  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
};

export type CustomerInfo = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
};

export type OrderDoc = {
  uid: string;
  email?: string;
  status: OrderStatus;

  items: OrderItem[];
  subtotal: Money;
  shippingFee: Money;
  discount: Money;
  total: Money;

  shippingAddress: Address;
  billing?: BillingInfo;
  customer?: CustomerInfo;

  payment: {
    provider: "none" | "kuveyt" | "iyzico" | "manual";
    method?: "card" | "transfer" | "cod";
    paidAt?: Timestamp | string | null;
    ref?: string;
  };

  meta: {
    locale: "tr" | "en";
    userAgent?: string;
    ip?: string;
  };

  createdAt: Timestamp | string | number | null;
  updatedAt: Timestamp | string | number | null;

  createdAtIso?: string;
  updatedAtIso?: string;
  paidAtIso?: string;

  paymentStatus?: "pending" | "paid" | "failed";
  stockApplied?: boolean;
  stockAppliedAt?: Timestamp | string | null;

  adminNote?: string;
};

export function money(amount: number): Money {
  return {
    amount: Number(Number(amount || 0).toFixed(2)),
    currency: "TRY",
  };
}

export function fmtTRY(amount: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  } catch {
    return `${amount} TL`;
  }
}

export function statusTR(s: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };
  return map[s] || s;
}

export function statusEN(s: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    draft: "Draft",
    pending_payment: "Pending payment",
    paid: "Paid",
    preparing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return map[s] || s;
}

export function toSafeText(v: any) {
  return String(v ?? "").trim();
}