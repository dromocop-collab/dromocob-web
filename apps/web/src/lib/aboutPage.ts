import "server-only";
import { adminDb } from "@/lib/firebase.admin";

export type AboutPageDoc = {
  isActive?: boolean;
  hero?: {
    eyebrow?: string;
    title?: string;
    description?: string;
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };
  story?: {
    title?: string;
    text1?: string;
    text2?: string;
  };
  gallery?: {
    mainImage?: string;
    sideImage1?: string;
    sideImage2?: string;
    mainTitle?: string;
    sideTitle1?: string;
    sideTitle2?: string;
  };
  stats?: Array<{
    value?: string;
    label?: string;
  }>;
  highlights?: Array<{
    icon?: string;
    title?: string;
    text?: string;
  }>;
  beliefs?: {
    eyebrow?: string;
    title?: string;
    description?: string;
    items?: string[];
  };
  cta?: {
    eyebrow?: string;
    title?: string;
    description?: string;
    cards?: Array<{
      title?: string;
      text?: string;
    }>;
  };
};

function s(v: unknown) {
  return String(v ?? "").trim();
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : [];
}

const DEFAULT_STATS = [
  { value: "25+", label: "Yıllık Tecrübe" },
  { value: "10.000+", label: "Mutlu Müşteri" },
  { value: "5.000+", label: "Ürün Çeşidi" },
  { value: "%100", label: "Sertifikalı Ürün" },
];

const DEFAULT_HIGHLIGHTS = [
  {
    icon: "💎",
    title: "Sertifikalı Ürünler",
    text: "Tüm ürünlerimiz uluslararası standartlarda sertifikalıdır. Her parçanın ayar ve kalite belgesi mevcuttur.",
  },
  {
    icon: "🔒",
    title: "Güvenli Alışveriş",
    text: "3D Secure ödeme altyapısı, SSL şifreleme ve sigortalı kargo ile güvenli bir alışveriş deneyimi sunuyoruz.",
  },
  {
    icon: "🏪",
    title: "Fiziksel Mağaza",
    text: "Dromocob'un kalbinde yer alan mağazamızda ürünlerimizi yakından inceleyebilir, uzman danışmanlarımızdan destek alabilirsiniz.",
  },
  {
    icon: "🎁",
    title: "Hediye Danışmanlığı",
    text: "Özel günleriniz için en uygun hediye seçiminde size yardımcı oluyoruz. Ücretsiz hediye paketleme hizmetimiz mevcuttur.",
  },
];

export async function getAboutPage(): Promise<AboutPageDoc> {
  try {
    const snap = await adminDb().doc("site_options/about_page").get();
    const x = (snap.data() || {}) as AboutPageDoc;

    return {
      isActive: x.isActive !== false,
      hero: {
        eyebrow: s(x.hero?.eyebrow) || "Dromocob",
        title: s(x.hero?.title) || "Dromocob'un Güvenilir tasarım mağazası",
        description:
          s(x.hero?.description) ||
          "Yılların deneyimi, köklü gelenekleri ve modern tasarım anlayışıyla Dromocob'un kalbinde yer alan Bizim Dromocob; sertifikalı ürünleri, güvenli alışveriş deneyimi ve müşteri memnuniyeti odaklı hizmet anlayışıyla özel anlarınıza değer katıyor.",
        primaryLabel: s(x.hero?.primaryLabel) || "Koleksiyonu İncele",
        primaryHref: s(x.hero?.primaryHref) || "/shop",
        secondaryLabel: s(x.hero?.secondaryLabel) || "Bizimle İletişime Geç",
        secondaryHref: s(x.hero?.secondaryHref) || "/iletisim",
      },
      story: {
        title: s(x.story?.title) || "Bizim Hikâyemiz",
        text1:
          s(x.story?.text1) ||
          "Bizim Dromocob, Dromocob'un en köklü mağazalarından biri olarak yıllardır hizmet vermektedir. ev, yaşam ve teknoloji işçiliğinde uzmanlaşmış ekibimizle, her parçayı özenle seçiyor ve müşterilerimize en kaliteli ürünleri sunuyoruz.",
        text2:
          s(x.story?.text2) ||
          "Geleneksel ustalığı modern tasarımlarla buluşturan markamız, her bir özel ürünin bir hikâye anlattığına inanır. Düğünlerden doğum günlerine, nişanlardan yıldönümlerine; hayatın en değerli anlarına eşlik ediyoruz.",
      },
      gallery: {
        mainImage: s(x.gallery?.mainImage),
        sideImage1: s(x.gallery?.sideImage1),
        sideImage2: s(x.gallery?.sideImage2),
        mainTitle: s(x.gallery?.mainTitle) || "Mağaza Dış Cephesi",
        sideTitle1: s(x.gallery?.sideTitle1) || "İç Mekân & Vitrin",
        sideTitle2: s(x.gallery?.sideTitle2) || "Marka & Detay Kareleri",
      },
      stats: Array.isArray(x.stats) && x.stats.length ? x.stats : DEFAULT_STATS,
      highlights: Array.isArray(x.highlights) && x.highlights.length ? x.highlights : DEFAULT_HIGHLIGHTS,
      beliefs: {
        eyebrow: s(x.beliefs?.eyebrow) || "Değerlerimiz",
        title: s(x.beliefs?.title) || "Güven, Kalite ve Şeffaflık",
        description:
          s(x.beliefs?.description) ||
          "Müşterilerimizle kurduğumuz güven ilişkisi, işimizin temelini oluşturur. Her ürünümüzün arkasında durur, şeffaf fiyat politikamız ve dürüst iş anlayışımızla sektörde fark yaratırız.",
        items: arr(x.beliefs?.items).length
          ? arr(x.beliefs?.items)
          : [
              "Her ürünümüz uluslararası standartlarda sertifikalıdır",
              "Şeffaf fiyatlandırma ve açık ürün bilgisi sunulur",
              "Ücretsiz iade ve değişim garantisi sunulur",
              "Sigortalı ve özel paketleme ile kargo gönderimi yapılır",
              "7/24 WhatsApp destek hattı ile her an yanınızdayız",
            ],
      },
      cta: {
        eyebrow: s(x.cta?.eyebrow) || "Bize Ulaşın",
        title: s(x.cta?.title) || "Sizin İçin Buradayız",
        description:
          s(x.cta?.description) ||
          "Ürünlerimiz hakkında bilgi almak, özel sipariş vermek veya mağazamızı ziyaret etmek için bizimle iletişime geçin. Uzman kadromuz size yardımcı olmaktan mutluluk duyar.",
        cards: Array.isArray(x.cta?.cards) && x.cta?.cards.length
          ? x.cta?.cards
          : [
              { title: "Telefon", text: "+90 530 478 82 98" },
              { title: "E-posta", text: "info@dromocob.tr" },
              { title: "Adres", text: "İstanbul · Demo Showroom" },
              { title: "Çalışma Saatleri", text: "Her gün 09:00 – 22:00" },
            ],
      },
    };
  } catch (e) {
    console.error("getAboutPage error:", e);
    return {};
  }
}