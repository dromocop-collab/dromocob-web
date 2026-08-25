import type { CreateShipmentInput } from "@/lib/shipping/types";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    const s = safeStr(value);
    if (s) return s;
  }

  return "";
}

function onlyDigits(v: unknown): string {
  return safeStr(v).replace(/\D+/g, "");
}

/**
 * Normal shipping/create-order tarafındaki formatla aynı:
 * 05304788298  -> 905304788298
 * 5304788298   -> 905304788298
 * 905304788298 -> 905304788298
 */
function normalizePhoneTR(v: unknown): string {
  const digits = onlyDigits(v);

  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 11) return `9${digits}`;
  if (digits.length === 10) return `90${digits}`;

  return digits;
}

function normalizeUpper(v: unknown): string {
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
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeAddressLine(v: unknown): string {
  const raw = normalizeUpper(v).replace(/\s+/g, " ").trim();
  if (!raw) return "ADRES";

  const parts = raw
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean);

  const unique: string[] = [];

  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }

  return (unique[0] || raw).slice(0, 250);
}

function cleanReferenceSeed(v: unknown): string {
  return normalizeUpper(v)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function pickStoreReturnAddress(settingsData: any) {
  const mng = settingsData?.providers?.mng || {};

  /**
   * Öncelik sırası:
   * 1) settings/shipping.returnReceiver
   * 2) settings/shipping.store
   * 3) settings/shipping.returnAddress
   * 4) providers.mng.returnReceiver
   * 5) providers.mng.returnAddress
   * 6) providers.mng.sender*
   * 7) final fallback
   */
  const returnReceiver = settingsData?.returnReceiver || {};
  const store = settingsData?.store || {};
  const rootReturnAddress = settingsData?.returnAddress || {};
  const mngReturnReceiver = mng?.returnReceiver || {};
  const mngReturnAddress = mng?.returnAddress || {};

  const fullName = firstFilled(
    returnReceiver?.fullName,
    returnReceiver?.companyName,
    store?.fullName,
    store?.companyName,
    rootReturnAddress?.fullName,
    rootReturnAddress?.companyName,
    mngReturnReceiver?.fullName,
    mngReturnReceiver?.companyName,
    mngReturnAddress?.fullName,
    mngReturnAddress?.companyName,
    mng?.senderName,
    "Dromocob"
  );

  const phone = firstFilled(
    returnReceiver?.phone,
    returnReceiver?.mobilePhone,
    returnReceiver?.mobilePhoneNumber,
    store?.phone,
    store?.mobilePhone,
    store?.mobilePhoneNumber,
    rootReturnAddress?.phone,
    rootReturnAddress?.mobilePhone,
    rootReturnAddress?.mobilePhoneNumber,
    mngReturnReceiver?.phone,
    mngReturnReceiver?.mobilePhone,
    mngReturnReceiver?.mobilePhoneNumber,
    mngReturnAddress?.phone,
    mngReturnAddress?.mobilePhone,
    mngReturnAddress?.mobilePhoneNumber,
    mng?.senderPhone,
    mng?.phone,
    process.env.RETURN_STORE_PHONE,
    "05304788298"
  );

  const email = firstFilled(
    returnReceiver?.email,
    store?.email,
    rootReturnAddress?.email,
    mngReturnReceiver?.email,
    mngReturnAddress?.email,
    mng?.senderEmail,
    process.env.RETURN_STORE_EMAIL,
    "info@dromocob.tr"
  );

  const city = firstFilled(
    returnReceiver?.city,
    returnReceiver?.cityName,
    store?.city,
    store?.cityName,
    rootReturnAddress?.city,
    rootReturnAddress?.cityName,
    mngReturnReceiver?.city,
    mngReturnReceiver?.cityName,
    mngReturnAddress?.city,
    mngReturnAddress?.cityName,
    mng?.senderCity,
    "MUGLA"
  );

  const district = firstFilled(
    returnReceiver?.district,
    returnReceiver?.districtName,
    store?.district,
    store?.districtName,
    rootReturnAddress?.district,
    rootReturnAddress?.districtName,
    mngReturnReceiver?.district,
    mngReturnReceiver?.districtName,
    mngReturnAddress?.district,
    mngReturnAddress?.districtName,
    mng?.senderDistrict,
    "ISTANBUL"
  );

  const postalCode = firstFilled(
    returnReceiver?.postalCode,
    store?.postalCode,
    rootReturnAddress?.postalCode,
    mngReturnReceiver?.postalCode,
    mngReturnAddress?.postalCode,
    mng?.senderPostalCode,
    "48303"
  );

  const addressLine = firstFilled(
    returnReceiver?.addressLine,
    returnReceiver?.address,
    store?.addressLine,
    store?.address,
    rootReturnAddress?.addressLine,
    rootReturnAddress?.address,
    mngReturnReceiver?.addressLine,
    mngReturnReceiver?.address,
    mngReturnAddress?.addressLine,
    mngReturnAddress?.address,
    mng?.senderAddressLine,
    mng?.senderAddress,
    "DEMO SHOWROOM"
  );

  return {
    fullName,
    phone: normalizePhoneTR(phone),
    email: safeStr(email).toLowerCase(),
    countryCode: firstFilled(
      returnReceiver?.countryCode,
      store?.countryCode,
      rootReturnAddress?.countryCode,
      mngReturnReceiver?.countryCode,
      mngReturnAddress?.countryCode,
      "TR"
    ),
    city,
    district,
    postalCode,
    addressLine,
  };
}

function pickCustomerAddress(refundData: any, orderData: any) {
  const customer = refundData?.customerSnapshot || refundData?.customer || {};

  const address =
    refundData?.pickupAddress ||
    refundData?.shippingAddress ||
    orderData?.shippingAddress ||
    orderData?.address ||
    {};

  const fullName =
    firstFilled(
      customer?.fullName,
      address?.fullName,
      `${safeStr(address?.firstName)} ${safeStr(address?.lastName)}`.trim(),
      `${safeStr(customer?.firstName)} ${safeStr(customer?.lastName)}`.trim(),
      "MUSTERI"
    );

  return {
    fullName,
    phone: firstFilled(customer?.phone, address?.phone),
    email: firstFilled(customer?.email, orderData?.email, orderData?.userEmail),
    countryCode: firstFilled(address?.countryCode, "TR"),
    city: firstFilled(customer?.city, address?.city, address?.cityName),
    district: firstFilled(customer?.district, address?.district, address?.districtName),
    postalCode: firstFilled(customer?.postalCode, address?.postalCode),
    addressLine: firstFilled(
      customer?.addressLine,
      address?.addressLine,
      address?.line1,
      address?.fullAddress,
      orderData?.shippingAddressText
    ),
  };
}

function getRefundItems(refundData: any, orderData: any) {
  const refundItems = Array.isArray(refundData?.items) ? refundData.items : [];
  if (refundItems.length) return refundItems;

  return Array.isArray(orderData?.items) ? orderData.items : [];
}

function readMoneyAmount(v: any): number {
  if (v && typeof v === "object") {
    const n = Number(v.amount || 0);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function sumWeightKg(items: any[]): number {
  const totalGram = items.reduce((acc, item) => {
    const weightGram =
      Number(item?.weightGram ?? item?.gram ?? item?.weight ?? 0) || 0;

    const qty = Number(item?.qty || 1) || 1;

    return acc + weightGram * qty;
  }, 0);

  const kg = totalGram / 1000;

  /**
   * e-ticaret ürünleri hafif oluyor.
   * MNG tarafında 0 / boş risk olmasın diye min 0.2 KG.
   */
  return kg > 0 ? Number(Math.max(0.2, kg).toFixed(3)) : 0.2;
}

function estimateDesiFromItems(items: any[]): number {
  const total = items.reduce((acc, item) => {
    const qty = Number(item?.qty || 1) || 1;

    const directDesi = Number(item?.desi ?? 0) || 0;

    if (directDesi > 0) {
      return acc + directDesi * qty;
    }

    const l = Number(item?.length ?? item?.lengthCm ?? 0) || 0;
    const w = Number(item?.width ?? item?.widthCm ?? 0) || 0;
    const h = Number(item?.height ?? item?.heightCm ?? 0) || 0;

    if (l > 0 && w > 0 && h > 0) {
      return acc + ((l * w * h) / 3000) * qty;
    }

    return acc;
  }, 0);

  return total > 0 ? Math.max(1, Math.round(total)) : 1;
}

function getItemTitle(item: any, fallback: string) {
  const title = item?.title;

  if (typeof title === "string") {
    return safeText(title);
  }

  if (title && typeof title === "object") {
    return safeText(title?.tr) || safeText(title?.en);
  }

  return safeText(item?.name) || safeText(item?.sku) || fallback;
}

function buildReturnContent(items: any[]): string {
  const txt = items
    .map((item, index) => getItemTitle(item, `IADE URUN ${index + 1}`))
    .filter(Boolean)
    .join(", ")
    .slice(0, 180);

  return txt || "IADE ICERIGI";
}

function buildReturnReferenceId(refundId: string) {
  const seed = cleanReferenceSeed(refundId);

  /**
   * MNG barcode/reference alanlarında uzunluk nazı çıkarmasın diye kısa tutuyoruz.
   * Örnek: I4H3E6ACXC8I
   */
  return `I${seed.slice(-12) || Date.now().toString().slice(-10)}`;
}

export function buildReturnShipmentInputFromRefund(
  refundId: string,
  refundData: any,
  orderData: any,
  settingsData: any
): CreateShipmentInput {
  const customerAddress = pickCustomerAddress(refundData, orderData);
  const storeAddress = pickStoreReturnAddress(settingsData);
  const items = getRefundItems(refundData, orderData);

  const referenceId = buildReturnReferenceId(refundId);

  const content = buildReturnContent(items);

  const notes = normalizeUpper(
    `IADE TALEBI ${refundId} - SIPARIS ${safeStr(
      refundData?.orderDocId || refundData?.orderId
    )} - ${content}`
  ).slice(0, 240);

  /**
   * Şu an MNG create-order payload yapımızda recipient = teslim alacak kişi/kurum.
   * İadede teslim alıcı mağaza olduğu için recipient ve address mağaza bilgileridir.
   * Müşteri bilgisi not ve debug için customerAddress içinde tutuluyor ama CreateShipmentInput tipinde
   * ayrı sender alanı yoksa payload'a doğrudan basılmıyor.
   */
  const mappedItems = items.map((item: any, index: number) => {
    const name = getItemTitle(item, `IADE URUN ${index + 1}`);

    return {
      name: normalizeUpper(name),
      qty: Number(item?.qty || 1) || 1,
      unitPrice:
        readMoneyAmount(item?.unitPrice) ||
        readMoneyAmount(item?.price) ||
        0,
      sku: normalizeUpper(item?.sku),
    };
  });

  const input: CreateShipmentInput = {
    orderId: referenceId,
    currency: safeStr(orderData?.currency || orderData?.total?.currency) || "TRY",

    recipient: {
      fullName: normalizeUpper(storeAddress.fullName),
      phone: storeAddress.phone,
      email: storeAddress.email,
    },

    address: {
      countryCode: safeStr(storeAddress.countryCode) || "TR",
      city: normalizeUpper(storeAddress.city),
      district: normalizeUpper(storeAddress.district),
      postalCode: safeStr(storeAddress.postalCode),
      addressLine: normalizeAddressLine(storeAddress.addressLine),
    },

    parcels: [
      {
        weight: sumWeightKg(items),
        desi: estimateDesiFromItems(items),
      },
    ],

    items: mappedItems.length
      ? mappedItems
      : [
          {
            name: "IADE URUN",
            qty: 1,
            unitPrice: 0,
            sku: "",
          },
        ],

    notes,
  };

  /**
   * Boş telefon MNG'de 400'e düşüyor.
   * Burada son güvenlik kilidi.
   */
  if (!safeStr(input.recipient.phone)) {
    input.recipient.phone = normalizePhoneTR("05304788298");
  }

  if (!safeStr(input.recipient.email)) {
    input.recipient.email = "info@dromocob.tr";
  }

  if (!safeStr(input.address.city)) {
    input.address.city = "MUGLA";
  }

  if (!safeStr(input.address.district)) {
    input.address.district = "ISTANBUL";
  }

  if (!safeStr(input.address.addressLine)) {
    input.address.addressLine = "DEMO SHOWROOM";
  }

  /**
   * Debug ihtiyacı olursa bu objeyi route tarafında loglamak daha doğru.
   * Şimdilik customerAddress kullanılmıyor diye TS/ESLint takılırsa boş referans bırakıyoruz.
   */
  void customerAddress;

  return input;
}