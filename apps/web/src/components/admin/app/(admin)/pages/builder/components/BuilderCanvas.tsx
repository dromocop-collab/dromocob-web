"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { AnyBlock } from "../types";
import SortableBlockItem from "./SortableBlockItem";
import s from "../builder.module.css";

type Props = {
  blocks: AnyBlock[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleActive: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function BuilderCanvas({
  blocks,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onRemove,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-dropzone",
  });

  const sortableIds = blocks.map((block) => `block:${block.id}`);

  return (
    <div className={s.card}>
      <div className={s.rowBetween}>
        <b className={s.miniTitle}>Bloklar</b>
        <span className={s.pill}>{blocks.length} blok</span>
      </div>

      <div
        ref={setNodeRef}
        className={`${s.canvasDropZone} ${isOver ? s.canvasDropZoneOver : ""}`}
      >
        {blocks.length === 0 ? (
          <div className={s.emptyCanvasBox}>
            Henüz blok yok.
            <br />
            Soldan ekle ya da sürükle.
          </div>
        ) : (
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className={s.blockList}>
              {blocks.map((block) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onToggleActive={onToggleActive}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}