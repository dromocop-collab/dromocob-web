export type Sector = {
  slug: string;
  name: string;
  shortName: string;
  eyebrow: string;
  summary: string;
  title: string;
  description: string;
  image: string;
  accent: string;
  features: string[];
  benefits: { title: string; text: string }[];
  keywords: string[];
  faqs: { question: string; answer: string }[];
};

export type StudioTemplate = {
  id: number;
  name: string;
  slug: string;
  sector: string;
  category: string;
  style: string;
  price: number;
  accent: string;
  image: string;
  features: string[];
};

export const sectors: Sector[] = [
  {
    slug: "rent-a-car-web-sitesi",
    name: "Rent a Car Web Sitesi",
    shortName: "Araç Kiralama",
    eyebrow: "Rezervasyon · Filo · Lokasyon",
    summary: "Araç filosunu güçlü görsellerle sunan, hızlı rezervasyon toplayan satış odaklı deneyim.",
    title: "Rent a car işletmeniz için rezervasyon getiren web sitesi",
    description: "Araç müsaitliği, lokasyon seçimi, fiyatlandırma, ek hizmetler ve güvenli rezervasyon akışını tek bir hızlı yönetim panelinde birleştirin.",
    image: "/portfolio/rent-a-car-web-tasarim-v1.jpg",
    accent: "#4f7cff",
    features: ["Online rezervasyon", "Filo yönetimi", "Çoklu lokasyon", "Çoklu dil", "Online ödeme", "WhatsApp teklifi"],
    benefits: [
      { title: "Daha fazla doğrudan rezervasyon", text: "Komisyonlu platformlara bağımlılığı azaltan, mobil öncelikli dönüşüm akışı." },
      { title: "Anlık filo kontrolü", text: "Araç, fiyat, kampanya ve müsaitlik bilgilerini yönetim panelinden güncelleyin." },
      { title: "Yerel aramada görünürlük", text: "Şehir ve havalimanı odaklı SEO sayfalarıyla doğru müşteriye ulaşın." },
    ],
    keywords: ["rent a car web sitesi", "araç kiralama web tasarım", "oto kiralama sitesi", "rent a car rezervasyon sistemi", "filo yönetim yazılımı"],
    faqs: [
      { question: "Rent a car web sitesinde online rezervasyon olur mu?", answer: "Evet. Tarih, lokasyon, araç sınıfı, ek hizmet ve ödeme adımlarını işletmenize göre kurguluyoruz." },
      { question: "Araçları kendim güncelleyebilir miyim?", answer: "Yönetim panelinden araç, görsel, fiyat, müsaitlik ve kampanyaları kolayca yönetebilirsiniz." },
      { question: "Google'da şehir bazlı çıkabilir miyim?", answer: "Teknik SEO altyapısı ile şehir, ilçe ve havalimanı odaklı landing page yapısı kurulabilir." },
    ],
  },
  {
    slug: "e-ticaret-web-sitesi",
    name: "E-Ticaret Web Sitesi",
    shortName: "E-Ticaret",
    eyebrow: "Ürün · Ödeme · Kampanya",
    summary: "Markanızı öne çıkaran, ürünü keşiften ödemeye kadar akıcı biçimde taşıyan mağaza.",
    title: "Markanıza özel hızlı ve güçlü e-ticaret web sitesi",
    description: "Ürün, stok, kampanya, ödeme ve sipariş yönetimini; markanızın karakterini yansıtan yüksek dönüşümlü bir alışveriş deneyimiyle birleştirin.",
    image: "/portfolio/e-ticaret-web-tasarim-v1.jpg",
    accent: "#ff7657",
    features: ["Ürün yönetimi", "Online ödeme", "Kampanya motoru", "Stok takibi", "Sepet kurtarma", "Pazaryeri entegrasyonu"],
    benefits: [
      { title: "Daha yüksek dönüşüm", text: "Hızlı açılan ürün sayfaları ve sade ödeme akışıyla satış kaybını azaltın." },
      { title: "Tek panelden yönetim", text: "Ürün, stok, sipariş, kupon ve içerikleri merkezden kontrol edin." },
      { title: "Organik büyüme", text: "Kategori ve ürün şemalarıyla arama motorlarının anlayabildiği güçlü altyapı." },
    ],
    keywords: ["e ticaret web sitesi", "e ticaret sitesi yaptırma", "online mağaza tasarımı", "e ticaret yazılımı", "profesyonel e mağaza"],
    faqs: [
      { question: "E-ticaret sitesine sanal POS bağlanır mı?", answer: "Evet. İhtiyaca göre ödeme sağlayıcıları ve güvenli ödeme akışları entegre edilir." },
      { question: "Ürün ve stokları kendim yönetebilir miyim?", answer: "Yönetim paneli üzerinden ürün, varyant, stok, fiyat ve kampanyaları güncelleyebilirsiniz." },
      { question: "Mevcut mağazam taşınabilir mi?", answer: "Ürün ve müşteri verileriniz uygun formatta yeni sisteme planlı şekilde aktarılabilir." },
    ],
  },
  {
    slug: "emlak-web-sitesi",
    name: "Emlak Web Sitesi",
    shortName: "Gayrimenkul",
    eyebrow: "İlan · Harita · Danışman",
    summary: "Portföyleri profesyonel sunan, nitelikli alıcı ve yatırımcı talepleri toplayan yapı.",
    title: "Emlak ofisleri için ilan ve danışman odaklı web sitesi",
    description: "İlan filtreleme, harita, danışman profilleri, proje sayfaları ve hızlı iletişim akışlarıyla portföyünüzü güven veren bir dijital deneyime dönüştürün.",
    image: "/portfolio/emlak-web-tasarim-v1.jpg",
    accent: "#8b5cf6",
    features: ["Akıllı ilan filtresi", "Harita görünümü", "Danışman profilleri", "Proje sayfaları", "Lead yönetimi", "Çoklu dil"],
    benefits: [
      { title: "Nitelikli müşteri talebi", text: "İlan ve danışman bazlı formlarla ziyaretçiyi doğru ekibe yönlendirin." },
      { title: "Güçlü portföy sunumu", text: "Fotoğraf, video, konum ve özelliklerle gayrimenkulleri etkileyici biçimde anlatın." },
      { title: "Bölgesel SEO", text: "Semt, ilçe ve proje odaklı sayfalarla yerel aramalarda büyüyün." },
    ],
    keywords: ["emlak web sitesi", "gayrimenkul web tasarım", "emlak ilan sitesi", "emlakçı sitesi", "gayrimenkul danışmanlığı web sitesi"],
    faqs: [
      { question: "İlanlar haritada gösterilebilir mi?", answer: "Evet. İlan konumları filtrelenebilir harita üzerinde sunulabilir." },
      { question: "Danışmanlara ayrı profil açılır mı?", answer: "Her danışman için uzmanlık, portföy ve iletişim bilgilerinin yer aldığı ayrı SEO sayfaları oluşturulabilir." },
      { question: "İlanları panelden ekleyebilir miyim?", answer: "Yönetim panelinden ilan, görsel, konum, fiyat ve durum bilgileri yönetilir." },
    ],
  },
  {
    slug: "restoran-web-sitesi",
    name: "Restoran Web Sitesi",
    shortName: "Restoran",
    eyebrow: "Menü · Rezervasyon · Atmosfer",
    summary: "Mekânın atmosferini dijitale taşıyan, masa rezervasyonu ve menü keşfini hızlandıran site.",
    title: "Restoranınızın atmosferini yansıtan modern web sitesi",
    description: "Dijital menü, masa rezervasyonu, şube bilgileri, etkinlikler ve güçlü görsel hikâye anlatımıyla misafir deneyimini ziyaret öncesinde başlatın.",
    image: "/portfolio/restoran-web-tasarim-v1.jpg",
    accent: "#e65252",
    features: ["Dijital menü", "Masa rezervasyonu", "Şube yönetimi", "Etkinlik takvimi", "Galeri", "Yorum entegrasyonu"],
    benefits: [
      { title: "Daha fazla rezervasyon", text: "Tarih, saat ve kişi sayısını alan hızlı masa rezervasyonu akışı." },
      { title: "Güncel dijital menü", text: "Ürün, fiyat, içerik ve alerjen bilgilerini panelden kolayca yönetin." },
      { title: "Yerel keşfedilebilirlik", text: "Restoran ve mutfak türü odaklı içeriklerle yakın aramalarda görünür olun." },
    ],
    keywords: ["restoran web sitesi", "restaurant web tasarım", "dijital menü sitesi", "online masa rezervasyon sistemi", "kafe web sitesi"],
    faqs: [
      { question: "Online masa rezervasyonu alınabilir mi?", answer: "Evet. Tarih, saat, kişi sayısı ve özel not alanlarıyla rezervasyon talebi alınabilir." },
      { question: "Menü fiyatlarını kendim değiştirebilir miyim?", answer: "Dijital menü içerikleri ve fiyatları yönetim panelinden güncellenebilir." },
      { question: "Birden fazla şube eklenebilir mi?", answer: "Her şube için ayrı konum, çalışma saati, menü ve iletişim bilgileri tanımlanabilir." },
    ],
  },
  {
    slug: "otel-web-sitesi",
    name: "Otel Web Sitesi",
    shortName: "Otel & Turizm",
    eyebrow: "Oda · Takvim · Rezervasyon",
    summary: "Tesisi hissettiren güçlü görseller ve doğrudan rezervasyon odaklı akıcı konaklama deneyimi.",
    title: "Oteller için doğrudan rezervasyon odaklı web sitesi",
    description: "Oda tipleri, müsaitlik, dönemsel fiyatlar, deneyimler ve çoklu dil altyapısıyla misafirinizi aracı platformlardan kendi markanıza taşıyın.",
    image: "/portfolio/otel-web-tasarim-v1.jpg",
    accent: "#09a6c7",
    features: ["Oda ve paketler", "Rezervasyon takvimi", "Çoklu dil", "Online ödeme", "Deneyim sayfaları", "Transfer talebi"],
    benefits: [
      { title: "Doğrudan rezervasyon", text: "Komisyon maliyetlerini azaltan güvenli ve hızlı rezervasyon deneyimi." },
      { title: "Sezon yönetimi", text: "Oda, fiyat, paket ve dönemsel kampanyaları tek panelden yönetin." },
      { title: "Uluslararası SEO", text: "Çoklu dil ve destinasyon sayfalarıyla farklı pazarlara ulaşın." },
    ],
    keywords: ["otel web sitesi", "otel rezervasyon sitesi", "turizm web tasarım", "butik otel web sitesi", "otel rezervasyon sistemi"],
    faqs: [
      { question: "Otel sitesinden doğrudan rezervasyon alınır mı?", answer: "Evet. Tarih, oda, kişi ve ek hizmet seçimlerini içeren rezervasyon akışı kurulabilir." },
      { question: "Çoklu dil desteği olur mu?", answer: "Hedef pazarlarınıza göre çoklu dil ve para birimi altyapısı planlanabilir." },
      { question: "Rezervasyon motoru entegre edilir mi?", answer: "Mevcut kanal veya rezervasyon sisteminiz uygun API ile entegre edilebilir." },
    ],
  },
  {
    slug: "klinik-web-sitesi",
    name: "Klinik Web Sitesi",
    shortName: "Sağlık & Klinik",
    eyebrow: "Uzman · Hizmet · Randevu",
    summary: "Uzmanlığı güvenle anlatan, KVKK uyumlu ve randevu dönüşümüne odaklanan sağlık deneyimi.",
    title: "Klinik ve sağlık merkezleri için güven veren web sitesi",
    description: "Uzman profilleri, tedavi ve hizmet sayfaları, online randevu, çoklu dil ve KVKK odaklı iletişim akışlarıyla dijital güven oluşturun.",
    image: "/portfolio/saglik-web-tasarim-v1.jpg",
    accent: "#10a779",
    features: ["Online randevu", "Uzman profilleri", "Hizmet sayfaları", "KVKK akışları", "Çoklu dil", "Soru talebi"],
    benefits: [
      { title: "Güven veren anlatım", text: "Uzmanlık, süreç ve hizmetleri sade, doğru ve profesyonel biçimde sunun." },
      { title: "Kolay randevu", text: "Mobil uyumlu kısa form ve takvim akışıyla daha fazla başvuru alın." },
      { title: "Hizmet bazlı SEO", text: "Her uzmanlık ve hizmet için arama niyetine uygun içerik yapısı." },
    ],
    keywords: ["klinik web sitesi", "doktor web sitesi", "sağlık web tasarım", "online randevu web sitesi", "estetik klinik web sitesi"],
    faqs: [
      { question: "Klinik sitesinde online randevu olur mu?", answer: "Evet. Uzman, hizmet, tarih ve iletişim bilgilerini içeren randevu akışı kurulabilir." },
      { question: "KVKK için gerekli alanlar eklenir mi?", answer: "Form onayları, aydınlatma metinleri ve veri minimizasyonu ihtiyaca göre uygulanır." },
      { question: "Doktorlar için ayrı sayfa açılır mı?", answer: "Her uzman için özgeçmiş, uzmanlık, hizmet ve içeriklerin yer aldığı ayrı sayfalar oluşturulabilir." },
    ],
  },
  {
    slug: "kurumsal-web-sitesi",
    name: "Kurumsal Web Sitesi",
    shortName: "Kurumsal",
    eyebrow: "Marka · Hizmet · Teklif",
    summary: "Şirketin yetkinliğini net anlatan, güven oluşturan ve nitelikli teklif talebi üreten site.",
    title: "Şirketinizi güçlü gösteren kurumsal web sitesi",
    description: "Marka stratejisi, hizmet mimarisi, vaka çalışmaları ve teklif akışını birleştiren modern kurumsal web deneyimiyle güveni büyütün.",
    image: "/portfolio/kurumsal-web-tasarim-v1.jpg",
    accent: "#64748b",
    features: ["Hizmet sayfaları", "Vaka çalışmaları", "Teklif formu", "Çoklu dil", "Blog altyapısı", "CRM bağlantısı"],
    benefits: [
      { title: "Güçlü ilk izlenim", text: "Markanızın ölçeğini ve uzmanlığını saniyeler içinde anlaşılır kılın." },
      { title: "Nitelikli teklif talepleri", text: "Hizmet bazlı akışlarla doğru müşteri bilgisini satış ekibine aktarın." },
      { title: "Sürdürülebilir içerik", text: "Blog, hizmet ve vaka çalışmalarını yönetim panelinden yayınlayın." },
    ],
    keywords: ["kurumsal web sitesi", "kurumsal web tasarım", "şirket web sitesi", "profesyonel web sitesi", "web tasarım ajansı"],
    faqs: [
      { question: "Kurumsal web sitesi ne kadar sürede hazırlanır?", answer: "Kapsama göre değişmekle birlikte strateji, tasarım ve geliştirme aşamaları çoğunlukla birkaç hafta içinde tamamlanır." },
      { question: "İçerikleri kendimiz güncelleyebilir miyiz?", answer: "Yönetim paneli sayesinde hizmet, ekip, proje, blog ve sayfa içerikleri güncellenebilir." },
      { question: "Mevcut kurumsal kimliğe uyum sağlanır mı?", answer: "Logo, renk, tipografi ve marka diliniz tasarım sistemine uyarlanır; gerekirse yenilenir." },
    ],
  },
];

export const studioTemplates: StudioTemplate[] = [
  { id: 1, name: "Boğaz Premium Araç Kiralama", slug: "bogaz-premium-arac-kiralama", sector: "rent-a-car-web-sitesi", category: "Rent a Car", style: "Lüks", price: 34900, accent: "#4f7cff", image: "/portfolio/rent-a-car-web-tasarim-v1.jpg", features: ["Online rezervasyon", "Filo", "Çoklu dil"] },
  { id: 2, name: "İstanbul Moda E-Mağaza", slug: "istanbul-moda-e-magaza", sector: "e-ticaret-web-sitesi", category: "E-Ticaret", style: "Editoryal", price: 42900, accent: "#ff7657", image: "/portfolio/e-ticaret-web-tasarim-v1.jpg", features: ["Ödeme", "Kampanya", "Ürün yönetimi"] },
  { id: 3, name: "Marmara Seçkin Gayrimenkul", slug: "marmara-seckin-gayrimenkul", sector: "emlak-web-sitesi", category: "Gayrimenkul", style: "Kurumsal", price: 38900, accent: "#8b5cf6", image: "/portfolio/emlak-web-tasarim-v1.jpg", features: ["Akıllı filtre", "Harita", "Danışman"] },
  { id: 4, name: "Sofra İstanbul Restoran", slug: "sofra-istanbul-restoran", sector: "restoran-web-sitesi", category: "Restoran", style: "Lüks", price: 29900, accent: "#e65252", image: "/portfolio/restoran-web-tasarim-v1.jpg", features: ["Dijital menü", "Masa ayırt", "Galeri"] },
  { id: 5, name: "Ege Butik Otel", slug: "ege-butik-otel", sector: "otel-web-sitesi", category: "Otel & Turizm", style: "Modern", price: 44900, accent: "#09a6c7", image: "/portfolio/otel-web-tasarim-v1.jpg", features: ["Oda seçimi", "Takvim", "Rezervasyon"] },
  { id: 6, name: "İyi Yaşam Kliniği", slug: "iyi-yasam-klinigi", sector: "klinik-web-sitesi", category: "Sağlık & Klinik", style: "Minimal", price: 32900, accent: "#10a779", image: "/portfolio/saglik-web-tasarim-v1.jpg", features: ["Randevu", "Uzmanlar", "KVKK"] },
  { id: 7, name: "Vizyon Kurumsal", slug: "vizyon-kurumsal", sector: "kurumsal-web-sitesi", category: "Kurumsal", style: "Modern", price: 26900, accent: "#64748b", image: "/portfolio/kurumsal-web-tasarim-v1.jpg", features: ["Hizmetler", "Projeler", "Teklif formu"] },
  { id: 8, name: "Anadolu E-Ticaret", slug: "anadolu-e-ticaret", sector: "e-ticaret-web-sitesi", category: "E-Ticaret", style: "Modern", price: 46900, accent: "#ec4899", image: "/portfolio/e-ticaret-web-tasarim-v1.jpg", features: ["Pazaryeri", "Stok", "Raporlama"] },
  { id: 9, name: "Yeni Nesil Elektrikli Araç", slug: "yeni-nesil-elektrikli-arac", sector: "rent-a-car-web-sitesi", category: "Rent a Car", style: "Fütüristik", price: 36900, accent: "#22c55e", image: "/portfolio/rent-a-car-web-tasarim-v1.jpg", features: ["Hızlı rezervasyon", "Lokasyon", "Transfer"] },
];

export function getSector(slug: string) {
  return sectors.find((sector) => sector.slug === slug);
}
