import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hediye Danışmanlığı | Dromocob",
  description:
    "Sevdiklerinize en doğru hediyeyi seçmeniz için kişisel danışmanlık hizmeti. Koleksiyon, aksesuar ve yaşam tarzı önerileri.",
  keywords: [
    "hediye danışmanlığı",
    "kişisel hediye önerisi",
    "mağaza hediye önerisi",
    "özel ürün hediye",
    "aksesuar hediye",
  ],
  alternates: {
    canonical: "https://dromocob.tr/hediye-danismanligi",
  },
  openGraph: {
    title: "Hediye Danışmanlığı | Dromocob",
    description:
      "Sevdiklerinize en doğru hediyeyi seçmeniz için kişisel danışmanlık hizmeti.",
    url: "https://dromocob.tr/hediye-danismanligi",
    type: "website",
  },
};

export default function HediyeDanismanligiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
