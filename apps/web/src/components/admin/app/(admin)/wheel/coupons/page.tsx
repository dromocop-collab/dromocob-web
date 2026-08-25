"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./wheel-coupons.module.css";

type CouponStatus = "active" | "used" | "expired" | "cancelled";
type DiscountType = "fixed" | "percent" | "free_shipping" | "gift" | string;
type CouponSource = "member" | "guest";

type CouponRow = {
  id: string;
  source: CouponSource;
  code: string;
  campaignId: string;
  campaignTitle: string;
  rewardId: string;
  rewardLabel: string;
  status: CouponStatus;
  discountType: DiscountType;
  discountValue: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  usedAt?: unknown;
  expiresAt?: unknown;
  uid?: string;
  email?: string;
  fullName?: string;
  singleUse?: boolean;
  minCartAmount?: number;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStatus(v: unknown): CouponStatus {
  const x = safeStr(v);
  if (x === "active" || x === "used" || x === "expired" || x === "cancelled") {
    return x;
  }
  return "active";
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

function relDate(v: unknown) {
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

function formatDiscount(type: DiscountType, value: number) {
  if (type === "percent") return `%${value}`;
  if (type === "fixed") return `${value} TL`;
  if (type === "free_shipping") return "Ücretsiz Kargo";
  if (type === "gift") return "Hediye";
  return value ? String(value) : "-";
}

function formatType(type: DiscountType) {
  if (type === "percent") return "Yüzde";
  if (type === "fixed") return "Sabit";
  if (type === "free_shipping") return "Kargo";
  if (type === "gift") return "Hediye";
  return type || "-";
}

function statusLabel(status: CouponStatus) {
  if (status === "active") return "Aktif";
  if (status === "used") return "Kullanıldı";
  if (status === "expired") return "Süresi Doldu";
  if (status === "cancelled") return "İptal";
  return status;
}

function normalizeMemberCoupon(id: string, x: any): CouponRow {
  return {
    id,
    source: "member",
    code: safeStr(x?.code) || id,
    campaignId: safeStr(x?.campaignId),
    campaignTitle: safeStr(x?.campaignTitle),
    rewardId: safeStr(x?.rewardId),
    rewardLabel: safeStr(x?.label || x?.rewardLabel),
    status: safeStatus(x?.status),
    discountType: safeStr(x?.discountType),
    discountValue: safeNum(x?.discountValue, 0),
    createdAt: x?.createdAt,
    updatedAt: x?.updatedAt,
    usedAt: x?.usedAt,
    expiresAt: x?.expiresAt,
    uid: safeStr(x?.uid),
    email: safeStr(x?.email),
    fullName: safeStr(x?.fullName),
    singleUse: x?.singleUse !== false,
    minCartAmount: safeNum(x?.minCartAmount, 0),
  };
}

function normalizeGuestCoupon(id: string, x: any): CouponRow {
  return {
    id,
    source: "guest",
    code: safeStr(x?.couponCode) || id,
    campaignId: safeStr(x?.campaignId),
    campaignTitle: safeStr(x?.campaignTitle),
    rewardId: safeStr(x?.rewardId),
    rewardLabel: safeStr(x?.rewardLabel),
    status: safeStatus(x?.couponStatus || "active"),
    discountType: safeStr(x?.discountType),
    discountValue: safeNum(x?.discountValue, 0),
    createdAt: x?.createdAt,
    updatedAt: x?.updatedAt,
    usedAt: x?.usedAt,
    expiresAt: x?.expiresAt,
    uid: safeStr(x?.uid),
    email: safeStr(x?.email),
    fullName: safeStr(x?.fullName),
    singleUse: x?.singleUse !== false,
    minCartAmount: safeNum(x?.minCartAmount, 0),
  };
}

function WheelCouponsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [memberRows, setMemberRows] = useState<CouponRow[]>([]);
  const [guestRows, setGuestRows] = useState<CouponRow[]>([]);
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | CouponSource>("all");
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteCoupon(row: CouponRow) {
    const confirmMsg = `"${row.code}" kodlu kuponu silmek istediğine emin misin?\n\nKullanıcı: ${row.fullName || row.email || row.uid || "Bilinmiyor"}\nKaynak: ${row.source === "member" ? "Üye" : "Misafir"}`;
    if (!window.confirm(confirmMsg)) return;

    const key = `${row.source}:${row.id}`;
    setDeleting(key);

    try {
      if (row.source === "member" && row.uid) {
        const couponRef = doc(db, "users", row.uid, "wheel_coupons", row.code || row.id);
        await deleteDoc(couponRef);
      } else if (row.source === "guest") {
        const res = await fetch("/api/admin/coupon", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "guest", docId: row.id }),
        });
        if (!res.ok) throw new Error("Silme başarısız");
      } else {
        const res = await fetch("/api/admin/coupon", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "member",
            docId: row.code || row.id,
            uid: row.uid,
            code: row.code,
          }),
        });
        if (!res.ok) throw new Error("Silme başarısız");
      }
    } catch (err: any) {
      alert(`Kupon silinemedi: ${err?.message || "Bilinmeyen hata"}`);
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    const qy = query(
      collectionGroup(db, "wheel_coupons"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: CouponRow[] = snap.docs.map((d) =>
          normalizeMemberCoupon(d.id, d.data())
        );
        setMemberRows(list);
      },
      (error) => {
        console.error("member wheel_coupons read error:", error);
        setMemberRows([]);
      }
    );
  }, [db]);

  useEffect(() => {
    const qy = query(
      collection(db, "wheel_leads"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: CouponRow[] = snap.docs
          .map((d) => normalizeGuestCoupon(d.id, d.data()))
          .filter((x) => !!x.code);

        setGuestRows(list);
      },
      (error) => {
        console.error("guest wheel_leads read error:", error);
        setGuestRows([]);
      }
    );
  }, [db]);

  const rows = useMemo(() => {
    return [...memberRows, ...guestRows].sort(
      (a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)
    );
  }, [memberRows, guestRows]);

  useEffect(() => {
    if (!memberRows.length && !guestRows.length) {
      setNote(
        "Kayıt görünmüyorsa sebep çoğu zaman kuponların top-level wheel_coupons yerine users/{uid}/wheel_coupons ve misafir tarafında wheel_leads içinde tutulmasıdır. Bu panel iki kaynağı birlikte okur."
      );
      return;
    }
    setNote("");
  }, [memberRows.length, guestRows.length]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((x) => x.status === "active").length,
      used: rows.filter((x) => x.status === "used").length,
      expired: rows.filter((x) => x.status === "expired").length,
      member: rows.filter((x) => x.source === "member").length,
      guest: rows.filter((x) => x.source === "guest").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;

      if (!q) return true;

      const hay = [
        row.code,
        row.campaignId,
        row.campaignTitle,
        row.rewardId,
        row.rewardLabel,
        row.discountType,
        row.status,
        row.email,
        row.uid,
        row.fullName,
        row.source,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return hay.includes(q);
    });
  }, [rows, qText, statusFilter, sourceFilter]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Wheel • Coupons</div>
          <h1 className={styles.h1}>Kuponlar</h1>
          <p className={styles.sub}>
            Çarktan üretilen gerçek satış kodları burada görünür. Üye kuponları ve
            misafir kuponları tek panelde izlenir.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel" className={styles.ghostBtn}>
            ← Wheel Dashboard
          </Link>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam Kupon</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Aktif</span>
          <strong className={styles.statValue}>{stats.active}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Kullanıldı</span>
          <strong className={styles.statValue}>{stats.used}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Süresi Doldu</span>
          <strong className={styles.statValue}>{stats.expired}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Üye Kuponu</span>
          <strong className={styles.statValue}>{stats.member}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Misafir Kuponu</span>
          <strong className={styles.statValue}>{stats.guest}</strong>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Filtre ve Liste</h2>
            <p className={styles.cardDesc}>
              Kod, kampanya, ödül, kullanıcı veya kaynak tipine göre filtrele.
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Kod / kampanya / reward / email / isim ara"
          />

          <div className={styles.segmentRow}>
            {(["all", "active", "used", "expired", "cancelled"] as const).map((x) => (
              <button
                key={x}
                type="button"
                className={`${styles.segmentBtn} ${
                  statusFilter === x ? styles.segmentBtnOn : ""
                }`}
                onClick={() => setStatusFilter(x)}
              >
                {x === "all" ? "Tümü" : statusLabel(x)}
              </button>
            ))}
          </div>

          <div className={styles.segmentRow}>
            {(["all", "member", "guest"] as const).map((x) => (
              <button
                key={x}
                type="button"
                className={`${styles.segmentBtn} ${
                  sourceFilter === x ? styles.segmentBtnOn : ""
                }`}
                onClick={() => setSourceFilter(x)}
              >
                {x === "all" ? "Kaynak: Tümü" : x === "member" ? "Üye" : "Misafir"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            Henüz kupon üretilmemiş ya da filtreye uygun kayıt yok.
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Kaynak</th>
                    <th>Kampanya</th>
                    <th>Reward</th>
                    <th>Tip</th>
                    <th>Değer</th>
                    <th>Durum</th>
                    <th>Kullanıcı</th>
                    <th>Oluşturulma</th>
                    <th>Bitiş</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.source}:${row.id}`}>
                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>{row.code}</div>
                          <div className={styles.rowTitleSub}>ID: {row.id}</div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={[
                            styles.badge,
                            row.source === "member" ? styles.badgeOk : styles.badgeWarn,
                          ].join(" ")}
                        >
                          {row.source === "member" ? "Üye" : "Misafir"}
                        </span>
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {row.campaignTitle || row.campaignId || "-"}
                          </div>
                          <div className={styles.rowTitleSub}>
                            {row.campaignId || "-"}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {row.rewardLabel || "-"}
                          </div>
                          <div className={styles.rowTitleSub}>
                            {row.rewardId || "-"}
                          </div>
                        </div>
                      </td>

                      <td>{formatType(row.discountType)}</td>
                      <td>{formatDiscount(row.discountType, row.discountValue)}</td>

                      <td>
                        <span
                          className={[
                            styles.badge,
                            row.status === "active"
                              ? styles.badgeOk
                              : row.status === "used"
                              ? styles.badgeWarn
                              : styles.badgeOff,
                          ].join(" ")}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {row.fullName || row.email || row.uid || "-"}
                          </div>
                          <div className={styles.rowTitleSub}>
                            {row.email || row.uid || "-"}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>
                            {fmtDate(row.createdAt)}
                          </div>
                          <div className={styles.rowTitleSub}>
                            {relDate(row.createdAt)}
                          </div>
                        </div>
                      </td>

                      <td>{fmtDate(row.expiresAt)}</td>

                      <td>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          disabled={deleting === `${row.source}:${row.id}`}
                          onClick={() => deleteCoupon(row)}
                          title="Kuponu sil"
                        >
                          {deleting === `${row.source}:${row.id}` ? "..." : "🗑"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileList}>
              {filtered.map((row) => (
                <article key={`${row.source}:${row.id}`} className={styles.mobileCard}>
                  <div className={styles.mobileTop}>
                    <div>
                      <div className={styles.mobileCode}>{row.code}</div>
                      <div className={styles.mobileSub}>ID: {row.id}</div>
                    </div>

                    <span
                      className={[
                        styles.badge,
                        row.status === "active"
                          ? styles.badgeOk
                          : row.status === "used"
                          ? styles.badgeWarn
                          : styles.badgeOff,
                      ].join(" ")}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>

                  <div className={styles.mobileGrid}>
                    <div>
                      <span className={styles.mobileLabel}>Kaynak</span>
                      <div className={styles.mobileVal}>
                        {row.source === "member" ? "Üye" : "Misafir"}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Kampanya</span>
                      <div className={styles.mobileVal}>
                        {row.campaignTitle || row.campaignId || "-"}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Reward</span>
                      <div className={styles.mobileVal}>
                        {row.rewardLabel || row.rewardId || "-"}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Tip</span>
                      <div className={styles.mobileVal}>
                        {formatType(row.discountType)}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Değer</span>
                      <div className={styles.mobileVal}>
                        {formatDiscount(row.discountType, row.discountValue)}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Kullanıcı</span>
                      <div className={styles.mobileVal}>
                        {row.fullName || row.email || row.uid || "-"}
                      </div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Oluşturulma</span>
                      <div className={styles.mobileVal}>{fmtDate(row.createdAt)}</div>
                    </div>

                    <div>
                      <span className={styles.mobileLabel}>Bitiş</span>
                      <div className={styles.mobileVal}>{fmtDate(row.expiresAt)}</div>
                    </div>
                  </div>

                  <div className={styles.mobileActions}>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={deleting === `${row.source}:${row.id}`}
                      onClick={() => deleteCoupon(row)}
                    >
                      {deleting === `${row.source}:${row.id}` ? "Siliniyor..." : "🗑 Kuponu Sil"}
                    </button>
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

export default function WheelCouponsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <WheelCouponsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}