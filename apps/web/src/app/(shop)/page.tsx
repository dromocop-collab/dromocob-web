export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);

  return {
    title: "Sektörünüze Özel Ultra Web Tasarımları",
    description:
      "Rent a car, e-ticaret, emlak, restoran, otel, sağlık ve kurumsal markalar için gelişmiş, yönetim panelli web sitesi tasarımları.",
    keywords: [
      "Dromocob web tasarım",
      "Dromocob web tasarım ajansı",
      "Dromocob İstanbul",
      "Dromocob e-ticaret",
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
      title: "Dromocob | Ultra Web Tasarımları",
      description:
        "Her sektör için birbirinden farklı, gelişmiş ve satış odaklı web sitesi deneyimleri.",
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
      title: "Dromocob | Ultra Web Tasarımları",
      description:
        "Sektörünüze göre gelişmiş web sitesi tasarımlarını keşfedin.",
      images: seo.meta.defaultOgImage ? [seo.meta.defaultOgImage] : undefined,
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
