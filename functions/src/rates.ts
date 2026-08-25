import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const DOC_PATH = "rates/latest";

// ---- Params / Secrets ----
const RATES_PROVIDER = defineString("RATES_PROVIDER", { default: "demo" }); // "demo" | "harem"
const RAPIDAPI_KEY = defineSecret("RAPIDAPI_KEY");
const RATES_REFRESH_SECRET = defineSecret("RATES_REFRESH_SECRET");

const RAPIDAPI_HOST = defineString("RAPIDAPI_HOST", {
  default: "harem-altin-live-gold-price-data.p.rapidapi.com",
});

const HAREM_ENDPOINT = defineString("HAREM_ENDPOINT", {
  default: "/harem_altin/prices/CHANGE_ME",
});

type RefreshUnit = "hour" | "day";

type RateItem = {
  code: string;
  name: string;
  buy: number;
  sell: number;
  change?: number | null;
};

function toNum(v: any, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function s(v: any) {
  return String(v ?? "").trim();
}

function intervalToMs(value: any, unit: RefreshUnit = "hour") {
  const n = Math.max(1, Math.floor(toNum(value, 1)));
  return unit === "day"
    ? n * 24 * 60 * 60 * 1000
    : n * 60 * 60 * 1000;
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function isDue(lastRunAt: any, value: any, unit: RefreshUnit = "hour") {
  const last = toDateSafe(lastRunAt);
  if (!last) return true;

  const diff = Date.now() - last.getTime();
  return diff >= intervalToMs(value, unit);
}

// ---------- DEMO provider ----------
async function fetchDemoRates(): Promise<{ provider: string; items: RateItem[] }> {
  return {
    provider: "demo",
    items: [
      { code: "GRAM_ALTIN", name: "Gram Altın", buy: 2520.12, sell: 2538.55, change: 0.42 },
      { code: "ONS", name: "Ons Altın", buy: 2165.2, sell: 2168.7, change: 0.18 },

      { code: "USDTRY", name: "USD/TRY", buy: 32.10, sell: 32.16, change: -0.05 },
      { code: "EURTRY", name: "EUR/TRY", buy: 34.75, sell: 34.85, change: 0.08 },

      { code: "GUMUS_TL", name: "Gümüş TL", buy: 29.40, sell: 29.75, change: 0.31 },
      { code: "GUMUS_USD", name: "Gümüş USD", buy: 24.90, sell: 25.10, change: -0.12 },
      { code: "GUMUS_ONS", name: "Gümüş Ons", buy: 24.90, sell: 25.10, change: -0.12 },

      { code: "14_AYAR", name: "14 Ayar", buy: 1450.0, sell: 1520.0, change: 0.22 },
      { code: "22_AYAR", name: "22 Ayar", buy: 2290.0, sell: 2380.0, change: 0.35 },

      { code: "YENI_CEYREK", name: "Yeni Çeyrek", buy: 4100.0, sell: 4250.0, change: 0.40 },
      { code: "ESKI_CEYREK", name: "Eski Çeyrek", buy: 4020.0, sell: 4170.0, change: 0.38 },

      { code: "YENI_YARIM", name: "Yeni Yarım", buy: 8200.0, sell: 8500.0, change: 0.41 },
      { code: "ESKI_YARIM", name: "Eski Yarım", buy: 8040.0, sell: 8340.0, change: 0.39 },

      { code: "YENI_TAM", name: "Yeni Tam", buy: 16400.0, sell: 17000.0, change: 0.42 },
      { code: "ESKI_TAM", name: "Eski Tam", buy: 16080.0, sell: 16680.0, change: 0.40 },

      { code: "YENI_ATA", name: "Yeni Ata", buy: 16800.0, sell: 17450.0, change: 0.36 },
      { code: "ESKI_ATA", name: "Eski Ata", buy: 16550.0, sell: 17200.0, change: 0.33 },
      { code: "YENI_GREMSE", name: "Yeni Gremse", buy: 41000.0, sell: 42500.0, change: 0.44 },
      { code: "ESKI_GREMSE", name: "Eski Gremse", buy: 40200.0, sell: 41700.0, change: 0.41 },
    ],
  };
}

// ---------- HAREM ----------
function pickList(data: any): any[] | null {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.items,
    data?.data,
    data?.result,
    data?.prices,
    data?.list,
    data?.rows,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length && keys.length < 500) {
      const vals = keys.map((k) => ({ __k: k, ...(data[k] ?? {}) }));
      if (vals.some((v) => v && typeof v === "object")) return vals;
    }
  }

  return null;
}

function normalizeToRateItems(list: any[]): RateItem[] {
  const out: RateItem[] = [];

  for (const x of list) {
    const code = s(
      x?.code ??
      x?.symbol ??
      x?.key ??
      x?.kur ??
      x?.type ??
      x?.id ??
      x?.__k
    );

    const name = s(
      x?.name ??
      x?.title ??
      x?.aciklama ??
      x?.label ??
      x?.text ??
      code
    );

    const buy = toNum(x?.buy ?? x?.alis ?? x?.bid ?? x?.buying ?? x?.purchase, 0);
    const sell = toNum(x?.sell ?? x?.satis ?? x?.ask ?? x?.selling ?? x?.sale, 0);

    const changeRaw = x?.change ?? x?.diff ?? x?.pct ?? x?.percent ?? null;
    const change = changeRaw == null ? null : toNum(changeRaw, 0);

    if (code && name && (buy || sell)) {
      out.push({ code, name, buy, sell, change });
    }
  }

  return out;
}

async function fetchHaremRates(opts: {
  rapidKey: string;
  host?: string;
  endpoint?: string;
}): Promise<{ provider: string; items: RateItem[] }> {
  const host = s(opts.host) || "harem-altin-live-gold-price-data.p.rapidapi.com";
  const defaultPath = "/harem_altin/prices/23b4c2fb31a242d1eebc0df9b9b65e5e";
  const raw = s(opts.endpoint) || defaultPath;

  const url = raw.startsWith("http")
    ? raw
    : `https://${host}${raw.startsWith("/") ? "" : "/"}${raw}`;

  logger.info("Harem fetch", { host, url });

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": opts.rapidKey,
      "x-rapidapi-host": host,
      accept: "application/json",
    },
  });

  logger.info("Harem response received", {
    status: r.status,
    ok: r.ok,
    statusText: r.statusText,
  });

  const text = await r.text().catch(() => "");
  logger.info("Harem raw response", {
    length: text.length,
    preview: text.slice(0, 500),
  });

  if (!r.ok) {
    throw new Error(`Harem fetch failed: ${r.status} ${text}`.slice(0, 500));
  }

  const data = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  })();

  logger.info("Harem parsed keys", {
    keys: data && typeof data === "object" ? Object.keys(data).slice(0, 20) : [],
  });

  const list = pickList(data);
  if (!list) {
    logger.warn("Harem response shape unexpected", { sample: data });
    throw new Error("Harem response shape unexpected.");
  }

  const out = normalizeToRateItems(list);

  logger.info("Harem normalized item count", {
    count: out.length,
  });

  if (!out.length) {
    logger.warn("Harem normalize produced empty items", { sample: data });
    throw new Error("Harem normalize produced empty items.");
  }

  return { provider: "harem", items: out };
}

// ---------- TCMB Döviz Kurları ----------
// NOT: TCMB XML İngilizce format kullanır (46.1320 gibi).
// rates.ts'teki toNum() noktayı binlik ayracı sanıp kaldırıyor,
// bu yüzden burada parseFloat kullanıyoruz.
function parseTcmbNum(raw: string | undefined | null): number {
  if (!raw) return 0;
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) ? n : 0;
}

async function fetchTcmbForexRates(): Promise<RateItem[]> {
  try {
    const url = "https://www.tcmb.gov.tr/kurlar/today.xml";
    const r = await fetch(url, {
      method: "GET",
      headers: { accept: "application/xml" },
    });

    if (!r.ok) {
      logger.warn("TCMB fetch failed", { status: r.status });
      return [];
    }

    const text = await r.text();

    // XML'den USD ve EUR satırlarını regex ile parse et
    const items: RateItem[] = [];

    // USD
    const usdMatch = text.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<\/Currency>/i);
    if (usdMatch) {
      const usdBlock = usdMatch[0];
      const usdBuy = parseTcmbNum(usdBlock.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1]);
      const usdSell = parseTcmbNum(usdBlock.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)?.[1]);
      if (usdSell > 0) {
        items.push({ code: "USDTRY", name: "USD/TRY", buy: usdBuy, sell: usdSell, change: null });
      }
    }

    // EUR
    const eurMatch = text.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<\/Currency>/i);
    if (eurMatch) {
      const eurBlock = eurMatch[0];
      const eurBuy = parseTcmbNum(eurBlock.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1]);
      const eurSell = parseTcmbNum(eurBlock.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)?.[1]);
      if (eurSell > 0) {
        items.push({ code: "EURTRY", name: "EUR/TRY", buy: eurBuy, sell: eurSell, change: null });
      }
    }

    // GBP
    const gbpMatch = text.match(/<Currency[^>]*Kod="GBP"[^>]*>[\s\S]*?<\/Currency>/i);
    if (gbpMatch) {
      const gbpBlock = gbpMatch[0];
      const gbpBuy = parseTcmbNum(gbpBlock.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1]);
      const gbpSell = parseTcmbNum(gbpBlock.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)?.[1]);
      if (gbpSell > 0) {
        items.push({ code: "GBPTRY", name: "GBP/TRY", buy: gbpBuy, sell: gbpSell, change: null });
      }
    }

    logger.info("TCMB forex rates fetched", { count: items.length });
    return items;
  } catch (e: any) {
    logger.warn("TCMB forex fetch error", { message: e?.message || "unknown" });
    return [];
  }
}

// ---------- Provider ----------
async function fetchProviderRates(params: { rapidKey?: string }) {
  const provider = (RATES_PROVIDER.value() || "demo").toLowerCase();

  if (provider === "demo") return fetchDemoRates();

  const key = s(params.rapidKey);
  if (!key) {
    logger.warn("RATES_PROVIDER=harem ama RAPIDAPI_KEY yok -> demo fallback");
    return fetchDemoRates();
  }

  return fetchHaremRates({
    rapidKey: key,
    host: s(RAPIDAPI_HOST.value()),
    endpoint: s(HAREM_ENDPOINT.value()),
  });
}

// ---------- Write latest ----------
async function updateRatesLatest(params: { rapidKey?: string }) {
  const fetchedAtIso = new Date().toISOString();
  const { provider, items } = await fetchProviderRates(params);

  // TCMB'den döviz kurlarını çek ve birleştir
  const forexItems = await fetchTcmbForexRates();
  const existingCodes = new Set(items.map((x) => s(x.code).toUpperCase()));
  const mergedItems = [
    ...items,
    ...forexItems.filter((fx) => !existingCodes.has(fx.code.toUpperCase())),
  ];

  logger.info("Provider result", {
    provider,
    rawCount: Array.isArray(items) ? items.length : 0,
    forexCount: forexItems.length,
    mergedCount: mergedItems.length,
  });

  const normalized = (mergedItems || [])
    .map((x) => ({
      code: s(x.code),
      name: s(x.name),
      buy: toNum(x.buy, 0),
      sell: toNum(x.sell, 0),
      change:
        typeof x.change === "undefined"
          ? null
          : x.change === null
          ? null
          : toNum(x.change, 0),
    }))
    .filter((x) => x.code && x.name);

  const itemsMap: Record<string, any> = {};
  for (const it of normalized) {
    itemsMap[it.code] = {
      buy: it.buy,
      sell: it.sell,
      name: it.name,
      change: it.change,
    };
  }

  logger.info("Writing rates/latest", {
    docPath: DOC_PATH,
    normalizedCount: normalized.length,
  });

  await db.doc(DOC_PATH).set(
    {
      provider,
      fetchedAt: fetchedAtIso,
      fetchedAtTs: FieldValue.serverTimestamp(),
      count: normalized.length,
      items: normalized,
      itemsMap,
    },
    { merge: true }
  );

  logger.info("rates/latest write success", {
    provider,
    normalizedCount: normalized.length,
    fetchedAtIso,
  });

  return { provider, fetchedAt: fetchedAtIso, count: normalized.length };
}

// ---------- Scheduler decision ----------
async function shouldRunRatesUpdate() {
  const rateSettingsSnap = await db.doc("site_options/rate_settings").get();
  const rateSettings = rateSettingsSnap.exists ? rateSettingsSnap.data() || {} : {};

  const globalEnabled = !!rateSettings?.enabled;
  const globalMode = String(rateSettings?.refreshMode || "manual").toLowerCase();
  const globalValue = Math.max(1, Math.floor(toNum(rateSettings?.refreshIntervalValue, 1)));
  const globalUnit: RefreshUnit =
    rateSettings?.refreshIntervalUnit === "day" ? "day" : "hour";
  const globalLastRunAt =
    rateSettings?.lastFetchedAt || rateSettings?.lastRunAt || null;

  if (globalEnabled) {
    if (globalMode !== "auto") {
      return {
        shouldRun: false,
        reason: "global enabled but manual mode",
      };
    }

    if (isDue(globalLastRunAt, globalValue, globalUnit)) {
      return {
        shouldRun: true,
        reason: "global auto due",
      };
    }

    return {
      shouldRun: false,
      reason: "global auto not due yet",
    };
  }

  const catSnap = await db.collection("categories").get();

  let hasAnyDynamicCategory = false;
  let hasAnyDueCategory = false;

  for (const d of catSnap.docs) {
    const data = d.data() || {};
    const pricing = data?.pricing || {};

    const enabled = !!pricing?.enabled;
    const mode = String(pricing?.refreshMode || "manual").toLowerCase();
    const value = Math.max(1, Math.floor(toNum(pricing?.refreshIntervalValue, 1)));
    const unit: RefreshUnit = pricing?.refreshIntervalUnit === "day" ? "day" : "hour";
    const lastAppliedAt = pricing?.lastAppliedAt || null;

    if (!enabled) continue;

    hasAnyDynamicCategory = true;

    if (mode === "auto" && isDue(lastAppliedAt, value, unit)) {
      hasAnyDueCategory = true;
      break;
    }
  }

  if (!hasAnyDynamicCategory) {
    return {
      shouldRun: false,
      reason: "global closed and no dynamic category",
    };
  }

  if (!hasAnyDueCategory) {
    return {
      shouldRun: false,
      reason: "dynamic categories exist but none due",
    };
  }

  return {
    shouldRun: true,
    reason: "category auto due",
  };
}

// ---------- mark timestamps ----------
async function markRatesRunTimestamps() {
  const nowIso = new Date().toISOString();

  await db.doc("site_options/rate_settings").set(
    {
      lastFetchedAt: nowIso,
      lastFetchedAtTs: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const catSnap = await db.collection("categories").get();
  const jobs: Promise<any>[] = [];

  for (const d of catSnap.docs) {
    const data = d.data() || {};
    const pricing = data?.pricing || {};

    if (!pricing?.enabled) continue;
    if (String(pricing?.refreshMode || "manual").toLowerCase() !== "auto") continue;

    jobs.push(
      d.ref.set(
        {
          pricing: {
            ...pricing,
            lastAppliedAt: nowIso,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  }

  await Promise.all(jobs);
}

// ---------- Product pricing helpers ----------

function normKey(k: string) {
  return String(k || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
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

function getRateValueFromLatest(ratesData: any, rateKey: string): number {
  const key = normKey(rateKey || "GRAM_ALTIN");
  const items = ratesData?.items;
  const itemsMap = ratesData?.itemsMap;

  // 1) itemsMap (obje) — en hızlı lookup
  if (itemsMap && typeof itemsMap === "object") {
    const node =
      itemsMap[key] ??
      itemsMap[key.toLowerCase()] ??
      itemsMap[key.replace(/_/g, "")] ??
      itemsMap[key.replace(/_/g, "").toLowerCase()];

    const sell = toNum(node?.sell ?? node?.value ?? node?.satis ?? node ?? 0, 0);
    if (sell > 0) return sell;
  }

  // 2) items (array)
  if (Array.isArray(items)) {
    const row = items.find(
      (x: any) => normKey(x?.code || x?.name || "") === key
    );
    const sell = toNum(row?.sell ?? row?.value ?? row?.satis ?? 0, 0);
    if (sell > 0) return sell;
  }

  // 3) items (obje — legacy format)
  if (items && typeof items === "object" && !Array.isArray(items)) {
    const node =
      items[key] ??
      items[key.toLowerCase()] ??
      items[key.replace(/_/g, "")] ??
      items[key.replace(/_/g, "").toLowerCase()];

    const sell = toNum(node?.sell ?? node?.value ?? node?.satis ?? node ?? 0, 0);
    if (sell > 0) return sell;
  }

  return 0;
}

function calcFinalPrice(product: any, rate: number, pricing: any): number {
  const mode = String(product?.priceMode ?? "fixed").toLowerCase();

  const percent = Math.max(
    0,
    toNum(pricing?.pricePercent ?? product?.pricePercent ?? 0, 0)
  );

  const fixedAdd = Math.max(
    0,
    toNum(pricing?.priceFixedAdd ?? product?.priceFixedAdd ?? 0, 0)
  );

  // Override kontrolü
  const overrideEnabled =
    product?.priceOverrideEnabled === true ||
    String(product?.priceOverrideEnabled ?? "").toLowerCase() === "true";

  const override = toNum(product?.priceOverride ?? 0, 0);
  if (overrideEnabled && override > 0) return override;

  // Birinci motor
  let price1 = 0;

  if (mode === "fixed") {
    price1 = toNum(product?.price ?? product?.finalPrice ?? 0, 0);
  } else if (rate <= 0) {
    price1 = toNum(product?.finalPrice ?? product?.price ?? 0, 0);
  } else {
    const weight = getWeight(product);

    if (mode === "rate_plus") price1 = rate * (1 + percent / 100);
    else if (mode === "rate_plus_fixed") price1 = rate * (1 + percent / 100) + fixedAdd;
    else if (mode === "weight_rate") price1 = weight * rate;
    else if (mode === "weight_rate_plus") price1 = weight * rate * (1 + percent / 100);
    else if (mode === "weight_rate_plus_fixed") price1 = weight * rate * (1 + percent / 100) + fixedAdd;
    else price1 = toNum(product?.finalPrice ?? product?.price ?? 0, 0);
  }

  return price1;
}

// İkinci fiyat motoru (price2) hesabı
function calcPrice2(product: any, ratesData: any): number {
  if (!product?.price2Enabled) return 0;

  const mode2 = String(product?.price2Mode ?? "fixed").toLowerCase();
  const rateKey2 = String(product?.price2RateCode ?? "").trim();
  const hasGram2 = Math.max(0, toNum(product?.price2HasGram ?? 0, 0));
  const percent2 = Math.max(0, toNum(product?.price2Percent ?? 0, 0));
  const fixedAdd2 = Math.max(0, toNum(product?.price2FixedAdd ?? 0, 0));

  if (mode2 === "fixed") return 0;

  const rate2 = getRateValueFromLatest(ratesData, rateKey2);
  if (rate2 <= 0) return 0;

  if (mode2 === "rate_plus") return rate2 * (1 + percent2 / 100);
  if (mode2 === "rate_plus_fixed") return rate2 * (1 + percent2 / 100) + fixedAdd2;
  if (mode2 === "weight_rate") return hasGram2 * rate2;
  if (mode2 === "weight_rate_plus") return hasGram2 * rate2 * (1 + percent2 / 100);
  if (mode2 === "weight_rate_plus_fixed") return hasGram2 * rate2 * (1 + percent2 / 100) + fixedAdd2;

  return 0;
}

async function findProductsByCategoryId(
  categoryId: string,
  categorySlug: string
) {
  const found = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  // 1) categoryIds array-contains
  if (categoryId) {
    const snap1 = await db
      .collection("products")
      .where("categoryIds", "array-contains", categoryId)
      .get();
    snap1.docs.forEach((d) => found.set(d.id, d));
  }

  // 2) categoryId ==
  if (categoryId) {
    const snap2 = await db
      .collection("products")
      .where("categoryId", "==", categoryId)
      .get();
    snap2.docs.forEach((d) => found.set(d.id, d));
  }

  // 3) categorySlugs array-contains
  if (categorySlug) {
    const snap3 = await db
      .collection("products")
      .where("categorySlugs", "array-contains", categorySlug)
      .get();
    snap3.docs.forEach((d) => found.set(d.id, d));
  }

  return Array.from(found.values());
}

/**
 * Kur güncellendikten sonra tüm dinamik fiyatlı kategorilerdeki
 * ürünlerin finalPrice alanını yeniden hesaplar.
 *
 * Sadece finalPrice, finalCurrency ve updatedAt günceller.
 * Admin ayarlarına (pricePercent, priceFixedAdd vb.) dokunmaz.
 */
async function applyPricingToAllDynamicProducts() {
  const ratesSnap = await db.doc(DOC_PATH).get();
  const ratesLatest = ratesSnap.exists ? ratesSnap.data() : null;

  if (!ratesLatest) {
    logger.warn("applyPricingToAllDynamicProducts: no rates data");
    return { updated: 0, reason: "no_rates_data" };
  }

  const catSnap = await db.collection("categories").get();
  let totalUpdated = 0;
  const errors: string[] = [];
  // Ürün tekrarını önle — aynı ürün birden fazla kategoride olabilir
  const processedIds = new Set<string>();

  for (const catDoc of catSnap.docs) {
    const catData = catDoc.data() || {};
    const pricing = catData?.pricing || {};

    // Sadece enabled olan kategorileri işle
    if (!pricing?.enabled) continue;

    const categoryId = catDoc.id;
    const categorySlug = String(catData?.slug || "")
      .trim()
      .toLowerCase();

    try {
      const products = await findProductsByCategoryId(
        categoryId,
        categorySlug
      );

      // Zaten işlenen ürünleri atla
      const newProducts = products.filter((d) => !processedIds.has(d.id));

      if (!newProducts.length) {
        logger.info(
          `applyPricing: category ${categoryId} (${categorySlug}): no new products (${products.length} already processed)`
        );
        continue;
      }

      // Batch write — Firestore max 500/batch
      const BATCH_SIZE = 400;
      for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = newProducts.slice(i, i + BATCH_SIZE);

        for (const prodDoc of chunk) {
          processedIds.add(prodDoc.id);
          const product = prodDoc.data();
          const rateKey = String(
            product?.priceRateCode || product?.rateKey || "GRAM_ALTIN"
          ).trim();

          const rate = getRateValueFromLatest(ratesLatest, rateKey);
          const price1 = calcFinalPrice(product, rate, pricing);
          const price2 = calcPrice2(product, ratesLatest);
          const finalPrice = price1 + price2;

          // Sadece fiyat güncelle, admin ayarlarına dokunma
          const oldFinal = toNum(product?.finalPrice ?? 0, 0);
          batch.update(prodDoc.ref, {
            finalPrice: Number(finalPrice || 0),
            finalCurrency: "TRY",
            ...(oldFinal > 0 ? { previousFinalPrice: oldFinal } : {}),
            lastPriceAppliedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        totalUpdated += chunk.length;
      }

      logger.info(
        `applyPricing: category ${categoryId}: ${newProducts.length} products updated (${products.length - newProducts.length} skipped)`
      );
    } catch (catErr: any) {
      const msg = `applyPricing: category ${categoryId} error: ${
        catErr?.message || "unknown"
      }`;
      logger.error(msg);
      errors.push(msg);
      // Bir kategoride hata olursa diğerlerine devam et
    }
  }

  logger.info("applyPricingToAllDynamicProducts complete", {
    totalUpdated,
    processedUniqueProducts: processedIds.size,
    errorCount: errors.length,
  });

  return { updated: totalUpdated, errors };
}

// ---------- HTTP trigger ----------
export const updateRatesHttp = onRequest(
  {
    region: "europe-west1",
    cors: true,
    secrets: [RAPIDAPI_KEY, RATES_REFRESH_SECRET],
  },
  async (req, res) => {
    try {
      if (req.method !== "POST" && req.method !== "GET") {
        res.status(405).json({ ok: false, error: "POST/GET only" });
        return;
      }

      const got = String(req.header("x-refresh-secret") || "");

      logger.info("updateRatesHttp request", {
        method: req.method,
        hasRefreshSecretHeader: !!got,
        provider: RATES_PROVIDER.value(),
        hasRapidApiKey: !!RAPIDAPI_KEY.value(),
        rapidApiHost: RAPIDAPI_HOST.value(),
        haremEndpoint: HAREM_ENDPOINT.value(),
      });

      if (!got || got !== RATES_REFRESH_SECRET.value()) {
        logger.warn("updateRatesHttp unauthorized", {
          hasRefreshSecretHeader: !!got,
        });

        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }

      const rapidKey = RAPIDAPI_KEY.value();

      logger.info("updateRatesHttp authorized, starting update", {
        provider: RATES_PROVIDER.value(),
        hasRapidApiKey: !!rapidKey,
      });

      const result = await updateRatesLatest({ rapidKey });
      await markRatesRunTimestamps();

      // Ürün fiyatlarını da güncelle
      const pricingResult = await applyPricingToAllDynamicProducts();
      logger.info("updateRatesHttp pricing applied", pricingResult);

      logger.info("updateRatesHttp success", result);

      res.status(200).json({
        ok: true,
        ...result,
        productsUpdated: pricingResult.updated,
      });
    } catch (e: any) {
      logger.error("updateRatesHttp error", {
        message: e?.message || "unknown",
        stack: e?.stack || "",
      });

      res.status(500).json({ ok: false, error: e?.message || "unknown" });
    }
  }
);

// ---------- Scheduler ----------
export const updateRatesScheduler = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 5 minutes",
    timeZone: "Europe/Istanbul",
    secrets: [RAPIDAPI_KEY],
  },
  async () => {
    try {
      const decision = await shouldRunRatesUpdate();

      logger.info("updateRatesScheduler decision", decision);

      if (!decision.shouldRun) return;

      if ((RATES_PROVIDER.value() || "demo").toLowerCase() === "demo") {
        logger.info("Scheduler skipped: provider is demo");
        return;
      }

      const rapidKey = RAPIDAPI_KEY.value();
      const result = await updateRatesLatest({ rapidKey });

      await markRatesRunTimestamps();

      // Ürün fiyatlarını da güncelle
      const pricingResult = await applyPricingToAllDynamicProducts();
      logger.info("updateRatesScheduler pricing applied", pricingResult);

      logger.info("updateRatesScheduler ok", result);
    } catch (e: any) {
      logger.error("updateRatesScheduler error", {
        message: e?.message || "unknown",
        stack: e?.stack || "",
      });
    }
  }
);