import { getPaymentProvider } from "./config";
import type { PaymentInitPayload, PaymentStartResult } from "./types";
import { startPaytrPayment } from "./paytr";

export async function startPayment(
  payload: PaymentInitPayload
): Promise<PaymentStartResult> {
  const provider = getPaymentProvider();

  switch (provider) {
    case "paytr":
      return startPaytrPayment(payload);

    case "manual":
      throw new Error("Manual payment provider redirect flow not implemented.");

    case "none":
    default:
      throw new Error("Payment provider is disabled.");
  }
}