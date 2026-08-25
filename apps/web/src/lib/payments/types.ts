export type PaymentProvider = "paytr" | "manual" | "none";

export type PaymentStartResult =
  | {
      ok: true;
      provider: PaymentProvider;
      mode: "redirect";
      redirectUrl: string;
      providerOrderId?: string;
      providerSessionId?: string;
      raw?: unknown;
    }
  | {
      ok: true;
      provider: PaymentProvider;
      mode: "form_post";
      postUrl: string;
      fields: Record<string, string>;
      providerOrderId?: string;
      providerSessionId?: string;
      raw?: unknown;
    };

export type PaymentInitPayload = {
  orderId: string;
  amountTry: number;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  successUrl: string;
  failUrl: string;
  callbackUrl: string;

  customerIp?: string;
  currency?: "TL" | "EUR" | "USD" | "GBP" | "RUB";
  installmentCount?: number;
  testMode?: boolean;

  items?: Array<{
    name: string;
    priceTry: number;
    qty: number;
  }>;
};