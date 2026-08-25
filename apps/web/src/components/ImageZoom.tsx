"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Ürün görseli üzerinde lens-tarzı zoom efekti.
 * Desktop'ta hover ile aktif olur, mobilde tap-to-zoom.
 */
export default function ImageZoom({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zooming, setZooming] = useState(false);
  const [bgPos, setBgPos] = useState("center center");

  const ZOOM_LEVEL = 2.5;

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      setBgPos(`${x}% ${y}%`);
    },
    []
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    },
    [handleMove]
  );

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setZooming(true)}
      onMouseLeave={() => setZooming(false)}
      onMouseMove={onMouseMove}
      onTouchStart={() => setZooming(true)}
      onTouchEnd={() => setZooming(false)}
      onTouchMove={onTouchMove}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: zooming ? "zoom-out" : "zoom-in",
        touchAction: "none",
      }}
      role="img"
      aria-label={alt}
    >
      {/* Normal image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          transition: zooming ? "none" : "opacity .2s ease",
          opacity: zooming ? 0 : 1,
          background: "#f3f3f1",
        }}
      />

      {/* Zoomed overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${src}")`,
          backgroundSize: `${ZOOM_LEVEL * 100}%`,
          backgroundPosition: bgPos,
          backgroundRepeat: "no-repeat",
          opacity: zooming ? 1 : 0,
          transition: zooming ? "none" : "opacity .2s ease",
          pointerEvents: "none",
        }}
      />

      {/* Zoom hint icon */}
      {!zooming ? (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(15,23,42,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.7,
            transition: "opacity .2s ease",
            pointerEvents: "none",
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx={11} cy={11} r={8} />
            <line x1={21} y1={21} x2={16.65} y2={16.65} />
            <line x1={11} y1={8} x2={11} y2={14} />
            <line x1={8} y1={11} x2={14} y2={11} />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
