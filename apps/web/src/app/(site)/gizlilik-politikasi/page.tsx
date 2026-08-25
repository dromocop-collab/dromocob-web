import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Dromocob",
  description:
    "Dromocob gizlilik politikası. Kişisel verilerin işlenmesi, saklanması ve korunmasına ilişkin bilgilendirme metni.",
  alternates: {
    canonical: "https://demo.dromocob.com/gizlilik-politikasi",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageTemplate
      eyebrow="Yasal Metin"
      title="Gizlilik Politikası"
      updatedAt="19.04.2026"
      description="Bu gizlilik politikası, DROMOCOB DEMO MAĞAZACILIK A.Ş. tarafından sunulan Dromocob web sitesi, mobil uygulaması ve ilişkili hizmetler kapsamında işlenen kişisel verilere ilişkin temel bilgilendirmeyi içerir."
      sections={[
        {
          title: "Toplanan Veriler",
          body: "Ad, soyad, e-posta adresi, telefon, teslimat adresi, sipariş bilgileri, kullanıcı tercihleri, favori ürün kayıtları ve destek talepleri gibi hizmetin sunulması için gerekli olan veriler işlenebilir.",
        },
        {
          title: "Veri İşleme Amaçları",
          body: "Kişisel veriler; sipariş süreçlerinin yürütülmesi, kullanıcı hesabının yönetilmesi, müşteri desteği sağlanması, stok bildirim taleplerinin işlenmesi, güvenlik doğrulamaları yapılması ve kullanıcı deneyiminin geliştirilmesi amacıyla kullanılabilir.",
        },
        {
          title: "Çerezler ve İzleme Teknolojileri",
          body: "Web sitemizde oturum yönetimi, kullanıcı tercihlerinin hatırlanması, performans analizi ve reklam ölçümleme amacıyla çerezler ve benzeri izleme teknolojileri kullanılmaktadır. Zorunlu çerezler sitenin temel işlevleri için gereklidir. Analitik çerezler ziyaretçi davranışlarını anonim olarak analiz eder. Pazarlama çerezleri reklam kampanyalarının etkinliğini ölçer. Detaylı bilgi için Çerez Politikası sayfamızı inceleyebilirsiniz.",
        },
        {
          title: "Analitik ve Reklam Ölçümleme Araçları",
          body: "Sitemizde Google Tag Manager (GTM), Google Analytics 4 (GA4), Google Ads dönüşüm izleme ve Meta (Facebook) Pixel gibi üçüncü taraf analitik ve reklam ölçümleme araçları kullanılmaktadır. Bu araçlar; sayfa görüntüleme, ürün inceleme, sepete ekleme ve satın alma gibi etkileşimleri anonim veya takma adlı şekilde izleyerek reklam performansının ölçülmesini sağlar.",
        },
        {
          title: "Gelişmiş Dönüşüm Eşleştirme",
          body: "Google Ads gelişmiş dönüşümler kapsamında, sipariş sırasında verilen e-posta adresi, telefon numarası ve ad-soyad gibi müşteri verileri, hash (şifrelenmiş/özetlenmiş) hâlde Google sunucularına iletilerek reklam dönüşüm eşleştirmesi yapılabilir. Bu veriler doğrudan kimlik tanımlama amacıyla kullanılmaz; yalnızca reklam kampanyalarının etkinliğini ölçmek ve analiz etmek amacıyla işlenir.",
        },
        {
          title: "Veri Güvenliği",
          body: "İşlenen kişisel veriler, yetkisiz erişim, veri kaybı, kötüye kullanım ve hukuka aykırı işleme risklerine karşı uygun teknik ve idari tedbirlerle korunur.",
        },
        {
          title: "Üçüncü Taraf Hizmetler",
          body: "Platform; kimlik doğrulama, bulut altyapısı, medya saklama, ödeme işleme, reklam ölçümleme ve operasyon yönetimi için güvenilir hizmet sağlayıcılarla çalışabilir. Bu hizmetler yalnızca hizmetin ifası için gerekli kapsamda kullanılır. Reklam ölçümleme kapsamında veriler, Google ve Meta gibi yurt dışı merkezli platformlara şifrelenmiş biçimde aktarılabilir.",
        },
        {
          title: "Kullanıcı Hakları",
          body: "Kullanıcılar; verilerine erişme, düzeltme, silme, güncelleme ve işlenmesine dair bilgi talep etme hakkına sahiptir. Talepler için hello@dromocob.com adresi veya destek alanı kullanılabilir.",
        },
      ]}
    />
  );
}