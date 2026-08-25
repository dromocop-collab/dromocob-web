import { adminDb } from "@/lib/firebase.admin";

export type TrackingSettings = {
  meta: {
    pixelId: string;
    enabled: boolean;
    domainVerification: string;
    conversionsApiToken: string;
    capiGatewayUrl: string;
    capiApiKey: string;
    capiEnabled: boolean;
  };
  googleAds: {
    conversionId: string;
    conversionLabel: string;
    remarketingId: string;
    enabled: boolean;
  };
};

function str(v: unknown) {
  return String(v ?? "").trim();
}

function bool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

const DEFAULTS: TrackingSettings = {
  meta: {
    pixelId: "",
    enabled: true,
    domainVerification: "",
    conversionsApiToken: "",
    capiGatewayUrl: "",
    capiApiKey: "",
    capiEnabled: false,
  },
  googleAds: {
    conversionId: "",
    conversionLabel: "",
    remarketingId: "",
    enabled: false,
  },
};

let cache: { data: TrackingSettings; ts: number } | null = null;
const TTL = 60_000; // 1 dakika cache

export async function getTrackingSettings(): Promise<TrackingSettings> {
  if (cache && Date.now() - cache.ts < TTL) {
    return cache.data;
  }

  try {
    const db = adminDb();
    const snap = await db.collection("site_options").doc("tracking").get();
    const raw: any = snap.exists ? snap.data() : {};

    const result: TrackingSettings = {
      meta: {
        pixelId: str(raw?.meta?.pixelId),
        enabled: bool(raw?.meta?.enabled, true),
        domainVerification: str(raw?.meta?.domainVerification),
        conversionsApiToken: str(raw?.meta?.conversionsApiToken),
        capiGatewayUrl: str(raw?.meta?.capiGatewayUrl),
        capiApiKey: str(raw?.meta?.capiApiKey),
        capiEnabled: bool(raw?.meta?.capiEnabled, false),
      },
      googleAds: {
        conversionId: str(raw?.googleAds?.conversionId),
        conversionLabel: str(raw?.googleAds?.conversionLabel),
        remarketingId: str(raw?.googleAds?.remarketingId),
        enabled: bool(raw?.googleAds?.enabled, false),
      },
    };

    cache = { data: result, ts: Date.now() };
    return result;
  } catch (e) {
    console.error("getTrackingSettings error:", e);
    return DEFAULTS;
  }
}

