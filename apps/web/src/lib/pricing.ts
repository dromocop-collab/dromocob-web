// apps/web/src/lib/pricing.ts
export type RateObj = {
  code?: string;
  buy?: number;
  sell?: number;
  value?: number;
  satis?: number;
  Sell?: number;
};

export type RatesLatest = {
  fetchedAt?: any;
  provider?: string;
  count?: number;
  items?: any;
};

function toNum(v: any, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (v == null) return fallback;

  let s = String(v).trim();
  if (!s) return fallback;

  s = s.replace(/\s/g, "");

  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function normKey(k: string) {
  return String(k || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function getRateValueTRY(r: RatesLatest | null, rateKey: string): number {
  if (!r) return 0;

  const key = normKey(rateKey || "GRAM_ALTIN");

  // 1) itemsMap (obje) — sunucu da bunu ilk kontrol eder
  const itemsMap = (r as any)?.itemsMap;
  if (itemsMap && typeof itemsMap === "object") {
    const node: any =
      itemsMap[key] ??
      itemsMap[key.toLowerCase?.()] ??
      itemsMap[key.replace(/_/g, "")] ??
      itemsMap[key.replace(/_/g, "").toLowerCase?.()];

    if (typeof node === "number" && node > 0) return node;

    const sell = toNum(node?.sell ?? node?.Sell ?? node?.satis ?? node?.value ?? 0, 0);
    if (sell > 0) return sell;
  }

  // 2) items (obje)
  const items = (r as any)?.items;

  if (items && typeof items === "object" && !Array.isArray(items)) {
    const node: any =
      items[key] ??
      items[key.toLowerCase?.()] ??
      items[key.replace(/_/g, "")] ??
      items[key.replace(/_/g, "").toLowerCase?.()];

    if (typeof node === "number") return node;

    const sell = toNum(node?.sell ?? node?.Sell ?? node?.satis ?? node?.value ?? 0, 0);
    if (sell > 0) return sell;

    const alt = items.GRAM_ALTIN ?? items.gram_altin ?? items.gramAltin ?? items.GA;
    const sell2 = toNum(alt?.sell ?? alt?.value ?? alt?.satis ?? 0, 0);
    return sell2 > 0 ? sell2 : 0;
  }

  // 3) items (array)
  if (Array.isArray(items)) {
    const found = items.find((x: RateObj) => normKey(x?.code || "") === key) as RateObj | undefined;
    const sell = toNum(found?.sell ?? found?.Sell ?? found?.satis ?? found?.value ?? 0, 0);
    if (sell > 0) return sell;

    const ga = items.find((x: RateObj) => normKey(x?.code || "") === "GRAM_ALTIN") as RateObj | undefined;
    const sell2 = toNum(ga?.sell ?? ga?.value ?? ga?.satis ?? 0, 0);
    return sell2 > 0 ? sell2 : 0;
  }

  return 0;
}

function storedFinal(product: any): number {
  return toNum(product?.finalPrice ?? product?.final ?? product?.priceTry ?? 0, 0);
}

function storedRaw(product: any): number {
  return toNum(product?.price ?? product?.rawPrice ?? product?.priceTry ?? 0, 0);
}

function getWeight(product: any): number {
  return Math.max(
    0,
    toNum(
      product?.hasGram ??
        product?.gram ??
        product?.weightGram ??
        product?.weightGr ??
        0,
      0
    )
  );
}

function isCategoryDynamicEnabled(product: any): boolean {
  return !!(
    product?.categoryPricingEnabled ??
    product?.resolvedCategoryPricing?.enabled ??
    product?.categoryPricing?.enabled
  );
}

function getEffectiveRateKey(product: any): string {
  return String(
    product?.resolvedCategoryPricing?.rateKey ??
      product?.categoryPricing?.rateKey ??
      product?.priceRateCode ??
      product?.rateKey ??
      "GRAM_ALTIN"
  );
}

function getEffectivePercent(product: any): number {
  return Math.max(
    0,
    toNum(
      product?.resolvedCategoryPricing?.pricePercent ??
        product?.categoryPricing?.pricePercent ??
        product?.pricePercent ??
        0,
      0
    )
  );
}

function getEffectiveFixedAdd(product: any): number {
  return Math.max(
    0,
    toNum(
      product?.resolvedCategoryPricing?.priceFixedAdd ??
        product?.categoryPricing?.priceFixedAdd ??
        product?.priceFixedAdd ??
        0,
      0
    )
  );
}
function getEffectiveCompareAtPercent(product: any): number {
  return Math.max(
    0,
    toNum(
      product?.resolvedCategoryPricing?.compareAtPercent ??
      product?.categoryPricing?.compareAtPercent ??
      product?.compareAtPercent ??
      0,
      0
    )
  );
}
function getCompareAtConfig(product: any) {
  // 1) Ürün seviyesinde compareAtPercent > 0 ve compareAtEnabled ise → direkt kullan
  const productPercent = Math.max(0, toNum(product?.compareAtPercent ?? 0, 0));
  const productEnabled = product?.compareAtEnabled === true;

  if (productEnabled && productPercent > 0) {
    return { enabled: true, percent: productPercent };
  }

  // 2) Override açıksa ürünün değerlerini kullan (indirim 0 olsa bile)
  if (!!product?.compareAtOverrideEnabled) {
    return { enabled: productEnabled, percent: productPercent };
  }

  // 3) Kategori pricing'den oku
  const catPercent = Math.max(
    0,
    toNum(
      product?.resolvedCategoryPricing?.compareAtPercent ??
      product?.categoryPricing?.compareAtPercent ??
      0,
      0
    )
  );

  const catEnabled = !!(
    product?.resolvedCategoryPricing?.compareAtEnabled ??
    product?.categoryPricing?.compareAtEnabled
  );

  return { enabled: catEnabled || catPercent > 0, percent: catPercent };
}

export function getCompareAtPriceTRY(product: any, currentPrice: number): number | null {
  const percent = getEffectiveCompareAtPercent(product);
  const base = toNum(currentPrice, 0);

  if (percent <= 0 || base <= 0) return null;

  // Gerçek indirim: currentPrice zaten indirimli fiyat ise
  // orijinal fiyatı geri hesapla → base / (1 - %/100)
  const compareAt = base / (1 - percent / 100);

  if (compareAt <= base) return null;

  return compareAt;
}
// ── İkinci fiyat motoru hesabı ──
function calcPrice2(product: any, rates: RatesLatest | null): number {
  if (!product?.price2Enabled) return 0;

  const mode2 = String(product?.price2Mode ?? "fixed").toLowerCase();
  const rateKey2 = String(product?.price2RateCode ?? "");
  const hasGram2 = Math.max(0, toNum(product?.price2HasGram ?? 0, 0));
  const percent2 = Math.max(0, toNum(product?.price2Percent ?? 0, 0));
  const fixedAdd2 = Math.max(0, toNum(product?.price2FixedAdd ?? 0, 0));

  if (mode2 === "fixed") return 0; // sabit ikinci motor fallback'i yok

  const rate2 = getRateValueTRY(rates, rateKey2);
  if (rate2 <= 0) return 0;

  if (mode2 === "rate_plus") return rate2 * (1 + percent2 / 100);
  if (mode2 === "rate_plus_fixed") return rate2 * (1 + percent2 / 100) + fixedAdd2;
  if (mode2 === "weight_rate") return hasGram2 * rate2;
  if (mode2 === "weight_rate_plus") return hasGram2 * rate2 * (1 + percent2 / 100);
  if (mode2 === "weight_rate_plus_fixed") return hasGram2 * rate2 * (1 + percent2 / 100) + fixedAdd2;

  return 0;
}

export function computeDynamicPriceTRY(product: any, rates: RatesLatest | null): number | null {
  if (!isCategoryDynamicEnabled(product)) {
    return null;
  }

  const overrideEnabled =
    product?.priceOverrideEnabled === true ||
    String(product?.priceOverrideEnabled ?? "").toLowerCase() === "true";

  const override = toNum(product?.priceOverride ?? 0, 0);
  if (overrideEnabled && override > 0) return override;

  const mode = String(product?.priceMode ?? "fixed").toLowerCase();
  const percent = getEffectivePercent(product);
  const fixedAdd = getEffectiveFixedAdd(product);
  const weightGram = getWeight(product);

  const rateKey = getEffectiveRateKey(product);
  const rate = getRateValueTRY(rates, rateKey);

  // İkinci motor ek fiyatı
  const price2 = calcPrice2(product, rates);

  if (!rates || rate <= 0) {
    const final = storedFinal(product);
    if (final > 0) return final;

    const raw = storedRaw(product);
    return raw > 0 ? raw : null;
  }

  let price1 = 0;

  if (mode === "fixed") {
    const fixed = storedFinal(product) || storedRaw(product);
    price1 = fixed > 0 ? fixed : 0;
  } else if (mode === "rate_plus") {
    price1 = rate * (1 + percent / 100);
  } else if (mode === "rate_plus_fixed") {
    price1 = rate * (1 + percent / 100) + fixedAdd;
  } else if (mode === "weight_rate") {
    price1 = weightGram * rate;
  } else if (mode === "weight_rate_plus") {
    price1 = weightGram * rate * (1 + percent / 100);
  } else if (mode === "weight_rate_plus_fixed") {
    price1 = weightGram * rate * (1 + percent / 100) + fixedAdd;
  } else {
    const final = storedFinal(product);
    price1 = final > 0 ? final : 0;
  }

  const total = price1 + price2;
  return total > 0 ? total : null;
}

export function resolveProductPriceTRY(product: any, rates: RatesLatest | null) {
  // Sunucu hesapladığı finalPrice her zaman öncelikli (source of truth)
  // Sunucu kuru çekip fiyat hesapladığında bunu Firestore'a yazıyor.
  // Client-side dinamik hesaplama sadece finalPrice yoksa fallback olarak çalışır.
  const savedFinal = storedFinal(product);
  const dyn = computeDynamicPriceTRY(product, rates);

  let finalPrice = savedFinal > 0 ? savedFinal : (dyn ?? storedRaw(product));

  const compareCfg = getCompareAtConfig(product);

  let compareAtPrice: number | null = null;

  // Gerçek indirim sistemi:
  // compareAtPercent > 0 ise orijinal fiyat üstü çizili gösterilir,
  // satış fiyatı %X indirimli olur
  if (compareCfg.enabled && compareCfg.percent > 0 && finalPrice > 0) {
    compareAtPrice = finalPrice; // orijinal fiyat → üstü çizili
    finalPrice = finalPrice * (1 - compareCfg.percent / 100); // gerçek indirim
  }

  return {
    price: finalPrice,
    compareAtPrice,
    isDynamic: dyn != null,
  };
}

export function formatTRY(value: any, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₺0,00";

  const d = Math.max(0, Math.min(8, Math.floor(decimals)));

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}