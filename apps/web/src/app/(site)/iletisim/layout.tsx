import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim | Dromocob",
  description:
    "Dromocob iletişim bilgileri. Telefon, WhatsApp, e-posta ve mağaza adresi ile bize ulaşın. İstanbul.",
  keywords: [
    "Dromocob e-ticaret iletişim",
    "Dromocob e-ticaret telefon",
    "mağaza İstanbul",
    "Dromocob iletişim",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/iletisim",
  },
  openGraph: {
    title: "İletişim | Dromocob",
    description:
      "Telefon, WhatsApp, e-posta ve mağaza adresi ile bize ulaşın.",
    url: "https://demo.dromocob.com/iletisim",
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
