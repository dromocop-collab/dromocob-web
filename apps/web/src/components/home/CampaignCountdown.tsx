"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import s from "./campaignCountdown.module.css";

type CountdownConfig = {
  enabled?: boolean;
  title?: { tr?: string; en?: string } | string;
  subtitle?: { tr?: string; en?: string } | string;
  endDate?: string; // ISO string or "YYYY-MM-DD HH:mm"
  href?: string;
  btnText?: { tr?: string; en?: string } | string;
  bgGradient?: string;
};

function pickT(v: any, loc: string, fb = ""): string {
  if (!v) return fb;
  if (typeof v === "string") return v.trim() || fb;
  return (loc === "en" ? v?.en || v?.tr : v?.tr || v?.en) || fb;
}

function parseEndDate(v: any): number {
  if (!v) return 0;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

type TimeLeft = { days: number; hours: number; mins: number; secs: number };

function calcTimeLeft(endMs: number): TimeLeft | null {
  const diff = endMs - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    mins: Math.floor((diff / (1000 * 60)) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className={s.digit}>
      <div className={s.digitValue}>
        {String(value).padStart(2, "0")}
      </div>
      <div className={s.digitLabel}>{label}</div>
    </div>
  );
}

export default function CampaignCountdown({
  loc = "tr",
  cfg,
}: {
  loc?: string;
  cfg?: CountdownConfig | null;
}) {
  const endMs = useMemo(() => parseEndDate(cfg?.endDate), [cfg?.endDate]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!endMs) return;

    setTimeLeft(calcTimeLeft(endMs));

    const interval = setInterval(() => {
      const tl = calcTimeLeft(endMs);
      setTimeLeft(tl);
      if (!tl) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [endMs]);

  // Eğer config yoksa veya enabled değilse veya süre bittiyse gösterme
  if (!cfg?.enabled || !endMs || !timeLeft) return null;

  const title = pickT(cfg?.title, loc, loc === "en" ? "Special Campaign" : "Özel Kampanya");
  const subtitle = pickT(cfg?.subtitle, loc, "");
  const btnText = pickT(cfg?.btnText, loc, loc === "en" ? "Shop Now" : "Alışverişe Başla");
  const href = String(cfg?.href || "/shop").trim();

  return (
    <section className={s.section} aria-label={title}>
      <div className={s.inner}>
        <div className={s.card}>
          {/* Animated background */}
          <div className={s.bgGlow} aria-hidden />

          <div className={s.content}>
            <div className={s.kicker}>
              {loc === "en" ? "LIMITED TIME" : "SINIRLI SÜRE"}
            </div>
            <h2 className={s.h2}>{title}</h2>
            {subtitle && <p className={s.sub}>{subtitle}</p>}

            {/* Countdown */}
            <div className={s.timer}>
              <Digit value={timeLeft.days} label={loc === "en" ? "DAYS" : "GÜN"} />
              <div className={s.sep}>:</div>
              <Digit value={timeLeft.hours} label={loc === "en" ? "HOURS" : "SAAT"} />
              <div className={s.sep}>:</div>
              <Digit value={timeLeft.mins} label={loc === "en" ? "MIN" : "DAK"} />
              <div className={s.sep}>:</div>
              <Digit value={timeLeft.secs} label={loc === "en" ? "SEC" : "SN"} />
            </div>

            <Link className={s.cta} href={href}>
              {btnText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
