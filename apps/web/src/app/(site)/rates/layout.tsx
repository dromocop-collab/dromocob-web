import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Piyasa Verileri | Dromocob",
  description:
    "Dinamik fiyatlandırma altyapısında kullanılan güncel piyasa verilerini takip edin.",
  keywords: [
    "piyasa verileri",
    "dinamik fiyatlandırma",
    "güncel fiyat verisi",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/rates",
  },
  openGraph: {
    title: "Piyasa Verileri | Dromocob",
    description:
      "Dinamik fiyatlandırma altyapısında kullanılan güncel piyasa verileri.",
    url: "https://demo.dromocob.com/rates",
    type: "website",
  },
};

export default function RatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
