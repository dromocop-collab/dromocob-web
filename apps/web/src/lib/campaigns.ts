export type CampaignPlacement = "cart" | "checkout" | "product";

export type StoreCampaign = {
  id: string;
  code?: string;
  enabled?: boolean;
  isActive?: boolean;

  title?: { tr?: string; en?: string } | string;
  subtitle?: { tr?: string; en?: string } | string;
  description?: { tr?: string; en?: string } | string;

  type?: "percent" | "fixed" | string;
  value?: number;
kind?: "discount" | "service";
servicePriceTry?: number;
freeOverTry?: number;
requiresCustomerChoice?: boolean;
  discountType?: "percent" | "fixed" | string;
  discountValue?: number;

  minCartTry?: number;
  minCartTotal?: number;

  target?: string;
  placement?: CampaignPlacement[] | string[];

  productIds?: string[];
  categoryIds?: string[];
  categorySlugs?: string[];

  startsAt?: any;
  endsAt?: any;

  order?: number;
  tone?: string;
  theme?: string;

  showInCart?: boolean;
  showInCheckout?: boolean;
  showOnProduct?: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNumber(v: unknown) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function asStringArray(v: any): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => safeStr(x)).filter(Boolean);
  }

  if (typeof v === "string") {
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function hasPlacement(v: any, key: CampaignPlacement) {
  if (Array.isArray(v)) {
    return v.map((x) => safeStr(x).toLowerCase()).includes(key);
  }

  const raw = safeStr(v).toLowerCase();
  if (!raw) return false;

  return raw === key || raw === "all";
}

function parseCampaignDate(v: any): Date | null {
  try {
    if (!v) return null;

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v?.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "string") {
      const s = v.trim();

      const match = s.match(/Timestamp\(seconds=(\d+),\s*nanoseconds=\d+\)/);
      if (match?.[1]) {
        const d = new Date(Number(match[1]) * 1000);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function isCampaignDateActive(c: StoreCampaign) {
  const now = Date.now();

  const start = parseCampaignDate(c.startsAt);
  const end = parseCampaignDate(c.endsAt);

  if (start && start.getTime() > now) return false;
  if (end && end.getTime() < now) return false;

  return true;
}

export function normalizeCampaigns(raw: any): StoreCampaign[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.campaigns)
    ? raw.campaigns
    : Array.isArray(raw?.items)
    ? raw.items
    : raw?.campaigns && typeof raw.campaigns === "object"
    ? Object.values(raw.campaigns)
    : [];

  return source
    .map((x: any): StoreCampaign => {
      const placement = Array.isArray(x?.placement)
        ? x.placement
        : asStringArray(x?.placement);

      const target = safeStr(x?.target || "cart").toLowerCase();

      const discountType = safeStr(x?.discountType || x?.type || "percent").toLowerCase();
      const discountValue = toNumber(x?.discountValue ?? x?.value ?? 0);

      const minCartTotal = toNumber(x?.minCartTotal ?? x?.minCartTry ?? 0);

      const showInCart =
        x?.showInCart === true ||
        hasPlacement(placement, "cart") ||
        target === "cart" ||
        target === "all";

      const showInCheckout =
        x?.showInCheckout === true ||
        hasPlacement(placement, "checkout") ||
        target === "checkout" ||
        target === "cart" ||
        target === "all";

      const showOnProduct =
        x?.showOnProduct === true ||
        hasPlacement(placement, "product") ||
        target === "product" ||
        target === "all";

      return {
        ...x,

        id: safeStr(x?.id || x?.code || `campaign_${Date.now()}`),
        code: safeStr(x?.code || x?.id),

        enabled: x?.enabled !== false,
        isActive: x?.isActive !== false && x?.enabled !== false,

        title: x?.title || { tr: "", en: "" },
        subtitle: x?.subtitle || x?.description || { tr: "", en: "" },
        description: x?.description || x?.subtitle || { tr: "", en: "" },

        type: discountType === "fixed" ? "fixed" : "percent",
        value: discountValue,
kind: String(x.kind || "discount") === "service" ? "service" : "discount",

servicePriceTry: toNumber(x.servicePriceTry ?? x.servicePrice ?? 0),
freeOverTry: toNumber(x.freeOverTry ?? x.freeShippingOverTry ?? 0),

requiresCustomerChoice: x.requiresCustomerChoice === true,
        discountType: discountType === "fixed" ? "fixed" : "percent",
        discountValue,

        minCartTry: minCartTotal,
        minCartTotal,

        target,
        placement,

        productIds: asStringArray(x?.productIds),
        categoryIds: asStringArray(x?.categoryIds),
        categorySlugs: asStringArray(x?.categorySlugs),

        startsAt: x?.startsAt || null,
        endsAt: x?.endsAt || null,

        order: toNumber(x?.order || 999),
        tone: safeStr(x?.tone || x?.theme || "red"),
        theme: safeStr(x?.theme || x?.tone || "red"),

        showInCart,
        showInCheckout,
        showOnProduct,
      };
    })
    .filter((x: StoreCampaign) => {
  if (x.isActive === false || x.enabled === false) return false;
  if (!isCampaignDateActive(x)) return false;

  const kind = safeStr(x.kind || "discount").toLowerCase();

  if (kind === "service") {
    const servicePrice = toNumber(x.servicePriceTry ?? 0);
    const freeOver = toNumber(x.freeOverTry ?? 0);

    return servicePrice >= 0 || freeOver > 0;
  }

  if (toNumber(x.discountValue ?? x.value) <= 0) return false;

  return true;
})
.sort((a: StoreCampaign, b: StoreCampaign) => {
  return toNumber(a.order || 999) - toNumber(b.order || 999);
});}

export function pickCampaignText(v: any, loc: "tr" | "en" = "tr") {
  if (!v) return "";
  if (typeof v === "string") return v;

  const tr = safeStr(v?.tr);
  const en = safeStr(v?.en);

  return loc === "en" ? en || tr : tr || en;
}
export function calcCampaignDiscount(params: {
  campaigns: StoreCampaign[];
  placement: "cart" | "checkout" | "product";
  subtotal: number;
items?: Array<{
  id?: string;
  productId?: string;
  slug?: string;
  qty?: number;
  lineTry?: number;
  resolvedUnitPrice?: number;
  categoryIds?: string[];
  categorySlugs?: string[];
}>;
}) {
  const campaigns = Array.isArray(params.campaigns) ? params.campaigns : [];
  const placement = params.placement;
  const subtotal = Number(params.subtotal || 0);
  const items = Array.isArray(params.items) ? params.items : [];

  let best: {
    campaign: StoreCampaign | null;
    discount: number;
    eligibleSubtotal: number;
  } = {
    campaign: null,
    discount: 0,
    eligibleSubtotal: 0,
  };

  for (const c of campaigns) {
    if (safeStr(c.kind || "discount").toLowerCase() === "service") continue;
    const show =
      placement === "cart"
        ? c.showInCart !== false
        : placement === "checkout"
        ? c.showInCheckout !== false
        : placement === "product"
        ? c.showOnProduct === true
        : true;

    if (!show) continue;

    const minCartTotal = Number(c.minCartTotal ?? c.minCartTry ?? 0);
    if (subtotal < minCartTotal) continue;

    const productIds = Array.isArray(c.productIds) ? c.productIds.map(String) : [];
    const categoryIds = Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : [];
    const categorySlugs = Array.isArray(c.categorySlugs) ? c.categorySlugs.map(String) : [];

    let eligibleSubtotal = subtotal;

    const hasProductTarget = productIds.length > 0;
    const hasCategoryTarget = categoryIds.length > 0 || categorySlugs.length > 0;

    if (hasProductTarget || hasCategoryTarget) {
      eligibleSubtotal = items.reduce((sum: number, item) => {
        const itemId = String(item.id || "");
        const productId = String(item.productId || "");
        const slug = String(item.slug || "");

        const itemCategoryIds = Array.isArray(item.categoryIds)
          ? item.categoryIds.map(String)
          : [];

        const itemCategorySlugs = Array.isArray(item.categorySlugs)
          ? item.categorySlugs.map(String)
          : [];

        const productMatch =
          !hasProductTarget ||
          productIds.includes(itemId) ||
          productIds.includes(productId) ||
          productIds.includes(slug);

        const categoryMatch =
          !hasCategoryTarget ||
          itemCategoryIds.some((x: string) => categoryIds.includes(x)) ||
          itemCategorySlugs.some((x: string) => categorySlugs.includes(x));

        if (productMatch && categoryMatch) {
        const lineTry =
  Number(item.lineTry || 0) ||
  Number(item.resolvedUnitPrice || 0) * Math.max(1, Number(item.qty || 1));

return sum + lineTry;
        }

        return sum;
      }, 0);
    }

    if (eligibleSubtotal <= 0) continue;

    const discountType = String(c.discountType || c.type || "percent");
    const discountValue = Number(c.discountValue ?? c.value ?? 0);

    let discount = 0;

    if (discountType === "fixed") {
      discount = Math.min(discountValue, eligibleSubtotal);
    } else {
      discount = eligibleSubtotal * (discountValue / 100);
    }

    discount = Math.max(0, Math.min(discount, subtotal));

    if (discount > best.discount) {
      best = {
        campaign: c,
        discount,
        eligibleSubtotal,
      };
    }
  }

  return best;
}