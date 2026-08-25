import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cihat Erdem — Web Tasarım ve SEO Stüdyosu",
    short_name: "Cihat Erdem",
    description:
      "Cihat Erdem tarafından kurulan; web tasarım, e-ticaret ve dijital ürün stüdyosu.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#1a1a2e",
    orientation: "portrait-primary",
    categories: ["business", "design", "productivity"],
    icons: [
      {
        src: "/dromocob-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/dromocob-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/dromocob-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
