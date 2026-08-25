import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Randevu & Mağaza Deneyimi | Dromocob",
  description:
    "Dromocob mağaza ziyaret randevusu. İstanbul mağazamızda kişiye özel danışmanlık ve özel ürün deneyimi için randevu alın.",
  keywords: [
    "mağaza randevu",
    "mağaza ziyareti",
    "kişisel mağaza deneyimi",
    "mağaza İstanbul",
    "özel ürün deneyimi",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/randevu-magaza-deneyimi",
  },
  openGraph: {
    title: "Randevu & Mağaza Deneyimi | Dromocob",
    description:
      "İstanbul mağazamızda kişiye özel danışmanlık ve özel ürün deneyimi için randevu alın.",
    url: "https://demo.dromocob.com/randevu-magaza-deneyimi",
    type: "website",
  },
};

export default function RandevuMagazaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
