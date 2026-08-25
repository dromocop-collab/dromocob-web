import type { CreateShipmentInput } from "@/lib/shipping/types";

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

function normalizePhoneTR(v: unknown): string {
  const digits = onlyDigits(v);
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 11) return `9${digits}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export function normalizeUpper(v: unknown): string {
  return safeStr(v)
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

function sumWeightKg(items: any[]): number {
  const totalGram = items.reduce((acc, item) => {
    const weightGram =
      Number(item?.weightGram ?? item?.gram ?? item?.weight ?? 0) || 0;
    const qty = Number(item?.qty || 1) || 1;
    return acc + weightGram * qty;
  }, 0);

  const kg = totalGram / 1000;
  return kg > 0 ? Number(kg.toFixed(3)) : 0.2;
}

function estimateDesiFromItems(items: any[]): number {
  const total = items.reduce((acc, item) => {
    const qty = Number(item?.qty || 1) || 1;

    const desi =
      Number(item?.desi ?? 0) ||
      (() => {
        const l = Number(item?.length ?? item?.lengthCm ?? 0) || 0;
        const w = Number(item?.width ?? item?.widthCm ?? 0) || 0;
        const h = Number(item?.height ?? item?.heightCm ?? 0) || 0;

        if (l > 0 && w > 0 && h > 0) return (l * w * h) / 3000;
        return 0;
      })();

    return acc + desi * qty;
  }, 0);

  return total > 0 ? Math.max(1, Math.round(total)) : 1;
}

function buildOrderContent(items: any[]): string {
  const txt = items
    .map((item) => safeText(item?.title) || safeText(item?.name) || safeText(item?.sku))
    .filter(Boolean)
    .join(", ")
    .slice(0, 180);

  return txt || "SIPARIS ICERIGI";
}

export function buildShipmentInputFromOrder(
  orderId: string,
  orderData: any
): CreateShipmentInput {
  const address = orderData?.shippingAddress || orderData?.address || {};
  const items = Array.isArray(orderData?.items) ? orderData.items : [];

  const fullName =
    safeStr(address?.fullName) ||
    `${safeStr(address?.firstName)} ${safeStr(address?.lastName)}`.trim() ||
    "MUSTERI";

  const rawCity = normalizeUpper(address?.city || address?.cityName);
  const rawDistrict = normalizeUpper(address?.district || address?.districtName);

  const rawAddressLine =
    address?.addressLine ||
    address?.line1 ||
    address?.fullAddress ||
    orderData?.shippingAddressText ||
    "";

  // District boşsa adres satırının son kelimesinden çıkarmayı dene
  // MNG varış şubesi bulmak için district gerektirir
  let finalDistrict = rawDistrict;
  if (!finalDistrict && rawAddressLine) {
    const parts = normalizeUpper(rawAddressLine)
      .split(/[,\/\n]+/)
      .map((p: string) => p.trim())
      .filter(Boolean);
    // Son parça genellikle ilçe adı olur (ör: "AKARCA MAH YUNUS NADI CAD ISTANBUL")
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      // Eğer son parça tek/iki kelime ve il adıyla aynı değilse, muhtemelen ilçe
      if (lastPart && lastPart !== rawCity && lastPart.split(/\s+/).length <= 3) {
        finalDistrict = lastPart;
      }
    }
  }

  return {
    orderId: normalizeUpper(orderId),
    currency: safeStr(orderData?.currency || orderData?.total?.currency) || "TRY",
    recipient: {
      fullName: normalizeUpper(fullName),
      phone: normalizePhoneTR(address?.phone),
      email: safeStr(orderData?.email || orderData?.userEmail).toLowerCase(),
    },
    address: {
      countryCode: safeStr(address?.countryCode) || "TR",
      city: rawCity,
      district: finalDistrict,
      postalCode: safeStr(address?.postalCode),
      addressLine: normalizeUpper(rawAddressLine) || "ADRES",
    },
    parcels: [
      {
        weight: sumWeightKg(items),
        desi: estimateDesiFromItems(items),
      },
    ],
    items: items.map((item: any, index: number) => ({
      name: normalizeUpper(
        safeText(item?.title) ||
          safeText(item?.name) ||
          safeText(item?.sku) ||
          `URUN ${index + 1}`
      ),
      qty: Number(item?.qty || 1) || 1,
      unitPrice: Number(item?.unitPrice || item?.price || 0) || 0,
      sku: normalizeUpper(item?.sku),
    })),
    notes: buildOrderContent(items) || safeStr(orderData?.note),
  };
}