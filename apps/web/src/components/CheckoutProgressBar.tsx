"use client";

import { useMemo } from "react";

type Step = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

const ICONS = {
  cart: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={9} cy={21} r={1} /><circle cx={20} cy={21} r={1} /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  info: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx={12} cy={7} r={4} />
    </svg>
  ),
  payment: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={1} y={4} width={22} height={16} rx={2} ry={2} /><line x1={1} y1={10} x2={23} y2={10} />
    </svg>
  ),
  check: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const STEPS: Step[] = [
  { key: "cart", label: "Sepet", icon: ICONS.cart },
  { key: "info", label: "Bilgiler", icon: ICONS.info },
  { key: "payment", label: "Odeme", icon: ICONS.payment },
];

export default function CheckoutProgressBar({
  currentStep = "info",
}: {
  currentStep?: "cart" | "info" | "payment" | "done";
}) {
  const activeIdx = useMemo(() => {
    if (currentStep === "done") return STEPS.length;
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    return idx >= 0 ? idx : 1;
  }, [currentStep]);

  return (
    <nav
      aria-label="Checkout adimlari"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: "18px 16px 14px",
        maxWidth: 520,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {STEPS.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;


        return (
          <div
            key={step.key}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i < STEPS.length - 1 ? 1 : "0 0 auto",
            }}
          >
            {/* Step circle + label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                minWidth: 64,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: isDone
                    ? "#1d7a4d"
                    : isActive
                      ? "#0d1836"
                      : "#d1d5db",
                  background: isDone
                    ? "#edf9f1"
                    : isActive
                      ? "#0d1836"
                      : "#f9fafb",
                  color: isDone
                    ? "#1d7a4d"
                    : isActive
                      ? "#fff"
                      : "#9ca3af",
                  transition: "all .3s ease",
                  flexShrink: 0,
                }}
              >
                {isDone ? ICONS.check : step.icon}
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: isDone || isActive ? 800 : 600,
                  color: isDone
                    ? "#1d7a4d"
                    : isActive
                      ? "#0d1836"
                      : "#9ca3af",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  transition: "color .3s ease",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 ? (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginBottom: 22,
                  marginLeft: 8,
                  marginRight: 8,
                  borderRadius: 1,
                  background: isDone ? "#1d7a4d" : "#e5e7eb",
                  transition: "background .3s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Animated fill for active step */}
                {isActive ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: "40%",
                      background:
                        "linear-gradient(90deg, #0d1836, transparent)",
                      borderRadius: 1,
                      animation: "checkoutPulse 1.8s ease-in-out infinite",
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes checkoutPulse {
          0%, 100% { width: 30%; opacity: .5; }
          50% { width: 70%; opacity: 1; }
        }
      `}</style>
    </nav>
  );
}
