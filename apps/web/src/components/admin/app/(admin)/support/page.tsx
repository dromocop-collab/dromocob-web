"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminSupportPage.module.css";

type ThreadRow = {
  id: string;
  createdAt?: any;
  updatedAt?: any;
  lastMessageAt?: any;
  status?: "open" | "closed";
  name?: string;
  phone?: string;
  email?: string;
  page?: string;
  sessionId?: string;
  uid?: string | null;
  unreadByAdmin?: number;
  unreadByUser?: number;
  lastText?: string;
};

type QuickReply = {
  id: string;
  label: string;
  text: string;
};

const QUICK_REPLIES: QuickReply[] = [
  {
    id: "qr_1",
    label: "Hoş geldiniz",
    text: "Merhaba, hoş geldiniz. Size nasıl yardımcı olabilirim?",
  },
  {
    id: "qr_2",
    label: "Ürün bilgisi",
    text: "Merhaba, ürünle ilgili detaylı bilgi verebilirim. Hangi model için bilgi istersiniz?",
  },
  {
    id: "qr_3",
    label: "Fiyat bilgisi",
    text: "Merhaba, güncel fiyat bilgisi ürün gramı ve kura göre değişebilir. İlgilendiğiniz modeli paylaşabilir misiniz?",
  },
  {
    id: "qr_4",
    label: "Stok kontrol",
    text: "Merhaba, sizin için stok durumunu kontrol ediyorum. Kısa süre içinde net bilgi paylaşacağım.",
  },
  {
    id: "qr_5",
    label: "WhatsApp yönlendirme",
    text: "Dilerseniz işlemi daha hızlı ilerletmek için WhatsApp üzerinden de destek sağlayabiliriz.",
  },
  {
    id: "qr_6",
    label: "Kapanış",
    text: "Başka bir sorunuz olursa buradayım. İyi günler dilerim.",
  },
];

function s(v: any) {
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

function fmtTime(v: any) {
  const ms = tsMs(v);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(v: any) {
  const ms = tsMs(v);
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  if (hour < 24) return `${hour} sa önce`;
  return `${day} gün önce`;
}

function getThreadDisplayName(r: ThreadRow) {
  const name = s(r.name);
  const email = s(r.email);

  if (name) return name;
  if (email) return email;

  return "Ziyaretçi";
}

function getSecondaryIdentity(r: ThreadRow) {
  const name = s(r.name);
  const email = s(r.email);
  const phone = s(r.phone);

  if (name && email) return email;
  if ((name || email) && phone) return phone;

  return "";
}

function getThreadPreview(r: ThreadRow) {
  const text = s(r.lastText);
  if (!text) return "Henüz son mesaj özeti yok. Thread içinden detayları açabilirsin.";
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

export default function AdminSupportPage() {
  return (
    <AdminGate>
      <PermissionGate permission="support">
        <AdminSupportPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function AdminSupportPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<ThreadRow[]>([]);
  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "unread">("all");
  const [busyId, setBusyId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const qy = query(collection(db, "support_threads"), orderBy("lastMessageAt", "desc"));
    return onSnapshot(
      qy,
      (snap) => {
        const list: ThreadRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRows(list);
      },
      () => setRows([])
    );
  }, [db]);

  const stats = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((x) => String(x.status || "open") !== "closed").length;
    const closed = rows.filter((x) => String(x.status || "open") === "closed").length;
    const unread = rows.reduce((acc, r) => acc + Number(r.unreadByAdmin || 0), 0);
    return { total, open, closed, unread };
  }, [rows]);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();

    return rows.filter((r) => {
      const status = String(r.status || "open");
      const unread = Number(r.unreadByAdmin || 0);

      if (statusFilter === "open" && status === "closed") return false;
      if (statusFilter === "closed" && status !== "closed") return false;
      if (statusFilter === "unread" && unread <= 0) return false;

      if (!t) return true;

      const hay = [
        s(r.name),
        s(r.phone),
        s(r.email),
        s(r.page),
        s(r.sessionId),
        s(r.uid),
        s(r.lastText),
        s(r.id),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(t);
    });
  }, [rows, qText, statusFilter]);

  async function toggleThreadStatus(row: ThreadRow) {
    const nextStatus = String(row.status || "open") === "closed" ? "open" : "closed";
    setBusyId(row.id);
    setNote("");

    try {
      await updateDoc(doc(db, "support_threads", row.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setNote(nextStatus === "closed" ? "Thread kapatıldı." : "Thread tekrar açıldı.");
    } catch (error) {
      console.error("support thread status update error:", error);
      setNote("Thread durumu güncellenemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function sendQuickReply(row: ThreadRow, reply: QuickReply) {
    setBusyId(row.id);
    setNote("");

    try {
      await addDoc(collection(db, "support_threads", row.id, "messages"), {
        sender: "admin",
        senderType: "admin",
        text: reply.text,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "support_threads", row.id), {
        lastText: reply.text,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadByUser: Number(row.unreadByUser || 0) + 1,
        status: "open",
      });

      setNote(`Hazır mesaj gönderildi: ${reply.label}`);
    } catch (error) {
      console.error("support quick reply send error:", error);
      setNote("Hazır mesaj gönderilemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteThread(row: ThreadRow) {
    const ok = window.confirm(
      `"${getThreadDisplayName(row)}" thread kaydını silmek istiyor musun?\n\nBu işlem yalnızca thread dokümanını siler.`
    );
    if (!ok) return;

    setBusyId(row.id);
    setNote("");

    try {
      await deleteDoc(doc(db, "support_threads", row.id));
      setNote("Thread silindi.");
    } catch (error) {
      console.error("support thread delete error:", error);
      setNote("Thread silinemedi.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.kicker}>Admin • İletişim Merkezi</div>
          <h1 className={styles.h1}>Canlı Sohbet</h1>
          <p className={styles.sub}>
            Tüm destek konuşmalarını tek panelden izle, okunmamışları yakala, thread aç kapa,
            hazır cevap gönder ve gerekirse direkt temizle.
          </p>

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Toplam</span>
              <b className={styles.statValue}>{stats.total}</b>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Açık</span>
              <b className={styles.statValue}>{stats.open}</b>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Kapalı</span>
              <b className={styles.statValue}>{stats.closed}</b>
            </div>
            <div className={`${styles.statCard} ${styles.statAccent}`}>
              <span className={styles.statLabel}>Okunmamış</span>
              <b className={styles.statValue}>{stats.unread}</b>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              placeholder="Ara: isim / mail / telefon / sayfa / thread"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
            />
          </div>

          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === "all" ? styles.filterBtnOn : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              Tümü
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === "open" ? styles.filterBtnOn : ""}`}
              onClick={() => setStatusFilter("open")}
            >
              Açık
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === "closed" ? styles.filterBtnOn : ""}`}
              onClick={() => setStatusFilter("closed")}
            >
              Kapalı
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === "unread" ? styles.filterBtnOn : ""}`}
              onClick={() => setStatusFilter("unread")}
            >
              Okunmamış
            </button>
          </div>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <section className={styles.listWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Sonuç bulunamadı</div>
            <div className={styles.emptySub}>
              Filtreyi değiştir ya da yeni mesaj gelmesini bekle. Sistem boşsa burada thread görünmez.
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((r) => {
              const status = String(r.status || "open");
              const unread = Number(r.unreadByAdmin || 0);
              const timeFull = fmtTime(r.lastMessageAt || r.updatedAt || r.createdAt);
              const timeRel = relTime(r.lastMessageAt || r.updatedAt || r.createdAt);
              const isBusy = busyId === r.id;

              return (
                <article
                  key={r.id}
                  className={`${styles.card} ${unread > 0 ? styles.cardUnread : ""}`}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.personWrap}>
                      <div className={styles.avatar}>
                        {getThreadDisplayName(r).slice(0, 1).toUpperCase()}
                      </div>

                      <div className={styles.personMeta}>
                        <div className={styles.titleRow}>
                          <span className={styles.name}>{getThreadDisplayName(r)}</span>

                          {getSecondaryIdentity(r) ? (
                            <>
                              <span className={styles.dot}>•</span>
                              <span className={styles.secondaryId}>{getSecondaryIdentity(r)}</span>
                            </>
                          ) : null}

                          {unread > 0 ? (
                            <span className={styles.unread}>{unread}</span>
                          ) : null}
                        </div>

                        <div className={styles.metaLine}>
                          <span>Sayfa: <b>{s(r.page) || "-"}</b></span>
                          {s(r.sessionId) ? <span>Session: <b>{s(r.sessionId)}</b></span> : null}
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardRight}>
                      <span className={styles.timeRel}>{timeRel || "-"}</span>
                      <span className={styles.timeFull}>{timeFull || ""}</span>
                      <span
                        className={`${styles.badge} ${
                          status === "closed" ? styles.badgeOff : styles.badgeOn
                        }`}
                      >
                        {status === "closed" ? "Kapalı" : "Açık"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.preview}>{getThreadPreview(r)}</div>

                  <div className={styles.quickReplyRow}>
                    {QUICK_REPLIES.map((reply) => (
                      <button
                        key={reply.id}
                        type="button"
                        className={styles.quickReplyBtn}
                        onClick={() => sendQuickReply(r, reply)}
                        disabled={isBusy}
                        title={reply.text}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.cardBottom}>
                    <div className={styles.threadId}>
                      Thread: <span className={styles.mono}>{r.id}</span>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => toggleThreadStatus(r)}
                        disabled={isBusy}
                      >
                        {status === "closed" ? "Aç" : "Kapat"}
                      </button>

                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionDanger}`}
                        onClick={() => handleDeleteThread(r)}
                        disabled={isBusy}
                      >
                        Sil
                      </button>

                      <Link
                        href={`/admin/support/${encodeURIComponent(r.id)}`}
                        className={styles.openLink}
                      >
                        Sohbeti Aç →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}