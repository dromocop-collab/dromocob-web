export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);

  return {
    title: "Dromocob",
    description:
      "Dromocob, demo.dromocob.com ve Dromocob aramalarında öne çıkan; ev, yaşam, aksesuar ve teknoloji modellerini güvenli ödeme ve hızlı kargo ile sunan online mağaza.",
    keywords: [
      "Dromocob e-ticaret",
      "Dromocob",
      "Dromocob",
      "Dromocob",
      "Dromocob tr",
      "Dromocob e-ticaret",
      "tasarım aksesuar",
      "yaşam ürünü",
      "aksesuar",
      "özel tasarım",
      "online mağaza",
      "istanbul mağaza",
      "kalite kontrollü ürün",
      "güvenli online mağaza",
    ],
    alternates: {
      canonical: baseUrl || undefined,
    },
    openGraph: {
      title: "Dromocob",
      description:
        "ev, yaşam, aksesuar ve teknoloji modellerinde güvenli ödeme, sertifikalı ürün ve hızlı kargo.",
      url: baseUrl || undefined,
      siteName: "Dromocob",
      type: "website",
      images: seo.meta.defaultOgImage
        ? [
            {
              url: seo.meta.defaultOgImage,
              alt: "Dromocob",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: "Dromocob",
      description:
        "Ev, yaşam, aksesuar ve teknoloji ürünlerinde güvenli ödeme ve hızlı kargo.",
      images: seo.meta.defaultOgImage ? [seo.meta.defaultOgImage] : undefined,
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
