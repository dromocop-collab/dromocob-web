"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import s from "../builder.module.css";
import type { AnyBlock } from "../types";

export default function SortableBlockCard({
  block,
  selected,
  onSelect,
  onToggleActive,
  onDelete,
}: {
  block: AnyBlock;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `block-${block.id}`,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const active = block.isActive !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${s.blockRow} ${selected ? s.blockRowOn : ""} ${isDragging ? s.blockRowDragging : ""}`}
      onClick={onSelect}
    >
      <div className={s.blockRowLeft}>
        <button
          type="button"
          className={s.dragHandle}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="Sürükle"
        >
          ⋮⋮
        </button>

        <div>
          <div className={s.blockType}>{block.type}</div>
          <div className={s.blockId}>{block.id}</div>
        </div>
      </div>

      <div className={s.blockRowRight}>
        <button
          className={`${s.miniBtn} ${active ? s.okMini : s.warnMini}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive();
          }}
        >
          {active ? "ON" : "OFF"}
        </button>

        <button
          className={`${s.miniBtn} ${s.dangerMini}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}