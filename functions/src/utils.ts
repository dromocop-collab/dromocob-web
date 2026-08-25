export function toNum(v: any, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normItem(x: any) {
  // Harem/benzeri endpointlerde alanlar değişebiliyor
  const code = String(x?.code ?? x?.symbol ?? x?.name ?? "").trim();
  const name = String(x?.title ?? x?.label ?? x?.desc ?? x?.name ?? code).trim();
  const buy = toNum(x?.buy ?? x?.alis ?? x?.purchase ?? x?.bid ?? x?.a ?? 0, 0);
  const sell = toNum(x?.sell ?? x?.satis ?? x?.sale ?? x?.ask ?? x?.s ?? 0, 0);
  return { code: code || name, name, buy, sell, raw: x };
}