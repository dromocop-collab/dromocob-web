import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular | Dromocob",
  description:
    "Dromocob hakkında sıkça sorulan sorular. Sipariş, ödeme, kargo, iade, ürün bilgisi ve hesap işlemleri hakkında tüm cevaplar.",
  keywords: [
    "Dromocob e-ticaret sorular",
    "online mağaza sıkça sorulan sorular",
    "ürün iade koşulları",
    "mağaza kargo",
  ],
  alternates: {
    canonical: "https://dromocob.tr/sss",
  },
  openGraph: {
    title: "Sıkça Sorulan Sorular | Dromocob",
    description:
      "Sipariş, ödeme, kargo, iade ve ürün bilgisi hakkında tüm cevaplar.",
    url: "https://dromocob.tr/sss",
    type: "website",
  },
};

/* ── FAQPage JSON-LD — Google Rich Results FAQ snippet'ı için ── */
const FAQ_ITEMS = [
  {
    q: "Hangi ödeme yöntemleriyle alışveriş yapabilirim?",
    a: "Kredi kartı / banka kartı (Visa, Mastercard, Troy) ile güvenli 3D Secure ödeme ve havale/EFT seçeneklerini sunuyoruz. PayTR güvencesiyle tüm ödemeler güvenle işlenir.",
  },
  {
    q: "Taksit seçeneği var mı?",
    a: "Evet, kredi kartıyla ödeme sırasında PayTR ödeme ekranında bankanızın sunduğu taksit seçenekleri otomatik olarak görüntülenir.",
  },
  {
    q: "Kargo ücreti ne kadar?",
    a: "Kargo ücretleri sipariş tutarına göre değişmektedir. Belirli bir tutarın üzerindeki siparişlerde ücretsiz kargo sunmaktayız.",
  },
  {
    q: "Siparişim ne zaman kargoya verilir?",
    a: "Ödemeniz onaylandıktan sonra siparişiniz genellikle 1-3 iş günü içinde kargoya teslim edilir.",
  },
  {
    q: "İade süreci nasıl işliyor?",
    a: "Ürünü teslim aldıktan sonra 14 gün içinde iade talebinde bulunabilirsiniz. Hesabım → İade Talepleri sekmesinden iade talebinizi oluşturabilirsiniz.",
  },
  {
    q: "Ürünleriniz sertifikalı mı?",
    a: "Sertifika veya garanti belgesi bulunan ürünlerde ilgili dokümanlar ürünle birlikte gönderilir.",
  },
  {
    q: "Fiyatlar neden değişiyor?",
    a: "Kampanya, stok, tedarik ve piyasa koşullarına göre fiyatlar güncellenebilir.",
  },
  {
    q: "Doğru ölçüyü nasıl seçebilirim?",
    a: "Ölçü Rehberi sayfamızdaki adımları izleyebilir veya destek ekibimizden yardım alabilirsiniz.",
  },
  {
    q: "Kargo takibi nasıl yapılır?",
    a: "Siparişiniz kargoya verildikten sonra Hesabım → Kargo Takip sekmesinden MNG Kargo takip numaranızla gönderinizi anlık olarak izleyebilirsiniz.",
  },
  {
    q: "Hesap oluşturmak zorunlu mu?",
    a: "Sipariş verebilmek için üye olmanız gerekmektedir. Üyelik sayesinde siparişlerinizi takip edebilir, iade talebi oluşturabilir ve özel kampanyalardan yararlanabilirsiniz.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function SssLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="jsonld-faq"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
