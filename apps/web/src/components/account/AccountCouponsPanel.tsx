"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import styles from "./accountCouponsPanel.module.css";

type CouponRow = {
  id: string;
  code: string;
  label: string;
  status: "active" | "used" | "expired" | "cancelled";
  discountType: string;
  discountValue: number;
  campaignTitle: string;
  source: string;
  createdAt?: any;
  expiresAt?: any;
};

function toDate(v: any) {
  const date = typeof v?.toDate === "function" ? v.toDate() : v ? new Date(v) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(v: any) {
  try {
    const d = toDate(v);

    if (!d || Number.isNaN(d.getTime())) return "-";

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "-";
  }
}

export default function AccountCouponsPanel({ uid, loc = "tr" }: { uid: string; loc?: "tr" | "en" }) {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => {
      if (row.status === "expired") return false;
      const expiresAt = toDate(row.expiresAt);
      return !expiresAt || expiresAt.getTime() > now;
    }),
    [rows, now]
  );

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => current === code ? "" : current), 1800);
    } catch {
      setCopiedCode("");
    }
  }

  useEffect(() => {
   
    if (!uid) {
      setRows([]);
      setLoading(false);
      setReadError("UID boş geldi.");
      return;
    }

    setLoading(true);
    setReadError("");

    // Önce orderBy olmadan okuyalım. Sessiz patlayan yer varsa görelim.
    const qy = query(collection(db, "users", uid, "wheel_coupons"));

    const unsub = onSnapshot(
      qy,
      (snap) => {

        const list: CouponRow[] = snap.docs
          .map((d) => {
            const x: any = d.data();
            return {
              id: d.id,
              code: String(x?.code || d.id),
              label: String(x?.label || ""),
              status: (x?.status || "active") as CouponRow["status"],
              discountType: String(x?.discountType || ""),
              discountValue: Number(x?.discountValue || 0),
              campaignTitle: String(x?.campaignTitle || ""),
              source: String(x?.source || "wheel"),
              createdAt: x?.createdAt,
              expiresAt: x?.expiresAt,
            };
          })
          .sort((a, b) => {
            const aMs =
              typeof a?.createdAt?.toMillis === "function"
                ? a.createdAt.toMillis()
                : 0;
            const bMs =
              typeof b?.createdAt?.toMillis === "function"
                ? b.createdAt.toMillis()
                : 0;
            return bMs - aMs;
          });

        setRows(list);
        setLoading(false);
      },
      (error) => {
      
        setRows([]);
        setLoading(false);
        setReadError(error?.message || "Kuponlar okunamadı.");
      }
    );

    return () => unsub();
  }, [db, uid]);

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{loc === "en" ? "My Coupons" : "Kuponlarım"}</h2>
          <p className={styles.sub}>
            {loc === "en"
              ? "Your active coupons from campaigns are shown here. Expired coupons are archived automatically."
              : "Kampanyalardan kazandığın aktif kuponlar burada görünür. Süresi dolanlar otomatik arşivlenir."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Kuponlar yükleniyor...</div>
      ) : readError ? (
        <div className={styles.empty}>Hata: {readError}</div>
      ) : visibleRows.length === 0 ? (
        <div className={styles.empty}>
          {loc === "en" ? "You don't have an active coupon yet." : "Henüz kullanabileceğin aktif bir kupon yok."}
        </div>
      ) : (
        <div className={styles.grid}>
          {visibleRows.map((row) => {
            const effectiveStatus = row.status;
            return (
            <article key={row.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.codeLabel}>Kupon Kodu</div>
                  <button
                    type="button"
                    className={styles.code}
                    onClick={() => copyCode(row.code)}
                    title="Kupon kodunu kopyala"
                  >
                    {row.code || "-"}
                    <span className={styles.copyHint}>
                      {copiedCode === row.code ? (loc === "en" ? "Copied" : "Kopyalandı") : (loc === "en" ? "Copy" : "Kopyala")}
                    </span>
                  </button>
                </div>

                <span
                  className={
                    effectiveStatus === "active"
                      ? `${styles.badge} ${styles.badgeOk}`
                      : effectiveStatus === "used"
                      ? `${styles.badge} ${styles.badgeWarn}`
                      : `${styles.badge} ${styles.badgeMuted}`
                  }
                >
                  {effectiveStatus === "active"
                    ? "Aktif"
                    : effectiveStatus === "used"
                    ? "Kullanıldı"
                    : effectiveStatus === "expired"
                    ? "Süresi Doldu"
                    : "İptal"}
                </span>
              </div>

              <div className={styles.metaGrid}>
                <div>
                  <div className={styles.metaLabel}>Ödül</div>
                  <div className={styles.metaValue}>{row.label || "-"}</div>
                </div>

                <div>
                  <div className={styles.metaLabel}>Kampanya</div>
                  <div className={styles.metaValue}>{row.campaignTitle || "-"}</div>
                  {row.source === "newsletter" ? (
                    <div className={styles.metaLabel}>E-bülten hediyesi</div>
                  ) : null}
                </div>

                <div>
                  <div className={styles.metaLabel}>İndirim</div>
                  <div className={styles.metaValue}>
                    {row.discountType === "percent"
                      ? `%${row.discountValue}`
                      : `${row.discountValue} TL`}
                  </div>
                </div>

                <div>
                  <div className={styles.metaLabel}>Bitiş</div>
                  <div className={styles.metaValue}>{formatDate(row.expiresAt)}</div>
                </div>
              </div>
            </article>
          )})}
        </div>
      )}
    </section>
  );
}
