"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminReviews.module.css";

type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  text: string;
  approved?: boolean;
  createdAt?: any;
  updatedAt?: any;
  approvedAt?: any;
};

type TabKey = "pending" | "approved" | "all";

function clampRating(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.max(1, Math.min(5, Math.floor(x)));
}

function toDateStr(ts: any) {
  try {
    const d =
      ts instanceof Date
        ? ts
        : typeof ts?.toDate === "function"
        ? ts.toDate()
        : ts instanceof Timestamp
        ? ts.toDate()
        : null;

    if (!d) return "";
    return d.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function timeAgo(ts: any) {
  try {
    const d =
      ts instanceof Date
        ? ts
        : typeof ts?.toDate === "function"
        ? ts.toDate()
        : ts instanceof Timestamp
        ? ts.toDate()
        : null;

    if (!d) return "-";

    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);

    if (min < 1) return "az önce";
    if (min < 60) return `${min} dk önce`;

    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} sa önce`;

    const day = Math.floor(hr / 24);
    return `${day} gün önce`;
  } catch {
    return "-";
  }
}

function normalizeText(v: any) {
  return String(v ?? "").trim();
}

function stars(rating: number) {
  const full = "★".repeat(rating);
  const empty = "☆".repeat(Math.max(0, 5 - rating));
  return `${full}${empty}`;
}

function AdminReviewsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [tab, setTab] = useState<TabKey>("pending");
  const [rows, setRows] = useState<Review[]>([]);
  const [busyId, setBusyId] = useState("");
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setErr("");

    const qy =
      tab === "pending"
        ? query(
            collection(db, "product_reviews"),
            where("approved", "==", false),
            orderBy("createdAt", "desc")
          )
        : tab === "approved"
        ? query(
            collection(db, "product_reviews"),
            where("approved", "==", true),
            orderBy("createdAt", "desc")
          )
        : query(collection(db, "product_reviews"), orderBy("createdAt", "desc"));

    return onSnapshot(
      qy,
      (snap) => {
        const list: Review[] = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            id: d.id,
            productId: String(x?.productId || ""),
            name: String(x?.name || "Misafir"),
            rating: clampRating(x?.rating),
            text: normalizeText(x?.text),
            approved: x?.approved === true,
            createdAt: x?.createdAt,
            updatedAt: x?.updatedAt,
            approvedAt: x?.approvedAt,
          };
        });

        setRows(list);
      },
      (e) => {
        console.error("reviews onSnapshot error:", e);
        setRows([]);
        setErr(
          String(e?.message || "").toLowerCase().includes("index")
            ? "Bu sorgu için Firestore index gerekiyor. Console > Firestore > Indexes tarafından oluştur."
            : e?.message || "Yorumlar okunamadı."
        );
      }
    );
  }, [db, tab]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search).toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        r.name,
        r.text,
        r.productId,
        r.id,
        String(r.rating),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => !r.approved).length;
    const approved = rows.filter((r) => r.approved).length;
    const avg =
      rows.length > 0
        ? (
            rows.reduce((sum, r) => sum + Number(r.rating || 0), 0) / rows.length
          ).toFixed(1)
        : "0.0";

    return {
      total: rows.length,
      pending,
      approved,
      avg,
    };
  }, [rows]);

  async function approve(r: Review) {
    setBusyId(r.id);
    try {
      await updateDoc(doc(db, "product_reviews", r.id), {
        approved: true,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusyId("");
    }
  }

  async function unapprove(r: Review) {
    setBusyId(r.id);
    try {
      await updateDoc(doc(db, "product_reviews", r.id), {
        approved: false,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusyId("");
    }
  }

  async function remove(r: Review) {
    const ok = confirm("Yorum silinsin mi? Bu işlem geri alınamaz.");
    if (!ok) return;

    setBusyId(r.id);
    try {
      await deleteDoc(doc(db, "product_reviews", r.id));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Moderasyon</div>
          <h1 className={styles.h1}>Ürün Yorum Yönetimi</h1>
          <p className={styles.sub}>
            Bekleyen yorumları filtrele, onayla, geri al veya sil. Tüm moderasyon akışı tek panelde.
          </p>
        </div>

        <div className={styles.heroBadges}>
          <span className={`${styles.statusPill} ${styles.statusLive}`}>
            {err ? "Sorun var" : "Canlı"}
          </span>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Bekleyen</span>
          <strong className={styles.statValue}>{stats.pending}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Onaylı</span>
          <strong className={styles.statValue}>{stats.approved}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Ortalama Puan</span>
          <strong className={styles.statValue}>{stats.avg}</strong>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "pending" ? styles.tabOn : ""}`}
            onClick={() => setTab("pending")}
          >
            Bekleyen
          </button>

          <button
            type="button"
            className={`${styles.tab} ${tab === "approved" ? styles.tabOn : ""}`}
            onClick={() => setTab("approved")}
          >
            Onaylı
          </button>

          <button
            type="button"
            className={`${styles.tab} ${tab === "all" ? styles.tabOn : ""}`}
            onClick={() => setTab("all")}
          >
            Tümü
          </button>
        </div>

        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, yorum, ürün id, review id ara..."
          />
        </div>
      </section>

      {err ? <div className={styles.alert}>{err}</div> : null}

      <section className={styles.list}>
        {!filteredRows.length ? (
          <div className={styles.empty}>
            {search
              ? "Aramaya uygun yorum bulunamadı."
              : "Bu sekmede kayıt yok."}
          </div>
        ) : (
          filteredRows.map((r) => (
            <article key={r.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardLeft}>
                  <div className={styles.nameRow}>
                    <div className={styles.avatar}>
                      {normalizeText(r.name).slice(0, 1).toUpperCase() || "M"}
                    </div>

                    <div className={styles.identity}>
                      <div className={styles.name}>{r.name || "Misafir"}</div>

                      <div className={styles.metaRow}>
                        <span
                          className={`${styles.badge} ${
                            r.approved ? styles.badgeOk : styles.badgePending
                          }`}
                        >
                          {r.approved ? "Onaylı" : "Bekliyor"}
                        </span>

                        <span className={styles.when}>{timeAgo(r.createdAt)}</span>
                        <span className={styles.dot}>•</span>
                        <span className={styles.when}>{toDateStr(r.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.cardRight}>
                  <div className={styles.ratingBox}>
                    <div className={styles.ratingStars}>{stars(r.rating)}</div>
                    <div className={styles.ratingValue}>{r.rating}/5</div>
                  </div>

                  <div className={styles.actions}>
                    {!r.approved ? (
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        disabled={busyId === r.id}
                        onClick={() => approve(r)}
                      >
                        {busyId === r.id ? "İşleniyor…" : "Onayla"}
                      </button>
                    ) : (
                      <button
                        className={`${styles.btn} ${styles.btnGhost}`}
                        disabled={busyId === r.id}
                        onClick={() => unapprove(r)}
                      >
                        {busyId === r.id ? "İşleniyor…" : "Onayı kaldır"}
                      </button>
                    )}

                    <button
                      className={`${styles.btn} ${styles.btnDanger}`}
                      disabled={busyId === r.id}
                      onClick={() => remove(r)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.text}>{r.text || "Yorum metni boş."}</div>

              <div className={styles.footer}>
                <div className={styles.infoChip}>
                  <span className={styles.infoLabel}>Product</span>
                  <b>{r.productId || "-"}</b>
                </div>

                <div className={styles.infoChip}>
                  <span className={styles.infoLabel}>Review</span>
                  <span>{r.id}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default function AdminReviewsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="products">
        <AdminReviewsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}