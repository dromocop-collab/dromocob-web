import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi | Dromocob",
  description:
    "Mesafeli satış sözleşmesi. Sipariş, teslimat ve satış sürecine ilişkin genel hükümler.",
  alternates: {
    canonical: "https://demo.dromocob.com/mesafeli-satis-sozlesmesi",
  },
};

export default function DistanceSalesAgreementPage() {
  return (
    <LegalPageTemplate
      eyebrow="Satış Süreci"
      title="Mesafeli Satış Sözleşmesi"
      updatedAt="19.04.2026"
      description="Bu sözleşme, Dromocob dijital satış kanalları üzerinden verilen siparişlerde alıcı ile satıcı arasındaki satış ilişkisinin genel esaslarını belirler."
      sections={[
        {
          title: "Taraflar",
          body: "Satıcı: DROMOCOB DEMO MAĞAZACILIK A.Ş.. Alıcı: Platform üzerinden sipariş veren kullanıcıdır.",
        },
        {
          title: "Konu",
          body: "Bu sözleşmenin konusu, alıcının elektronik ortamda sipariş verdiği ürün veya hizmetin satışı, teslimi ve bu sürece ilişkin hak ve yükümlülüklerin belirlenmesidir.",
        },
        {
          title: "Sipariş ve Ödeme",
          body: "Siparişin geçerli sayılması, ödeme işleminin onaylanmasına bağlıdır. Teknik hata, stok sorunu veya güvenlik doğrulaması gerektiren durumlarda sipariş ayrıca incelenebilir.",
        },
        {
          title: "Teslimat",
          body: "Satın alınan ürünler, sipariş sırasında belirtilen teslimat bilgilerine uygun olarak hazırlanır ve ilgili taşıyıcı ile gönderilir. Teslim süresi ürünün stok ve hazırlık durumuna göre değişebilir.",
        },
        {
          title: "İade ve Cayma",
          body: "İptal, iade, değişim ve cayma hakkına ilişkin süreçler ilgili mevzuat ve ayrıca yayınlanan iade/iptal koşulları çerçevesinde değerlendirilir.",
        },
      ]}
    />
  );
}