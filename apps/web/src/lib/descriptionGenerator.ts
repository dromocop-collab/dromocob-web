/**
 * descriptionGenerator.ts
 * ──────────────────────────────────────────────────────
 * Template-based product description generator for lifestyle e-commerce.
 * Designed for future AI API integration — swap `generateShortDescription`
 * and `generateLongDescription` internals to call an API endpoint.
 *
 * NO Firestore / React dependencies — pure utility.
 */

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

export type ProductType =
  | "bileklik"
  | "kolye"
  | "yuzuk"
  | "kupe"
  | "charm"
  | "erkek"
  | "cocuk"
  | "set"
  | "genel";

export interface ProductFacts {
  title: string;
  productType: ProductType;
  gram: number | null;
  ayar: string | null;          // "14", "18", "22", "8" etc.
  material: string | null;      // "altın", "gümüş", "çelik", etc.
  stone: string | null;         // "pırlanta", "zirkon", etc.
  stoneColor: string | null;
  color: string | null;         // "sarı", "beyaz", "rose" etc.
  category: string | null;
  sku: string | null;
  tags: string[];
  slug: string | null;
  hasVariants: boolean;
}

export interface DescriptionDraft {
  shortDescription: string;     // 80-160 chars
  longDescription: string;      // 2-3 paragraphs
  productType: ProductType;
  facts: ProductFacts;
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resolveLocale(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    return s(obj.tr) || s(obj.en);
  }
  return "";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ═══════════════════════════════════════════════════════
   buildProductFacts
   ═══════════════════════════════════════════════════════ */

export function buildProductFacts(p: Record<string, unknown>): ProductFacts {
  const title = resolveLocale(p.title) || resolveLocale(p.name) || resolveLocale(p.productTitle) || "";

  // Gram
  const gram = n(p.gram) || n(p.weightGram) || n(p.weight) || n((p.advanced as Record<string, unknown>)?.gram) || null;

  // Ayar / Karat
  let ayar = s(p.ayar) || s(p.karat) || s((p.advanced as Record<string, unknown>)?.ayar) || "";
  if (ayar && !ayar.includes("ayar") && /^\d+$/.test(ayar)) ayar = `${ayar} ayar`;
  const ayarVal = ayar || null;

  // Material
  const rawMaterial = s(p.material) || s(p.metalType) || s((p.advanced as Record<string, unknown>)?.material) || "";
  const material = rawMaterial || null;

  // Stone
  const rawStone = s(p.stone) || s(p.stoneType) || s((p.advanced as Record<string, unknown>)?.stone) || "";
  const stone = rawStone || null;
  const stoneColor = s(p.stoneColor) || null;

  // Color
  const color = s(p.color) || s((p.advanced as Record<string, unknown>)?.color) || null;

  // Category
  const category =
    resolveLocale(p.categoryName) ||
    (Array.isArray(p.categoryNames) ? resolveLocale(p.categoryNames[0]) : "") ||
    resolveLocale(p.category) ||
    s(p.mainCategoryName) ||
    null;

  // Tags
  const rawTags = Array.isArray(p.tags) ? p.tags.map((t: unknown) => s(t)).filter(Boolean) : [];

  // Variants
  const hasVariants =
    Array.isArray(p.variants) && p.variants.length > 0 ||
    Array.isArray((p.advanced as Record<string, unknown>)?.sizes) && ((p.advanced as Record<string, unknown>)?.sizes as unknown[]).length > 0;

  return {
    title,
    productType: detectProductType(p),
    gram: gram && gram > 0 ? gram : null,
    ayar: ayarVal,
    material,
    stone,
    stoneColor,
    color,
    category,
    sku: s(p.sku) || null,
    tags: rawTags,
    slug: s(p.slug) || null,
    hasVariants: !!hasVariants,
  };
}

/* ═══════════════════════════════════════════════════════
   detectProductType
   ═══════════════════════════════════════════════════════ */

const TYPE_KEYWORDS: Record<ProductType, string[]> = {
  bileklik: ["bileklik", "bracelet", "bangle", "kelepçe", "zincir bileklik", "tennis"],
  kolye: ["kolye", "necklace", "kolye ucu", "pendant", "zincir", "chain"],
  yuzuk: ["yüzük", "yuzuk", "ring", "alyans", "tek taş", "tektas"],
  kupe: ["küpe", "kupe", "earring", "piercing", "halka küpe", "sallantılı"],
  charm: ["charm", "uç", "bileklik ucu", "pandora"],
  erkek: ["erkek", "men", "bay", "erkek bileklik", "erkek yüzük", "erkek kolye"],
  cocuk: ["çocuk", "cocuk", "bebek", "baby", "kids", "child"],
  set: ["set", "takım", "kombin", "3'lü", "ikili", "üçlü"],
  genel: [],
};

export function detectProductType(p: Record<string, unknown>): ProductType {
  const haystack = [
    resolveLocale(p.title),
    resolveLocale(p.name),
    resolveLocale(p.categoryName),
    ...(Array.isArray(p.categoryNames) ? p.categoryNames.map((c: unknown) => resolveLocale(c)) : []),
    s(p.slug),
    ...(Array.isArray(p.tags) ? p.tags.map((t: unknown) => s(t)) : []),
  ]
    .join(" ")
    .toLowerCase();

  // Check erkek & cocuk first (they're modifiers)
  for (const kw of TYPE_KEYWORDS.erkek) {
    if (haystack.includes(kw)) return "erkek";
  }
  for (const kw of TYPE_KEYWORDS.cocuk) {
    if (haystack.includes(kw)) return "cocuk";
  }
  for (const kw of TYPE_KEYWORDS.set) {
    if (haystack.includes(kw)) return "set";
  }

  // Then check specific lifestyle types
  for (const type of ["bileklik", "kolye", "yuzuk", "kupe", "charm"] as ProductType[]) {
    for (const kw of TYPE_KEYWORDS[type]) {
      if (haystack.includes(kw)) return type;
    }
  }

  return "genel";
}

/* ═══════════════════════════════════════════════════════
   Description Templates
   ═══════════════════════════════════════════════════════ */

function buildSpecLine(facts: ProductFacts): string {
  const parts: string[] = [];
  if (facts.ayar) parts.push(facts.ayar);
  if (facts.material) parts.push(facts.material);
  if (facts.gram) parts.push(`${facts.gram} gram`);
  if (facts.stone) parts.push(`${facts.stoneColor ? facts.stoneColor + " " : ""}${facts.stone} taşlı`);
  if (facts.color) parts.push(`${facts.color} renk`);
  return parts.join(", ");
}

function buildSpecSentence(facts: ProductFacts): string {
  const spec = buildSpecLine(facts);
  if (!spec) return "";
  return `${capitalize(spec)} yapısıyla hem estetik hem değerli bir kullanım sunar.`;
}

/* ── Short Description Templates ── */

const SHORT_TEMPLATES: Record<ProductType, ((f: ProductFacts) => string)[]> = {
  bileklik: [
    (f) => `${f.title} — zarif tasarımı ve ince işçiliğiyle her kombine uyum sağlayan şık bir bileklik.${f.ayar ? ` ${f.ayar}.` : ""}`,
    (f) => `Günlük şıklığınıza değer katan ${f.title}.${f.gram ? ` ${f.gram} gram.` : ""} Dromocob güvencesiyle.`,
    (f) => `${f.title} — özel anlarınız için tasarlanmış, ${f.stone ? f.stone + " detaylı" : "minimal"} bileklik modeli.`,
  ],
  kolye: [
    (f) => `${f.title} — boyun hattınızı zarif bir dokunuşla tamamlayan ${f.stone ? f.stone + " taşlı" : "şık"} kolye.`,
    (f) => `Minimal ve etkileyici: ${f.title}.${f.ayar ? ` ${f.ayar}.` : ""} Hediye için de ideal.`,
    (f) => `${f.title} — her stilinize uyum sağlayan, ${f.gram ? f.gram + " gram " : ""}zarif bir kolye modeli.`,
  ],
  yuzuk: [
    (f) => `${f.title} — parmaklarınıza sofistike bir dokunuş katan ${f.stone ? f.stone + " işlemeli" : "özel"} yüzük.`,
    (f) => `Zarafet ve anlam bir arada: ${f.title}.${f.ayar ? ` ${f.ayar}.` : ""} Dromocob kalitesi.`,
    (f) => `${f.title} — günlük ve özel günler için ${f.material ? f.material + " " : ""}yüzük seçeneği.`,
  ],
  kupe: [
    (f) => `${f.title} — yüz hatlarınızı aydınlatan ${f.stone ? f.stone + " detaylı" : "zarif"} küpe modeli.`,
    (f) => `Şıklığınızı tamamlayan ${f.title}.${f.gram ? ` ${f.gram} gram.` : ""} Güvenli kargo ile kapınıza.`,
    (f) => `${f.title} — ${f.color ? f.color + " tonuyla " : ""}her kombine uyum sağlayan küpe.`,
  ],
  charm: [
    (f) => `${f.title} — bilekliğinize kişisel bir dokunuş katan özel charm modeli.`,
    (f) => `Tarzınızı yansıtın: ${f.title}. Koleksiyonunuza yeni bir anlam katın.`,
    (f) => `${f.title} — ${f.material ? f.material + " " : ""}charm. Kombinleyin, hikayenizi anlatın.`,
  ],
  erkek: [
    (f) => `${f.title} — erkek şıklığına güç katan ${f.material ? f.material + " " : ""}tasarım.${f.gram ? ` ${f.gram} gram.` : ""}`,
    (f) => `Maskülen ve zarif: ${f.title}. Günlük kullanım ve özel anlar için ideal.`,
    (f) => `${f.title} — güçlü çizgileriyle fark yaratan erkek takı seçeneği.`,
  ],
  cocuk: [
    (f) => `${f.title} — minik şıklığın en tatlı hali. Çocuklar için özel tasarım.`,
    (f) => `Küçük prensler ve prensesler için: ${f.title}. Güvenli malzeme, sevimli detaylar.`,
    (f) => `${f.title} — çocuğunuzun ilk takısı için ${f.ayar ? f.ayar + " " : ""}özel seçenek.`,
  ],
  set: [
    (f) => `${f.title} — uyumlu parçalarıyla kombin kolaylığı sunan takı seti.${f.gram ? ` Toplam ${f.gram} gram.` : ""}`,
    (f) => `Hediye için mükemmel: ${f.title}. Özel kutusuyla teslim edilir.`,
    (f) => `${f.title} — şıklığınızı tamamlayan ${f.stone ? f.stone + " detaylı " : ""}set koleksiyon.`,
  ],
  genel: [
    (f) => `${f.title} — Dromocob'un özenle seçilmiş koleksiyonundan.${f.ayar ? ` ${f.ayar}.` : ""}`,
    (f) => `Zarif ve şık: ${f.title}. Güvenli ödeme, hızlı kargo ile kapınıza.`,
    (f) => `${f.title} — özel anlarınız için tasarlanmış ${f.material ? f.material + " " : ""}takı seçeneği.`,
  ],
};

/* ── Long Description Templates ── */

const LONG_PARA1: Record<ProductType, ((f: ProductFacts) => string)[]> = {
  bileklik: [
    (f) => `${f.title}, zarif tasarımı ve şık detaylarıyla günlük kullanımda ve özel kombinlerde dikkat çeken bir bileklik seçeneğidir.`,
    (f) => `İnce işçiliği ve dengeli ağırlığıyla ${f.title}, bileğinize sofistike bir dokunuş katarak her tarzla uyum sağlar.`,
    (f) => `${f.title}, modern çizgileri ve kaliteli yapısıyla hem günlük hem de özel davetlerde rahatlıkla tercih edebileceğiniz bir bilekliktir.`,
  ],
  kolye: [
    (f) => `${f.title}, boyun hattınızı zarif bir şekilde tamamlayan özel bir kolye tasarımıdır. Hem günlük hem de özel davetlerde rahatlıkla kullanılabilir.`,
    (f) => `Sofistike detayları ve dengeli zincir yapısıyla ${f.title}, stilinize anlam katan bir kolye seçeneğidir.`,
    (f) => `${f.title}, minimal ama etkileyici tasarımıyla boyun hattınıza zarif bir dokunuş katar.`,
  ],
  yuzuk: [
    (f) => `${f.title}, ince işçiliği ve şık formuyla parmaklarınıza sofistike bir duruş kazandıran özel bir yüzüktür.`,
    (f) => `Zarafet ve anlam bir arada: ${f.title}, hem günlük kullanıma hem de özel günlere uyum sağlayan bir tasarım.`,
    (f) => `${f.title}, modern çizgileri ve dikkat çekici detaylarıyla her kombini tamamlayan bir yüzük seçeneğidir.`,
  ],
  kupe: [
    (f) => `${f.title}, yüz hatlarınızı aydınlatan zarif bir küpe tasarımıdır. Hafif yapısıyla uzun süreli konfor sunar.`,
    (f) => `Işıltılı görünümü ve şık detaylarıyla ${f.title}, her stilinize uyum sağlayan bir küpe modeli.`,
    (f) => `${f.title}, dengeli tasarımı ve kaliteli işçiliğiyle hem günlük hem özel anlarınızda yanınızda.`,
  ],
  charm: [
    (f) => `${f.title}, bilekliğinize kişisel bir anlam katan özel bir charm tasarımıdır. Koleksiyonunuza yeni bir hikaye ekler.`,
    (f) => `Her charm bir hikaye anlatır. ${f.title}, tarzınızı ve kişiliğinizi yansıtan detaylarıyla koleksiyonunuzun vazgeçilmezi olacak.`,
  ],
  erkek: [
    (f) => `${f.title}, maskülen çizgileri ve güçlü duruşuyla erkek şıklığına farklı bir boyut kazandıran özel bir takı tasarımıdır.`,
    (f) => `Güçlü ve zarif: ${f.title}, günlük tarzınıza karakter katan bir erkek takı seçeneği.`,
  ],
  cocuk: [
    (f) => `${f.title}, küçük şıklar için özenle tasarlanmış sevimli bir takıdır. Güvenli malzemeler kullanılarak üretilmiştir.`,
    (f) => `Minik prensler ve prensesler için: ${f.title}, çocuklara özel boyut ve ağırlıkta tasarlanmış bir takı seçeneğidir.`,
  ],
  set: [
    (f) => `${f.title}, birbiriyle uyumlu parçalardan oluşan özel bir takı setidir. Kombin kolaylığı ve şıklığı bir arada sunar.`,
    (f) => `Mükemmel hediye alternatifi: ${f.title}, özenle seçilmiş parçalarıyla şıklığınızı bir üst seviyeye taşır.`,
  ],
  genel: [
    (f) => `${f.title}, zarif tasarımı ve şık detaylarıyla günlük kullanımda ve özel kombinlerde dikkat çeken bir takı seçeneğidir.`,
    (f) => `${f.title}, modern çizgileri ve kaliteli işçiliğiyle Dromocob'un özenle hazırlanmış koleksiyonundan.`,
  ],
};

const LONG_PARA2_SPEC = (f: ProductFacts): string => {
  const specSentence = buildSpecSentence(f);
  if (specSentence) return specSentence;

  // No spec info — return a safe generic line
  return pick([
    "Dengeli yapısı ve kaliteli işçiliğiyle uzun ömürlü kullanım sunar.",
    "Özenle hazırlanan tasarımı sayesinde her detayda kaliteyi hissedeceksiniz.",
    "Şık görünümü ve dayanıklı yapısıyla uzun süre keyifle kullanabileceğiniz bir ürün.",
  ]);
};

const LONG_PARA3_CTA: string[] = [
  "Minimal çizgileri ve dengeli görünümü sayesinde hediye alternatifi olarak da tercih edilebilir. Dromocob güvencesiyle güvenli ödeme, hızlı kargo ve kolay iade avantajlarıyla satışa sunulur.",
  "Sevdiklerinize anlamlı bir hediye arayanlar için de ideal bir seçenektir. Dromocob'un güvenli alışveriş ortamında sipariş verebilir, hızlı teslimat imkanından yararlanabilirsiniz.",
  "Özel paketleme seçeneğiyle hediye olarak da sunulabilir. Dromocob güvencesiyle güvenli ödeme, hızlı kargo ve müşteri memnuniyeti önceliğiyle teslim edilir.",
  "Kendinize veya sevdiklerinize özel bir hediye olarak tercih edebilirsiniz. Dromocob; sertifikalı ürün, güvenli ödeme ve hızlı teslimat avantajlarıyla hizmetinizdedir.",
];

/* ═══════════════════════════════════════════════════════
   generateShortDescription
   ═══════════════════════════════════════════════════════ */

export function generateShortDescription(facts: ProductFacts): string {
  const templates = SHORT_TEMPLATES[facts.productType] || SHORT_TEMPLATES.genel;
  let result = pick(templates)(facts);

  // Enforce 80-160 char range
  if (result.length > 160) {
    result = result.slice(0, 157) + "...";
  }

  return result;
}

/* ═══════════════════════════════════════════════════════
   generateLongDescription
   ═══════════════════════════════════════════════════════ */

export function generateLongDescription(facts: ProductFacts): string {
  const para1Templates = LONG_PARA1[facts.productType] || LONG_PARA1.genel;
  const para1 = pick(para1Templates)(facts);
  const para2 = LONG_PARA2_SPEC(facts);
  const para3 = pick(LONG_PARA3_CTA);

  return `${para1}\n\n${para2}\n\n${para3}`;
}

/* ═══════════════════════════════════════════════════════
   generateProductDescriptionDraft (main entry point)
   ═══════════════════════════════════════════════════════ */

export function generateProductDescriptionDraft(
  product: Record<string, unknown>
): DescriptionDraft {
  const facts = buildProductFacts(product);

  return {
    shortDescription: generateShortDescription(facts),
    longDescription: generateLongDescription(facts),
    productType: facts.productType,
    facts,
  };
}

/* ═══════════════════════════════════════════════════════
   validateDescriptionDraft
   ═══════════════════════════════════════════════════════ */

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateDescriptionDraft(
  draft: { shortDescription: string; longDescription: string },
  facts: ProductFacts
): ValidationResult {
  const warnings: string[] = [];
  const combined = (draft.shortDescription + " " + draft.longDescription).toLowerCase();

  // Check: don't mention gram if product has none
  if (!facts.gram && /\d+\s*gram/i.test(combined)) {
    warnings.push("Üründe gram bilgisi yok ama açıklamada gram geçiyor.");
  }

  // Check: don't mention ayar if product has none
  if (!facts.ayar && /\d+\s*ayar/i.test(combined)) {
    warnings.push("Üründe ayar bilgisi yok ama açıklamada ayar geçiyor.");
  }

  // Check: don't mention stone if product has none
  if (!facts.stone && /(pırlanta|zirkon|taşlı|elmas|yakut|safir)/i.test(combined)) {
    warnings.push("Üründe taş bilgisi yok ama açıklamada taş geçiyor.");
  }

  // Check: dangerous legal claims
  if (/%100|garantili kazanç|en ucuz|en iyi fiyat|piyasanın altında/i.test(combined)) {
    warnings.push("Hukuki riskli ifade tespit edildi.");
  }

  // Check: short description length
  if (draft.shortDescription.length < 40) {
    warnings.push("Kısa açıklama çok kısa (40 karakterden az).");
  }
  if (draft.shortDescription.length > 200) {
    warnings.push("Kısa açıklama çok uzun (200 karakterden fazla).");
  }

  // Check: long description length
  if (draft.longDescription.length < 100) {
    warnings.push("Uzun açıklama çok kısa (100 karakterden az).");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
