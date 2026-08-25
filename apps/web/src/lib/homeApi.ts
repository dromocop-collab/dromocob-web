import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";

/** ----------------------------
 *  Types
 *  ---------------------------- */

export type IText = string | { tr?: string; en?: string } | null | undefined;

export type HeroSlide = {
  id?: string;
  title?:     { tr?: string; en?: string } | string;
  priceLabel?:{ tr?: string; en?: string } | string;
  priceText?: { tr?: string; en?: string } | string;

  primaryLabel?:   { tr?: string; en?: string } | string;
  primaryUrl?: string;

  secondaryLabel?: { tr?: string; en?: string } | string;
  secondaryUrl?: string;

  noteSmall?: { tr?: string; en?: string } | string;
  noteLine1?: { tr?: string; en?: string } | string;
  noteLine2?: { tr?: string; en?: string } | string;

  image?: string;
  sideText?: { tr?: string; en?: string } | string;
};

export type HomeSettings = {
  announcement?: {
    enabled?: boolean;
    text?: { tr?: string; en?: string } | string;
    linkText?: { tr?: string; en?: string } | string;
    linkHref?: string;
  };

  heroSlides?: HeroSlide[];

  featuredTitle?: { tr?: string; en?: string } | string;
  featuredDesc?:  { tr?: string; en?: string } | string;

  promoBanners?: Array<{
    title?: { tr?: string; en?: string } | string;
    href?: string;
    image?: string;
  }>;

  trustBadges?: Array<{
    title?: { tr?: string; en?: string } | string;
    desc?:  { tr?: string; en?: string } | string;
    icon?: string;
  }>;
  social?: SocialCfg;
};

export type Category = {
  id: string;
  name: { tr?: string; en?: string } | string;
  slug: string;
  image?: string;
  order?: number;
  isFeatured?: boolean;
  showOnHome?: boolean;
  parentId?: string | null;
};

export type Product = {
  id: string;
  title: { tr?: string; en?: string } | string;
  slug: string;
  price: number;
  currency: "TRY" | string;
  images: string[];
  isBestseller?: boolean;
  createdAt?: any;
};
export type SocialItem = {
  type: "video" | "image";
  href?: string;
  mediaUrl?: string;   // video url veya büyük görsel
  thumbUrl?: string;   // küçük görsel / poster
  alt?: { tr?: string; en?: string } | string;
};

export type SocialCfg = {
  enabled?: boolean;
  title?: { tr?: string; en?: string } | string;
  subtitle?: { tr?: string; en?: string } | string;
  profileUrl?: string;     // instagram profil linki
  profileText?: { tr?: string; en?: string } | string;       // @...
  items?: SocialItem[];
};
/** ----------------------------
 *  Safe helpers
 *  ---------------------------- */

function asObject(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return Object.values(v as Record<string, T>);
  return [];
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asStringArray(v: unknown): string[] {
  const arr = asArray<unknown>(v);
  return arr.map((x) => toStr(x)).filter(Boolean);
}

function asText(v: unknown): { tr?: string; en?: string } | string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  const o = asObject(v);
  // {tr,en} gibi
  if ("tr" in o || "en" in o) return { tr: toStr(o.tr), en: toStr(o.en) };
  // yanlışlıkla {value:""} geldiyse
  if ("value" in o) return toStr(o.value);
  return toStr(v);
}

/** UI tarafında tek dil string isterse (bazı componentler) */
export function pickText(t: any, loc?: Locale): string {
  const L = loc ?? getLocale();
  if (!t) return "";
  if (typeof t === "string") return t;
  const o = asObject(t);
  const v = L === "en" ? (o.en ?? o.tr) : (o.tr ?? o.en);
  return toStr(v);
}

/** ----------------------------
 *  Normalize
 *  ---------------------------- */

function normalizeHeroSlide(raw: unknown): HeroSlide | null {
  const o = asObject(raw);
  const image = toStr(o.image);
  // title zorunlu diyelim, image de zorunlu
  const title = asText(o.title);
  if (!image || !pickText(title)) return null;

  return {
    id: toStr(o.id) || undefined,
    title,
    priceLabel: asText(o.priceLabel),
    priceText: asText(o.priceText),
    primaryLabel: asText(o.primaryLabel),
    primaryUrl: toStr(o.primaryUrl) || undefined,
    secondaryLabel: asText(o.secondaryLabel),
    secondaryUrl: toStr(o.secondaryUrl) || undefined,
    noteSmall: asText(o.noteSmall),
    noteLine1: asText(o.noteLine1),
    noteLine2: asText(o.noteLine2),
    image,
    sideText: asText(o.sideText),
  };
}

function normalizeHomeSettings(raw: unknown): HomeSettings | null {
  const d = asObject(raw);
  if (!raw || Object.keys(d).length === 0) return null;

  const heroSlides = asArray<any>(d.heroSlides)
    .map(normalizeHeroSlide)
    .filter(Boolean) as HeroSlide[];

  const promoBanners = asArray<any>(d.promoBanners)
    .map((x) => {
      const o = asObject(x);
      return {
        title: asText(o.title),
        href: toStr(o.href),
        image: toStr(o.image),
      };
    })
    .filter((b) => pickText(b.title) && b.href && b.image);

  const trustBadges = asArray<any>(d.trustBadges)
    .map((x) => {
      const o = asObject(x);
      return {
        title: asText(o.title),
        desc: asText(o.desc),
        icon: toStr(o.icon),
      };
    })
    .filter((t) => pickText(t.title) && t.icon);
    const socialRaw = asObject(d.social);

    const socialItems = asArray<any>(socialRaw.items)
      .map((x) => {
        const o = asObject(x);
        const type = (o.type === "video" ? "video" : "image") as "video" | "image";
    
        const href = toStr(o.href).trim();
        const mediaUrl = toStr(o.mediaUrl || o.url || "").trim();
        const thumbUrl = toStr(o.thumbUrl || o.thumb || o.poster || "").trim();
        const alt = asText(o.alt);
    
        if (!mediaUrl && !thumbUrl) return null;
    
        return {
          type,
          ...(href ? { href } : {}),
          ...(mediaUrl ? { mediaUrl } : {}),
          ...(thumbUrl ? { thumbUrl } : {}),
          ...(alt ? { alt } : {}),
        } as SocialItem;
      })
      .filter(Boolean)
      .slice(0, 12) as SocialItem[];
  const announcementRaw = asObject(d.announcement);

  return {
    announcement: d.announcement
      ? {
          enabled: typeof announcementRaw.enabled === "boolean" ? announcementRaw.enabled : true,
          text: asText(announcementRaw.text),
          linkText: asText(announcementRaw.linkText),
          linkHref: toStr(announcementRaw.linkHref) || undefined,
        }
      : undefined,

    heroSlides,

    featuredTitle: asText(d.featuredTitle),
    featuredDesc: asText(d.featuredDesc),

    promoBanners,
    trustBadges,
    social: d.social
    ? {
        enabled: typeof socialRaw.enabled === "boolean" ? socialRaw.enabled : true,
        title: asText(socialRaw.title),
        subtitle: asText(socialRaw.subtitle),
        profileUrl: toStr(socialRaw.profileUrl) || undefined,
  
        // ✅ admin "username" yazdıysa da butonda gösterelim
        profileText: asText(socialRaw.profileText ?? socialRaw.username),
  
        items: socialItems,
      }
    : undefined,
  };
}

function normalizeCategory(id: string, raw: unknown): Category {
  const d = asObject(raw);
  return {
    id,
    name: asText(d.name ?? d.title) ?? "",
    slug: toStr(d.slug),
    image: d.image != null ? toStr(d.image) : undefined,
    order: typeof d.order === "number" ? d.order : undefined,
    isFeatured: typeof d.isFeatured === "boolean" ? d.isFeatured : undefined,
    showOnHome: typeof d.showOnHome === "boolean" ? d.showOnHome : undefined,
    parentId: d.parentId === null || typeof d.parentId === "string" ? d.parentId : undefined,
  };
}

function normalizeProduct(id: string, raw: unknown): Product {
  const d = asObject(raw);

  // images: string[] / map / tek string vb
  const images =
    Array.isArray(d.images) ? asStringArray(d.images) :
    d.imageUrls ? asStringArray(d.imageUrls) :
    typeof d.image === "string" ? [d.image] :
    asStringArray(d.image);

  return {
    id,
    title: asText(d.title ?? d.name) ?? "",
    slug: toStr(d.slug),
    price: typeof d.price === "number" ? d.price : Number(d.price ?? 0),
    currency: toStr(d.currency || "TRY"),
    images,
    isBestseller: typeof d.isBestseller === "boolean" ? d.isBestseller : undefined,
    createdAt: d.createdAt,
  };
}

/** ----------------------------
 *  API
 *  ---------------------------- */

export async function fetchHomeSettings(): Promise<HomeSettings | null> {
  const db = getFirebaseDb();
  const ref = doc(db, "settings", "home");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeHomeSettings(snap.data());
}

export async function fetchFeaturedCategories(n = 8): Promise<Category[]> {
  const db = getFirebaseDb();

  try {
    const qy = query(
      collection(db, "categories"),
      where("showOnHome", "==", true),
      where("isActive", "==", true),
      orderBy("order", "asc"),
      limit(n)
    );
    const snap = await getDocs(qy);
    return snap.docs
      .map((d) => normalizeCategory(d.id, d.data()))
      .filter((c) => c.id && pickText(c.name) && c.slug);
  } catch {
    // index yoksa fallback (daha az garanti ama çalışır)
    const qy2 = query(
      collection(db, "categories"),
      where("showOnHome", "==", true),
      limit(n)
    );
    const snap2 = await getDocs(qy2);
    return snap2.docs
      .map((d) => normalizeCategory(d.id, d.data()))
      .filter((c) => c.id && pickText(c.name) && c.slug)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, n);
  }
}
export async function fetchBestsellers(n = 10): Promise<Product[]> {
  const db = getFirebaseDb();

  // aynı mantık: orderBy index yoksa patlayabilir → fallback
  try {
    const qy = query(
      collection(db, "products"),
      where("isBestseller", "==", true),
      orderBy("createdAt", "desc"),
      limit(n)
    );
    const snap = await getDocs(qy);
    return snap.docs
      .map((d) => normalizeProduct(d.id, d.data()))
      .filter((p) => p.id && pickText(p.title) && p.slug);
  } catch {
    const qy2 = query(
      collection(db, "products"),
      where("isBestseller", "==", true),
      limit(n)
    );
    const snap2 = await getDocs(qy2);
    return snap2.docs
      .map((d) => normalizeProduct(d.id, d.data()))
      .filter((p) => p.id && pickText(p.title) && p.slug);
  }
}