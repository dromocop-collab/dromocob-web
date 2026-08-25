import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dromocob Demo Store | Yeni nesil e-ticaret",
  description: "Markalara özel, hızlı ve dönüşüm odaklı e-ticaret deneyimi.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#f4f1e9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
