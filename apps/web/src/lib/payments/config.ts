import type { PaymentProvider } from "./types";

function req(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} eksik`);
  }
  return value;
}

function opt(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function getPaymentProvider(): PaymentProvider {
  const v = opt("PAYMENT_PROVIDER", "none").toLowerCase();

  if (v === "paytr") return "paytr";
  if (v === "manual") return "manual";
  return "none";
}

export function getPaymentBaseUrl(): string {
  return req("PAYMENT_BASE_URL");
}

export function getPaytrConfig() {
  return {
    merchantId: req("PAYTR_MERCHANT_ID"),
    merchantKey: req("PAYTR_MERCHANT_KEY"),
    merchantSalt: req("PAYTR_MERCHANT_SALT"),
    paymentUrl: opt("PAYTR_PAYMENT_URL", "https://www.paytr.com/odeme"),
    debugOn: opt("PAYTR_DEBUG_ON", "0") === "1" ? "1" as const : "0" as const,
    non3d: opt("PAYTR_NON3D", "0") === "1" ? "1" as const : "0" as const,
    testMode: opt("PAYTR_TEST_MODE", "0") === "1" ? "1" as const : "0" as const,
  };
}