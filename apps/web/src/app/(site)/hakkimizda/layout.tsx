import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dromocob Hakkında | Dromocob",
  description:
    "Dromocob hakkında. Markamızın hikâyesi, vizyonumuz ve kalite kontrollü ürün anlayışımız.",
  keywords: [
    "Dromocob e-ticaret hakkında",
    "Dromocob e-ticaret",
    "Dromocob hikaye",
    "mağaza fethiye",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/hakkimizda",
  },
  openGraph: {
    title: "Dromocob Hakkında | Dromocob",
    description:
      "Markamızın hikâyesi, vizyonumuz ve kalite kontrollü ürün anlayışımız.",
    url: "https://demo.dromocob.com/hakkimizda",
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
