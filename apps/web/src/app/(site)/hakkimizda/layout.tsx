import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dromocob Dijital Deneyim Stüdyosu",
  description:
    "Dromocob; strateji, deneyim tasarımı, web geliştirme ve SEO alanlarını birleştiren bağımsız dijital ürün stüdyosudur.",
  keywords: [
    "Dromocob dijital stüdyo",
    "web tasarım ajansı İstanbul",
    "dijital ürün stüdyosu",
    "deneyim tasarımı ajansı",
  ],
  alternates: {
    canonical: "https://dromocob-web--dromocob-web-edit.europe-west4.hosted.app/hakkimizda",
  },
  openGraph: {
    title: "Dromocob Dijital Deneyim Stüdyosu",
    description:
      "Strateji, tasarım, teknoloji ve büyümeyi tek ekipte buluşturan bağımsız dijital ürün stüdyosu.",
    url: "https://dromocob-web--dromocob-web-edit.europe-west4.hosted.app/hakkimizda",
    type: "website",
  },
};

export default function DromocobAboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
