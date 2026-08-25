"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useT } from "@/lib/useT";
import s from "./SssPage.module.css";

type FaqItem = { q: string; a: string };
type FaqSection = { key: string; icon: string; items: FaqItem[] };

const FAQ_TR: FaqSection[] = [
  {
    key: "sss_sec_order",
    icon: "💳",
    items: [
      {
        q: "Hangi ödeme yöntemleriyle alışveriş yapabilirim?",
        a: "Kredi kartı / banka kartı (Visa, Mastercard, Troy) ile güvenli 3D Secure ödeme ve havale/EFT seçeneklerini sunuyoruz. PayTR güvencesiyle tüm ödemeler güvenle işlenir.",
      },
      {
        q: "Taksit seçeneği var mı?",
        a: "Evet, kredi kartıyla ödeme sırasında PayTR ödeme ekranında bankanızın sunduğu taksit seçenekleri otomatik olarak görüntülenir. Taksit sayısı bankanıza göre değişiklik gösterebilir.",
      },
      {
        q: "Havale/EFT ile sipariş verdiğimde ne yapmalıyım?",
        a: "Sipariş oluşturduktan sonra size verilen IBAN numarasına ödemeyi yapmanız yeterli. Açıklama kısmına sipariş numaranızı yazmayı unutmayın. Ödemeniz onaylandığında siparişiniz hazırlanmaya başlar.",
      },
      {
        q: "Sipariş verdikten sonra siparişimi takip edebilir miyim?",
        a: "Evet, Hesabım sayfasından 'Siparişlerim' sekmesinde tüm siparişlerinizi ve güncel durumlarını takip edebilirsiniz. Kargo aşamasına geçtiğinde takip numarası da burada görünür.",
      },
      {
        q: "Siparişimi iptal edebilir miyim?",
        a: "Siparişiniz kargoya verilmeden önce iptal talebinde bulunabilirsiniz. Hesabım sayfasından veya WhatsApp üzerinden bizimle iletişime geçebilirsiniz.",
      },
    ],
  },
  {
    key: "sss_sec_shipping",
    icon: "📦",
    items: [
      {
        q: "Kargo ücreti ne kadar?",
        a: "Kargo ücretleri sipariş tutarına göre değişmektedir. Belirli bir tutarın üzerindeki siparişlerde ücretsiz kargo sunmaktayız. Güncel kargo ücreti checkout sırasında gösterilir.",
      },
      {
        q: "Siparişim ne zaman kargoya verilir?",
        a: "Ödemeniz onaylandıktan sonra siparişiniz genellikle 1-3 iş günü içinde kargoya teslim edilir. Kişiselleştirilmiş ürünlerde bu süre uzayabilir.",
      },
      {
        q: "Kargo takibi nasıl yapılır?",
        a: "Siparişiniz kargoya verildikten sonra Hesabım → Kargo Takip sekmesinden MNG Kargo takip numaranızla gönderinizi anlık olarak izleyebilirsiniz.",
      },
      {
        q: "Hangi kargo firmasıyla gönderim yapıyorsunuz?",
        a: "Şu anda MNG Kargo ile anlaşmalı olarak çalışmaktayız. Sigortalı ve güvenli teslimat garanti edilmektedir.",
      },
      {
        q: "Yurt dışına gönderim yapıyor musunuz?",
        a: "Şu an için yurt içi teslimat hizmeti sunmaktayız. Yurt dışı gönderim planlarımız hakkında bilgi almak için bizimle iletişime geçebilirsiniz.",
      },
    ],
  },
  {
    key: "sss_sec_returns",
    icon: "↺",
    items: [
      {
        q: "İade süreci nasıl işliyor?",
        a: "Ürünü teslim aldıktan sonra 14 gün içinde iade talebinde bulunabilirsiniz. Hesabım → İade Talepleri sekmesinden iade talebinizi oluşturabilirsiniz. Talebiniz onaylandıktan sonra kargo koduyla ürünü bize göndermeniz yeterli.",
      },
      {
        q: "Para iadesi ne zaman yapılır?",
        a: "Ürün tarafımıza ulaştıktan ve kontrol edildikten sonra para iadesi işleminiz başlatılır. Kredi kartına iade 2-10 iş günü, banka hesabına iade 1-3 iş günü sürebilir.",
      },
      {
        q: "Hangi ürünler iade edilebilir?",
        a: "Kullanılmamış, orijinal ambalajında ve etiketleri sökülmemiş ürünler iade edilebilir. Kişiselleştirilmiş ürünler (isim yazılı, özel ölçü vb.) iade kapsamı dışındadır.",
      },
      {
        q: "Ürün değişimi yapılıyor mu?",
        a: "Ürün beden/ölçü değişimi için iade talebi oluşturduktan sonra yeni siparişinizi verebilirsiniz. Mevcut ürünün iadesi tamamlandıktan sonra yeni ürün gönderilir.",
      },
    ],
  },
  {
    key: "sss_sec_product",
    icon: "✨",
    items: [
      {
        q: "Ürünleriniz sertifikalı mı?",
        a: "Sertifika veya garanti belgesi bulunan ürünlerde ilgili dokümanlar ürünle birlikte gönderilir. Ayrıntılar ürün sayfasında açıkça belirtilir.",
      },
      {
        q: "Ürün özelliklerini nerede görebilirim?",
        a: "Malzeme, ölçü, renk, bakım ve diğer teknik özellikler ürün detay sayfasında açıkça belirtilir.",
      },
      {
        q: "Ürün fotoğrafları gerçeği yansıtıyor mu?",
        a: "Tüm ürün fotoğrafları profesyonel stüdyo ortamında çekilmektedir. Renk ve parlaklık monitörünüze bağlı olarak hafif farklılık gösterebilir, ancak ürünler fotoğraflara sadık şekilde üretilmektedir.",
      },
      {
        q: "Doğru ölçüyü nasıl seçebilirim?",
        a: "Ölçü Rehberi sayfamızdaki adımları izleyebilir, emin olamadığınız durumda destek ekibimizden yardım alabilirsiniz.",
      },
      {
        q: "Fiyatlar neden değişiyor?",
        a: "Kampanya, stok, tedarik ve piyasa koşullarına göre fiyatlar güncellenebilir. Sepet ve ödeme adımında gösterilen güncel fiyat geçerlidir.",
      },
    ],
  },
  {
    key: "sss_sec_account",
    icon: "🔒",
    items: [
      {
        q: "Hesap oluşturmak zorunlu mu?",
        a: "Sipariş verebilmek için üye olmanız gerekmektedir. Üyelik sayesinde siparişlerinizi takip edebilir, iade talebi oluşturabilir ve özel kampanyalardan yararlanabilirsiniz.",
      },
      {
        q: "Şifremi unuttum, ne yapmalıyım?",
        a: "Giriş sayfasındaki 'Şifremi Unuttum' butonuna tıklayarak kayıtlı e-posta adresinize şifre sıfırlama bağlantısı gönderebilirsiniz.",
      },
      {
        q: "Kişisel bilgilerim güvende mi?",
        a: "Tüm kişisel bilgileriniz KVKK kapsamında korunmaktadır. SSL sertifikası ve güvenli altyapımız sayesinde verileriniz şifreli olarak iletilir ve saklanır.",
      },
      {
        q: "E-posta doğrulaması neden gerekli?",
        a: "Hesap güvenliğiniz için e-posta doğrulaması yapmanız gerekmektedir. Doğrulama yapılmadan profil güncelleme ve sipariş verme işlemleri kısıtlıdır.",
      },
    ],
  },
];

const FAQ_EN: FaqSection[] = [
  {
    key: "sss_sec_order",
    icon: "💳",
    items: [
      {
        q: "What payment methods can I use?",
        a: "We offer secure 3D Secure payment with credit/debit cards (Visa, Mastercard, Troy) and bank transfer/EFT options. All payments are processed securely with PayTR.",
      },
      {
        q: "Are installment payments available?",
        a: "Yes, during checkout via credit card, the installment options offered by your bank are automatically displayed on the PayTR payment screen. The number of installments may vary by bank.",
      },
      {
        q: "What should I do when ordering with bank transfer?",
        a: "Simply make the payment to the provided IBAN after placing your order. Don't forget to include your order number in the description. Your order will start being prepared once payment is confirmed.",
      },
      {
        q: "Can I track my order after placing it?",
        a: "Yes, you can track all your orders and their current status from 'My Orders' in your Account page. When it moves to shipping, the tracking number will appear there.",
      },
      {
        q: "Can I cancel my order?",
        a: "You can request cancellation before your order is shipped. Contact us through your Account page or via WhatsApp.",
      },
    ],
  },
  {
    key: "sss_sec_shipping",
    icon: "📦",
    items: [
      {
        q: "How much is shipping?",
        a: "Shipping costs vary by order amount. We offer free shipping on orders above a certain amount. The current shipping fee is shown during checkout.",
      },
      {
        q: "When will my order be shipped?",
        a: "After your payment is confirmed, your order is usually delivered to the carrier within 1-3 business days. This may take longer for personalized items.",
      },
      {
        q: "How can I track my shipment?",
        a: "After your order is shipped, you can track it in real-time from My Account → Shipment Tracking using your MNG Cargo tracking number.",
      },
      {
        q: "Which carrier do you use?",
        a: "We currently work with MNG Cargo. Insured and secure delivery is guaranteed.",
      },
      {
        q: "Do you ship internationally?",
        a: "We currently offer domestic delivery only. Contact us for information about our international shipping plans.",
      },
    ],
  },
  {
    key: "sss_sec_returns",
    icon: "↺",
    items: [
      {
        q: "How does the return process work?",
        a: "You can request a return within 14 days of receiving the product. Create a return request from My Account → Return Requests. After approval, simply ship the item back to us with the shipping code.",
      },
      {
        q: "When will I receive my refund?",
        a: "Your refund process starts after the product reaches us and is inspected. Credit card refunds may take 2-10 business days, bank account refunds 1-3 business days.",
      },
      {
        q: "Which products are returnable?",
        a: "Unused products in original packaging with tags attached are returnable. Personalized items (engraved, custom size, etc.) are excluded from returns.",
      },
      {
        q: "Can I exchange a product?",
        a: "For size/fit exchanges, create a return request and then place your new order. The new product will be shipped after the current item's return is completed.",
      },
    ],
  },
  {
    key: "sss_sec_product",
    icon: "💎",
    items: [
      {
        q: "Are your products certified?",
        a: "Yes, all our gold and diamond products are shipped with internationally compliant certificates. Quality documentation is included in every package.",
      },
      {
        q: "How is gold karat determined?",
        a: "The gold karat (8K, 14K, 18K, 22K) is clearly stated on the product page. Products also have hallmark stamps.",
      },
      {
        q: "Do product photos reflect reality?",
        a: "All product photos are taken in a professional studio. Color and brightness may vary slightly depending on your monitor, but products are faithfully reproduced.",
      },
      {
        q: "How do I measure my ring size?",
        a: "You can check our ring sizing guide on the Size Guide page. If in doubt, contact us for assistance.",
      },
      {
        q: "Why do prices change?",
        a: "Gold product prices are calculated with real-time gold rates. Rate changes are reflected in prices. The price in your cart is the latest current price.",
      },
    ],
  },
  {
    key: "sss_sec_account",
    icon: "🔒",
    items: [
      {
        q: "Is creating an account required?",
        a: "You need to register to place orders. With membership, you can track orders, create return requests, and benefit from special campaigns.",
      },
      {
        q: "I forgot my password, what should I do?",
        a: "Click 'Forgot Password' on the login page to send a password reset link to your registered email address.",
      },
      {
        q: "Is my personal information secure?",
        a: "All personal information is protected under KVKK (data protection law). Your data is transmitted and stored encrypted through our SSL certificate and secure infrastructure.",
      },
      {
        q: "Why is email verification required?",
        a: "Email verification is required for account security. Profile updates and order placement are restricted without verification.",
      },
    ],
  },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "i");
}

export default function SssPage() {
  const { t, loc } = useT();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("__all__");

  const FAQ_DATA = loc === "en" ? FAQ_EN : FAQ_TR;

  const categories = useMemo(
    () => ["__all__", ...FAQ_DATA.map((sec) => sec.key)],
    [FAQ_DATA]
  );

  const filtered = useMemo(() => {
    const q = normalize(search);

    return FAQ_DATA.map((sec) => {
      if (activeCategory !== "__all__" && sec.key !== activeCategory) {
        return { ...sec, items: [] };
      }

      if (!q) return sec;

      return {
        ...sec,
        items: sec.items.filter(
          (item) =>
            normalize(item.q).includes(q) || normalize(item.a).includes(q)
        ),
      };
    }).filter((sec) => sec.items.length > 0);
  }, [search, activeCategory, FAQ_DATA]);

  const totalCount = filtered.reduce((sum, sec) => sum + sec.items.length, 0);

  function toggleItem(key: string) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function categoryLabel(key: string) {
    if (key === "__all__") return t("sss_all");
    return t(key);
  }

  return (
    <main className={s.page}>
      <section className={s.heroSection}>
        <div className={s.heroShell}>
          <div className={s.heroGrid}>
            <div className={s.heroLeft}>
              <div className={s.badge}>{t("sss_badge")}</div>
              <h1 className={s.heroTitle}>{t("sss_title")}</h1>
              <p className={s.heroText}>{t("sss_desc")}</p>
            </div>

            <div className={s.heroRight}>
              <div className={s.heroPanel}>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{t("sss_total")}</div>
                  <div className={s.quickStatText}>
                    {FAQ_DATA.reduce((sum, sec) => sum + sec.items.length, 0)}+
                  </div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{t("sss_category")}</div>
                  <div className={s.quickStatText}>{FAQ_DATA.length}</div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{t("sss_support")}</div>
                  <div className={s.quickStatText}>WhatsApp</div>
                </div>
                <div className={s.quickStat}>
                  <div className={s.quickStatTitle}>{t("sss_response")}</div>
                  <div className={s.quickStatText}>~30 {loc === "en" ? "min" : "dk"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.contentSection}>
        <div className={s.contentShell}>
          <div className={s.searchBox}>
            <input
              type="text"
              className={s.searchInput}
              placeholder={t("sss_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={s.categoryTabs}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${s.categoryTab} ${
                  activeCategory === cat ? s.categoryTabActive : ""
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          {totalCount === 0 ? (
            <div className={s.noResults}>{t("sss_no_results")}</div>
          ) : (
            filtered.map((sec, si) => (
              <div key={si} className={s.faqSection}>
                <h2 className={s.faqSectionTitle}>
                  <span className={s.faqSectionIcon}>{sec.icon}</span>
                  {t(sec.key)}
                </h2>

                {sec.items.map((item, qi) => {
                  const key = `${si}-${qi}`;
                  const isOpen = openItems.has(key);

                  return (
                    <div key={key} className={s.faqItem}>
                      <button
                        type="button"
                        className={s.faqQuestion}
                        onClick={() => toggleItem(key)}
                        aria-expanded={isOpen}
                      >
                        <span>{item.q}</span>
                        <span
                          className={`${s.faqChevron} ${
                            isOpen ? s.faqChevronOpen : ""
                          }`}
                        >
                          ▾
                        </span>
                      </button>

                      {isOpen ? (
                        <div className={s.faqAnswer}>{item.a}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          <div className={s.ctaSection}>
            <h2 className={s.ctaTitle}>{t("sss_cta_title")}</h2>
            <p className={s.ctaText}>{t("sss_cta_text")}</p>
            <div className={s.ctaActions}>
              <Link href="/iletisim" className={`${s.btn} ${s.btnPrimary}`}>
                {t("sss_cta_contact")}
              </Link>
              <Link href="/shop" className={`${s.btn} ${s.btnSecondary}`}>
                {t("sss_cta_shop")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
