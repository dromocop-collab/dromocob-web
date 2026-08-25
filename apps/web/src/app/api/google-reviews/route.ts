import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const FIELD_MASK = "id,displayName,rating,userRatingCount,reviews,googleMapsUri";
const clean = (value: unknown, max = 400) => String(value || "").trim().slice(0, max);

async function resolvePlaceId(apiKey: string) {
  const configured = clean(process.env.GOOGLE_PLACE_ID, 180);
  if (configured) return configured.replace(/^places\//, "");
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: clean(process.env.GOOGLE_BUSINESS_QUERY || "Dromocob İstanbul", 180), languageCode: "tr", regionCode: "TR", pageSize: 1 }),
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`PLACE_SEARCH_${response.status}`);
  return clean((await response.json())?.places?.[0]?.id, 180);
}

export async function GET() {
  const apiKey = clean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY, 300);
  if (!apiKey) return NextResponse.json({ configured: false, items: [] });
  try {
    const placeId = await resolvePlaceId(apiKey);
    if (!placeId) throw new Error("PLACE_NOT_FOUND");
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=tr&regionCode=TR`, { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK }, next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`PLACE_DETAILS_${response.status}`);
    const data = await response.json();
    const items = (Array.isArray(data?.reviews) ? data.reviews : []).map((review: any, index: number) => ({ id: `${placeId}-${clean(review?.publishTime, 60) || index}`, name: clean(review?.authorAttribution?.displayName, 100) || "Google kullanıcısı", avatar: clean(review?.authorAttribution?.photoUri, 600), authorUrl: clean(review?.authorAttribution?.uri, 600), text: clean(review?.originalText?.text || review?.text?.text, 2500), rating: Math.min(5, Math.max(1, Number(review?.rating) || 5)), relativeTime: clean(review?.relativePublishTimeDescription, 100), source: "google" })).filter((item: any) => item.text);
    return NextResponse.json({ configured: true, businessName: clean(data?.displayName?.text, 160), rating: Number(data?.rating || 0), userRatingCount: Number(data?.userRatingCount || 0), googleMapsUri: clean(data?.googleMapsUri, 700), items }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("google reviews error", error);
    return NextResponse.json({ configured: true, unavailable: true, items: [] });
  }
}
