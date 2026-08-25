"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

type DailyDoc = {
  id: string;
  date: string;
  pageViews: number;
  productViews: number;
  uniqueVisitors: number;
  addToCartCount: number;
  purchaseCount: number;
  appDownloadCount: number;
  appointmentRequestCount: number;
  viewedProducts: Record<string, number>;
  productTitles: Record<string, string>;
  topPages: Record<string, number>;
  visitors: Record<string, boolean>;
};

type LiveVisitor = { id: string; page?: string; email?: string | null; displayName?: string | null; online?: boolean; deviceType?: string; browser?: string; os?: string; lastSeen?: any };

function toMillis(value: any) {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

function safeNum(x: any, fb = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function parseDailyDoc(id: string, data: any): DailyDoc {
  const visitorsMap = data?.visitors && typeof data.visitors === "object" ? data.visitors : {};
  const uniqueVisitors = Object.keys(visitorsMap).length;

  return {
    id,
    date: String(data?.date || id),
    pageViews: safeNum(data?.pageViews),
    productViews: safeNum(data?.productViews),
    uniqueVisitors,
    addToCartCount: safeNum(data?.addToCartCount),
    purchaseCount: safeNum(data?.purchaseCount),
    appDownloadCount: safeNum(data?.appDownloadCount),
    appointmentRequestCount: safeNum(data?.appointmentRequestCount),
    viewedProducts:
      data?.viewedProducts && typeof data.viewedProducts === "object"
        ? data.viewedProducts
        : {},
    productTitles:
      data?.productTitles && typeof data.productTitles === "object"
        ? data.productTitles
        : {},
    topPages:
      data?.topPages && typeof data.topPages === "object"
        ? data.topPages
        : {},
    visitors: visitorsMap,
  };
}

function formatDateTR(dateStr: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return new Intl.DateTimeFormat("tr-TR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function AdminAnalyticsPanel() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [days, setDays] = useState<DailyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [liveRows, setLiveRows] = useState<LiveVisitor[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    const qy = query(
      collection(db, "analytics_daily"),
      orderBy("date", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: DailyDoc[] = snap.docs.map((d) =>
          parseDailyDoc(d.id, d.data())
        );
        setDays(list);
        setLoading(false);
        if (list.length > 0 && !selectedDay) {
          setSelectedDay(list[0].date);
        }
      },
      () => {
        setDays([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "site_visitors"), orderBy("lastSeen", "desc"), limit(100)), (snap) => {
      setLiveRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveVisitor, "id">) })));
    }, () => setLiveRows([]));
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { unsub(); window.clearInterval(timer); };
  }, [db]);

  const live = useMemo(() => liveRows.filter((v) => v.online !== false && now - toMillis(v.lastSeen) <= 45_000), [liveRows, now]);
  const livePages = useMemo(() => Object.entries(live.reduce<Record<string, number>>((acc, v) => { const key = v.page || "/"; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,6), [live]);
  const devices = useMemo(() => live.reduce<Record<string, number>>((acc, v) => { const key = v.deviceType || "unknown"; acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [live]);

  const selected = useMemo(
    () => days.find((d) => d.date === selectedDay) || null,
    [days, selectedDay]
  );

  const topProducts = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.viewedProducts)
      .map(([id, count]) => ({
        id,
        title: selected.productTitles?.[id] || id,
        count: safeNum(count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [selected]);

  const topPages = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.topPages)
      .map(([path, count]) => ({ path, count: safeNum(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [selected]);

  const totals = useMemo(() => {
    let pv = 0;
    let prodV = 0;
    const visitorIds = new Set<string>();
    let atc = 0;
    let pc = 0;
    let downloads = 0;
    let appointments = 0;
    days.forEach((d) => {
      pv += d.pageViews;
      prodV += d.productViews;
      Object.keys(d.visitors).forEach((id) => visitorIds.add(id));
      atc += d.addToCartCount;
      pc += d.purchaseCount;
      downloads += d.appDownloadCount;
      appointments += d.appointmentRequestCount;
    });
    return {
      pageViews: pv,
      productViews: prodV,
      uniqueVisitors: visitorIds.size,
      addToCartCount: atc,
      purchaseCount: pc,
      appDownloadCount: downloads,
      appointmentRequestCount: appointments,
      days: days.length,
    };
  }, [days]);

  const maxPV = useMemo(
    () => Math.max(1, ...days.map((d) => d.pageViews)),
    [days]
  );

  if (loading) {
    return <div style={S.empty}>Analitik verileri yükleniyor…</div>;
  }

  if (!days.length) {
    return (
      <div style={S.empty}>
        Henüz analitik verisi yok. Ziyaretçi trafiği başladığında burada gün gün
        görünecek.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={S.liveBoard}>
        <div style={S.liveHero}><div><span style={S.liveDot} /> CANLI TRAFİK</div><strong>{live.length}</strong><small>son 45 saniyede aktif ziyaretçi</small></div>
        <div style={S.liveDetails}><div style={S.liveList}><b>Aktif sayfalar</b>{livePages.length ? livePages.map(([path,count]) => <span key={path}><code>{path}</code><strong>{count}</strong></span>) : <small>Şu an aktif ziyaretçi yok.</small>}</div><div style={S.liveList}><b>Cihaz dağılımı</b><span><code>Masaüstü</code><strong>{devices.desktop || 0}</strong></span><span><code>Mobil</code><strong>{devices.mobile || 0}</strong></span><span><code>Tablet</code><strong>{devices.tablet || 0}</strong></span></div></div>
      </div>
      {/* Summary Strip */}
      <div style={S.summaryStrip}>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Son {totals.days} Gün</div>
          <div style={S.summaryValue}>{totals.pageViews.toLocaleString("tr-TR")}</div>
          <div style={S.summaryUnit}>toplam sayfa görüntüleme</div>
        </div>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Tekil Ziyaretçi</div>
          <div style={S.summaryValue}>{totals.uniqueVisitors.toLocaleString("tr-TR")}</div>
          <div style={S.summaryUnit}>cookie bazlı tekil</div>
        </div>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Ürün İnceleme</div>
          <div style={S.summaryValue}>{totals.productViews.toLocaleString("tr-TR")}</div>
          <div style={S.summaryUnit}>toplam detay açılışı</div>
        </div>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Sepete Ekleme</div>
          <div style={S.summaryValue}>{totals.addToCartCount.toLocaleString("tr-TR")}</div>
          <div style={S.summaryUnit}>sepete ekleme</div>
        </div>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Satın Alma</div>
          <div style={S.summaryValue}>{totals.purchaseCount.toLocaleString("tr-TR")}</div>
          <div style={S.summaryUnit}>
            {totals.pageViews > 0
              ? `%${((totals.purchaseCount / totals.pageViews) * 100).toFixed(1)} dönüşüm`
              : "dönüşüm"}
          </div>
        </div>
        <div style={S.summaryItem}>
          <div style={S.summaryLabel}>Günlük Ort.</div>
          <div style={S.summaryValue}>
            {totals.days > 0
              ? Math.round(totals.pageViews / totals.days).toLocaleString("tr-TR")
              : "—"}
          </div>
          <div style={S.summaryUnit}>sayfa / gün</div>
        </div>
        <div style={S.summaryItem}><div style={S.summaryLabel}>Uygulama İndirme</div><div style={S.summaryValue}>{totals.appDownloadCount.toLocaleString("tr-TR")}</div><div style={S.summaryUnit}>App Store tıklaması</div></div>
        <div style={S.summaryItem}><div style={S.summaryLabel}>Randevu Talebi</div><div style={S.summaryValue}>{totals.appointmentRequestCount.toLocaleString("tr-TR")}</div><div style={S.summaryUnit}>başarılı gönderim</div></div>
      </div>

      {/* Daily Chart */}
      <div style={S.card}>
        <div style={S.cardTitle}>📊 Günlük Ziyaretçi Grafiği</div>
        <div style={S.cardSub}>Son {days.length} gün — bara tıkla detay gör</div>

        <div style={S.chartArea}>
          {[...days].reverse().map((d) => {
            const pct = Math.max(4, Math.round((d.pageViews / maxPV) * 100));
            const isSelected = d.date === selectedDay;
            return (
              <div
                key={d.date}
                style={S.barCol}
                onClick={() => setSelectedDay(d.date)}
                title={`${formatDateTR(d.date)}\n${d.pageViews} sayfa görüntüleme\n${d.productViews} ürün inceleme`}
              >
                <div style={S.barLabel}>{d.pageViews}</div>
                <div
                  style={{
                    ...S.bar,
                    height: `${pct}%`,
                    background: isSelected
                      ? "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)"
                      : "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)",
                    boxShadow: isSelected
                      ? "0 4px 16px rgba(59,130,246,0.35)"
                      : "0 2px 6px rgba(59,130,246,0.12)",
                    transform: isSelected ? "scaleX(1.1)" : "scaleX(1)",
                  }}
                />
                <div style={S.barDate}>
                  {d.date.slice(5).replace("-", "/")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Dönüşüm Hunisi</div><div style={S.cardSub}>Ürün keşfinden satın almaya kadar son {totals.days} gün</div>
        <div style={S.funnel}>{[{label:"Sayfa görüntüleme",value:totals.pageViews,color:"#3b82f6"},{label:"Ürün inceleme",value:totals.productViews,color:"#8b5cf6"},{label:"Sepete ekleme",value:totals.addToCartCount,color:"#f59e0b"},{label:"Satın alma",value:totals.purchaseCount,color:"#10b981"}].map((row) => <div key={row.label}><span style={S.funnelMeta}>{row.label}<b>{row.value.toLocaleString("tr-TR")}</b></span><i style={S.funnelTrack}><em style={{display:"block",height:"100%",borderRadius:999,width:`${Math.max(row.value ? 4 : 0,Math.round((row.value/Math.max(1,totals.pageViews))*100))}%`,background:row.color}} /></i></div>)}</div>
      </div>

      {/* Selected Day Details */}
      {selected ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          {/* Top Products */}
          <div style={S.card}>
            <div style={S.cardTitle}>
              🏆 En Çok İncelenen Ürünler
            </div>
            <div style={S.cardSub}>{formatDateTR(selected.date)}</div>

            {topProducts.length === 0 ? (
              <div style={S.emptySmall}>
                Bu gün ürün incelemesi kaydedilmemiş.
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                {topProducts.map((item, i) => {
                  const maxC = topProducts[0]?.count || 1;
                  const pct = Math.max(8, Math.round((item.count / maxC) * 100));
                  return (
                    <div key={item.id} style={S.rankRow}>
                      <div style={S.rankNum}>#{i + 1}</div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={S.rankTitle}>{item.title}</div>
                        <div style={S.rankTrack}>
                          <div
                            style={{
                              ...S.rankFill,
                              width: `${pct}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div style={S.rankCount} title="Toplam detay sayfası açılış sayısı">{item.count} görüntüleme</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Pages */}
          <div style={S.card}>
            <div style={S.cardTitle}>📄 En Çok Ziyaret Edilen Sayfalar</div>
            <div style={S.cardSub}>{formatDateTR(selected.date)}</div>

            {topPages.length === 0 ? (
              <div style={S.emptySmall}>Bu gün sayfa verisi yok.</div>
            ) : (
              <div style={{ marginTop: 14 }}>
                {topPages.map((item, i) => {
                  const maxC = topPages[0]?.count || 1;
                  const pct = Math.max(8, Math.round((item.count / maxC) * 100));
                  return (
                    <div key={item.path} style={S.rankRow}>
                      <div style={S.rankNum}>#{i + 1}</div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={S.rankTitle}>{item.path}</div>
                        <div style={S.rankTrack}>
                          <div
                            style={{
                              ...S.rankFill,
                              width: `${pct}%`,
                              background:
                                "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)",
                            }}
                          />
                        </div>
                      </div>
                      <div style={S.rankCount}>{item.count} görüntüleme</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══ Inline styles ═══ */
const S: Record<string, React.CSSProperties> = {
  liveBoard: { display: "grid", gridTemplateColumns: "minmax(210px,.65fr) 1.35fr", gap: 14, padding: 18, borderRadius: 25, color: "#fff", background: "radial-gradient(circle at 10% 0,rgba(59,130,246,.28),transparent 35%),linear-gradient(135deg,#071222,#132947)", boxShadow: "0 22px 55px rgba(7,18,34,.2)" },
  liveHero: { display: "flex", flexDirection: "column", justifyContent: "center", padding: 16, borderRadius: 18, background: "rgba(255,255,255,.055)", color: "rgba(255,255,255,.65)", fontSize: 10, fontWeight: 900, letterSpacing: ".12em" },
  liveDot: { display: "inline-block", width: 9, height: 9, marginRight: 7, borderRadius: "50%", background: "#2dd47d", boxShadow: "0 0 16px #2dd47d" },
  liveDetails: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  liveList: { display: "flex", flexDirection: "column", gap: 7, padding: 14, borderRadius: 16, background: "rgba(255,255,255,.055)" },
  funnel: { display: "grid", gap: 13, marginTop: 18 },
  funnelMeta: { display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#475569", fontSize: 12, fontWeight: 800 },
  funnelTrack: { display: "block", height: 12, overflow: "hidden", borderRadius: 999, background: "#eef2f7" },
  empty: {
    padding: 32,
    borderRadius: 20,
    border: "1px dashed rgba(148,163,184,0.4)",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center" as const,
  },
  emptySmall: {
    padding: "18px 12px",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center" as const,
  },
  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  summaryItem: {
    padding: "20px 18px",
    borderRadius: 20,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
    lineHeight: 1,
  },
  summaryUnit: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginTop: 4,
  },
  card: {
    padding: 22,
    borderRadius: 24,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#fff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    marginBottom: 14,
  },
  chartArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
    height: 200,
    overflow: "auto",
    paddingBottom: 4,
  },
  barCol: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    flex: "1 1 0",
    minWidth: 28,
    cursor: "pointer",
    height: "100%",
    justifyContent: "flex-end" as const,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
  },
  bar: {
    width: "100%",
    maxWidth: 32,
    borderRadius: "8px 8px 4px 4px",
    transition: "height 0.3s ease, background 0.3s ease, transform 0.2s ease",
  },
  barDate: {
    fontSize: 9,
    fontWeight: 700,
    color: "#94a3b8",
    whiteSpace: "nowrap" as const,
  },
  rankRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid rgba(15,23,42,0.04)",
  },
  rankNum: {
    fontSize: 12,
    fontWeight: 900,
    color: "#94a3b8",
    minWidth: 28,
  },
  rankTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.35,
    wordBreak: "break-word" as const,
    marginBottom: 4,
  },
  rankTrack: {
    height: 6,
    borderRadius: 999,
    background: "rgba(15,23,42,0.04)",
    overflow: "hidden" as const,
  },
  rankFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)",
    transition: "width 0.3s ease",
  },
  rankCount: {
    fontSize: 13,
    fontWeight: 900,
    color: "#1d4ed8",
    minWidth: 40,
    textAlign: "right" as const,
  },
};
