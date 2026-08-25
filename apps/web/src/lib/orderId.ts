export function formatOrderId(id: string, mode: "short" | "full" = "short") {
    const clean = String(id || "").trim();
    if (!clean) return "";
  
    if (mode === "full") return clean;
  
    if (clean.length <= 14) return clean;
    return `${clean.slice(0, 6)}…${clean.slice(-6)}`;
  }