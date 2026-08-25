// src/context/constants.js

// Para birimi: tek kaynak
export const currency = "₺";
export const CURRENCY_CODE = "TRY"; // Intl formatter için

// Tarih
export const currentYear = new Date().getFullYear();

// Branding
export const developedByLink = "https://techzaa.getappui.com/";
export const developedBy = "Cihat Erdem";
export const contactUs = "info@dromocob.tr";

// UI / App
export const buyLink = "";
export const basePath = ""; // subpath varsa örn: "/admin" gibi buraya yazarsın
export const DEFAULT_PAGE_TITLE = "Dromocob e-ticaret";

// API
// Next.js API kullanıyorsan boş bırak; harici backend varsa buraya koy.
export const API_BASE_PATH = "";

// Theme
export const colorVariants = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "info",
  "dark",
  "purple",
  "pink",
  "orange",
  "light",
  "link",
];

// (Opsiyonel ama çok faydalı) tek yerden para formatlamak istersen:
export const formatTRY = (value, { fractionDigits = 0 } = {}) => {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: CURRENCY_CODE,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(safe);
  } catch {
    return `${currency}${Math.round(safe)}`;
  }
};
