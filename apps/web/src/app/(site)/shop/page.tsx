// apps/web/src/app/shop/page.tsx
import type { Metadata } from "next";
import ShopClient from "./ShopClient";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);
  // Canonical her zaman /shop — ?cat= filtreli URL'lerin duplicate olmasını önler
  const canonical = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/shop` : undefined;

  return {
    title: "Mağaza | Dromocob",
    description:
      "tasarım aksesuar, kolye, küpe, yüzük, kelepçe ve daha fazlası. Sertifikalı ürünler, güncel kur fiyatları, güvenli ödeme ve hızlı kargo ile online alışveriş.",
    alternates: {
      canonical,
    },
    openGraph: {
      title: "Mağaza | Dromocob",
      description:
        "tasarım aksesuar, kolye, küpe, yüzük ve daha fazlasını keşfet. Sertifikalı ürünler, güvenli ödeme.",
      url: canonical,
      siteName: "Dromocob",
      type: "website",
      images: seo.meta.defaultOgImage
        ? [{ url: seo.meta.defaultOgImage, alt: "Dromocob Mağaza" }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: "Mağaza | Dromocob",
      description:
        "Seçkin ürünleri keşfet. Güvenli ödeme, hızlı kargo.",
      images: seo.meta.defaultOgImage ? [seo.meta.defaultOgImage] : undefined,
    },
  };
}

export default function ShopPage({
  searchParams,
}: {
  searchParams?: { cat?: string; q?: string; sort?: string };
}) {
  const cat = (searchParams?.cat || "").trim();
  const q = (searchParams?.q || "").trim();
  const sort = (searchParams?.sort || "new").trim();

  return <ShopClient initialCat={cat} initialQ={q} initialSort={sort} />;
}
