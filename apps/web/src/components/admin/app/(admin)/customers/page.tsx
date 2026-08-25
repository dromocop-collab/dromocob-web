"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  limit,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/admin/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "../adminDashboard.module.css";

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: any;
  createdAtIso: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  consentApproved: boolean;
  emailVerified: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function fmtDate(v: any, fallbackIso?: string): string {
  try {
    let d: Date | null = null;
    if (v?.toDate) d = v.toDate();
    else if (v?.seconds) d = new Date(v.seconds * 1000);
    else if (typeof v === "string" && v) d = new Date(v);
    else if (fallbackIso) d = new Date(fallbackIso);
    if (!d || isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function fmtMoney(v: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ₺`;
  }
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "i");
}

function AdminCustomersPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "orders" | "spent">("date");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), limit(500));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list: Customer[] = [];

        for (const d of snap.docs) {
          const x = d.data() as any;
          list.push({
            id: d.id,
            email: safeStr(x.email),
            firstName: safeStr(x.firstName),
            lastName: safeStr(x.lastName),
            phone: safeStr(x.phone),
            createdAt: x.createdAt ?? null,
            createdAtIso: safeStr(x.createdAtIso || x.updatedAt),
            orderCount: Number(x.orderCount || 0),
            totalSpent: Number(x.totalSpent || 0),
            lastOrderDate: safeStr(x.lastOrderDate),
            consentApproved: Boolean(x.consentApproved),
            emailVerified: Boolean(x.emailVerified),
          });
        }

        setCustomers(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [db]);

  const filtered = useMemo(() => {
    const q = normalize(search);

    let list = customers;

    if (q) {
      list = list.filter(
        (c) =>
          normalize(c.email).includes(q) ||
          normalize(c.firstName).includes(q) ||
          normalize(c.lastName).includes(q) ||
          normalize(c.phone).includes(q) ||
          normalize(c.id).includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (sortBy === "orders") return (b.orderCount || 0) - (a.orderCount || 0);
      if (sortBy === "spent") return (b.totalSpent || 0) - (a.totalSpent || 0);
      const aTime =
        a.createdAt?.toMillis?.() ||
        (a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0);
      const bTime =
        b.createdAt?.toMillis?.() ||
        (b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0);
      return bTime - aTime;
    });

    return list;
  }, [customers, search, sortBy]);

  async function loadCustomerOrders(uid: string) {
    if (selectedId === uid) {
      setSelectedId(null);
      setSelectedOrders([]);
      return;
    }

    setSelectedId(uid);
    setOrdersLoading(true);

    try {
      const q = query(
        collection(db, "orders"),
        where("uid", "==", uid),
        limit(20)
      );

      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            status: safeStr(x.status),
            total: Number(x.total?.amount || x.total || 0),
            createdAt: x.createdAt ?? null,
            createdAtIso: safeStr(x.createdAtIso),
          };
        });

        list.sort((a: any, b: any) => {
          const aTime =
            a.createdAt?.toMillis?.() ||
            (a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0);
          const bTime =
            b.createdAt?.toMillis?.() ||
            (b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0);
          return bTime - aTime;
        });

        setSelectedOrders(list);
        setOrdersLoading(false);

        unsub();
      });
    } catch {
      setOrdersLoading(false);
    }
  }

  const statusMap: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekleniyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };

  const stats = useMemo(() => {
    return {
      total: customers.length,
      verified: customers.filter((c) => c.consentApproved).length,
      withOrders: customers.filter((c) => c.orderCount > 0).length,
    };
  }, [customers]);

  return (
    <main className={s.mainWrap} style={{ padding: "24px 18px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 950,
              letterSpacing: "-0.04em",
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Müşteriler
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#64748b",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Kayıtlı müşteriler ve sipariş geçmişleri
          </p>
        </header>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Toplam Müşteri", value: stats.total, icon: "👥" },
            { label: "KVKK Onaylı", value: stats.verified, icon: "✓" },
            { label: "Sipariş Veren", value: stats.withOrders, icon: "📦" },
          ].map((st) => (
            <div
              key={st.label}
              style={{
                padding: "18px 20px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.90) 0%, rgba(250,250,252,.92) 100%)",
                border: "1px solid rgba(15,23,42,.08)",
                boxShadow: "0 8px 24px rgba(15,23,42,.04)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "#64748b",
                  marginBottom: 8,
                }}
              >
                {st.icon} {st.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 950,
                  color: "#111827",
                  letterSpacing: "-0.04em",
                }}
              >
                {st.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search & Sort */}
        <div
          style={{
            display: "flex",
            gap: 14,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Müşteri ara (ad, e-posta, telefon)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minHeight: 48,
              padding: "0 18px",
              border: "1px solid rgba(15,23,42,.12)",
              background: "#fff",
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
              minWidth: 240,
            }}
          />

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "date" | "orders" | "spent")
            }
            style={{
              minHeight: 48,
              padding: "0 16px",
              border: "1px solid rgba(15,23,42,.12)",
              background: "#fff",
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <option value="date">Kayıt Tarihi</option>
            <option value="orders">Sipariş Sayısı</option>
            <option value="spent">Toplam Harcama</option>
          </select>
        </div>

        {/* Info */}
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {filtered.length} müşteri gösteriliyor
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Müşteri bulunamadı.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((c) => (
              <div key={c.id}>
                <article
                  style={{
                    padding: "18px 22px",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.90) 0%, rgba(250,250,252,.92) 100%)",
                    border: `1px solid ${
                      selectedId === c.id
                        ? "rgba(180,131,28,.30)"
                        : "rgba(15,23,42,.08)"
                    }`,
                    boxShadow: "0 8px 24px rgba(15,23,42,.04)",
                    cursor: "pointer",
                    transition: "border-color .18s ease",
                  }}
                  onClick={() => loadCustomerOrders(c.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 850,
                          color: "#111827",
                        }}
                      >
                        {c.firstName || c.lastName
                          ? `${c.firstName} ${c.lastName}`.trim()
                          : "İsimsiz"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {c.email || "-"}
                        {c.phone ? ` • ${c.phone}` : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 24,
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#475569",
                      }}
                    >
                      <span>
                        Kayıt: {fmtDate(c.createdAt, c.createdAtIso)}
                      </span>
                      {c.orderCount > 0 ? (
                        <span style={{ color: "#059669" }}>
                          {c.orderCount} sipariş
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Sipariş yok</span>
                      )}
                      {c.totalSpent > 0 ? (
                        <span>{fmtMoney(c.totalSpent)}</span>
                      ) : null}
                    </div>
                  </div>
                </article>

                {selectedId === c.id ? (
                  <div
                    style={{
                      padding: "16px 22px",
                      background: "rgba(248,250,252,.95)",
                      border: "1px solid rgba(15,23,42,.06)",
                      borderTop: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 850,
                        color: "#111827",
                        marginBottom: 12,
                      }}
                    >
                      Sipariş Geçmişi
                    </div>

                    {ordersLoading ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#94a3b8",
                          fontWeight: 600,
                        }}
                      >
                        Yükleniyor...
                      </div>
                    ) : selectedOrders.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#94a3b8",
                          fontWeight: 600,
                        }}
                      >
                        Bu müşterinin siparişi bulunmuyor.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {selectedOrders.map((o) => (
                          <a
                            key={o.id}
                            href={`/admin/orders/${o.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 16px",
                              background: "#fff",
                              border: "1px solid rgba(15,23,42,.06)",
                              textDecoration: "none",
                              color: "#0f172a",
                              fontSize: 13,
                              fontWeight: 700,
                              transition: "border-color .18s ease",
                            }}
                          >
                            <span style={{ fontFamily: "monospace" }}>
                              #{o.id.slice(0, 8)}
                            </span>
                            <span>
                              {statusMap[o.status] || o.status}
                            </span>
                            <span>{o.total > 0 ? fmtMoney(o.total) : "-"}</span>
                            <span>
                              {fmtDate(o.createdAt, o.createdAtIso)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 12,
                        color: "#94a3b8",
                        fontWeight: 600,
                        fontFamily: "monospace",
                      }}
                    >
                      UID: {c.id}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminCustomersPage() {
  return (
    <AdminGate>
      <PermissionGate permission="orders">
        <AdminCustomersPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
