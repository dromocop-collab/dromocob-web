"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listenRatesLatest, type RatesLatest } from "@/lib/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { fmt } from "@/lib/format";
import s from "./ratesTable.module.css";
type PublicRatesSettings = {
  ratesEnabled?: boolean;
  storefrontRatesVisible?: boolean;
  showRatesOnPublic?: boolean;
  cartRatesAutoRefresh?: boolean;
  cartRefreshMinutes?: number;
  providerMode?: string;
  freezeRates?: boolean;
  staleWarnMinutes?: number;
  staleCriticalMinutes?: number;
  maintenanceMessage?: string;
  refreshCountdownSeconds?: number;
};
type RateDisplayRule = {
  key: string;
  visible?: boolean;
  labelTr?: string;
  labelEn?: string;
  buyPercent?: number;
  sellPercent?: number;
  buyFixed?: number;
  sellFixed?: number;
  sortOrder?: number;
  highlight?: boolean;
  badgeText?: string;
};

type RatesDisplaySettings = {
  enabled?: boolean;
  hideAllOnStorefront?: boolean;
  rules?: Record<string, RateDisplayRule>;
};
type DisplayRateRow = {
  id: string;
  rawKey: string;
  code?: string;
  name?: string;
  label: {
    tr?: string;
    en?: string;
  };
  buy: number;
  sell: number;
  percent?: number;
  arrow?: string;
  sortOrder: number;
  highlight: boolean;
  badgeText: string;
};
const T = (loc: Locale) => (loc === "tr" ? (tr as any) : (en as any));

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pickLabel(item: { label?: { tr?: string; en?: string }; rawKey?: string; id?: string }, loc: Locale) {
  return item.label?.[loc] ?? item.rawKey ?? item.id ?? "";
}

function trendIcon(arrow: string) {
  const a = String(arrow || "").toLowerCase();
  if (a === "up") return "▲";
  if (a === "down") return "▼";
  return "•";
}
function toNumSafe(v: any) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function applyAdjustment(raw: any, percent = 0, fixed = 0) {
  const base = toNumSafe(raw);
  const p = toNumSafe(percent);
  const f = toNumSafe(fixed);
  return Number((base + (base * p) / 100 + f).toFixed(2));
}


type ViewMode = "cards" | "table";

export default function RatesTable() {
  
  const [loc, setLoc] = useState<Locale>("tr");
  const [data, setData] = useState<RatesLatest | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<ViewMode>("cards");
  const [refreshing, setRefreshing] = useState(false);
const lastRefreshBucketRef = useRef<string>("");
  const [nowTick, setNowTick] = useState(Date.now());
const db = useMemo(() => getFirebaseDb(), []);
const [displayCfg, setDisplayCfg] = useState<RatesDisplaySettings | null>(null);
function normalizeDisplayCfg(raw: any): RatesDisplaySettings {
  const d = raw && typeof raw === "object" ? raw : {};

  const hasRulesObject =
    d.rules && typeof d.rules === "object" && !Array.isArray(d.rules);

  if (hasRulesObject) {
    return {
      enabled: d.enabled !== false,
      hideAllOnStorefront: d.hideAllOnStorefront === true,
      rules: d.rules || {},
    };
  }

  const reserved = new Set([
    "enabled",
    "hideAllOnStorefront",
    "updatedAt",
    "updatedBy",
  ]);

  const liftedRules: Record<string, RateDisplayRule> = {};

  Object.entries(d).forEach(([key, value]) => {
    if (reserved.has(key)) return;
    if (!value || typeof value !== "object" || Array.isArray(value)) return;

    liftedRules[key] = {
      key,
      visible: (value as any).visible !== false,
      labelTr: String((value as any).labelTr || key),
      labelEn: String((value as any).labelEn || key),
      buyPercent: Number((value as any).buyPercent ?? 0),
      sellPercent: Number((value as any).sellPercent ?? 0),
      buyFixed: Number((value as any).buyFixed ?? 0),
      sellFixed: Number((value as any).sellFixed ?? 0),
      sortOrder: Number((value as any).sortOrder ?? 9999),
      highlight: (value as any).highlight === true,
      badgeText: String((value as any).badgeText || ""),
    };
  });

  return {
    enabled: d.enabled !== false,
    hideAllOnStorefront: d.hideAllOnStorefront === true,
    rules: liftedRules,
  };
}
const [settings, setSettings] = useState<PublicRatesSettings | null>(null);
const refreshCountdownSeconds = Math.max(
  5,
  Number(settings?.refreshCountdownSeconds ?? 60)
);
  const tickRef = useRef<number | null>(null);

useEffect(() => {
  setLoc(getLocale());

  const onLocaleChanged = (e: any) => setLoc(e.detail as Locale);
  window.addEventListener("locale-changed", onLocaleChanged);

  const unsubRates = listenRatesLatest(setData);

const unsubSettings = onSnapshot(
  doc(db, "settings", "rates_provider"),
  (snap) => {
    const raw = snap.exists() ? (snap.data() as PublicRatesSettings) : null;
    setSettings(raw);
  },
  () => {
    setSettings(null);
  }
);

  tickRef.current = window.setInterval(() => setNowTick(Date.now()), 1000) as any;

  return () => {
    window.removeEventListener("locale-changed", onLocaleChanged);
    unsubRates();
    unsubSettings();
    if (tickRef.current) window.clearInterval(tickRef.current);
  };
}, [db]);
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, "settings", "rates_display"),
    (snap) => {
      const raw = snap.exists() ? snap.data() : null;
      setDisplayCfg(normalizeDisplayCfg(raw));
    },
    () => {
      setDisplayCfg({
        enabled: true,
        hideAllOnStorefront: false,
        rules: {},
      });
    }
  );

  return () => unsub();
}, [db]);
  const msg = T(loc);

  const fetchedAtDate = useMemo(() => toDateAny((data as any)?.fetchedAt), [data]);

  const ageSec = useMemo(() => {
    if (!fetchedAtDate) return null;
    const diff = Math.floor((nowTick - fetchedAtDate.getTime()) / 1000);
    return diff < 0 ? 0 : diff;
  }, [nowTick, fetchedAtDate]);

const nextInSec = useMemo(() => {
  if (ageSec == null) return null;
  const mod = ageSec % refreshCountdownSeconds;
  const remain = refreshCountdownSeconds - mod;
  return remain === 0 ? refreshCountdownSeconds : remain;
}, [ageSec, refreshCountdownSeconds]);

const allRows = useMemo<DisplayRateRow[]>(() => {
  const src: any = (data as any)?.items ?? (data as any)?.itemsArray ?? [];
  const items: any[] = Array.isArray(src) ? src : Object.values(src ?? {});
const useDisplayAdjustments = false;
  const rules = displayCfg?.rules || {};
  const displayEnabled = displayCfg?.enabled !== false;
  const hideAll = displayCfg?.hideAllOnStorefront === true;

  if (!displayEnabled || hideAll) return [];

  const mapped: DisplayRateRow[] = [];

  items.forEach((item, index) => {
    const rawKey = String(
      item?.rawKey ?? item?.code ?? item?.name ?? item?.id ?? `rate-${index}`
    ).trim();

    const rule = rules[rawKey];

    if (rule?.visible === false) return;

    const labelTr =
      rule?.labelTr ||
      item?.label?.tr ||
      item?.name ||
      item?.code ||
      rawKey;

    const labelEn =
      rule?.labelEn ||
      item?.label?.en ||
      item?.name ||
      item?.code ||
      rawKey;

    mapped.push({
      id: String(item?.id ?? rawKey ?? `rate-${index}`),
      rawKey,
      code: item?.code ? String(item.code) : undefined,
      name: item?.name ? String(item.name) : undefined,
      label: {
        tr: String(labelTr),
        en: String(labelEn),
      },
   buy: useDisplayAdjustments
  ? applyAdjustment(item?.buy, rule?.buyPercent ?? 0, rule?.buyFixed ?? 0)
  : toNumSafe(item?.buy),

sell: useDisplayAdjustments
  ? applyAdjustment(item?.sell, rule?.sellPercent ?? 0, rule?.sellFixed ?? 0)
  : toNumSafe(item?.sell),
      percent: toNumSafe(item?.percent),
      arrow: String(item?.arrow ?? ""),
      sortOrder: Number(rule?.sortOrder ?? 9999),
      highlight: rule?.highlight === true,
      badgeText: String(rule?.badgeText ?? ""),
    });
  });

  mapped.sort((a, b) => {
    const ao = Number(a.sortOrder ?? 9999);
    const bo = Number(b.sortOrder ?? 9999);
    if (ao !== bo) return ao - bo;

    const al = pickLabel(a, loc).toLocaleLowerCase();
    const bl = pickLabel(b, loc).toLocaleLowerCase();
    return al.localeCompare(bl, loc);
  });

  return mapped;
}, [data, displayCfg, loc]);

const rows = useMemo<DisplayRateRow[]>(() => {
  const search = q.trim().toLowerCase();
  if (!search) return allRows;

  return allRows.filter((r) => {
    const name = pickLabel(r, loc).toLowerCase();
    const key = String(r.rawKey || "").toLowerCase();
    return name.includes(search) || key.includes(search);
  });
}, [allRows, q, loc]);

const ratesEnabled = settings?.ratesEnabled !== false;
const showRatesOnPublic =
  settings?.showRatesOnPublic !== false &&
  settings?.storefrontRatesVisible !== false;
const freezeRates = settings?.freezeRates === true;
const maintenanceMessage =
  String(settings?.maintenanceMessage || "").trim() ||
  "Kur sistemi bakımda, fiyatlar kısa süreli sabitlenmiştir.";

const warnMinutes = Number(settings?.staleWarnMinutes ?? 10);
const criticalMinutes = Number(settings?.staleCriticalMinutes ?? 30);

const liveOk =
  ratesEnabled &&
  !freezeRates &&
  ageSec != null &&
  ageSec <= warnMinutes * 60;

const liveWarn =
  ratesEnabled &&
  !freezeRates &&
  ageSec != null &&
  ageSec > warnMinutes * 60 &&
  ageSec <= criticalMinutes * 60;

const liveText = !ratesEnabled || freezeRates
  ? "durduruldu"
  : ageSec == null
  ? "-"
  : ageSec < 60
  ? `${ageSec}s`
  : `${Math.floor(ageSec / 60)}m ${ageSec % 60}s`;

const nextRefreshText =
  !ratesEnabled || freezeRates || nextInSec == null ? null : `${nextInSec}s`;
  useEffect(() => {
  if (!ratesEnabled || freezeRates) return;
  if (refreshing) return;
  if (nextInSec == null) return;

  // Son 1 saniyede bir kez tetikle
  if (nextInSec > 1) return;

  // Aynı fetchedAt için tekrar tekrar tetiklemeyi engelle
  const bucketKey = `${data?.provider || "x"}-${(data as any)?.fetchedAt || "no-date"}`;
  if (lastRefreshBucketRef.current === bucketKey) return;

  lastRefreshBucketRef.current = bucketKey;
  setRefreshing(true);

  fetch("/api/rates/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
    .then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
    })
    .catch((err) => {
      console.error("rates refresh error:", err);
    })
    .finally(() => {
      setRefreshing(false);
    });
}, [nextInSec, ratesEnabled, freezeRates, refreshing, data]);
if (!showRatesOnPublic) {
  return (
    <section className={s.wrap}>
      <div className={s.emptyState}>
        Bu sayfada kur görünümü şu anda kapalı.
      </div>
    </section>
  );
}
if (!ratesEnabled || freezeRates) {
  return (
    <section className={s.wrap}>
      <div className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.titleRow}>
            <h1 className={s.title}>{msg.rates_title ?? "Kurlar"}</h1>
            <span className={`${s.livePill} ${s.liveOff}`}>
              <span className={s.dot} />
              bakım
            </span>
          </div>

          <div className={s.sub}>
            <span>{maintenanceMessage}</span>
          </div>
        </div>
      </div>

      <div className={s.maintenanceCard}>
        <div className={s.maintenanceTitle}>Kur sistemi şu anda aktif değil</div>
        <div className={s.maintenanceText}>
          Yönetici panelinden tekrar açılana kadar canlı kur tablosu ve sayaç gösterilmez.
        </div>
      </div>
    </section>
  );
}
  if (!data) {
    return (
      <section className={s.wrap}>
        <div className={s.emptyState}>{msg.loading ?? "Yükleniyor…"}</div>
      </section>
    );
  }

  return (
    <section className={s.wrap}>
      <div className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.titleRow}>
            <h1 className={s.title}>{msg.rates_title ?? "Kurlar"}</h1>

            <span
              className={`${s.livePill} ${
                liveOk ? s.liveOk : liveWarn ? s.liveWarn : s.liveOff
              }`}
            >
              <span className={s.dot} />
              {liveOk
                ? msg.live ?? "Canlı"
                : liveWarn
                ? msg.live ?? "Canlı"
                : msg.offline ?? "Gecikmeli"}
            </span>
          </div>

          <div className={s.subRow}>
  <div className={s.infoChip}>
    <span className={s.infoLabel}>{msg.last_update ?? "Son güncelleme"}</span>
    <b className={s.infoValue}>{fetchedAtDate ? fetchedAtDate.toLocaleString() : "-"}</b>
  </div>

  <div className={s.infoChip}>
    <span className={s.infoLabel}>Provider</span>
    <b className={s.infoValue}>{data.provider ?? "-"}</b>
  </div>

  <div className={s.infoChip}>
    <span className={s.infoLabel}>{msg.age ?? "Yaş"}</span>
    <b className={s.infoValue}>{liveText}</b>
  </div>

  {nextRefreshText ? (
    <div className={`${s.infoChip} ${s.infoChipAccent}`}>
      <span className={s.infoLabel}>{msg.next_refresh ?? "Yenileme"}</span>
      <b className={s.infoValue}>{nextRefreshText}</b>
    </div>
  ) : null}
</div>
          </div>

        <div className={s.controls}>
          <div className={s.searchWrap}>
            <input
              className={s.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={msg.search_placeholder ?? "Ara: gram, çeyrek, usd..."}
            />
          </div>

          <div className={s.seg}>
            <button
              type="button"
              className={mode === "cards" ? s.active : ""}
              onClick={() => setMode("cards")}
            >
              {msg.cards ?? "Kart"}
            </button>
            <button
              type="button"
              className={mode === "table" ? s.active : ""}
              onClick={() => setMode("table")}
            >
              {msg.table ?? "Tablo"}
            </button>
          </div>

          <div className={s.count}>
            {rows.length} / {allRows.length}
          </div>
        </div>
      </div>

      {mode === "cards" ? (
        <div className={s.grid}>
          {rows.map((r) => {
            const label = pickLabel(r, loc);
            const arrow = String(r.arrow || "").toLowerCase();
            const up = arrow === "up";
            const down = arrow === "down";
            const pct = r.percent ?? 0;

            return (
              <article
                key={r.id}
                className={`${s.rateCard} ${up ? s.up : down ? s.down : s.flat}`}
              >
                <div className={s.rateTop}>
                  <div className={s.rateName}>{label}</div>
                 <div
  className={`${s.badge} ${
    up ? s.badgeUp : down ? s.badgeDown : s.badgeFlat
  }`}
>
  <span
    className={`${s.trendArrow} ${
      up ? s.trendArrowUp : down ? s.trendArrowDown : s.trendArrowFlat
    }`}
  >
    {trendIcon(r.arrow || "")}
  </span>
  <span>{fmt(pct)}%</span>
</div>
                </div>

                <div className={s.sellOnlyWrap}>
  <div className={s.sellOnlyBox}>
    <div className={s.sellOnlyLabel}>{msg.sell ?? "Satış"}</div>
    <div className={s.sellOnlyValue}>{fmt(r.sell)}</div>
  </div>
</div>

                <div className={s.metaRow}>
                  <span className={s.metaKey}>{r.rawKey ?? r.id}</span>
                  <span className={s.metaLabel}>{label}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
             <tr>
              <th>#</th>
              <th>{msg.item ?? "Kalem"}</th>
              <th className={s.num}>{msg.sell ?? "Satış"}</th>
              <th className={s.num}>{msg.change ?? "%"}</th>
              <th className={s.num}>{msg.trend ?? "Trend"}</th>
            </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const arrow = String(r.arrow || "").toLowerCase();
                const up = arrow === "up";
                const down = arrow === "down";

                return (
                 <tr
                  key={r.id}
                  className={up ? s.rowUp : down ? s.rowDown : ""}
                >
                  <td className={s.mono}>{idx + 1}</td>
                  <td>
                    <div className={s.tdName}>{pickLabel(r, loc)}</div>
                    <div className={s.tdSub}>{r.rawKey ?? r.id}</div>
                  </td>
                  <td className={s.num}>{fmt(r.sell)}</td>
                  <td className={s.num}>{fmt(r.percent)}%</td>
                  <td className={s.num}>
                    <span
                      className={`${s.trendArrow} ${
                        up ? s.trendArrowUp : down ? s.trendArrowDown : s.trendArrowFlat
                      }`}
                    >
                      {trendIcon(r.arrow || "")}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}