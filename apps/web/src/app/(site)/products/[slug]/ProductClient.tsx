"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RecentlyViewed, { trackRecentlyViewed } from "@/components/RecentlyViewed";
import { trackProductView, trackCartAdd } from "@/components/AnalyticsTracker";
import { trackMetaViewContent, trackMetaAddToCart } from "@/lib/metaPixel";
import ImageZoom from "@/components/ImageZoom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { useT } from "@/lib/useT";
import { pickText } from "@/lib/homeApi";
import { useFavorites, type FavItem } from "@/lib/favorites";
import { addToCart, getCart, type CartItem } from "@/lib/cart";
import { saveCartItemToFirestore } from "@/lib/cartFirestore";
import { RatesLatest, resolveProductPriceTRY, formatTRY } from "@/lib/pricing";
import styles from "./ProductClient.module.css";
import { onIdTokenChanged, type User } from "firebase/auth";
const FALLBACK_IMG = "/dromocob-mark.svg";
/* ---------- utils ---------- */
function s(v: any) {
  return String(v ?? "").trim();
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function asArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return Object.values(v as any);
  return [];
}
function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function imgList(p: any): string[] {
  const arr = Array.isArray(p?.images) ? p.images : [];
  const m = [p?.mainImage, p?.image, p?.cover, p?.thumbnail, ...arr]
    .filter((x) => typeof x === "string")
    .map((x) => s(x))
    .filter(Boolean);
  const u = Array.from(new Set(m));
  return u.length ? u : [FALLBACK_IMG];
}
function getCurrentCartQty(
  productId: string,
  uid?: string | null,
  selectedSize?: string
) {
  try {
    const items = getCart(uid || null);
    const pid = String(productId || "").trim();
    const size = String(selectedSize ?? "").trim();

    return items
      .filter((it) => {
        const itemId = String(it?.id || "").trim();
        const itemProductId = String((it as any)?.productId || "").trim();

        const sameProduct = itemId === pid || itemProductId === pid;
        if (!sameProduct) return false;

        // selectedSize verilmezse aynı ürünün tüm ölçülerini say.
        if (!size) return true;

        return String((it as any)?.selectedSize || "").trim() === size;
      })
      .reduce((sum, it) => sum + Math.max(1, Number(it?.qty || 1)), 0);
  } catch {
    return 0;
  }
}

type LocaleText = {
  tr?: string;
  en?: string;
};

type VariantOption = {
  value: string;
  label: LocaleText;

  // Ölçüye göre gram hesabı için
  hasGram?: number;
  weightGram?: number;

  // Sabit TL farkı gerekiyorsa ayrıca kullanılır
  priceDelta?: number;
  stockDelta?: number;
  isActive?: boolean;
  order?: number;
};
type SelectedVariantItemUI = {
  groupId: string;
  groupLabel: string;
  value: string;
  label: string;
  priceDelta: number;
  hasGram?: number;
  weightGram?: number;
};
type VariantGroup = {
  id: string;
  label: LocaleText;
  type: "select" | "button" | "radio";
  required: boolean;
  options: VariantOption[];
};

type CategoryVariantPreset = {
  enabled: boolean;
  groups: VariantGroup[];
};

type CatMini = {
  id: string;
  name: any;
  slug: string;
  image?: string;
  pricing?: any;
  variantPreset?: CategoryVariantPreset | null;
};
function extractCategoryIds(p: any): string[] {
  const raw = p?.categoryIds ?? p?.categories ?? p?.categoryId ?? p?.catIds ?? p?.cats ?? [];
  if (typeof raw === "string") return raw ? [raw] : [];
  const arr = asArray<any>(raw)
    .map((x) => (typeof x === "string" ? x : x?.id ?? x?.value ?? ""))
    .map((x) => s(x))
    .filter(Boolean);
  return uniq(arr);
}
function sanitizeVariantPreset(v: any): CategoryVariantPreset | null {
  if (!v || typeof v !== "object") return null;

  const groupsRaw: any[] = Array.isArray(v.groups) ? v.groups : [];

  const groups: VariantGroup[] = groupsRaw
    .map((g: any): VariantGroup | null => {
      const groupId = s(g?.id || g?.label?.tr || "variant");
      const optionsRaw: any[] = Array.isArray(g?.options) ? g.options : [];

      const options: VariantOption[] = optionsRaw
        .map((o: any, index: number): VariantOption | null => {
          const value = s(o?.value ?? o?.label?.tr ?? "");
          if (!value) return null;

          const hasGramRaw =
            o?.hasGram ??
            o?.weightGram ??
            o?.gram ??
            o?.priceWeightGram ??
            0;

          const hasGram =
            Math.max(0, Math.round((Number(hasGramRaw) || 0) * 10000) / 10000);

          return {
            value,
            label: {
              tr: s(o?.label?.tr) || value,
              en: s(o?.label?.en),
            },

            ...(hasGram > 0 ? { hasGram, weightGram: hasGram } : {}),

            priceDelta: Number(o?.priceDelta ?? 0) || 0,
            stockDelta: Math.floor(Number(o?.stockDelta ?? 0) || 0),
            isActive: o?.isActive !== false,
            order: Number.isFinite(Number(o?.order)) ? Number(o.order) : index,
          };
        })
        .filter((o: VariantOption | null): o is VariantOption => Boolean(o))
        .filter((o: VariantOption) => o.isActive !== false)
        .sort(
          (a: VariantOption, b: VariantOption) =>
            Number(a.order ?? 0) - Number(b.order ?? 0)
        );

      if (!groupId || !options.length) return null;

      return {
        id: groupId,
        label: {
          tr: s(g?.label?.tr) || groupId,
          en: s(g?.label?.en),
        },
        type: g?.type === "button" || g?.type === "radio" ? g.type : "select",
        required: g?.required !== false,
        options,
      };
    })
    .filter((g: VariantGroup | null): g is VariantGroup => Boolean(g));

  return {
    enabled: v.enabled === true,
    groups,
  };
}
async function fetchCategoriesByIds(db: any, ids: string[]): Promise<CatMini[]> {
  const clean = uniq(ids.map((x) => s(x)).filter(Boolean));
  if (!clean.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < clean.length; i += 10) chunks.push(clean.slice(i, i + 10));

  const out: CatMini[] = [];
  for (const part of chunks) {
    const qref = query(collection(db, "categories"), where("__name__", "in", part));
    const snap = await getDocs(qref);
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      out.push({
        id: d.id,
        name: data?.name ?? data?.title ?? "",
        slug: s(data?.slug),
        image: data?.image ? s(data.image) : undefined,

        // Kritik: kategori fiyat preset'i
        pricing: data?.pricing && typeof data.pricing === "object" ? data.pricing : null,

        variantPreset: sanitizeVariantPreset(data?.variantPreset),
      });
    });
  }
  return out.filter((c) => c.id && c.slug && pickText(c.name));
}


function getMaxBuyableStock(stock: any) {
  const s = Math.max(0, Math.floor(Number(stock ?? 0)));
  return s > 0 ? s : 1;
}
function isRingSizeGroupId(v: any) {
  const x = String(v || "").trim().toLocaleLowerCase("tr-TR");

  return (
    x.includes("ring_size") ||
    x.includes("yüzük") ||
    x.includes("yuzuk") ||
    x.includes("ölçü") ||
    x.includes("olcu") ||
    x.includes("ring")
  );
}

function getRingSizeFromVariants(
  selectedSize: string,
  selectedVariants: Record<string, string>,
  selectedVariantItems: SelectedVariantItemUI[]
) {
  const direct = String(selectedSize || "").trim();
  if (direct) return direct;

  const fromItem = selectedVariantItems.find((v) => {
    const hay = `${v.groupId} ${v.groupLabel} ${v.label} ${v.value}`;
    return isRingSizeGroupId(hay);
  });

  const itemValue = String(fromItem?.value || fromItem?.label || "").trim();
  if (itemValue) return itemValue;

  const foundKey = Object.keys(selectedVariants || {}).find((key) =>
    isRingSizeGroupId(key)
  );

  return foundKey ? String(selectedVariants[foundKey] || "").trim() : "";
}
function getProductRatePricingSource(product: any) {
  const candidates = [
    product?.pricing,
    product?.dynamicPricing,
    product?.categoryPricing,
    product?.resolvedCategoryPricing,
    product?.category?.pricing,
  ];

  return (
    candidates.find((x) => {
      if (!x || typeof x !== "object") return false;

      return (
        x.enabled === true ||
        x.mode === "dynamic" ||
        x.model === "gram" ||
        x.rateKey ||
        x.rateCode
      );
    }) || null
  );
}
function isDynamicPricingSource(x: any) {
  if (!x || typeof x !== "object") return false;

  return (
    x.enabled === true ||
    x.mode === "dynamic" ||
    x.model === "gram" ||
    Boolean(x.rateKey) ||
    Boolean(x.rateCode)
  );
}
function getRateKeyFromPricing(product: any, pricingSource: any) {
  return String(
    pricingSource?.rateKey ||
    pricingSource?.rateCode ||
    product?.rateKey ||
    product?.priceRateCode ||
    product?.dynamicPricing?.rateKey ||
    product?.pricing?.rateKey ||
    "GRAM_ALTIN"
  )
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function buildCartPricingFromProduct({
  product,
  selectedGram,
  finalPrice,
  variantPriceDelta,
}: {
  product: any;
  selectedGram: number;
  finalPrice: number;
  variantPriceDelta: number;
}) {
  const pricingSource = getProductRatePricingSource(product);

  const weightGram = Number(
    selectedGram ||
    product?.pricing?.gram ||
    product?.pricing?.weightGram ||
    product?.pricing?.hasGram ||
    product?.dynamicPricing?.gram ||
    product?.dynamicPricing?.weightGram ||
    product?.dynamicPricing?.hasGram ||
    product?.weightGram ||
    product?.weightGr ||
    product?.gram ||
    product?.hasGram ||
    0
  );

  const hasDynamic =
    Boolean(pricingSource) &&
    weightGram > 0;

  if (hasDynamic) {
    return {
      mode: "dynamic" as const,
      model: "gram" as const,
      rateKey: getRateKeyFromPricing(product, pricingSource),

      gram: weightGram,
      weightGram,
      weightGr: weightGram,
      hasGram: weightGram,
      markupTry: Number(
        pricingSource?.markupTry ??
        product?.markupTry ??
        product?.dynamicPricing?.markupTry ??
        product?.pricing?.markupTry ??
        0
      ),
      markupPercent: Number(
        pricingSource?.markupPercent ??
        product?.markupPercent ??
        product?.dynamicPricing?.markupPercent ??
        product?.pricing?.markupPercent ??
        0
      ),
      variantPriceDelta: Number(variantPriceDelta || 0),
    };
  }

  return {
    mode: "fixed" as const,
    priceTry: Number(finalPrice || 0),
    variantPriceDelta: Number(variantPriceDelta || 0),
  };
}
function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20.8 4.6c-1.5-1.4-3.9-1.4-5.4 0L12 8l-3.4-3.4c-1.5-1.4-3.9-1.4-5.4 0-1.6 1.6-1.6 4.1 0 5.7L12 21l8.8-10.7c1.6-1.6 1.6-4.1 0-5.7z" />
    </svg>
  );
}

/* ═══ BUNDLE / SET SATIŞI COMPONENT ═══ */
function BundleSection({
  bundle,
  currentProduct,
  rates,
  loc,
  t,
  db,
}: {
  bundle: any;
  currentProduct: any;
  rates: any;
  loc: "tr" | "en";
  t: any;
  db: any;
}) {
  const [bundleProducts, setBundleProducts] = useState<any[]>([]);
  const [bundleLoading, setBundleLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBundleLoading(true);
      try {
        const ids: string[] = (bundle.productIds || [])
          .map((x: any) => String(x || "").trim())
          .filter(Boolean);
        if (!ids.length) {
          if (alive) setBundleProducts([]);
          return;
        }

        const products: any[] = [];
        for (const pid of ids) {
          try {
            const dsnap = await getDoc(doc(db, "products", pid));
            if (dsnap.exists()) {
              products.push({ id: dsnap.id, ...dsnap.data() });
            }
          } catch {
            // skip
          }
        }
        if (alive) setBundleProducts(products);
      } catch {
        if (alive) setBundleProducts([]);
      } finally {
        if (alive) setBundleLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [db, bundle.productIds]);

  if (bundleLoading) return null;
  if (!bundleProducts.length) return null;

  const bundleTitle = pickText(bundle.title, loc) || t.bundleTitle;
  const bundleSubtitle = pickText(bundle.subtitle, loc) || "";
  const discountType = bundle.discountType || "none";
  const discountValue = Number(bundle.discountValue || 0);

  // Tüm set ürünlerinin toplam fiyatı (current + bundle products)
  const allProducts = [currentProduct, ...bundleProducts];
  const totalPrice = allProducts.reduce((sum: number, rp: any) => {
    const { price } = resolveProductPriceTRY(rp, rates);
    return sum + (price || 0);
  }, 0);

  let setPrice = totalPrice;
  let savedAmount = 0;
  if (discountType === "percent" && discountValue > 0) {
    savedAmount = totalPrice * (discountValue / 100);
    setPrice = totalPrice - savedAmount;
  } else if (discountType === "fixed" && discountValue > 0) {
    savedAmount = discountValue;
    setPrice = totalPrice - discountValue;
  }

  return (
    <section className={styles.sectionCard} style={{ marginTop: 8 }}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>🎁 {bundleTitle}</h2>
          {bundleSubtitle ? (
            <div className={styles.sectionMuted} style={{ marginTop: 4, fontSize: 13 }}>
              {bundleSubtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.relatedScroller}>
        {bundleProducts.map((bp: any) => {
          const href = `/products/${encodeURIComponent(s(bp?.slug || bp?.id))}`;
          const bTitle =
            pickText(bp?.title, loc) ||
            bp?.title?.tr ||
            bp?.title ||
            bp?.name ||
            "Ürün";
          const bImg = imgList(bp)[0] || FALLBACK_IMG;
          const { price: bPrice } = resolveProductPriceTRY(bp, rates);

          return (
            <div key={s(bp?.id) || href} className={styles.relatedSlide}>
              <Link href={href} className={styles.relatedCard}>
                <div className={styles.relatedMedia}>
                  <img src={bImg} alt={String(bTitle)} />
                </div>
                <div className={styles.relatedBody}>
                  <div className={styles.relatedTitle}>{String(bTitle)}</div>
                  <div className={styles.relatedPrice}>{formatTRY(bPrice, 2)}</div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Set Fiyat Özeti */}
      {savedAmount > 0 ? (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginTop: 12,
          padding: "14px 18px",
          borderRadius: 18,
          background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))",
          border: "1px solid rgba(16,185,129,0.18)",
        }}>
          <div style={{ flex: "1 1 auto" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t.bundleSave}
            </div>
            <div style={{ fontSize: 18, fontWeight: 950, color: "#047857", marginTop: 2 }}>
              {formatTRY(savedAmount, 2)}
              {discountType === "percent" ? ` (%${discountValue})` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, color: "#64748b", textDecoration: "line-through", fontWeight: 700 }}>
              {formatTRY(totalPrice, 2)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 1000, color: "#0f172a" }}>
              {formatTRY(setPrice, 2)}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
function DiamondInfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: 62,
        padding: "10px 12px",
        borderRadius: 14,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.07)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 850,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 13,
          fontWeight: 900,
          color: "#0f172a",
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}
export default function ProductClient({ slug }: { slug: string }) {
  const { loc } = useT();
  const t = useMemo(() => {
    const en = loc === "en";

    return {
      backShop: en ? "Shop" : "← Mağaza",
      favorite: en ? "Favorite" : "Favori",
      favorited: en ? "In favorites" : "Favorilerimde",

      dynamic: en ? "RATE / DYNAMIC" : "KUR / DİNAMİK",
      fixed: en ? "FIXED" : "SABİT",

      certifiedProduct: en ? "Certified Product" : "Sertifikalı Ürün",
      certifiedSub: en ? "Hallmarked & independently verified" : "Damgalı ve bağımsız laboratuvar onaylı",

      securePayment: en ? "Secure Payment" : "Güvenli Ödeme",
      securePaymentSub: en ? "256-bit SSL encrypted checkout" : "256-bit SSL şifreli ödeme altyapısı",

      fastShipping: en ? "Express Shipping" : "Hızlı Kargo",
      fastShippingSub: en ? "Same-day dispatch for in-stock items" : "Stoktaki ürünlerde aynı gün kargoya teslim",

      details: en ? "Details" : "Detaylar",
      shipping: en ? "Shipping" : "Teslimat",
      returns: en ? "Returns" : "İade",

      dimensions: en ? "Dimensions" : "Ölçüler",
      weight: en ? "Weight" : "Ağırlık",
      width: en ? "Width" : "Genişlik",
      length: en ? "Length" : "Uzunluk",
      height: en ? "Height" : "Yükseklik",
      sizeOptions: en ? "Size Options" : "Beden Seçenekleri",
      options: en ? "Options" : "Seçenekler",
      colors: en ? "Colors" : "Renkler",
      size: en ? "Size" : "Beden",
      tags: en ? "Tags" : "Etiketler",

      standardShipping: en ? "Standard shipping" : "Standart kargo",
      shippingEta: en ? "Estimated delivery" : "Tahmini teslimat süresi",
      shippingMayVary: en ? "Delivery time may vary depending on the product." : "Teslimat süresi ürüne göre değişiklik gösterebilir.",
      returnsText: en
        ? "Returns and exchanges are available in accordance with our return policy."
        : "İade ve değişim talepleriniz, iade politikamız çerçevesinde değerlendirilir.",

      premiumProduct: en ? "Premium product" : "Premium ürün",
      stock: en ? "Stock" : "Stok",
      outOfStock: en ? "Out of stock" : "Stokta yok",
      setting: en ? "Setting" : "Ayar",
      weightShort: en ? "Weight" : "Ağırlık",

      addToCart: en ? "Add to Cart" : "Sepete Ekle",
      goCart: en ? "Go to Cart" : "Sepete Git",
      copyLink: en ? "Copy Link" : "Linki Kopyala",
      askProduct: en ? "Contact Us" : "Bize Ulaşın",
      askQuestion: en ? "Have a Question?" : "Sorunuz mu Var?",

      priceNote: en
        ? "* Prices are updated in real time based on live exchange rates, carat and weight."
        : "* Fiyatlar anlık kur, ayar ve gram bilgisine göre otomatik güncellenir.",

      askText: en
        ? "Our lifestyle consultants are here to help with sizing, delivery and product details."
        : "Ölçü, teslimat veya ürün detayları için uzman ekibimiz yardımcı olmaktan memnuniyet duyar.",

      similarProducts: en ? "You May Also Like" : "Beğenebileceğiniz Ürünler",
      seeAll: en ? "View all →" : "Tümünü Gör →",
      noRelated: en
        ? "No related products found in this category yet."
        : "Bu kategoride henüz benzer ürün bulunmamaktadır.",

      reviews: en ? "Customer Reviews" : "Müşteri Yorumları",
      approvedReviews: en ? "Only verified reviews are displayed." : "Yalnızca onaylanmış yorumlar gösterilir.",
      noReviews: en ? "No reviews yet — be the first to share your experience." : "Henüz yorum yapılmadı. Deneyiminizi paylaşan ilk siz olun.",

      yourNameOptional: en ? "Your name (optional)" : "Adınız (isteğe bağlı)",
      writeReview: en ? "Share your experience…" : "Deneyiminizi paylaşın…",
      sendReview: en ? "Submit Review" : "Yorumu Gönder",
      sending: en ? "Sending…" : "Gönderiliyor…",

      loading: en ? "Loading…" : "Yükleniyor…",
      productNotFound: en ? "Product Not Found" : "Ürün Bulunamadı",
      backHome: en ? "Home" : "Ana Sayfa",
      backStore: en ? "Back to Store" : "Mağazaya Dön",

      copied: en ? "Link copied ✓" : "Link kopyalandı ✓",
      copyFailed: en ? "Could not copy the link." : "Link kopyalanamadı.",
      addedToCart: en ? "Added to cart ✓" : "Sepete eklendi ✓",
      noStockToast: en ? "This product is currently out of stock." : "Bu ürün şu anda stokta bulunmamaktadır.",
      reviewEmpty: en ? "Please write your review before submitting." : "Lütfen göndermeden önce yorumunuzu yazın.",
      reviewTaken: en ? "Thank you! Your review will appear after approval. ✓" : "Teşekkürler! Yorumunuz onay sonrası yayınlanacaktır. ✓",
      reviewError: en ? "Your review could not be submitted. Please try again." : "Yorumunuz gönderilemedi. Lütfen tekrar deneyin.",
      contactLater: en ? "Live chat will be available soon." : "Canlı destek kısa süre içinde aktif olacaktır.",
      notFoundText: en
        ? "This product may have been removed or the link may be incorrect. Browse our collection to discover more."
        : "Bu ürün kaldırılmış veya bağlantı hatalı olabilir. Koleksiyonumuza göz atarak yeni ürünler keşfedebilirsiniz.",
      detailsFallback: en
        ? "Crafted with premium materials and meticulous attention to detail."
        : "Özenle seçilmiş malzemeler ve titiz işçilikle üretilmiştir.",
      technicalSpecs: en ? "Technical Specifications" : "Teknik Özellikler",
      productOptions: en ? "Product Options" : "Ürün Seçenekleri",
      days: en ? "business days" : "iş günü",
      returnsLong: en
        ? "Returns and exchanges are accepted within the terms of our return policy. For detailed information, please visit our Returns & Guarantee page."
        : "İade ve değişim talepleriniz, iade politikamız kapsamında değerlendirilir. Detaylı bilgi için Güvence & İade sayfamızı ziyaret edebilirsiniz.",
      askQuestionText: en
        ? "Our lifestyle consultants are here to help with sizing, delivery and product details."
        : "Ölçü, teslimat veya ürün detayları için uzman ekibimiz yardımcı olmaktan memnuniyet duyar.",

      askQuestionNote: en
        ? "Reach our live support team for instant assistance."
        : "Ürünle ilgili sorularınız için canlı destek ekibimize ulaşabilirsiniz.",
      productWord: en ? "Product" : "Ürün",
      guest: en ? "Guest" : "Misafir",
      notifyMe: en ? "Notify Me When Available" : "Stoğa Gelince Haber Ver",
      notifySaved: en ? "Stock alert activated ✓" : "Stok bildirimi kaydedildi ✓",
      notifyExists: en ? "You're already following this product." : "Bu ürün için zaten bildirim almaktasınız.",
      notifyLogin: en ? "Please sign in to receive stock alerts." : "Stok bildirimi alabilmek için lütfen giriş yapın.",
      notifyError: en ? "Stock alert could not be saved. Please try again." : "Stok bildirimi kaydedilemedi. Lütfen tekrar deneyin.",
      notifyCancelled: en ? "Stock alert has been cancelled." : "Stok bildirimi iptal edildi.",
      notifyActive: en ? "Stock Alert Active" : "Stok Bildirimi Aktif",
      productInactive: en ? "This Product Is Currently Unavailable" : "Bu Ürün Şu Anda Satışta Değil",
      productInactiveSub: en
        ? "This product may have been removed from sale or temporarily paused. Please check back later or explore our other collections."
        : "Ürün satıştan kaldırılmış veya geçici olarak durdurulmuş olabilir. Lütfen daha sonra tekrar kontrol edin veya diğer koleksiyonlarımıza göz atın.",
      bundleTitle: en ? "Buy as a Set" : "Set Olarak Satın Al",
      bundleDiscount: en ? "Set Discount" : "Set İndirimi",
      bundleSave: en ? "You save" : "Kazancınız",
      bundleAddAll: en ? "Add Set to Cart" : "Seti Sepete Ekle",
      video: en ? "Video" : "Video",
      shareWhatsApp: en ? "Share via WhatsApp" : "WhatsApp ile Paylaş",
      shareLink: en ? "Share" : "Paylaş",
      installments: en ? "Installment Options" : "Taksit Seçenekleri",
      installmentNote: en ? "Interest-free installments available" : "Vade farksız taksit imkânı",
      month: en ? "month" : "ay",
      perMonth: en ? "/mo" : "/ay",
      addAndGoCart: en ? "Add & Go to Cart" : "Ekle ve Sepete Git",
      certTitle: en ? "Certified Gold" : "Sertifikalı Altın",
      certSub: en ? "Hallmarked & Certified" : "Damgalı & Sertifikalı",
      guaranteeTitle: en ? "Quality Guarantee" : "Kalite Garantisi",
      guaranteeSub: en ? "Verified 14K–22K authenticity" : "14K–22K saflık garantisi",
    };
  }, [loc]);
  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const fav = useFavorites(user && !user.isAnonymous ? user.uid : null);
  // related
  const [related, setRelated] = useState<any[]>([]);
  const relatedScrollerRef = useRef<HTMLDivElement | null>(null);

  function scrollRelated(dir: -1 | 1) {
    const el = relatedScrollerRef.current;
    if (!el) return;

    const firstCard = el.querySelector(`.${styles.relatedSlide}`) as HTMLElement | null;
    const step = firstCard
      ? firstCard.offsetWidth + 16
      : Math.max(260, Math.floor(el.clientWidth * 0.8));

    el.scrollBy({
      left: dir * step,
      behavior: "smooth",
    });
  }
  const [relatedLoading, setRelatedLoading] = useState(false);

  // reviews
  type ReviewDoc = {
    id: string;
    productId: string;
    name: string;
    rating: number;
    text: string;
    createdAt?: any;

    sourceType?: "site" | "google" | "trendyol" | "hepsiburada" | "idefix";
    sourceLabel?: string;
    sourceUrl?: string;
    sourceLogoUrl?: string;
    verifiedPurchase?: boolean;
  };
  type DetailRowUI = {

    id: string;

    icon: string;

    label: string;

    value: string;

  };
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [reviewName, setReviewName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewSending, setReviewSending] = useState(false);
  const [cats, setCats] = useState<CatMini[]>([]);
  const [loading, setLoading] = useState(true);

  const [p, setP] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"details" | "shipping" | "returns">("details");
  const [toast, setToast] = useState("");

  /* ── Taksit Ayarları (Firestore) ── */
  const [installmentSettings, setInstallmentSettings] = useState<{
    enabled: boolean;
    title: string;
    note: string;
    options: { months: number; interestFree: boolean; enabled: boolean }[];
  } | null>(null);

  const reviewSummary = useMemo(() => {
    const total = reviews.length;
    if (!total) {
      return {
        avg: 0,
        total: 0,
        counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const r of reviews) {
      const key = Math.max(1, Math.min(5, Number(r.rating || 0))) as 1 | 2 | 3 | 4 | 5;
      counts[key] += 1;
    }

    const avg =
      reviews.reduce((sum, r) => sum + Math.max(1, Math.min(5, Number(r.rating || 0))), 0) / total;

    return {
      avg,
      total,
      counts,
    };
  }, [reviews]);


  const [rates, setRates] = useState<RatesLatest | null>(null);

  // sticky bar: buy card görünmüyorsa altta bar görünsün
  function DetailIcon({ name }: { name?: string }) {
    const key = String(name || "")
      .trim()
      .toLowerCase();

    const common = {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.9,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };

    switch (key) {
      case "ruler":
        return (
          <svg {...common}>
            <path d="M4 20L20 4" />
            <path d="M14 6l4 4" />
            <path d="M11 9l2 2" />
            <path d="M8 12l2 2" />
            <path d="M5 15l2 2" />
          </svg>
        );

      case "palette":
        return (
          <svg {...common}>
            <path d="M12 3c-5 0-9 3.6-9 8.1C3 15.4 6.6 19 11 19h1.2c1.2 0 2.1 1 2.1 2.2 0 .4.3.8.8.8 3.6 0 6.9-3.2 6.9-7.8C22 8 17.8 3 12 3z" />
            <circle cx="7.5" cy="10" r="1" />
            <circle cx="10.5" cy="7.5" r="1" />
            <circle cx="14.5" cy="7.5" r="1" />
            <circle cx="17" cy="11" r="1" />
          </svg>
        );

      case "gem":
        return (
          <svg {...common}>
            <path d="M6 8l3-4h6l3 4-6 12-6-12z" />
            <path d="M3 8h18" />
            <path d="M9 4l3 4 3-4" />
          </svg>
        );

      case "ring":
        return (
          <svg {...common}>
            <circle cx="12" cy="15" r="5" />
            <path d="M9 9l3-4 3 4" />
          </svg>
        );

      case "shield":
        return (
          <svg {...common}>
            <path d="M12 3l7 3v5c0 5-3.4 8.3-7 10-3.6-1.7-7-5-7-10V6l7-3z" />
            <path d="M9.5 12.5l1.8 1.8 3.7-3.8" />
          </svg>
        );

      case "truck":
        return (
          <svg {...common}>
            <path d="M3 7h11v8H3z" />
            <path d="M14 10h3l2 2v3h-5z" />
            <circle cx="7" cy="18" r="1.5" />
            <circle cx="17" cy="18" r="1.5" />
          </svg>
        );

      case "refresh":
        return (
          <svg {...common}>
            <path d="M20 7v5h-5" />
            <path d="M4 17v-5h5" />
            <path d="M6.5 9A7 7 0 0 1 18 7" />
            <path d="M17.5 15A7 7 0 0 1 6 17" />
          </svg>
        );

      case "star":
        return (
          <svg {...common}>
            <path d="M12 3l2.7 5.5 6.1.9-4.4 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.2 6.1-.9L12 3z" />
          </svg>
        );

      case "heart":
        return (
          <svg {...common}>
            <path d="M20.8 4.6c-1.5-1.4-3.9-1.4-5.4 0L12 8l-3.4-3.4c-1.5-1.4-3.9-1.4-5.4 0-1.6 1.6-1.6 4.1 0 5.7L12 21l8.8-10.7c1.6-1.6 1.6-4.1 0-5.7z" />
          </svg>
        );

      case "sparkles":
        return (
          <svg {...common}>
            <path d="M12 3l1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3z" />
            <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
            <path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15z" />
          </svg>
        );

      case "badge":
        return (
          <svg {...common}>
            <circle cx="12" cy="10" r="5" />
            <path d="M9 15l-1 6 4-2 4 2-1-6" />
          </svg>
        );

      case "layers":
        return (
          <svg {...common}>
            <path d="M12 4l8 4-8 4-8-4 8-4z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M4 16l8 4 8-4" />
          </svg>
        );

      case "link":
        return (
          <svg {...common}>
            <path d="M10 14l-2 2a3 3 0 1 1-4-4l2-2" />
            <path d="M14 10l2-2a3 3 0 1 1 4 4l-2 2" />
            <path d="M9 15l6-6" />
          </svg>
        );

      case "circle":
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="7" />
          </svg>
        );

      case "square":
        return (
          <svg {...common}>
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        );

      case "flower":
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="7" r="2.2" />
            <circle cx="17" cy="12" r="2.2" />
            <circle cx="12" cy="17" r="2.2" />
            <circle cx="7" cy="12" r="2.2" />
          </svg>
        );

      case "baby":
        return (
          <svg {...common}>
            <circle cx="12" cy="8" r="3" />
            <path d="M7 19a5 5 0 0 1 10 0" />
          </svg>
        );

      case "lock":
        return (
          <svg {...common}>
            <rect x="6" y="11" width="12" height="9" rx="2" />
            <path d="M9 11V8a3 3 0 1 1 6 0v3" />
          </svg>
        );

      case "clock":
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" />
          </svg>
        );

      case "weight":
        return (
          <svg {...common}>
            <path d="M8 8h8l2 11H6L8 8z" />
            <path d="M10 8a2 2 0 1 1 4 0" />
          </svg>
        );

      default:
        return null;
    }
  }
  const stickyTriggerRef = useRef<HTMLDivElement | null>(null);
  const ga4ViewItemSentRef = useRef<string>("");
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = stickyTriggerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowSticky(!entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -80px 0px",
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertDocId, setAlertDocId] = useState<string>("");
  const [alertActive, setAlertActive] = useState(false);

  const fireToast = (m: string) => {
    setToast(m);
    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 1800);
  };

  // rates realtime
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => setRates(snap.exists() ? (snap.data() as any) : null),
      () => setRates(null)
    );
    return () => unsub();
  }, [db]);
  // related products (same category)

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!p) {
          if (alive) setRelated([]);
          return;
        }

        const ids = extractCategoryIds(p);
        const pickCat = ids[0] || s(p?.categoryId) || ""; // en garanti: ilk category id
        if (!pickCat) {
          if (alive) setRelated([]);
          return;
        }

        setRelatedLoading(true);

        // ✅ En stabil sorgu: categoryIds array-contains (1 tane)
        // Ürünlerde categoryIds yoksa, kendi şemana göre “categoryId” alanına geçebiliriz.
        // Burada iki sorguyu sırayla deniyoruz.
        let list: any[] = [];

        // 1) categoryIds array-contains
        try {
          const q1 = query(
            collection(db, "products"),
            where("categoryIds", "array-contains", pickCat),
            limit(10)
          );
          const snap1 = await getDocs(q1);
          if (!alive) return;
          list = snap1.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        } catch {
          // ignore
        }

        // 2) fallback: categoryId == pickCat
        if (!list.length) {
          const q2 = query(
            collection(db, "products"),
            where("categoryId", "==", pickCat),
            limit(10)
          );
          const snap2 = await getDocs(q2);
          if (!alive) return;
          list = snap2.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        }

        // kendisini çıkar + 8 tane bırak
        const me = s(p?.id);
        const clean = list.filter((x) => s(x?.id) !== me).slice(0, 8);

        if (!alive) return;
        setRelated(clean);
      } catch {
        if (alive) setRelated([]);
      } finally {
        if (alive) setRelatedLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, p]);
  // reviews realtime (approved only)
  // reviews realtime (approved only) — ✅ ultra safe + logs
  useEffect(() => {
    if (!p) { setReviews([]); return; }

    const pid = String(p.publicId || p.productId || p.id || "").trim();
    if (!pid) { setReviews([]); return; }

    const q1 = query(
      collection(db, "product_reviews"),
      where("productId", "==", pid),
      where("approved", "==", true),
      orderBy("createdAt", "desc"),
      limit(12)
    );

    const unsub = onSnapshot(
      q1,
      (snap) => {
        const list = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            id: d.id,
            productId: String(x?.productId || ""),
            name: String(x?.name || "Misafir"),
            rating: Math.max(1, Math.min(5, Number(x?.rating || 5))),
            text: String(x?.text || ""),
            createdAt: x?.createdAt,
            sourceType: String(x?.sourceType || "site") as
              | "site"
              | "google"
              | "trendyol"
              | "hepsiburada"
              | "idefix",
            sourceLabel: String(x?.sourceLabel || ""),
            sourceUrl: String(x?.sourceUrl || ""),
            sourceLogoUrl: String(x?.sourceLogoUrl || ""),
            verifiedPurchase: x?.verifiedPurchase === true,
          };
        });
        setReviews(list.slice(0, 12));
      },
      (err) => console.error("reviews error", err)
    );

    return () => unsub();
  }, [db, p]);
  function getReviewSourceMeta(r: ReviewDoc) {
    const type = String(r?.sourceType || "site");

    if (type === "google") {
      return {
        label: r.sourceLabel || "Google Yorumları",
        className: styles.sourceGoogle,
        text: "Bu yorum Google üzerinden alınmıştır.",
      };
    }

    if (type === "trendyol") {
      return {
        label: r.sourceLabel || "Trendyol",
        className: styles.sourceTrendyol,
        text: "Bu yorum Trendyol üzerinden alınmıştır.",
      };
    }

    if (type === "hepsiburada") {
      return {
        label: r.sourceLabel || "Hepsiburada",
        className: styles.sourceHepsiburada,
        text: "Bu yorum Hepsiburada üzerinden alınmıştır.",
      };
    }

    if (type === "idefix") {
      return {
        label: r.sourceLabel || "İdefix",
        className: styles.sourceIdefix,
        text: "Bu yorum İdefix üzerinden alınmıştır.",
      };
    }

    return {
      label: r.sourceLabel || "Dromocob",
      className: styles.sourceSite,
      text: "Bu yorum web sitemiz üzerinden alınmıştır.",
    };
  }
  async function submitReview() {
    if (!p?.id) return;

    const nm = reviewName.trim() || t.guest;
    const tx = reviewText.trim();
    const rt = Math.max(1, Math.min(5, Number(reviewRating || 5)));

    if (!tx) return fireToast(t.reviewEmpty);

    setReviewSending(true);
    try {
      const pid = String(p.publicId || p.id).trim();

      await addDoc(collection(db, "product_reviews"), {
        productId: pid,
        productSlug: String(p?.slug || slug || ""),
        name: nm,
        rating: rt,
        text: tx,
        approved: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        sourceType: "site",
        sourceLabel: "Site Yorumu",
        sourceUrl: "",
        sourceLogoUrl: "",
        verifiedPurchase: false,
      });

      setReviewText("");
      setReviewName("");
      setReviewRating(5);

      fireToast(t.reviewTaken);
    } catch (e: any) {
      fireToast(e?.message || t.reviewError);
    } finally {
      setReviewSending(false);
    }
  }
  // product load (1: docId, 2: slug)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setP(null);
      setActive(0);

      try {
        const dref = doc(db, "products", slug);
        const dsnap = await getDoc(dref);

        if (!alive) return;

        if (dsnap.exists()) {
          setP({ id: dsnap.id, ...(dsnap.data() as any) });
        } else {
          const qref = query(collection(db, "products"), where("slug", "==", slug), limit(1));
          const qsnap = await getDocs(qref);
          if (!alive) return;

          if (!qsnap.empty) {
            const d = qsnap.docs[0];
            setP({ id: d.id, ...(d.data() as any) });
          } else {
            setP(null);
          }
        }
      } catch {
        if (!alive) return;
        setP(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, slug]);

  // Track recently viewed
  useEffect(() => {
    if (!p) return;
    const title = pickText(p.title) || pickText(p.name) || slug;
    const image =
      s(p.mainImage) || s(p.image) || s(p.cover) ||
      (Array.isArray(p.images) ? s(p.images[0]) : "");
    const price = Number(p.finalPrice || p.priceTry || p.price || p.salePrice || 0);
    trackRecentlyViewed({
      id: s(p.id),
      slug: s(p.slug || slug),
      title,
      image,
      priceTry: price > 0 ? price : undefined,
    });

    // Analytics: ürün inceleme kaydı
    trackProductView(s(p.id), title);

    // Meta Pixel: ViewContent event
    const productSku = s(p.sku || p.id);
    trackMetaViewContent({
      content_ids: [productSku],
      content_name: title,
      content_type: "product",
      contents: [{ id: productSku, quantity: 1 }],
      value: price > 0 ? price : undefined,
      currency: "TRY",
    });
  }, [p, slug]);

  /* ── Taksit ayarlarını Firestore'dan yükle ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "installments"));
        if (!alive) return;
        if (snap.exists()) {
          const d = snap.data() as {
            enabled?: boolean;
            title?: string;
            note?: string;
            options?: { months: number; interestFree: boolean; enabled: boolean }[];
          };
          setInstallmentSettings({
            enabled: d.enabled !== false,
            title: d.title || "Taksit Seçenekleri",
            note: d.note || "Vade farksız taksit imkanı",
            options: Array.isArray(d.options) ? d.options.filter((o) => o.enabled) : [],
          });
        } else {
          /* Firestore'da doküman yoksa default göster */
          setInstallmentSettings({
            enabled: true,
            title: "Taksit Seçenekleri",
            note: "Vade farksız taksit imkanı",
            options: [
              { months: 3, interestFree: true, enabled: true },
              { months: 6, interestFree: true, enabled: true },
              { months: 9, interestFree: true, enabled: true },
              { months: 12, interestFree: true, enabled: true },
            ],
          });
        }
      } catch (err) {
        console.error("installment settings load:", err);
      }
    })();
    return () => { alive = false; };
  }, [db]);

  // categories for breadcrumb pills
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!p) {
          if (alive) setCats([]);
          return;
        }
        const ids = extractCategoryIds(p);
        if (!ids.length) {
          if (alive) setCats([]);
          return;
        }
        const list = await fetchCategoriesByIds(db, ids);
        const map = new Map(list.map((c) => [c.id, c]));
        const ordered = ids.map((id) => map.get(id)).filter(Boolean) as CatMini[];
        if (alive) setCats(ordered);
      } catch {
        if (alive) setCats([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, p]);

  // sticky bar IO


  const title = useMemo(() => {
    const t = pickText(p?.title, loc) || p?.title?.tr || p?.title || p?.name || "Ürün";
    return String(t).trim() || "Ürün";
  }, [p, loc]);

  const imgs = useMemo(() => {
    const images = imgList(p);
    // Gallery videos from advanced
    const videos = Array.isArray(p?.advanced?.galleryVideos)
      ? p.advanced.galleryVideos.map((v: any) => String(v || "").trim()).filter(Boolean)
      : [];
    return [...images, ...videos];
  }, [p]);

  const isVideoUrl = (url: string) => {
    const lower = url.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".ogg") || lower.includes("video");
  };

  const mainImg = imgs[clamp(active, 0, imgs.length - 1)] || FALLBACK_IMG;

  const stock = typeof p?.stock === "number" ? p.stock : Number(p?.stock ?? 0);
  const canBuy = stock > 0;

  const sku = s(p?.sku);
  const karat = p?.karat ? `${p.karat}K` : "";
  const favKey = s(p?.id || slug);
  const favOn = fav.has(favKey);
  useEffect(() => {
    if (!p?.id || !user || user.isAnonymous) {
      setAlertDocId("");
      setAlertActive(false);
      return;
    }

    const qref = query(
      collection(db, "stock_alerts"),
      where("uid", "==", user.uid),
      where("productId", "==", String(p.id)),
      where("status", "==", "active"),
      limit(1)
    );

    const unsub = onSnapshot(
      qref,
      (snap) => {
        if (snap.empty) {
          setAlertDocId("");
          setAlertActive(false);
          return;
        }

        const d = snap.docs[0];
        setAlertDocId(d.id);
        setAlertActive(true);
      },
      () => {
        setAlertDocId("");
        setAlertActive(false);
      }
    );

    return () => unsub();
  }, [db, p?.id, user]);
  const adv = useMemo(() => {
    return p?.advanced && typeof p.advanced === "object" ? p.advanced : {};
  }, [p?.advanced]); const returnsTitle = useMemo(() => {
    return (
      pickText(adv?.returns?.title, loc) ||
      (loc === "en" ? "Returns & Exchange" : "İade & Değişim")
    );
  }, [adv, loc]);
  const diamond = useMemo(() => {
    const candidates = [
      adv?.diamond,
      p?.diamond,
      p?.diamondInfo,
      adv?.diamondInfo,
      p?.productDiamond,
    ];

    const raw = candidates.find(
      (x) => x && typeof x === "object"
    );

    if (!raw) return null;

    const enabled =
      raw.enabled === true ||
      raw.enabled === "true" ||
      raw.isEnabled === true ||
      raw.active === true;

    if (!enabled) return null;

    return raw;
  }, [adv, p]);

  const diamondStoneGroups = useMemo(() => {
    if (!diamond) return [];

    const rawGroups =
      Array.isArray(diamond?.stoneGroups)
        ? diamond.stoneGroups
        : Array.isArray(diamond?.stones)
          ? diamond.stones
          : Array.isArray(diamond?.diamondStones)
            ? diamond.diamondStones
            : Array.isArray(diamond?.stoneDetails)
              ? diamond.stoneDetails
              : [];

    return rawGroups
      .map((stone: any, index: number) => {
        const weightCt = Number(
          stone?.weightCt ??
          stone?.carat ??
          stone?.caratWeight ??
          stone?.ct ??
          0
        );

        const quantity = Math.max(
          0,
          Math.floor(
            Number(
              stone?.quantity ??
              stone?.count ??
              stone?.stoneCount ??
              stone?.qty ??
              0
            )
          )
        );

        return {
          id:
            s(stone?.id) ||
            `stone_${index + 1}`,

          stoneType: s(
            stone?.stoneType ??
            stone?.type ??
            stone?.name
          ),

          diamondOrigin: s(
            stone?.diamondOrigin ??
            stone?.diamondType ??
            stone?.originType
          ),

          weightCt,
          quantity,

          color: s(
            stone?.color ??
            stone?.colorGrade
          ),

          clarity: s(
            stone?.clarity ??
            stone?.clarityGrade
          ),

          cut: s(
            stone?.cut ??
            stone?.cutType ??
            stone?.shape
          ),

          fluorescence: s(stone?.fluorescence),
          polish: s(stone?.polish),
          symmetry: s(stone?.symmetry),

          treatment: s(stone?.treatment),
          origin: s(stone?.origin),

          certificateLab: s(
            stone?.certificateLab ??
            stone?.lab
          ),

          certificateNumber: s(
            stone?.certificateNumber ??
            stone?.certificateNo ??
            stone?.certNumber
          ),
        };
      })
      .filter((stone: any) => {
        return (
          stone.stoneType ||
          stone.diamondOrigin ||
          stone.weightCt > 0 ||
          stone.quantity > 0 ||
          stone.color ||
          stone.clarity ||
          stone.cut ||
          stone.fluorescence ||
          stone.polish ||
          stone.symmetry ||
          stone.certificateLab ||
          stone.certificateNumber
        );
      });
  }, [diamond]);
  function diamondMetalLabel(value: any) {
    const v = s(value);

    if (v === "gold") return loc === "en" ? "Gold" : "Altın";
    if (v === "platinum") return loc === "en" ? "Platinum" : "Platin";
    if (v === "silver") return loc === "en" ? "Silver" : "Gümüş";
    if (v === "other") return loc === "en" ? "Other" : "Diğer";

    return v;
  }

  function diamondMetalColorLabel(value: any) {
    const v = s(value);

    if (v === "white") return loc === "en" ? "White" : "Beyaz";
    if (v === "yellow") return loc === "en" ? "Yellow" : "Sarı";
    if (v === "rose") return "Rose";
    if (v === "mixed") return loc === "en" ? "Mixed" : "Mix";

    return v;
  }

  function diamondOriginLabel(value: any) {
    const v = s(value);

    if (v === "natural") {
      return loc === "en" ? "Natural Diamond" : "Doğal Pırlanta";
    }

    if (v === "lab_grown") {
      return loc === "en" ? "Lab-Grown Diamond" : "Laboratuvar Pırlantası";
    }

    if (v === "mixed") {
      return loc === "en" ? "Mixed" : "Karışık";
    }

    return v;
  }

  function diamondCutLabel(value: any) {
    const v = s(value);

    const map: Record<string, string> = {
      round: loc === "en" ? "Round" : "Yuvarlak",
      princess: "Princess",
      oval: "Oval",
      emerald: "Emerald",
      pear: loc === "en" ? "Pear" : "Damla",
      marquise: "Marquise",
      cushion: "Cushion",
      radiant: "Radiant",
      asscher: "Asscher",
      heart: loc === "en" ? "Heart" : "Kalp",
      baguette: loc === "en" ? "Baguette" : "Baget",
      trillion: "Trillion",
      other: loc === "en" ? "Other" : "Diğer",
    };

    return map[v] || v;
  }

  function diamondGradeLabel(value: any) {
    const v = s(value);

    const map: Record<string, string> = {
      excellent: "Excellent",
      very_good: "Very Good",
      good: "Good",
      fair: "Fair",
      poor: "Poor",
    };

    return map[v] || v;
  }

  function fluorescenceLabel(value: any) {
    const v = s(value);

    const map: Record<string, string> = {
      none: loc === "en" ? "None" : "Yok",
      faint: "Faint",
      medium: "Medium",
      strong: "Strong",
      very_strong: "Very Strong",
    };

    return map[v] || v;
  }

  function settingLabel(value: any) {
    const v = s(value);

    const map: Record<string, string> = {
      prong: loc === "en" ? "Prong" : "Tırnak",
      bezel: loc === "en" ? "Bezel" : "Sıvama",
      pave: "Pavé",
      channel: "Channel",
      halo: "Halo",
      tension: "Tension",
      flush: "Flush",
      cluster: "Cluster",
      other: loc === "en" ? "Other" : "Diğer",
    };

    return map[v] || v;
  }
  const returnsContent = useMemo(() => {
    return (
      pickText(adv?.returns?.content, loc) ||
      t.returnsLong
    );
  }, [adv, loc, t.returnsLong]);
  const shortDesc = useMemo(() => {
    const v = pickText(adv?.shortDescription, loc) || pickText(p?.shortDescription, loc) || "";
    return String(v || "").trim();
  }, [adv, p, loc]);

  const longDesc = useMemo(() => {
    const v =
      pickText(adv?.description, loc) ||
      pickText(p?.description, loc) ||
      (typeof p?.description === "string" ? p.description : "") ||
      "";
    return String(v || "").trim();
  }, [adv, p, loc]);

  const tags = useMemo(() => {
    const raw = adv?.tags ?? p?.tags ?? [];
    return uniq(asArray<string>(raw).map(s).filter(Boolean)).slice(0, 12);
  }, [adv, p]);

  const sizes = useMemo(() => {
    const raw = adv?.sizes ?? p?.sizes ?? [];
    return uniq(asArray<string>(raw).map(s).filter(Boolean)).slice(0, 12);
  }, [adv, p]);
  const categoryVariantGroups = useMemo<VariantGroup[]>(() => {
    const productPreset = p?.productVariantPreset;

    if (
      productPreset?.enabled === true &&
      Array.isArray(productPreset.groups) &&
      productPreset.groups.length
    ) {
      return productPreset.groups;
    }

    const groups: VariantGroup[] = [];

    for (const c of cats) {
      const preset = c.variantPreset;
      if (!preset?.enabled) continue;

      for (const group of preset.groups || []) {
        if (!group?.id || !Array.isArray(group.options) || !group.options.length) continue;

        const alreadyExists = groups.some((g: VariantGroup) => g.id === group.id);
        if (alreadyExists) continue;

        groups.push({
          ...group,
          options: [...group.options]
            .filter((o: VariantOption) => o.isActive !== false)
            .sort(
              (a: VariantOption, b: VariantOption) =>
                Number(a.order ?? 0) - Number(b.order ?? 0)
            ),
        });
      }
    }

    return groups;
  }, [cats, p?.productVariantPreset]);

  useEffect(() => {
    if (!categoryVariantGroups.length) {
      setSelectedVariants({});
      return;
    }

    setSelectedVariants((prev) => {
      const next: Record<string, string> = {};

      for (const group of categoryVariantGroups) {
        const oldValue = prev[group.id];
        const stillExists = group.options.some(
          (o: VariantOption) => o.value === oldValue
        );

        next[group.id] = stillExists ? oldValue : "";
      }

      return next;
    });
  }, [categoryVariantGroups]);

  const selectedVariantItems = useMemo<SelectedVariantItemUI[]>(() => {
    return categoryVariantGroups
      .map((group: VariantGroup): SelectedVariantItemUI | null => {
        const value = selectedVariants[group.id];
        const option = group.options.find(
          (o: VariantOption) => o.value === value
        );

        if (!option) return null;

        const hasGram = Math.max(
          0,
          Math.round(Number(option.hasGram ?? option.weightGram ?? 0) * 10000) / 10000
        );

        return {
          groupId: group.id,
          groupLabel: pickText(group.label, loc) || group.label.tr || group.id,
          value: option.value,
          label: pickText(option.label, loc) || option.label.tr || option.value,
          priceDelta: Number(option.priceDelta ?? 0) || 0,
          ...(hasGram > 0 ? { hasGram, weightGram: hasGram } : {}),
        };
      })
      .filter((item): item is SelectedVariantItemUI => Boolean(item));
  }, [categoryVariantGroups, selectedVariants, loc]);
  const selectedVariantGram = useMemo(() => {
    const item = selectedVariantItems.find((x) => {
      const gramValue = Number(x.hasGram ?? x.weightGram ?? 0);
      return gramValue > 0;
    });

    const gramValue = Number(item?.hasGram ?? item?.weightGram ?? 0);
    return gramValue > 0 ? gramValue : 0;
  }, [selectedVariantItems]);
  const categoryPricingSource = useMemo(() => {
    return (
      cats
        .map((c) => c.pricing)
        .find((pricing) => isDynamicPricingSource(pricing)) || null
    );
  }, [cats]);
  const pricingProduct = useMemo(() => {
    if (!p) return p;

    const gram = Number(selectedVariantGram || 0);

    const productPricingSource = getProductRatePricingSource(p);
    const effectivePricingSource =
      productPricingSource || categoryPricingSource || null;

    if (gram <= 0) {
      return {
        ...p,
        categoryPricing: p?.categoryPricing || categoryPricingSource || null,
        resolvedCategoryPricing:
          p?.resolvedCategoryPricing || categoryPricingSource || null,
      };
    }

    const patchedPricing = effectivePricingSource
      ? {
        ...effectivePricingSource,
        enabled: effectivePricingSource.enabled !== false,
        model: effectivePricingSource.model || "gram",
        mode: effectivePricingSource.mode || "dynamic",

        // Gramı her olası alana yazıyoruz.
        gram,
        hasGram: gram,
        weightGram: gram,
        weightGr: gram,
      }
      : null;

    // Varyant gramı seçildiğinde, Firestore'daki sabit finalPrice'ı sıfırla.
    // Böylece resolveProductPriceTRY dinamik hesaplamaya düşer.
    const baseProductGram = Math.max(0, Number(
      p?.hasGram ?? p?.gram ?? p?.weightGram ?? p?.weightGr ?? 0
    ));
    const gramChanged = gram > 0 && Math.abs(gram - baseProductGram) > 0.001;

    return {
      ...p,

      // Üst seviye alanlar
      gram,
      hasGram: gram,
      weightGram: gram,
      weightGr: gram,

      // Gram değiştiyse sabit fiyatları sıfırla → dinamik hesaplama devreye girsin
      ...(gramChanged ? { finalPrice: 0, priceTry: 0, final: 0, price: 0, rawPrice: 0 } : {}),

      // Ürün kendi pricing'i varsa onu patchle, yoksa kategori pricing'i ver.
      pricing:
        p?.pricing && typeof p.pricing === "object"
          ? {
            ...p.pricing,
            gram,
            hasGram: gram,
            weightGram: gram,
            weightGr: gram,
          }
          : patchedPricing || p?.pricing,

      dynamicPricing:
        p?.dynamicPricing && typeof p.dynamicPricing === "object"
          ? {
            ...p.dynamicPricing,
            gram,
            hasGram: gram,
            weightGram: gram,
            weightGr: gram,
          }
          : p?.dynamicPricing,

      // Kritik: resolveProductPriceTRY kategori pricing okuyorsa buradan görecek.
      categoryPricing: patchedPricing || p?.categoryPricing || categoryPricingSource || null,
      resolvedCategoryPricing:
        patchedPricing || p?.resolvedCategoryPricing || categoryPricingSource || null,
    };
  }, [p, selectedVariantGram, categoryPricingSource]);

  const resolvedPrice = useMemo(() => {
    return resolveProductPriceTRY(pricingProduct, rates);
  }, [pricingProduct, rates]);

  const price = Number(resolvedPrice?.price || 0);
  const compareAtPrice = resolvedPrice?.compareAtPrice;
  const baseGram = Number(
    p?.gram ??
    p?.weightGram ??
    p?.weightGr ??
    p?.hasGram ??
    0
  );

  const displayGram = selectedVariantGram > 0 ? selectedVariantGram : baseGram;
  const gramText = displayGram > 0 ? `${displayGram} gr` : "";


  const missingRequiredVariant = useMemo(() => {
    return (
      categoryVariantGroups.find((group: VariantGroup) => {
        if (!group.required) return false;
        const selectedValue = String(selectedVariants[group.id] || "").trim();
        return !selectedValue;
      }) || null
    );
  }, [categoryVariantGroups, selectedVariants]);
  const variantPriceDelta = useMemo(() => {
    return selectedVariantItems.reduce(
      (sum: number, item) => sum + Number(item.priceDelta || 0),
      0
    );
  }, [selectedVariantItems]);

  const finalPrice = Number(price || 0) + variantPriceDelta;

  const finalCompareAtPrice =
    compareAtPrice ? Number(compareAtPrice || 0) + variantPriceDelta : null;
  useEffect(() => {
    if (!p?.id) return;
    if (typeof window === "undefined") return;

    const productSku = s(p.sku || p.id);
    const productSlug = s(p?.slug || slug);

    const productTitle =
      pickText(p.title, loc) ||
      pickText(p.name, loc) ||
      title ||
      productSlug;

    const categoryName =
      cats?.[0] ? pickText(cats[0].name, loc) || cats[0].slug || "" : "";

    const variantText = selectedVariantItems.map((x) => x.label).join(" / ");
    const eventKey = `${productSku}:${productSlug}:${Number(finalPrice || 0)}:${categoryName}:${variantText}`;

    if (ga4ViewItemSentRef.current === eventKey) return;
    ga4ViewItemSentRef.current = eventKey;

    (window as any).dataLayer = (window as any).dataLayer || [];

    (window as any).dataLayer.push({ ecommerce: null });

    (window as any).dataLayer.push({
      event: "view_item",
      ecommerce: {
        currency: "TRY",
        value: Number(finalPrice || 0),
        items: [
          {
            item_id: productSku,
            item_name: String(productTitle),
            item_brand: "Dromocob",
            item_category: categoryName,
            item_variant: selectedVariantItems.map((x) => x.label).join(" / "),
            price: Number(finalPrice || 0),
            quantity: 1,
          },
        ],
      },
    });
  }, [
    p?.id,
    p?.sku,
    p?.slug,
    p?.title,
    p?.name,
    slug,
    title,
    loc,
    finalPrice,
    cats,
    selectedVariantItems,
  ]);
  useEffect(() => {
    if (sizes.length) {
      setSelectedSize((prev) => (prev && sizes.includes(prev) ? prev : sizes[0]));
    } else {
      setSelectedSize("");
    }
  }, [sizes]);

  const colors = useMemo(() => {
    const raw = adv?.colors ?? p?.colors ?? [];
    const arr = asArray<any>(raw)
      .map((c) => ({ name: s(c?.name), hex: s(c?.hex) || "" }))
      .filter((c) => c.name);
    return arr.slice(0, 12);
  }, [adv, p]);

  const specs = useMemo(() => {
    const sp = adv?.specs && typeof adv.specs === "object" ? adv.specs : {};
    const weightGr = Number(sp?.weightGr ?? sp?.weight ?? p?.weightGr ?? p?.weightGram ?? NaN);
    const widthMm = Number(sp?.widthMm ?? NaN);
    const lengthMm = Number(sp?.lengthMm ?? NaN);
    const heightMm = Number(sp?.heightMm ?? NaN);
    return {
      weightGr: Number.isFinite(weightGr) ? weightGr : null,
      widthMm: Number.isFinite(widthMm) ? widthMm : null,
      lengthMm: Number.isFinite(lengthMm) ? lengthMm : null,
      lengthCm: Number.isFinite(lengthMm) ? Math.round((lengthMm / 10) * 100) / 100 : null,
      heightMm: Number.isFinite(heightMm) ? heightMm : null,
    };
  }, [adv, p]);

  const ship = useMemo(() => {
    const sh = adv?.shipping && typeof adv.shipping === "object" ? adv.shipping : {};
    const fastShipping = sh?.fastShipping !== false;
    const min = Number(sh?.shippingDaysMin ?? NaN);
    const max = Number(sh?.shippingDaysMax ?? NaN);
    const cargoNote = s(sh?.cargoNote);
    return { fastShipping, min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null, cargoNote };
  }, [adv]);

  const favPayload: Omit<FavItem, "id"> = useMemo(
    () => ({
      title: String(title),
      image: imgs[0] || "",
      price: Number(finalPrice) || 0,
      currency: "TRY",
      slug: s(p?.slug || slug),
    }),
    [title, imgs, finalPrice, p, slug]
  );
  const detailRows = useMemo<DetailRowUI[]>(() => {
    // 1) Admin'den gelen detailRows
    const adminRows = Array.isArray(adv?.detailRows) ? adv.detailRows : [];

    const parsed = adminRows
      .map((row: any, i: number): DetailRowUI => {
        const label =
          pickText(row?.label, loc) ||
          row?.label?.tr ||
          row?.label?.en ||
          "";

        const value =
          pickText(row?.value, loc) ||
          row?.value?.tr ||
          row?.value?.en ||
          "";

        return {
          id: String(row?.id || `row_${i + 1}`),
          icon: String(row?.icon || ""),
          label: String(label).trim(),
          value: String(value).trim(),
        };
      })
      .filter((row: DetailRowUI) => row.label && row.value);

    // 2) Ürün temel bilgilerinden otomatik detay satırları
    const autoRows: DetailRowUI[] = [];

    const karatVal = Number(p?.karat ?? 0);
    if (karatVal > 0) {
      autoRows.push({
        id: "auto_karat",
        icon: "gem",
        label: loc === "en" ? "Carat" : "Ayar",
        value: `${karatVal} Ayar`,
      });
    }

    const gramVal = displayGram;
    if (gramVal > 0) {
      autoRows.push({
        id: "auto_gram",
        icon: "weight",
        label: loc === "en" ? "Weight" : "Ağırlık",
        value: `${gramVal} gr`,
      });
    }

    const specWeight = specs.weightGr;
    // Eğer gram bilgisi yoksa ve specs'te ağırlık varsa ekle
    if (specWeight && specWeight > 0 && gramVal <= 0) {
      autoRows.push({
        id: "auto_spec_weight",
        icon: "weight",
        label: loc === "en" ? "Weight" : "Ağırlık",
        value: `${specWeight} gr`,
      });
    }

    if (specs.widthMm && specs.widthMm > 0) {
      autoRows.push({
        id: "auto_width",
        icon: "ruler",
        label: loc === "en" ? "Width" : "Genişlik",
        value: `${specs.widthMm} mm`,
      });
    }

    if (specs.lengthMm && specs.lengthMm > 0) {
      autoRows.push({
        id: "auto_length",
        icon: "ruler",
        label: loc === "en" ? "Length" : "Uzunluk",
        value: `${specs.lengthCm} cm`,
      });
    }

    if (specs.heightMm && specs.heightMm > 0) {
      autoRows.push({
        id: "auto_height",
        icon: "ruler",
        label: loc === "en" ? "Height" : "Yükseklik",
        value: `${specs.heightMm} mm`,
      });
    }

    // 3) Admin satırlarını önce göster, sonra auto satırlarını ekle
    // Duplicate kontrolü: admin'den zaten aynı label varsa auto ekleme
    const existingLabels = new Set(parsed.map((r: DetailRowUI) => r.label.toLowerCase()));
    const filteredAuto = autoRows.filter(
      (r) => !existingLabels.has(r.label.toLowerCase())
    );

    return [...parsed, ...filteredAuto];
  }, [adv, loc, p, displayGram, specs]);
  const onAddCart = () => {
    if (!p) return;
    if (!canBuy) return fireToast(t.noStockToast);

    if (missingRequiredVariant) {
      const label =
        pickText(missingRequiredVariant.label, loc) ||
        missingRequiredVariant.label.tr ||
        missingRequiredVariant.id ||
        "seçenek";

      fireToast(`Lütfen ${label} seçiniz.`);
      return;
    }
    const selectedRingSize = getRingSizeFromVariants(
      selectedSize,
      selectedVariants,
      selectedVariantItems
    );
    const maxStock = Math.max(0, Math.floor(Number(stock || 0)));
    const wantedQty = clamp(Number(qty) || 1, 1, Math.max(1, maxStock));
    const currentCartQty = getCurrentCartQty(
      favKey,
      user && !user.isAnonymous ? user.uid : null,
      selectedRingSize
    );
    if (currentCartQty >= maxStock) {
      fireToast(`Maksimum stok adedine ulaşıldı (${maxStock} adet).`);
      return;
    }

    const addableQty = Math.min(wantedQty, maxStock - currentCartQty);

    const cartUid = user && !user.isAnonymous ? user.uid : null;

    const cartItem: CartItem = {
      id: favKey,
      productId: favKey,
      title: String(title),
      priceTry: Number(finalPrice) || 0,
      image: imgs[0] || "",
      slug: s(p?.slug || slug),
      qty: addableQty,
      selectedSize: selectedRingSize,
      selectedVariants: {
        ...selectedVariants,
        ...(selectedRingSize ? { ring_size: selectedRingSize } : {}),
      },
      stock: Number(stock || 0),

      gram: Number(selectedVariantGram || p?.gram || p?.weightGram || p?.hasGram || 0),
      hasGram: Number(selectedVariantGram || p?.hasGram || p?.weightGram || p?.gram || 0),
      weightGram: Number(selectedVariantGram || p?.weightGram || p?.gram || p?.hasGram || 0),
      weightGr: Number(selectedVariantGram || p?.weightGr || p?.weightGram || p?.gram || p?.hasGram || 0),

      selectedVariantItems: selectedVariantItems.map((item) => {
        if (isRingSizeGroupId(`${item.groupId} ${item.groupLabel}`)) {
          const gram = Number(item.hasGram ?? item.weightGram ?? selectedVariantGram ?? 0);

          return {
            ...item,
            groupId: "ring_size",
            groupLabel: loc === "en" ? "Ring Size" : "Yüzük Ölçünüz",
            value: selectedRingSize || item.value,
            label: selectedRingSize || item.label,
            priceDelta: Number(item.priceDelta || 0),

            ...(gram > 0
              ? {
                hasGram: gram,
                weightGram: gram,
                gram,
              }
              : {}),
          };
        }

        return item;
      }),

      pricing: buildCartPricingFromProduct({
        product: {
          ...p,
          categoryPricing: p?.categoryPricing || categoryPricingSource || null,
          resolvedCategoryPricing: p?.resolvedCategoryPricing || categoryPricingSource || null,
        },
        selectedGram: selectedVariantGram,
        finalPrice: Number(finalPrice || 0),
        variantPriceDelta: Number(variantPriceDelta || 0),
      }),

      // 24 saat kuralı: sepete eklenme zamanı
      addedAt: Date.now(),
    };

    addToCart(cartItem, cartUid);

    if (cartUid) {
      saveCartItemToFirestore(cartUid, cartItem).catch((err) => {
        console.error("[product detail cart] cloud save failed:", err);
      });
    }

    window.dispatchEvent(new Event("cart:changed"));

    // Analytics: sepete ekleme kaydı
    trackCartAdd(favKey);

    setQty(1);

    if (addableQty < wantedQty) {
      fireToast(`Sepete eklendi ✓ Stok limiti nedeniyle ${maxStock} adet eklendi.`);
    } else {
      fireToast(t.addedToCart);
    }

    // Meta Pixel: AddToCart event
    const productSku = s(p.sku || p.id);
    const productTitle = pickText(p.title, loc) || pickText(p.name, loc) || slug;
    trackMetaAddToCart({
      content_ids: [productSku],
      content_name: productTitle,
      content_type: "product",
      contents: [{ id: productSku, quantity: addableQty }],
      value: Number(finalPrice) * addableQty || 0,
      currency: "TRY",
    });
    // GA4 Ecommerce: AddToCart event
    if (typeof window !== "undefined") {
      const categoryName =
        cats?.[0] ? pickText(cats[0].name, loc) || cats[0].slug || "" : "";

      (window as any).dataLayer = (window as any).dataLayer || [];

      // GA4 ecommerce için önce eski ecommerce objesini temizliyoruz
      (window as any).dataLayer.push({ ecommerce: null });

      (window as any).dataLayer.push({
        event: "add_to_cart",
        ecommerce: {
          currency: "TRY",
          value: Number(finalPrice || 0) * Number(addableQty || 1),
          items: [
            {
              item_id: productSku,
              item_name: String(productTitle),
              item_brand: "Dromocob",
              item_category: categoryName,
              item_variant: selectedVariantItems.map((x) => x.label).join(" / "),
              price: Number(finalPrice || 0),
              quantity: Number(addableQty || 1),
            },
          ],
        },
      });
    }
  };
  const onToggleStockAlert = async () => {
    if (!p?.id) return;

    if (!user || user.isAnonymous) {
      fireToast(t.notifyLogin);
      return;
    }

    try {
      setAlertSaving(true);

      // varsa iptal et
      if (alertActive && alertDocId) {
        await updateDoc(doc(db, "stock_alerts", alertDocId), {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });

        fireToast(t.notifyCancelled);
        return;
      }

      // tekrar kontrol et (double click / eski kayıt)
      const existsQ = query(
        collection(db, "stock_alerts"),
        where("uid", "==", user.uid),
        where("productId", "==", String(p.id)),
        where("status", "==", "active"),
        limit(1)
      );

      const existsSnap = await getDocs(existsQ);

      if (!existsSnap.empty) {
        const ex = existsSnap.docs[0];
        setAlertDocId(ex.id);
        setAlertActive(true);
        fireToast(t.notifyExists);
        return;
      }

      await addDoc(collection(db, "stock_alerts"), {
        uid: user.uid,
        productId: String(p.id),
        productSlug: String(p?.slug || slug || ""),
        productTitle: {
          tr: String(pickText(p?.title, "tr") || p?.title?.tr || title || ""),
          en: String(pickText(p?.title, "en") || p?.title?.en || title || ""),
        },
        productImage: String(imgs?.[0] || ""),
        productSku: String(sku || ""),
        email: String(user.email || ""),
        phone: "",
        locale: String(loc || "tr"),
        lastKnownStock: Number(stock || 0),
        lastKnownPriceTry: Number(finalPrice || 0),
        status: "active",
        notifiedAt: null,
        source: ["product", "detail"],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      fireToast(t.notifySaved);
    } catch (e) {
      console.error("stock alert save error:", e);
      fireToast(t.notifyError);
    } finally {
      setAlertSaving(false);
    }
  };
  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.skeleton}>{t.loading}</div>
        </div>
      </main>
    );
  }

  if (!p || p.isActive === false) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.topRow}>
            <h1 className={styles.h1}>{p?.isActive === false ? t.productInactive : t.productNotFound}</h1>
            <Link href="/shop" className={styles.linkPill}>{t.backShop}</Link>
          </div>

          <div className={styles.card}>
            <div className={styles.muted}>{p?.isActive === false ? t.productInactiveSub : t.notFoundText}</div>
            <div className={styles.btnRow}>
              <Link href="/shop" className={`${styles.btn} ${styles.btnDark}`}>{t.backStore}</Link>
              <Link href="/" className={`${styles.btn} ${styles.btnGhost}`}>{t.backHome}</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        {/* top chips */}
        <div className={styles.topBar}>
          {/* Breadcrumb JSON-LD Schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Ana Sayfa",
                    item: "https://demo.dromocob.com",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Magaza",
                    item: "https://demo.dromocob.com/shop",
                  },
                  ...(cats.length
                    ? [
                      {
                        "@type": "ListItem",
                        position: 3,
                        name: pickText(cats[0].name, loc),
                        item: `https://demo.dromocob.com/shop?cat=${encodeURIComponent(cats[0].slug)}`,
                      },
                      {
                        "@type": "ListItem",
                        position: 4,
                        name: title,
                      },
                    ]
                    : [
                      {
                        "@type": "ListItem",
                        position: 3,
                        name: title,
                      },
                    ]),
                ],
              }),
            }}
          />

          {/* Semantic breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0 }}>
            <div className={styles.crumbs}>
              <Link href="/" className={styles.linkPill} style={{ fontSize: 13 }}>
                Ana Sayfa
              </Link>
              <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 700, padding: "0 2px" }}>›</span>
              <Link href="/shop" className={styles.linkPill}>{t.backShop}</Link>

              {cats.length ? (
                <>
                  {cats.slice(0, 2).map((c) => (
                    <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                      <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 700, padding: "0 2px" }}>›</span>
                      <Link
                        href={`/shop?cat=${encodeURIComponent(c.slug)}`}
                        className={styles.catPill}
                        title={pickText(c.name, loc)}
                      >
                        {pickText(c.name, loc)}
                      </Link>
                    </span>
                  ))}
                </>
              ) : null}

              <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 700, padding: "0 2px" }}>›</span>
              <span
                style={{
                  minHeight: 44,
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#8a6a1f",
                  background: "#faf8f3",
                  border: "1px solid #e8d7b4",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </span>
            </div>
          </nav>

          <button
            type="button"
            className={`${styles.favBtn} ${favOn ? styles.favBtnOn : ""}`}
            onClick={() => fav.toggle(favKey, favPayload)}
            aria-label="Favori"
          >
            <IconHeart filled={favOn} />
            {favOn ? t.favorited : t.favorite}
          </button>
        </div>

        <div className={styles.grid}>
          {/* LEFT */}
          <section className={styles.left}>
            <div className={styles.mediaCard}>
              <div className={styles.stage}>
                <div className={styles.stageInner}>
                  {isVideoUrl(mainImg) ? (
                    <video
                      key={mainImg}
                      src={mainImg}
                      className={styles.mainImg}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }}
                    />
                  ) : (
                    <ImageZoom src={mainImg} alt={title} className={styles.mainImg} />
                  )}

                  {imgs.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.navBtn} ${styles.navLeft}`}
                        onClick={() => setActive((p) => (p - 1 + imgs.length) % imgs.length)}
                        aria-label="Önceki görsel"
                      >
                        ‹
                      </button>

                      <button
                        type="button"
                        className={`${styles.navBtn} ${styles.navRight}`}
                        onClick={() => setActive((p) => (p + 1) % imgs.length)}
                        aria-label="Sonraki görsel"
                      >
                        ›
                      </button>

                      <div className={styles.countPill}>{active + 1}/{imgs.length}</div>
                    </>
                  ) : null}
                </div>
              </div>

              {imgs.length > 1 ? (
                <div className={styles.thumbsWrap}>
                  <div className={styles.thumbs}>
                    {imgs.slice(0, 14).map((u: string, i: number) => (
                      <button
                        key={u + i}
                        type="button"
                        className={`${styles.thumb} ${i === active ? styles.thumbActive : ""}`}
                        onClick={() => setActive(i)}
                        aria-label={isVideoUrl(u) ? `Video ${i + 1}` : `Görsel ${i + 1}`}
                        style={{ position: "relative" }}
                      >
                        {isVideoUrl(u) ? (
                          <>
                            <video src={u} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                            <span style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(0,0,0,0.3)",
                              color: "#fff",
                              fontSize: 18,
                              fontWeight: 900,
                              borderRadius: "inherit",
                            }}>▶</span>
                          </>
                        ) : (
                          <img src={u} alt={`thumb-${i}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* RIGHT */}
          <aside className={styles.right}>
            <div className={styles.metaStrip}>
              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>SKU</span>
                <strong className={styles.metaValue}>{sku || "-"}</strong>
              </div>

              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>{t.setting}</span>
                <strong className={styles.metaValue}>{karat || "-"}</strong>
              </div>

              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>{t.weightShort}</span>
                <strong className={styles.metaValue}>{gramText || "-"}</strong>
              </div>
            </div>

            {categoryVariantGroups.length ? (
              <div className={styles.variantBox}>
                {categoryVariantGroups.map((group: VariantGroup) => {
                  const label = pickText(group.label, loc) || group.label.tr || group.id;
                  const selectedValue = selectedVariants[group.id] || "";

                  return (
                    <div key={group.id} className={styles.variantGroup}>
                      <div className={styles.boxT}>{label}</div>

                      {group.type === "select" ? (
                        <select

                          className={`${styles.variantSelect} ${!selectedValue ? styles.variantSelectEmpty : ""

                            }`}

                          value={selectedValue}

                          onChange={(e) =>

                            setSelectedVariants((prev) => ({

                              ...prev,

                              [group.id]: e.target.value,

                            }))

                          }

                        >

                          <option value="">

                            {loc === "en" ? "Please select" : "Seçiniz"}

                          </option>

                          {group.options.map((option: VariantOption) => {
                            const optionLabel =
                              pickText(option.label, loc) || option.label.tr || option.value;

                            return (
                              <option key={option.value} value={option.value}>
                                {optionLabel}
                                {Number(option.priceDelta || 0) > 0
                                  ? ` (+${formatTRY(Number(option.priceDelta), 2)})`
                                  : ""}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className={styles.variantBtnGrid}>
                          {group.options.map((option: VariantOption) => {
                            const optionLabel =
                              pickText(option.label, loc) || option.label.tr || option.value;
                            const active = selectedValue === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`${styles.variantBtn} ${active ? styles.variantBtnActive : ""
                                  }`}
                                onClick={() =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [group.id]: option.value,
                                  }))
                                }
                                aria-pressed={active}
                              >
                                <span>{optionLabel}</span>

                                {Number(option.priceDelta || 0) > 0 ? (
                                  <small>+{formatTRY(Number(option.priceDelta), 2)}</small>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div ref={stickyTriggerRef} />

            <div className={styles.buyCard}>
              <div className={styles.buyTop}>
                <h1 className={styles.title}>{title}</h1>
                {shortDesc ? <div className={styles.short}>{shortDesc}</div> : null}
              </div>

              <div className={styles.priceWrap}>
                {finalCompareAtPrice ? (
                  <div className={styles.comparePrice}>{formatTRY(finalCompareAtPrice, 2)}</div>
                ) : null}

                <div className={styles.priceRow}>
                  <div className={styles.price}>{formatTRY(finalPrice, 2)}</div>
                  <div className={styles.cur}>TRY</div>
                </div>
              </div>



              <div className={styles.qtyRow}>
                <button className={styles.qtyBtn} onClick={() => setQty((q) => clamp(q - 1, 1, 99))} type="button">−</button>
                <div className={styles.qtyVal}>{qty}</div>
                <button className={styles.qtyBtn} onClick={() => setQty((q) => clamp(q + 1, 1, 99))} type="button">+</button>
              </div>

              {canBuy ? (
                <button className={styles.btnPrimary} onClick={onAddCart} type="button" id="fb-add-to-cart" data-fb="AddToCart">
                  {t.addToCart}
                </button>
              ) : (
                <button
                  className={`${styles.btnPrimary} ${styles.btnWarn}`}
                  onClick={onToggleStockAlert}
                  type="button"
                  disabled={alertSaving}
                >
                  {alertSaving
                    ? t.sending
                    : alertActive
                      ? t.notifyActive
                      : t.notifyMe}
                </button>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnGlass}
                  onClick={() => {
                    if (canBuy) onAddCart();
                    router.push("/cart");
                  }}
                >
                  🛒 {t.addAndGoCart}
                </button>
                <button
                  type="button"
                  className={styles.btnGlass}
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    const text = `${title} — ${formatTRY(finalPrice, 2)} TRY`;
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
                      "_blank"
                    );
                  }}
                >
                  💬 {t.shareWhatsApp}
                </button>
              </div>

              {/* Taksit Tablosu — Firestore'dan */}
              {finalPrice > 0 && installmentSettings?.enabled && installmentSettings.options.length > 0 && (
                <div className={styles.installmentBox}>
                  <div className={styles.installmentHead}>
                    <span className={styles.installmentTitle}>💳 {installmentSettings.title}</span>
                    <span className={styles.installmentNote}>{installmentSettings.note}</span>
                  </div>
                  <div className={styles.installmentGrid}>
                    {installmentSettings.options.map((opt) => (
                      <div key={opt.months} className={styles.installmentItem}>
                        <span className={styles.installmentMonth}>{opt.months} {t.month}</span>
                        <strong className={styles.installmentAmount}>
                          {formatTRY(finalPrice / opt.months, 2)}{t.perMonth}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sertifika & Garanti Rozeti */}
              <div className={styles.certRow}>
                <div className={styles.certBadge}>
                  <span className={styles.certIcon}>🏅</span>
                  <div>
                    <div className={styles.certBadgeTitle}>{t.certTitle}</div>
                    <div className={styles.certBadgeSub}>{t.certSub}</div>
                  </div>
                </div>
                <div className={styles.certBadge}>
                  <span className={styles.certIcon}>✅</span>
                  <div>
                    <div className={styles.certBadgeTitle}>{t.guaranteeTitle}</div>
                    <div className={styles.certBadgeSub}>{t.guaranteeSub}</div>
                  </div>
                </div>
              </div>

              <div className={styles.note}>
                {t.priceNote}
              </div>
            </div>

            <div className={styles.tabsCard}>
              <div className={styles.tabBar}>
                <button className={`${styles.tab} ${tab === "details" ? styles.tabOn : ""}`} onClick={() => setTab("details")} type="button">{t.details}</button>
                <button className={`${styles.tab} ${tab === "shipping" ? styles.tabOn : ""}`} onClick={() => setTab("shipping")} type="button">{t.shipping}</button>
                <button className={`${styles.tab} ${tab === "returns" ? styles.tabOn : ""}`} onClick={() => setTab("returns")} type="button">{t.returns}</button>
              </div>

              <div className={styles.tabBody}>
                {tab === "details" ? (
                  <div className={styles.detailWrap}>
                    <div className={styles.text}>
                      {longDesc || t.detailsFallback}
                    </div>
                    {detailRows.length ? (

                      <div className={styles.detailInfoGrid}>

                        {detailRows.map((row: { id: string; icon?: string; label: string; value: string }) => (

                          <div key={row.id} className={styles.detailInfoCard}>
                            {row.icon ? (
                              <span className={styles.detailInfoIcon}>
                                <DetailIcon name={row.icon} />
                              </span>
                            ) : null}

                            <div className={styles.detailInfoContent}>
                              <div className={styles.detailInfoLabel}>{row.label}</div>
                              <div className={styles.detailInfoValue}>{row.value}</div>
                            </div>
                          </div>

                        ))}

                      </div>

                    ) : null}
                    {diamond ? (
                      <div
                        style={{
                          marginTop: 18,
                          padding: 18,
                          borderRadius: 20,
                          border: "1px solid rgba(180, 138, 45, 0.22)",
                          background:
                            "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(250,247,239,0.95))",
                          boxShadow: "0 10px 35px rgba(15,23,42,0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                color: "#9a7427",
                              }}
                            >
                              {loc === "en" ? "Diamond Information" : "Pırlanta Bilgileri"}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 19,
                                fontWeight: 950,
                                color: "#0f172a",
                              }}
                            >
                              💎 {loc === "en" ? "Diamond Specifications" : "Pırlanta Özellikleri"}
                            </div>
                          </div>

                          {diamond?.certificateLab ? (
                            <div
                              style={{
                                padding: "7px 11px",
                                borderRadius: 999,
                                background: "#fff",
                                border: "1px solid rgba(180,138,45,0.22)",
                                fontSize: 11,
                                fontWeight: 900,
                                color: "#8a681f",
                              }}
                            >
                              ✓ {diamond.certificateLab}{" "}
                              {loc === "en" ? "Certified" : "Sertifikalı"}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                            gap: 10,
                          }}
                        >
                          {diamond?.diamondOrigin ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Diamond Type" : "Pırlanta Türü"}
                              value={diamondOriginLabel(diamond.diamondOrigin)}
                            />
                          ) : null}

                          {Number(diamond?.totalCarat || 0) > 0 ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Total Carat" : "Toplam Karat"}
                              value={`${Number(diamond.totalCarat)} ct`}
                            />
                          ) : null}

                          {Number(diamond?.centerStoneCarat || 0) > 0 ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Center Stone" : "Merkez Taş"}
                              value={`${Number(diamond.centerStoneCarat)} ct`}
                            />
                          ) : null}

                          {Number(diamond?.totalStoneQuantity || 0) > 0 ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Stone Count" : "Taş Adedi"}
                              value={`${Number(diamond.totalStoneQuantity)}`}
                            />
                          ) : null}

                          {diamond?.metalType ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Metal" : "Metal"}
                              value={diamondMetalLabel(diamond.metalType)}
                            />
                          ) : null}

                          {diamond?.metalColor ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Metal Color" : "Metal Rengi"}
                              value={diamondMetalColorLabel(diamond.metalColor)}
                            />
                          ) : null}

                          {Number(diamond?.metalKarat || 0) > 0 ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Metal Carat" : "Metal Ayarı"}
                              value={`${Number(diamond.metalKarat)} ${loc === "en" ? "Karat" : "Ayar"
                                }`}
                            />
                          ) : null}

                          {diamond?.settingType ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Setting" : "Montür"}
                              value={settingLabel(diamond.settingType)}
                            />
                          ) : null}

                          {diamond?.handmade === true ? (
                            <DiamondInfoCard
                              label={loc === "en" ? "Craftsmanship" : "İşçilik"}
                              value={loc === "en" ? "Handcrafted" : "El İşçiliği"}
                            />
                          ) : null}
                        </div>

                        {(diamond?.fluorescence ||
                          diamond?.polish ||
                          diamond?.symmetry ||
                          diamond?.origin ||
                          diamond?.treatment) ? (
                          <div
                            style={{
                              marginTop: 16,
                              paddingTop: 16,
                              borderTop: "1px solid rgba(15,23,42,0.07)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 950,
                                color: "#0f172a",
                                marginBottom: 10,
                              }}
                            >
                              {loc === "en" ? "Quality Details" : "Kalite Detayları"}
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                                gap: 10,
                              }}
                            >
                              {diamond?.fluorescence ? (
                                <DiamondInfoCard
                                  label="Fluorescence"
                                  value={fluorescenceLabel(diamond.fluorescence)}
                                />
                              ) : null}

                              {diamond?.polish ? (
                                <DiamondInfoCard
                                  label="Polish"
                                  value={diamondGradeLabel(diamond.polish)}
                                />
                              ) : null}

                              {diamond?.symmetry ? (
                                <DiamondInfoCard
                                  label="Symmetry"
                                  value={diamondGradeLabel(diamond.symmetry)}
                                />
                              ) : null}

                              {diamond?.treatment ? (
                                <DiamondInfoCard
                                  label={loc === "en" ? "Treatment" : "İşlem"}
                                  value={s(diamond.treatment)}
                                />
                              ) : null}

                              {diamond?.origin ? (
                                <DiamondInfoCard
                                  label={loc === "en" ? "Origin" : "Menşei"}
                                  value={s(diamond.origin)}
                                />
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {diamondStoneGroups.length ? (
                          <div
                            style={{
                              marginTop: 18,
                              paddingTop: 18,
                              borderTop: "1px solid rgba(15,23,42,0.07)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 950,
                                color: "#0f172a",
                                marginBottom: 12,
                              }}
                            >
                              {loc === "en" ? "Stone Details" : "Taş Detayları"}
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gap: 10,
                              }}
                            >
                              {diamondStoneGroups.map((stone: any, index: number) => (
                                <div
                                  key={stone.id}
                                  style={{
                                    padding: 14,
                                    borderRadius: 16,
                                    border: "1px solid rgba(15,23,42,0.07)",
                                    background: "rgba(255,255,255,0.75)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: 8,
                                      marginBottom: 10,
                                    }}
                                  >
                                    <strong
                                      style={{
                                        fontSize: 13,
                                        color: "#0f172a",
                                      }}
                                    >
                                      💎 {loc === "en" ? "Stone Group" : "Taş Grubu"} #{index + 1}
                                    </strong>

                                    {stone.diamondOrigin ? (
                                      <span
                                        style={{
                                          padding: "5px 8px",
                                          borderRadius: 999,
                                          background: "#f8fafc",
                                          border: "1px solid rgba(15,23,42,0.08)",
                                          fontSize: 10,
                                          fontWeight: 850,
                                          color: "#475569",
                                        }}
                                      >
                                        {diamondOriginLabel(stone.diamondOrigin)}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                      gap: 8,
                                    }}
                                  >
                                    {stone.stoneType ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Stone" : "Taş"}
                                        value={stone.stoneType}
                                      />
                                    ) : null}

                                    {stone.weightCt > 0 ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Carat" : "Karat"}
                                        value={`${stone.weightCt} ct`}
                                      />
                                    ) : null}

                                    {stone.quantity > 0 ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Quantity" : "Adet"}
                                        value={`${stone.quantity}`}
                                      />
                                    ) : null}

                                    {stone.color ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Color" : "Renk"}
                                        value={stone.color}
                                      />
                                    ) : null}

                                    {stone.clarity ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Clarity" : "Berraklık"}
                                        value={stone.clarity}
                                      />
                                    ) : null}

                                    {stone.cut ? (
                                      <DiamondInfoCard
                                        label={loc === "en" ? "Cut" : "Kesim"}
                                        value={diamondCutLabel(stone.cut)}
                                      />
                                    ) : null}

                                    {stone.fluorescence ? (
                                      <DiamondInfoCard
                                        label="Fluorescence"
                                        value={fluorescenceLabel(stone.fluorescence)}
                                      />
                                    ) : null}

                                    {stone.polish ? (
                                      <DiamondInfoCard
                                        label="Polish"
                                        value={diamondGradeLabel(stone.polish)}
                                      />
                                    ) : null}

                                    {stone.symmetry ? (
                                      <DiamondInfoCard
                                        label="Symmetry"
                                        value={diamondGradeLabel(stone.symmetry)}
                                      />
                                    ) : null}
                                  </div>

                                  {(stone.certificateLab || stone.certificateNumber) ? (
                                    <div
                                      style={{
                                        marginTop: 10,
                                        fontSize: 11,
                                        color: "#64748b",
                                        fontWeight: 750,
                                      }}
                                    >
                                      {loc === "en" ? "Certificate" : "Sertifika"}:{" "}
                                      <strong style={{ color: "#334155" }}>
                                        {[stone.certificateLab, stone.certificateNumber]
                                          .filter(Boolean)
                                          .join(" • ")}
                                      </strong>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {(diamond?.certificateLab ||
                          diamond?.certificateNumber ||
                          diamond?.certificateNote) ? (
                          <div
                            style={{
                              marginTop: 18,
                              padding: 14,
                              borderRadius: 16,
                              background: "rgba(154,116,39,0.06)",
                              border: "1px solid rgba(154,116,39,0.16)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 950,
                                color: "#8a681f",
                              }}
                            >
                              🏅 {loc === "en" ? "Certificate" : "Sertifika"}
                            </div>

                            {(diamond.certificateLab || diamond.certificateNumber) ? (
                              <div
                                style={{
                                  marginTop: 5,
                                  fontSize: 13,
                                  color: "#334155",
                                  fontWeight: 800,
                                }}
                              >
                                {[diamond.certificateLab, diamond.certificateNumber]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            ) : null}

                            {diamond.certificateNote ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  lineHeight: 1.6,
                                  color: "#64748b",
                                }}
                              >
                                {diamond.certificateNote}
                              </div>
                            ) : null}

                            {diamond.certificateUrl ? (
                              <a
                                href={diamond.certificateUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  marginTop: 9,
                                  fontSize: 11,
                                  fontWeight: 900,
                                  color: "#8a681f",
                                  textDecoration: "none",
                                }}
                              >
                                {loc === "en"
                                  ? "View Certificate →"
                                  : "Sertifikayı Görüntüle →"}
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {(specs.weightGr || specs.widthMm || specs.lengthMm || specs.heightMm) ? (
                      <div className={styles.box}>
                        <div className={styles.boxT}>{t.technicalSpecs}</div>
                        <div className={styles.specGrid}>
                          {specs.weightGr ? <div className={styles.spec}><span>{t.weight}</span><b>{specs.weightGr} gr</b></div> : null}
                          {specs.widthMm ? <div className={styles.spec}><span>{t.width}</span><b>{specs.widthMm} mm</b></div> : null}
                          {specs.lengthMm ? <div className={styles.spec}><span>{t.length}</span><b>{specs.lengthMm} mm</b></div> : null}
                          {specs.heightMm ? <div className={styles.spec}><span>{t.height}</span><b>{specs.heightMm} mm</b></div> : null}
                        </div>
                      </div>
                    ) : null}

                    {(colors.length || sizes.length || tags.length) ? (
                      <div className={styles.box}>
                        <div className={styles.boxT}>{t.productOptions}</div>

                        {colors.length ? (
                          <div className={styles.rowLine}>
                            <span className={styles.k}>{t.colors}</span>
                            <div className={styles.pills}>
                              {colors.map((c) => (
                                <span key={c.name} className={styles.pillMini}>
                                  {c.hex ? <span className={styles.swatch} style={{ background: c.hex }} /> : null}
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}



                        {(colors.length || tags.length) ? (

                          <div className={styles.box}>

                            <div className={styles.boxT}>{t.productOptions}</div>

                            {colors.length ? (

                              <div className={styles.rowLine}>

                                <span className={styles.k}>{t.colors}</span>

                                <div className={styles.pills}>

                                  {colors.map((c) => (

                                    <span key={c.name} className={styles.pillMini}>

                                      {c.hex ? <span className={styles.swatch} style={{ background: c.hex }} /> : null}

                                      {c.name}

                                    </span>

                                  ))}

                                </div>

                              </div>

                            ) : null}

                            {tags.length ? (

                              <div className={styles.rowLine}>

                                <span className={styles.k}>{t.tags}</span>

                                <div className={styles.pills}>

                                  {tags.map((x) => (

                                    <span key={x} className={styles.pillMini}>{x}</span>

                                  ))}

                                </div>

                              </div>

                            ) : null}

                          </div>

                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : tab === "shipping" ? (
                  <div className={styles.text}>
                    <b>{ship.fastShipping ? t.fastShipping : t.standardShipping}</b> —{" "}
                    {ship.min || ship.max ? (
                      <>{t.shippingEta}: <b>{ship.min ?? "?"}-{ship.max ?? "?"} {t.days}</b>.</>
                    ) : (
                      <>{t.shippingMayVary}</>
                    )}
                    {ship.cargoNote ? <div className={styles.noteInline}>{ship.cargoNote}</div> : null}
                  </div>
                ) : (
                  <div className={styles.text}>
                    <strong>{returnsTitle}</strong>
                    <div className={styles.noteInline}>{returnsContent}</div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideT}>{t.askQuestion}</div>
              <div className={styles.sideS}>{t.askQuestionNote}</div>
              <button
                className={styles.sideBtn}
                type="button"
                onClick={() => {
                  const launcher =
                    document.querySelector('[data-chat-launcher]') ||
                    document.querySelector('[data-chat-toggle]') ||
                    document.querySelector('.chat-launcher') ||
                    document.querySelector('.chat-widget-button') ||
                    document.querySelector('.chat-toggle') ||
                    document.querySelector('button[aria-label*="İletişim"]') ||
                    document.querySelector('button[aria-label*="chat"]');

                  if (launcher instanceof HTMLElement) {
                    launcher.click();
                    return;
                  }

                  window.dispatchEvent(new CustomEvent("chat:open"));
                }}
              >
                {t.askProduct}
              </button>
            </div>
          </aside>
        </div>

        {/* sticky bottom bar (mobil + scroll) */}
        {showSticky ? (
          <div className={`${styles.stickyBar} ${styles.stickyBarOn}`}>
            <div className={styles.stickyInner}>
              <div className={styles.stickyInfo}>
                <div className={styles.stickyTitle}>{title}</div>
                <div className={styles.stickyPrice}>
                  {formatTRY(finalPrice, 2)} <span>TRY</span>
                </div>
              </div>

              <div className={styles.stickyBottom}>
                <div className={styles.stickyQtyWrap}>
                  <button
                    type="button"
                    className={styles.stickyQtyBtn}
                    onClick={() => setQty((q) => clamp(q - 1, 1, getMaxBuyableStock(stock)))}
                    aria-label="Azalt"
                    disabled={!canBuy}
                  >
                    −
                  </button>

                  <div className={styles.stickyQtyVal}>{qty}</div>

                  <button
                    type="button"
                    className={styles.stickyQtyBtn}
                    onClick={() => setQty((q) => clamp(q + 1, 1, getMaxBuyableStock(stock)))}
                    aria-label="Artır"
                    disabled={!canBuy}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className={`${styles.stickyCta} ${!canBuy ? styles.stickyWarn : ""}`}
                  onClick={canBuy ? onAddCart : onToggleStockAlert}
                  disabled={alertSaving}
                  id="fb-sticky-add-to-cart"
                  data-fb="AddToCart"
                >
                  {canBuy
                    ? t.addToCart
                    : alertSaving
                      ? t.sending
                      : alertActive
                        ? t.notifyActive
                        : t.notifyMe}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ===== SET SATIŞI (BUNDLE) ===== */}
        {p?.setBundle?.enabled && Array.isArray(p.setBundle.productIds) && p.setBundle.productIds.length > 0 ? (
          <BundleSection
            bundle={p.setBundle}
            currentProduct={p}
            rates={rates}
            loc={loc}
            t={t}
            db={db}
          />
        ) : null}

        {/* ===== benzer ürünler ===== */}
        <section className={styles.bottomSections}>
          {/* Benzer Ürünler */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.similarProducts}</h2>

              <div className={styles.relatedHeadRight}>
                <div className={styles.relatedArrows}>
                  <button
                    type="button"
                    className={styles.relatedArrow}
                    onClick={() => scrollRelated(-1)}
                    aria-label="Önceki ürünler"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={styles.relatedArrow}
                    onClick={() => scrollRelated(1)}
                    aria-label="Sonraki ürünler"
                  >
                    ›
                  </button>
                </div>

                <Link className={styles.sectionLink} href="/shop">
                  {t.seeAll}
                </Link>
              </div>
            </div>

            {relatedLoading ? (
              <div className={styles.sectionMuted}>{t.loading}</div>
            ) : related.length ? (
              <div className={styles.relatedSliderWrap}>
                <div ref={relatedScrollerRef} className={styles.relatedScroller}>
                  {related.map((rp: any) => {
                    const href = `/products/${encodeURIComponent(s(rp?.slug || rp?.id))}`;
                    const rTitle =
                      pickText(rp?.title, loc) ||
                      rp?.title?.tr ||
                      rp?.title ||
                      rp?.name ||
                      t.productWord;
                    const rImgs = imgList(rp);
                    const rImg = rImgs[0] || FALLBACK_IMG;
                    const { price: rPrice, compareAtPrice: rCompareAtPrice } = resolveProductPriceTRY(rp, rates);
                    return (
                      <div key={s(rp?.id) || href} className={styles.relatedSlide}>
                        <Link href={href} className={styles.relatedCard}>
                          <div className={styles.relatedMedia}>
                            <img src={rImg} alt={String(rTitle)} />
                          </div>

                          <div className={styles.relatedBody}>
                            <div className={styles.relatedTitle}>{String(rTitle)}</div>

                            {rCompareAtPrice ? (
                              <div className={styles.relatedComparePrice}>{formatTRY(rCompareAtPrice, 2)}</div>
                            ) : null}

                            <div className={styles.relatedPrice}>{formatTRY(rPrice, 2)}</div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.sectionMuted}>{t.noRelated}</div>
            )}
          </div>
          {/* trust */}
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <div className={styles.trustT}>{t.certifiedProduct}</div>
              <div className={styles.trustS}>{t.certifiedSub}</div>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustT}>{t.securePayment}</div>
              <div className={styles.trustS}>{t.securePaymentSub}</div>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustT}>{t.fastShipping}</div>
              <div className={styles.trustS}>{t.fastShippingSub}</div>
            </div>
          </div>
          {/* Yorumlar — Compact Modern */}
          <div className={styles.sectionCard}>
            {/* Compact Summary Bar */}
            <div className={styles.rvCompactBar}>
              <div className={styles.rvScoreChip}>
                <span className={styles.rvScoreNum}>
                  {reviewSummary.total ? reviewSummary.avg.toFixed(1) : "0.0"}
                </span>
                <div className={styles.rvScoreStars}>
                  {"★★★★★".slice(0, Math.round(reviewSummary.avg || 0))}
                  <span className={styles.reviewStarsOff}>
                    {"★★★★★".slice(0, 5 - Math.round(reviewSummary.avg || 0))}
                  </span>
                </div>
                <span className={styles.rvScoreSub}>
                  {reviewSummary.total ? `${reviewSummary.total} değerlendirme` : "Henüz değerlendirme yok"}
                </span>
              </div>

              <div className={styles.rvDistMini}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewSummary.counts[star as 1 | 2 | 3 | 4 | 5] || 0;
                  const width = reviewSummary.total ? (count / reviewSummary.total) * 100 : 0;
                  return (
                    <div key={star} className={styles.rvDistRow}>
                      <span className={styles.rvDistLabel}>{star}</span>
                      <div className={styles.rvDistTrack}>
                        <div className={styles.rvDistFill} style={{ width: `${width}%` }} />
                      </div>
                      <span className={styles.rvDistNum}>{count}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.rvBarActions}>
                <button
                  type="button"
                  className={styles.rvWriteBtn}
                  onClick={() => {
                    const el = document.getElementById("review-form-box");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  ✍ Yorum Yaz
                </button>
                <a
                  href="https://share.google/Q5VL7RpjjZoqSawiB"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.rvGoogleBtn}
                >
                  Google&apos;da Değerlendir
                </a>
              </div>
            </div>

            {/* Reviews + Form Grid */}
            <div className={styles.rvBody}>
              <div className={styles.rvListCol}>
                <div className={styles.rvListHead}>
                  <h2 className={styles.rvListTitle}>{t.reviews}</h2>
                  <span className={styles.rvListBadge}>{t.approvedReviews}</span>
                </div>

                {reviews.length ? (
                  <div className={styles.rvList}>
                    {reviews.map((r) => {
                      const source = getReviewSourceMeta(r);
                      return (
                        <div key={r.id} className={styles.rvItem}>
                          <div className={styles.rvItemTop}>
                            <span className={styles.rvItemName}>{r.name}</span>
                            <span className={styles.rvItemStars}>
                              {"★★★★★".slice(0, r.rating)}
                              <span className={styles.reviewStarsOff}>
                                {"★★★★★".slice(0, 5 - r.rating)}
                              </span>
                            </span>
                          </div>
                          <p className={styles.rvItemText}>{r.text}</p>
                          <div className={styles.rvItemFoot}>
                            <span className={`${styles.rvItemBadge} ${source.className}`}>
                              {source.label}
                            </span>
                            <span className={styles.rvItemDate}>
                              {r.createdAt?.toDate
                                ? r.createdAt.toDate().toLocaleDateString("tr-TR", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                                : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.rvEmpty}>{t.noReviews}</div>
                )}
              </div>

              <div id="review-form-box" className={styles.rvFormCol}>
                <div className={styles.rvFormCard}>
                  <h3 className={styles.rvFormTitle}>✍ Yorum Bırakın</h3>
                  <p className={styles.rvFormSub}>Deneyiminizi paylaşarak diğer müşterilerimize yol gösterin.</p>

                  <div className={styles.rvForm}>
                    <div className={styles.rvFormRow}>
                      <input
                        className={styles.rvFormInput}
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        placeholder={t.yourNameOptional}
                      />
                      <select
                        className={styles.rvFormSelect}
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                      >
                        <option value={5}>5 ★</option>
                        <option value={4}>4 ★</option>
                        <option value={3}>3 ★</option>
                        <option value={2}>2 ★</option>
                        <option value={1}>1 ★</option>
                      </select>
                    </div>

                    <textarea
                      className={styles.rvFormTextarea}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder={t.writeReview}
                      rows={4}
                    />

                    <button
                      type="button"
                      className={styles.rvFormSubmit}
                      onClick={submitReview}
                      disabled={reviewSending}
                    >
                      {reviewSending ? t.sending : t.sendReview}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* toast */}
        {toast ? (
          <div className={styles.toast} role="status" aria-live="polite">
            <div className={styles.toastInner}>
              <div className={styles.toastDot} />
              <div className={styles.toastText}>{toast}</div>
            </div>
            <div className={styles.toastBar} />
          </div>
        ) : null}

        <RecentlyViewed excludeSlug={slug} />
      </div>
    </main>
  );

}