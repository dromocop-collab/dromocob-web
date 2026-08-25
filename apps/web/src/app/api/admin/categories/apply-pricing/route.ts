import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase.admin";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CategoryPricing = {
  enabled: boolean;
  pricePercent?: number;
  priceFixedAdd?: number;
  compareAtPercent?: number;
  refreshMode?: "auto" | "manual";
  refreshIntervalValue?: number;
  refreshIntervalUnit?: "hour" | "day";
  cartCountdownEnabled?: boolean;
  lastAppliedAt?: any;

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
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function normalizeSlug(v: any) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getRateValueTRY(ratesLatest: any, rateKey: string): number {
  const key = normKey(rateKey || "GRAM_ALTIN");
  const items = ratesLatest?.items;
  const itemsMap = ratesLatest?.itemsMap;

  if (itemsMap && typeof itemsMap === "object") {
    const node =
      itemsMap[key] ??
      itemsMap[key.toLowerCase?.()] ??
      itemsMap[key.replace(/_/g, "")] ??
      itemsMap[key.replace(/_/g, "").toLowerCase?.()];

    const sell = toNum(node?.sell ?? node?.value ?? node?.satis ?? node ?? 0, 0);
    if (sell > 0) return sell;
  }

  if (Array.isArray(items)) {
    const row = items.find((x: any) => normKey(x?.code || x?.name || "") === key);
    const sell = toNum(row?.sell ?? row?.value ?? row?.satis ?? 0, 0);
    if (sell > 0) return sell;
  }

  if (items && typeof items === "object" && !Array.isArray(items)) {
    const node =
      items[key] ??
      items[key.toLowerCase?.()] ??
      items[key.replace(/_/g, "")] ??
      items[key.replace(/_/g, "").toLowerCase?.()];

    const sell = toNum(node?.sell ?? node?.value ?? node?.satis ?? node ?? 0, 0);
    if (sell > 0) return sell;
  }

  return 0;
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

function calcFinalPrice(product: any, rate: number, pricing: CategoryPricing | null) {
  const mode = String(product?.priceMode ?? "fixed").toLowerCase();

  const percent = Math.max(
    0,
    toNum(pricing?.pricePercent ?? product?.pricePercent ?? 0, 0)
  );

  const fixedAdd = Math.max(
    0,
    toNum(pricing?.priceFixedAdd ?? product?.priceFixedAdd ?? 0, 0)
  );

  const overrideEnabled =
    product?.priceOverrideEnabled === true ||
    String(product?.priceOverrideEnabled ?? "").toLowerCase() === "true";

  const override = toNum(product?.priceOverride ?? 0, 0);
  if (overrideEnabled && override > 0) return override;

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
function calcPrice2(product: any, ratesLatest: any): number {
  if (!product?.price2Enabled) return 0;

  const mode2 = String(product?.price2Mode ?? "fixed").toLowerCase();
  const rateKey2 = String(product?.price2RateCode ?? "").trim();
  const hasGram2 = Math.max(0, toNum(product?.price2HasGram ?? 0, 0));
  const percent2 = Math.max(0, toNum(product?.price2Percent ?? 0, 0));
  const fixedAdd2 = Math.max(0, toNum(product?.price2FixedAdd ?? 0, 0));

  if (mode2 === "fixed") return 0;

  const rate2 = getRateValueTRY(ratesLatest, rateKey2);
  if (rate2 <= 0) return 0;

  if (mode2 === "rate_plus") return rate2 * (1 + percent2 / 100);
  if (mode2 === "rate_plus_fixed") return rate2 * (1 + percent2 / 100) + fixedAdd2;
  if (mode2 === "weight_rate") return hasGram2 * rate2;
  if (mode2 === "weight_rate_plus") return hasGram2 * rate2 * (1 + percent2 / 100);
  if (mode2 === "weight_rate_plus_fixed") return hasGram2 * rate2 * (1 + percent2 / 100) + fixedAdd2;

  return 0;
}

function buildResolvedCategoryPricing(pricing: CategoryPricing | null) {
  if (!pricing) return null;

  const base: any = {
    enabled: !!pricing.enabled,
    pricePercent: Number(pricing.pricePercent || 0),
    priceFixedAdd: Number(pricing.priceFixedAdd || 0),
    compareAtPercent: Number(pricing.compareAtPercent || 0),
    refreshMode: pricing.refreshMode === "auto" ? "auto" : "manual",
    cartCountdownEnabled: pricing.cartCountdownEnabled === true,
    lastAppliedAt: FieldValue.serverTimestamp(),
  };

  if (base.refreshMode === "auto") {
    base.refreshIntervalValue = Math.max(1, Number(pricing.refreshIntervalValue || 1));
    base.refreshIntervalUnit = pricing.refreshIntervalUnit === "day" ? "day" : "hour";
  }

  return base;
}
async function findProductsByCategory(db: FirebaseFirestore.Firestore, categoryId: string, categorySlug: string) {
  const found = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  // 1) categoryIds array-contains
  if (categoryId) {
    const snap1 = await db
      .collection("products")
      .where("categoryIds", "array-contains", categoryId)
      .get();

    snap1.docs.forEach((d) => found.set(d.id, d));
  }

  // 2) categoryId == categoryId
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

  // 4) Son fallback: küçük dataset için memory filter
  if (found.size === 0) {
    const allSnap = await db.collection("products").get();

    allSnap.docs.forEach((d) => {
      const x = d.data();

      const ids = Array.isArray(x?.categoryIds) ? x.categoryIds.map(String) : [];
      const singleId = String(x?.categoryId || "").trim();

      const slugs = Array.isArray(x?.categorySlugs)
        ? x.categorySlugs.map((v: any) => normalizeSlug(v))
        : [];

      const singleSlug = normalizeSlug(x?.categorySlug || "");
      const targetSlug = normalizeSlug(categorySlug);

      const hit =
        (categoryId && ids.includes(categoryId)) ||
        (categoryId && singleId === categoryId) ||
        (targetSlug && slugs.includes(targetSlug)) ||
        (targetSlug && singleSlug === targetSlug);

      if (hit) found.set(d.id, d);
    });
  }

  return Array.from(found.values());
}

export async function POST(req: NextRequest) {
  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const body = await req.json();

    const categoryId = String(body?.categoryId || "").trim();
    const categorySlug = normalizeSlug(body?.categorySlug || "");
    const pricing = (body?.pricing || null) as CategoryPricing | null;

    if (!categoryId && !categorySlug) {
      return NextResponse.json(
        { ok: false, error: "categoryId veya categorySlug gerekli" },
        { status: 400 }
      );
    }

    const db = adminDb();

    const ratesDoc = await db.collection("rates").doc("latest").get();
    const ratesLatest = ratesDoc.exists ? ratesDoc.data() : null;

    const matchedDocs = await findProductsByCategory(db, categoryId, categorySlug);
    if (categoryId) {
      const categoryPatch: any = {
        compareAtPercent: Number(pricing?.compareAtPercent || 0),
        compareAtEnabled: Number(pricing?.compareAtPercent || 0) > 0,
        pricing: {
          ...(pricing || {}),
          enabled: !!pricing?.enabled,
          compareAtPercent: Number(pricing?.compareAtPercent || 0),
          compareAtEnabled: Number(pricing?.compareAtPercent || 0) > 0,
          pricePercent: Number(pricing?.pricePercent || 0),
          priceFixedAdd: Number(pricing?.priceFixedAdd || 0),
          refreshMode: pricing?.refreshMode === "auto" ? "auto" : "manual",
          lastAppliedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.collection("categories").doc(categoryId).set(categoryPatch, { merge: true });
    }
    let updated = 0;

    for (const d of matchedDocs) {
      const product = d.data();

      const productRateKey = String(
        product?.priceRateCode ||
        product?.rateKey ||
        "GRAM_ALTIN"
      ).trim();

      const rate = getRateValueTRY(ratesLatest, productRateKey);

      const rawFinalPrice = pricing?.enabled
        ? calcFinalPrice(product, rate, pricing) + calcPrice2(product, ratesLatest)
        : toNum(product?.price ?? product?.finalPrice ?? 0, 0);

      const oldFinal = toNum(product?.finalPrice ?? 0, 0);

      // Gerçek indirim: compareAtPercent > 0 ise indirimli fiyat hesapla
      const compareAtPct = Math.max(0, Number(pricing?.compareAtPercent || 0));
      const hasDiscount = compareAtPct > 0 && rawFinalPrice > 0;
      const finalPrice = hasDiscount
        ? rawFinalPrice * (1 - compareAtPct / 100)
        : rawFinalPrice;
      const oldPriceTry = hasDiscount ? rawFinalPrice : 0;

      await d.ref.update({
        categoryPricingEnabled: !!pricing?.enabled,
        categoryPricing: buildResolvedCategoryPricing(pricing),
        resolvedCategoryPricing: buildResolvedCategoryPricing(pricing),

        categoryCartCountdownEnabled: pricing?.cartCountdownEnabled === true,

        pricePercent: Number(product?.pricePercent ?? 0),
        priceFixedAdd: Number(product?.priceFixedAdd ?? 0),

        categoryPricePercent: Number(pricing?.pricePercent || 0),
        categoryPriceFixedAdd: Number(pricing?.priceFixedAdd || 0),
        compareAtPercent: Number(pricing?.compareAtPercent || 0),

        finalPrice: Number(finalPrice || 0),
        oldPriceTry: Number(oldPriceTry || 0),
        finalCurrency: "TRY",
        ...(oldFinal > 0 ? { previousFinalPrice: oldFinal } : {}),
        lastPriceAppliedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      updated++;
    }

    return NextResponse.json({
      ok: true,
      updated,
      debug: {
        envHost: process.env.FIRESTORE_EMULATOR_HOST || null,
        projectId:
          process.env.GCLOUD_PROJECT ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
          "dromocob-demo",
        categoryId,
        categorySlug,
        matchedCount: matchedDocs.length,
        matchedIds: matchedDocs.map((d) => d.id),
      },
    });
  } catch (e: any) {
    console.error("apply-pricing route error:", e);

    return NextResponse.json(
      { ok: false, error: e?.message || "apply-pricing hatası" },
      { status: 500 }
    );
  }
}