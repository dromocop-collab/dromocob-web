/**
 * Google Ads conversion tracking helpers.
 * gtag.js, layout.tsx'de tracking config'e göre yüklenir.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function hasGtag() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

/**
 * Genel gtag event gönderici
 */
export function trackGtagEvent(eventName: string, params?: Record<string, any>) {
  if (!hasGtag()) return;

  try {
    if (params) {
      window.gtag?.("event", eventName, params);
    } else {
      window.gtag?.("event", eventName);
    }
  } catch (e) {
    console.warn("gtag event error:", e);
  }
}

/**
 * Google Ads conversion tracking
 * Purchase event'inde çağrılır.
 */
export function trackGoogleAdsConversion({
  conversionId,
  conversionLabel,
  value,
  currency = "TRY",
  transactionId,
}: {
  conversionId: string;
  conversionLabel: string;
  value?: number;
  currency?: string;
  transactionId?: string;
}) {
  if (!hasGtag() || !conversionId || !conversionLabel) return;

  try {
    const params: Record<string, any> = {
      send_to: `${conversionId}/${conversionLabel}`,
    };

    if (typeof value === "number" && Number.isFinite(value)) {
      params.value = value;
      params.currency = currency;
    }

    if (transactionId) {
      params.transaction_id = transactionId;
    }

    window.gtag?.("event", "conversion", params);
  } catch (e) {
    console.warn("Google Ads conversion error:", e);
  }
}

/**
 * Google Ads remarketing page_view
 */
export function trackGoogleAdsPageView() {
  trackGtagEvent("page_view");
}
