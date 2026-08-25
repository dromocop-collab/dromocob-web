import type { Metadata } from "next";
import LegalPageTemplate from "@/components/legal/LegalPageTemplate";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Dromocob",
  description:
    "KVKK aydınlatma metni. Kişisel verilerin korunmasına ilişkin yasal bilgilendirme.",
  alternates: {
    canonical: "https://dromocob.tr/kvkk-aydinlatma-metni",
  },
};

export default function KvkkPage() {
  return (
    <LegalPageTemplate
      eyebrow="KVKK"
      title="KVKK Aydınlatma Metni"
      updatedAt="19.04.2026"
      description="Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, DROMOCOB DEMO MAĞAZACILIK A.Ş. tarafından veri sorumlusu sıfatıyla hazırlanmıştır."
      sections={[
        {
          title: "Veri Sorumlusu",
          body: "Kişisel verileriniz, İstanbul · Demo Showroom adresinde faaliyet gösteren DROMOCOB DEMO MAĞAZACILIK A.Ş. tarafından işlenmektedir.",
        },
        {
          title: "İşlenen Veriler",
          body: "Kimlik bilgileri, iletişim bilgileri, adres bilgileri, sipariş bilgileri, işlem güvenliği verileri ve destek talepleri gibi hizmetin niteliğine göre gerekli olan veriler işlenebilir.",
        },
        {
          title: "İşleme Amaçları",
          body: "Verileriniz; ürün ve hizmet sunumu, sipariş yönetimi, teslimat süreçleri, müşteri desteği, yasal yükümlülüklerin yerine getirilmesi ve kullanıcı deneyiminin geliştirilmesi amaçlarıyla işlenebilir.",
        },
        {
          title: "Reklam Ölçümleme ve Dönüşüm Eşleştirme",
          body: "Platformumuzda Google Analytics 4 (GA4), Google Tag Manager (GTM), Google Ads dönüşüm izleme ve Meta (Facebook) Pixel gibi üçüncü taraf analitik ve reklam ölçümleme araçları kullanılmaktadır. Bu araçlar; sayfa görüntüleme, ürün inceleme, sepete ekleme ve satın alma gibi kullanıcı etkileşimlerini anonim veya takma adlı biçimde izleyerek reklam performansının ölçülmesini sağlar. Google Ads gelişmiş dönüşümler kapsamında, sipariş sırasında verilen e-posta adresi, telefon numarası ve ad-soyad gibi müşteri verileri, hash (şifrelenmiş/özetlenmiş) hâlde reklam platformlarına iletilerek dönüşüm eşleştirmesi yapılabilir. Bu veriler doğrudan kimlik tanımlama amacıyla değil, yalnızca reklam kampanyalarının etkinliğini ölçmek amacıyla işlenir. İlgili veri işleme faaliyeti, KVKK m. 5/2-f kapsamında meşru menfaat hukuki sebebine dayanmaktadır.",
        },
        {
          title: "Çerezler ve İzleme Teknolojileri",
          body: "Web sitemizde oturum yönetimi, kullanıcı tercihlerinin hatırlanması, performans analizi ve reklam ölçümleme amacıyla çerezler ve benzeri izleme teknolojileri kullanılmaktadır. Çerezlerin türleri, amaçları ve tercih yönetimine ilişkin detaylı bilgi için Çerez Politikası sayfamızı inceleyebilirsiniz.",
        },
        {
          title: "Aktarım",
          body: "Kişisel verileriniz, yalnızca hizmetin yürütülmesi ve mevzuattan doğan yükümlülüklerin yerine getirilmesi kapsamında ilgili hizmet sağlayıcılar ve yetkili kurumlarla sınırlı olarak paylaşılabilir. Reklam ölçümleme kapsamında veriler, Google ve Meta gibi yurt dışı merkezli platformlara şifrelenmiş (hash) biçimde aktarılabilir.",
        },
        {
          title: "Haklarınız",
          body: "KVKK'nın 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini isteme, silme talebinde bulunma ve bilgi talep etme hakkına sahipsiniz. Taleplerinizi info@dromocob.tr adresine iletebilirsiniz.",
        },
      ]}
    />
  );
}