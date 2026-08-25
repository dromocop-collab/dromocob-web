import { createMngBarcode, createMngOrder, getMngToken } from "./mng";
import type {
  CreateBarcodeResult,
  CreateOrderResult,
  CreateShipmentInput,
  MngShippingConfig,
  ShippingMode,
  ShippingSettingsShape,
} from "./types";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeMode(v: unknown): ShippingMode {
  return safeStr(v) === "live" ? "live" : "test";
}

function normalizeSettings(raw: ShippingSettingsShape | null | undefined) {
  const mng = raw?.providers?.mng || {};

  const config: MngShippingConfig = {
    isActive: mng.isActive !== false,
    baseUrl: safeStr(mng.baseUrl) || "https://api.mngkargo.com.tr",
    apiKey: safeStr(mng.apiKey),
    apiSecret: safeStr(mng.apiSecret),

    useIBMHeaders: mng.useIBMHeaders !== false,
    headerClientIdKey: safeStr(mng.headerClientIdKey) || "X-IBM-Client-Id",
    headerClientSecretKey:
      safeStr(mng.headerClientSecretKey) || "X-IBM-Client-Secret",

    customerNumber: safeStr(mng.customerNumber),
    password: safeStr(mng.password),
    identityType:
      typeof mng.identityType === "number" && Number.isFinite(mng.identityType)
        ? mng.identityType
        : 1,

    tokenPath: safeStr(mng.tokenPath) || "/mngapi/api/token",
    createOrderPath:
      safeStr((mng as any).createOrderPath) ||
      "/mngapi/api/standardcmdapi/createOrder",
    createBarcodePath:
      safeStr((mng as any).createBarcodePath) ||
      safeStr((mng as any).endpointPath) ||
      "/mngapi/api/barcodecmdapi/createbarcode",
    cancelShipmentPath:
      safeStr((mng as any).cancelShipmentPath) ||
      "/mngapi/api/barcodecmdapi/cancelshipment",

    customerCode: safeStr(mng.customerCode),
    senderCustomerId: safeStr(mng.senderCustomerId),
    accountNumber: safeStr(mng.accountNumber),

    labelFormat: mng.labelFormat === "ZPL" ? "ZPL" : "PDF",
    defaultPackageType:
      mng.defaultPackageType === "DOCUMENT" ||
      mng.defaultPackageType === "PARCEL" ||
      mng.defaultPackageType === "BOX"
        ? mng.defaultPackageType
        : "BOX",
    defaultCurrency: safeStr(mng.defaultCurrency) || "TRY",
    defaultWeightUnit: mng.defaultWeightUnit === "LB" ? "LB" : "KG",
    defaultDimensionUnit: mng.defaultDimensionUnit === "IN" ? "IN" : "CM",

    notes: safeStr(mng.notes),
  };

  return {
    activeProvider: "mng" as const,
    mode: normalizeMode(raw?.mode),
    features: {
      createShipment: raw?.features?.createShipment !== false,
      cancelShipment: raw?.features?.cancelShipment === true,
      tracking: raw?.features?.tracking !== false,
      labelDownload: raw?.features?.labelDownload !== false,
    },
    providers: {
      mng: config,
    },
  };
}

export function normalizeShippingSettings(raw: ShippingSettingsShape | null | undefined) {
  return normalizeSettings(raw);
}

export async function testShippingConnection(args: {
  settingsRaw: ShippingSettingsShape | null | undefined;
}) {
  const settings = normalizeSettings(args.settingsRaw);

  if (settings.activeProvider !== "mng") {
    throw new Error(`Desteklenmeyen provider: ${settings.activeProvider}`);
  }

  const jwt = await getMngToken(settings.providers.mng);

  return {
    provider: "mng" as const,
    ok: true,
    jwtPreview: `${jwt.slice(0, 16)}...`,
  };
}

export async function createOrderByActiveProvider(args: {
  input: CreateShipmentInput;
  settingsRaw: ShippingSettingsShape | null | undefined;
}): Promise<CreateOrderResult> {
  const settings = normalizeSettings(args.settingsRaw);

  if (!settings.features.createShipment) {
    throw new Error("Shipment oluşturma kapalı.");
  }

  if (settings.activeProvider !== "mng") {
    throw new Error(`Desteklenmeyen provider: ${settings.activeProvider}`);
  }

  return createMngOrder({
    input: args.input,
    config: settings.providers.mng,
    mode: settings.mode,
  });
}

export async function createBarcodeByActiveProvider(args: {
  input: CreateShipmentInput;
  referenceId: string;
  settingsRaw: ShippingSettingsShape | null | undefined;
}): Promise<CreateBarcodeResult> {
  const settings = normalizeSettings(args.settingsRaw);

  if (!settings.features.createShipment) {
    throw new Error("Shipment oluşturma kapalı.");
  }

  if (settings.activeProvider !== "mng") {
    throw new Error(`Desteklenmeyen provider: ${settings.activeProvider}`);
  }

  return createMngBarcode({
    input: args.input,
    referenceId: args.referenceId,
    config: settings.providers.mng,
    mode: settings.mode,
  });
}

export * from "./types";