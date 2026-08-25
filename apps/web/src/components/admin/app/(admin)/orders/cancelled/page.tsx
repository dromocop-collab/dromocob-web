"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { fmtTRY, type OrderDoc } from "@/lib/orders";
import { toast } from "@/components/admin/ui/toast";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./cancelled-orders.module.css";

type Row = OrderDoc & {
  id: string;
  createdAtIso?: string;
  updatedAtIso?: string;
  cancelledAtIso?: string;
};

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function getBestDate(r: any): Date | null {
  return (
    toDateSafe(r?.cancelledAt) ||
    toDateSafe(r?.cancelledAtIso) ||
    toDateSafe(r?.updatedAt) ||
    toDateSafe(r?.updatedAtIso) ||
    toDateSafe(r?.createdAt) ||
    toDateSafe(r?.createdAtIso) ||
    null
  );
}

function fmtDate(r: any) {
  const d = getBestDate(r);
  if (!d) return "Tarih bekleniyor";

  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normMoneyTotal(r: any) {
  const amt = Number(r?.total?.amount ?? 0);
  return Number.isFinite(amt) ? amt : 0;
}

function normName(r: any) {
  return String(r?.shippingAddress?.fullName || "").trim() || "İsimsiz müşteri";
}

function normEmail(r: any) {
  return String(r?.email || "").trim();
}

function normPhone(r: any) {
  return String(r?.shippingAddress?.phone || "").trim();
}

function normCity(r: any) {
  const city = String(r?.shippingAddress?.city || "").trim();
  const district = String(r?.shippingAddress?.district || "").trim();
  return [district, city].filter(Boolean).join(" / ");
}

function shortId(id: string) {
  const clean = String(id || "").trim();
  if (!clean) return "#";
  if (clean.length <= 14) return `#${clean}`;
  return `#${clean.slice(0, 6)}…${clean.slice(-6)}`;
}

function CancelledOrdersPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qText, setQText] = useState("");
  const [deletingId, setDeletingId] = useState("");

useEffect(() => {
  setLoading(true);

  const qy = query(
    collection(db, "orders"),
    where("status", "==", "cancelled")
  );

  return onSnapshot(
    qy,
    (snap) => {
      const list: Row[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      list.sort((a, b) => {
        const at = getBestDate(a)?.getTime() || 0;
        const bt = getBestDate(b)?.getTime() || 0;
        return bt - at;
      });

      setRows(list);
      setLoading(false);
    },
    () => {
      setRows([]);
      setLoading(false);
    }
  );
}, [db]);

const filtered = useMemo(() => {
  const q = qText.trim().toLowerCase();

  const result = rows.filter((r) => {
    if (!q) return true;

    const hay = [
      r.id,
      normName(r),
      normEmail(r),
      normPhone(r),
      normCity(r),
      String(r?.shippingAddress?.addressLine || ""),
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });

  return result;
}, [rows, qText]);

  async function handleHardDelete(id: string) {
    const ok = window.confirm(
      `Bu kayıt kalıcı olarak silinsin mi?\n\n${shortId(id)}\n\nBu işlem geri alınamaz.`
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      await deleteDoc(doc(db, "orders", id));
      toast.success("İptal edilmiş sipariş kalıcı olarak silindi.");
    } catch {
      toast.error("Sipariş kalıcı olarak silinemedi.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className={s.page}>
      <div className={s.top}>
        <div>
          <div className={s.kicker}>Admin • İptal Edilen Siparişler</div>
          <h1 className={s.h1}>İptal Edilen Siparişler</h1>
          <p className={s.sub}>
            Burada sadece iptal edilmiş siparişler görünür. İstersen buradan kalıcı olarak silebilirsin.
          </p>
        </div>

        <div className={s.topActions}>
          <Link href="/admin/orders" className={s.secondaryBtn}>
            ← Siparişler
          </Link>
        </div>
      </div>

      <div className={s.searchWrap}>
        <input
          className={s.search}
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Ara… (id / isim / mail / telefon / şehir)"
        />
      </div>

      {loading ? (
        <div className={s.emptyBox}>Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyBox}>İptal edilmiş sipariş bulunamadı.</div>
      ) : (
        <div className={s.grid}>
          {filtered.map((r) => (
            <article key={r.id} className={s.card}>
              <div className={s.cardTop}>
                <div>
                  <div className={s.orderId}>{shortId(r.id)}</div>
                  <div className={s.date}>{fmtDate(r)}</div>
                </div>

                <div className={s.badge}>İptal</div>
              </div>

              <div className={s.meta}>
                <div><span>Müşteri</span><b>{normName(r)}</b></div>
                <div><span>E-posta</span><b>{normEmail(r) || "—"}</b></div>
                <div><span>Telefon</span><b>{normPhone(r) || "—"}</b></div>
                <div><span>Bölge</span><b>{normCity(r) || "—"}</b></div>
                <div><span>Tutar</span><b>{fmtTRY(normMoneyTotal(r))}</b></div>
              </div>

              <div className={s.actions}>
                <Link
                  href={`/admin/orders/${encodeURIComponent(r.id)}`}
                  className={s.primaryBtn}
                >
                  Detay
                </Link>

                <button
                  type="button"
                  className={s.dangerBtn}
                  disabled={deletingId === r.id}
                  onClick={() => handleHardDelete(r.id)}
                >
                  {deletingId === r.id ? "Siliniyor..." : "Kalıcı Sil"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default function CancelledOrdersPage() {
  return (
    <AdminGate>
      <PermissionGate permission="orders">
        <CancelledOrdersPageInner />
      </PermissionGate>
    </AdminGate>
  );
}