export function fmt(n: unknown, digits = 2) {
  const num = (() => {
    if (typeof n === "number" && Number.isFinite(n)) return n;
    if (typeof n === "string") {
      const s = n.trim().replace(/\./g, "").replace(",", ".");
      const x = Number(s);
      return Number.isFinite(x) ? x : 0;
    }
    const x = Number(n ?? 0);
    return Number.isFinite(x) ? x : 0;
  })();

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(num);
  } catch {
    return `₺${num.toFixed(digits)}`;
  }
}