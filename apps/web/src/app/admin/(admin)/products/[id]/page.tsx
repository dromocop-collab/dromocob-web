"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";

import { getDocById, removeDoc, upsertDoc } from "@/lib/adminApi";
import { getFirebaseDb } from "@/lib/firebase.client";
import { uploadProductImage } from "@/lib/uploadProductImage";
import CategoryPicker from "@/components/admin/CategoryPicker";
import IconPackPicker from "@/components/admin/ui/IconPackPicker";

import s from "./productEdit.module.css";

function str(v: any) {
  return String(v ?? "").trim();
}

function toPathSafe(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fmt(n: number) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function pickTextLocal(t: any, loc: "tr" | "en" = "tr") {
  if (!t) return "";
  if (typeof t === "string") return t;
  const tr = String(t?.tr ?? "").trim();
  const en = String(t?.en ?? "").trim();
  return (loc === "en" ? en || tr : tr || en) || "";
}
const FALLBACK_PRODUCT_LOGO = "/dromocob-mark.svg";
const PINNED_RATE_KEYS = [

  "HAS_ALTIN",

  "USDTRY",

  "GRAM_ALTIN",

  "EURTRY",

  "YENI_CEYREK",

  "ESKI_CEYREK",

  "YENI_TAM",

  "ESKI_TAM",

  "YENI_YARIM",

  "ESKI_YARIM",

  "YENI_ATA",

  "ESKI_ATA",

] as const;

const DETAIL_ICON_OPTIONS = [
  { value: "", label: "İkon yok" },
  { value: "ruler", label: "Cetvel / Ölçü" },
  { value: "palette", label: "Renk / Palet" },
  { value: "gem", label: "Taş / Gem" },
  { value: "ring", label: "Yüzük" },
  { value: "shield", label: "Güvence / Kalkan" },
  { value: "truck", label: "Kargo" },
  { value: "refresh", label: "Yenileme / Değişim" },
  { value: "star", label: "Yıldız" },
  { value: "heart", label: "Kalp" },
  { value: "sparkles", label: "Parıltı" },
  { value: "badge", label: "Rozet" },
  { value: "layers", label: "Katman" },
  { value: "link", label: "Bağlantı" },
  { value: "circle", label: "Daire" },
  { value: "square", label: "Kare" },
  { value: "flower", label: "Çiçek" },
  { value: "baby", label: "Bebek / Çocuk" },
  { value: "lock", label: "Kilit" },
  { value: "clock", label: "Saat / Süre" },
  { value: "weight", label: "Ağırlık" },
] as const;
const DIAMOND_METAL_TYPES = [
  { value: "", label: "Seçiniz" },
  { value: "gold", label: "Altın" },
  { value: "platinum", label: "Platin" },
  { value: "silver", label: "Gümüş" },
  { value: "other", label: "Diğer" },
];

const DIAMOND_METAL_COLORS = [
  { value: "", label: "Seçiniz" },
  { value: "white", label: "Beyaz" },
  { value: "yellow", label: "Sarı" },
  { value: "rose", label: "Rose" },
  { value: "mixed", label: "Mix / Çok Renkli" },
];

const DIAMOND_ORIGIN_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "natural", label: "Doğal Pırlanta" },
  { value: "lab_grown", label: "Lab Grown Pırlanta" },
  { value: "mixed", label: "Karışık" },
];

const STONE_ORIGIN_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "natural", label: "Doğal" },
  { value: "lab_grown", label: "Lab Grown" },
];

const DIAMOND_STONE_TYPES = [
  { value: "", label: "Taş seçiniz" },
  { value: "diamond", label: "Pırlanta / Diamond" },
  { value: "lab_diamond", label: "Lab Grown Diamond" },
  { value: "sapphire", label: "Safir" },
  { value: "ruby", label: "Yakut" },
  { value: "emerald", label: "Zümrüt" },
  { value: "zircon", label: "Zirkon" },
  { value: "moissanite", label: "Moissanite" },
  { value: "topaz", label: "Topaz" },
  { value: "amethyst", label: "Ametist" },
  { value: "aquamarine", label: "Akuamarin" },
  { value: "pearl", label: "İnci" },
  { value: "other", label: "Diğer" },
];

const DIAMOND_CUT_OPTIONS = [
  { value: "", label: "Kesim seçiniz" },
  { value: "round", label: "Round / Yuvarlak" },
  { value: "princess", label: "Princess" },
  { value: "oval", label: "Oval" },
  { value: "emerald", label: "Emerald" },
  { value: "pear", label: "Pear / Damla" },
  { value: "marquise", label: "Marquise" },
  { value: "cushion", label: "Cushion" },
  { value: "radiant", label: "Radiant" },
  { value: "asscher", label: "Asscher" },
  { value: "heart", label: "Heart / Kalp" },
  { value: "baguette", label: "Baget" },
  { value: "trillion", label: "Trillion" },
  { value: "other", label: "Diğer" },
];

const DIAMOND_COLOR_OPTIONS = [
  { value: "", label: "Renk seçiniz" },
  ..."DEFGHIJKLMNOPQRSTUVWXYZ".split("").map((x) => ({
    value: x,
    label: x,
  })),
  { value: "fancy", label: "Fancy Color" },
];

const DIAMOND_CLARITY_OPTIONS = [
  { value: "", label: "Berraklık seçiniz" },
  { value: "FL", label: "FL — Flawless" },
  { value: "IF", label: "IF — Internally Flawless" },
  { value: "VVS1", label: "VVS1" },
  { value: "VVS2", label: "VVS2" },
  { value: "VS1", label: "VS1" },
  { value: "VS2", label: "VS2" },
  { value: "SI1", label: "SI1" },
  { value: "SI2", label: "SI2" },
  { value: "I1", label: "I1" },
  { value: "I2", label: "I2" },
  { value: "I3", label: "I3" },
];

const DIAMOND_GRADE_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const DIAMOND_FLUORESCENCE_OPTIONS = [
  { value: "", label: "Seçiniz" },
  { value: "none", label: "None / Yok" },
  { value: "faint", label: "Faint" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
  { value: "very_strong", label: "Very Strong" },
];

const DIAMOND_CERTIFICATE_LABS = [
  { value: "", label: "Sertifika seçiniz" },
  { value: "GIA", label: "GIA" },
  { value: "IGI", label: "IGI" },
  { value: "HRD", label: "HRD Antwerp" },
  { value: "AGS", label: "AGS" },
  { value: "GRS", label: "GRS" },
  { value: "LOCAL", label: "Firma / Yerel Sertifika" },
  { value: "OTHER", label: "Diğer" },
];

const DIAMOND_SETTING_TYPES = [
  { value: "", label: "Montür seçiniz" },
  { value: "prong", label: "Prong / Tırnak" },
  { value: "bezel", label: "Bezel / Sıvama" },
  { value: "pave", label: "Pavé" },
  { value: "channel", label: "Channel" },
  { value: "halo", label: "Halo" },
  { value: "tension", label: "Tension" },
  { value: "flush", label: "Flush" },
  { value: "cluster", label: "Cluster" },
  { value: "other", label: "Diğer" },
];
const VARIANT_DISPLAY_TYPES: Array<{
  value: VariantGroup["type"];
  label: string;
}> = [
    { value: "select", label: "Select / Açılır Liste" },
    { value: "radio", label: "Radio Button" },
    { value: "button", label: "Buton Liste" },
    { value: "pill", label: "Pill / Premium Rozet" },
    { value: "swatch", label: "Renk Kutusu / Swatch" },
    { value: "grid", label: "Grid Kartlar" },
    { value: "card", label: "Açıklamalı Kart" },
  ];
type RateItem = {
  code: string;
  name?: string;
  buy?: number;
  sell?: number;
  change?: number;
};

type RatesLatestDoc = {
  fetchedAt?: string;
  count?: number;
  items?: RateItem[];
  provider?: string;
};

type PriceMode =
  | "fixed"
  | "rate_plus"
  | "rate_plus_fixed"
  | "weight_rate"
  | "weight_rate_plus"
  | "weight_rate_plus_fixed";

type ProductForm = {
  title: string;
  slug: string;
  sku: string;
  price: number;
  currency: string;
  images: string[];
  stock: number;
  stockAlarm: number;
  karat: number;
  gram: number;
  hasGram: number;

  categoryIds: string[];

  homeSections: string[];

  productVariantPreset?: CategoryVariantPreset | null;

  isActive: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  compareAtOverrideEnabled: boolean;
  compareAtEnabled: boolean;
  compareAtPercent: number;

  priceMode: PriceMode;
  priceRateCode: string;
  pricePercent: number;
  priceFixedAdd: number;

  // ── İkinci Fiyat Motoru ──
  price2Enabled: boolean;
  price2Mode: PriceMode;
  price2RateCode: string;
  price2HasGram: number;
  price2Percent: number;
  price2FixedAdd: number;

  priceOverrideEnabled: boolean;
  priceOverride: number;

  finalPrice?: number;
  finalCurrency?: string;
  badgeIconUrl: string;
  badgeIconAlt?: any;
  fallbackImageUrl?: string;
  showcaseEnabled: boolean;
  showcaseGroups: string[];
  showcaseOrder: number;
  setBundleEnabled: boolean;
  setBundleTitle: any;
  setBundleSubtitle: any;
  setBundleProductIds: string[];
  setBundleDiscountType: "none" | "fixed" | "percent";
  setBundleDiscountValue: number;
  advanced?: {
    description?: { tr?: string; en?: string };
    shortDescription?: { tr?: string; en?: string };
    colors?: Array<{ name: string; hex?: string }>;
    sizes?: string[];
    tags?: string[];
    galleryVideos?: string[];
    hasSizeOptions?: boolean;
    diamond?: {
      enabled?: boolean;

      // Metal / Montür
      metalColor?: "white" | "yellow" | "rose" | "mixed" | "";
      metalType?: "gold" | "platinum" | "silver" | "other" | "";
      metalKarat?: number;
      handmade?: boolean;
      settingType?: string;

      // Genel taş bilgileri
      diamondOrigin?: "natural" | "lab_grown" | "mixed" | "";
      totalCarat?: number;
      centerStoneCarat?: number;
      totalStoneQuantity?: number;

      // Sertifika
      certificateLab?: string;
      certificateNumber?: string;
      certificateUrl?: string;
      certificateNote?: string;

      // Kalite
      fluorescence?: string;
      polish?: string;
      symmetry?: string;
      treatment?: string;
      origin?: string;

      stoneGroups?: Array<{
        id?: string;

        stoneType?: string;
        diamondOrigin?: "natural" | "lab_grown" | "";

        weightCt?: number;
        quantity?: number;

        color?: string;
        clarity?: string;
        cut?: string;

        fluorescence?: string;
        polish?: string;
        symmetry?: string;

        treatment?: string;
        origin?: string;

        certificateLab?: string;
        certificateNumber?: string;
      }>;
    };
    detailRows?: Array<{
      id?: string;
      label?: { tr?: string; en?: string };
      value?: { tr?: string; en?: string };
      icon?: string;
    }>;

    specs?: {
      weightGr?: number;
      widthMm?: number;
      lengthMm?: number;
      heightMm?: number;
    };
    shipping?: {
      fastShipping?: boolean;
      shippingDaysMin?: number;
      shippingDaysMax?: number;
      cargoNote?: string;
    };
    returns?: {
      title?: { tr?: string; en?: string };
      content?: { tr?: string; en?: string };
    };
    seo?: {
      title?: { tr?: string; en?: string };
      description?: { tr?: string; en?: string };
      keywords?: string[];
      ogImage?: string;
      canonical?: string;
    };
  };
};
type LocaleText = {
  tr?: string;
  en?: string;
};

type VariantOption = {
  value: string;
  label: LocaleText;
  hasGram?: number;
  weightGram?: number;
  priceDelta?: number;
  stockDelta?: number;
  isActive?: boolean;
  order?: number;
};

type VariantGroup = {
  id: string;
  label: LocaleText;
  type:
  | "select"
  | "button"
  | "radio"
  | "pill"
  | "swatch"
  | "grid"
  | "card";
  required: boolean;
  options: VariantOption[];
};

type CategoryVariantPreset = {
  enabled: boolean;
  groups: VariantGroup[];
};
type CategoryDoc = {
  id: string;
  name: any;
  slug: string;
  parentId?: string | null;
  order?: number;
  isActive?: boolean;
  image?: string;
  pricing?: {
    enabled?: boolean;
    rateKey?: string;
    refreshMode?: "auto" | "manual";
    pricePercent?: number;
    priceFixedAdd?: number;
    compareAtEnabled?: boolean;
    compareAtPercent?: number;
  } | null;
};

type PopularTab = {
  key: string;
  label?: any;
};

export default function AdminProductEdit({ params }: { params: { id: string } }) {
  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);
  const id = decodeURIComponent(params.id);
  const isNew = id === "new";

  const fileRef = useRef<HTMLInputElement | null>(null);
  const tabs = [
    { key: "basic", label: "Temel", icon: "📋" },
    { key: "pricing", label: "Fiyat Motoru", icon: "💰" },
    { key: "media", label: "Görseller", icon: "📸" },
    { key: "diamond", label: "Pırlanta", icon: "💎" },
    { key: "categories", label: "Kategoriler", icon: "📂" },
    { key: "variants", label: "Ölçü / Varyant", icon: "📐" },
    { key: "home", label: "Anasayfa", icon: "🏠" },
    { key: "bundle", label: "Set Satışı", icon: "🎁" },
    { key: "content", label: "İçerik", icon: "✏️" },
    { key: "shipping", label: "Kargo / İade", icon: "🚚" },
    { key: "seo", label: "SEO", icon: "🔍" },
  ];
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "basic"
    | "pricing"
    | "media"
    | "diamond"
    | "categories"
    | "variants"
    | "home"
    | "bundle"
    | "content"
    | "shipping"
    | "seo"
  >("basic");
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesErr, setRatesErr] = useState("");
  const [ratesLatest, setRatesLatest] = useState<RatesLatestDoc | null>(null);

  const [catsLoading, setCatsLoading] = useState(true);
  const [catsErr, setCatsErr] = useState("");
  const [cats, setCats] = useState<CategoryDoc[]>([]);

  const [popularTabs, setPopularTabs] = useState<PopularTab[]>([]);
  const [toast, setToast] = useState("");

  // Bundle ürün seçici state'leri
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleSearchResults, setBundleSearchResults] = useState<any[]>([]);
  const [bundleSearchBusy, setBundleSearchBusy] = useState(false);
  const [bundleSearchMsg, setBundleSearchMsg] = useState("");
  const [bundleProductMeta, setBundleProductMeta] = useState<Record<string, { title: string; image: string; sku: string; slug: string }>>({});

  // Mobil taslak seçici
  const [mobileDrafts, setMobileDrafts] = useState<any[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftsSearch, setDraftsSearch] = useState("");

  const [form, setForm] = useState<ProductForm>({
    title: "Yeni ürün",
    slug: "",
    sku: "",
    price: 0,
    currency: "TRY",
    images: [],
    stock: 0,
    stockAlarm: 0,
    karat: 22,
    gram: 0,
    hasGram: 0,
    categoryIds: [],

    homeSections: [],

    productVariantPreset: {

      enabled: false,

      groups: [],

    },

    isActive: true,
    isBestseller: false,
    isFeatured: false,
    compareAtOverrideEnabled: false,
    compareAtEnabled: false,
    compareAtPercent: 0,
    priceMode: "fixed",
    priceRateCode: "",
    pricePercent: 0,
    priceFixedAdd: 0,

    price2Enabled: false,
    price2Mode: "weight_rate" as PriceMode,
    price2RateCode: "",
    price2HasGram: 0,
    price2Percent: 0,
    price2FixedAdd: 0,

    priceOverrideEnabled: false,
    priceOverride: 0,

    finalPrice: 0,
    finalCurrency: "TRY",
    badgeIconUrl: "",

    badgeIconAlt: { tr: "", en: "" },

    fallbackImageUrl: FALLBACK_PRODUCT_LOGO,
    showcaseEnabled: false,
    showcaseGroups: [],
    showcaseOrder: 999,
    setBundleEnabled: false,
    setBundleTitle: { tr: "Set olarak satın al", en: "Buy as a set" },
    setBundleSubtitle: {
      tr: "Uyumlu parçaları tek seferde sepete ekleyerek daha güçlü bir kombin oluştur.",
      en: "Build a stronger combination by adding matching pieces at once.",
    },
    setBundleProductIds: [],
    setBundleDiscountType: "none",
    setBundleDiscountValue: 0,
    advanced: {
      description: { tr: "", en: "" },
      shortDescription: { tr: "", en: "" },
      colors: [],
      sizes: [],
      tags: [],
      galleryVideos: [],
      detailRows: [],
      specs: {
        weightGr: undefined,
        widthMm: undefined,
        lengthMm: undefined,
        heightMm: undefined,
      },
      shipping: {
        fastShipping: true,
        shippingDaysMin: 1,
        shippingDaysMax: 3,
        cargoNote: "",
      },
      returns: {
        title: { tr: "İade & Değişim", en: "Returns & Exchange" },
        content: { tr: "", en: "" },
      },
      seo: {
        title: { tr: "", en: "" },
        description: { tr: "", en: "" },
        keywords: [],
        ogImage: "",
        canonical: "",
      },
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const hs = (await getDocById("site_options", "home_settings")) as any;
        if (!mounted) return;

        const tabs = Array.isArray(hs?.popularTabs) ? hs.popularTabs : [];
        setPopularTabs(tabs);
      } catch {
        if (!mounted) return;
        setPopularTabs([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Mobil taslakları yükle (sadece yeni ürün modunda)
  useEffect(() => {
    if (!isNew) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "mobile_product_drafts"),
            orderBy("updatedAt", "desc"),
            limit(100)
          )
        );
        if (!alive) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMobileDrafts(list);
      } catch {
        if (alive) setMobileDrafts([]);
      }
    })();
    return () => { alive = false; };
  }, [isNew, db]);

  function fillFromDraft(draft: any) {
    const draftTitle = str(draft.title);
    const imgs: string[] = [];
    if (str(draft.imageUrl)) imgs.push(str(draft.imageUrl));
    if (Array.isArray(draft.imageUrls)) draft.imageUrls.forEach((u: any) => { if (str(u)) imgs.push(str(u)); });
    if (Array.isArray(draft.images)) draft.images.forEach((u: any) => { if (str(u) && !imgs.includes(str(u))) imgs.push(str(u)); });

    setForm((prev) => ({
      ...prev,
      ...(draftTitle ? { title: draftTitle, slug: toPathSafe(draftTitle) } : {}),
      sku: str(draft.sku),
      images: imgs,
      gram: Number(draft.gram || draft.weightGram || 0),
      hasGram: Number(draft.hasGram || draft.gram || draft.weightGram || 0),
      karat: Number(draft.karat || 22),
      stock: Number(draft.stock || 0),
      categoryIds: str(draft.categoryId) ? [str(draft.categoryId)] : prev.categoryIds,
      advanced: {
        ...(prev.advanced ?? {}),
        description: str(draft.notes)
          ? { tr: str(draft.notes), en: "" }
          : (prev.advanced?.description ?? { tr: "", en: "" }),
        specs: {
          ...(prev.advanced?.specs ?? {}),
          weightGr: Number(draft.gram || draft.weightGram || 0) || undefined,
          lengthMm: Number(draft.lengthCm || 0) > 0 ? Number(draft.lengthCm) * 10 : (prev.advanced?.specs?.lengthMm),
          widthMm: Number(draft.widthMm || 0) > 0 ? Number(draft.widthMm) : (prev.advanced?.specs?.widthMm),
        },
      },
    }));
    setDraftsOpen(false);
    showToast(`Taslak yüklendi: ${draftTitle}`);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!isNew) {
          const data = (await getDocById("products", id)) as Partial<ProductForm> | null;

          if (mounted && data) {
            // title: obje gelirse string'e çevir
            const rawTitle = (data as any)?.title;
            const normalizedTitle = typeof rawTitle === "object" && rawTitle !== null
              ? (str(rawTitle.tr) || str(rawTitle.en))
              : str(rawTitle);

            setForm((prev) => ({
              ...prev,
              ...data,
              title: normalizedTitle || prev.title,
              advanced: {
                ...(prev.advanced || {}),
                ...((data as any)?.advanced || {}),
              },
              homeSections: Array.isArray((data as any)?.homeSections)
                ? (data as any).homeSections.map((x: any) => str(x)).filter(Boolean)
                : [
                  (data as any)?.isBestseller ? "bestsellers" : null,
                  (data as any)?.isFeatured ? "featured" : null,
                ].filter(Boolean) as string[],
              price: Number((data as any)?.price ?? prev.price ?? 0),
              stock: Number((data as any)?.stock ?? prev.stock ?? 0),
              stockAlarm: Number((data as any)?.stockAlarm ?? prev.stockAlarm ?? 0),
              karat: Number((data as any)?.karat ?? prev.karat ?? 0),
              gram: Number((data as any)?.gram ?? prev.gram ?? 0),
              hasGram: Number((data as any)?.hasGram ?? prev.hasGram ?? 0),
              pricePercent: Number((data as any)?.pricePercent ?? prev.pricePercent ?? 0),
              priceFixedAdd: Number((data as any)?.priceFixedAdd ?? prev.priceFixedAdd ?? 0),
              // İkinci fiyat motoru alanları
              price2Enabled: !!(data as any)?.price2Enabled,
              price2Mode: ((data as any)?.price2Mode || "weight_rate") as PriceMode,
              price2RateCode: String((data as any)?.price2RateCode || ""),
              price2HasGram: Number((data as any)?.price2HasGram ?? 0),
              price2Percent: Number((data as any)?.price2Percent ?? 0),
              price2FixedAdd: Number((data as any)?.price2FixedAdd ?? 0),
              priceOverride: Number((data as any)?.priceOverride ?? prev.priceOverride ?? 0),
              compareAtOverrideEnabled: !!(data as any)?.compareAtOverrideEnabled,
              compareAtEnabled: !!(data as any)?.compareAtEnabled,
              compareAtPercent: Number((data as any)?.compareAtPercent ?? 0),
              showcaseEnabled: !!(data as any)?.showcase?.enabled,
              showcaseGroups: Array.isArray((data as any)?.showcase?.groups)
                ? (data as any).showcase.groups.map((x: any) => str(x)).filter(Boolean)
                : [],
              showcaseOrder: Number((data as any)?.showcase?.order ?? 999),
              setBundleEnabled: !!(data as any)?.setBundle?.enabled,
              setBundleTitle: (data as any)?.setBundle?.title ?? { tr: "Set olarak satın al", en: "Buy as a set" },
              setBundleSubtitle: (data as any)?.setBundle?.subtitle ?? {
                tr: "Uyumlu parçaları tek seferde sepete ekleyerek daha güçlü bir kombin oluştur.",
                en: "Build a stronger combination by adding matching pieces at once.",
              },
              setBundleProductIds: Array.isArray((data as any)?.setBundle?.productIds)
                ? (data as any).setBundle.productIds.map((x: any) => str(x)).filter(Boolean)
                : [],
              setBundleDiscountType: (data as any)?.setBundle?.discountType ?? "none",
              setBundleDiscountValue: Number((data as any)?.setBundle?.discountValue ?? 0),
              finalPrice: Number((data as any)?.finalPrice ?? prev.finalPrice ?? 0),
              images: Array.isArray((data as any)?.images)
                ? (data as any).images.map((x: any) => str(x)).filter(Boolean)
                : [],
              categoryIds: Array.isArray((data as any)?.categoryIds)
                ? (data as any).categoryIds.map((x: any) => str(x)).filter(Boolean)
                : [],
              productVariantPreset:
                (data as any)?.productVariantPreset &&
                  typeof (data as any).productVariantPreset === "object"
                  ? (data as any).productVariantPreset
                  : {
                    enabled: false,
                    groups: [],
                  },
            }));
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  // ── Bundle ürünlerinin metadata'sını yükle ──
  useEffect(() => {
    const ids = form.setBundleProductIds || [];
    if (!ids.length) return;

    const db = getFirebaseDb();
    let alive = true;

    (async () => {
      const meta: Record<string, { title: string; image: string; sku: string; slug: string }> = {};

      for (const pid of ids) {
        if (bundleProductMeta[pid]) {
          meta[pid] = bundleProductMeta[pid];
          continue;
        }

        try {
          const snap = await getDoc(doc(db, "products", pid));
          if (!alive) return;

          if (snap.exists()) {
            const d = snap.data() as any;
            const title = typeof d.title === "string" ? d.title : d.title?.tr || d.title?.en || pid;
            meta[pid] = {
              title: String(title).slice(0, 100),
              image: String(d.image || d.mainImage || (Array.isArray(d.images) ? d.images[0] : "") || ""),
              sku: String(d.sku || ""),
              slug: String(d.slug || ""),
            };
          } else {
            meta[pid] = { title: pid, image: "", sku: "", slug: pid };
          }
        } catch {
          if (!alive) return;
          meta[pid] = { title: pid, image: "", sku: "", slug: pid };
        }
      }

      if (alive) {
        setBundleProductMeta((prev) => ({ ...prev, ...meta }));
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.setBundleProductIds?.join(",")]);

  // ── Bundle ürün arama fonksiyonu ──
  async function handleBundleSearch() {
    const q = bundleSearch.trim().toLocaleLowerCase("tr-TR");
    if (q.length < 2) {
      setBundleSearchMsg("Arama için en az 2 karakter gir.");
      return;
    }

    setBundleSearchBusy(true);
    setBundleSearchMsg("");
    setBundleSearchResults([]);

    try {
      const db = getFirebaseDb();
      const snap = await getDocs(
        query(collection(db, "products"), orderBy("title.tr"), limit(100))
      );

      const results: any[] = [];
      const searchLower = q;

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const titleTr = String(data?.title?.tr || data?.title || "").toLocaleLowerCase("tr-TR");
        const titleEn = String(data?.title?.en || "").toLocaleLowerCase("tr-TR");
        const sku = String(data?.sku || "").toLocaleLowerCase("tr-TR");
        const slug = String(data?.slug || "").toLocaleLowerCase("tr-TR");

        if (
          titleTr.includes(searchLower) ||
          titleEn.includes(searchLower) ||
          sku.includes(searchLower) ||
          slug.includes(searchLower)
        ) {
          results.push({
            id: d.id,
            title: typeof data.title === "string" ? data.title : data.title?.tr || data.title?.en || d.id,
            image: String(data.image || data.mainImage || (Array.isArray(data.images) ? data.images[0] : "") || ""),
            sku: String(data.sku || ""),
            slug: String(data.slug || ""),
          });
        }
      });

      setBundleSearchResults(results.slice(0, 20));

      if (!results.length) {
        setBundleSearchMsg("Sonuç bulunamadı.");
      }
    } catch (e) {
      console.error("bundle search error:", e);
      setBundleSearchMsg("Arama yapılamadı.");
    } finally {
      setBundleSearchBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    setRatesLoading(true);
    setRatesErr("");

    (async () => {
      try {
        const docx = (await getDocById("rates", "latest")) as RatesLatestDoc | null;
        if (!mounted) return;

        if (!docx || !Array.isArray(docx.items)) {
          setRatesLatest(null);
          setRatesErr("rates/latest bulunamadı veya items yok.");
        } else {
          setRatesLatest(docx);
        }
      } catch (e: any) {
        if (!mounted) return;
        setRatesLatest(null);
        setRatesErr(e?.message || "Kur okunamadı.");
      } finally {
        if (mounted) setRatesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setCatsLoading(true);
    setCatsErr("");

    (async () => {
      try {
        const qy = query(collection(db, "categories"), orderBy("order", "asc"));
        const snap = await getDocs(qy);
        if (!mounted) return;

        const list: CategoryDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data?.name ?? data?.title ?? "",
            slug: str(data?.slug),
            parentId: data?.parentId ?? null,
            order: typeof data?.order === "number" ? data.order : undefined,
            isActive: typeof data?.isActive === "boolean" ? data.isActive : undefined,
            image: data?.image ? String(data.image) : undefined,
            pricing: data?.pricing ?? null,
          };
        });

        setCats(list);
      } catch (e: any) {
        if (!mounted) return;
        console.error("categories load error:", e);
        setCatsErr(e?.message || "Kategoriler okunamadı.");
        setCats([]);
      } finally {
        if (mounted) setCatsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [db]);

  function normKey(s: string) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "_");
  }
  const selectedCategoryPricing = useMemo(() => {
    const ids = Array.isArray(form.categoryIds) ? form.categoryIds : [];
    if (!ids.length) return null;

    const selectedCats = ids
      .map((id) => cats.find((c) => c.id === id))
      .filter(Boolean) as CategoryDoc[];

    const withPricing = selectedCats.filter((c) => c?.pricing);

    if (!withPricing.length) return null;

    const childCats = withPricing.filter((c) => !!c.parentId);
    const rootCats = withPricing.filter((c) => !c.parentId);

    const pickBest = (list: CategoryDoc[]) =>
      list.find(
        (c) =>
          Number(c?.pricing?.pricePercent ?? 0) !== 0 ||
          Number(c?.pricing?.priceFixedAdd ?? 0) !== 0
      ) ||
      list.find((c) => !!c?.pricing?.enabled) ||
      null;

    const best =
      pickBest(childCats) ||
      pickBest(rootCats) ||
      null;

    return best?.pricing || null;
  }, [cats, form.categoryIds]);
  const rateOptions = useMemo(() => {
    const items = (ratesLatest?.items ?? []) as RateItem[];

    const base = items
      .map((x) => {
        const key = normKey(x.code);
        return {
          key,
          label: x.name || x.code,
          value: Number(x.sell ?? 0),
          buy: Number(x.buy ?? 0),
        };
      })
      .filter((o) => o.key && Number.isFinite(o.value) && o.value > 0);

    const pinnedIndex = new Map<string, number>();
    PINNED_RATE_KEYS.forEach((k, i) => pinnedIndex.set(k, i));

    return base
      .slice()
      .sort((a, b) => {
        const ap = pinnedIndex.has(a.key) ? pinnedIndex.get(a.key)! : 9999;
        const bp = pinnedIndex.has(b.key) ? pinnedIndex.get(b.key)! : 9999;
        if (ap !== bp) return ap - bp;

        // pinned değilse alfabetik sırala
        return String(a.label).localeCompare(String(b.label), "tr");
      });
  }, [ratesLatest]);
  const effectivePricePercent = useMemo(() => {
    if (selectedCategoryPricing) {
      return Number(selectedCategoryPricing?.pricePercent ?? 0);
    }
    return Number(form.pricePercent ?? 0);
  }, [selectedCategoryPricing, form.pricePercent]);

  const effectivePriceFixedAdd = useMemo(() => {
    if (selectedCategoryPricing) {
      return Number(selectedCategoryPricing?.priceFixedAdd ?? 0);
    }
    return Number(form.priceFixedAdd ?? 0);
  }, [selectedCategoryPricing, form.priceFixedAdd]);

  const effectiveRateKey = useMemo(() => {
    return String(form.priceRateCode || "");
  }, [form.priceRateCode]);
  // ── İkinci fiyat motoru hesabı ──
  function calcPriceFromEngine(
    mode: PriceMode,
    rateCode: string,
    hasGramVal: number,
    percent: number,
    fixedAdd: number,
    fallbackPrice: number,
  ): number {
    if (mode === "fixed") return fallbackPrice;

    const rate = rateOptions.find((x) => x.key === rateCode)?.value;
    if (!rate || !Number.isFinite(rate)) return fallbackPrice;

    if (mode === "rate_plus") return rate * (1 + percent / 100);
    if (mode === "rate_plus_fixed") return rate * (1 + percent / 100) + fixedAdd;
    if (mode === "weight_rate") return hasGramVal * rate;
    if (mode === "weight_rate_plus") return hasGramVal * rate * (1 + percent / 100);
    if (mode === "weight_rate_plus_fixed") return hasGramVal * rate * (1 + percent / 100) + fixedAdd;

    return fallbackPrice;
  }

  const finalPrice = useMemo(() => {
    const percent = Number(effectivePricePercent ?? 0);
    const fixedAdd = Number(effectivePriceFixedAdd ?? 0);
    const hasGram = Number(form.hasGram ?? 0);

    if (form.priceOverrideEnabled) {
      return Number(form.priceOverride ?? 0);
    }

    const categoryDynamicEnabled = !!selectedCategoryPricing?.enabled;

    // kategori dinamik kapalıysa ürün kur hesabına girmez
    if (!categoryDynamicEnabled) {
      if (form.priceMode === "fixed") {
        const base = Number(form.price ?? 0);
        const p2 = form.price2Enabled
          ? calcPriceFromEngine(form.price2Mode, form.price2RateCode, Number(form.price2HasGram ?? 0), Number(form.price2Percent ?? 0), Number(form.price2FixedAdd ?? 0), 0)
          : 0;
        return base + p2;
      }

      return Number(form.finalPrice ?? form.price ?? 0);
    }

    // Birinci motor
    const price1 = calcPriceFromEngine(
      form.priceMode,
      effectiveRateKey,
      hasGram,
      percent,
      fixedAdd,
      Number(form.price ?? 0),
    );

    // İkinci motor (opsiyonel)
    const price2 = form.price2Enabled
      ? calcPriceFromEngine(
        form.price2Mode,
        form.price2RateCode,
        Number(form.price2HasGram ?? 0),
        Number(form.price2Percent ?? 0),
        Number(form.price2FixedAdd ?? 0),
        0,
      )
      : 0;

    const total = price1 + price2;
    return total > 0 ? total : Number(form.finalPrice ?? form.price ?? 0);
  }, [
    form,
    rateOptions,
    selectedCategoryPricing,
    effectiveRateKey,
    effectivePricePercent,
    effectivePriceFixedAdd,
  ]);

  function describePriceEngine(
    mode: PriceMode,
    rateCode: string,
    hasGramVal: number,
    percent: number,
    fixedAdd: number,
    fixedPrice: number,
    label: string,
  ): string {
    if (mode === "fixed") return `Sabit ${fmt(fixedPrice)}`;

    const opt = rateOptions.find((x) => x.key === rateCode);
    if (!opt) return `${label}: kur seçilmedi`;

    if (mode === "rate_plus") return `${opt.label} (${fmt(opt.value)}) + %${fmt(percent)}`;
    if (mode === "rate_plus_fixed") return `${opt.label} (${fmt(opt.value)}) + %${fmt(percent)} + ${fmt(fixedAdd)}`;
    if (mode === "weight_rate") return `${fmt(hasGramVal)} gr × ${opt.label} (${fmt(opt.value)})`;
    if (mode === "weight_rate_plus") return `${fmt(hasGramVal)} gr × ${opt.label} (${fmt(opt.value)}) + %${fmt(percent)}`;
    if (mode === "weight_rate_plus_fixed") return `${fmt(hasGramVal)} gr × ${opt.label} (${fmt(opt.value)}) + %${fmt(percent)} + ${fmt(fixedAdd)}`;

    return `${label}: bilinmiyor`;
  }

  const calcSummary = useMemo(() => {
    if (form.priceOverrideEnabled) {
      return `Override açık → Final = ${fmt(finalPrice)} ${form.currency}`;
    }

    const p1Desc = describePriceEngine(
      form.priceMode,
      form.priceRateCode,
      Number(form.hasGram ?? 0),
      Number(effectivePricePercent ?? 0),
      Number(effectivePriceFixedAdd ?? 0),
      Number(form.price ?? 0),
      "Motor 1",
    );

    let summary = `Motor 1: ${p1Desc}`;

    if (form.price2Enabled) {
      const p2Desc = describePriceEngine(
        form.price2Mode,
        form.price2RateCode,
        Number(form.price2HasGram ?? 0),
        Number(form.price2Percent ?? 0),
        Number(form.price2FixedAdd ?? 0),
        0,
        "Motor 2",
      );
      summary += ` + Motor 2: ${p2Desc}`;
    }

    summary += ` → Final = ${fmt(finalPrice)} ${form.currency}`;

    return summary;
  }, [
    form,
    rateOptions,
    finalPrice,
    effectivePricePercent,
    effectivePriceFixedAdd,
  ]);


  const imagesText = useMemo(() => (Array.isArray(form.images) ? form.images.join("\n") : ""), [form.images]);
  function deepClean<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj as any;

    if (Array.isArray(obj)) {
      return obj
        .map((x) => deepClean(x))
        .filter((x) => x !== undefined) as any;
    }

    if (typeof obj === "object") {
      const out: any = {};

      for (const [k, v] of Object.entries(obj as any)) {
        if (v === undefined) continue;

        const vv = deepClean(v);

        if (vv === undefined) continue;
        if (vv === null) continue;

        if (typeof vv === "string" && vv.trim() === "") continue;

        if (
          typeof vv === "object" &&
          !Array.isArray(vv) &&
          Object.keys(vv).length === 0
        ) {
          continue;
        }

        out[k] = vv;
      }

      return out;
    }

    return obj as any;
  }
  function updateDetailRow(
    index: number,
    patch: Partial<{
      id: string;
      icon?: string;
      label?: { tr?: string; en?: string };
      value?: { tr?: string; en?: string };
    }>
  ) {
    setForm((prev) => {
      const rows = Array.isArray(prev.advanced?.detailRows)
        ? [...prev.advanced.detailRows]
        : [];

      const current = rows[index] || {
        id: `row_${Date.now()}_${index}`,
        icon: "",
        label: { tr: "", en: "" },
        value: { tr: "", en: "" },
      };

      rows[index] = {
        ...current,
        ...patch,
        label: {
          ...(current.label || {}),
          ...(patch.label || {}),
        },
        value: {
          ...(current.value || {}),
          ...(patch.value || {}),
        },
      };

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          detailRows: rows,
        },
      };
    });
  }

  function addDetailRow() {
    setForm((prev) => {
      const rows = Array.isArray(prev.advanced?.detailRows)
        ? [...prev.advanced.detailRows]
        : [];

      rows.push({
        id: `row_${Date.now()}_${rows.length}`,
        icon: "",
        label: { tr: "", en: "" },
        value: { tr: "", en: "" },
      });

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          detailRows: rows,
        },
      };
    });
  }

  function removeDetailRow(index: number) {
    setForm((prev) => {
      const rows = Array.isArray(prev.advanced?.detailRows)
        ? [...prev.advanced.detailRows]
        : [];

      rows.splice(index, 1);

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          detailRows: rows,
        },
      };
    });
  }
  function updateDiamondField(key: string, value: any) {
    setForm((prev) => ({
      ...prev,
      advanced: {
        ...(prev.advanced || {}),
        diamond: {
          ...(prev.advanced?.diamond || {}),
          [key]: value,
        },
      },
    }));
  }

  function addDiamondStoneGroup() {
    setForm((prev) => {
      const diamond = prev.advanced?.diamond || {};
      const groups = Array.isArray(diamond.stoneGroups)
        ? [...diamond.stoneGroups]
        : [];

      groups.push({
        id: `stone_${Date.now()}_${groups.length + 1}`,
        stoneType: "diamond",
        diamondOrigin: "natural",
        weightCt: 0,
        quantity: 1,
        color: "",
        clarity: "",
        cut: "round",
        fluorescence: "",
        polish: "",
        symmetry: "",
        treatment: "",
        origin: "",
        certificateLab: "",
        certificateNumber: "",
      });

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          diamond: {
            ...diamond,
            enabled: true,
            stoneGroups: groups,
          },
        },
      };
    });
  }

  function updateDiamondStoneGroup(
    index: number,
    patch: Record<string, any>
  ) {
    setForm((prev) => {
      const diamond = prev.advanced?.diamond || {};
      const groups = Array.isArray(diamond.stoneGroups)
        ? [...diamond.stoneGroups]
        : [];

      if (!groups[index]) return prev;

      groups[index] = {
        ...groups[index],
        ...patch,
      };

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          diamond: {
            ...diamond,
            stoneGroups: groups,
          },
        },
      };
    });
  }

  function removeDiamondStoneGroup(index: number) {
    setForm((prev) => {
      const diamond = prev.advanced?.diamond || {};

      const groups = Array.isArray(diamond.stoneGroups)
        ? diamond.stoneGroups.filter((_, i) => i !== index)
        : [];

      return {
        ...prev,
        advanced: {
          ...(prev.advanced || {}),
          diamond: {
            ...diamond,
            stoneGroups: groups,
          },
        },
      };
    });
  }
  function cleanVariantNumber(v: any) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 10000) / 10000);
  }

  function cleanProductVariantPreset(v: any): CategoryVariantPreset {
    if (!v || typeof v !== "object") {
      return {
        enabled: false,
        groups: [],
      };
    }

    const groupsRaw = Array.isArray(v.groups) ? v.groups : [];

    const groups: VariantGroup[] = groupsRaw
      .map((g: any, groupIndex: number) => {
        const groupId = str(g?.id) || `variant_${groupIndex + 1}`;

        const optionsRaw = Array.isArray(g?.options) ? g.options : [];

        const options: VariantOption[] = optionsRaw
          .map((o: any, optionIndex: number) => {
            const value = str(o?.value);
            if (!value) return null;

            const hasGram = cleanVariantNumber(
              o?.hasGram ?? o?.weightGram ?? o?.gram ?? 0
            );

            return {
              value,
              label: {
                tr: str(o?.label?.tr) || value,
                en: str(o?.label?.en),
              },
              ...(hasGram > 0 ? { hasGram, weightGram: hasGram } : {}),
              priceDelta: cleanVariantNumber(o?.priceDelta ?? 0),
              stockDelta: Math.floor(Number(o?.stockDelta ?? 0) || 0),
              isActive: o?.isActive !== false,
              order: Number.isFinite(Number(o?.order)) ? Number(o.order) : optionIndex,
            };
          })
          .filter(Boolean) as VariantOption[];

        options.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

        if (!groupId || !options.length) return null;

        return {
          id: groupId,
          label: {
            tr: str(g?.label?.tr) || groupId,
            en: str(g?.label?.en),
          },
          type: VARIANT_DISPLAY_TYPES.some((x) => x.value === g?.type)
            ? (g.type as VariantGroup["type"])
            : "select",
          required: g?.required !== false,
          options,
        };
      })
      .filter(Boolean) as VariantGroup[];

    return {
      enabled: v.enabled === true,
      groups,
    };
  }
  function seoSafeText(v: any) {
    return String(v ?? "")
      .replace(/\s+/g, " ")
      .replace(/[<>]/g, "")
      .trim();
  }

  function truncateSeo(text: string, max: number) {
    const clean = seoSafeText(text);
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 1).trimEnd() + "…";
  }

  function buildSeoTitle(form: ProductForm, loc: "tr" | "en" = "tr") {
    const title = seoSafeText(form.title);
    const karat = Number(form.karat || 0) > 0 ? `${form.karat} Ayar` : "";
    const gram =
      Number(form.hasGram || form.gram || 0) > 0
        ? `${fmt(Number(form.hasGram || form.gram))} gr`
        : "";

    const suffix = loc === "en" ? "6'ncı lifestyle" : "Dromocob";

    return truncateSeo(
      [title, karat, gram, suffix].filter(Boolean).join(" | "),
      62
    );
  }

  function buildSeoDescription(form: ProductForm, loc: "tr" | "en" = "tr") {
    const shortDesc =
      seoSafeText(form.advanced?.shortDescription?.[loc]) ||
      seoSafeText(form.advanced?.description?.[loc]);

    const title = seoSafeText(form.title);
    const karat = Number(form.karat || 0) > 0 ? `${form.karat} ayar` : "";
    const gram =
      Number(form.hasGram || form.gram || 0) > 0
        ? `${fmt(Number(form.hasGram || form.gram))} gram`
        : "";

    if (shortDesc) {
      return truncateSeo(shortDesc, 155);
    }

    if (loc === "en") {
      return truncateSeo(
        `${title} model with premium craftsmanship, secure shopping experience, fast shipping and 6'ncı lifestyle assurance.`,
        155
      );
    }

    return truncateSeo(
      `${title} modeli ${[karat, gram]
        .filter(Boolean)
        .join(", ")} özellikleriyle Dromocob güvencesiyle sunulur. Güvenli alışveriş, hızlı kargo ve zarif paketleme.`,
      155
    );
  }

  function buildSeoKeywords(form: ProductForm) {
    const base = [
      form.title,
      form.sku,
      "altın",
      "e-ticaret",
      "6'ncı e-ticaret",
      "hediye",
      Number(form.karat || 0) > 0 ? `${form.karat} ayar` : "",
      Number(form.hasGram || form.gram || 0) > 0
        ? `${fmt(Number(form.hasGram || form.gram))} gram`
        : "",
      ...(form.advanced?.tags || []),
    ];

    return Array.from(
      new Set(
        base
          .map((x) => seoSafeText(x).toLocaleLowerCase("tr-TR"))
          .filter(Boolean)
      )
    ).slice(0, 16);
  }

  function buildCanonical(form: ProductForm) {
    const slug = form.slug ? toPathSafe(form.slug) : toPathSafe(form.title);
    return slug ? `/products/${slug}` : "";
  }

  function autoFillSeoPayload(form: ProductForm) {
    const firstImage =
      str(form.images?.[0]) || str(form.fallbackImageUrl) || FALLBACK_PRODUCT_LOGO;

    return {
      title: {
        tr: buildSeoTitle(form, "tr"),
        en: buildSeoTitle(form, "en"),
      },
      description: {
        tr: buildSeoDescription(form, "tr"),
        en: buildSeoDescription(form, "en"),
      },
      keywords: buildSeoKeywords(form),
      ogImage: firstImage,
      canonical: buildCanonical(form),
    };
  }
  function cleanDiamond(diamond: any) {
    if (!diamond || typeof diamond !== "object") {
      return undefined;
    }

    const enabled = diamond.enabled === true;

    const cleanNumber = (value: any) => {
      if (value === "" || value === null || value === undefined) {
        return undefined;
      }

      const n = Number(value);

      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    const stoneGroups = Array.isArray(diamond.stoneGroups)
      ? diamond.stoneGroups
        .map((stone: any, index: number) => ({
          id: str(stone?.id) || `stone_${index + 1}`,

          stoneType: str(stone?.stoneType) || undefined,

          diamondOrigin:
            stone?.diamondOrigin === "natural" ||
              stone?.diamondOrigin === "lab_grown"
              ? stone.diamondOrigin
              : undefined,

          weightCt: cleanNumber(stone?.weightCt),

          quantity:
            stone?.quantity === "" ||
              stone?.quantity === null ||
              stone?.quantity === undefined
              ? undefined
              : Math.max(0, Math.floor(Number(stone.quantity) || 0)),

          color: str(stone?.color) || undefined,
          clarity: str(stone?.clarity) || undefined,
          cut: str(stone?.cut) || undefined,

          fluorescence: str(stone?.fluorescence) || undefined,
          polish: str(stone?.polish) || undefined,
          symmetry: str(stone?.symmetry) || undefined,

          treatment: str(stone?.treatment) || undefined,
          origin: str(stone?.origin) || undefined,

          certificateLab: str(stone?.certificateLab) || undefined,
          certificateNumber:
            str(stone?.certificateNumber) || undefined,
        }))
        .filter(
          (stone: any) =>
            stone.stoneType ||
            stone.weightCt !== undefined ||
            stone.quantity !== undefined ||
            stone.color ||
            stone.clarity ||
            stone.cut
        )
      : [];

    const result = deepClean({
      enabled,

      metalColor: str(diamond.metalColor) || undefined,
      metalType: str(diamond.metalType) || undefined,
      metalKarat: cleanNumber(diamond.metalKarat),

      handmade: diamond.handmade === true,

      settingType: str(diamond.settingType) || undefined,

      diamondOrigin: str(diamond.diamondOrigin) || undefined,

      totalCarat: cleanNumber(diamond.totalCarat),
      centerStoneCarat: cleanNumber(diamond.centerStoneCarat),

      totalStoneQuantity:
        diamond.totalStoneQuantity === "" ||
          diamond.totalStoneQuantity === null ||
          diamond.totalStoneQuantity === undefined
          ? undefined
          : Math.max(
            0,
            Math.floor(Number(diamond.totalStoneQuantity) || 0)
          ),

      certificateLab:
        str(diamond.certificateLab) || undefined,

      certificateNumber:
        str(diamond.certificateNumber) || undefined,

      certificateUrl:
        str(diamond.certificateUrl) || undefined,

      certificateNote:
        str(diamond.certificateNote) || undefined,

      fluorescence:
        str(diamond.fluorescence) || undefined,

      polish: str(diamond.polish) || undefined,
      symmetry: str(diamond.symmetry) || undefined,

      treatment: str(diamond.treatment) || undefined,
      origin: str(diamond.origin) || undefined,

      stoneGroups,
    });

    return {
      ...(result || {}),
      enabled,
      handmade: diamond.handmade === true,
      stoneGroups,
    };
  }
  function cleanAdvanced(advanced: any) {
    if (!advanced || typeof advanced !== "object") return undefined;

    // description ve shortDescription'ı deepClean'den ÖNCE ayır.
    // deepClean boş string'leri siliyor, ama açıklama alanları
    // boş olsa bile Firestore'a yazılmalı ki eski değer silinebilsin.
    const descTr = str(advanced?.description?.tr);
    const descEn = str(advanced?.description?.en);
    const shortDescTr = str(advanced?.shortDescription?.tr);
    const shortDescEn = str(advanced?.shortDescription?.en);

    const cleaned = deepClean({
      ...advanced,
      diamond: cleanDiamond(advanced?.diamond),
      // description ve shortDescription'ı deepClean'e göndermiyoruz
      description: undefined,
      shortDescription: undefined,
      sizes: Array.isArray(advanced?.sizes)
        ? advanced.sizes.map((x: any) => str(x)).filter(Boolean)
        : [],
      tags: Array.isArray(advanced?.tags)
        ? advanced.tags.map((x: any) => str(x)).filter(Boolean)
        : [],
      galleryVideos: Array.isArray(advanced?.galleryVideos)
        ? advanced.galleryVideos.map((x: any) => str(x)).filter(Boolean)
        : [],
      detailRows: Array.isArray(advanced?.detailRows)

        ? advanced.detailRows

          .map((row: any, i: number) => ({

            id: str(row?.id) || `row_${i + 1}`,

            icon: str(row?.icon) || undefined,

            label: {

              tr: str(row?.label?.tr),

              en: str(row?.label?.en),

            },

            value: {

              tr: str(row?.value?.tr),

              en: str(row?.value?.en),

            },

          }))

          .filter((row: any) => row.label?.tr || row.label?.en || row.value?.tr || row.value?.en)

        : [],
      colors: Array.isArray(advanced?.colors)
        ? advanced.colors
          .map((c: any) => ({
            name: str(c?.name),
            hex: str(c?.hex) || undefined,
          }))
          .filter((c: any) => c.name)
        : [],
      specs: {
        weightGr:
          advanced?.specs?.weightGr === "" || advanced?.specs?.weightGr == null
            ? undefined
            : Number(advanced?.specs?.weightGr),
        widthMm:
          advanced?.specs?.widthMm === "" || advanced?.specs?.widthMm == null
            ? undefined
            : Number(advanced?.specs?.widthMm),
        lengthMm:
          advanced?.specs?.lengthMm === "" || advanced?.specs?.lengthMm == null
            ? undefined
            : Number(advanced?.specs?.lengthMm),
        heightMm:
          advanced?.specs?.heightMm === "" || advanced?.specs?.heightMm == null
            ? undefined
            : Number(advanced?.specs?.heightMm),
      },
      shipping: {
        ...advanced?.shipping,
        cargoNote: str(advanced?.shipping?.cargoNote),
        shippingDaysMin:
          advanced?.shipping?.shippingDaysMin === "" || advanced?.shipping?.shippingDaysMin == null
            ? undefined
            : Number(advanced?.shipping?.shippingDaysMin),
        shippingDaysMax:
          advanced?.shipping?.shippingDaysMax === "" || advanced?.shipping?.shippingDaysMax == null
            ? undefined
            : Number(advanced?.shipping?.shippingDaysMax),
      },
      seo: {
        ...advanced?.seo,
        keywords: Array.isArray(advanced?.seo?.keywords)
          ? advanced.seo.keywords.map((x: any) => str(x)).filter(Boolean)
          : [],
        ogImage: str(advanced?.seo?.ogImage) || undefined,
        canonical: str(advanced?.seo?.canonical) || undefined,
      },
    });

    // description ve shortDescription'ı deepClean sonrası geri ekle
    // Böylece boş olsa bile Firestore'a yazılır ve eski değer silinebilir
    const result = cleaned && typeof cleaned === "object" ? { ...cleaned } : {};

    if (descTr || descEn) {
      result.description = { tr: descTr, en: descEn };
    }
    if (shortDescTr || shortDescEn) {
      result.shortDescription = { tr: shortDescTr, en: shortDescEn };
    }

    return Object.keys(result).length ? result : undefined;
  }
  function toggleHomeSection(cur: string[], key: string, checked: boolean) {
    const arr = Array.isArray(cur) ? cur.map(str) : [];
    if (checked) return Array.from(new Set([...arr, key]));
    return arr.filter((x) => x !== key);
  }

  async function save() {
    setSaving(true);

    try {
      const autoSeo = autoFillSeoPayload(form);

      const nextAdvanced = {
        ...(form.advanced || {}),
        seo: {
          ...(form.advanced?.seo || {}),
          title: {
            tr: str(form.advanced?.seo?.title?.tr) || autoSeo.title.tr,
            en: str(form.advanced?.seo?.title?.en) || autoSeo.title.en,
          },
          description: {
            tr:
              str(form.advanced?.seo?.description?.tr) ||
              autoSeo.description.tr,
            en:
              str(form.advanced?.seo?.description?.en) ||
              autoSeo.description.en,
          },
          keywords:
            Array.isArray(form.advanced?.seo?.keywords) &&
              form.advanced.seo.keywords.length
              ? form.advanced.seo.keywords
              : autoSeo.keywords,
          ogImage: str(form.advanced?.seo?.ogImage) || autoSeo.ogImage,
          canonical: str(form.advanced?.seo?.canonical) || autoSeo.canonical,
        },
      };

      const cleanedAdvanced = cleanAdvanced(nextAdvanced);

      const firstProductImage =
        str((form.images || [])[0]) ||
        str(form.fallbackImageUrl) ||
        FALLBACK_PRODUCT_LOGO;

      const cleanImages = Array.from(
        new Set(
          (
            form.images && form.images.length
              ? form.images
              : [firstProductImage]
          )
            .map((x) => str(x))
            .filter(Boolean)
        )
      );

      const payload: any = {
        ...form,
        title: str(form.title),
        slug: form.slug ? toPathSafe(form.slug) : toPathSafe(form.title || id),
        sku: str(form.sku),
        price: Number(form.price ?? 0),
        stock: Math.max(0, Number(form.stock ?? 0)),
        stockAlarm: Math.max(0, Number(form.stockAlarm ?? 0)),
        karat: Math.max(0, Number(form.karat ?? 0)),
        gram: Math.max(0, Number(form.gram ?? 0)),
        hasGram: Math.max(0, Number(form.hasGram ?? 0)),
        pricePercent: Number(form.pricePercent ?? 0),
        priceFixedAdd: Number(form.priceFixedAdd ?? 0),
        // İkinci fiyat motoru — sadece aktifse kaydet
        price2Enabled: !!form.price2Enabled,
        ...(form.price2Enabled ? {
          price2Mode: form.price2Mode,
          price2RateCode: form.price2RateCode,
          price2HasGram: Math.max(0, Number(form.price2HasGram ?? 0)),
          price2Percent: Number(form.price2Percent ?? 0),
          price2FixedAdd: Number(form.price2FixedAdd ?? 0),
        } : {}),
        priceOverride: Number(form.priceOverride ?? 0),
        compareAtOverrideEnabled: !!form.compareAtOverrideEnabled,
        compareAtEnabled: !!form.compareAtEnabled,
        compareAtPercent: Number(form.compareAtPercent ?? 0),

        images: cleanImages,
        image: firstProductImage,
        mainImage: firstProductImage,
        fallbackImageUrl: str(form.fallbackImageUrl) || FALLBACK_PRODUCT_LOGO,

        categoryIds: Array.from(
          new Set((form.categoryIds || []).map((x) => str(x)).filter(Boolean))
        ),

        productVariantPreset: cleanProductVariantPreset(form.productVariantPreset),

        finalPrice: Number(finalPrice ?? 0),
        finalCurrency: form.currency || "TRY",

        advanced: cleanedAdvanced,

        showcase: {
          enabled: !!form.showcaseEnabled,
          groups: Array.from(
            new Set((form.showcaseGroups || []).map((x) => str(x)).filter(Boolean))
          ),
          order: Number(form.showcaseOrder ?? 999),
        },

        setBundle: {
          enabled: !!form.setBundleEnabled,
          title: form.setBundleTitle ?? { tr: "", en: "" },
          subtitle: form.setBundleSubtitle ?? { tr: "", en: "" },
          productIds: Array.from(
            new Set(
              (form.setBundleProductIds || []).map((x) => str(x)).filter(Boolean)
            )
          ),
          discountType: form.setBundleDiscountType || "none",
          discountValue: Number(form.setBundleDiscountValue ?? 0),
        },
      };

      const docId = isNew
        ? payload.slug
          ? toPathSafe(payload.slug)
          : payload.sku
            ? toPathSafe(payload.sku)
            : `pr-${Date.now()}`
        : id;

      await upsertDoc("products", docId, payload);

      showToast("Kaydedildi ✅");

      if (isNew) {
        router.replace(`/admin/products/${encodeURIComponent(docId)}`);
      }
    } catch (e: any) {
      console.error("product save error:", e);
      showToast(e?.message || "Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (isNew) return;
    if (!window.confirm("Bu ürün silinsin mi?")) return;

    try {
      await removeDoc("products", id);
      showToast("Ürün silindi");
      router.push("/admin/products");
    } catch (e: any) {
      console.error("product delete error:", e);
      showToast(e?.message || "Silinemedi");
    }
  }

  async function handleImageUpload(files: File[]) {
    if (!files.length) return;

    try {
      const productId = isNew ? form.sku || form.slug || `pr-${Date.now()}` : id;
      const urls: string[] = [];

      for (const file of files) {
        const url = await uploadProductImage(file, productId);
        urls.push(url);
      }

      setForm((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...urls],
      }));

      showToast(`${urls.length} görsel yüklendi ✅`);
    } catch (e: any) {
      console.error("image upload error:", e);
      showToast(e?.message || "Görsel yüklenemedi");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return <div className={s.loadingBox}>Yükleniyor…</div>;
  }

  return (
    <div className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.breadcrumb}>
            <Link href="/admin">Admin</Link>
            <span className={s.breadcrumbSep}>›</span>
            <Link href="/admin/products">Ürünler</Link>
            <span className={s.breadcrumbSep}>›</span>
            <span>{isNew ? "Yeni Ürün" : (form.title || id)}</span>
          </div>
          <div className={s.kicker}>{isNew ? "YENİ ÜRÜN OLUŞTUR" : "ÜRÜN DÜZENLE"}</div>
          <h1 className={s.title}>
            {form.title || (isNew ? "Yeni Ürün" : "Ürün Düzenle")}
          </h1>
          <div className={s.metaRow}>
            <span className={s.codePill}>{form.slug || id}</span>
            <span className={`${s.statusBadge} ${form.isActive ? s.statusActive : s.statusPassive}`}>
              {form.isActive ? "● Aktif" : "○ Pasif"}
            </span>
            <span className={s.finalBadge}>
              💰 {fmt(finalPrice)} {form.currency}
            </span>
          </div>
        </div>

        <div className={s.headerActions}>


          <button type="button" className={s.primaryBtn} onClick={save} disabled={saving}>
            {saving ? "⏳ Kaydediliyor…" : "✓ Kaydet"}
          </button>

          {!isNew ? (
            <button type="button" className={s.dangerBtn} onClick={del}>
              🗑 Sil
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Taslaktan Doldur (sadece yeni ürün) ── */}
      {isNew && mobileDrafts.length > 0 && (
        <div style={{
          padding: "14px 18px",
          borderRadius: 18,
          background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.06))",
          border: "1px solid rgba(59,130,246,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#1e40af" }}>📱 Mobil Taslaktan Doldur</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginTop: 2 }}>
                Mobil uygulamadan eklenen taslakları seçerek formu otomatik doldur.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraftsOpen(!draftsOpen)}
              style={{
                padding: "8px 16px",
                borderRadius: 12,
                border: "none",
                background: draftsOpen ? "#e0e7ff" : "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: draftsOpen ? "#3730a3" : "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {draftsOpen ? "Kapat" : `${mobileDrafts.length} Taslak`}
            </button>
          </div>

          {draftsOpen && (
            <div style={{ marginTop: 12 }}>
              <input
                type="search"
                placeholder="Taslak ara (ad, SKU, barkod)..."
                value={draftsSearch}
                onChange={(e) => setDraftsSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  outline: "none",
                  marginBottom: 10,
                  boxSizing: "border-box" as const,
                }}
              />
              <div style={{
                maxHeight: 280,
                overflowY: "auto" as const,
                display: "flex",
                flexDirection: "column" as const,
                gap: 6,
              }}>
                {mobileDrafts
                  .filter((d) => {
                    if (!draftsSearch.trim()) return true;
                    const q = draftsSearch.trim().toLowerCase();
                    return [
                      str(d.title), str(d.sku), str(d.barcode), str(d.categoryName),
                    ].join(" ").toLowerCase().includes(q);
                  })
                  .filter((d) => str(d.status) !== "published")
                  .map((d) => {
                    const img = str(d.imageUrl) || (Array.isArray(d.imageUrls) && d.imageUrls[0] ? str(d.imageUrls[0]) : "");
                    return (
                      <div
                        key={d.id}
                        onClick={() => fillFromDraft(d)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          borderRadius: 14,
                          background: "#fff",
                          border: "1px solid rgba(15,23,42,0.08)",
                          cursor: "pointer",
                          transition: "box-shadow 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.3)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(59,130,246,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(15,23,42,0.08)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        }}
                      >
                        {img ? (
                          <img src={img} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: 10,
                            background: "#f1f5f9", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: 18, color: "#cbd5e1",
                          }}>📷</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {str(d.title) || str(d.sku) || "İsimsiz"}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginTop: 1 }}>
                            {[str(d.sku) && `SKU: ${d.sku}`, str(d.barcode) && `Barkod: ${d.barcode}`, Number(d.gram) > 0 && `${d.gram}gr`].filter(Boolean).join(" · ") || "Detay yok"}
                          </div>
                        </div>
                        <div style={{
                          padding: "5px 10px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 900,
                        }}>Seç</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      <section className={s.heroGrid}>
        <div className={s.metricCard}>
          <span className={s.metricLabel}>💰 Final Fiyat</span>
          <strong className={s.metricValue}>{fmt(finalPrice)} {form.currency}</strong>
          <span className={s.metricSub}>{form.priceMode === "fixed" ? "Sabit fiyat" : `Kur: ${form.priceRateCode || "-"}`}</span>
        </div>

        <div className={s.metricCard}>
          <span className={s.metricLabel}>📦 Stok</span>
          <strong className={`${s.metricValue} ${Number(form.stock) <= Number(form.stockAlarm) ? s.metricWarn : s.metricOk}`}>{form.stock}</strong>
          <span className={s.metricSub}>Alarm: {form.stockAlarm}</span>
        </div>

        <div className={s.metricCard}>
          <span className={s.metricLabel}>📸 Görseller</span>
          <strong className={s.metricValue}>{Array.isArray(form.images) ? form.images.length : 0}</strong>
          <span className={s.metricSub}>{Array.isArray(form.images) && form.images.length > 0 ? "Yüklü" : "Görsel yok"}</span>
        </div>

        <div className={s.metricCard}>
          <span className={s.metricLabel}>📂 Kategori</span>
          <strong className={s.metricValue}>{Array.isArray(form.categoryIds) ? form.categoryIds.length : 0}</strong>
          <span className={s.metricSub}>{form.karat}K • {form.gram || form.hasGram || 0} gr</span>
        </div>
      </section>
      <div className={s.tabsBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${s.tabBtn} ${activeTab === tab.key ? s.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <span className={s.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "pricing" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Fiyat Motoru</h2>
              <p className={s.cardDesc}>Sabit, kur bazlı veya override fiyat senaryolarını buradan yönet.</p>
            </div>

            <label className={s.switchRow}>
              <input
                type="checkbox"
                checked={form.priceOverrideEnabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceOverrideEnabled: e.target.checked,
                    ...(e.target.checked
                      ? { priceMode: "fixed", priceRateCode: "", pricePercent: 0, priceFixedAdd: 0 }
                      : {}),
                  }))
                }
              />
              <span>Elle fiyat gir (override)</span>
            </label>
          </div>

          <div className={s.formGrid3}>
            <FieldSelect
              label="Mod"
              value={form.priceMode}
              onChange={(v) => setForm((prev) => ({ ...prev, priceMode: v as PriceMode }))}
              disabled={form.priceOverrideEnabled}
              options={[
                { value: "fixed", label: "1) Sabit" },
                { value: "rate_plus", label: "2) Kur + %" },
                { value: "rate_plus_fixed", label: "3) Kur + % + Sabit" },
                { value: "weight_rate", label: "4) Has Gram × Kur" },
                { value: "weight_rate_plus", label: "5) Has Gram × Kur + %" },
                { value: "weight_rate_plus_fixed", label: "6) Has Gram × Kur + % + Sabit" },
              ]}
            />

            <FieldSelect
              label="Para Birimi"
              value={form.currency}
              onChange={(v) => setForm((prev) => ({ ...prev, currency: v }))}
              options={[
                { value: "TRY", label: "TRY" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
            />

            <FieldSelect
              label="Kur"
              value={form.priceRateCode || ""}
              onChange={(v) => setForm((prev) => ({ ...prev, priceRateCode: v }))}
              disabled={
                form.priceOverrideEnabled ||
                ![
                  "rate_plus",
                  "rate_plus_fixed",
                  "weight_rate",
                  "weight_rate_plus",
                  "weight_rate_plus_fixed",
                ].includes(form.priceMode)
              }
              hint={
                ratesErr
                  ? `Hata: ${ratesErr}`
                  : ratesLoading
                    ? "Kurlar yükleniyor…"
                    : "Kaynak: rates/latest"
              }
              options={[
                {
                  value: "",
                  label: ratesLoading
                    ? "Kurlar yükleniyor…"
                    : rateOptions.length
                      ? "Kur seç"
                      : "Kur yok",
                },
                ...rateOptions.map((o) => ({
                  value: o.key,
                  label: `${o.label} (sell: ${fmt(o.value)})`,
                })),
              ]}
            />

            <FieldNumber
              label="Has Gram"
              value={form.hasGram}
              onChange={(v) => setForm((prev) => ({ ...prev, hasGram: v }))}
              disabled={
                form.priceOverrideEnabled ||
                !["weight_rate", "weight_rate_plus", "weight_rate_plus_fixed"].includes(form.priceMode)
              }
            />

            <FieldNumber
              label="Yüzde (%)"
              value={selectedCategoryPricing ? effectivePricePercent : form.pricePercent}
              onChange={(v) => setForm((prev) => ({ ...prev, pricePercent: v }))}
              disabled={
                !!selectedCategoryPricing ||
                form.priceOverrideEnabled ||
                !["rate_plus", "rate_plus_fixed", "weight_rate_plus", "weight_rate_plus_fixed"].includes(form.priceMode)
              }
            />

            <FieldNumber
              label={`Sabit Ek (${form.currency})`}
              value={selectedCategoryPricing ? effectivePriceFixedAdd : form.priceFixedAdd}
              onChange={(v) => setForm((prev) => ({ ...prev, priceFixedAdd: v }))}
              disabled={
                !!selectedCategoryPricing ||
                form.priceOverrideEnabled ||
                !["rate_plus_fixed", "weight_rate_plus_fixed"].includes(form.priceMode)
              }
            />
            {selectedCategoryPricing?.enabled ? (
              <div className={s.fieldHint}>
                Bu ürünün yüzde ve sabit ek değeri kategoriden miras alınıyor.
              </div>
            ) : null}
            <FieldNumber
              label={
                form.priceOverrideEnabled
                  ? "Override Fiyat"
                  : form.priceMode === "fixed"
                    ? "Sabit Fiyat"
                    : "Sabit (fallback)"
              }
              value={form.priceOverrideEnabled ? form.priceOverride : form.price}
              onChange={(v) => {
                if (form.priceOverrideEnabled) {
                  setForm((prev) => ({ ...prev, priceOverride: v }));
                } else {
                  setForm((prev) => ({ ...prev, price: v }));
                }
              }}
            />
          </div>
          <div className={s.formGrid3}>
            <CheckCard
              label="İndirim ayarını ürün bazında yönet"
              checked={!!form.compareAtOverrideEnabled}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  compareAtOverrideEnabled: v,
                }))
              }
            />

            <CheckCard
              label="İndirim aktif (üstü çizili eski fiyat)"
              checked={
                form.compareAtOverrideEnabled
                  ? !!form.compareAtEnabled
                  : !!selectedCategoryPricing?.compareAtEnabled
              }
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  compareAtEnabled: v,
                }))
              }
            />

            <FieldNumber
              label="İndirim Yüzdesi (%)"
              value={
                form.compareAtOverrideEnabled
                  ? Number(form.compareAtPercent ?? 0)
                  : Number(selectedCategoryPricing?.compareAtPercent ?? 0)
              }
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  compareAtPercent: v,
                }))
              }
              disabled={!form.compareAtOverrideEnabled}
            />
          </div>
          {!form.compareAtOverrideEnabled ? (
            <div className={s.fieldHint}>
              Bu ürün indirim ayarını kategoriden miras alıyor.
            </div>
          ) : null}
          {/* ── İkinci Fiyat Motoru ── */}
          <div className={s.cardHead} style={{ marginTop: 24, borderTop: '1px solid var(--border, #333)', paddingTop: 16 }}>
            <div>
              <h3 className={s.cardTitle}>İkinci Fiyat Motoru</h3>
              <p className={s.cardDesc}>Ürünün 2 ayrı kur/gram hesabı varsa ikinci motoru aç. Final fiyat = Motor 1 + Motor 2.</p>
            </div>
            <label className={s.switchRow}>
              <input
                type="checkbox"
                checked={form.price2Enabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    price2Enabled: e.target.checked,
                  }))
                }
              />
              <span>İkinci motor aktif</span>
            </label>
          </div>

          {form.price2Enabled ? (
            <div className={s.formGrid3}>
              <FieldSelect
                label="Mod (2)"
                value={form.price2Mode}
                onChange={(v) => setForm((prev) => ({ ...prev, price2Mode: v as PriceMode }))}
                options={[
                  { value: "fixed", label: "1) Sabit" },
                  { value: "rate_plus", label: "2) Kur + %" },
                  { value: "rate_plus_fixed", label: "3) Kur + % + Sabit" },
                  { value: "weight_rate", label: "4) Has Gram × Kur" },
                  { value: "weight_rate_plus", label: "5) Has Gram × Kur + %" },
                  { value: "weight_rate_plus_fixed", label: "6) Has Gram × Kur + % + Sabit" },
                ]}
              />

              <FieldSelect
                label="Kur (2)"
                value={form.price2RateCode || ""}
                onChange={(v) => setForm((prev) => ({ ...prev, price2RateCode: v }))}
                disabled={
                  !["rate_plus", "rate_plus_fixed", "weight_rate", "weight_rate_plus", "weight_rate_plus_fixed"].includes(form.price2Mode)
                }
                hint={ratesErr ? `Hata: ${ratesErr}` : ratesLoading ? "Kurlar yükleniyor…" : "Kaynak: rates/latest"}
                options={[
                  {
                    value: "",
                    label: ratesLoading ? "Kurlar yükleniyor…" : rateOptions.length ? "Kur seç" : "Kur yok",
                  },
                  ...rateOptions.map((o) => ({
                    value: o.key,
                    label: `${o.label} (sell: ${fmt(o.value)})`,
                  })),
                ]}
              />

              <FieldNumber
                label="Has Gram (2)"
                value={form.price2HasGram}
                onChange={(v) => setForm((prev) => ({ ...prev, price2HasGram: v }))}
                disabled={
                  !["weight_rate", "weight_rate_plus", "weight_rate_plus_fixed"].includes(form.price2Mode)
                }
              />

              <FieldNumber
                label="Yüzde (%) (2)"
                value={form.price2Percent}
                onChange={(v) => setForm((prev) => ({ ...prev, price2Percent: v }))}
                disabled={
                  !["rate_plus", "rate_plus_fixed", "weight_rate_plus", "weight_rate_plus_fixed"].includes(form.price2Mode)
                }
              />

              <FieldNumber
                label={`Sabit Ek (2) (${form.currency})`}
                value={form.price2FixedAdd}
                onChange={(v) => setForm((prev) => ({ ...prev, price2FixedAdd: v }))}
                disabled={
                  !["rate_plus_fixed", "weight_rate_plus_fixed"].includes(form.price2Mode)
                }
              />
            </div>
          ) : null}

          <div className={s.summaryBox}>
            <div className={s.summaryLabel}>Hesap Özeti</div>
            <div className={s.summaryText}>{calcSummary}</div>
          </div>
        </section>
      ) : null}
      {activeTab === "basic" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Temel Bilgiler</h2>
              <p className={s.cardDesc}>Ürünün başlık, slug, sku ve stok bilgilerini düzenle.</p>
            </div>
          </div>

          <div className={s.formGrid2}>
            <FieldText
              label="Başlık"
              value={form.title}
              onChange={(v) => setForm((prev) => ({ ...prev, title: v }))}
            />

            <FieldText
              label="Slug"
              value={form.slug}
              onChange={(v) => setForm((prev) => ({ ...prev, slug: v }))}
            />

            <FieldText
              label="SKU"
              value={form.sku}
              onChange={(v) => setForm((prev) => ({ ...prev, sku: v }))}
            />

            <FieldNumber
              label="Stok"
              value={form.stock}
              onChange={(v) => setForm((prev) => ({ ...prev, stock: v }))}
            />

            <FieldNumber
              label="Stok Alarm"
              value={form.stockAlarm}
              onChange={(v) => setForm((prev) => ({ ...prev, stockAlarm: v }))}
            />

            <FieldNumber
              label="Ayar"
              value={form.karat}
              onChange={(v) => setForm((prev) => ({ ...prev, karat: v }))}
            />

            <FieldNumber
              label="Gram"
              value={form.gram}
              onChange={(v) => setForm((prev) => ({ ...prev, gram: v }))}
            />
          </div>
        </section>
      ) : null}
      {activeTab === "media" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Görseller</h2>
              <p className={s.cardDesc}>Dosya yükle veya URL yapıştır. İlk görsel genelde kapak gibi davranır.</p>
            </div>

            <label className={s.uploadBtn}>
              + Görsel Yükle
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  await handleImageUpload(files);
                }}
              />
            </label>
          </div>

          {form.images?.length ? (
            <div className={s.imageGrid}>
              {form.images.map((url) => (
                <div key={url} className={s.imageCard}>
                  <img src={url} alt="" className={s.imageThumb} />
                  <button
                    type="button"
                    className={s.imageRemoveBtn}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        images: (prev.images || []).filter((x) => x !== url),
                      }))
                    }
                  >
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.emptyBox}>Henüz görsel eklenmedi.</div>
          )}
          <div className={s.mt12}>
            <FieldText
              label="Görsel Yoksa Kullanılacak Logo / Placeholder"
              value={form.fallbackImageUrl || FALLBACK_PRODUCT_LOGO}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  fallbackImageUrl: v || FALLBACK_PRODUCT_LOGO,
                }))
              }
            />

            <div className={s.fieldHint}>
              Ürün görseli eklenmezse sistem otomatik bu görseli kullanır. Örn: /dromocob-mark.svg
            </div>
          </div>
          <IconPackPicker
            label="Kart İkonu"
            value={(form as any).badgeIconUrl || ""}
            onChange={(url) => setForm((p) => ({ ...p, badgeIconUrl: url }))}
          />
          <div className={s.mt12}>
            <label className={s.label}>URL ile görsel listesi (satır satır)</label>
            <textarea
              className={s.textarea}
              value={imagesText}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  images: e.target.value
                    .split("\n")
                    .map((x) => str(x))
                    .filter(Boolean),
                }))
              }
              rows={5}
            />
          </div>
        </section>
      ) : null}
      {activeTab === "diamond" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>💎 Pırlanta / Değerli Taş Yönetimi</h2>

              <p className={s.cardDesc}>
                Pırlanta, değerli taş, sertifika, montür ve kalite
                özelliklerini profesyonel olarak yönet.
              </p>
            </div>

            <label className={s.switchRow}>
              <input
                type="checkbox"
                checked={!!form.advanced?.diamond?.enabled}
                onChange={(e) =>
                  updateDiamondField("enabled", e.target.checked)
                }
              />

              <span>Pırlanta özellikleri aktif</span>
            </label>
          </div>

          {form.advanced?.diamond?.enabled ? (
            <div className={s.sectionStack}>

              {/* METAL */}
              <div className={s.subCard}>
                <div className={s.subCardHead}>
                  <div>
                    <div className={s.subCardTitle}>
                      Metal & Montür
                    </div>

                    <div className={s.subCardDesc}>
                      Ürünün metal, renk, ayar ve montür özellikleri.
                    </div>
                  </div>
                </div>

                <div className={s.formGrid3}>
                  <FieldSelect
                    label="Metal"
                    value={form.advanced?.diamond?.metalType || ""}
                    onChange={(v) =>
                      updateDiamondField("metalType", v)
                    }
                    options={DIAMOND_METAL_TYPES}
                  />

                  <FieldSelect
                    label="Metal Rengi"
                    value={form.advanced?.diamond?.metalColor || ""}
                    onChange={(v) =>
                      updateDiamondField("metalColor", v)
                    }
                    options={DIAMOND_METAL_COLORS}
                  />

                  <FieldSelect
                    label="Metal Ayarı"
                    value={String(
                      form.advanced?.diamond?.metalKarat || ""
                    )}
                    onChange={(v) =>
                      updateDiamondField(
                        "metalKarat",
                        v ? Number(v) : undefined
                      )
                    }
                    options={[
                      { value: "", label: "Ayar seçiniz" },
                      { value: "8", label: "8 Ayar" },
                      { value: "9", label: "9 Ayar" },
                      { value: "10", label: "10 Ayar" },
                      { value: "14", label: "14 Ayar" },
                      { value: "18", label: "18 Ayar" },
                      { value: "22", label: "22 Ayar" },
                      { value: "24", label: "24 Ayar" },
                    ]}
                  />

                  <FieldSelect
                    label="Montür Tipi"
                    value={form.advanced?.diamond?.settingType || ""}
                    onChange={(v) =>
                      updateDiamondField("settingType", v)
                    }
                    options={DIAMOND_SETTING_TYPES}
                  />
                </div>

                <div className={s.checkGrid}>
                  <CheckCard
                    label="El İşçiliği"
                    checked={!!form.advanced?.diamond?.handmade}
                    onChange={(v) =>
                      updateDiamondField("handmade", v)
                    }
                  />
                </div>
              </div>

              {/* GENEL PIRLANTA */}
              <div className={s.subCard}>
                <div className={s.subCardHead}>
                  <div>
                    <div className={s.subCardTitle}>
                      Pırlanta Özeti
                    </div>

                    <div className={s.subCardDesc}>
                      Ürünün toplam taş ve karat bilgileri.
                    </div>
                  </div>
                </div>

                <div className={s.formGrid3}>
                  <FieldSelect
                    label="Pırlanta Türü"
                    value={
                      form.advanced?.diamond?.diamondOrigin || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("diamondOrigin", v)
                    }
                    options={DIAMOND_ORIGIN_OPTIONS}
                  />

                  <FieldNumber
                    label="Toplam Karat (ct)"
                    value={Number(
                      form.advanced?.diamond?.totalCarat ?? 0
                    )}
                    onChange={(v) =>
                      updateDiamondField("totalCarat", v)
                    }
                  />

                  <FieldNumber
                    label="Merkez Taş Karatı (ct)"
                    value={Number(
                      form.advanced?.diamond?.centerStoneCarat ?? 0
                    )}
                    onChange={(v) =>
                      updateDiamondField("centerStoneCarat", v)
                    }
                  />

                  <FieldNumber
                    label="Toplam Taş Adedi"
                    value={Number(
                      form.advanced?.diamond?.totalStoneQuantity ?? 0
                    )}
                    onChange={(v) =>
                      updateDiamondField(
                        "totalStoneQuantity",
                        Math.max(0, Math.floor(v))
                      )
                    }
                  />
                </div>
              </div>

              {/* KALİTE */}
              <div className={s.subCard}>
                <div className={s.subCardHead}>
                  <div>
                    <div className={s.subCardTitle}>
                      Kalite Detayları
                    </div>

                    <div className={s.subCardDesc}>
                      Pırlantanın ışık, işçilik ve işlem bilgileri.
                    </div>
                  </div>
                </div>

                <div className={s.formGrid3}>
                  <FieldSelect
                    label="Fluorescence"
                    value={
                      form.advanced?.diamond?.fluorescence || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("fluorescence", v)
                    }
                    options={DIAMOND_FLUORESCENCE_OPTIONS}
                  />

                  <FieldSelect
                    label="Polish"
                    value={form.advanced?.diamond?.polish || ""}
                    onChange={(v) =>
                      updateDiamondField("polish", v)
                    }
                    options={DIAMOND_GRADE_OPTIONS}
                  />

                  <FieldSelect
                    label="Symmetry"
                    value={form.advanced?.diamond?.symmetry || ""}
                    onChange={(v) =>
                      updateDiamondField("symmetry", v)
                    }
                    options={DIAMOND_GRADE_OPTIONS}
                  />

                  <FieldText
                    label="Treatment / İşlem"
                    value={
                      form.advanced?.diamond?.treatment || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("treatment", v)
                    }
                  />

                  <FieldText
                    label="Menşei"
                    value={form.advanced?.diamond?.origin || ""}
                    onChange={(v) =>
                      updateDiamondField("origin", v)
                    }
                  />
                </div>
              </div>

              {/* SERTİFİKA */}
              <div className={s.subCard}>
                <div className={s.subCardHead}>
                  <div>
                    <div className={s.subCardTitle}>
                      Sertifika
                    </div>

                    <div className={s.subCardDesc}>
                      GIA, IGI, HRD ve diğer sertifika bilgileri.
                    </div>
                  </div>
                </div>

                <div className={s.formGrid3}>
                  <FieldSelect
                    label="Sertifika Laboratuvarı"
                    value={
                      form.advanced?.diamond?.certificateLab || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("certificateLab", v)
                    }
                    options={DIAMOND_CERTIFICATE_LABS}
                  />

                  <FieldText
                    label="Sertifika Numarası"
                    value={
                      form.advanced?.diamond?.certificateNumber || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("certificateNumber", v)
                    }
                  />

                  <FieldText
                    label="Sertifika URL"
                    value={
                      form.advanced?.diamond?.certificateUrl || ""
                    }
                    onChange={(v) =>
                      updateDiamondField("certificateUrl", v)
                    }
                  />
                </div>

                <div className={s.mt12}>
                  <label className={s.label}>
                    Sertifika / Pırlanta Notu
                  </label>

                  <textarea
                    className={s.textarea}
                    rows={4}
                    value={
                      form.advanced?.diamond?.certificateNote || ""
                    }
                    onChange={(e) =>
                      updateDiamondField(
                        "certificateNote",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>

              {/* TAŞ GRUPLARI */}
              <div className={s.subCard}>
                <div className={s.subCardHead}>
                  <div>
                    <div className={s.subCardTitle}>
                      Taş Grupları
                    </div>

                    <div className={s.subCardDesc}>
                      Merkez taş, yan taş, halo veya farklı taşları
                      ayrı gruplar halinde tanımla.
                    </div>
                  </div>

                  <button
                    type="button"
                    className={s.addRowBtn}
                    onClick={addDiamondStoneGroup}
                  >
                    + Taş Grubu Ekle
                  </button>
                </div>

                {form.advanced?.diamond?.stoneGroups?.length ? (
                  <div className={s.detailRowList}>
                    {form.advanced.diamond.stoneGroups.map(
                      (stone, index) => (
                        <div
                          key={stone.id || index}
                          className={s.detailRowCard}
                        >
                          <div className={s.detailRowTop}>
                            <div className={s.detailRowNo}>
                              💎 Taş Grubu #{index + 1}
                            </div>

                            <button
                              type="button"
                              className={s.removeRowBtn}
                              onClick={() =>
                                removeDiamondStoneGroup(index)
                              }
                            >
                              Sil
                            </button>
                          </div>

                          <div className={s.formGrid3}>
                            <FieldSelect
                              label="Taş Türü"
                              value={stone.stoneType || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  stoneType: v,
                                })
                              }
                              options={DIAMOND_STONE_TYPES}
                            />

                            <FieldSelect
                              label="Kaynak"
                              value={stone.diamondOrigin || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  diamondOrigin: v,
                                })
                              }
                              options={STONE_ORIGIN_OPTIONS}
                            />

                            <FieldNumber
                              label="Toplam Karat (ct)"
                              value={Number(stone.weightCt ?? 0)}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  weightCt: v,
                                })
                              }
                            />

                            <FieldNumber
                              label="Taş Adedi"
                              value={Number(stone.quantity ?? 0)}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  quantity: Math.max(
                                    0,
                                    Math.floor(v)
                                  ),
                                })
                              }
                            />

                            <FieldSelect
                              label="Renk"
                              value={stone.color || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  color: v,
                                })
                              }
                              options={DIAMOND_COLOR_OPTIONS}
                            />

                            <FieldSelect
                              label="Berraklık"
                              value={stone.clarity || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  clarity: v,
                                })
                              }
                              options={DIAMOND_CLARITY_OPTIONS}
                            />

                            <FieldSelect
                              label="Kesim"
                              value={stone.cut || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  cut: v,
                                })
                              }
                              options={DIAMOND_CUT_OPTIONS}
                            />

                            <FieldSelect
                              label="Fluorescence"
                              value={stone.fluorescence || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  fluorescence: v,
                                })
                              }
                              options={
                                DIAMOND_FLUORESCENCE_OPTIONS
                              }
                            />

                            <FieldSelect
                              label="Polish"
                              value={stone.polish || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  polish: v,
                                })
                              }
                              options={DIAMOND_GRADE_OPTIONS}
                            />

                            <FieldSelect
                              label="Symmetry"
                              value={stone.symmetry || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  symmetry: v,
                                })
                              }
                              options={DIAMOND_GRADE_OPTIONS}
                            />

                            <FieldText
                              label="Treatment"
                              value={stone.treatment || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  treatment: v,
                                })
                              }
                            />

                            <FieldText
                              label="Menşei"
                              value={stone.origin || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  origin: v,
                                })
                              }
                            />

                            <FieldSelect
                              label="Sertifika"
                              value={stone.certificateLab || ""}
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  certificateLab: v,
                                })
                              }
                              options={DIAMOND_CERTIFICATE_LABS}
                            />

                            <FieldText
                              label="Sertifika No"
                              value={
                                stone.certificateNumber || ""
                              }
                              onChange={(v) =>
                                updateDiamondStoneGroup(index, {
                                  certificateNumber: v,
                                })
                              }
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className={s.emptyMini}>
                    Henüz taş grubu eklenmedi. Merkez taş veya yan
                    taşları ayrı ayrı ekleyebilirsin.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={s.emptyBox}>
              Bu ürün için pırlanta özellikleri kapalı. Yukarıdaki
              “Pırlanta özellikleri aktif” seçeneğini aç.
            </div>
          )}
        </section>
      ) : null}
      {activeTab === "content" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>İçerik Yönetimi</h2>
              <p className={s.cardDesc}>
                Kısa açıklama, detay metni, beden seçeneği, etiketler ve video alanlarını buradan yönet.
              </p>
            </div>
          </div>
          <div className={s.subCard}>
            <div className={s.subCardHead}>
              <div>
                <div className={s.subCardTitle}>Ürün Detay Satırları</div>
                <div className={s.subCardDesc}>
                  Ürün detay sekmesinde kart kart gösterilecek özel bilgiler.
                </div>
              </div>

              <button
                type="button"
                className={s.addRowBtn}
                onClick={addDetailRow}
              >
                + Satır Ekle
              </button>
            </div>

            {Array.isArray(form.advanced?.detailRows) && form.advanced.detailRows.length ? (
              <div className={s.detailRowList}>
                {form.advanced.detailRows.map((row, index) => (
                  <div key={row.id || index} className={s.detailRowCard}>
                    <div className={s.detailRowTop}>
                      <div className={s.detailRowNo}>Satır #{index + 1}</div>

                      <button
                        type="button"
                        className={s.removeRowBtn}
                        onClick={() => removeDetailRow(index)}
                      >
                        Sil
                      </button>
                    </div>

                    <div className={s.formGrid3}>
                      <div className={s.field}>
                        <label className={s.label}>İkon</label>
                        <select
                          className={s.input}
                          value={row.icon || ""}
                          onChange={(e) =>
                            updateDetailRow(index, { icon: e.target.value })
                          }
                        >
                          {DETAIL_ICON_OPTIONS.map((opt) => (
                            <option key={opt.value || "none"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <FieldText
                        label="Başlık (TR)"
                        value={String(row.label?.tr || "")}
                        onChange={(v) =>
                          updateDetailRow(index, {
                            label: { ...(row.label || {}), tr: v },
                          })
                        }
                      />

                      <FieldText
                        label="Başlık (EN)"
                        value={String(row.label?.en || "")}
                        onChange={(v) =>
                          updateDetailRow(index, {
                            label: { ...(row.label || {}), en: v },
                          })
                        }
                      />
                    </div>

                    <div className={s.formGrid2}>
                      <div className={s.field}>
                        <label className={s.label}>Değer (TR)</label>
                        <textarea
                          className={s.textarea}
                          rows={3}
                          value={String(row.value?.tr || "")}
                          onChange={(e) =>
                            updateDetailRow(index, {
                              value: { ...(row.value || {}), tr: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className={s.field}>
                        <label className={s.label}>Değer (EN)</label>
                        <textarea
                          className={s.textarea}
                          rows={3}
                          value={String(row.value?.en || "")}
                          onChange={(e) =>
                            updateDetailRow(index, {
                              value: { ...(row.value || {}), en: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.emptyMini}>
                Henüz detay satırı eklenmedi.
              </div>
            )}
          </div>
          <div className={s.sectionStack}>
            <div className={s.subCard}>
              <div className={s.subCardHead}>
                <div>
                  <div className={s.subCardTitle}>Kısa Açıklama</div>
                  <div className={s.subCardDesc}>
                    Kart ve ürün üst alanında görünen kısa metin.
                  </div>
                </div>
              </div>

              <div className={s.formGrid2}>
                <div className={s.field}>
                  <label className={s.label}>Kısa Açıklama (TR)</label>
                  <textarea
                    className={s.textarea}
                    rows={3}
                    value={form.advanced?.shortDescription?.tr || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          shortDescription: {
                            ...(prev.advanced?.shortDescription || {}),
                            tr: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>

                <div className={s.field}>
                  <label className={s.label}>Kısa Açıklama (EN)</label>
                  <textarea
                    className={s.textarea}
                    rows={3}
                    value={form.advanced?.shortDescription?.en || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          shortDescription: {
                            ...(prev.advanced?.shortDescription || {}),
                            en: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className={s.subCard}>
              <div className={s.subCardHead}>
                <div>
                  <div className={s.subCardTitle}>Detay Açıklaması</div>
                  <div className={s.subCardDesc}>
                    Ürün detay sayfasındaki ana açıklama alanı.
                  </div>
                </div>
              </div>

              <div className={s.formGrid2}>
                <div className={s.field}>
                  <label className={s.label}>Detay Açıklama (TR)</label>
                  <textarea
                    className={s.textarea}
                    rows={8}
                    value={form.advanced?.description?.tr || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          description: {
                            ...(prev.advanced?.description || {}),
                            tr: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>

                <div className={s.field}>
                  <label className={s.label}>Detay Açıklama (EN)</label>
                  <textarea
                    className={s.textarea}
                    rows={8}
                    value={form.advanced?.description?.en || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          description: {
                            ...(prev.advanced?.description || {}),
                            en: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* ── Ürün Ölçüleri ── */}
            <div className={s.subCard}>
              <div className={s.subCardHead}>
                <div>
                  <div className={s.subCardTitle}>📏 Ürün Ölçüleri</div>
                  <div className={s.subCardDesc}>
                    Boş bırakılan alanlar ürün detay sayfasında görünmez. Doldurduğunuz değerler otomatik olarak &ldquo;Teknik Özellikler&rdquo; tablosunda gösterilir.
                  </div>
                </div>
              </div>

              <div className={s.formGrid2}>
                <div className={s.field}>
                  <label className={s.label}>En (mm)</label>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Örn: 15"
                    value={form.advanced?.specs?.widthMm ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          specs: {
                            ...(prev.advanced?.specs || {}),
                            widthMm: e.target.value === "" ? undefined : Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                  <div className={s.inputHint}>Ürünün genişliği (milimetre)</div>
                </div>

                <div className={s.field}>
                  <label className={s.label}>Boy (mm)</label>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Örn: 40"
                    value={form.advanced?.specs?.heightMm ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          specs: {
                            ...(prev.advanced?.specs || {}),
                            heightMm: e.target.value === "" ? undefined : Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                  <div className={s.inputHint}>Ürünün yüksekliği (milimetre)</div>
                </div>

                <div className={s.field}>
                  <label className={s.label}>Uzunluk (cm)</label>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Örn: 45"
                    value={form.advanced?.specs?.lengthMm != null ? Math.round((Number(form.advanced.specs.lengthMm) / 10) * 100) / 100 : ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          specs: {
                            ...(prev.advanced?.specs || {}),
                            lengthMm: e.target.value === "" ? undefined : Number(e.target.value) * 10,
                          },
                        },
                      }))
                    }
                  />
                  <div className={s.inputHint}>Zincir / kolye uzunluğu (santimetre)</div>
                </div>

                <div className={s.field}>
                  <label className={s.label}>Ağırlık (gr)</label>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Örn: 3.5"
                    value={form.advanced?.specs?.weightGr ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          specs: {
                            ...(prev.advanced?.specs || {}),
                            weightGr: e.target.value === "" ? undefined : Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                  <div className={s.inputHint}>Ürünün ağırlığı (gram)</div>
                </div>
              </div>
            </div>

            <div className={s.subCard}>
              <div className={s.subCardHead}>
                <div>
                  <div className={s.subCardTitle}>Ürün Opsiyonları</div>
                  <div className={s.subCardDesc}>
                    Bu üründe beden seçeneği kullanılacaksa buradan aktif et.
                  </div>
                </div>
              </div>

              <div className={s.optionGrid}>
                <label className={s.toggleCard}>
                  <input
                    type="checkbox"
                    checked={!!form.advanced?.hasSizeOptions}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...(prev.advanced || {}),
                          hasSizeOptions: e.target.checked,
                          sizes: e.target.checked ? (prev.advanced?.sizes || []) : [],
                        },
                      }))
                    }
                  />
                  <span className={s.toggleCardBody}>
                    <span className={s.toggleCardTitle}>Beden Seçeneği Aktif</span>
                    <span className={s.toggleCardDesc}>
                      Açılırsa ürün detayında beden seçenekleri gösterilebilir.
                    </span>
                  </span>
                </label>
              </div>

              {form.advanced?.hasSizeOptions ? (
                <div className={s.mt16}>
                  <TextListEditor
                    title="Beden Seçenekleri"
                    placeholder="Örn: 8\n10\n12\n14"
                    value={form.advanced?.sizes || []}
                    onChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        advanced: { ...(prev.advanced || {}), sizes: v },
                      }))
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className={s.subCard}>
              <div className={s.subCardHead}>
                <div>
                  <div className={s.subCardTitle}>Etiketler ve Medya</div>
                  <div className={s.subCardDesc}>
                    Etiket, video linki ve ek içerik alanları.
                  </div>
                </div>
              </div>

              <div className={s.formGrid2}>
                <TextListEditor
                  title="Etiketler"
                  placeholder="Örn: Zarif\nGünlük\nHediye"
                  value={form.advanced?.tags || []}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      advanced: { ...(prev.advanced || {}), tags: v },
                    }))
                  }
                />

                <TextListEditor
                  title="Video URL"
                  placeholder="Her satıra bir video linki"
                  value={form.advanced?.galleryVideos || []}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      advanced: { ...(prev.advanced || {}), galleryVideos: v },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {activeTab === "shipping" ? (
        <>
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Kargo / Ölçüler / İade</h2>
                <p className={s.cardDesc}>Ürün ölçüleri, teslimat ayarları ve iade içerikleri.</p>
              </div>
            </div>

            <div className={s.formGrid2}>
              <FieldNumber
                label="Ağırlık (gr)"
                value={Number(form.advanced?.specs?.weightGr ?? 0)}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      specs: { ...(prev.advanced?.specs || {}), weightGr: v },
                    },
                  }))
                }
              />

              <FieldNumber
                label="Genişlik (mm)"
                value={Number(form.advanced?.specs?.widthMm ?? 0)}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      specs: { ...(prev.advanced?.specs || {}), widthMm: v },
                    },
                  }))
                }
              />

              <FieldNumber
                label="Uzunluk (cm)"
                value={Math.round((Number(form.advanced?.specs?.lengthMm ?? 0) / 10) * 100) / 100}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      specs: { ...(prev.advanced?.specs || {}), lengthMm: v * 10 },
                    },
                  }))
                }
              />

              <FieldNumber
                label="Yükseklik (mm)"
                value={Number(form.advanced?.specs?.heightMm ?? 0)}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      specs: { ...(prev.advanced?.specs || {}), heightMm: v },
                    },
                  }))
                }
              />
            </div>
          </section>
        </>
      ) : null}
      {activeTab === "seo" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>SEO Merkezi</h2>
              <p className={s.cardDesc}>
                Ürün başlığı, açıklama, görsel ve etiketlerden otomatik SEO metni üret.
              </p>
            </div>

            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => {
                const seo = autoFillSeoPayload(form);

                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      ...seo,
                    },
                  },
                }));

                showToast("SEO alanları otomatik oluşturuldu ✅");
              }}
            >
              Otomatik SEO Oluştur
            </button>
          </div>

          <div className={s.seoPreviewCard}>
            <div className={s.seoPreviewLabel}>Google Önizleme</div>

            <div className={s.googleTitle}>
              {form.advanced?.seo?.title?.tr || buildSeoTitle(form, "tr")}
            </div>

            <div className={s.googleUrl}>
              Dromocob.com{form.advanced?.seo?.canonical || buildCanonical(form)}
            </div>

            <div className={s.googleDesc}>
              {form.advanced?.seo?.description?.tr || buildSeoDescription(form, "tr")}
            </div>
          </div>

          <div className={s.formGrid2}>
            <FieldText
              label="SEO Title (TR)"
              value={form.advanced?.seo?.title?.tr || ""}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      title: { ...(prev.advanced?.seo?.title || {}), tr: v },
                    },
                  },
                }))
              }
            />

            <FieldText
              label="SEO Title (EN)"
              value={form.advanced?.seo?.title?.en || ""}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      title: { ...(prev.advanced?.seo?.title || {}), en: v },
                    },
                  },
                }))
              }
            />
          </div>

          <div className={s.formGrid2}>
            <div className={s.field}>
              <label className={s.label}>SEO Açıklama (TR)</label>
              <textarea
                className={s.textarea}
                rows={4}
                value={form.advanced?.seo?.description?.tr || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      seo: {
                        ...(prev.advanced?.seo || {}),
                        description: {
                          ...(prev.advanced?.seo?.description || {}),
                          tr: e.target.value,
                        },
                      },
                    },
                  }))
                }
              />
              <div className={s.fieldHint}>
                Öneri: 140-155 karakter arası. Şu an:{" "}
                {(form.advanced?.seo?.description?.tr || "").length}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.label}>SEO Açıklama (EN)</label>
              <textarea
                className={s.textarea}
                rows={4}
                value={form.advanced?.seo?.description?.en || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      seo: {
                        ...(prev.advanced?.seo || {}),
                        description: {
                          ...(prev.advanced?.seo?.description || {}),
                          en: e.target.value,
                        },
                      },
                    },
                  }))
                }
              />
              <div className={s.fieldHint}>
                Recommended: 140-155 characters. Current:{" "}
                {(form.advanced?.seo?.description?.en || "").length}
              </div>
            </div>
          </div>

          <div className={s.formGrid2}>
            <FieldText
              label="Canonical URL"
              value={form.advanced?.seo?.canonical || ""}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      canonical: v,
                    },
                  },
                }))
              }
            />

            <FieldText
              label="OG Image"
              value={form.advanced?.seo?.ogImage || ""}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      ogImage: v,
                    },
                  },
                }))
              }
            />
          </div>

          <div className={s.subCard}>
            <div className={s.subCardHead}>
              <div>
                <div className={s.subCardTitle}>Anahtar Kelimeler</div>
                <div className={s.subCardDesc}>
                  Her satıra bir keyword gir. Otomatik oluşturma başlık, ayar, gram ve etiketleri kullanır.
                </div>
              </div>

              <button
                type="button"
                className={s.secondaryBtn}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    advanced: {
                      ...(prev.advanced || {}),
                      seo: {
                        ...(prev.advanced?.seo || {}),
                        keywords: buildSeoKeywords(prev),
                      },
                    },
                  }))
                }
              >
                Keyword Üret
              </button>
            </div>

            <TextListEditor
              title="SEO Keywords"
              placeholder={"özel tasarım\n22 ayar yüzük\nhediye altın"}
              value={form.advanced?.seo?.keywords || []}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  advanced: {
                    ...(prev.advanced || {}),
                    seo: {
                      ...(prev.advanced?.seo || {}),
                      keywords: v,
                    },
                  },
                }))
              }
            />
          </div>
        </section>
      ) : null}
      {activeTab === "categories" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Kategoriler</h2>
              <p className={s.cardDesc}>Kategori ağacını buradan seç. Gerekirse parent otomatik eklensin.</p>
            </div>
          </div>

          {catsLoading ? (
            <div className={s.emptyBox}>Kategoriler yükleniyor…</div>
          ) : catsErr ? (
            <div className={s.errorBox}>{catsErr}</div>
          ) : (
            <CategoryPicker
              cats={cats.filter((c) => c.isActive !== false)}
              value={form.categoryIds || []}
              onChange={(next) => setForm((prev) => ({ ...prev, categoryIds: next }))}
              loc="tr"
              autoIncludeParent={true}
            />
          )}
        </section>
      ) : null}
      {activeTab === "variants" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Ürün Ölçü / Varyant Yönetimi</h2>
              <p className={s.cardDesc}>
                Bu ürüne özel ölçü, has gram ve TL farkı tanımla. Ürün detayında kategori presetinden önce bu alan kullanılacak.
              </p>
            </div>

            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  productVariantPreset: {
                    enabled: true,
                    groups: [
                      {
                        id: "ring_size",
                        label: { tr: "Yüzük Ölçüsü", en: "Ring Size" },
                        type: "select",
                        required: true,
                        options: Array.from({ length: 23 }).map((_, i) => {
                          const n = i + 8;
                          return {
                            value: String(n),
                            label: { tr: String(n), en: String(n) },
                            hasGram: 0,
                            weightGram: 0,
                            priceDelta: 0,
                            stockDelta: 0,
                            isActive: true,
                            order: n,
                          };
                        }),
                      },
                    ],
                  },
                }))
              }
            >
              + Yüzük Ölçüsü Preseti
            </button>
          </div>

          <div className={s.checkGrid}>
            <CheckCard
              label="Bu üründe özel varyant kullan"
              checked={!!form.productVariantPreset?.enabled}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  productVariantPreset: {
                    enabled: v,
                    groups: prev.productVariantPreset?.groups || [],
                  },
                }))
              }
            />
          </div>

          {form.productVariantPreset?.groups?.length ? (
            <div className={s.variantEditList}>
              {form.productVariantPreset.groups.map((group, groupIndex) => (
                <div key={`${group.id}-${groupIndex}`} className={s.variantEditCard}>
                  <div className={s.formGrid3}>
                    <FieldText
                      label="Grup ID"
                      value={group.id}
                      onChange={(v) =>
                        setForm((prev) => {
                          const preset = cleanProductVariantPreset(prev.productVariantPreset);
                          const groups = [...preset.groups];

                          groups[groupIndex] = {
                            ...groups[groupIndex],
                            id: toPathSafe(v) || "variant",
                          };

                          return {
                            ...prev,
                            productVariantPreset: {
                              ...preset,
                              groups,
                            },
                          };
                        })
                      }
                    />

                    <FieldText
                      label="Başlık TR"
                      value={group.label?.tr || ""}
                      onChange={(v) =>
                        setForm((prev) => {
                          const preset = cleanProductVariantPreset(prev.productVariantPreset);
                          const groups = [...preset.groups];

                          groups[groupIndex] = {
                            ...groups[groupIndex],
                            label: {
                              ...(groups[groupIndex].label || {}),
                              tr: v,
                            },
                          };

                          return {
                            ...prev,
                            productVariantPreset: {
                              ...preset,
                              groups,
                            },
                          };
                        })
                      }
                    />

                    <FieldText
                      label="Başlık EN"
                      value={group.label?.en || ""}
                      onChange={(v) =>
                        setForm((prev) => {
                          const preset = cleanProductVariantPreset(prev.productVariantPreset);
                          const groups = [...preset.groups];

                          groups[groupIndex] = {
                            ...groups[groupIndex],
                            label: {
                              ...(groups[groupIndex].label || {}),
                              en: v,
                            },
                          };

                          return {
                            ...prev,
                            productVariantPreset: {
                              ...preset,
                              groups,
                            },
                          };
                        })
                      }
                    />
                    <FieldSelect
                      label="Gösterim Tipi"
                      value={group.type || "select"}
                      onChange={(v) =>
                        setForm((prev) => {
                          const preset = cleanProductVariantPreset(prev.productVariantPreset);
                          const groups = [...preset.groups];

                          groups[groupIndex] = {
                            ...groups[groupIndex],
                            type: v as VariantGroup["type"],
                          };

                          return {
                            ...prev,
                            productVariantPreset: {
                              ...preset,
                              groups,
                            },
                          };
                        })
                      }
                      options={VARIANT_DISPLAY_TYPES}
                    />
                  </div>

                  <div className={s.variantTableHead}>
                    <span>Değer</span>
                    <span>TR Etiket</span>
                    <span>EN Etiket</span>
                    <span>Has Gram</span>
                    <span>TL Fark</span>
                    <span>İşlem</span>
                  </div>

                  <div className={s.variantRows}>
                    {group.options.map((option, optionIndex) => (
                      <div key={`${group.id}-${optionIndex}`} className={s.variantTableRow}>
                        <input
                          className={s.input}
                          value={option.value}
                          placeholder="8"
                          onChange={(e) => {
                            const value = e.target.value.trim();

                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];
                              const options = [...groups[groupIndex].options];

                              options[optionIndex] = {
                                ...options[optionIndex],
                                value,
                                label: {
                                  ...(options[optionIndex].label || {}),
                                  tr: options[optionIndex].label?.tr || value,
                                },
                              };

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options,
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        />

                        <input
                          className={s.input}
                          value={option.label?.tr || ""}
                          placeholder="8"
                          onChange={(e) => {
                            const value = e.target.value;

                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];
                              const options = [...groups[groupIndex].options];

                              options[optionIndex] = {
                                ...options[optionIndex],
                                label: {
                                  ...(options[optionIndex].label || {}),
                                  tr: value,
                                },
                              };

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options,
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        />

                        <input
                          className={s.input}
                          value={option.label?.en || ""}
                          placeholder="Size 8"
                          onChange={(e) => {
                            const value = e.target.value;

                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];
                              const options = [...groups[groupIndex].options];

                              options[optionIndex] = {
                                ...options[optionIndex],
                                label: {
                                  ...(options[optionIndex].label || {}),
                                  en: value,
                                },
                              };

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options,
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        />

                        <input
                          className={s.input}
                          type="number"
                          step="0.0001"
                          min={0}
                          value={option.hasGram ?? option.weightGram ?? 0}
                          placeholder="2.3500"
                          onChange={(e) => {
                            const value = cleanVariantNumber(e.target.value);

                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];
                              const options = [...groups[groupIndex].options];

                              options[optionIndex] = {
                                ...options[optionIndex],
                                hasGram: value,
                                weightGram: value,
                              };

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options,
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        />

                        <input
                          className={s.input}
                          type="number"
                          step="0.01"
                          min={0}
                          value={option.priceDelta ?? 0}
                          placeholder="0"
                          onChange={(e) => {
                            const value = cleanVariantNumber(e.target.value);

                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];
                              const options = [...groups[groupIndex].options];

                              options[optionIndex] = {
                                ...options[optionIndex],
                                priceDelta: value,
                              };

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options,
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        />

                        <button
                          type="button"
                          className={s.dangerBtn}
                          onClick={() => {
                            setForm((prev) => {
                              const preset = cleanProductVariantPreset(prev.productVariantPreset);
                              const groups = [...preset.groups];

                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options: groups[groupIndex].options.filter(
                                  (_, i) => i !== optionIndex
                                ),
                              };

                              return {
                                ...prev,
                                productVariantPreset: {
                                  ...preset,
                                  groups,
                                },
                              };
                            });
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={s.mt12}>
                    <button
                      type="button"
                      className={s.secondaryBtn}
                      onClick={() => {
                        setForm((prev) => {
                          const preset = cleanProductVariantPreset(prev.productVariantPreset);
                          const groups = [...preset.groups];
                          const options = [...groups[groupIndex].options];

                          options.push({
                            value: "",
                            label: { tr: "", en: "" },
                            hasGram: 0,
                            weightGram: 0,
                            priceDelta: 0,
                            stockDelta: 0,
                            isActive: true,
                            order: options.length + 1,
                          });

                          groups[groupIndex] = {
                            ...groups[groupIndex],
                            options,
                          };

                          return {
                            ...prev,
                            productVariantPreset: {
                              ...preset,
                              groups,
                            },
                          };
                        });
                      }}
                    >
                      + Seçenek Ekle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.emptyBox}>
              Henüz ürün bazlı varyant yok. “Yüzük Ölçüsü Preseti” ile başla.
            </div>
          )}
        </section>
      ) : null}
      {activeTab === "bundle" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Set Olarak Satın Al</h2>
              <p className={s.cardDesc}>Bu ürün için ilişkili set ürünlerini belirle.</p>
            </div>
          </div>

          <div className={s.checkGrid}>
            <CheckCard
              label="Set önerisini aktif et"
              checked={!!form.setBundleEnabled}
              onChange={(v) => setForm((prev) => ({ ...prev, setBundleEnabled: v }))}
            />
          </div>

          <div className={s.formGrid2}>
            <FieldText
              label="Set Başlık (TR)"
              value={String(form.setBundleTitle?.tr || "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  setBundleTitle: { ...(prev.setBundleTitle || {}), tr: v },
                }))
              }
            />

            <FieldText
              label="Set Başlık (EN)"
              value={String(form.setBundleTitle?.en || "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  setBundleTitle: { ...(prev.setBundleTitle || {}), en: v },
                }))
              }
            />
          </div>

          <div className={s.mt12}>
            <label className={s.label}>Set Alt Yazı (TR)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={String(form.setBundleSubtitle?.tr || "")}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  setBundleSubtitle: { ...(prev.setBundleSubtitle || {}), tr: e.target.value },
                }))
              }
            />
          </div>

          <div className={s.mt12}>
            <label className={s.label}>Set Alt Yazı (EN)</label>
            <textarea
              className={s.textarea}
              rows={3}
              value={String(form.setBundleSubtitle?.en || "")}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  setBundleSubtitle: { ...(prev.setBundleSubtitle || {}), en: e.target.value },
                }))
              }
            />
          </div>

          <div className={s.formGrid3}>
            <FieldSelect
              label="İndirim Tipi"
              value={form.setBundleDiscountType}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  setBundleDiscountType: v as "none" | "fixed" | "percent",
                }))
              }
              options={[
                { value: "none", label: "İndirim yok" },
                { value: "fixed", label: "Sabit tutar" },
                { value: "percent", label: "Yüzde" },
              ]}
            />

            <FieldNumber
              label="İndirim Değeri"
              value={Number(form.setBundleDiscountValue ?? 0)}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, setBundleDiscountValue: v }))
              }
            />
          </div>

          <div className={s.mt12}>
            <label className={s.label}>Set Ürünleri</label>

            {/* Seçili ürünler */}
            {(form.setBundleProductIds || []).length > 0 ? (
              <div className={s.bundleSelectedList}>
                {(form.setBundleProductIds || []).map((pid, idx) => {
                  const meta = bundleProductMeta[pid];
                  return (
                    <div key={`${pid}-${idx}`} className={s.bundleSelectedItem}>
                      {meta?.image ? (
                        <img
                          src={meta.image}
                          alt=""
                          className={s.bundleSelectedThumb}
                        />
                      ) : (
                        <div className={s.bundleSelectedThumb} />
                      )}
                      <div className={s.bundleSelectedInfo}>
                        <div className={s.bundleSelectedTitle}>
                          {meta?.title || pid}
                        </div>
                        <div className={s.bundleSelectedMeta}>
                          {meta?.sku ? `SKU: ${meta.sku}` : ""}{meta?.sku && meta?.slug ? " · " : ""}{meta?.slug ? `/${meta.slug}` : pid}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={s.bundleSelectedRemove}
                        title="Kaldır"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            setBundleProductIds: (prev.setBundleProductIds || []).filter(
                              (_, i) => i !== idx
                            ),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={s.bundleEmptyNote}>
                Henüz set ürünü eklenmedi. Aşağıdan arayıp ekleyebilirsin.
              </div>
            )}

            {/* Ürün arama */}
            <div className={`${s.productPickerWrap} ${s.mt12}`}>
              <div className={s.productPickerSearchRow}>
                <input
                  className={s.productPickerInput}
                  placeholder="Ürün adı, SKU veya slug ile ara..."
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBundleSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  className={s.productPickerSearchBtn}
                  disabled={bundleSearchBusy}
                  onClick={handleBundleSearch}
                >
                  {bundleSearchBusy ? "Aranıyor..." : "Ara"}
                </button>
              </div>

              {bundleSearchMsg ? (
                <div className={s.productPickerMsg}>{bundleSearchMsg}</div>
              ) : null}

              {bundleSearchResults.length > 0 ? (
                <div className={s.productPickerResults}>
                  {bundleSearchResults.map((product) => {
                    const alreadySelected = (form.setBundleProductIds || []).includes(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`${s.productPickerResultItem} ${alreadySelected ? s.productPickerSelectedAlready : ""}`}
                        onClick={() => {
                          if (alreadySelected) return;
                          setForm((prev) => ({
                            ...prev,
                            setBundleProductIds: [
                              ...(prev.setBundleProductIds || []),
                              product.id,
                            ],
                          }));
                          setBundleProductMeta((prev) => ({
                            ...prev,
                            [product.id]: {
                              title: product.title,
                              image: product.image,
                              sku: product.sku,
                              slug: product.slug,
                            },
                          }));
                        }}
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            className={s.productPickerResultThumb}
                          />
                        ) : (
                          <div className={s.productPickerResultThumb} />
                        )}
                        <div className={s.productPickerResultInfo}>
                          <div className={s.productPickerResultTitle}>
                            {product.title}
                          </div>
                          <div className={s.productPickerResultMeta}>
                            {product.sku ? `SKU: ${product.sku}` : ""}{product.sku && product.slug ? " · " : ""}{product.slug ? `/${product.slug}` : product.id}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={s.productPickerResultAdd}
                          title={alreadySelected ? "Zaten eklendi" : "Ekle"}
                        >
                          {alreadySelected ? "✓" : "+"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {activeTab === "home" ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Anasayfa & Görünürlük</h2>
              <p className={s.cardDesc}>Ürünün aktifliği ve anasayfa sekmelerindeki görünürlüğü.</p>
            </div>
          </div>
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h2 className={s.cardTitle}>Anasayfa Showcase</h2>
                <p className={s.cardDesc}>
                  Ürünün ana sayfadaki özel slider alanlarında görünmesini buradan yönet.
                </p>
              </div>
            </div>

            <div className={s.checkGrid}>
              <CheckCard
                label="Showcase'te Göster"
                checked={!!form.showcaseEnabled}
                onChange={(v) => setForm((prev) => ({ ...prev, showcaseEnabled: v }))}
              />

              <CheckCard
                label="Yeni Modeller"
                checked={form.showcaseGroups.includes("new")}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    showcaseGroups: v
                      ? Array.from(new Set([...(prev.showcaseGroups || []), "new"]))
                      : (prev.showcaseGroups || []).filter((x) => x !== "new"),
                  }))
                }
              />

              <CheckCard
                label="Elegance"
                checked={form.showcaseGroups.includes("elegance")}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    showcaseGroups: v
                      ? Array.from(new Set([...(prev.showcaseGroups || []), "elegance"]))
                      : (prev.showcaseGroups || []).filter((x) => x !== "elegance"),
                  }))
                }
              />
            </div>

            <div className={s.formGrid2}>
              <FieldNumber
                label="Showcase Sırası"
                value={Number(form.showcaseOrder ?? 999)}
                onChange={(v) => setForm((prev) => ({ ...prev, showcaseOrder: v }))}
              />
            </div>
          </section>



          <div className={s.checkGrid}>
            <CheckCard
              label="Aktif"
              checked={!!form.isActive}
              onChange={(v) => setForm((prev) => ({ ...prev, isActive: v }))}
            />

            {(popularTabs?.length
              ? popularTabs
              : [
                { key: "bestsellers", label: { tr: "Çok Satanlar", en: "Bestsellers" } },
                { key: "featured", label: { tr: "Gözde", en: "Featured" } },
              ]
            )
              .filter((t) => str(t?.key) && str(t.key) !== "all")
              .map((tab) => {
                const key = str(tab.key);
                const label = pickTextLocal(tab.label ?? key, "tr") || key;
                const checked = Array.isArray(form.homeSections) && form.homeSections.includes(key);

                return (
                  <CheckCard
                    key={key}
                    label={label}
                    checked={checked}
                    onChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        homeSections: toggleHomeSection(prev.homeSections || [], key, v),
                      }))
                    }
                  />
                );
              })}
          </div>
        </section>
      ) : null}

    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      <input className={s.input} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      <input
        className={s.input}
        type="number"
        value={String(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      <select
        className={s.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={`${opt.value}-${opt.label}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <div className={s.fieldHint}>{hint}</div> : null}
    </div>
  );
}
function TextListEditor({
  title,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{title}</label>
      <textarea
        className={s.textarea}
        rows={6}
        placeholder={placeholder}
        value={(value || []).join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((x) => String(x || "").trim())
              .filter(Boolean)
          )
        }
      />
      <div className={s.fieldHint}>Her satıra bir değer gir.</div>
    </div>
  );
}

function CheckCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={s.checkCard}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}