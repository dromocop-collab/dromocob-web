// Arsa Coffee menüsü — TASLAK (Ekim 2026)
// İnternette yayınlanmış bir menü bulunamadı. "IG" notlular Instagram gönderilerinde görülenler,
// diğerleri örnek. Fiyatlar boş: işletmeden alınca ikinci alana sayı olarak yaz (ör. 180).
// kahve: true olan gruplar Arsa Kart'a damga kazandırır.
// [ad, fiyat, açıklama, açıklama (EN)]
window.ARSA_MENU = [
  { id: "sicak", title: "Sıcak kahve", titleEn: "Hot coffee", kahve: true, items: [
    ["Türk Kahvesi", null, "Lokumuyla", "With Turkish delight"],                          // IG
    ["Espresso", null, "Tek ya da duble", "Single or double"],
    ["Americano", null, "", ""],
    ["Cortado", null, "Espresso, az süt", "Espresso, a little milk"],
    ["Flat White", null, "Duble ristretto, ince süt", "Double ristretto, silky milk"],     // IG
    ["Cappuccino", null, "", ""],
    ["Latte", null, "Vanilya, karamel, fındık şurubuyla da olur", "Vanilla, caramel or hazelnut on request"],
    ["Mocha", null, "Espresso, çikolata, süt", "Espresso, chocolate, milk"],
    ["Filtre Kahve", null, "Günün çekirdeği", "Bean of the day"],
  ]},
  { id: "soguk", title: "Soğuk kahve", titleEn: "Iced coffee", kahve: true, items: [
    ["Iced Latte", null, "En çok giden", "Our bestseller"],                               // IG
    ["Iced Americano", null, "", ""],                                                    // IG
    ["Cold Brew", null, "Uzun demlenmiş", "Slow steeped"],
    ["Iced Spanish Latte", null, "Yoğunlaştırılmış süt ile", "With condensed milk"],
    ["Iced Mocha", null, "", ""],
  ]},
  { id: "yesil", title: "Matcha ve hafif", titleEn: "Matcha & light", items: [
    ["Matcha Latte", null, "Sıcak ya da buzlu", "Hot or iced"],                           // IG
    ["Iced Matcha", null, "Süt seçimli", "Choice of milk"],                               // IG
    ["Yeşil Smoothie", null, "Ispanak, elma, muz", "Spinach, apple, banana"],            // IG (smoothie)
    ["Taze Portakal Suyu", null, "Sıkma", "Freshly squeezed"],                            // IG (meyve suyu)
    ["Ev Limonatası", null, "Nane ile", "With mint"],
    ["Bitki Çayı", null, "Ihlamur, adaçayı, yeşil çay", "Linden, sage, green tea"],
  ]},
  { id: "tatli", title: "Tatlı", titleEn: "Sweets", items: [
    ["Cream Puff", null, "Kremalı, meyveli", "Cream and fruit"],                          // IG
    ["Brownie", null, "Iced latte'nin eşlikçisi", "Made for an iced latte"],             // IG
    ["San Sebastian Cheesecake", null, "", ""],
    ["Tiramisu", null, "", ""],
    ["Cookie", null, "Çikolata parçalı", "Chocolate chunk"],
  ]},
];
