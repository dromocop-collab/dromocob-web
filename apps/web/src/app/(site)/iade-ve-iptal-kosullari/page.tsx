import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "İade ve İptal Koşulları | Dromocob",
  description:
    "İade ve iptal koşulları. Sipariş iptali, iade ve geri ödeme süreçlerine ilişkin genel esaslar.",
  alternates: {
    canonical: "https://dromocob.tr/iade-ve-iptal-kosullari",
  },
};

export default function ReturnPolicyPage() {
  return (
    <LegalPageTemplate
      eyebrow="Satış Sonrası"
      title="İade ve İptal Koşulları"
      updatedAt="19.04.2026"
      description="Bu metin, Dromocob üzerinden verilen siparişlerde iptal, iade ve geri ödeme süreçlerine ilişkin genel esasları açıklamaktadır."
      sections={[
        {
          title: "Sipariş İptali",
          body: "Sipariş, hazırlık veya kargoya teslim sürecine geçmeden önce uygun koşullarda iptal talebine konu olabilir. Her talep siparişin mevcut durumuna göre değerlendirilir.",
        },
        {
          title: "İade Şartları",
          body: "İade talepleri, ürünün niteliği, teslim şekli, kullanım durumu ve yürürlükteki mevzuat kapsamında değerlendirilir. Özel üretim veya kişiye özel işlemlerde farklı koşullar uygulanabilir.",
        },
        {
          title: "Kontrol Süreci",
          body: "İade edilen ürünler, yeniden satışa uygunluk ve fiziksel durum açısından incelenebilir. Kullanılmış, hasar görmüş veya eksik gönderilen ürünlerde farklı değerlendirme yapılabilir.",
        },
        {
          title: "Geri Ödeme",
          body: "İadesi uygun bulunan siparişlerde geri ödeme, kullanılan ödeme yöntemi ve ilgili finans kuruluşunun süreçlerine bağlı olarak belirli süre içinde gerçekleştirilir.",
        },
        {
          title: "İletişim",
          body: "İptal ve iade talepleriniz için info@dromocob.tr adresi veya iletişim kanalları üzerinden bizimle iletişime geçebilirsiniz.",
        },
      ]}
    />
  );
}