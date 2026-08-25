import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Tasarım Projesi ve İletişim",
  description:
    "Web tasarım, e-ticaret, kurumsal site ve dijital ürün projeniz için Dromocob ile iletişime geçin. Ücretsiz ön görüşme ve size özel proje yol haritası.",
  keywords: [
    "web tasarım iletişim",
    "web sitesi teklif al",
    "İstanbul web tasarım ajansı",
    "e ticaret sitesi yaptırma",
    "Dromocob iletişim",
  ],
  alternates: {
    canonical: "https://dromocob-web--dromocob-web-edit.europe-west4.hosted.app/iletisim",
  },
  openGraph: {
    title: "Web Projenizi Dromocob ile Başlatın",
    description:
      "Fikrinizi paylaşın; strateji, tasarım ve teknoloji ekibimiz size özel yol haritası hazırlasın.",
    url: "https://dromocob-web--dromocob-web-edit.europe-west4.hosted.app/iletisim",
    type: "website",
  },
};

export default function IletisimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
