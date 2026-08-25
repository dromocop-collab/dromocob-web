import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ölçü Rehberi | Dromocob",
  description:
    "Yüzük, bileklik ve kolye ölçü rehberi. Doğru ölçüyü bulmanız için kapsamlı rehber, ölçü tabloları ve ipuçları.",
  keywords: [
    "yüzük ölçüsü",
    "bileklik ölçüsü",
    "kolye ölçüsü",
    "yüzük ölçü tablosu",
    "takı ölçü rehberi",
  ],
  alternates: {
    canonical: "https://demo.dromocob.com/olcu-rehberi",
  },
  openGraph: {
    title: "Ölçü Rehberi | Dromocob",
    description:
      "Yüzük, bileklik ve kolye ölçü rehberi. Doğru ölçüyü bulmanız için kapsamlı rehber.",
    url: "https://demo.dromocob.com/olcu-rehberi",
    type: "website",
  },
};

export default function OlcuRehberiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
