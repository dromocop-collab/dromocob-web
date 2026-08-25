"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./RatesProviderAdmin.module.css";
import { adminFetch } from "@/lib/adminFetch";

type RateItem = {
  code?: string;
  name?: string;
  buy?: number | string;
  sell?: number | string;
  unit?: number | string;
  updatedAt?: any;
};

type RatesLatest = {
  provider?: string;
  fetchedAt?: any;
  count?: number;
  items?: RateItem[] | Record<string, any> | any;
};

type RatesProviderSettings = {
  ratesEnabled: boolean;
  storefrontRatesVisible: boolean;
  cartRatesAutoRefresh: boolean;
  cartRefreshMinutes: number;
  providerMode: "harem" | "demo" | "manual";
  allowManualTrigger: boolean;
  freezeRates: boolean;
  staleWarnMinutes: number;
  staleCriticalMinutes: number;
  maintenanceMessage: string;
  refreshCountdownSeconds: number;
  updatedAt?: any;
  updatedBy?: string;
};

const DEFAULT_CFG: RatesProviderSettings = {
  ratesEnabled: true,
  storefrontRatesVisible: true,
  cartRatesAutoRefresh: true,
  cartRefreshMinutes: 3,
  providerMode: "harem",
  allowManualTrigger: true,
  freezeRates: false,
  staleWarnMinutes: 1440,       // 24 saat sonra "gecikmeli"
  staleCriticalMinutes: 2880,   // 48 saat sonra "stale"
  maintenanceMessage: "",
  refreshCountdownSeconds: 86400, // 24 saat (günlük yenileme)
};
type RateDisplayRule = {
  key: string;
  visible: boolean;
  labelTr: string;
  labelEn: string;
  buyPercent: number;
  sellPercent: number;
  buyFixed: number;
  sellFixed: number;
  sortOrder: number;
  highlight: boolean;
  badgeText: string;
};

type RatesDisplaySettings = {
  enabled: boolean;
  hideAllOnStorefront: boolean;
  rules: Record<string, RateDisplayRule>;
  updatedAt?: any;
  updatedBy?: string;
};

const DEFAULT_DISPLAY_CFG: RatesDisplaySettings = {
  enabled: true,
  hideAllOnStorefront: false,
  rules: {},
};
function s(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any) {
  const n =
    typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtDateTR(v: any) {
  try {
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : typeof v === "string"
        ? new Date(v)
        : v instanceof Date
        ? v
        : null;

    if (!d || Number.isNaN(d.getTime?.())) return "—";
    return d.toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}

function tsMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return Number(v.toMillis());
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v;
    const parsed = Date.parse(String(v));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function timeAgoTR(v: any) {
  const ms = tsMs(v);
  if (!ms) return "—";
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

function normalizeItems(v: any): RateItem[] {
  if (Array.isArray(v)) return v as RateItem[];
  if (v && typeof v === "object") {
    return Object.values(v) as RateItem[];
  }
  return [];
}

async function readResponsePayload(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json().catch(() => null);
  return await res.text().catch(() => "");
}

function healthTone(
  fetchedAt: any,
  warnMinutes: number,
  criticalMinutes: number
): "ok" | "warn" | "bad" | "neutral" {
  const ms = tsMs(fetchedAt);
  if (!ms) return "neutral";
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin <= warnMinutes) return "ok";
  if (diffMin <= criticalMinutes) return "warn";
  return "bad";
}

function getHealthLabel(
  fetchedAt: any,
  warnMinutes: number,
  criticalMinutes: number
) {
  const tone = healthTone(fetchedAt, warnMinutes, criticalMinutes);
  if (tone === "ok") return "sağlıklı";
  if (tone === "warn") return "gecikmeli";
  if (tone === "bad") return "stale";
  return "bilinmiyor";
}

export default function RatesProviderAdminPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [latest, setLatest] = useState<RatesLatest | null>(null);
  const [cfg, setCfg] = useState<RatesProviderSettings>(DEFAULT_CFG);
const [displayCfg, setDisplayCfg] = useState<RatesDisplaySettings>(DEFAULT_DISPLAY_CFG);
const [displaySaving, setDisplaySaving] = useState(false);
const [displaySearch, setDisplaySearch] = useState("");
const [mainTab, setMainTab] = useState<"settings" | "live" | "display">("settings");
const [bulkBuyPercent, setBulkBuyPercent] = useState(0);
const [bulkSellPercent, setBulkSellPercent] = useState(0);
const [bulkBuyFixed, setBulkBuyFixed] = useState(0);
const [bulkSellFixed, setBulkSellFixed] = useState(0);

const [bulkMode, setBulkMode] = useState<"replace" | "add">("replace");
const [bulkScope, setBulkScope] = useState<"filtered" | "visible">("filtered");
const [bulkHighlight, setBulkHighlight] = useState<"keep" | "on" | "off">("keep");
  const [busy, setBusy] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [status, setStatus] = useState<{
    kind: "ok" | "err" | "info";
    text: string;
  } | null>(null);

  const [q, setQ] = useState("");
  const [onlyValid, setOnlyValid] = useState(false);
  const [sortKey, setSortKey] = useState<"code" | "buy" | "sell">("code");

  // Live countdown
  const [countdown, setCountdown] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const lastFetchRef = useRef(0);

  const autoRefreshEnabled =
    cfg.ratesEnabled &&
    !cfg.freezeRates &&
    cfg.providerMode !== "manual";

  // Update elapsed + countdown every second
  useEffect(() => {
    const tick = () => {
      const fetchMs = tsMs(latest?.fetchedAt);
      lastFetchRef.current = fetchMs;
      if (!fetchMs) { setElapsedSec(0); setCountdown(0); return; }
      const elapsed = Math.floor((Date.now() - fetchMs) / 1000);
      setElapsedSec(elapsed);
      if (autoRefreshEnabled) {
        const interval = cfg.refreshCountdownSeconds || 60;
        const remaining = Math.max(0, interval - (elapsed % interval));
        setCountdown(remaining);
      } else {
        setCountdown(0);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [latest?.fetchedAt, autoRefreshEnabled, cfg.refreshCountdownSeconds]);

useEffect(() => {
  const autoRefreshEnabled =
    cfg.ratesEnabled &&
    !cfg.freezeRates &&
    cfg.providerMode !== "manual";

  if (!autoRefreshEnabled) return;

  const seconds = clamp(Number(cfg.refreshCountdownSeconds || 86400), 5, 86400);

  const run = async () => {
    try {
      await adminFetch("/api/rates/refresh", {
        method: "POST",
        body: JSON.stringify({ source: "rates_provider_auto" }),
      });
    } catch (err) {
      console.error("rates auto refresh error:", err);
    }
  };

  const timer = setInterval(run, seconds * 1000);

  return () => clearInterval(timer);
}, [
  cfg.ratesEnabled,
  cfg.freezeRates,
  cfg.providerMode,
  cfg.refreshCountdownSeconds,
]);
 useEffect(() => {
  let unsubLatest: Unsubscribe | null = null;
  let unsubCfg: Unsubscribe | null = null;
  let unsubDisplay: Unsubscribe | null = null;

  try {
    unsubLatest = onSnapshot(
      doc(db, "rates", "latest"),
      (snap) => {
        setLatest(snap.exists() ? ((snap.data() as any) ?? {}) : null);
      },
      (e) => {
        setLatest(null);
        setStatus({
          kind: "err",
          text: s(e?.message || "rates/latest okunamadı."),
        });
      }
    );

    unsubCfg = onSnapshot(
      doc(db, "settings", "rates_provider"),
      (snap) => {
        const raw = snap.exists() ? ((snap.data() as any) ?? {}) : {};

        setCfg({
          ratesEnabled: raw?.ratesEnabled !== false,
          storefrontRatesVisible: raw?.storefrontRatesVisible !== false,
          cartRatesAutoRefresh: raw?.cartRatesAutoRefresh !== false,
          cartRefreshMinutes: clamp(
            Number(raw?.cartRefreshMinutes ?? 3),
            1,
            60
          ),
          providerMode:
            raw?.providerMode === "demo" || raw?.providerMode === "manual"
              ? raw.providerMode
              : "harem",
          allowManualTrigger: raw?.allowManualTrigger !== false,
          freezeRates: raw?.freezeRates === true,
          staleWarnMinutes: clamp(
            Number(raw?.staleWarnMinutes ?? 1440),
            1,
            2880
          ),
          staleCriticalMinutes: clamp(
            Number(raw?.staleCriticalMinutes ?? 2880),
            2,
            4320
          ),
          refreshCountdownSeconds: clamp(
  Number(raw?.refreshCountdownSeconds ?? 86400),
  5,
  86400
),
          maintenanceMessage: s(raw?.maintenanceMessage),
          updatedAt: raw?.updatedAt,
          updatedBy: raw?.updatedBy,
        });
      },
      (e) => {
        setStatus({
          kind: "err",
          text: s(e?.message || "settings/rates_provider okunamadı."),
        });
      }
    );

    unsubDisplay = onSnapshot(
      doc(db, "settings", "rates_display"),
      (snap) => {
        const raw = snap.exists() ? ((snap.data() as any) ?? {}) : {};

        setDisplayCfg({
          enabled: raw?.enabled !== false,
          hideAllOnStorefront: raw?.hideAllOnStorefront === true,
          rules:
            raw?.rules && typeof raw.rules === "object"
              ? raw.rules
              : {},
          updatedAt: raw?.updatedAt,
          updatedBy: raw?.updatedBy,
        });
      },
      (e) => {
        setStatus({
          kind: "err",
          text: s(e?.message || "settings/rates_display okunamadı."),
        });
      }
    );
  } catch (e: any) {
    setStatus({
      kind: "err",
      text: s(e?.message || "Firestore bağlantısı kurulamadı."),
    });
  }

  return () => {
    try {
      unsubLatest?.();
    } catch {}

    try {
      unsubCfg?.();
    } catch {}

    try {
      unsubDisplay?.();
    } catch {}
  };
}, [db]);

  const provider = s(latest?.provider) || "—";
  const fetchedAtText = fmtDateTR(latest?.fetchedAt);
  const fetchedAgo = timeAgoTR(latest?.fetchedAt); // eslint-disable-line @typescript-eslint/no-unused-vars
  const count = String(latest?.count ?? "—");

  const health = getHealthLabel(
    latest?.fetchedAt,
    cfg.staleWarnMinutes,
    cfg.staleCriticalMinutes
  );
  const healthClass = healthTone(
    latest?.fetchedAt,
    cfg.staleWarnMinutes,
    cfg.staleCriticalMinutes
  );

  // Elapsed formatting
  const elapsedFmt = useMemo(() => {
    if (!elapsedSec) return "—";
    if (elapsedSec < 60) return `${elapsedSec}sn`;
    const m = Math.floor(elapsedSec / 60);
    const sec = elapsedSec % 60;
    if (m < 60) return `${m}dk ${sec}sn`;
    const h = Math.floor(m / 60);
    return `${h}sa ${m % 60}dk`;
  }, [elapsedSec]);

  // Countdown progress (0–100)
  const countdownPct = autoRefreshEnabled
    ? Math.round((countdown / (cfg.refreshCountdownSeconds || 60)) * 100)
    : 0;

  const itemsAll = normalizeItems(latest?.items);

  // Visible / hidden counts
  const visibleCount = useMemo(() => {
    return itemsAll.filter((it, i) => {
      const k = s(it?.code || it?.name || `rate-${i}`);
      return displayCfg.rules?.[k]?.visible !== false;
    }).length;
  }, [itemsAll, displayCfg.rules]);
  const hiddenCount = itemsAll.length - visibleCount;

const displayRows = useMemo(() => {
  const qLower = displaySearch.trim().toLowerCase();

  return itemsAll
    .map((it, index) => {
      const rawKey = s(it?.code || it?.name || `rate-${index}`);
      const rule = displayCfg.rules?.[rawKey];

      const row: RateDisplayRule = {
        key: rawKey,
        visible: rule?.visible !== false,
        labelTr: s(rule?.labelTr || rawKey),
        labelEn: s(rule?.labelEn || rawKey),
        buyPercent: Number(rule?.buyPercent ?? 0),
        sellPercent: Number(rule?.sellPercent ?? 0),
        buyFixed: Number(rule?.buyFixed ?? 0),
        sellFixed: Number(rule?.sellFixed ?? 0),
        sortOrder: Number(rule?.sortOrder ?? index + 1),
        highlight: rule?.highlight === true,
        badgeText: s(rule?.badgeText || ""),
      };

      return {
        raw: it,
        rule: row,
      };
    })
    .filter((x) => {
      if (!qLower) return true;
      const hay = `${x.rule.key} ${x.rule.labelTr} ${x.rule.labelEn}`.toLowerCase();
      return hay.includes(qLower);
    })
    .sort((a, b) => a.rule.sortOrder - b.rule.sortOrder);
}, [itemsAll, displayCfg.rules, displaySearch]);
  const items = useMemo(() => {
  const qLower = q.trim().toLowerCase();

  const list = itemsAll
    .map((it, index) => {
      const rawKey = s(it?.code || it?.name || `rate-${index}`);
      const rule = displayCfg.rules?.[rawKey];

      if (displayCfg.enabled !== false && rule?.visible === false) {
        return null;
      }

      const buy = Number(
        (
          (toNum(it?.buy) ?? 0) +
          ((toNum(it?.buy) ?? 0) * Number(rule?.buyPercent ?? 0)) / 100 +
          Number(rule?.buyFixed ?? 0)
        ).toFixed(2)
      );

      const sell = Number(
        (
          (toNum(it?.sell) ?? 0) +
          ((toNum(it?.sell) ?? 0) * Number(rule?.sellPercent ?? 0)) / 100 +
          Number(rule?.sellFixed ?? 0)
        ).toFixed(2)
      );

      return {
        ...it,
        rawKey,
        code: rawKey,
        name: s(rule?.labelTr || it?.name || rawKey),
        buy,
        sell,
        sortOrder: Number(rule?.sortOrder ?? index + 1),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((it) => {
      if (!qLower) return true;
      const hay = `${s(it.code)} ${s(it.name)}`.toLowerCase();
      return hay.includes(qLower);
    });

  const filtered = onlyValid
    ? list.filter((it) => toNum(it.buy) !== null || toNum(it.sell) !== null)
    : list;

  filtered.sort((a, b) => {
    if (sortKey === "code") {
      return s(a.code || a.name).localeCompare(s(b.code || b.name), "tr");
    }
    if (sortKey === "buy") {
      return (toNum(b.buy) ?? -1) - (toNum(a.buy) ?? -1);
    }
    if (sortKey === "sell") {
      return (toNum(b.sell) ?? -1) - (toNum(a.sell) ?? -1);
    }
    return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
  });

  return filtered;
}, [itemsAll, displayCfg, q, onlyValid, sortKey]);
const hasDisplayChanges = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  return JSON.stringify({
    enabled: displayCfg.enabled,
    hideAllOnStorefront: displayCfg.hideAllOnStorefront,
    rules: displayCfg.rules,
  }) !== JSON.stringify(DEFAULT_DISPLAY_CFG);
}, [displayCfg]);
 const isDirty = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  const current = JSON.stringify({
    ratesEnabled: cfg.ratesEnabled,
    storefrontRatesVisible: cfg.storefrontRatesVisible,
    cartRatesAutoRefresh: cfg.cartRatesAutoRefresh,
    cartRefreshMinutes: cfg.cartRefreshMinutes,
    providerMode: cfg.providerMode,
    allowManualTrigger: cfg.allowManualTrigger,
    freezeRates: cfg.freezeRates,
    staleWarnMinutes: cfg.staleWarnMinutes,
    staleCriticalMinutes: cfg.staleCriticalMinutes,
    refreshCountdownSeconds: cfg.refreshCountdownSeconds,
    maintenanceMessage: cfg.maintenanceMessage,
  });

  const baseline = JSON.stringify({
    ratesEnabled: DEFAULT_CFG.ratesEnabled,
    storefrontRatesVisible: DEFAULT_CFG.storefrontRatesVisible,
    cartRatesAutoRefresh: DEFAULT_CFG.cartRatesAutoRefresh,
    cartRefreshMinutes: DEFAULT_CFG.cartRefreshMinutes,
    providerMode: DEFAULT_CFG.providerMode,
    allowManualTrigger: DEFAULT_CFG.allowManualTrigger,
    freezeRates: DEFAULT_CFG.freezeRates,
    staleWarnMinutes: DEFAULT_CFG.staleWarnMinutes,
    staleCriticalMinutes: DEFAULT_CFG.staleCriticalMinutes,
    refreshCountdownSeconds: DEFAULT_CFG.refreshCountdownSeconds,
    maintenanceMessage: DEFAULT_CFG.maintenanceMessage,
  });

  return current !== baseline;
}, [cfg]);

  const triggerUpdate = useCallback(async () => {
    if (busy) return;
    if (!cfg.ratesEnabled) {
      setStatus({ kind: "err", text: "Kur sistemi kapalı. Önce sistemi aç." });
      return;
    }
    if (cfg.freezeRates) {
      setStatus({
        kind: "err",
        text: "Kur sistemi dondurulmuş. Güncelleme için dondurma kapatılmalı.",
      });
      return;
    }
    if (!cfg.allowManualTrigger) {
      setStatus({
        kind: "err",
        text: "Manuel tetikleme kapalı. Ayardan açmadan güncelleme yapamazsın.",
      });
      return;
    }

    setStatus(null);
    setBusy(true);

    try {
      const res = await adminFetch("/api/rates/refresh", {
        method: "POST",
        body: JSON.stringify({ source: "admin_panel" }),
      });

      const payload: any = await readResponsePayload(res);

      if (!res.ok) {
        const msg =
          (typeof payload === "string" ? payload : payload?.message) ||
          `Update başarısız (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setStatus({
        kind: "ok",
        text: "Güncelleme tetiklendi. rates/latest birkaç saniye içinde yenilenir.",
      });
    } catch (e: any) {
      setStatus({
        kind: "err",
        text: s(e?.message || "Güncelleme sırasında hata oluştu."),
      });
    } finally {
      setBusy(false);
    }
  }, [busy, cfg]);

  async function saveCfg() {
  if (cfgSaving) return;

  setCfgSaving(true);
  setStatus(null);

  try {
    const safeCfg: RatesProviderSettings = {
      ratesEnabled: !!cfg.ratesEnabled,
      storefrontRatesVisible: !!cfg.storefrontRatesVisible,
      cartRatesAutoRefresh: !!cfg.cartRatesAutoRefresh,
      cartRefreshMinutes: clamp(Number(cfg.cartRefreshMinutes || 3), 1, 60),
      providerMode:
        cfg.providerMode === "demo" || cfg.providerMode === "manual"
          ? cfg.providerMode
          : "harem",
      allowManualTrigger: !!cfg.allowManualTrigger,
      freezeRates: !!cfg.freezeRates,
      staleWarnMinutes: clamp(Number(cfg.staleWarnMinutes || 1440), 1, 2880),
      staleCriticalMinutes: clamp(
        Number(cfg.staleCriticalMinutes || 2880),
        2,
        4320
      ),
      refreshCountdownSeconds: clamp(
        Number(cfg.refreshCountdownSeconds || 86400),
        5,
        86400
      ),
      maintenanceMessage: s(cfg.maintenanceMessage),
    };

    if (safeCfg.staleCriticalMinutes <= safeCfg.staleWarnMinutes) {
      safeCfg.staleCriticalMinutes = safeCfg.staleWarnMinutes + 1;
    }

    await Promise.all([
      setDoc(
        doc(db, "settings", "rates_provider"),
        {
          ...safeCfg,
          updatedAt: serverTimestamp(),
          updatedBy: "admin",
        },
        { merge: true }
      ),

      // Web tarafı bunu okuyor
      setDoc(
        doc(db, "settings", "public"),
        {
          ratesEnabled: safeCfg.ratesEnabled,
          showRatesOnPublic: safeCfg.storefrontRatesVisible,
          storefrontRatesVisible: safeCfg.storefrontRatesVisible,
          cartRatesAutoRefresh: safeCfg.cartRatesAutoRefresh,
          cartRefreshMinutes: safeCfg.cartRefreshMinutes,
          freezeRates: safeCfg.freezeRates,
          staleWarnMinutes: safeCfg.staleWarnMinutes,
          staleCriticalMinutes: safeCfg.staleCriticalMinutes,
          refreshCountdownSeconds: safeCfg.refreshCountdownSeconds,
          maintenanceMessage: safeCfg.maintenanceMessage,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    setStatus({ kind: "ok", text: "Kur ayarları kaydedildi ✅" });
  } catch (e: any) {
    setStatus({
      kind: "err",
      text: s(e?.message || "Ayarlar kaydedilemedi."),
    });
  } finally {
    setCfgSaving(false);
  }
}
  function applyBulkUpdate() {
  const targetRows =
    bulkScope === "visible"
      ? displayRows.filter(({ rule }) => rule.visible !== false)
      : displayRows;

  if (!targetRows.length) {
    setStatus({ kind: "err", text: "Toplu güncelleme için uygun kur bulunamadı." });
    return;
  }

  setDisplayCfg((prev) => {
    const nextRules = { ...(prev.rules || {}) };

    targetRows.forEach(({ rule }) => {
      const current = nextRules[rule.key] || {
        key: rule.key,
        visible: true,
        labelTr: rule.labelTr || rule.key,
        labelEn: rule.labelEn || rule.key,
        buyPercent: 0,
        sellPercent: 0,
        buyFixed: 0,
        sellFixed: 0,
        sortOrder: rule.sortOrder || 9999,
        highlight: false,
        badgeText: "",
      };

      nextRules[rule.key] = {
        ...current,
        buyPercent:
          bulkMode === "replace"
            ? Number(bulkBuyPercent || 0)
            : Number(current.buyPercent || 0) + Number(bulkBuyPercent || 0),

        sellPercent:
          bulkMode === "replace"
            ? Number(bulkSellPercent || 0)
            : Number(current.sellPercent || 0) + Number(bulkSellPercent || 0),

        buyFixed:
          bulkMode === "replace"
            ? Number(bulkBuyFixed || 0)
            : Number(current.buyFixed || 0) + Number(bulkBuyFixed || 0),

        sellFixed:
          bulkMode === "replace"
            ? Number(bulkSellFixed || 0)
            : Number(current.sellFixed || 0) + Number(bulkSellFixed || 0),

        highlight:
          bulkHighlight === "keep"
            ? current.highlight === true
            : bulkHighlight === "on",
      };
    });

    return {
      ...prev,
      rules: nextRules,
    };
  });

  setStatus({
    kind: "ok",
    text: `${targetRows.length} kur için toplu güncelleme uygulandı.`,
  });
}
function resetBulkPercents() {
  setBulkBuyPercent(0);
  setBulkSellPercent(0);
  setBulkBuyFixed(0);
  setBulkSellFixed(0);
  setBulkMode("replace");
  setBulkScope("filtered");
  setBulkHighlight("keep");
}
function updateDisplayRule(key: string, patch: Partial<RateDisplayRule>) {
  setDisplayCfg((prev) => {
    const current = prev.rules?.[key] || {
      key,
      visible: true,
      labelTr: key,
      labelEn: key,
      buyPercent: 0,
      sellPercent: 0,
      buyFixed: 0,
      sellFixed: 0,
      sortOrder: 9999,
      highlight: false,
      badgeText: "",
    };

    return {
      ...prev,
      rules: {
        ...prev.rules,
        [key]: {
          ...current,
          ...patch,
        },
      },
    };
  });
}
  function resetCfg() {
    setCfg(DEFAULT_CFG);
    setStatus({ kind: "info", text: "Form varsayılan değerlere döndü." });
  }
async function saveDisplayCfg() {
  if (displaySaving) return;

  setDisplaySaving(true);
  setStatus(null);

  try {
    await setDoc(
      doc(db, "settings", "rates_display"),
      {
        enabled: !!displayCfg.enabled,
        hideAllOnStorefront: !!displayCfg.hideAllOnStorefront,
        rules: displayCfg.rules || {},
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      },
      { merge: true }
    );

    setStatus({ kind: "ok", text: "Kur görünüm ayarları kaydedildi ✅" });
  } catch (e: any) {
    setStatus({
      kind: "err",
      text: s(e?.message || "Kur görünüm ayarları kaydedilemedi."),
    });
  } finally {
    setDisplaySaving(false);
  }
}
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(latest ?? {}, null, 2));
      setStatus({ kind: "ok", text: "rates/latest JSON panoya kopyalandı ✅" });
    } catch {
      setStatus({ kind: "err", text: "Panoya kopyalanamadı." });
    }
  }

  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <div className={styles.page}>
          {/* ═══ Hero ═══ */}
          <div className={styles.hero}>
            <div>
              <div className={styles.kicker}>Kur Kontrol Merkezi</div>
              <h1 className={styles.title}>Rates Provider</h1>
              <p className={styles.sub}>
                Kur sistemi, provider, sepet timer, marj ayarları ve canlı veri sağlığı — hepsi tek merkezde.
              </p>
            </div>

            <div className={styles.heroActions}>
              <button className={styles.btnGhost} onClick={copyJson} type="button">
                📋 JSON
              </button>
              <button
                className={styles.btnPrimary}
                onClick={triggerUpdate}
                disabled={busy || !cfg.allowManualTrigger}
                type="button"
              >
                {busy ? "⏳ Güncelleniyor…" : "⚡ Şimdi Güncelle"}
              </button>
            </div>
          </div>

          {/* ═══ Quick Actions Bar ═══ */}
          <div className={styles.quickBar}>
            <button
              type="button"
              className={`${styles.quickToggle} ${cfg.ratesEnabled ? styles.quickToggleOn : styles.quickToggleOff}`}
              onClick={() => {
                setCfg(p => ({ ...p, ratesEnabled: !p.ratesEnabled }));
              }}
            >
              <span className={`${styles.quickDot} ${cfg.ratesEnabled ? styles.quickDotOn : styles.quickDotOff}`} />
              Kur Sistemi: {cfg.ratesEnabled ? "Açık" : "Kapalı"}
            </button>

            <button
              type="button"
              className={`${styles.quickToggle} ${cfg.freezeRates ? styles.quickToggleFrozen : styles.quickToggleOn}`}
              onClick={() => {
                setCfg(p => ({ ...p, freezeRates: !p.freezeRates }));
              }}
            >
              <span className={`${styles.quickDot} ${cfg.freezeRates ? styles.quickDotFrozen : styles.quickDotOn}`} />
              {cfg.freezeRates ? "🧊 Dondurulmuş" : "🔄 Canlı"}
            </button>

            <button
              type="button"
              className={`${styles.quickToggle} ${cfg.storefrontRatesVisible ? styles.quickToggleOn : styles.quickToggleOff}`}
              onClick={() => {
                setCfg(p => ({ ...p, storefrontRatesVisible: !p.storefrontRatesVisible }));
              }}
            >
              <span className={`${styles.quickDot} ${cfg.storefrontRatesVisible ? styles.quickDotOn : styles.quickDotOff}`} />
              Vitrin: {cfg.storefrontRatesVisible ? "Görünür" : "Gizli"}
            </button>

            {autoRefreshEnabled && (
              <span className={styles.autoSpinner}>
                <span className={styles.spinnerIcon}>↻</span>
                Otomatik yenileme aktif ({cfg.refreshCountdownSeconds}sn)
              </span>
            )}
          </div>

          {/* ═══ KPI Grid ═══ */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={`${styles.trafficLight} ${styles[`traffic${healthClass.charAt(0).toUpperCase() + healthClass.slice(1)}`]}`} />
              <span className={styles.kpiLabel}>Sistem Sağlığı</span>
              <strong className={`${styles.kpiValue} ${styles[`tone_${healthClass}`]}`}>
                {health}
              </strong>
              <span className={styles.kpiSub}>
                {healthClass === "ok" ? "Veriler güncel" : healthClass === "warn" ? "Güncelleme gecikiyor" : healthClass === "bad" ? "Acil güncelleme gerekli" : "Veri yok"}
              </span>
            </div>

            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Son Güncelleme</span>
              <strong className={styles.kpiValue}>{elapsedFmt}</strong>
              <span className={styles.kpiSub}>{fetchedAtText}</span>
            </div>

            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Provider</span>
              <strong className={styles.kpiValue}>{provider}</strong>
              <span className={styles.kpiSub}>Mod: {cfg.providerMode}</span>
            </div>

            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Kur Sayısı</span>
              <strong className={styles.kpiValue}>{count}</strong>
              <span className={styles.kpiSub}>
                {visibleCount} görünür{hiddenCount > 0 ? ` • ${hiddenCount} gizli` : ""}
              </span>
            </div>

            {autoRefreshEnabled && (
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Sonraki Yenileme</span>
                <strong className={styles.kpiValue}>{countdown}sn</strong>
                <div className={styles.countdownWrap}>
                  <div className={styles.countdownBar}>
                    <div
                      className={styles.countdownFill}
                      style={{ width: `${countdownPct}%` }}
                    />
                  </div>
                  <span className={styles.countdownText}>{Math.round(countdownPct)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Alert ═══ */}
          {status ? (
            <div
              className={`${styles.alert} ${
                status.kind === "ok"
                  ? styles.alertOk
                  : status.kind === "err"
                  ? styles.alertErr
                  : styles.alertInfo
              }`}
            >
              {status.text}
            </div>
          ) : null}


          <div className={styles.singleWrap}>
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <div>
        <h3 className={styles.cardTitle}>Kur Yönetim Merkezi</h3>
        <p className={styles.cardSub}>
          Ayarlar ve canlı kur tablosu tek merkezde, sekmeli yapı ile yönetilir.
        </p>
      </div>
    </div>

    <div className={styles.mainTabBar}>
      <button
        type="button"
        className={`${styles.mainTabBtn} ${mainTab === "settings" ? styles.mainTabBtnActive : ""}`}
        onClick={() => setMainTab("settings")}
      >
        Ayarlar
      </button>
<button
  type="button"
  className={`${styles.mainTabBtn} ${mainTab === "display" ? styles.mainTabBtnActive : ""}`}
  onClick={() => setMainTab("display")}
>
  Görünüm & Marj
</button>
      <button
        type="button"
        className={`${styles.mainTabBtn} ${mainTab === "live" ? styles.mainTabBtnActive : ""}`}
        onClick={() => setMainTab("live")}
      >
        Canlı Kurlar
      </button>
    </div>

    {mainTab === "settings" ? (
      <div className={styles.tabContent}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}>Kur Sistemi Ayarları</h3>
            <p className={styles.cardSub}>
              Frontend ve admin davranışını buradan yönetirsin.
            </p>
          </div>

          <div className={styles.badgeRow}>
            <span className={`${styles.badge} ${cfg.ratesEnabled ? styles.badgeOk : styles.badgeBad}`}>
              {cfg.ratesEnabled ? "aktif" : "kapalı"}
            </span>
            <span className={`${styles.badge} ${cfg.freezeRates ? styles.badgeWarn : styles.badgeNeutral}`}>
              {cfg.freezeRates ? "dondurulmuş" : "canlı"}
            </span>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.switchCard}>
            <input
              type="checkbox"
              checked={cfg.ratesEnabled}
              onChange={(e) =>
                setCfg((p) => ({ ...p, ratesEnabled: e.target.checked }))
              }
            />
            <div>
              <span className={styles.switchTitle}>Kur sistemi açık</span>
              <span className={styles.switchDesc}>
                Dinamik fiyat ve kur akışı tamamen aktif olur.
              </span>
            </div>
          </label>

          <label className={styles.switchCard}>
            <input
              type="checkbox"
              checked={cfg.storefrontRatesVisible}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  storefrontRatesVisible: e.target.checked,
                }))
              }
              disabled={!cfg.ratesEnabled}
            />
            <div>
              <span className={styles.switchTitle}>Vitrinde kurlar görünsün</span>
              <span className={styles.switchDesc}>
                Public tarafta kur alanları gösterilir.
              </span>
            </div>
          </label>

          <label className={styles.switchCard}>
            <input
              type="checkbox"
              checked={cfg.cartRatesAutoRefresh}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  cartRatesAutoRefresh: e.target.checked,
                }))
              }
              disabled={!cfg.ratesEnabled}
            />
            <div>
              <span className={styles.switchTitle}>Sepet timer aktif</span>
              <span className={styles.switchDesc}>
                Sepette süre dolunca kur yenileme akışı çalışır.
              </span>
            </div>
          </label>

          <label className={styles.switchCard}>
            <input
              type="checkbox"
              checked={cfg.allowManualTrigger}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  allowManualTrigger: e.target.checked,
                }))
              }
            />
            <div>
              <span className={styles.switchTitle}>Manuel tetikleme açık</span>
              <span className={styles.switchDesc}>
                Panelden “Şimdi Güncelle” çalıştırılır.
              </span>
            </div>
          </label>

          <label className={styles.switchCard}>
            <input
              type="checkbox"
              checked={cfg.freezeRates}
              onChange={(e) =>
                setCfg((p) => ({ ...p, freezeRates: e.target.checked }))
              }
            />
            <div>
              <span className={styles.switchTitle}>Kur verisini dondur</span>
              <span className={styles.switchDesc}>
                Canlı güncelleme fiilen kilitlenir.
              </span>
            </div>
          </label>
        </div>

        <div className={styles.fieldsGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Provider modu</span>
            <select
              className={styles.select}
              value={cfg.providerMode}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  providerMode: e.target.value as RatesProviderSettings["providerMode"],
                }))
              }
            >
              <option value="harem">Harem</option>
              <option value="demo">Demo</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Sepet yenileme dakikası</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={60}
              value={cfg.cartRefreshMinutes}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  cartRefreshMinutes: clamp(Number(e.target.value || 3), 1, 60),
                }))
              }
              disabled={!cfg.ratesEnabled || !cfg.cartRatesAutoRefresh}
            />
          </label>
<label className={styles.field}>
  <span className={styles.label}>Yenileme geri sayımı (sn)</span>
  <input
    className={styles.input}
    type="number"
    min={5}
    max={86400}
    value={cfg.refreshCountdownSeconds}
    onChange={(e) =>
      setCfg((p) => ({
        ...p,
        refreshCountdownSeconds: clamp(
          Number(e.target.value || 86400),
          5,
          86400
        ),
      }))
    }
  />
</label>
          <label className={styles.field}>
            <span className={styles.label}>Warn stale dakikası</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={2880}
              value={cfg.staleWarnMinutes}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  staleWarnMinutes: clamp(Number(e.target.value || 1440), 1, 2880),
                }))
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Critical stale dakikası</span>
            <input
              className={styles.input}
              type="number"
              min={2}
              max={4320}
              value={cfg.staleCriticalMinutes}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  staleCriticalMinutes: clamp(Number(e.target.value || 2880), 2, 4320),
                }))
              }
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Bakım mesajı</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={cfg.maintenanceMessage}
            onChange={(e) =>
              setCfg((p) => ({ ...p, maintenanceMessage: e.target.value }))
            }
            placeholder="Kur sistemi bakımda, fiyatlar kısa süreli sabitlenmiştir..."
          />
        </label>

        <div className={styles.actionRowCompact}>
          <button className={styles.btnGhostSmall} type="button" onClick={resetCfg}>
            Varsayılanlara dön
          </button>

          <button
            className={styles.btnPrimarySmall}
            type="button"
            onClick={saveCfg}
            disabled={cfgSaving}
          >
            {cfgSaving ? "Kaydediliyor…" : "Ayarları Kaydet"}
          </button>
        </div>
      </div>
    ) : null}

    {mainTab === "live" ? (
      <div className={styles.tabContent}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}>Canlı Kur Tablosu</h3>
            <p className={styles.cardSub}>
              Firestore rates/latest dokümanından canlı okunur. Marj uygulanmış fiyatlar gösterilir.
              <strong style={{marginLeft: 8, color: '#d4af37'}}>{items.length} kur</strong>
            </p>
          </div>
        </div>

        <div className={styles.filterRow}>
          <label className={styles.field}>
            <span className={styles.label}>Ara</span>
            <input
              className={styles.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="USD, EUR, gram altın..."
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Sırala</span>
            <select
              className={styles.select}
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as "code" | "buy" | "sell")
              }
            >
              <option value="code">Kod / İsim</option>
              <option value="buy">Alış (yüksek)</option>
              <option value="sell">Satış (yüksek)</option>
            </select>
          </label>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={onlyValid}
              onChange={(e) => setOnlyValid(e.target.checked)}
            />
            <span>Sayısal olanları filtrele</span>
          </label>
        </div>

       <div className={styles.ratesResponsive}>
      <div className={styles.tableDesktop}>
       <table className={styles.table}>
      <thead>
        <tr>
          <th>Kod</th>
          <th>İsim</th>
          <th className={styles.num}>Alış</th>
          <th className={styles.num}>Satış</th>
          <th>Güncelleme</th>
        </tr>
      </thead>
      <tbody>
        {items.length ? (
          items.slice(0, 200).map((it, idx) => (
            <tr key={`${s(it.code)}-${idx}`}>
              <td className={styles.code}>{s(it.code) || "—"}</td>
              <td>{s(it.name) || "—"}</td>
              <td className={styles.num}>{s(it.buy) || "—"}</td>
              <td className={styles.num}>{s(it.sell) || "—"}</td>
              <td className={styles.muted}>{fmtDateTR(it.updatedAt)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className={styles.emptyCell}>
              rates/latest içinde items boş veya filtre sonucu sıfır.
            </td>
          </tr>
        )}
         </tbody>
        </table>
       </div>

        <div className={styles.tableMobile}>
        {items.length ? (
          items.slice(0, 200).map((it, idx) => (
            <div key={`${s(it.code)}-m-${idx}`} className={styles.rateCard}>
              <div className={styles.rateCardTop}>
                <div className={styles.rateMain}>
              <div className={styles.rateCode}>{s(it.code) || "—"}</div>
              <div className={styles.rateName}>{s(it.name) || "—"}</div>
            </div>
          </div>

          <div className={styles.rateGrid}>
            <div className={styles.rateStat}>
              <span>Alış</span>
              <strong>{s(it.buy) || "—"}</strong>
            </div>

            <div className={styles.rateStat}>
              <span>Satış</span>
              <strong>{s(it.sell) || "—"}</strong>
            </div>
          </div>

          <div className={styles.rateFoot}>
            <span>Güncelleme</span>
            <b>{fmtDateTR(it.updatedAt)}</b>
          </div>
        </div>
      ))
     ) : (
      <div className={styles.emptyMobile}>
        rates/latest içinde items boş veya filtre sonucu sıfır.
      </div>
    )}
  </div>
</div>

        <div className={styles.note}>
          Bu panel ayarı yazar. Backend’in gerçekten bu ayarlara uyması için
          Functions veya refresh route aynı dokümanı okumalıdır.
        </div>
      </div>
    ) : null}
    {mainTab === "display" ? (
  <div className={styles.tabContent}>
    <div className={styles.cardHead}>
      <div>
        <h3 className={styles.cardTitle}>Kur Görünüm & Marj Yönetimi</h3>
        <p className={styles.cardSub}>
          Hangi kur görünsün, isimler ne olsun, yüzde ve sabit farklar nasıl uygulansın buradan yönet.
        </p>
      </div>

      <div className={styles.badgeRow}>
        <span className={`${styles.badge} ${displayCfg.enabled ? styles.badgeOk : styles.badgeBad}`}>
          {displayCfg.enabled ? "görünüm aktif" : "görünüm kapalı"}
        </span>
        <span className={`${styles.badge} ${displayCfg.hideAllOnStorefront ? styles.badgeWarn : styles.badgeNeutral}`}>
          {displayCfg.hideAllOnStorefront ? "storefront gizli" : "storefront açık"}
        </span>
      </div>
    </div>

    <div className={styles.formGrid}>
      <label className={styles.switchCard}>
        <input
          type="checkbox"
          checked={displayCfg.enabled}
          onChange={(e) =>
            setDisplayCfg((p) => ({ ...p, enabled: e.target.checked }))
          }
        />
        <div>
          <span className={styles.switchTitle}>Display sistemi aktif</span>
          <span className={styles.switchDesc}>
            Kur görünüm kuralları devrede olur.
          </span>
        </div>
      </label>

      <label className={styles.switchCard}>
        <input
          type="checkbox"
          checked={displayCfg.hideAllOnStorefront}
          onChange={(e) =>
            setDisplayCfg((p) => ({
              ...p,
              hideAllOnStorefront: e.target.checked,
            }))
          }
        />
        <div>
          <span className={styles.switchTitle}>Storefront’ta tümünü gizle</span>
          <span className={styles.switchDesc}>
            Web rates ekranında tüm kurlar kapanır.
          </span>
        </div>
      </label>
    </div>

    <div className={styles.filterRow}>
      <label className={styles.field}>
        <span className={styles.label}>Kur ara</span>
        <input
          className={styles.input}
          value={displaySearch}
          onChange={(e) => setDisplaySearch(e.target.value)}
          placeholder="GRAM ALTIN, USD, ONS..."
        />
      </label>
    </div>
<div className={styles.bulkBar}>
  <div className={styles.bulkTitle}>Toplu Güncelleme</div>

  <div className={styles.bulkGrid}>
    <label className={styles.field}>
      <span className={styles.label}>Alış %</span>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        value={bulkBuyPercent}
        onChange={(e) => setBulkBuyPercent(Number(e.target.value || 0))}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Satış %</span>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        value={bulkSellPercent}
        onChange={(e) => setBulkSellPercent(Number(e.target.value || 0))}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Alış sabit ek</span>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        value={bulkBuyFixed}
        onChange={(e) => setBulkBuyFixed(Number(e.target.value || 0))}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Satış sabit ek</span>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        value={bulkSellFixed}
        onChange={(e) => setBulkSellFixed(Number(e.target.value || 0))}
      />
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Uygulama tipi</span>
      <select
        className={styles.select}
        value={bulkMode}
        onChange={(e) => setBulkMode(e.target.value as "replace" | "add")}
      >
        <option value="replace">Direkt yaz</option>
        <option value="add">Mevcut değere ekle</option>
      </select>
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Kapsam</span>
      <select
        className={styles.select}
        value={bulkScope}
        onChange={(e) => setBulkScope(e.target.value as "filtered" | "visible")}
      >
        <option value="filtered">Filtrelenenlerin hepsi</option>
        <option value="visible">Sadece görünür olanlar</option>
      </select>
    </label>

    <label className={styles.field}>
      <span className={styles.label}>Öne çıkar</span>
      <select
        className={styles.select}
        value={bulkHighlight}
        onChange={(e) => setBulkHighlight(e.target.value as "keep" | "on" | "off")}
      >
        <option value="keep">Aynen bırak</option>
        <option value="on">Hepsini aç</option>
        <option value="off">Hepsini kapat</option>
      </select>
    </label>
  </div>

  <div className={styles.bulkActions}>
    <button
      type="button"
      className={styles.btnGhostSmall}
      onClick={resetBulkPercents}
    >
      Temizle
    </button>

    <button
      type="button"
      className={styles.btnPrimarySmall}
      onClick={applyBulkUpdate}
    >
      Toplu Uygula
    </button>
  </div>
</div>
    <div className={styles.displayEditorList}>
      {displayRows.length ? (
        displayRows.map(({ raw, rule }) => (
          <div key={rule.key} className={styles.displayEditorCard}>
            <div className={styles.displayEditorTop}>
              <div>
                <div className={styles.displayKey}>{rule.key}</div>
                <div className={styles.displayRawMeta}>
                  Ham alış: {s(raw?.buy)} • Ham satış: {s(raw?.sell)}
                </div>
              </div>

              <label className={styles.miniCheck}>
                <input
                  type="checkbox"
                  checked={rule.visible}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, { visible: e.target.checked })
                  }
                />
                <span>Görünsün</span>
              </label>
            </div>

            <div className={styles.displayGrid}>
              <label className={styles.field}>
                <span className={styles.label}>TR etiket</span>
                <input
                  className={styles.input}
                  value={rule.labelTr}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, { labelTr: e.target.value })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>EN etiket</span>
                <input
                  className={styles.input}
                  value={rule.labelEn}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, { labelEn: e.target.value })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Alış %</span>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  value={rule.buyPercent}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, {
                      buyPercent: Number(e.target.value || 0),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Satış %</span>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  value={rule.sellPercent}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, {
                      sellPercent: Number(e.target.value || 0),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Alış sabit ek</span>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  value={rule.buyFixed}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, {
                      buyFixed: Number(e.target.value || 0),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Satış sabit ek</span>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  value={rule.sellFixed}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, {
                      sellFixed: Number(e.target.value || 0),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Sıra</span>
                <input
                  className={styles.input}
                  type="number"
                  value={rule.sortOrder}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, {
                      sortOrder: Number(e.target.value || 9999),
                    })
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Badge metni</span>
                <input
                  className={styles.input}
                  value={rule.badgeText}
                  onChange={(e) =>
                    updateDisplayRule(rule.key, { badgeText: e.target.value })
                  }
                />
              </label>
            </div>

            <label className={styles.miniCheck}>
              <input
                type="checkbox"
                checked={rule.highlight}
                onChange={(e) =>
                  updateDisplayRule(rule.key, { highlight: e.target.checked })
                }
              />
              <span>Öne çıkar</span>
            </label>
          </div>
        ))
      ) : (
        <div className={styles.emptyMobile}>Kur kuralı bulunamadı.</div>
      )}
    </div>

    <div className={styles.actionRowCompact}>
      <button
        className={styles.btnGhostSmall}
        type="button"
        onClick={() => setDisplayCfg(DEFAULT_DISPLAY_CFG)}
      >
        Display reset
      </button>

      <button
        className={styles.btnPrimarySmall}
        type="button"
        onClick={saveDisplayCfg}
        disabled={displaySaving}
      >
        {displaySaving ? "Kaydediliyor…" : "Görünüm Ayarlarını Kaydet"}
      </button>
    </div>
  </div>
) : null}
  </section>
</div>
        </div>
      </PermissionGate>
    </AdminGate>
  );
}