"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./wheel-spins.module.css";

type SpinSource = "spin" | "lead";

type SpinRow = {
  id: string;
  source: SpinSource;
  campaignId: string;
  rewardId: string;
  couponId: string;
  couponCode: string;
  email: string;
  phone: string;
  fullName: string;
  resultLabel: string;
  createdAt?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function tsMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return Number(v.toMillis());
    if (typeof v === "number") return v;
    const parsed = Date.parse(String(v));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: unknown) {
  const ms = tsMs(v);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(v: unknown) {
  const ms = tsMs(v);
  if (!ms) return "-";

  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  if (hour < 24) return `${hour} sa önce`;
  return `${day} gün önce`;
}

function normalizeSpinDoc(id: string, x: any): SpinRow {
  return {
    id,
    source: "spin",
    campaignId: safeStr(x?.campaignId),
    rewardId: safeStr(x?.rewardId),
    couponId: safeStr(x?.couponId),
    couponCode: safeStr(x?.couponCode || x?.couponId),
    email: safeStr(x?.email),
    phone: safeStr(x?.phone),
    fullName: safeStr(x?.fullName),
    resultLabel: safeStr(x?.resultLabel || x?.rewardLabel),
    createdAt: x?.createdAt,
  };
}

function normalizeLeadDoc(id: string, x: any): SpinRow {
  return {
    id,
    source: "lead",
    campaignId: safeStr(x?.campaignId),
    rewardId: safeStr(x?.rewardId),
    couponId: safeStr(x?.couponId),
    couponCode: safeStr(x?.couponCode),
    email: safeStr(x?.email),
    phone: safeStr(x?.phone),
    fullName: safeStr(x?.fullName),
    resultLabel: safeStr(x?.resultLabel || x?.rewardLabel),
    createdAt: x?.createdAt,
  };
}

function WheelSpinsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [spinRows, setSpinRows] = useState<SpinRow[]>([]);
  const [leadRows, setLeadRows] = useState<SpinRow[]>([]);
  const [qText, setQText] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const qy = query(collection(db, "wheel_spins"), orderBy("createdAt", "desc"));

    return onSnapshot(
      qy,
      (snap) => {
        setSpinRows(snap.docs.map((d) => normalizeSpinDoc(d.id, d.data())));
      },
      (error) => {
        console.error("wheel_spins read error:", error);
        setSpinRows([]);
      }
    );
  }, [db]);

  useEffect(() => {
    const qy = query(collection(db, "wheel_leads"), orderBy("createdAt", "desc"));

    return onSnapshot(
      qy,
      (snap) => {
        setLeadRows(snap.docs.map((d) => normalizeLeadDoc(d.id, d.data())));
      },
      (error) => {
        console.error("wheel_leads read error:", error);
        setLeadRows([]);
      }
    );
  }, [db]);

  const rows = useMemo(() => {
    const merged = [...spinRows, ...leadRows];

    const uniq = new Map<string, SpinRow>();

    for (const row of merged) {
      const key =
        row.source === "lead"
          ? `lead:${row.id}`
          : `spin:${row.id}`;

      uniq.set(key, row);
    }

    return Array.from(uniq.values()).sort(
      (a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)
    );
  }, [spinRows, leadRows]);

  const filteredRows = useMemo(() => {
    const q = qText.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;

    return rows.filter((row) => {
      const hay = [
        row.fullName,
        row.email,
        row.phone,
        row.resultLabel,
        row.campaignId,
        row.rewardId,
        row.couponId,
        row.couponCode,
        row.id,
        row.source,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return hay.includes(q);
    });
  }, [rows, qText]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      fromSpins: rows.filter((x) => x.source === "spin").length,
      fromLeads: rows.filter((x) => x.source === "lead").length,
      withCoupon: rows.filter((x) => !!x.couponId || !!x.couponCode).length,
      withEmail: rows.filter((x) => !!x.email).length,
      withPhone: rows.filter((x) => !!x.phone).length,
    };
  }, [rows]);

  useEffect(() => {
    if (!spinRows.length && !leadRows.length) {
      setNote(
        "Şu an kayıt görünmüyorsa sebep büyük ihtimalle spin verisinin wheel_spins yerine wheel_leads içine yazılması. Bu ekran iki kaynağı da birlikte okuyacak şekilde güncellendi."
      );
      return;
    }
    setNote("");
  }, [spinRows.length, leadRows.length]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Wheel • Spins</div>
          <h1 className={styles.h1}>Spin Kayıtları</h1>
          <p className={styles.sub}>
            Kim çevirmiş, ne kazanmış, kupon oluşmuş mu; sistemin nabzı burada atıyor.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel" className={styles.ghostBtn}>
            ← Wheel Dashboard
          </Link>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam Kayıt</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>wheel_spins</span>
          <strong className={styles.statValue}>{stats.fromSpins}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>wheel_leads</span>
          <strong className={styles.statValue}>{stats.fromLeads}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Kuponlu Kayıt</span>
          <strong className={styles.statValue}>{stats.withCoupon}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>E-posta Bırakan</span>
          <strong className={styles.statValue}>{stats.withEmail}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Telefon Bırakan</span>
          <strong className={styles.statValue}>{stats.withPhone}</strong>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Spin / Lead Listesi</h2>
            <p className={styles.cardDesc}>
              Müşteri, iletişim, sonuç ve bağlı kampanya-kupon akışı tek yerde.
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="İsim / e-posta / telefon / sonuç / kupon / kampanya ara"
          />
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.empty}>Henüz spin veya lead kaydı yok.</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kaynak</th>
                    <th>Müşteri</th>
                    <th>İletişim</th>
                    <th>Sonuç</th>
                    <th>Kampanya</th>
                    <th>Reward</th>
                    <th>Kupon</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.source}:${row.id}`}>
                      <td>
                        <span className={styles.badge}>
                          {row.source === "lead" ? "Lead" : "Spin"}
                        </span>
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {row.fullName || "-"}
                          </div>
                          <div className={styles.rowTitleSub}>ID: {row.id}</div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.inlineList}>
                          {row.email ? <span>{row.email}</span> : null}
                          {row.phone ? <span>{row.phone}</span> : null}
                          {!row.email && !row.phone ? <span>-</span> : null}
                        </div>
                      </td>

                      <td>
                        <span className={styles.badge}>{row.resultLabel || "-"}</span>
                      </td>

                      <td className={styles.mono}>{row.campaignId || "-"}</td>
                      <td className={styles.mono}>{row.rewardId || "-"}</td>
                      <td className={styles.mono}>
                        {row.couponCode || row.couponId || "-"}
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {relTime(row.createdAt)}
                          </div>
                          <div className={styles.rowTitleSub}>
                            {fmtDate(row.createdAt)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileList}>
              {filteredRows.map((row) => (
                <article key={`${row.source}:${row.id}`} className={styles.mobileCard}>
                  <div className={styles.mobileTop}>
                    <div>
                      <div className={styles.mobileCode}>
                        {row.fullName || "İsimsiz kullanıcı"}
                      </div>
                      <div className={styles.mobileSub}>
                        {row.resultLabel || "-"}
                      </div>
                    </div>

                    <span className={styles.badge}>
                      {row.source === "lead" ? "Lead" : "Spin"}
                    </span>
                  </div>

                  <div className={styles.mobileGrid}>
                    <div>
                      <span className={styles.mobileLabel}>E-posta</span>
                      <div className={styles.mobileVal}>{row.email || "-"}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Telefon</span>
                      <div className={styles.mobileVal}>{row.phone || "-"}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Sonuç</span>
                      <div className={styles.mobileVal}>{row.resultLabel || "-"}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Kampanya</span>
                      <div className={styles.mobileVal}>{row.campaignId || "-"}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Reward</span>
                      <div className={styles.mobileVal}>{row.rewardId || "-"}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Kupon</span>
                      <div className={styles.mobileVal}>
                        {row.couponCode || row.couponId || "-"}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Tarih</span>
                      <div className={styles.mobileVal}>{fmtDate(row.createdAt)}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Kayıt Türü</span>
                      <div className={styles.mobileVal}>
                        {row.source === "lead" ? "Misafir / Lead" : "Spin Log"}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function WheelSpinsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <WheelSpinsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}