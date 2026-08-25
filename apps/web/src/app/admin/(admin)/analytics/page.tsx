"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

/* ──────── Types ──────── */
type DailyDoc = {
  id: string;
  date: string;
  pageViews: number;
  productViews: number;
  uniqueUsers: number;
  anonVisitors: number;
  uniqueVisitors: number;
  addToCartCount: number;
  purchaseCount: number;
  purchaseRevenue: number;
  viewedProducts: Record<string, number>;
  productTitles: Record<string, string>;
  topPages: Record<string, number>;
};

type VisitorDoc = {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  page?: string;
  locale?: string;
  screenWidth?: number;
  lastSeen?: any;
  online?: boolean;
  deviceType?: string;
  browser?: string;
  os?: string;
};

/* ──────── Helpers ──────── */
function safeNum(x: any, fb = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function toDate(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (typeof x?.toDate === "function") return x.toDate();
  if (typeof x === "string") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function minutesAgo(dt: Date | null) {
  if (!dt) return null;
  return Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
}
function getMapField(data: any, key: string): Record<string, any> {
  const direct = data?.[key];

  // Normal map olarak geldiyse
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }

  // Firestore bazen "topPages./shop" gibi düz key olarak dönerse
  const out: Record<string, any> = {};
  const prefix = `${key}.`;

  Object.keys(data || {}).forEach((fieldKey) => {
    if (fieldKey.startsWith(prefix)) {
      const realKey = fieldKey.slice(prefix.length);
      out[realKey] = data[fieldKey];
    }
  });

  return out;
}
function parseDailyDoc(id: string, data: any): DailyDoc {
  // Tekil ziyaretçi: visitors map'inin key sayısı VEYA numeric uniqueVisitors alanı
  const visitorsMap = data?.visitors && typeof data.visitors === "object" ? data.visitors : {};
  const mapCount = Object.keys(visitorsMap).length;
  const numericCount = safeNum(data?.uniqueVisitors);
  // En büyük değeri kullan (map ve numeric alanı paralel çalışıyor)
  const uniqueVisitors = mapCount > 0 ? mapCount : numericCount;

  return {
    id,
    date: String(data?.date || id),
    pageViews: safeNum(data?.pageViews),
    productViews: safeNum(data?.productViews),
    uniqueUsers: safeNum(data?.uniqueUsers),
    anonVisitors: safeNum(data?.anonVisitors),
    uniqueVisitors,
    addToCartCount: safeNum(data?.addToCartCount),
    purchaseCount: safeNum(data?.purchaseCount),
    purchaseRevenue: safeNum(data?.purchaseRevenue),
    viewedProducts: getMapField(data, "viewedProducts"),
    productTitles: getMapField(data, "productTitles"),
    topPages: getMapField(data, "topPages"),
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

function shortDate(dateStr: string) {
  return dateStr.slice(5).replace("-", "/");
}

function fmtNum(n: number) {
  return n.toLocaleString("tr-TR");
}

/* ──────── Page ──────── */
export default function AdminAnalyticsPage() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [days, setDays] = useState<DailyDoc[]>([]);
  const [rawVisitors, setRawVisitors] = useState<Array<{ id: string } & VisitorDoc>>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Günlük analitik verileri ──
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
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aktif ziyaretçiler (realtime) ──
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "site_visitors"), orderBy("lastSeen", "desc"), limit(50)),
      (snap) => {
        const arr: Array<{ id: string } & VisitorDoc> = [];
        snap.forEach((d) => {
          const v = d.data() as VisitorDoc;
          arr.push({ id: d.id, ...v });
        });
        setRawVisitors(arr);
      }
    );
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { unsub(); window.clearInterval(timer); };
  }, [db]);

  const visitors = useMemo(() => rawVisitors.filter((v) => {
    const last = toDate(v.lastSeen);
    return v.online !== false && !!last && now - last.getTime() <= 45_000;
  }), [rawVisitors, now]);

  const selected = useMemo(
    () => days.find((d) => d.date === selectedDay) || null,
    [days, selectedDay]
  );

  const topProducts = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.viewedProducts)
      .map(([slug, count]) => ({
        slug,
        title: selected.productTitles?.[slug] || slug.replace(/_/g, "."),
        count: safeNum(count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [selected]);

  const topPages = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.topPages)
      .map(([path, count]) => ({
        path: path.replace(/_/g, ".").replace(/^\//, "/"),
        count: safeNum(count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [selected]);

  const totals = useMemo(() => {
    let pv = 0;
    let prodV = 0;
    let users = 0;
    let anon = 0;
    let uv = 0;
    let atc = 0;
    let pc = 0;
    let rev = 0;
    days.forEach((d) => {
      pv += d.pageViews;
      prodV += d.productViews;
      users += d.uniqueUsers;
      anon += d.anonVisitors;
      uv += d.uniqueVisitors;
      atc += d.addToCartCount;
      pc += d.purchaseCount;
      rev += d.purchaseRevenue;
    });
    return {
      pageViews: pv,
      productViews: prodV,
      uniqueUsers: users,
      anonVisitors: anon,
      uniqueVisitors: uv,
      addToCartCount: atc,
      purchaseCount: pc,
      purchaseRevenue: rev,
      days: days.length,
    };
  }, [days]);

  const maxPV = useMemo(
    () => Math.max(1, ...days.map((d) => d.pageViews)),
    [days]
  );

  const loggedInVisitors = visitors.filter((v) => v.email);
  const anonVisitors = visitors.filter((v) => !v.email);

  return (
    <main style={S.page}>
      {/* ── Header ── */}
      <div style={S.headerRow}>
        <div>
          <Link href="/admin" style={S.backLink}>← Dashboard</Link>
          <h1 style={S.h1}>📊 Site Analitik</h1>
          <p style={S.subtitle}>Gün gün ziyaretçi trafiği, en çok görüntülenen sayfalar ve ürünler</p>
        </div>
      </div>

      {/* ── Canlı Ziyaretçiler ── */}
      <section style={S.liveSection}>
        <div style={S.liveHeader}>
          <span style={S.liveDot} />
          <span style={S.liveTitle}>Şu An Sitede</span>
          <span style={S.liveCount}>{visitors.length}</span>
        </div>

        <div style={S.liveGrid}>
          <div style={S.liveCard}>
            <div style={S.liveCardLabel}>Üye</div>
            <div style={S.liveCardValue}>{loggedInVisitors.length}</div>
          </div>
          <div style={S.liveCard}>
            <div style={S.liveCardLabel}>Misafir</div>
            <div style={S.liveCardValue}>{anonVisitors.length}</div>
          </div>
        </div>

        {visitors.length > 0 && (
          <div style={S.visitorTable}>
            {visitors.slice(0, 12).map((v) => {
              const name = v.displayName || v.email || (v.isAnonymous !== false ? "Misafir" : "Kullanıcı");
              const ago = minutesAgo(toDate(v.lastSeen));
              const agoText = ago === 0 ? "Şimdi" : `${ago} dk önce`;

              return (
                <div key={v.id} style={S.visitorRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.visitorName}>
                      <span style={S.liveDotSmall} />
                      {name}
                    </div>
                    {v.email && <div style={S.visitorEmail}>{v.email}</div>}
                  </div>
                  <div style={S.visitorPage}>{v.page || "/"}</div>
                  <div style={S.visitorTime}>{agoText}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Toplam Özet ── */}
      {loading ? (
        <div style={S.empty}>Analitik verileri yükleniyor…</div>
      ) : !days.length ? (
        <div style={S.empty}>
          Henüz analitik verisi yok. Siteye ziyaretçi geldikçe burada gün gün görünecek.
          <br />
          <small style={{ opacity: 0.7 }}>Not: Veriler ilk ziyaretçiden itibaren otomatik toplanır.</small>
        </div>
      ) : (
        <>
          <section style={S.summaryStrip}>
            <div style={S.summaryItem}>
              <div style={S.summaryLabel}>Son {totals.days} Gün</div>
              <div style={S.summaryValue}>{fmtNum(totals.pageViews)}</div>
              <div style={S.summaryUnit}>toplam sayfa görüntüleme</div>
            </div>
            <div style={S.summaryItem}>
              <div style={S.summaryLabel}>Tekil Ziyaretçi</div>
              <div style={S.summaryValue}>{fmtNum(totals.uniqueVisitors)}</div>
              <div style={S.summaryUnit}>cookie bazlı tekil</div>
            </div>
            <div style={S.summaryItem}>
              <div style={S.summaryLabel}>Ürün İnceleme</div>
              <div style={S.summaryValue}>{fmtNum(totals.productViews)}</div>
              <div style={S.summaryUnit}>toplam detay sayfası açılışı</div>
            </div>
            <div style={S.summaryItem}>
              <div style={S.summaryLabel}>Sepete Ekleme</div>
              <div style={S.summaryValue}>{fmtNum(totals.addToCartCount)}</div>
              <div style={S.summaryUnit}>sepete ekleme</div>
            </div>
            <div style={S.summaryItem}>
              <div style={S.summaryLabel}>Satın Alma</div>
              <div style={S.summaryValue}>{fmtNum(totals.purchaseCount)}</div>
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
                  ? fmtNum(Math.round(totals.pageViews / totals.days))
                  : "—"}
              </div>
              <div style={S.summaryUnit}>sayfa / gün</div>
            </div>
          </section>

          {/* ── Günlük Grafik ── */}
          <section style={S.card}>
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
                    title={`${formatDateTR(d.date)}\n${d.pageViews} sayfa görüntüleme\n${d.productViews} ürün inceleme\n${d.uniqueUsers} üye • ${d.anonVisitors} misafir`}
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
                        transform: isSelected ? "scaleX(1.15)" : "scaleX(1)",
                      }}
                    />
                    <div style={S.barDate}>{shortDate(d.date)}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Seçilen Gün Detayı ── */}
          {selected && (
            <>
              <div style={S.dayHeader}>
                <div style={S.dayTitle}>{formatDateTR(selected.date)}</div>
                <div style={S.dayMeta}>
                  {fmtNum(selected.pageViews)} sayfa • {fmtNum(selected.uniqueVisitors)} tekil ziyaretçi • {fmtNum(selected.productViews)} ürün •{" "}
                  {fmtNum(selected.addToCartCount)} sepete ekleme • {fmtNum(selected.purchaseCount)} satın alma
                </div>
              </div>

              <div style={S.detailGrid}>
                {/* En Çok İncelenen Ürünler */}
                <section style={S.card}>
                  <div style={S.cardTitle}>🏆 En Çok İncelenen Ürünler</div>
                  <div style={S.cardSub}>{formatDateTR(selected.date)}</div>

                  {topProducts.length === 0 ? (
                    <div style={S.emptySmall}>Bu gün ürün incelemesi yok.</div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      {topProducts.map((item, i) => {
                        const maxC = topProducts[0]?.count || 1;
                        const pct = Math.max(8, Math.round((item.count / maxC) * 100));
                        return (
                          <div key={item.slug} style={S.rankRow}>
                            <div style={S.rankNum}>#{i + 1}</div>
                            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                              <div style={S.rankTitle}>{item.title}</div>
                              <div style={S.rankTrack}>
                                <div style={{ ...S.rankFill, width: `${pct}%` }} />
                              </div>
                            </div>
                            <div style={S.rankCount} title="Toplam detay sayfası açılış sayısı (tekil kullanıcı değil)">{item.count} görüntüleme</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* En Çok Ziyaret Edilen Sayfalar */}
                <section style={S.card}>
                  <div style={S.cardTitle}>📄 En Çok Ziyaret Edilen Sayfalar</div>
                  <div style={S.cardSub}>{formatDateTR(selected.date)}</div>

                  {topPages.length === 0 ? (
                    <div style={S.emptySmall}>Bu gün sayfa verisi yok.</div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
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
                                    background: "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)",
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ ...S.rankCount, color: "#7c3aed" }}>{item.count} görüntüleme</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {/* ── Gün Gün Tablo ── */}
          <section style={S.card}>
            <div style={S.cardTitle}>📅 Gün Gün Özet Tablosu</div>
            <div style={S.cardSub}>Tüm günlerin karşılaştırmalı görünümü</div>

            <div style={S.tableWrap}>
              <div style={S.tableHeader}>
                <div style={S.thDate}>Tarih</div>
                <div style={S.thNum}>Sayfa</div>
                <div style={S.thNum}>Tekil</div>
                <div style={S.thNum}>Ürün</div>
                <div style={S.thNum}>Sepet</div>
                <div style={S.thNum}>Satış</div>
              </div>

              {days.map((d) => {
                const isSelected = d.date === selectedDay;
                return (
                  <div
                    key={d.date}
                    style={{
                      ...S.tableRow,
                      background: isSelected ? "rgba(59,130,246,0.06)" : "transparent",
                      borderColor: isSelected ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.04)",
                    }}
                    onClick={() => setSelectedDay(d.date)}
                  >
                    <div style={S.tdDate}>{formatDateTR(d.date)}</div>
                    <div style={S.tdNum}>{fmtNum(d.pageViews)}</div>
                    <div style={S.tdNum}>{fmtNum(d.uniqueVisitors)}</div>
                    <div style={S.tdNum}>{fmtNum(d.productViews)}</div>
                    <div style={S.tdNum}>{fmtNum(d.addToCartCount)}</div>
                    <div style={S.tdNum}>{fmtNum(d.purchaseCount)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* ═══ Inline Styles ═══ */
const S: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    padding: "28px 24px 40px",
    maxWidth: 1200,
    margin: "0 auto",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  /* Header */
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  backLink: { fontSize: 13, fontWeight: 700, color: "#64748b", textDecoration: "none" },
  h1: { fontSize: 32, fontWeight: 950, color: "#0f172a", margin: "8px 0 0", letterSpacing: "-0.03em" },
  subtitle: { fontSize: 14, fontWeight: 600, color: "#64748b", marginTop: 6, lineHeight: 1.5 },

  /* Live */
  liveSection: {
    padding: 22,
    borderRadius: 24,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "#fff",
    boxShadow: "0 16px 40px rgba(15,23,42,0.15)",
  },
  liveHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  liveDot: {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 8px rgba(16,185,129,0.5)",
    animation: "livePulse 2s ease-in-out infinite",
  },
  liveDotSmall: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 5px rgba(16,185,129,0.4)",
    marginRight: 6,
  },
  liveTitle: { fontSize: 16, fontWeight: 900, color: "#e2e8f0" },
  liveCount: { fontSize: 36, fontWeight: 950, color: "#fff", marginLeft: "auto" },
  liveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 },
  liveCard: {
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  liveCardLabel: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" as const },
  liveCardValue: { fontSize: 24, fontWeight: 950, color: "#fff", marginTop: 4 },

  visitorTable: { display: "flex", flexDirection: "column" as const, gap: 6 },
  visitorRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1.2fr 0.8fr",
    gap: 10,
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  visitorName: { fontSize: 13, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  visitorEmail: { fontSize: 11, fontWeight: 600, color: "#64748b", marginTop: 2 },
  visitorPage: { fontSize: 11, fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  visitorTime: { fontSize: 11, fontWeight: 800, color: "#64748b", textAlign: "right" as const },

  /* Summary */
  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  summaryItem: {
    padding: "20px 18px",
    borderRadius: 20,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  summaryLabel: { fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: 950, color: "#0f172a", lineHeight: 1 },
  summaryUnit: { fontSize: 12, fontWeight: 700, color: "#94a3b8", marginTop: 4 },

  /* Cards */
  card: {
    padding: 22,
    borderRadius: 24,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#fff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  cardTitle: { fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 },
  cardSub: { fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 14 },

  /* Chart */
  chartArea: { display: "flex", alignItems: "flex-end", gap: 4, height: 220, overflow: "auto", paddingBottom: 4 },
  barCol: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    flex: "1 1 0",
    minWidth: 32,
    cursor: "pointer",
    height: "100%",
    justifyContent: "flex-end" as const,
  },
  barLabel: { fontSize: 10, fontWeight: 800, color: "#64748b" },
  bar: {
    width: "100%",
    maxWidth: 36,
    borderRadius: "8px 8px 4px 4px",
    transition: "height 0.3s ease, background 0.3s ease, transform 0.2s ease",
  },
  barDate: { fontSize: 9, fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" as const },

  /* Day header */
  dayHeader: {
    padding: "16px 20px",
    borderRadius: 18,
    background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
    border: "1px solid rgba(59,130,246,0.1)",
  },
  dayTitle: { fontSize: 20, fontWeight: 950, color: "#1e40af" },
  dayMeta: { fontSize: 13, fontWeight: 700, color: "#3b82f6", marginTop: 4 },

  /* Detail grid */
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 18,
  },

  /* Rank */
  rankRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid rgba(15,23,42,0.04)",
  },
  rankNum: { fontSize: 12, fontWeight: 900, color: "#94a3b8", minWidth: 28 },
  rankTitle: { fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.35, wordBreak: "break-word" as const, marginBottom: 4 },
  rankTrack: { height: 6, borderRadius: 999, background: "rgba(15,23,42,0.04)", overflow: "hidden" as const },
  rankFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)",
    transition: "width 0.3s ease",
  },
  rankCount: { fontSize: 13, fontWeight: 900, color: "#1d4ed8", minWidth: 40, textAlign: "right" as const },

  /* Table */
  tableWrap: { marginTop: 8 },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
    gap: 10,
    padding: "10px 16px",
    fontSize: 11,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "2px solid rgba(15,23,42,0.06)",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
    gap: 10,
    padding: "12px 16px",
    borderBottom: "1px solid rgba(15,23,42,0.04)",
    cursor: "pointer",
    transition: "background 0.2s ease",
    borderRadius: 10,
  },
  thDate: { textAlign: "left" as const },
  thNum: { textAlign: "right" as const },
  tdDate: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  tdNum: { fontSize: 13, fontWeight: 800, color: "#334155", textAlign: "right" as const },

  /* Empty */
  empty: {
    padding: 40,
    borderRadius: 24,
    border: "1px dashed rgba(148,163,184,0.4)",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 15,
    fontWeight: 700,
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
  emptySmall: {
    padding: "18px 12px",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center" as const,
  },
};
