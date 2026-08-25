"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocale, type Locale } from "@/lib/i18n";

import tr from "@/messages/tr.json";
import en from "@/messages/en.json";

type Dict = Record<string, string>;
const DICTS: Record<Locale, Dict> = { tr, en };

export function useLocale(): Locale {
  const [loc, setLoc] = useState<Locale>("tr");

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const next = (ce?.detail as Locale) || "tr";
      setLoc(next === "en" ? "en" : "tr");
    };

    window.addEventListener("locale-changed", handler as EventListener);
    return () => window.removeEventListener("locale-changed", handler as EventListener);
  }, []);

  return loc;
}

export function useT() {
  const loc = useLocale();
  const dict = useMemo(() => DICTS[loc] ?? DICTS.tr, [loc]);

  function t(key: string) {
    return dict[key] ?? DICTS.tr[key] ?? key; // fallback: tr, yoksa key
  }

  return { t, loc };
}