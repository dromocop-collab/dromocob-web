export type LocaleText = {
  tr?: string;
  en?: string;
};

export type BlockType =
  | "heading"
  | "richText"
  | "image"
  | "button"
  | "cards"
  | "slider"
  | "spacer";
export type BlockKind =
  | "heading"
  | "richText"
  | "image"
  | "slider"
  | "cards"
  | "button"
  | "spacer";
  

export type BlockBase = {
  id: string;
  type: BlockKind;
  isActive?: boolean;
};

export type HeadingBlock = BlockBase & {
  type: "heading";
  title?: LocaleText;
  subtitle?: LocaleText;
  align?: "left" | "center" | "right";
};

export type RichTextBlock = BlockBase & {
  type: "richText";
  html?: LocaleText;
};

export type ImageBlock = BlockBase & {
  type: "image";
  src?: string;
  alt?: LocaleText;
  link?: string;
};

export type ButtonBlock = BlockBase & {
  type: "button";
  label?: LocaleText;
  href?: string;
  variant?: "primary" | "soft";
  align?: "left" | "center" | "right";
};

export type CardsItem = {
  title?: LocaleText;
  desc?: LocaleText;
  icon?: string;
};

export type CardsBlock = BlockBase & {
  type: "cards";
  columns?: number;
  items?: CardsItem[];
};

export type SliderSlide = {
  title?: LocaleText;
  subtitle?: LocaleText;
  image?: string;
  cta?: {
    label?: LocaleText;
    href?: string;
  };
  isActive?: boolean;
};

export type SliderBlock = BlockBase & {
  type: "slider";
  slides?: SliderSlide[];
};

export type SpacerBlock = BlockBase & {
  type: "spacer";
  height?: number;
};

export type UnknownBlock = {
  id: string;
  type: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type AnyBlock =
  | HeadingBlock
  | RichTextBlock
  | ImageBlock
  | ButtonBlock
  | CardsBlock
  | SliderBlock
  | SpacerBlock
  | UnknownBlock;

export type PageDoc = {
  group?: string;
  slug?: string;
  title?: LocaleText;
  isPublished?: boolean;
  blocks?: AnyBlock[];
  contentHtml?: LocaleText;
};