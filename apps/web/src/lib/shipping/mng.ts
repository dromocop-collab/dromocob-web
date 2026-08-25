import type {
  CreateBarcodeResult,
  CreateOrderResult,
  CreateShipmentInput,
  MngShippingConfig,
  PackageType,
  ShippingMode,
} from "./types";

function safeUrlJoin(baseUrl: string, path: string): string {
  const b = String(baseUrl || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function onlyDigits(v: unknown): string {
  return safeStr(v).replace(/\D+/g, "");
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


function normalizePhoneTRForRecipient(v: unknown): string {
  const digits = onlyDigits(v);

  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits.slice(2, 12);
  if (digits.startsWith("0") && digits.length >= 11) return digits.slice(1, 11);
  if (digits.length >= 10) return digits.slice(0, 10);

  return digits;
}

function buildTrackingUrl(trackingNumber: string): string {
  if (!trackingNumber) return "";
  return `https://www.mngkargo.com.tr/gonderitakip?takipno=${encodeURIComponent(
    trackingNumber
  )}`;
}

function validateMngConfig(config: MngShippingConfig) {
  if (!config.isActive) throw new Error("MNG provider pasif.");
  if (!safeStr(config.baseUrl)) throw new Error("MNG baseUrl eksik.");
  if (!safeStr(config.apiKey)) throw new Error("MNG apiKey / client id eksik.");
  if (!safeStr(config.apiSecret)) throw new Error("MNG apiSecret / client secret eksik.");
  if (!safeStr(config.customerNumber)) throw new Error("MNG customerNumber eksik.");
  if (!safeStr(config.password)) throw new Error("MNG password eksik.");
  if (!safeStr(config.tokenPath)) throw new Error("MNG tokenPath eksik.");
  if (!safeStr(config.createOrderPath)) throw new Error("MNG createOrderPath eksik.");
  if (!safeStr(config.createBarcodePath)) throw new Error("MNG createBarcodePath eksik.");
}

function validateCreateInput(input: CreateShipmentInput) {
  if (!safeStr(input.orderId)) throw new Error("orderId zorunlu.");
  if (!safeStr(input.recipient.fullName)) throw new Error("recipient.fullName zorunlu.");
  if (!safeStr(input.recipient.phone)) throw new Error("recipient.phone zorunlu.");
  if (!safeStr(input.address.countryCode)) throw new Error("address.countryCode zorunlu.");
  if (!safeStr(input.address.city)) throw new Error("address.city zorunlu.");
  if (!safeStr(input.address.addressLine)) throw new Error("address.addressLine zorunlu.");
  if (!Array.isArray(input.parcels) || input.parcels.length === 0) {
    throw new Error("En az 1 parcel zorunlu.");
  }
}

function buildMngHeaders(config: MngShippingConfig, jwt?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.useIBMHeaders) {
    headers[config.headerClientIdKey || "X-IBM-Client-Id"] = config.apiKey;
    headers[config.headerClientSecretKey || "X-IBM-Client-Secret"] = config.apiSecret;
  }

  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  return headers;
}

function buildDebugHeaders(config: MngShippingConfig, jwt?: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    [config.headerClientIdKey || "X-IBM-Client-Id"]: config.apiKey ? "***DOLU***" : "***BOS***",
    [config.headerClientSecretKey || "X-IBM-Client-Secret"]:
      config.apiSecret ? "***DOLU***" : "***BOS***",
    Authorization: jwt ? "Bearer ***" : "***BOS***",
  };
}

function mapPackagingType(pkg: PackageType): number {
  if (pkg === "DOCUMENT") return 1;
  if (pkg === "PARCEL") return 3;
  return 3;
}

function estimateDesi(parcel: CreateShipmentInput["parcels"][number]) {
  if (typeof parcel.desi === "number" && parcel.desi > 0) {
    return Math.max(1, Math.round(parcel.desi));
  }

  const l = Number(parcel.length || 0);
  const w = Number(parcel.width || 0);
  const h = Number(parcel.height || 0);

  if (l > 0 && w > 0 && h > 0) {
    return Math.max(1, Math.round((l * w * h) / 3000));
  }

  return 1;
}

function estimateKg(parcel: CreateShipmentInput["parcels"][number]) {
  const weight = Number(parcel.weight || 0);
  if (weight <= 0) return 1;
  return Math.max(1, Math.ceil(weight));
}

function buildOrderPieceList(input: CreateShipmentInput) {
  const baseBarcode = normalizeAsciiUpper(input.orderId)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 28);

  const content =
    input.items
      .map((x) => safeText(x.name))
      .filter(Boolean)
      .join(", ")
      .slice(0, 150) || "ALTIN TAKI";

  return input.parcels.map((parcel, index) => ({
    barcode: `${baseBarcode}${index + 1}`.slice(0, 30),
    desi: estimateDesi(parcel),
    kg: estimateKg(parcel),
    content: normalizeAsciiUpper(content).slice(0, 150),
  }));
}

function mapCreateOrderPayload(
  input: CreateShipmentInput,
  config: MngShippingConfig
) {
  const referenceId = normalizeAsciiUpper(input.orderId)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 30);

  const recipientName = normalizeAsciiUpper(input.recipient.fullName).slice(0, 150);
  const cityName = normalizeAsciiUpper(input.address.city).slice(0, 50);
  const districtName = normalizeAsciiUpper(input.address.district).slice(0, 50);
  const addressText = normalizeAsciiUpper(input.address.addressLine).slice(0, 200);
  const email = safeText(input.recipient.email).toLowerCase().slice(0, 50);
  const mobilePhoneNumber = normalizePhoneTRForRecipient(input.recipient.phone).slice(0, 10);

  const content =
    input.items
      .map((x) => safeText(x.name))
      .filter(Boolean)
      .join(", ")
      .slice(0, 200) || "ALTIN TAKI";

  const description = normalizeAsciiUpper(input.notes || "E TICARET SIPARISI").slice(0, 150);

  return {
    order: {
      referenceId,
      barcode: referenceId,
      billOfLandingId: "",
      isCOD: 0,
      codAmount: 0,
      shipmentServiceType: 1,
      packagingType: mapPackagingType(config.defaultPackageType),
      content: normalizeAsciiUpper(content).slice(0, 200),
      smsPreference1: 0,
      smsPreference2: 0,
      smsPreference3: 0,
      paymentType: 1,
      deliveryType: 1,
      description,
      marketPlaceShortCode: "",
      marketPlaceSaleCode: "",
    },
    orderPieceList: buildOrderPieceList(input),
    recipient: {
      customerId: "",
      refCustomerId: "",
      cityName,
      districtName,
      address: addressText,
      bussinessPhoneNumber: "",
      email,
      taxOffice: "",
      taxNumber: "",
      fullName: recipientName,
      homePhoneNumber: "",
      mobilePhoneNumber,
    },
  };
}

function mapCreateBarcodePayload(
  referenceId: string,
  input: CreateShipmentInput,
  config: MngShippingConfig
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
    packagingType: mapPackagingType(config.defaultPackageType),
    orderPieceList: buildOrderPieceList(input),
  };
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { rawText: text };
  }
}

function extractErrorMessage(json: any, status: number, fallback: string) {
  return (
    json?.error?.Description ||
    json?.error?.Message ||
    json?.detail ||
    json?.message ||
    json?.httpMessage ||
    json?.title ||
    (typeof json?.rawText === "string" ? json.rawText : "") ||
    `${fallback} (${status})`
  );
}

export async function getMngToken(config: MngShippingConfig): Promise<string> {
  validateMngConfig(config);

  const endpoint = safeUrlJoin(config.baseUrl, config.tokenPath);

  const payload = {
    customerNumber: config.customerNumber,
    password: config.password,
    identityType: Number(config.identityType || 1),
  };

  console.log("MNG TOKEN URL =>", endpoint);
  console.log("MNG TOKEN HEADERS =>", buildDebugHeaders(config));
  console.log("MNG TOKEN BODY =>", {
    customerNumber: config.customerNumber,
    password: config.password ? "***DOLU***" : "***BOS***",
    identityType: Number(config.identityType || 1),
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildMngHeaders(config),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);

  console.log("MNG TOKEN STATUS =>", res.status);
  console.log("MNG TOKEN RESPONSE =>", json);

  if (!res.ok) {
    throw new Error(
      `MNG token failed (${res.status}): ${extractErrorMessage(
        json,
        res.status,
        "Token alınamadı"
      )}`
    );
  }

  const jwt = safeStr(json?.jwt);
  if (!jwt) {
    throw new Error("MNG token yanıtında jwt yok.");
  }

  return jwt;
}

export async function createMngOrder(args: {
  input: CreateShipmentInput;
  config: MngShippingConfig;
  mode: ShippingMode;
}): Promise<CreateOrderResult> {
  const { input, config, mode } = args;

  validateMngConfig(config);
  validateCreateInput(input);

  const jwt = await getMngToken(config);
  const endpoint = safeUrlJoin(config.baseUrl, config.createOrderPath);
  const payload = mapCreateOrderPayload(input, config);

  console.log("MNG CREATE ORDER URL =>", endpoint);
  console.log("MNG CREATE ORDER HEADERS =>", buildDebugHeaders(config, jwt));
  console.log("MNG CREATE ORDER PAYLOAD =>", JSON.stringify(payload, null, 2));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildMngHeaders(config, jwt),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);

  console.log("MNG CREATE ORDER STATUS =>", res.status);
  console.log("MNG CREATE ORDER RESPONSE =>", json);

  if (!res.ok) {
    throw new Error(
      `MNG createOrder failed (${res.status}): ${extractErrorMessage(
        json,
        res.status,
        "Sipariş oluşturulamadı"
      )}`
    );
  }

  const first = Array.isArray(json) ? json[0] || {} : json || {};

  return {
    provider: "mng",
    status: mode === "live" ? "order_created" : "test_order_created",
    referenceId: safeStr(first?.referenceId || input.orderId).toUpperCase(),
    orderInvoiceId: safeStr(first?.orderInvoiceId),
    orderInvoiceDetailId: safeStr(first?.orderInvoiceDetailId),
    shipperBranchCode: safeStr(first?.shipperBranchCode),
    raw: first,
  };
}

export async function createMngBarcode(args: {
  input: CreateShipmentInput;
  referenceId: string;
  config: MngShippingConfig;
  mode: ShippingMode;
}): Promise<CreateBarcodeResult> {
  const { input, referenceId, config, mode } = args;

  validateMngConfig(config);
  validateCreateInput(input);

  const jwt = await getMngToken(config);
  const endpoint = safeUrlJoin(config.baseUrl, config.createBarcodePath);
  const payload = mapCreateBarcodePayload(referenceId, input, config);

  console.log("MNG CREATE BARCODE URL =>", endpoint);
  console.log("MNG CREATE BARCODE HEADERS =>", buildDebugHeaders(config, jwt));
  console.log("MNG CREATE BARCODE PAYLOAD =>", JSON.stringify(payload, null, 2));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildMngHeaders(config, jwt),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await parseJsonSafe(res);

  console.log("MNG CREATE BARCODE STATUS =>", res.status);
  console.log("MNG CREATE BARCODE RESPONSE =>", json);

  if (!res.ok) {
    throw new Error(
      `MNG createBarcode failed (${res.status}): ${extractErrorMessage(
        json,
        res.status,
        "Barkod oluşturulamadı"
      )}`
    );
  }

  const first = Array.isArray(json) ? json[0] || {} : json || {};
  const barcodes = Array.isArray(first?.barcodes) ? first.barcodes : [];
  const firstBarcode = barcodes[0] || {};

  const labelZpl =
    safeStr(first?.labelZpl) ||
    safeStr(first?.zpl) ||
    safeStr(firstBarcode?.value);

  const shipmentId = safeStr(first?.shipmentId) || `MNG-${Date.now()}`;
  const trackingNumber =
    safeStr(firstBarcode?.barcode) ||
    safeStr(first?.shipmentId) ||
    safeStr(first?.referenceId) ||
    shipmentId;

  return {
    provider: "mng",
    status: mode === "live" ? "created" : "test_created",
    referenceId: safeStr(first?.referenceId || referenceId).toUpperCase(),
    shipmentId,
    trackingNumber,
    trackingUrl: buildTrackingUrl(trackingNumber),
    labelUrl: "",
    labelZpl,
    invoiceId: safeStr(first?.invoiceId),
    raw: first,
  };
}