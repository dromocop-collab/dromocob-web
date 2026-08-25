export type Locale = "tr" | "en";
const KEY = "locale";

export function getLocale(): Locale {
  if (typeof window === "undefined") return "tr";
  const v = (localStorage.getItem(KEY) || "tr").toLowerCase();
  return v === "en" ? "en" : "tr";
}

export function setLocale(next: Locale) {
  if (typeof window === "undefined") return;
  const safe: Locale = next === "en" ? "en" : "tr";
  localStorage.setItem(KEY, safe);

  // html lang güncelle
  document.documentElement.lang = safe;

  // React bileşenleri haberdar olsun
  window.dispatchEvent(new CustomEvent("locale-changed", { detail: safe }));
}