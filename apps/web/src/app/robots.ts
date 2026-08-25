import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Allow: / tüm sayfaları açık tutar.
        // Sadece erişilmemesi gereken yolları disallow ile belirtiyoruz.
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/login",
          "/register",
          "/forgot",
          "/verify-email",
          "/cart",
          "/checkout",
          "/checkout/",
          "/hesabim",
          "/account",
          "/account/",
          "/search",
          // Eski /products/id/ route'u artık redirect yapıyor, crawl'a gerek yok
          "/products/id/",
        ],
      },
    ],
    sitemap: [
      "https://demo.dromocob.com/sitemap.xml",
    ],
    host: "https://demo.dromocob.com",
  };
}