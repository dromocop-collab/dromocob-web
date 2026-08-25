"use client";

import { useDraggable } from "@dnd-kit/core";
import type { BlockKind } from "../types";
import s from "../builder.module.css";

const LIB_ITEMS: Array<{ type: BlockKind; label: string }> = [
  { type: "heading", label: "Başlık" },
  { type: "richText", label: "Yazı (RichText)" },
  { type: "image", label: "Görsel" },
  { type: "slider", label: "Slider" },
  { type: "cards", label: "Kartlar" },
  { type: "button", label: "Buton" },
  { type: "spacer", label: "Boşluk" },
];

function PaletteItem({
  type,
  label,
}: {
  type: BlockKind;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${type}`,
    data: {
      from: "library",
      blockType: type,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`${s.libBtn} ${isDragging ? s.libBtnDragging : ""}`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
}

export default function BlockLibrary() {
  return (
    <div className={s.card}>
      <b className={s.miniTitle}>Blok Kütüphanesi</b>
      <div className={s.hint}>Tut → orta alana bırak</div>

      <div className={s.blockLib}>
        {LIB_ITEMS.map((item) => (
          <PaletteItem key={item.type} type={item.type} label={item.label} />
        ))}
      </div>
    </div>
  );
}