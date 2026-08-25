import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Dromocob",
  description:
    "Dromocob web sitesi ve uygulama kullanım koşulları. Hizmet kullanımına ilişkin genel hükümler.",
  alternates: {
    canonical: "https://dromocob.tr/kullanim-kosullari",
  },
};

export default function TermsPage() {
  return (
    <LegalPageTemplate
      eyebrow="Yasal Metin"
      title="Kullanım Koşulları"
      updatedAt="19.04.2026"
      description="Bu kullanım koşulları, DROMOCOB DEMO MAĞAZACILIK A.Ş. tarafından sunulan Dromocob platformlarını kullanan tüm ziyaretçi ve üyeler için geçerlidir."
      sections={[
        {
          title: "Hizmet Kapsamı",
          body: "Platform üzerinden ürün inceleme, hesap yönetimi, sipariş görüntüleme, destek talebi oluşturma, stok bildirimi ve benzeri işlemler gerçekleştirilebilir. Hizmet kapsamı ihtiyaçlara göre güncellenebilir.",
        },
        {
          title: "Kullanıcı Sorumluluğu",
          body: "Kullanıcı, platforma girdiği bilgilerin doğru ve güncel olduğunu kabul eder. Hesap güvenliği, şifre gizliliği ve hesap üzerinden yapılan işlemlerden kullanıcı sorumludur.",
        },
        {
          title: "İçerik ve Fikri Haklar",
          body: "Platformda yer alan marka unsurları, ürün görselleri, metinler, açıklamalar ve tasarımlar ilgili fikri mülkiyet hakları kapsamında korunur. İzinsiz kullanılamaz, çoğaltılamaz ve kopyalanamaz.",
        },
        {
          title: "Hizmette Değişiklik",
          body: "Şirket, platformun bazı bölümlerini güncelleme, geçici olarak durdurma veya tamamen sonlandırma hakkını saklı tutar.",
        },
        {
          title: "İletişim ve Uyuşmazlık",
          body: "Kullanıma ilişkin talepler ve bildirimler için info@dromocob.tr üzerinden veya iletişim kanalları üzerinden bize ulaşılabilir. Tüketici işlemlerinde yürürlükteki mevzuat esas alınır.",
        },
      ]}
    />
  );
}