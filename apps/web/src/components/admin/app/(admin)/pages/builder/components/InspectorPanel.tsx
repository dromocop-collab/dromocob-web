"use client";

import type { RefObject } from "react";
import s from "../builder.module.css";
import type { AnyBlock } from "../types";
import HeadingInspector from "./blocks/HeadingInspector";
import RichTextInspector from "./blocks/RichTextInspector";
import ImageInspector from "./blocks/ImageInspector";
import ButtonInspector from "./blocks/ButtonInspector";
import CardsInspector from "./blocks/CardsInspector";
import SliderInspector from "./blocks/SliderInspector";
import SpacerInspector from "./blocks/SpacerInspector";
import UnknownInspector from "./blocks/UnknownInspector";

type InspectorPanelProps = {
  block: AnyBlock | null;
  onPatch: (patch: any) => void;
  onLT: (key: string, loc: "tr" | "en", val: string) => void;
  fileRef: RefObject<HTMLInputElement>;
  onUpload: () => void;
  saving: boolean;
  onUploadSlide: (blockId: string, slideIndex: number, file: File) => Promise<void> | void;
  sliderUploading: boolean;
};

export default function InspectorPanel(props: InspectorPanelProps) {
  const { block } = props;

  if (!block) {
    return <div className={s.emptyBox}>Soldan bir blok seç.</div>;
  }

  if (block.type === "heading") return <HeadingInspector {...props} block={block as any} />;
  if (block.type === "richText") return <RichTextInspector {...props} block={block as any} />;
  if (block.type === "image") return <ImageInspector {...props} block={block as any} />;
  if (block.type === "button") return <ButtonInspector {...props} block={block as any} />;
  if (block.type === "cards") return <CardsInspector {...props} block={block as any} />;
  if (block.type === "slider") return <SliderInspector {...props} block={block as any} />;
  if (block.type === "spacer") return <SpacerInspector {...props} block={block as any} />;

  return <UnknownInspector {...props} block={block} />;
}