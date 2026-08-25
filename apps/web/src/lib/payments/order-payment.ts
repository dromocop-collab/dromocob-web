type LooseOrder = Record<string, unknown>;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function obj(v: unknown): LooseOrder {
  return v && typeof v === "object" ? (v as LooseOrder) : {};
}

export function pickOrderCustomerName(order: unknown): string {
  const o = obj(order);
  const customer = obj(o.customer);
  const shippingAddress = obj(o.shippingAddress);

  const first = str(customer.firstName || shippingAddress.firstName);
  const last = str(customer.lastName || shippingAddress.lastName);
  const full = str(shippingAddress.fullName);

  return `${first} ${last}`.trim() || full || "Misafir Kullanıcı";
}

export function pickOrderCustomerPhone(order: unknown): string {
  const o = obj(order);
  const customer = obj(o.customer);
  const shippingAddress = obj(o.shippingAddress);
  const billing = obj(o.billing);

  return str(customer.phone || shippingAddress.phone || billing.phone);
}

export function pickOrderEmail(order: unknown): string {
  const o = obj(order);
  const customer = obj(o.customer);

  return str(o.email || customer.email).toLowerCase();
}

export function pickOrderAmountTry(order: unknown): number {
  const o = obj(order);
  const total = obj(o.total);

  const amount = Number(total.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}