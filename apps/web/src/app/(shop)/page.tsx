export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);

  return {
    title: "Web Tasarım, E-Ticaret ve SEO Ajansı",
    description:
      "Rent a car, e-ticaret, emlak, restoran, otel, sağlık ve kurumsal markalar için gelişmiş, yönetim panelli web sitesi tasarımları.",
    keywords: [
      "Cihat Erdem web tasarım",
      "İstanbul web tasarım ajansı",
      "SEO uyumlu web sitesi",
      "yönetim panelli web sitesi",
      "rent a car web sitesi",
      "e-ticaret web sitesi",
      "emlak web sitesi",
      "kurumsal web tasarım",
      "hazır web sitesi tasarımları",
    ],
    alternates: {
      canonical: baseUrl || undefined,
    },
    openGraph: {
      title: "Cihat Erdem Studio | Web Tasarım, E-Ticaret ve SEO",
      description:
        "Her sektör için birbirinden farklı, gelişmiş ve satış odaklı web sitesi deneyimleri.",
      url: baseUrl || undefined,
      siteName: "Cihat Erdem Studio",
      type: "website",
      images: seo.meta.defaultOgImage
        ? [
            {
              url: seo.meta.defaultOgImage,
              alt: "Cihat Erdem Web Tasarım Stüdyosu",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: "Cihat Erdem Studio | Web Tasarım, E-Ticaret ve SEO",
      description:
        "Sektörünüze göre gelişmiş web sitesi tasarımlarını keşfedin.",
      images: seo.meta.defaultOgImage ? [seo.meta.defaultOgImage] : undefined,
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
