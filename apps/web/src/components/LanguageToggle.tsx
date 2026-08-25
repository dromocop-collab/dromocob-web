"use client";

import { useEffect, useState } from "react";
import { getLocale, setLocale, type Locale } from "@/lib/i18n";

export default function LanguageToggle() {
  const [loc, setLoc] = useState<Locale>("tr");
  const isEn = loc === "en";

  useEffect(() => {
    try {
      const initial = getLocale?.() as Locale;
      setLoc(initial === "en" ? "en" : "tr");
    } catch {
      setLoc("tr");
    }

    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const next = (ce?.detail as Locale) || "tr";
      setLoc(next === "en" ? "en" : "tr");
    };

    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  function toggle() {
    setLocale(isEn ? "tr" : "en");
  }

  return (
    <div className="langWrap" role="group" aria-label="Dil seçimi">
      <button
        type="button"
        className={`langSwitch ${isEn ? "is-en" : "is-tr"}`}
        onClick={toggle}
        aria-label={isEn ? "Türkçe’ye geç" : "English’e geç"}
        title={isEn ? "Türkçe" : "English"}
      >
        <span className="track" aria-hidden />
        <span className="knob" aria-hidden />
        <span className="txt txt-tr" aria-hidden>
          TR
        </span>
        <span className="txt txt-en" aria-hidden>
          EN
        </span>
      </button>

      <style jsx>{`
        .langWrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .langSwitch {
          position: relative;
          width: 70px;
          height: 31px;
          padding: 0;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 11px;
          background: linear-gradient(180deg, #ffffff 0%, #f5f7fa 100%);
          box-shadow:
            0 5px 14px rgba(15, 23, 42, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.92);
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease,
            background 0.18s ease;
        }

        .langSwitch:hover {
          border-color: rgba(15, 23, 42, 0.16);
          box-shadow:
            0 8px 18px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
        }

        .langSwitch:active {
          transform: translateY(1px);
        }

        .langSwitch:focus-visible {
          outline: none;
          border-color: rgba(37, 99, 235, 0.45);
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.1),
            0 8px 18px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
        }

        .track {
          position: absolute;
          inset: 0;
          border-radius: 11px;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.72), rgba(255,255,255,0) 38%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.015), rgba(15, 23, 42, 0.04));
        }

        .knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 32px;
          height: 25px;
          border-radius: 8px;
          background: linear-gradient(135deg, #071634 0%, #0b224d 100%);
          box-shadow:
            0 7px 16px rgba(7, 22, 52, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transition:
            left 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .langSwitch:hover .knob {
          box-shadow:
            0 9px 18px rgba(7, 22, 52, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .txt {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.03em;
          line-height: 1;
          pointer-events: none;
          transition: color 0.18s ease, opacity 0.18s ease;
        }

        .txt-tr {
          left: 11px;
          color: #ffffff;
        }

        .txt-en {
          right: 10px;
          color: rgba(15, 23, 42, 0.56);
        }

        .langSwitch.is-en .knob {
          left: calc(100% - 34px);
        }

        .langSwitch.is-en .txt-tr {
          color: rgba(15, 23, 42, 0.56);
        }

        .langSwitch.is-en .txt-en {
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .langSwitch {
            width: 66px;
            height: 29px;
            border-radius: 10px;
          }

          .track {
            border-radius: 10px;
          }

          .knob {
            width: 30px;
            height: 23px;
            border-radius: 7px;
          }

          .langSwitch.is-en .knob {
            left: calc(100% - 32px);
          }

          .txt {
            font-size: 9px;
          }

          .txt-tr {
            left: 10px;
          }

          .txt-en {
            right: 9px;
          }
        }

        @media (max-width: 390px) {
          .langSwitch {
            width: 62px;
            height: 28px;
          }

          .knob {
            width: 28px;
            height: 22px;
          }

          .langSwitch.is-en .knob {
            left: calc(100% - 30px);
          }

          .txt {
            font-size: 9px;
          }

          .txt-tr {
            left: 9px;
          }

          .txt-en {
            right: 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .langSwitch,
          .knob,
          .txt {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}