import type { Metadata } from "next";
import Script from "next/script";
import { adminDb } from "@/lib/firebase.admin";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";
import ProductClient from "./ProductClient";

function pickText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  return String(v?.tr || v?.en || "").trim();
}

async function getProduct(slug: string) {
  try {
    const db = adminDb();

    const bySlug = await db
      .collection("products")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!bySlug.empty) {
      const doc = bySlug.docs[0];
      return { id: doc.id, ...doc.data() } as any;
    }

    const byId = await db.collection("products").doc(slug).get();
    if (byId.exists) {
      return { id: byId.id, ...byId.data() } as any;
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug);
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: "Ürün Bulunamadı | Dromocob",
      robots: { index: false, follow: false },
    };
  }

  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);

  const title = pickText(product.title) || pickText(product.name) || "Ürün";
  const desc =
    pickText(product.description) ||
    pickText(product.shortDescription) ||
    `${title} — Dromocob'ta. Sertifikalı ürün, güvenli ödeme.`;

  const images: string[] = [];
  const mainImg =
    product.mainImage || product.image || product.cover || product.thumbnail;
  if (mainImg) images.push(String(mainImg));
  if (Array.isArray(product.images)) {
    product.images
      .slice(0, 3)
      .forEach((img: any) => {
        const u = String(img || "").trim();
        if (u && !images.includes(u)) images.push(u);
      });
  }

  const canonical = baseUrl
    ? `${baseUrl}/products/${encodeURIComponent(product.slug || slug)}`
    : undefined;

  return {
    title: `${title} | Dromocob`,
    description: desc.slice(0, 160),
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | Dromocob`,
      description: desc.slice(0, 160),
      url: canonical,
      type: "website",
      images: images.length
        ? images.map((url) => ({ url, alt: title }))
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Dromocob`,
      description: desc.slice(0, 160),
      images: images.length ? images : undefined,
    },
  };
}

function buildProductJsonLd(product: any, baseUrl: string) {
  const title = pickText(product.title) || pickText(product.name) || "Ürün";
  const desc =
    pickText(product.description) ||
    pickText(product.shortDescription) ||
    `${title} — Dromocob`;

  const images: string[] = [];
  const mainImg =
    product.mainImage || product.image || product.cover || product.thumbnail;
  if (mainImg) images.push(String(mainImg));
  if (Array.isArray(product.images)) {
    product.images.slice(0, 4).forEach((img: any) => {
      const u = String(img || "").trim();
      if (u && !images.includes(u)) images.push(u);
    });
  }

  const price =
    Number(product.finalPrice || product.priceTry || product.price || product.salePrice || 0);
  const stock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
  const sku = String(product.sku || product.id || "").trim();
  const slug = String(product.slug || product.id || "").trim();
  const url = `${baseUrl}/products/${encodeURIComponent(slug)}`;

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: desc.slice(0, 300),
    sku,
    url,
    brand: {
      "@type": "Brand",
      name: "Dromocob",
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "TRY",
      price: price > 0 ? price.toFixed(2) : undefined,
      availability:
        stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "Dromocob",
      },
    },
  };

  if (images.length) {
    jsonLd.image = images;
  }

  return jsonLd;
}

export default async function Page({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const product = await getProduct(slug);

  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo) || "https://demo.dromocob.com";

  const jsonLd = product ? buildProductJsonLd(product, baseUrl) : null;

  // Server-side ürün bilgileri — Google bot ve crawlerlar için
  const ssrTitle = product
    ? pickText(product.title) || pickText(product.name) || "Ürün"
    : null;
  const ssrDesc = product
    ? pickText(product.description) || pickText(product.shortDescription) || ""
    : null;
  const ssrCategory = product
    ? pickText(product.categoryName) || pickText(product.category) || ""
    : null;
  const ssrKarat = product?.karat ? `${product.karat}K` : null;
  const ssrGram = product?.weightGram
    ? `${Number(product.weightGram).toFixed(2)}g`
    : null;

  return (
    <>
      {jsonLd ? (
        <Script
          id="jsonld-product"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      {/* Server-side rendered product info for SEO crawlers */}
      {product ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            borderWidth: 0,
          }}
        >
          <h1>{ssrTitle}</h1>
          {ssrCategory ? <p>Kategori: {ssrCategory}</p> : null}
          {ssrKarat ? <p>Ayar: {ssrKarat}</p> : null}
          {ssrGram ? <p>Ağırlık: {ssrGram}</p> : null}
          {ssrDesc ? <p>{ssrDesc}</p> : null}
        </div>
      ) : null}

      <ProductClient slug={slug} />
    </>
  );
}