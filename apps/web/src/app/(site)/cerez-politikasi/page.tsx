import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "Çerez Politikası | Dromocob",
  description:
    "Dromocob çerez politikası. Çerezlerin kullanım amaçları, üçüncü taraf araçlar ve tercih yönetimi hakkında bilgilendirme.",
  alternates: {
    canonical: "https://demo.dromocob.com/cerez-politikasi",
  },
};

export default function CookiePolicyPage() {
  return (
    <LegalPageTemplate
      eyebrow="Yasal Metin"
      title="Çerez Politikası"
      updatedAt="10.06.2026"
      description="Bu çerez politikası, DROMOCOB DEMO MAĞAZACILIK A.Ş. tarafından sunulan Dromocob web sitesi ve ilişkili dijital hizmetlerde kullanılan çerezler, izleme teknolojileri ve reklam ölçümleme araçlarına ilişkin bilgilendirmeyi içerir."
      sections={[
        {
          title: "Çerez Nedir?",
          body: "Çerezler, web sitesini ziyaret ettiğinizde tarayıcınıza yerleştirilen küçük metin dosyalarıdır. Oturum yönetimi, kullanıcı tercihlerinin hatırlanması, site performansının ölçülmesi ve kişiselleştirilmiş deneyim sunulması gibi amaçlarla kullanılır.",
        },
        {
          title: "Kullandığımız Çerez Türleri",
          body: "Zorunlu çerezler: Sitenin temel işlevleri (oturum, güvenlik, sepet) için gereklidir. Performans ve analitik çerezler: Ziyaretçi davranışlarını anonim olarak analiz etmek, site performansını ölçmek ve iyileştirmeler yapmak için kullanılır (örneğin Google Analytics 4). Pazarlama ve reklam çerezler: Reklam kampanyalarının etkinliğini ölçmek, dönüşüm eşleştirmesi yapmak ve size daha alakalı içerikler sunmak amacıyla kullanılır.",
        },
        {
          title: "Üçüncü Taraf Araçlar ve Reklam Ölçümleme",
          body: "Sitemizde Google Tag Manager (GTM), Google Analytics 4 (GA4), Google Ads dönüşüm izleme ve Meta (Facebook) Pixel gibi üçüncü taraf analitik ve reklam ölçümleme araçları kullanılmaktadır. Bu araçlar; sayfa görüntüleme, ürün inceleme, sepete ekleme, satın alma gibi etkileşimleri anonim veya takma adlı şekilde izleyerek reklam performansını ölçer. Google Ads gelişmiş dönüşümler kapsamında, sipariş sırasında verilen e-posta adresi, telefon numarası ve ad-soyad gibi bilgiler, hash (şifrelenmiş) hâlde Google sunucularına iletilerek reklam dönüşüm eşleştirmesi yapılabilir. Bu veriler doğrudan kimlik tanımlamak için değil, yalnızca reklam etkinliğini ölçmek amacıyla kullanılır.",
        },
        {
          title: "Veri İşleme ve KVKK",
          body: "Çerezler aracılığıyla toplanan veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında işlenmektedir. Detaylı bilgi için KVKK Aydınlatma Metni ve Gizlilik Politikası sayfalarımızı inceleyebilirsiniz.",
        },
        {
          title: "Çerez Tercihlerinizi Yönetme",
          body: "Tarayıcı ayarlarınızdan çerezleri tamamen engelleyebilir veya silebilirsiniz. Ancak zorunlu çerezlerin devre dışı bırakılması site işlevselliğini olumsuz etkileyebilir. Sitemizi ilk ziyaretinizde gösterilen çerez bildiriminden tercihlerinizi belirtebilirsiniz.",
        },
        {
          title: "İletişim",
          body: "Çerez politikamız hakkında sorularınız için hello@dromocob.com adresine e-posta gönderebilirsiniz.",
        },
      ]}
    />
  );
}
