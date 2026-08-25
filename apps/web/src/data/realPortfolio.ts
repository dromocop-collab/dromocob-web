export type RealProject = {
  slug: string;
  name: string;
  kind: "Web" | "Mobil" | "SaaS";
  sector: string;
  summary: string;
  image: string;
  features: string[];
  caseUrl?: string;
  liveUrl?: string;
  accent: string;
};

export const realPortfolio: RealProject[] = [
  { slug:"senin-randevun", name:"SeninRandevun", kind:"SaaS", sector:"Randevu & İşletme", summary:"Keşif, rezervasyon, ekip, hizmet ve çoklu mağaza operasyonunu web ile iOS'ta birleştiren canlı SaaS platformu.", image:"/portfolio/dromocob/senin-randevun.svg", features:["Web + iOS","Çoklu mağaza","Canlı takvim","İşletme paneli"], caseUrl:"https://dromocob.tr/projeler/senin-randevun", liveUrl:"https://seninrandevun.com", accent:"#5b7cff" },
  { slug:"6nci-kuyumculuk", name:"6'ncı Kuyumculuk", kind:"Web", sector:"Premium E-Ticaret", summary:"Altın ve mücevher alışverişini güven, zarafet ve kişisel danışmanlık ekseninde kurgulayan e-ticaret deneyimi.", image:"/portfolio/dromocob/6nci-kuyumculuk.jpg", features:["Canlı altın kuru","Güvenli ödeme","Admin paneli","SEO"], caseUrl:"https://dromocob.tr/projeler/6nci-kuyumculuk-e-ticaret", accent:"#d8ad55" },
  { slug:"kilic-spot", name:"Kılıç Spot", kind:"Web", sector:"Yerel Ticaret", summary:"İkinci el eşya alım-satımını arama, WhatsApp ve yerel güven sinyalleriyle hızlı talebe dönüştüren platform.", image:"/portfolio/dromocob/kilic-spot.jpg", features:["Yerel SEO","WhatsApp akışı","Hızlı teklif","Mobil öncelikli"], caseUrl:"https://dromocob.tr/projeler/kilic-spot-dijital-donusum", accent:"#ff774f" },
  { slug:"mase-group", name:"Mase Group", kind:"Web", sector:"Kurumsal Platform", summary:"Dekoratif boya, gayrimenkul, medya ve turizm yetkinliklerini güçlü bir katalog mimarisinde buluşturan kurumsal sistem.", image:"/portfolio/dromocob/mase-group.jpg", features:["Ürün kataloğu","Çoklu iş kolu","Kurumsal SEO","İçerik paneli"], caseUrl:"https://dromocob.tr/projeler/mase-group-kurumsal-platform", accent:"#42c9a5" },
  { slug:"ugurbey-spot", name:"Uğurbey Spot", kind:"Web", sector:"Döngüsel Ticaret", summary:"Mobilya, beyaz eşya ve elektroniğin ikinci yaşamını güvenilir ve mobil öncelikli müşteri deneyimine dönüştüren web platformu.", image:"/portfolio/dromocob/ugurbey-spot.jpg", features:["Akıllı kategori","Teklif toplama","Yerel görünürlük","Mobil UX"], caseUrl:"https://dromocob.tr/projeler/ugurbey-spot-web-platformu", accent:"#b68cff" },
  { slug:"akc-oto-kilif", name:"AKC Oto Kılıf", kind:"Web", sector:"Otomotiv Ticaret", summary:"Araç içi işçilik, malzeme kalitesi ve model uyumluluğunu güçlü ürün keşfiyle birleştiren otomotiv vitrini.", image:"/portfolio/dromocob/akc-oto-kilif.jpg", features:["Model uyumluluğu","Dijital katalog","Talep formu","Performans SEO"], caseUrl:"https://dromocob.tr/projeler/akc-oto-kilif-dijital-katalog", accent:"#35b8ff" },
  { slug:"kalori-merkezi", name:"Kalori Merkezi", kind:"Mobil", sector:"Sağlık & Yaşam", summary:"Öğün takibi, günlük özet ve görsel tabanlı akıllı taramayı sade bir iOS deneyiminde birleştiren mobil ürün.", image:"/portfolio/dromocob/kalori-merkezi.jpg", features:["iOS","Öğün takibi","Akıllı tarama","Kişisel rutin"], liveUrl:"https://apps.apple.com/tr/app/kalori-merkezi/id6799123172", accent:"#6ce18b" },
  { slug:"bizim-6nci", name:"Bizim 6'ncı Kuyumculuk", kind:"Mobil", sector:"Mobil E-Ticaret", summary:"Takı koleksiyonlarını keşif, güvenli sipariş, favoriler ve stok bildirimleriyle mobilde buluşturan alışveriş uygulaması.", image:"/portfolio/dromocob/bizim-6nci-app.jpg", features:["iOS","Mobil ödeme","Favoriler","Stok bildirimi"], liveUrl:"https://apps.apple.com/tr/app/bizim-6nc%C4%B1-kuyumculuk/id6760553574?l=tr", accent:"#ffbd3f" },
  { slug:"the-jacks-coffee", name:"The Jacks Coffee", kind:"Mobil", sector:"Food & Beverage", summary:"Menü keşfi, hızlı sipariş, QR damga, kampanya ve sadakati tek mobil uygulamada birleştiren kahve platformu.", image:"/portfolio/dromocob/the-jacks-coffee-app.jpg", features:["iOS","QR sadakat","Hızlı sipariş","Kampanya"], liveUrl:"https://apps.apple.com/us/app/the-jacks-coffee/id6757435094", accent:"#e97d52" },
];
