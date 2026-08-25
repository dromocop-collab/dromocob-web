"use client";

import s from "../builder.module.css";
import type { AnyBlock } from "../types";

export default function BlockList({
  blocks,
  selectedId,
  onSelect,
  onMove,
  onToggle,
  onRemove,
}: {
  blocks: AnyBlock[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggle: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
}) {
  if (!blocks.length) {
    return <div className={s.emptyBox}>Henüz blok yok. Soldan ekle.</div>;
  }

  return (
    <div className={s.blockList}>
      {blocks.map((b) => {
        const active = b.isActive !== false;
        const isSel = String(b.id) === String(selectedId);

        return (
          <div
            key={b.id}
            className={`${s.blockRow} ${isSel ? s.blockRowOn : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(String(b.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(String(b.id));
              }
            }}
          >
            <div className={s.blockRowLeft}>
              <div className={s.blockType}>{b.type}</div>
              <div className={s.blockId}>{b.id}</div>
            </div>

            <div className={s.blockRowRight}>
              <button className={s.miniBtn} type="button" onClick={(e) => { e.stopPropagation(); onMove(String(b.id), -1); }}>↑</button>
              <button className={s.miniBtn} type="button" onClick={(e) => { e.stopPropagation(); onMove(String(b.id), 1); }}>↓</button>
              <button
                className={`${s.miniBtn} ${active ? s.okMini : s.warnMini}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(String(b.id), !active);
                }}
              >
                {active ? "ON" : "OFF"}
              </button>
              <button
                className={`${s.miniBtn} ${s.dangerMini}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(String(b.id));
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}