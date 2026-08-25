/**
 * Meta Conversions API (CAPI) — Server-Side Event Helper
 *
 * Stape CAPIG veya doğrudan Facebook Graph API üzerinden
 * server-side event gönderir.
 *
 * Mevcut client-side pixel'e dokunmaz, yanında çalışır.
 * Dedup için aynı event_id kullanılır.
 */

import { getTrackingSettings } from "@/lib/trackingSettings.server";
import crypto from "crypto";

export type CAPIEventData = {
  eventName: string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: "website" | "app" | "other";
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
    externalId?: string;
  };
  customData?: Record<string, unknown>;
};

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

function hashUserData(ud?: CAPIEventData["userData"]) {
  if (!ud) return {};

  const result: Record<string, string | undefined> = {};

  if (ud.email) result.em = sha256Hex(ud.email);
  if (ud.phone) result.ph = sha256Hex(ud.phone.replace(/\D/g, ""));
  if (ud.firstName) result.fn = sha256Hex(ud.firstName);
  if (ud.lastName) result.ln = sha256Hex(ud.lastName);
  if (ud.city) result.ct = sha256Hex(ud.city);
  if (ud.country) result.country = sha256Hex(ud.country);

  // IP ve User-Agent hash'lenmez
  if (ud.clientIpAddress) result.client_ip_address = ud.clientIpAddress;
  if (ud.clientUserAgent) result.client_user_agent = ud.clientUserAgent;

  // Facebook click/browser IDs
  if (ud.fbc) result.fbc = ud.fbc;
  if (ud.fbp) result.fbp = ud.fbp;

  if (ud.externalId) result.external_id = sha256Hex(ud.externalId);

  return result;
}

/**
 * Server-side'dan Meta Conversions API'ye event gönder.
 * 
 * Stape CAPIG varsa oraya, yoksa direkt Facebook Graph API'ye gider.
 */
export async function sendCAPIEvent(event: CAPIEventData): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const settings = await getTrackingSettings();

    // CAPI enabled mi?
    if (!settings.meta.capiEnabled) {
      return { ok: false, error: "CAPI disabled" };
    }

    const pixelId = settings.meta.pixelId;
    if (!pixelId) {
      return { ok: false, error: "No pixel ID" };
    }

    const accessToken = settings.meta.conversionsApiToken;
    const capiGatewayUrl = settings.meta.capiGatewayUrl;
    const capiApiKey = settings.meta.capiApiKey;

    // Event payload
    const eventPayload = {
      event_name: event.eventName,
      event_time: event.eventTime || Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      event_source_url: event.eventSourceUrl || "",
      action_source: event.actionSource || "website",
      user_data: hashUserData(event.userData),
      custom_data: event.customData || {},
    };

    // Stape CAPIG varsa oraya gönder
    if (capiGatewayUrl && capiApiKey) {
      return await sendViaCAPIGateway(capiGatewayUrl, capiApiKey, pixelId, eventPayload);
    }

    // Yoksa direkt Facebook Graph API'ye gönder
    if (accessToken) {
      return await sendViaGraphAPI(pixelId, accessToken, eventPayload);
    }

    return { ok: false, error: "No CAPI credentials configured" };
  } catch (e: any) {
    console.error("[CAPI] sendCAPIEvent error:", e);
    return { ok: false, error: e?.message || "Unknown error" };
  }
}

/**
 * Stape CAPIG Gateway üzerinden gönder
 */
async function sendViaCAPIGateway(
  gatewayUrl: string,
  apiKey: string,
  pixelId: string,
  eventPayload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = `${gatewayUrl.replace(/\/+$/, "")}/capi/events`;

  const body = {
    pixel_id: pixelId,
    events: [eventPayload],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    redirect: "manual", // Redirect loop'u önle
  });

  // 3xx redirect yanıtları CAPI gateway'lerde başarı sayılır
  if (res.status >= 300 && res.status < 400) {
    return { ok: true };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[CAPI Gateway] error:", res.status, text);
    return { ok: false, error: `Gateway ${res.status}: ${text}` };
  }

  return { ok: true };
}

/**
 * Direkt Facebook Graph API üzerinden gönder (fallback)
 */
async function sendViaGraphAPI(
  pixelId: string,
  accessToken: string,
  eventPayload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`;

  const body = {
    data: [eventPayload],
    access_token: accessToken,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[CAPI Graph] error:", res.status, text);
    return { ok: false, error: `Graph API ${res.status}: ${text}` };
  }

  return { ok: true };
}
