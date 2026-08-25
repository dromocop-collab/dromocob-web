"use client";

export type ToastType = "success" | "error" | "info";

let rootEl: HTMLDivElement | null = null;

function ensureRoot() {
  if (rootEl) return rootEl;

  const el = document.createElement("div");
  el.id = "admin-toast-root";
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);

  rootEl = el;
  return el;
}

function escapeHtml(s: string) {
  // replaceAll yok -> regex ile çöz
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function icon(type: ToastType) {
  if (type === "success") return "✓";
  if (type === "error") return "!";
  return "i";
}

function show(message: string, type: ToastType = "info", ms = 2200) {
  if (typeof document === "undefined") return;

  const root = ensureRoot();

  const item = document.createElement("div");
  item.className = `adminToast adminToast--${type}`;
  item.innerHTML = `
    <div class="adminToast__icon" aria-hidden="true">${icon(type)}</div>
    <div class="adminToast__msg">${escapeHtml(message)}</div>
    <button class="adminToast__close" type="button" aria-label="Kapat">×</button>
    <div class="adminToast__bar" aria-hidden="true"></div>
  `;

  root.appendChild(item);

  // animasyon tetik
  requestAnimationFrame(() => item.classList.add("adminToast--on"));

  const close = () => {
    item.classList.remove("adminToast--on");
    item.classList.add("adminToast--off");
    window.setTimeout(() => item.remove(), 220);
  };

  const btn = item.querySelector(".adminToast__close") as HTMLButtonElement | null;
  btn?.addEventListener("click", close);

  window.setTimeout(close, Math.max(1200, ms));
}

export const toast = {
  success: (msg: string, ms?: number) => show(msg, "success", ms),
  error: (msg: string, ms?: number) => show(msg, "error", ms),
  info: (msg: string, ms?: number) => show(msg, "info", ms),
};