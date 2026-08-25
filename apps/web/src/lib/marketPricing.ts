// apps/web/src/lib/marketPricing.ts
// ── Piyasa Fiyat Analizi — yardımcı fonksiyonlar & tipler ──

/* ─── Tipler ─── */

export type MarketStatus = "competitive" | "normal" | "expensive" | "missing";

export type MatchQuality = "exact" | "similar" | "weak";

/**
 * Top-level collection: market_price_matches/{matchId}
 * Tek query ile tüm rakip verileri çekilir (317 ayrı sub-collection read yerine).
 */
export type MarketMatch = {
  id: string;
  productId: string;
  productTitle: string;
  productSku: string;
  siteName: string;
  url: string;
  priceTry: number;
  currency: string;
  availability: "in_stock" | "out_of_stock" | "unknown";
  matchQuality: MatchQuality;
  matchNote: string;
  isActive: boolean;
  status: "success" | "manual" | "error";
  error?: string | null;
  createdAt?: any;
  updatedAt?: any;
  lastCheckedAt?: any;
};

/* ─── Hesaplama ─── */

/**
 * Rakip fiyatlarının ortalamasını hesapla.
 * Yalnızca priceTry > 0, isActive === true ve status !== "error" olanları dikkate alır.
 */
export function calcMarketAverage(matches: MarketMatch[]): number | null {
  const valid = matches.filter(
    (m) => m.priceTry > 0 && m.isActive && m.status !== "error"
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, m) => acc + m.priceTry, 0);
  return sum / valid.length;
}

/**
 * En düşük ve en yüksek rakip fiyatı bul.
 */
export function calcMinMax(matches: MarketMatch[]): { min: number; max: number } | null {
  const valid = matches.filter(
    (m) => m.priceTry > 0 && m.isActive && m.status !== "error"
  );
  if (valid.length === 0) return null;
  const prices = valid.map((m) => m.priceTry);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Bizim fiyatımız ile piyasa ortalaması arasındaki fark yüzdesini hesapla.
 * Pozitif → bizim fiyatımız daha yüksek (pahalı)
 * Negatif → bizim fiyatımız daha düşük (rekabetçi)
 */
export function calcDifferencePercent(
  ourPrice: number,
  marketAverage: number
): number {
  if (marketAverage <= 0 || ourPrice <= 0) return 0;
  return ((ourPrice - marketAverage) / marketAverage) * 100;
}

/**
 * Piyasa durumunu belirle.
 * - activeCount === 0 → "missing"
 * - fark > +8% → "expensive"
 * - fark < -8% → "competitive"
 * - arada → "normal"
 */
export function resolveMarketStatus(
  ourPrice: number,
  marketAvg: number | null,
  activeCount: number
): MarketStatus {
  if (activeCount === 0 || marketAvg === null || marketAvg <= 0) {
    return "missing";
  }

  const diff = calcDifferencePercent(ourPrice, marketAvg);

  if (diff > 8) return "expensive";
  if (diff < -8) return "competitive";
  return "normal";
}

/* ─── Rozet ─── */

export function statusLabel(status: MarketStatus): string {
  switch (status) {
    case "competitive": return "Rekabetçi";
    case "normal": return "Normal";
    case "expensive": return "Pahalı";
    case "missing": return "Veri Yok";
  }
}

export function matchQualityLabel(q: MatchQuality): string {
  switch (q) {
    case "exact": return "Birebir";
    case "similar": return "Benzer";
    case "weak": return "Zayıf";
  }
}

export function availabilityLabel(a: string): string {
  switch (a) {
    case "in_stock": return "Stokta";
    case "out_of_stock": return "Tükendi";
    default: return "Bilinmiyor";
  }
}

/* ─── Timestamp → ms ─── */

export function tsToMs(v: any): number {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

/* ─── TRY Format ─── */

export function fmtTRY(value: any, decimals = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₺0,00";

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/* ─── Ürün başlığı ─── */

export function pickTitle(p: any): string {
  const t = p?.title;
  if (typeof t === "string") return t.trim();
  const tr = String(t?.tr ?? "").trim();
  const en = String(t?.en ?? "").trim();
  return tr || en || String(p?.name || "Ürün").trim();
}

/* ─── Ürün resmi ─── */

export function pickImage(p: any, fallback = "/dromocob-mark.svg"): string {
  const c = [
    p?.mainImage,
    p?.image,
    p?.cover,
    p?.thumbnail,
    ...(Array.isArray(p?.images) ? p.images : []),
  ];
  for (const v of c) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s && !s.includes("favicon")) return s;
  }
  return fallback;
}
