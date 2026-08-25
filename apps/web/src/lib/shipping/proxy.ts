import type { CreateShipmentInput } from "@/lib/shipping/types";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function normalizeAsciiUpper(v: unknown): string {
  return safeText(v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function digitsOnly(v: unknown): string {
  return safeStr(v).replace(/\D+/g, "");
}

function normalizeRecipientPhone(v: unknown): string {
  const digits = digitsOnly(v);
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits.slice(2, 12);
  if (digits.startsWith("0") && digits.length >= 11) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

function getProxyBaseUrl(): string {
  const url =
    process.env.MNG_PROXY_BASE_URL ||
    process.env.SHIPPING_PROXY_BASE_URL ||
    "http://167.235.49.246";
  return safeStr(url).replace(/\/+$/, "");
}

function getProxySecret(): string {
  return safeStr(
    process.env.MNG_PROXY_SECRET ||
      process.env.SHIPPING_PROXY_SECRET ||
      ""
  );
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { rawText: text };
  }
}

async function proxyRequest(
  method: "POST" | "PUT",
  path: string,
  body: unknown
) {
  console.log("[shipping/proxy] REQUEST", {
    method,
    path,
    body,
  });

  const baseUrl = getProxyBaseUrl();
  const secret = getProxySecret();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["x-proxy-secret"] = secret;
  }

  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);

  if (!res.ok || !json?.ok) {
    const detail =
      safeStr(json?.error) ||
      safeStr(json?.message) ||
      safeStr(json?.raw?.httpMessage) ||
      safeStr(json?.raw?.moreInformation) ||
      safeStr(json?.rawText);

    throw new Error(
      detail || `Proxy request failed (${res.status}) [${method} ${path}]`
    );
  }

  return json;
}

async function proxyPost(path: string, body: unknown) {
  return proxyRequest("POST", path, body);
}

function buildPieceList(input: CreateShipmentInput) {
  const cleanOrderId = normalizeAsciiUpper(input.orderId)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 28);

  const content =
    input.items
      .map((x) => safeText(x.name))
      .filter(Boolean)
      .join(", ")
      .slice(0, 150) || "ALTIN TAKI";

  return input.parcels.map((parcel, index) => ({
    barcode: `${cleanOrderId}${index + 1}`.slice(0, 30),
    desi: Math.max(1, Math.round(Number(parcel.desi || 1))),
    kg: Math.max(1, Math.ceil(Number(parcel.weight || 1))),
    content: normalizeAsciiUpper(content).slice(0, 150),
  }));
}

export async function proxyTestToken() {
  return proxyPost("/token", {});
}

export async function proxyCreateRecipient(payload: unknown) {
  return proxyPost("/create-recipient", payload);
}

export async function proxyCreateOrder(payload: unknown) {
  return proxyPost("/create-order", payload);
}

export async function proxyCreateBarcode(payload: unknown) {
  return proxyPost("/create-barcode", payload);
}

export async function proxyCancelShipment(payload: unknown) {
  return proxyRequest("PUT", "/cancel-shipment", payload);
}

export function buildCreateRecipientProxyPayload(input: CreateShipmentInput) {
  return {
    recipient: {
      customerId: "",
      refCustomerId: "",
      cityName: normalizeAsciiUpper(input.address.city).slice(0, 50),
      districtName: normalizeAsciiUpper(input.address.district).slice(0, 50),
      cityCode: 0,
      districtCode: 0,
      address: normalizeAsciiUpper(input.address.addressLine).slice(0, 200),
      bussinessPhoneNumber: "",
      email: safeStr(input.recipient.email).toLowerCase().slice(0, 50),
      taxOffice: "",
      taxNumber: "",
      fullName: normalizeAsciiUpper(input.recipient.fullName).slice(0, 150),
      homePhoneNumber: "",
      mobilePhoneNumber: normalizeRecipientPhone(input.recipient.phone),
    },
  };
}

export function buildCreateOrderProxyPayload(input: CreateShipmentInput) {
  const cleanOrderId = normalizeAsciiUpper(input.orderId)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 30);

  const content =
    input.items
      .map((x) => safeText(x.name))
      .filter(Boolean)
      .join(", ")
      .slice(0, 200) || "ALTIN TAKI";

  return {
    order: {
      referenceId: cleanOrderId,
      barcode: cleanOrderId,
      billOfLandingId: "",
      isCOD: 0,
      codAmount: 0,
      shipmentServiceType: 1,
      packagingType: 3,
      content: normalizeAsciiUpper(content).slice(0, 200),
      smsPreference1: 0,
      smsPreference2: 0,
      smsPreference3: 0,
      paymentType: 1,
      deliveryType: 1,
      description: normalizeAsciiUpper(input.notes || "E TICARET SIPARISI").slice(0, 150),
      marketPlaceShortCode: "",
      marketPlaceSaleCode: "",
    },
    orderPieceList: buildPieceList(input),
    recipient: {
      customerId: "",
      refCustomerId: "",
      cityName: normalizeAsciiUpper(input.address.city).slice(0, 50),
      districtName: normalizeAsciiUpper(input.address.district).slice(0, 50),
      cityCode: 0,
      districtCode: 0,
      address: normalizeAsciiUpper(input.address.addressLine).slice(0, 200),
      bussinessPhoneNumber: "",
      email: safeStr(input.recipient.email).toLowerCase().slice(0, 50),
      taxOffice: "",
      taxNumber: "",
      fullName: normalizeAsciiUpper(input.recipient.fullName).slice(0, 150),
      homePhoneNumber: "",
      mobilePhoneNumber: normalizeRecipientPhone(input.recipient.phone),
    },
  };
}

export function buildCreateBarcodeProxyPayload(
  referenceId: string,
  input: CreateShipmentInput
) {
  return {
    referenceId: normalizeAsciiUpper(referenceId)
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 30),
    billOfLandingId: "",
    isCOD: 0,
    codAmount: 0,
    printReferenceBarcodeOnError: 1,
    message: "",
    additionalContent1: "",
    additionalContent2: "",
    additionalContent3: "",
    additionalContent4: "",
    packagingType: 3,
    orderPieceList: buildPieceList(input),
  };
}

export function buildCancelShipmentProxyPayload(
  referenceId: string,
  shipmentId: string
) {
  return {
    referenceId: safeStr(referenceId),
    shipmentId: safeStr(shipmentId),
  };
}