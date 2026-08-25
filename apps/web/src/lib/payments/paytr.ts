import crypto from "crypto";
import type { PaymentInitPayload, PaymentStartResult } from "./types";
import { getPaytrConfig } from "./config";

type PaytrTokenResponse =
  | {
      status: "success";
      token: string;
    }
  | {
      status: "failed";
      reason: string;
    };

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").slice(0, 20);
}

function amountToMinor(amountTry: number): string {
  return String(Math.round(amountTry * 100));
}

function getUserIp(payload: PaymentInitPayload): string {
  const ip = payload.customerIp?.trim();
  if (!ip) {
    throw new Error("PayTR için customerIp gerekli.");
  }
  return ip;
}

function buildUserBasket(payload: PaymentInitPayload): string {
  const items =
    payload.items?.length
      ? payload.items
      : [{ name: `Order ${payload.orderId}`, priceTry: payload.amountTry, qty: 1 }];

  const basket = items.map((item) => [
    item.name,
    item.priceTry.toFixed(2),
    item.qty,
  ]);

  return Buffer.from(JSON.stringify(basket), "utf8").toString("base64");
}

function buildPaytrToken(params: {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  noInstallment: "0" | "1";
  maxInstallment: string;
  currency: string;
  testMode: "0" | "1";
  merchantSalt: string;
  merchantKey: string;
}): string {
  const hashStr =
    params.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasket +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    params.testMode;

  return crypto
    .createHmac("sha256", params.merchantKey)
    .update(hashStr + params.merchantSalt)
    .digest("base64");
}

function splitNameAndAddress(payload: PaymentInitPayload): {
  userName: string;
  userAddress: string;
} {
  const userName = (payload.customerName || "Müşteri").trim().slice(0, 60);

  const shipping = (payload as PaymentInitPayload & {
    shippingAddress?: {
      addressLine?: string;
      district?: string;
      city?: string;
      postalCode?: string;
    };
  }).shippingAddress;

  const address = [
    shipping?.addressLine || "",
    shipping?.district || "",
    shipping?.city || "",
    shipping?.postalCode || "",
  ]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ");

  return {
    userName,
    userAddress: address.slice(0, 400) || "Adres bilgisi belirtilmedi",
  };
}

async function fetchPaytrToken(params: {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  timeoutLimit: string;
  currency: string;
  testMode: "0" | "1";
  debugOn: "0" | "1";
  noInstallment: "0" | "1";
  maxInstallment: string;
  lang: "tr" | "en";
}): Promise<PaytrTokenResponse> {
  const paytrToken = buildPaytrToken({
    merchantId: params.merchantId,
    userIp: params.userIp,
    merchantOid: params.merchantOid,
    email: params.email,
    paymentAmount: params.paymentAmount,
    userBasket: params.userBasket,
    noInstallment: params.noInstallment,
    maxInstallment: params.maxInstallment,
    currency: params.currency,
    testMode: params.testMode,
    merchantSalt: params.merchantSalt,
    merchantKey: params.merchantKey,
  });

  const body = new URLSearchParams({
    merchant_id: params.merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: params.paymentAmount,
    paytr_token: paytrToken,
    user_basket: params.userBasket,
    debug_on: params.debugOn,
    no_installment: params.noInstallment,
    max_installment: params.maxInstallment,
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: params.okUrl,
    merchant_fail_url: params.failUrl,
    timeout_limit: params.timeoutLimit,
    currency: params.currency,
    test_mode: params.testMode,
    lang: params.lang,
  });

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const raw = await res.text();

  let data: PaytrTokenResponse;
  try {
    data = JSON.parse(raw) as PaytrTokenResponse;
  } catch {
    throw new Error(`PayTR token cevabı parse edilemedi: ${raw}`);
  }

  if (!res.ok) {
    throw new Error(`PayTR token isteği başarısız: ${res.status} ${raw}`);
  }

  return data;
}

export async function startPaytrPayment(
  payload: PaymentInitPayload
): Promise<PaymentStartResult> {
  const cfg = getPaytrConfig();
  const userIp = getUserIp(payload);
  const paymentAmount = amountToMinor(payload.amountTry);
  const userBasket = buildUserBasket(payload);
  const currency = payload.currency || "TL";
  const installmentCount = payload.installmentCount ?? 0;
  const noInstallment: "0" | "1" = installmentCount === 0 ? "0" : "1";
  const maxInstallment = installmentCount > 0 ? String(installmentCount) : "0";
  const timeoutLimit = "30";
  const lang: "tr" | "en" = "tr";

  const { userName, userAddress } = splitNameAndAddress(payload);

  const tokenResult = await fetchPaytrToken({
    merchantId: cfg.merchantId,
    merchantKey: cfg.merchantKey,
    merchantSalt: cfg.merchantSalt,
    userIp,
    merchantOid: payload.orderId,
    email: payload.customerEmail,
    paymentAmount,
    userBasket,
    userName,
    userAddress,
    userPhone: normalizePhone(payload.customerPhone),
    okUrl: payload.successUrl,
    failUrl: payload.failUrl,
    timeoutLimit,
    currency,
    testMode: cfg.testMode,
    debugOn: cfg.debugOn,
    noInstallment,
    maxInstallment,
    lang,
  });

  if (tokenResult.status !== "success" || !tokenResult.token) {
    const reason =
      "reason" in tokenResult && tokenResult.reason
        ? tokenResult.reason
        : "PayTR token alınamadı";
    throw new Error(reason);
  }

  return {
    ok: true,
    provider: "paytr",
    mode: "redirect",
    redirectUrl: `https://www.paytr.com/odeme/guvenli/${tokenResult.token}`,
    providerOrderId: payload.orderId,
    providerSessionId: tokenResult.token,
    raw: {
      paymentAmount,
      currency,
      userIp,
      testMode: cfg.testMode,
      token: tokenResult.token,
    },
  };
}