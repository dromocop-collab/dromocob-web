"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnyBlock } from "../types";
import s from "../builder.module.css";

type Props = {
  block: AnyBlock;
  selectedId: string;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleActive: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function SortableBlockItem({
  block,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onRemove,
}: Props) {
  const active = block.isActive !== false;
  const isSelected = String(block.id) === String(selectedId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `block:${block.id}`,
    data: {
      from: "canvas",
      blockId: String(block.id),
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        s.blockRow,
        isSelected ? s.blockRowOn : "",
        isDragging ? s.blockRowDragging : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(String(block.id))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(String(block.id));
        }
      }}
    >
      <div className={s.blockRowLeft}>
        <button
          type="button"
          className={s.dragHandle}
          title="Sürükle"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        <div className={s.blockMeta}>
          <div className={s.blockType}>{block.type}</div>
          <div className={s.blockId}>{block.id}</div>
        </div>
      </div>

      <div className={s.blockRowRight}>
        <button
          type="button"
          className={s.miniBtn}
          title="Yukarı"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(String(block.id));
          }}
        >
          ↑
        </button>

        <button
          type="button"
          className={s.miniBtn}
          title="Aşağı"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(String(block.id));
          }}
        >
          ↓
        </button>

        <button
          type="button"
          className={`${s.miniBtn} ${active ? s.okMini : s.warnMini}`}
          title="Aktif / Pasif"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive(String(block.id));
          }}
        >
          {active ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          className={`${s.miniBtn} ${s.dangerMini}`}
          title="Sil"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(String(block.id));
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}