"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  increment,
  updateDoc,
  limit as qLimit,
} from "firebase/firestore";
import { onIdTokenChanged, signInAnonymously } from "firebase/auth";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase.client";
import styles from "./ChatWidget.module.css";

type ChatMsg = {
  id: string;
  role: "user" | "admin";
  text: string;
  createdAt?: any;
};

type LT = {
  tr?: string;
  en?: string;
};

type Role = "user" | "admin";

type ThreadDoc = {
  status?: "open" | "closed";
  uid?: string | null;
  sessionId?: string;
  name?: string;
  phone?: string;
  email?: string;
  page?: string;
  createdAt?: any;
  updatedAt?: any;
  lastMessageAt?: any;
  lastText?: string;
  unreadByAdmin?: number;
  unreadByUser?: number;
};

type MsgDoc = {
  role: Role;
  sender?: Role;
  senderType?: Role;
  text: string;
  createdAt?: any;
};
type OrderMini = {
  id: string;
  status?: string;
  total?: { amount?: number; currency?: string } | number;
  createdAt?: any;
  createdAtIso?: string;
  items?: Array<{
    title?: { tr?: string; en?: string } | string;
    qty?: number;
    sku?: string;
  }>;
};

function accountThreadId(uid: string) {
  return `account_${String(uid || "").trim()}`;
}

function moneyAmount(v: any) {
  const n = Number(v?.amount ?? v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtTry(v: any) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(moneyAmount(v));
  } catch {
    return `${moneyAmount(v).toFixed(2)} TRY`;
  }
}

function statusLabel(raw: any) {
  const v = String(raw || "").trim().toLowerCase();

  const map: Record<string, string> = {
    draft: "Taslak",
    pending_payment: "Ödeme Bekliyor",
    paid: "Ödendi",
    preparing: "Hazırlanıyor",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal",
    refunded: "İade",
  };

  return map[v] || v || "Durum yok";
}

function pickOrderFirstItem(order: OrderMini, loc: "tr" | "en") {
  const first = Array.isArray(order.items) ? order.items[0] : null;
  if (!first) return "";

  const title: any = first.title;

  if (typeof title === "string") return title;

  return loc === "en"
    ? String(title?.en || title?.tr || "").trim()
    : String(title?.tr || title?.en || "").trim();
}

function orderCreatedMs(order: OrderMini) {
  return toMs(order.createdAt) || Date.parse(String(order.createdAtIso || "")) || 0;
}

function buildOrderSupportMessage(order: OrderMini, loc: "tr" | "en") {
  const itemTitle = pickOrderFirstItem(order, loc);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;

  if (loc === "en") {
    return [
      `Hello, I need support for my order.`,
      `Order No: #${order.id}`,
      `Status: ${statusLabel(order.status)}`,
      `Total: ${fmtTry(order.total)}`,
      itemTitle ? `Product: ${itemTitle}${itemCount > 1 ? ` +${itemCount - 1}` : ""}` : "",
      `Order link: /account/orders/${order.id}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Merhaba, bu siparişimle ilgili destek almak istiyorum.`,
    `Sipariş No: #${order.id}`,
    `Durum: ${statusLabel(order.status)}`,
    `Tutar: ${fmtTry(order.total)}`,
    itemTitle ? `Ürün: ${itemTitle}${itemCount > 1 ? ` +${itemCount - 1}` : ""}` : "",
    `Sipariş linki: /account/orders/${order.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}
function s(v: any) {
  return String(v ?? "").trim();
}

function normalizeWhatsAppHref(value: any) {
  const raw = s(value);
  if (!raw) return "https://wa.me/905304788298";
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "https://wa.me/905304788298";
}

function pickLT(loc: "tr" | "en", v: any, fbTR = "", fbEN = ""): string {
  if (typeof v === "string") return v.trim();

  const tr = s(v?.tr) || fbTR;
  const en = s(v?.en) || fbEN;

  return loc === "en" ? en : tr;
}

function getOrCreateSessionId() {
  const key = "nci_chat_session_v1";

  try {
    const cur = localStorage.getItem(key);
    if (cur) return cur;

    const v = `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, v);

    return v;
  } catch {
    return `anon_${Date.now()}`;
  }
}

function getStoredThreadId(sessionId: string) {
  const key = `nci_chat_thread_${sessionId}`;

  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function storeThreadId(sessionId: string, threadId: string) {
  const key = `nci_chat_thread_${sessionId}`;

  try {
    localStorage.setItem(key, threadId);
  } catch {}
}

function removeStoredThreadId(sessionId: string) {
  const key = `nci_chat_thread_${sessionId}`;

  try {
    localStorage.removeItem(key);
  } catch {}
}

function toMs(ts: any) {
  try {
    if (!ts) return 0;
    if (ts?.toMillis) return Number(ts.toMillis());
    if (typeof ts === "number") return ts;
    return 0;
  } catch {
    return 0;
  }
}

export default function ChatWidget({ loc = "tr" }: { loc?: "tr" | "en" }) {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [enabled, setEnabled] = useState(true);

  const [cfgTitle, setCfgTitle] = useState<LT>({
    tr: "Cihat Erdem Canlı Stüdyo",
    en: "Cihat Erdem Live Studio",
  });

  const [cfgSub, setCfgSub] = useState<LT>({
    tr: "Projenizi birlikte netleştirelim.",
    en: "Let's shape your project together.",
  });

  const [cfgPh, setCfgPh] = useState<LT>({
    tr: "Nasıl bir web deneyimi arıyorsunuz?",
    en: "What kind of web experience do you need?",
  });

  const [wa, setWa] = useState("");
  const [ig, setIg] = useState("");

  const [isOnline, setIsOnline] = useState(true);

  const [onlineLabel, setOnlineLabel] = useState<LT>({
    tr: "Çevrimiçi",
    en: "Online",
  });

  const [offlineLabel, setOfflineLabel] = useState<LT>({
    tr: "Çevrimdışı",
    en: "Offline",
  });

  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [isAnonymousUser, setIsAnonymousUser] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [threadId, setThreadId] = useState("");
  const [_chatMode, setChatMode] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [welcomeShown, setWelcomeShown] = useState(false);

  const [toastKind, setToastKind] = useState<"ok" | "err">("ok");
  const [toast, setToast] = useState("");
const [orders, setOrders] = useState<OrderMini[]>([]);
const [ordersLoading, setOrdersLoading] = useState(false);
const [selectedOrderId, setSelectedOrderId] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
const panelRef = useRef<HTMLDivElement | null>(null);
const chatScrollLockY = useRef<number | null>(null);

useEffect(() => {
  if (typeof window === "undefined") return;

  const html = document.documentElement;
  const body = document.body;

  if (!open) {
    return;
  }

  const lockedY = window.scrollY || window.pageYOffset || 0;
  chatScrollLockY.current = lockedY;

  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevBodyTouchAction = body.style.touchAction;
  const prevBodyOverscroll = body.style.overscrollBehavior;

  html.classList.add("nci-chat-open");
  body.classList.add("nci-chat-open");

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.touchAction = "none";
  body.style.overscrollBehavior = "none";

  const isInsidePanel = (target: EventTarget | null) => {
    const panel = panelRef.current;
    return !!panel && target instanceof Node && panel.contains(target);
  };

  const preventOutsideTouchMove = (e: TouchEvent) => {
    if (isInsidePanel(e.target)) return;
    e.preventDefault();
  };

  const preventOutsideWheel = (e: WheelEvent) => {
    if (isInsidePanel(e.target)) return;
    e.preventDefault();
  };

  document.addEventListener("touchmove", preventOutsideTouchMove, {
    passive: false,
  });

  document.addEventListener("wheel", preventOutsideWheel, {
    passive: false,
  });

  return () => {
    document.removeEventListener("touchmove", preventOutsideTouchMove);
    document.removeEventListener("wheel", preventOutsideWheel);

    html.classList.remove("nci-chat-open");
    body.classList.remove("nci-chat-open");

    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    body.style.touchAction = prevBodyTouchAction;
    body.style.overscrollBehavior = prevBodyOverscroll;

    const y = chatScrollLockY.current;
    if (typeof y === "number") {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }

    chatScrollLockY.current = null;
  };
}, [open]);
  const title = pickLT(loc, cfgTitle, "İletişim", "Support");
  const subtitle = pickLT(
    loc,
    cfgSub,
    "Projenizi birlikte netleştirelim.",
    "Let's shape your project together."
  );
  const placeholder = pickLT(loc, cfgPh, "Nasıl bir web deneyimi arıyorsunuz?", "What kind of web experience do you need?");

  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const supportStatusText = pickLT(
    loc,
    isOnline ? onlineLabel : offlineLabel,
    "Çevrimiçi",
    "Online"
  );

  function resetChatState(clearStored = false) {
    setThreadId("");
    setMsgs([]);
    setChatMode(false);
    setUnread(0);

    if (clearStored) {
      removeStoredThreadId(sessionId);
    }
  }

  function fireToast(t: string, kind: "ok" | "err" = "ok") {
    setToastKind(kind);
    setToast(t);

    window.clearTimeout((fireToast as any)._t);
    (fireToast as any)._t = window.setTimeout(() => setToast(""), 1600);
  }

  useEffect(() => {
    const handleOpenChat = (event: Event) => {
      setOpen(true);

      const custom = event as CustomEvent<{
        message?: string;
      }>;

      const presetMessage = custom?.detail?.message;

      if (presetMessage && typeof presetMessage === "string") {
        setText(presetMessage);
      }
    };

    window.addEventListener("chat:open", handleOpenChat as EventListener);

    return () => {
      window.removeEventListener("chat:open", handleOpenChat as EventListener);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!alive) return;

      if (u) {
        setUid(u.uid);
        setIsAnonymousUser(Boolean(u.isAnonymous));
        return;
      }

      try {
        const cred = await signInAnonymously(auth);

        if (!alive) return;

        setUid(cred.user.uid);
        setIsAnonymousUser(true);
      } catch (e: any) {
        console.warn("anon auth unavailable", e?.code || e?.message || e);

        if (!alive) return;

        setUid(null);
        setIsAnonymousUser(true);

        fireToast(
          loc === "en"
            ? "Chat is temporarily unavailable."
            : "Canlı destek şu an kullanılamıyor.",
          "err"
        );
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [auth, loc]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "site_options", "chat_widget"));

        if (!alive) return;

        const d: any = snap.exists() ? snap.data() : null;

        setEnabled(d?.controlVersion === "studio-contact-2026" ? d?.enabled !== false : true);
        const legacyTitle = s(d?.title?.tr) === "İletişim";
        const legacySubtitle = s(d?.subtitle?.tr) === "Hızlıca yaz, hemen dönüş yapalım.";
        const legacyPlaceholder = s(d?.placeholder?.tr) === "Mesajını yaz…";

        setCfgTitle(!legacyTitle && d?.title ? d.title : { tr: "Cihat Erdem Canlı Stüdyo", en: "Cihat Erdem Live Studio" });
        setCfgSub(
          !legacySubtitle && d?.subtitle ? d.subtitle : {
            tr: "Projenizi birlikte netleştirelim.",
            en: "Let's shape your project together.",
          }
        );
        setCfgPh(
          !legacyPlaceholder && d?.placeholder ? d.placeholder : {
            tr: "Nasıl bir web deneyimi arıyorsunuz?",
            en: "What kind of web experience do you need?",
          }
        );

        setWa(normalizeWhatsAppHref(d?.quick?.whatsapp));
        setIg(String(d?.quick?.instagram || "").trim());

        setIsOnline(d?.isOnline !== false);
        setOnlineLabel(d?.onlineLabel || { tr: "Çevrimiçi", en: "Online" });
        setOfflineLabel(d?.offlineLabel || { tr: "Çevrimdışı", en: "Offline" });
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
  if (!uid) {
    resetChatState(false);
    return;
  }

  if (!isAnonymousUser) {
    const tid = accountThreadId(uid);
    setThreadId(tid);
    setChatMode(false);
    setUnread(0);
    return;
  }

  const stored = getStoredThreadId(sessionId);
  if (stored) {
    setThreadId(stored);
  }
}, [uid, isAnonymousUser, sessionId]);

useEffect(() => {
  if (!uid || isAnonymousUser) {
    setOrders([]);
    setSelectedOrderId("");
    setOrdersLoading(false);
    return;
  }

  setOrdersLoading(true);

  const qy = query(
    collection(db, "orders"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    qLimit(8)
  );

  const unsub = onSnapshot(
    qy,
    (snap) => {
      const list: OrderMini[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setOrders(list);
      setSelectedOrderId((cur) => {
        if (cur && list.some((x) => x.id === cur)) return cur;
        return list[0]?.id || "";
      });

      setOrdersLoading(false);
    },
    (err) => {
      console.warn("chat orders load error:", err?.code || err?.message || err);
      setOrders([]);
      setSelectedOrderId("");
      setOrdersLoading(false);
    }
  );

  return () => unsub();
}, [db, uid, isAnonymousUser]);

  useEffect(() => {
    if (!threadId) return;

    const tref = doc(db, "support_threads", threadId);

    return onSnapshot(
      tref,
      (snap) => {
        if (!snap.exists()) return;

        const d: any = snap.data();

const ownerUid = String(d?.uid || "").trim();
if (uid && ownerUid && ownerUid !== String(uid)) {
  console.warn("chat thread owner mismatch, clearing stored thread", {
    threadId,
    ownerUid,
    currentUid: uid,
  });

  resetChatState(true);
  return;
}

const n = Number(d?.unreadByUser ?? 0);
setUnread(Number.isFinite(n) ? n : 0);

        if (!welcomeShown && (d?.lastMessageAt || d?.createdAt)) {
          setWelcomeShown(true);
        }
      },
      (e: any) => {
        // Thread henüz oluşmamış veya eski anon uid'ye ait — beklenen durum
        if (e?.code === "permission-denied" || e?.code === "not-found") {
          resetChatState(true);
          return;
        }

        console.warn("thread meta listen error:", e?.code || e?.message || e);
      }
    );
  }, [db, threadId, welcomeShown, sessionId]);

  useEffect(() => {
    if (!open || !threadId) return;

    const qy = query(
      collection(db, "support_threads", threadId, "messages"),
      orderBy("createdAt", "asc"),
      qLimit(120)
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: ChatMsg[] = [];

        snap.forEach((d) => {
          const x: any = d.data();

          list.push({
            id: d.id,
            role: x?.role === "admin" ? "admin" : "user",
            text: String(x?.text || "").trim(),
            createdAt: x?.createdAt,
          });
        });

        setMsgs(list);
        setChatMode(list.length > 0);

       if (uid && threadId) {
  updateDoc(doc(db, "support_threads", threadId), {
    unreadByUser: 0,
  }).catch((err) => {
    // Thread silinmiş/eski anon uid’ye aitse kullanıcıyı rahatsız etmeyelim.
    console.warn("mark user read skipped:", err?.code || err?.message || err);

    if (err?.code === "permission-denied" || err?.code === "not-found") {
      resetChatState(true);
    }
  });
}
      },
      (e: any) => {
        console.error("messages listen error", e);

        if (e?.code === "permission-denied") {
          resetChatState(true);
        }
      }
    );
  }, [db, open, threadId, uid, sessionId]);

  useEffect(() => {
    if (!open) return;

    const el = listRef.current;
    if (!el) return;

    const t = window.setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 60);

    return () => window.clearTimeout(t);
  }, [msgs, open]);

async function ensureThread(): Promise<string> {
  if (!uid) {
    throw new Error(loc === "en" ? "Auth required" : "Oturum gerekli");
  }

  // Kayıtlı kullanıcı: her cihazda, her tarayıcıda tek konuşma.
  if (!isAnonymousUser) {
    const tid = accountThreadId(uid);
    const ref = doc(db, "support_threads", tid);

    const snap = await getDoc(ref);

    await setDoc(
      ref,
      {
        status: "open",
        uid,
        sessionId,
        page: typeof window !== "undefined" ? window.location.pathname : "",
        name: s(auth.currentUser?.displayName || ""),
        phone: "",
        email: s(auth.currentUser?.email || ""),
        updatedAt: serverTimestamp(),
        ...(snap.exists()
          ? {}
          : {
              createdAt: serverTimestamp(),
              lastMessageAt: null,
              lastText: "",
              unreadByAdmin: 0,
              unreadByUser: 0,
            }),
      } as ThreadDoc,
      { merge: true }
    );

    setThreadId(tid);
    return tid;
  }

  // Misafir kullanıcı: cihaz/session bazlı devam.
  const currentThreadId = threadId.trim();

  if (currentThreadId) {
    try {
      const currentRef = doc(db, "support_threads", currentThreadId);
      const currentSnap = await getDoc(currentRef);

      if (currentSnap.exists()) {
        const d: any = currentSnap.data();
        const ownerUid = String(d?.uid || "").trim();

        if (!ownerUid || ownerUid === String(uid)) {
          return currentThreadId;
        }
      }
    } catch {}

    resetChatState(true);
  }

  const stored = getStoredThreadId(sessionId).trim();

  if (stored) {
    try {
      const storedRef = doc(db, "support_threads", stored);
      const storedSnap = await getDoc(storedRef);

      if (storedSnap.exists()) {
        const d: any = storedSnap.data();
        const ownerUid = String(d?.uid || "").trim();

        if (!ownerUid || ownerUid === String(uid)) {
          setThreadId(stored);
          return stored;
        }
      }

      removeStoredThreadId(sessionId);
    } catch {
      removeStoredThreadId(sessionId);
    }
  }

  const ref = await addDoc(collection(db, "support_threads"), {
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: null,
    lastText: "",
    unreadByAdmin: 0,
    unreadByUser: 0,
    uid,
    sessionId,
    page: typeof window !== "undefined" ? window.location.pathname : "",
    name: s(name),
    phone: s(phone),
    email: s(email),
  } as ThreadDoc);

  storeThreadId(sessionId, ref.id);
  setThreadId(ref.id);

  return ref.id;
}
function attachSelectedOrderToMessage() {
  const order = orders.find((x) => x.id === selectedOrderId);

  if (!order) {
    fireToast(
      loc === "en" ? "Please select an order." : "Lütfen bir sipariş seç.",
      "err"
    );
    return;
  }

  const msg = buildOrderSupportMessage(order, loc);

  setText((cur) => {
    const cleanCur = String(cur || "").trim();
    return cleanCur ? `${cleanCur}\n\n${msg}` : msg;
  });

  setOpen(true);
  fireToast(loc === "en" ? "Order added ✅" : "Sipariş mesaja eklendi ✅");
}
  async function sendMessage() {
    const clean = text.trim();

    if (!clean) {
      fireToast(
        loc === "en" ? "Please type a message." : "Lütfen bir mesaj yaz.",
        "err"
      );
      return;
    }

    setSending(true);

    try {
      const tid = await ensureThread();
      const threadRef = doc(db, "support_threads", tid);

      const threadSnap = await getDoc(threadRef);
      const isNewThreadMeta = !threadSnap.exists();

   await setDoc(
  threadRef,
  {
    status: "open",
    uid,
    sessionId,
    page: typeof window !== "undefined" ? window.location.pathname : "",
    name: isAnonymousUser
  ? s(name)
  : s(auth.currentUser?.displayName || ""),

phone: isAnonymousUser ? s(phone) : "",

email: isAnonymousUser
  ? s(email)
  : s(auth.currentUser?.email || ""),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastText: clean,
    unreadByAdmin: increment(1),
    unreadByUser: 0,
    ...(isNewThreadMeta ? { createdAt: serverTimestamp() } : {}),
  },
  { merge: true }
);

      await addDoc(collection(db, "support_threads", tid, "messages"), {
        role: "user",
        sender: "user",
        senderType: "user",
        text: clean,
        createdAt: serverTimestamp(),
      } as MsgDoc);

      setText("");
      setChatMode(true);
      fireToast(loc === "en" ? "Sent ✅" : "Gönderildi ✅");
    } catch (e: any) {
      console.error("chat send error:", e);

      fireToast(
        e?.message || (loc === "en" ? "Could not send." : "Gönderilemedi"),
        "err"
      );
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (!sending) {
        sendMessage();
      }
    }
  }

  if (!enabled) return null;

  const hasChat = msgs.length > 0;
  const lastAt = msgs.length ? toMs(msgs[msgs.length - 1]?.createdAt) : 0;

  return (
  <div data-chat-widget-root>
   <button
  type="button"
  data-chat-launcher
  className={`${styles.bubble} ${open ? styles.bubbleOn : ""}`}
  onClick={() => setOpen((v) => !v)}
  aria-label={loc === "en" ? "Open support chat" : "Canlı desteği aç"}
>
  <span className={styles.bubbleAura} aria-hidden="true" />
  <span className={styles.bubbleIcon} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/dromocob-app-icon-192.png" alt="" />
  </span>
  <span className={styles.bubbleCopy} aria-hidden="true">
    <b>Canlı stüdyo</b>
    <small>Birlikte tasarlayalım</small>
  </span>

  <span className={styles.onlineDot} aria-hidden="true" />

  {unread > 0 ? (
    <span className={styles.badge}>{unread > 9 ? "9+" : unread}</span>
  ) : null}
</button>

      <div data-nosnippet>
       <div
  ref={panelRef}
  className={`${styles.panel} ${open ? styles.panelOn : ""}`}
  role="dialog"
  aria-modal="true"
>
          <div className={styles.panelTop}>
            <div className={styles.panelIdentity}>
              <span className={styles.panelBrandMark}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/dromocob-app-icon-192.png" alt="" />
              </span>
              <div>
                <div className={styles.panelTitle}>{title}</div>
                <div className={styles.panelSub}>{subtitle}</div>
              </div>
            </div>

            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className={styles.chatShell}>
            <div className={styles.msgList} ref={listRef}>
              {!hasChat ? (
                <div className={styles.leadHint}>
                  {loc === "en"
                    ? "Send the first message to start live chat."
                    : "İlk mesajı gönderince canlı sohbet başlar."}
                </div>
              ) : null}

              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.msgRow} ${
                    m.role === "user" ? styles.msgUser : styles.msgAdmin
                  }`}
                >
                  <div className={styles.msgBubble}>
                    <div className={styles.msgMeta}>
                      {m.role === "admin" ? "Admin" : loc === "en" ? "You" : "Sen"}
                    </div>
                    <div className={styles.msgText}>{m.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.composer}>
              {!hasChat && isAnonymousUser ? (
                <div className={styles.form}>
                  <div className={styles.grid2}>
                    <label className={styles.field}>
                      <span>{loc === "en" ? "Name" : "Ad"}</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Adınız"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>{loc === "en" ? "Phone" : "Telefon"}</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="05.."
                      />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span>{loc === "en" ? "Email (optional)" : "E-posta (opsiyonel)"}</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mail@..."
                    />
                  </label>
                </div>
              ) : null}

              {!hasChat ? (
                <div className={styles.welcome}>
                  <div className={styles.welcomeBubble}>
                    <b>Merhaba, Cihat Erdem Studio&apos;ya hoş geldiniz 👋</b>
                    <br />
                    {isAnonymousUser
                      ? "Sektörünüzü ve hedefinizi birkaç cümleyle anlatın; doğru demo ve çözümle başlayalım."
                      : "Projenizi yazın, stüdyo ekibimiz konuşmaya kaldığı yerden devam etsin."}
                  </div>
                </div>
              ) : null}
{!isAnonymousUser ? (
  <div className={styles.orderPicker}>
    <div className={styles.orderPickerHead}>
      <div>
        <b>{loc === "en" ? "Order support" : "Sipariş desteği"}</b>
        <span>
          {loc === "en"
            ? "Select an order and attach it to your message."
            : "Sipariş seç, mesajına otomatik eklensin."}
        </span>
      </div>
    </div>

    {ordersLoading ? (
      <div className={styles.orderEmpty}>
        {loc === "en" ? "Loading orders..." : "Siparişler yükleniyor..."}
      </div>
    ) : orders.length ? (
      <div className={styles.orderPickerRow}>
        <select
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className={styles.orderSelect}
        >
          {orders.map((order) => {
            const firstItem = pickOrderFirstItem(order, loc);
            const created = orderCreatedMs(order);

            return (
              <option key={order.id} value={order.id}>
                #{order.id.slice(0, 8).toUpperCase()} • {statusLabel(order.status)} •{" "}
                {fmtTry(order.total)}
                {firstItem ? ` • ${firstItem}` : ""}
                {created ? ` • ${new Date(created).toLocaleDateString("tr-TR")}` : ""}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          className={styles.orderAttachBtn}
          onClick={attachSelectedOrderToMessage}
        >
          {loc === "en" ? "Attach" : "Ekle"}
        </button>
      </div>
    ) : (
      <div className={styles.orderEmpty}>
        {loc === "en"
          ? "No orders found in this account yet."
          : "Bu hesapta henüz sipariş bulunamadı."}
      </div>
    )}
  </div>
) : null}
              <label className={styles.field}>
                <span className={styles.fieldLabelRow}>
                  <b>{loc === "en" ? "Message" : "Mesaj"}</b>

                  {hasChat && lastAt ? (
                    <i className={styles.lastSeen}>
                      {loc === "en" ? "Live" : "Canlı"} •{" "}
                      {new Date(lastAt).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </i>
                  ) : null}
                </span>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={placeholder}
                  onKeyDown={onKeyDown}
                />
              </label>

              <button
                type="button"
                className={styles.sendBtn}
                onClick={sendMessage}
                disabled={sending}
              >
                {sending
                  ? loc === "en"
                    ? "Sending…"
                    : "Gönderiliyor…"
                  : loc === "en"
                    ? "Send"
                    : "Gönder"}
              </button>

              {wa || ig ? (
                <div className={styles.quickRow}>
                  {wa ? (
                    <a
                      className={styles.quick}
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : null}

                  {ig ? (
                    <a
                      className={styles.quick}
                      href={ig}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.supportStatus}>
                <span
                  className={`${styles.supportStatusDot} ${
                    isOnline
                      ? styles.supportStatusDotOn
                      : styles.supportStatusDotOff
                  }`}
                />
                <span className={styles.supportStatusText}>{supportStatusText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`${styles.toast} ${toast ? styles.toastOn : ""} ${
          toast ? (toastKind === "ok" ? styles.toastOk : styles.toastErr) : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
     </div>
  );
}
