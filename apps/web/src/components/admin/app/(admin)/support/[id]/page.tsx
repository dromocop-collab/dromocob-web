"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminSupportDetail.module.css";

type Msg = {
  id: string;
  role: "user" | "admin";
  text: string;
  createdAt?: any;
};

type QuickReply = {
  id: string;
  label: string;
  text: string;
};

const QUICK_REPLIES: QuickReply[] = [
  {
    id: "q1",
    label: "Hoş geldiniz",
    text: "Merhaba, hoş geldiniz. Size nasıl yardımcı olabilirim?",
  },
  {
    id: "q2",
    label: "Fiyat bilgisi",
    text: "Merhaba, ürünün güncel fiyatı model, gram ve kura göre değişebilir. İlgilendiğiniz ürünü paylaşırsanız net bilgi verebilirim.",
  },
  {
    id: "q3",
    label: "Stok kontrol",
    text: "Merhaba, sizin için stok durumunu kontrol ediyorum. Kısa süre içinde net bilgi paylaşacağım.",
  },
  {
    id: "q4",
    label: "WhatsApp yönlendirme",
    text: "Dilerseniz işlemi daha hızlı ilerletmek için WhatsApp üzerinden de destek sağlayabiliriz.",
  },
  {
    id: "q5",
    label: "Kapanış",
    text: "Başka bir sorunuz olursa her zaman yazabilirsiniz. Memnuniyetle yardımcı olurum.",
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
  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeOnly(v: any) {
  const ms = tsMs(v);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function getDisplayName(thread: any) {
  const name = s(thread?.name);
  const email = s(thread?.email);
  const phone = s(thread?.phone);

  if (name) return name;
  if (email) return email;
  if (phone) return phone;
  return "Ziyaretçi";
}

function buildWhatsAppLink(phone: string, text: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return `https://wa.me/${cleaned.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

function messageRole(x: any): "user" | "admin" {
  const role = s(x?.role).toLowerCase();
  const sender = s(x?.sender).toLowerCase();
  const senderType = s(x?.senderType).toLowerCase();

  if (role === "admin" || sender === "admin" || senderType === "admin") return "admin";
  return "user";
}

function sameDay(a: any, b: any) {
  const aMs = tsMs(a);
  const bMs = tsMs(b);
  if (!aMs || !bMs) return false;

  const da = new Date(aMs);
  const db = new Date(bMs);

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dayLabel(v: any) {
  const ms = tsMs(v);
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function AdminSupportDetailInner({ params }: { params: { id: string } }) {
  const db = useMemo(() => getFirebaseDb(), []);
  const threadId = decodeURIComponent(params.id || "");

  const [thread, setThread] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [selectedQuickReply, setSelectedQuickReply] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!threadId) return;
    const ref = doc(db, "support_threads", threadId);

    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setThread(null);
          return;
        }
        setThread({ id: snap.id, ...(snap.data() as any) });
      },
      () => setThread(null)
    );
  }, [db, threadId]);

  useEffect(() => {
    if (!threadId) return;

    const qy = query(
      collection(db, "support_threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: Msg[] = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            id: d.id,
            role: messageRole(x),
            text: String(x?.text || ""),
            createdAt: x?.createdAt,
          };
        });
        setMsgs(list);
      },
      () => setMsgs([])
    );
  }, [db, threadId]);

  useEffect(() => {
    if (!threadId || !thread) return;

    updateDoc(doc(db, "support_threads", threadId), {
      unreadByAdmin: 0,
      updatedAt: serverTimestamp(),
    } as any).catch(() => {});
  }, [db, threadId, thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  async function sendAdminMessage(customText?: string) {
    const clean = (customText ?? text).trim();
    if (!clean || !threadId) return;

    setBusy(true);
    setNote("");

    try {
      await addDoc(collection(db, "support_threads", threadId, "messages"), {
        role: "admin",
        sender: "admin",
        senderType: "admin",
        text: clean,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "support_threads", threadId), {
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        status: "open",
        unreadByUser: increment(1),
        unreadByAdmin: 0,
        lastText: clean,
      } as any);

      setText("");
      setSelectedQuickReply("");
      setNote("Mesaj gönderildi.");
    } catch (error) {
      console.error("support admin send error:", error);
      setNote("Mesaj gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function closeThread() {
    if (!threadId) return;
    setBusy(true);
    setNote("");
    try {
      await updateDoc(doc(db, "support_threads", threadId), {
        status: "closed",
        updatedAt: serverTimestamp(),
      } as any);
      setNote("Sohbet kapatıldı.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenThread() {
    if (!threadId) return;
    setBusy(true);
    setNote("");
    try {
      await updateDoc(doc(db, "support_threads", threadId), {
        status: "open",
        updatedAt: serverTimestamp(),
      } as any);
      setNote("Sohbet tekrar açıldı.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread() {
    if (!threadId) return;

    const ok = window.confirm("Bu thread kaydını silmek istiyor musun?");
    if (!ok) return;

    setBusy(true);
    setNote("");
    try {
      await deleteDoc(doc(db, "support_threads", threadId));
      window.location.href = "/admin/support";
    } finally {
      setBusy(false);
    }
  }

  function applyQuickReply(reply: QuickReply) {
    setSelectedQuickReply(reply.id);
    setText(reply.text);
  }

  function copyThreadId() {
    navigator.clipboard.writeText(threadId).then(() => {
      setNote("Thread ID kopyalandı.");
    }).catch(() => {
      setNote("Kopyalama başarısız.");
    });
  }

  if (!threadId || !thread) {
    return (
      <main className={styles.wrap}>
        <div className={styles.topRow}>
          <div>
            <div className={styles.kicker}>Admin • Canlı Sohbet</div>
            <h1 className={styles.h1}>Thread bulunamadı</h1>
          </div>
          <Link className={styles.back} href="/admin/support">
            ← Mesajlar
          </Link>
        </div>
      </main>
    );
  }

  const who = getDisplayName(thread);
  const phone = s(thread?.phone);
  const email = s(thread?.email);
  const status = String(thread?.status || "open");
  const page = s(thread?.page) || "-";
  const uid = s(thread?.uid) || "-";
  const sessionId = s(thread?.sessionId) || "-";
  const lastSeen = fmtTime(thread?.lastMessageAt || thread?.updatedAt || thread?.createdAt);
  const unreadByUser = Number(thread?.unreadByUser || 0);
  const unreadByAdmin = Number(thread?.unreadByAdmin || 0);
  const waText = "Merhaba, size destek olmak için buradayım.";
  const whatsappUrl = phone ? buildWhatsAppLink(phone, waText) : "";

  return (
    <main className={styles.wrap}>
      <section className={styles.topRow}>
        <div className={styles.headLeft}>
          <div className={styles.kicker}>Admin • Canlı Sohbet</div>
          <h1 className={styles.h1}>{who}</h1>

          <div className={styles.metaRow}>
            <span className={`${styles.badge} ${status === "closed" ? styles.badgeOff : styles.badgeOn}`}>
              {status === "closed" ? "Kapalı" : "Açık"}
            </span>

            {email ? <span className={styles.meta}>Mail: <b>{email}</b></span> : null}
            {phone ? <span className={styles.meta}>Tel: <b>{phone}</b></span> : null}
            <span className={styles.meta}>Son hareket: <b>{lastSeen || "-"}</b></span>
          </div>
        </div>

        <div className={styles.actionsTop}>
          <Link className={styles.back} href="/admin/support">
            ← Mesajlar
          </Link>

          <button className={styles.btnSoft} type="button" onClick={copyThreadId}>
            ID Kopyala
          </button>

          {status === "closed" ? (
            <button className={styles.btnGhost} type="button" onClick={reopenThread} disabled={busy}>
              Sohbeti Aç
            </button>
          ) : (
            <button className={styles.btnGhost} type="button" onClick={closeThread} disabled={busy}>
              Sohbeti Kapat
            </button>
          )}

          <button className={styles.btnDanger} type="button" onClick={deleteThread} disabled={busy}>
            Sil
          </button>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <div className={styles.grid}>
        <section className={styles.chatCard}>
          <div className={styles.chatHead}>
            <div>
              <div className={styles.chatTitle}>Mesaj Akışı</div>
              <div className={styles.chatSub}>Realtime • support_threads/{threadId}/messages</div>
            </div>

            <div className={styles.chatPills}>
              <span className={styles.chatMetaPill}>User unread: <b>{unreadByUser}</b></span>
              <span className={styles.chatMetaPill}>Admin unread: <b>{unreadByAdmin}</b></span>
            </div>
          </div>

          <div className={styles.quickPanel}>
            <div className={styles.quickPanelTitle}>Hazır Mesajlar</div>
            <div className={styles.quickList}>
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply.id}
                  type="button"
                  className={`${styles.quickChip} ${selectedQuickReply === reply.id ? styles.quickChipOn : ""}`}
                  onClick={() => applyQuickReply(reply)}
                >
                  {reply.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.chatBody}>
            {msgs.length === 0 ? (
              <div className={styles.empty}>Henüz mesaj yok.</div>
            ) : (
              msgs.map((m, index) => {
                const showDay = index === 0 || !sameDay(m.createdAt, msgs[index - 1]?.createdAt);

                return (
                  <div key={m.id}>
                    {showDay ? (
                      <div className={styles.dayDivider}>
                        <span>{dayLabel(m.createdAt)}</span>
                      </div>
                    ) : null}

                    <div className={`${styles.msgRow} ${m.role === "admin" ? styles.msgAdmin : styles.msgUser}`}>
                      <div className={styles.msgBubble}>
                        <div className={styles.msgTop}>
                          <span className={styles.msgRole}>
                            {m.role === "admin" ? "Admin" : who}
                          </span>
                          <span className={styles.msgTime}>{timeOnly(m.createdAt)}</span>
                        </div>
                        <div className={styles.msgText}>{m.text}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.chatComposer}>
            <textarea
              className={styles.ta}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={status === "closed" ? "Bu sohbet kapalı. Önce tekrar aç." : "Yanıt yaz…"}
              rows={4}
              disabled={status === "closed" || busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && text.trim() && status !== "closed") {
                    void sendAdminMessage();
                  }
                }
              }}
            />

            <div className={styles.composerActions}>
              <div className={styles.composerHint}>
                Enter gönderir • Shift+Enter yeni satır
              </div>

              <div className={styles.composerRight}>
                <button
                  className={styles.btnSoft}
                  type="button"
                  onClick={() => setText("")}
                  disabled={busy || !text.trim()}
                >
                  Temizle
                </button>

                <button
                  className={styles.btnSend}
                  type="button"
                  onClick={() => void sendAdminMessage()}
                  disabled={busy || !text.trim() || status === "closed"}
                  title={status === "closed" ? "Kapalı sohbete mesaj atılamaz" : "Gönder"}
                >
                  {busy ? "Gönderiliyor…" : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.sideCard}>
          <div className={styles.sideBlock}>
            <div className={styles.sideTitle}>Müşteri Bilgileri</div>
            <div className={styles.sideLine}>
              <span>Ad</span>
              <b>{who}</b>
            </div>
            <div className={styles.sideLine}>
              <span>Telefon</span>
              <b>{phone || "-"}</b>
            </div>
            <div className={styles.sideLine}>
              <span>E-posta</span>
              <b>{email || "-"}</b>
            </div>
          </div>

          <div className={styles.hr} />

          <div className={styles.sideBlock}>
            <div className={styles.sideTitle}>Oturum</div>
            <div className={styles.sideLine}>
              <span>Sayfa</span>
              <b>{page}</b>
            </div>
            <div className={styles.sideLine}>
              <span>UID</span>
              <b className={styles.mono}>{uid}</b>
            </div>
            <div className={styles.sideLine}>
              <span>Session</span>
              <b className={styles.mono}>{sessionId}</b>
            </div>
            <div className={styles.sideLine}>
              <span>Thread</span>
              <b className={styles.mono}>{threadId}</b>
            </div>
          </div>

          <div className={styles.hr} />

          <div className={styles.sideBlock}>
            <div className={styles.sideTitle}>Hızlı Aksiyonlar</div>
            <div className={styles.sideActions}>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className={styles.sideActionBtn}
                >
                  Ara
                </a>
              ) : null}

              {email ? (
                <a
                  href={`mailto:${email}`}
                  className={styles.sideActionBtn}
                >
                  Mail At
                </a>
              ) : null}

              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.sideActionBtn}
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div className={styles.hr} />

          <div className={styles.sideBlock}>
            <div className={styles.sideTitle}>Sistem Notu</div>
            <div className={styles.note}>
              Bu panel <b>support_threads</b> ve altındaki <b>messages</b> koleksiyonu üstünden canlı çalışır.
              Thread içinde <b>lastText</b>, <b>unreadByUser</b> ve <b>unreadByAdmin</b> alanları düzgün tutulursa
              liste ekranı da taş gibi akar.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function AdminSupportDetail({ params }: { params: { id: string } }) {
  return (
    <AdminGate>
      <PermissionGate permission="support">
        <AdminSupportDetailInner params={params} />
      </PermissionGate>
    </AdminGate>
  );
}