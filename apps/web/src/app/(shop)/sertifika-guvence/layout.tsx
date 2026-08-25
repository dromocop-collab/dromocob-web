import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sertifika ve Güvence | Dromocob",
  description:
    "Dromocob sertifika ve güvence politikası. Kalite belgeli ürünler, garanti kapsamı ve güvenli alışveriş ilkeleri.",
  keywords: [
    "sertifikalı ürün",
    "ürün sertifikası",
    "mağaza güvence",
    "kalite belgeli ürün",
    "güvenli alışveriş",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/sertifika-guvence",
  },
  openGraph: {
    title: "Sertifika ve Güvence | Dromocob",
    description:
      "Kalite belgeli ürünler, garanti kapsamı ve güvenli alışveriş ilkeleri.",
    url: "https://demo.dromocob.com/sertifika-guvence",
    type: "website",
  },
};

export default function SertifikaGuvenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
