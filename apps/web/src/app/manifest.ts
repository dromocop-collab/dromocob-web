import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dromocob — tasarım ürünleri",
    short_name: "Dromocob",
    description:
      "kalite kontrollü ürün, özel ürün ve aksesuar. Güvenli online alışveriş.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#1a1a2e",
    orientation: "portrait-primary",
    categories: ["shopping", "lifestyle"],
    icons: [
      {
        src: "/dromocob-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/dromocob-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/dromocob-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
