import type { AnyBlock, BlockKind } from "./types";

export function uid(prefix = "b") {
  return `${prefix}${Math.random().toString(16).slice(2, 8)}${Date.now()
    .toString(16)
    .slice(-4)}`;
}

export function str(v: any) {
  return String(v ?? "").trim();
}

export function pickLT(loc: "tr" | "en", v?: { tr?: string; en?: string }, fb = "") {
  const t = loc === "en" ? v?.en : v?.tr;
  return str(t) || fb;
}

export function makeDefaultBlock(type: BlockKind): AnyBlock {
  const base: AnyBlock = {
    id: uid("b"),
    type,
    isActive: true,
  } as AnyBlock;

  switch (type) {
    case "heading":
      return {
        ...base,
        type: "heading",
        align: "left",
        title: { tr: "Başlık", en: "Heading" },
        subtitle: { tr: "", en: "" },
      };

    case "richText":
      return {
        ...base,
        type: "richText",
        html: { tr: "<p>İçerik…</p>", en: "<p>Content…</p>" },
      };

    case "image":
      return {
        ...base,
        type: "image",
        src: "",
        link: "",
        alt: { tr: "Görsel", en: "Image" },
      };

    case "button":
      return {
        ...base,
        type: "button",
        variant: "primary",
        align: "left",
        href: "/shop",
        label: { tr: "Mağazaya Git", en: "Go to Shop" },
      };

    case "cards":
      return {
        ...base,
        type: "cards",
        columns: 3,
        items: [
          {
            title: { tr: "Güvenli Ödeme", en: "Secure Payment" },
            desc: { tr: "3D Secure", en: "3DS" },
            icon: "shield",
          },
          {
            title: { tr: "Aynı Gün Kargo", en: "Same-day Shipping" },
            desc: { tr: "İstanbul içi", en: "Istanbul" },
            icon: "truck",
          },
          {
            title: { tr: "Sertifikalı Ürün", en: "Certified" },
            desc: { tr: "Güvence", en: "Warranty" },
            icon: "star",
          },
        ],
      };

    case "slider":
      return {
        ...base,
        type: "slider",
        slides: [
          {
            isActive: true,
            title: { tr: "Yeni Sezon", en: "New Season" },
            subtitle: { tr: "Öne Çıkanlar", en: "Featured" },
            image: "",
            cta: {
              href: "/shop",
              label: { tr: "Mağaza", en: "Shop" },
            },
          },
        ],
      };

    case "spacer":
      return {
        ...base,
        type: "spacer",
        height: 24,
      };

    default:
      return base;
  }
}