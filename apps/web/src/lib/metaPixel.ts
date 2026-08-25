/**
 * Meta Pixel Client-Side Tracking
 *
 * Client-side fbq() çağrıları + server-side CAPI dedup.
 * Mevcut piksel yapısı korunuyor, üzerine event_id ve
 * server-side proxy eklendi.
 */

export type MetaPixelEventName =
    | "PageView"
    | "ViewContent"
    | "AddToCart"
    | "InitiateCheckout"
    | "Purchase"
    | "Search"
    | "Lead"
    | "CompleteRegistration";

type MetaPixelParams = Record<string, string | number | boolean | null | undefined>;

declare global {
    interface Window {
        fbq?: (...args: any[]) => void;
        _fbq?: any;
    }
}

/**
 * Benzersiz event ID üret (dedup için)
 */
function generateEventId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Facebook cookie'lerini oku (_fbc, _fbp)
 */
function getFbCookies(): { fbc?: string; fbp?: string } {
    if (typeof document === "undefined") return {};

    const cookies = document.cookie.split(";").reduce((acc, c) => {
        const [key, ...rest] = c.trim().split("=");
        if (key) acc[key.trim()] = rest.join("=");
        return acc;
    }, {} as Record<string, string>);

    return {
        fbc: cookies["_fbc"] || undefined,
        fbp: cookies["_fbp"] || undefined,
    };
}

export function hasMetaPixel() {
    return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Ana tracking fonksiyonu.
 * 1) Client-side fbq() çağırır (mevcut davranış)
 * 2) Server-side CAPI proxy'ye event gönderir (yeni — dedup)
 */
export function trackMetaPixel(eventName: MetaPixelEventName, params?: MetaPixelParams) {
    if (typeof window === "undefined") return;

    const eventId = generateEventId();
    const cleanedParams = params && Object.keys(params).length > 0 ? cleanParams(params) : undefined;

    // 1) Client-side fbq — mevcut davranış korunuyor
    if (hasMetaPixel()) {
        try {
            if (cleanedParams) {
                window.fbq?.("track", eventName, cleanedParams, { eventID: eventId });
            } else {
                window.fbq?.("track", eventName, {}, { eventID: eventId });
            }
        } catch {
            // Pixel hatası kullanıcı deneyimini bozmasın.
        }
    }

    // 2) Server-side CAPI proxy — arka planda, hata kullanıcıyı etkilemez
    sendToServerCAPI(eventName, eventId, cleanedParams).catch(() => {
        // Sessiz hata — CAPI başarısız olsa da client pixel çalışır
    });
}

/**
 * Server-side CAPI proxy'ye event gönder
 */
async function sendToServerCAPI(
    eventName: string,
    eventId: string,
    customData?: Record<string, unknown>
) {
    try {
        const fbCookies = getFbCookies();
        const url = typeof window !== "undefined" ? window.location.href : "";

        await fetch("/api/meta/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                eventName,
                eventId,
                eventSourceUrl: url,
                userData: {
                    fbc: fbCookies.fbc,
                    fbp: fbCookies.fbp,
                },
                customData: customData || undefined,
            }),
            // Sayfanın kapanmasını beklemesin
            keepalive: true,
        });
    } catch {
        // Sessiz — CAPI hata verse de client pixel çalışmaya devam eder
    }
}

// ─── Convenience Wrappers (mevcut API korunuyor) ───

export function trackMetaPageView() {
    trackMetaPixel("PageView");
}

export function trackMetaViewContent(params: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    contents?: { id: string; quantity: number }[];
    value?: number;
    currency?: string;
}) {
    trackMetaPixel("ViewContent", {
        content_ids: params.content_ids,                    // Array olarak kalacak
        content_name: params.content_name,
        content_type: params.content_type || "product",
        contents: params.contents,                          // [{id, quantity}]
        value: params.value,
        currency: params.currency || "TRY",
    } as any);
}

export function trackMetaAddToCart(params: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    contents?: { id: string; quantity: number }[];
    value?: number;
    currency?: string;
}) {
    trackMetaPixel("AddToCart", {
        content_ids: params.content_ids,
        content_name: params.content_name,
        content_type: params.content_type || "product",
        contents: params.contents,
        value: params.value,
        currency: params.currency || "TRY",
    } as any);
}

export function trackMetaInitiateCheckout(params?: {
    value?: number;
    currency?: string;
    num_items?: number;
    content_ids?: string[];
    contents?: { id: string; quantity: number }[];
}) {
    trackMetaPixel("InitiateCheckout", {
        value: params?.value,
        currency: params?.currency || "TRY",
        num_items: params?.num_items,
        content_ids: params?.content_ids,
        contents: params?.contents,
    } as any);
}

export function trackMetaPurchase(params: {
    value: number;
    currency?: string;
    content_ids?: string[];
    contents?: { id: string; quantity: number }[];
    num_items?: number;
}) {
    trackMetaPixel("Purchase", {
        value: params.value,
        currency: params.currency || "TRY",
        content_ids: params.content_ids,
        contents: params.contents,
        num_items: params.num_items,
    } as any);
}

function cleanParams(params: MetaPixelParams) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => {
            if (value === undefined || value === null || value === "") return false;
            // Boş array'leri de filtrele
            if (Array.isArray(value) && value.length === 0) return false;
            return true;
        })
    );
}