import type { Metadata } from "next";
import RealPortfolioShowcase from "@/components/studio/RealPortfolioShowcase";
import { realPortfolio } from "@/data/realPortfolio";

export const metadata: Metadata = {
  title: "Web Sitesi ve Mobil Uygulama Projelerimiz",
  description: "Cihat Erdem Studio ve Dromocob tarafından geliştirilen canlı web sitesi, e-ticaret, SaaS ve iOS mobil uygulama projelerini inceleyin.",
  keywords: ["web tasarım projeleri", "mobil uygulama projeleri", "Cihat Erdem projeleri", "Dromocob projeleri", "iOS uygulama örnekleri", "e-ticaret sitesi örnekleri"],
  alternates: { canonical: "https://dromocob.tr/projelerimiz" },
  robots: { index: true, follow: true },
  openGraph: { title: "Canlı Web ve Mobil Uygulama Projeleri", description: "Örnek şablonlar değil; gerçek kullanıcılar ve markalar için yayına alınmış dijital ürünler.", images: [{ url: "/portfolio/dromocob/6nci-kuyumculuk.jpg" }] },
  twitter: { card: "summary_large_image", title: "Canlı Web ve Mobil Uygulama Projeleri", description: "Gerçek markalar için yayına alınmış web, SaaS ve iOS ürünleri.", images: ["/portfolio/dromocob/6nci-kuyumculuk.jpg"] },
};

export default function ProjectsPage(){
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Cihat Erdem Studio web ve mobil uygulama projeleri",
    numberOfItems: realPortfolio.length,
    itemListElement: realPortfolio.map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: project.liveUrl ?? project.caseUrl ?? `https://dromocob.tr/projelerimiz#${project.slug}`,
      name: project.name,
      description: project.summary,
      image: `https://dromocob.tr${project.image}`,
    })),
  };

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
    <RealPortfolioShowcase full />
  </main>;
}
