import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kargo ve Teslimat | Dromocob",
  description:
    "Dromocob kargo ve teslimat bilgileri. Sigortalı kargo, teslimat süreleri, ücretsiz kargo koşulları ve MNG Kargo ile güvenli gönderim.",
  keywords: [
    "Dromocob e-ticaret kargo",
    "ürün kargosu",
    "mağaza teslimat",
    "ücretsiz kargo",
    "sigortalı kargo",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/kargo-teslimat",
  },
  openGraph: {
    title: "Kargo ve Teslimat | Dromocob",
    description:
      "Sigortalı kargo, teslimat süreleri ve ücretsiz kargo koşulları.",
    url: "https://demo.dromocob.com/kargo-teslimat",
    type: "website",
  },
};

export default function KargoTeslimatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
