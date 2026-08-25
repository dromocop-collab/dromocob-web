export type MobileAppShowcase = {
  slug: string;
  name: string;
  eyebrow: string;
  summary: string;
  description: string;
  image: string;
  accent: string;
  features: string[];
  deliverables: string[];
  keywords: string[];
};

export const mobileApps: MobileAppShowcase[] = [
  {
    slug: "e-ticaret-ios-android-uygulamasi",
    name: "Nova Commerce",
    eyebrow: "E-TİCARET · iOS & ANDROID",
    summary: "Ürün keşfinden güvenli ödemeye uzanan, satış ve sadakat odaklı mobil mağaza.",
    description: "Markanıza özel ürün akışı, akıllı arama, favoriler, kampanyalar, sepet, ödeme ve sipariş takibini tek bir hızlı mobil deneyimde birleştiriyoruz.",
    image: "/mobile-apps/e-ticaret-mobil-uygulama-v1.jpg",
    accent: "#ff735e",
    features: ["Akıllı ürün keşfi", "Güvenli ödeme", "Push kampanyaları", "Sadakat sistemi", "Sipariş takibi", "Yönetim paneli"],
    deliverables: ["iOS ve Android uygulaması", "App Store / Google Play yayını", "Ödeme ve kargo entegrasyonu", "Analitik ve dönüşüm olayları"],
    keywords: ["e ticaret mobil uygulama", "alışveriş uygulaması yaptırma", "iOS e ticaret uygulaması", "Android mağaza uygulaması"],
  },
  {
    slug: "arac-kiralama-ios-android-uygulamasi",
    name: "DriveFlow",
    eyebrow: "ARAÇ KİRALAMA · iOS & ANDROID",
    summary: "Filo, müsaitlik, rezervasyon ve dijital anahtar akışlarını cebinize taşıyan uygulama.",
    description: "Lokasyon ve tarih seçimi, araç karşılaştırma, ek hizmetler, güvenli ödeme, rezervasyon durumu ve rota akışını yüksek dönüşümlü bir mobil ürüne dönüştürüyoruz.",
    image: "/mobile-apps/arac-kiralama-mobil-uygulama-v1.jpg",
    accent: "#287cff",
    features: ["Canlı müsaitlik", "Harita ve lokasyon", "Online rezervasyon", "Dijital anahtar", "Filo yönetimi", "Çoklu dil"],
    deliverables: ["iOS ve Android uygulaması", "Rezervasyon API bağlantısı", "Bildirim ve kampanya altyapısı", "Operasyon yönetim paneli"],
    keywords: ["rent a car mobil uygulama", "araç kiralama uygulaması", "filo yönetim uygulaması", "oto kiralama yazılımı"],
  },
  {
    slug: "randevu-hizmet-ios-android-uygulamasi",
    name: "Expertly",
    eyebrow: "RANDEVU & HİZMET · iOS & ANDROID",
    summary: "Uzman, hizmet, takvim ve güvenli mesajlaşmayı birleştiren modern pazar yeri.",
    description: "Uzman profilleri, hizmet paketleri, akıllı takvim, online ödeme, güvenli mesajlaşma ve süreç takibiyle servis işlerini ölçeklenebilir mobil platforma dönüştürüyoruz.",
    image: "/mobile-apps/randevu-hizmet-mobil-uygulama-v1.jpg",
    accent: "#7c62ff",
    features: ["Akıllı randevu", "Uzman profilleri", "Güvenli mesajlaşma", "Online ödeme", "Süreç takibi", "Değerlendirmeler"],
    deliverables: ["iOS ve Android uygulaması", "Müşteri ve uzman rolleri", "Takvim / ödeme entegrasyonu", "İçerik ve operasyon paneli"],
    keywords: ["randevu mobil uygulaması", "hizmet pazaryeri uygulaması", "iOS Android uygulama geliştirme", "mobil uygulama yaptırma"],
  },
];

export function getMobileApp(slug: string) {
  return mobileApps.find((item) => item.slug === slug);
}
