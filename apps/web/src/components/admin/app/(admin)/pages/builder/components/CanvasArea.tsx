"use client";

import { useDroppable } from "@dnd-kit/core";
import s from "../builder.module.css";

export default function CanvasArea({
  children,
  isEmpty,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-dropzone",
  });

  return (
    <div
      ref={setNodeRef}
      className={`${s.canvasArea} ${isOver ? s.canvasAreaOver : ""} ${isEmpty ? s.canvasAreaEmpty : ""}`}
    >
      {children}
    </div>
  );
}