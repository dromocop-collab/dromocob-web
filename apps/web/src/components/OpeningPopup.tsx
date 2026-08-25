"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Smartphone, Sparkles, X } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./OpeningPopup.module.css";

export type OpeningPopupConfig = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  targetMode: "all" | "include" | "exclude";
  paths: string[];
  delayMs: number;
  frequency: "always" | "session" | "daily";
  theme: "midnight" | "aurora" | "light";
  version: number;
};

export const DEFAULT_OPENING_POPUP: OpeningPopupConfig = {
  enabled: true,
  eyebrow: "YENİ · IOS & ANDROID",
  title: "Markanız artık\nkullanıcıların cebinde.",
  description: "Mobil uygulama örneklerimizi keşfedin; fikrinizi App Store ve Google Play’e taşıyacak ürün planını birlikte oluşturalım.",
  imageUrl: "/mobile-apps/e-ticaret-mobil-uygulama-v1.jpg",
  ctaLabel: "Mobil uygulamaları keşfet",
  ctaUrl: "/mobil-uygulama-gelistirme",
  targetMode: "include",
  paths: ["/"],
  delayMs: 1800,
  frequency: "daily",
  theme: "aurora",
  version: 2,
};

function matches(pathname: string, rule: string) {
  const clean = rule.trim() || "/";
  if (clean.endsWith("*")) return pathname.startsWith(clean.slice(0, -1));
  return pathname === clean;
}

function isTargeted(config: OpeningPopupConfig, pathname: string) {
  if (config.targetMode === "all") return true;
  const matched = config.paths.some((rule) => matches(pathname, rule));
  return config.targetMode === "include" ? matched : !matched;
}

export default function OpeningPopup() {
  const pathname = usePathname() || "/";
  const [config, setConfig] = useState<OpeningPopupConfig>(DEFAULT_OPENING_POPUP);
  const [open, setOpen] = useState(false);
  const storageKey = useMemo(() => `ces-opening-popup-${config.version}`, [config]);

  useEffect(() => onSnapshot(doc(getFirebaseDb(), "site_options", "opening_popup"), (snap) => {
    setConfig({ ...DEFAULT_OPENING_POPUP, ...(snap.exists() ? snap.data() : {}) } as OpeningPopupConfig);
  }, () => setConfig(DEFAULT_OPENING_POPUP)), []);

  useEffect(() => {
    if (!config.enabled || !isTargeted(config, pathname)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (config.frequency === "session" && sessionStorage.getItem(storageKey)) return;
    if (config.frequency === "daily" && localStorage.getItem(storageKey) === today) return;
    const timer = window.setTimeout(() => setOpen(true), Math.max(0, Math.min(config.delayMs, 30000)));
    return () => window.clearTimeout(timer);
  }, [config, pathname, storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function dismiss() {
    if (config) {
      if (config.frequency === "session") sessionStorage.setItem(storageKey, "1");
      if (config.frequency === "daily") localStorage.setItem(storageKey, new Date().toISOString().slice(0, 10));
    }
    setOpen(false);
  }

  if (!open) return null;
  return <div className={s.backdrop} onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
    <section className={`${s.popup} ${s[config.theme]}`} role="dialog" aria-modal="true" aria-label="Duyuru">
      <button className={s.close} type="button" onClick={dismiss} aria-label="Reklamı kapat"><X /></button>
      <div className={s.visual}><img src={config.imageUrl} alt="Mobil uygulama tasarım örneği" /><i /></div>
      <div className={s.copy}><span><Sparkles /> {config.eyebrow}</span><h2>{config.title.split("\n").map((line, index) => <span key={line}>{line}{index === 0 && <br />}</span>)}</h2><p>{config.description}</p><div className={s.platforms}><b><Smartphone /> iOS</b><b><Smartphone /> Android</b><b>Mağaza yayını</b></div><a href={config.ctaUrl} onClick={dismiss}>{config.ctaLabel}<ArrowUpRight /></a><button type="button" onClick={dismiss}>Şimdi değil</button></div>
    </section>
  </div>;
}
