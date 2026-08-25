"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminNotifications.module.css";

type NotificationType =
  | "campaign"
  | "order"
  | "stock"
  | "announcement"
  | "manual";

type NotificationStatus = "queued" | "done" | "failed" | "processing";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  image: string;
  url: string;
  type: NotificationType;
  status: NotificationStatus;
  sentCount: number;
  failedCount: number;
  testMode: boolean;
  createdAt?: Timestamp | null;
  sentAt?: Timestamp | null;
  createdBy?: string;
};

type FormState = {
  title: string;
  body: string;
  image: string;
  url: string;
  type: NotificationType;
  testMode: boolean;
};

type TemplateItem = {
  id: string;
  name: string;
  description: string;
  data: FormState;
};

const DEFAULT_FORM: FormState = {
  title: "",
  body: "",
  image: "",
  url: "/",
  type: "campaign",
  testMode: false,
};

const READY_TEMPLATES: TemplateItem[] = [
  {
    id: "campaign_flash",
    name: "Flash Kampanya",
    description: "Kampanya / shop yönlendirmesi",
    data: {
      title: "Yeni kampanya başladı",
      body: "Seçili ürünlerde özel fırsatlar seni bekliyor. Hemen incele.",
      image: "",
      url: "/shop",
      type: "campaign",
      testMode: false,
    },
  },
  {
    id: "stock_back",
    name: "Stok Geri Geldi",
    description: "Stok bildirimi akışı",
    data: {
      title: "Beklediğin ürün yeniden stokta",
      body: "Takip ettiğin ürün yeniden satışta. Tükenmeden göz at.",
      image: "",
      url: "/favorites",
      type: "stock",
      testMode: false,
    },
  },
  {
    id: "order_update",
    name: "Sipariş Güncellemesi",
    description: "Sipariş ekranına yönlendir",
    data: {
      title: "Sipariş durumun güncellendi",
      body: "Siparişinin son durumunu görüntülemek için hesabına göz at.",
      image: "",
      url: "/hesabim?tab=orders",
      type: "order",
      testMode: false,
    },
  },
  {
    id: "announcement_general",
    name: "Genel Duyuru",
    description: "Duyuru / landing yönlendirmesi",
    data: {
      title: "Yeni duyuru yayında",
      body: "Mağaza ve koleksiyonlarla ilgili son gelişmeleri şimdi incele.",
      image: "",
      url: "/",
      type: "announcement",
      testMode: false,
    },
  },
  {
    id: "manual_test",
    name: "Test Bildirimi",
    description: "Güvenli test akışı",
    data: {
      title: "Test bildirimi",
      body: "Bu kayıt test amaçlı oluşturuldu. Canlı gönderim değildir.",
      image: "",
      url: "/",
      type: "manual",
      testMode: true,
    },
  },
];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeType(v: unknown): NotificationType {
  const x = safeStr(v);
  if (
    x === "campaign" ||
    x === "order" ||
    x === "stock" ||
    x === "announcement" ||
    x === "manual"
  ) {
    return x;
  }
  return "manual";
}

function normalizeStatus(v: unknown): NotificationStatus {
  const x = safeStr(v);
  if (x === "queued" || x === "done" || x === "failed" || x === "processing") {
    return x;
  }
  return "queued";
}

function formatDate(v?: Timestamp | null) {
  if (!v) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(v.toDate());
  } catch {
    return "-";
  }
}

function statusLabel(status: NotificationStatus) {
  if (status === "queued") return "Kuyrukta";
  if (status === "processing") return "İşleniyor";
  if (status === "done") return "Tamamlandı";
  return "Hata";
}

function typeLabel(type: NotificationType) {
  if (type === "campaign") return "Kampanya";
  if (type === "order") return "Sipariş";
  if (type === "stock") return "Stok";
  if (type === "announcement") return "Duyuru";
  return "Manuel";
}

function AdminNotificationsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | NotificationStatus>("all");

  async function reloadRows(filter: "all" | NotificationStatus = statusFilter) {
    const baseRef = collection(db, "notifications");
    const qRef =
      filter === "all"
        ? query(baseRef, orderBy("createdAt", "desc"), limit(20))
        : query(
            baseRef,
            where("status", "==", filter),
            orderBy("createdAt", "desc"),
            limit(20)
          );

    const snap = await getDocs(qRef);

    const next: NotificationRow[] = snap.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        title: safeStr(x.title),
        body: safeStr(x.body),
        image: safeStr(x.image),
        url: safeStr(x.url),
        type: normalizeType(x.type),
        status: normalizeStatus(x.status),
        sentCount: Number(x.sentCount || 0),
        failedCount: Number(x.failedCount || 0),
        testMode: x.testMode === true,
        createdAt: (x.createdAt as Timestamp) || null,
        sentAt: (x.sentAt as Timestamp) || null,
        createdBy: safeStr(x.createdBy),
      };
    });

    setRows(next);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        await reloadRows(statusFilter);
      } catch (error) {
        console.error("notifications load error:", error);
        if (!alive) return;
        setErr("Bildirim kayıtları yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db, statusFilter]);

  function onText(
    cb: (value: string) => void
  ) {
    return (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => cb(e.target.value);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    if (!form.title.trim()) return "Başlık zorunlu.";
    if (!form.body.trim()) return "Mesaj zorunlu.";
    if (form.body.trim().length < 8) return "Mesaj çok kısa.";
    if (!form.url.trim()) return "Yönlendirme URL zorunlu.";
    return "";
  }

  function applyTemplate(templateId: string) {
    const tpl = READY_TEMPLATES.find((x) => x.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    setForm(tpl.data);
    setErr("");
    setOkMsg(`"${tpl.name}" şablonu forma uygulandı.`);
  }

  function fillQuick(type: NotificationType) {
    if (type === "campaign") {
      setForm({
        title: "Yeni kampanya başladı",
        body: "Seçili ürünlerde fırsatlar seni bekliyor. Hemen incele.",
        image: "",
        url: "/shop",
        type: "campaign",
        testMode: false,
      });
      setSelectedTemplate("");
      return;
    }

    if (type === "stock") {
      setForm({
        title: "Beklediğin ürün stokta",
        body: "Takip ettiğin ürün yeniden satışta. Tükenmeden göz at.",
        image: "",
        url: "/favorites",
        type: "stock",
        testMode: false,
      });
      setSelectedTemplate("");
      return;
    }

    if (type === "announcement") {
      setForm({
        title: "Yeni duyuru yayında",
        body: "Mağaza ve koleksiyonlarla ilgili son gelişmeleri şimdi incele.",
        image: "",
        url: "/",
        type: "announcement",
        testMode: false,
      });
      setSelectedTemplate("");
      return;
    }

    setForm(DEFAULT_FORM);
    setSelectedTemplate("");
  }

  async function handleSend() {
    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      setOkMsg("");
      return;
    }

    try {
      setSending(true);
      setErr("");
      setOkMsg("");

      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        image: form.image.trim(),
        url: form.url.trim() || "/",
        type: form.type,
        status: "queued" as const,
        sentCount: 0,
        failedCount: 0,
        testMode: form.testMode,
        createdBy: "admin",
        createdAt: serverTimestamp(),
      };

      console.log("notification payload =>", payload);

      const ref = await addDoc(collection(db, "notifications"), payload);

      console.log("notification created =>", ref.id);

      setOkMsg(
        form.testMode
          ? "Test bildirim kuyruğa alındı."
          : "Bildirim kuyruğa alındı. Function gönderimi işleyecek."
      );

      setForm(DEFAULT_FORM);
      setSelectedTemplate("");
      await reloadRows("all");
    } catch (error) {
      console.error("notification queue error:", error);
      setErr("Bildirim kuyruğa alınamadı.");
    } finally {
      setSending(false);
    }
  }

  const totals = useMemo(() => {
    return {
      total: rows.length,
      done: rows.filter((x) => x.status === "done").length,
      queued: rows.filter((x) => x.status === "queued" || x.status === "processing").length,
      failed: rows.filter((x) => x.status === "failed").length,
    };
  }, [rows]);

  const bodyLength = form.body.trim().length;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Push Merkezi</div>
          <h1 className={styles.h1}>Push Bildirim Operasyon Paneli</h1>
          <p className={styles.sub}>
            Web ve iOS cihazlara güvenli şekilde bildirim kuyruğu oluştur. Hazır mesaj
            şablonlarını kullan, test/canlı ayrımını yönet ve son gönderim kayıtlarını izle.
          </p>

          <div className={styles.heroMiniStats}>
            <span className={styles.heroPill}>Cloud Function Destekli</span>
            <span className={styles.heroPill}>Web + iOS</span>
            <span className={styles.heroPill}>Test / Canlı Mod</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSend}
            disabled={loading || sending}
          >
            {sending ? "Kuyruğa Alınıyor..." : "Bildirimi Kuyruğa Al"}
          </button>

          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              setForm(DEFAULT_FORM);
              setSelectedTemplate("");
              setErr("");
              setOkMsg("");
            }}
            disabled={sending}
          >
            Formu Temizle
          </button>
        </div>
      </section>

      {err ? <div className={styles.alertBad}>{err}</div> : null}
      {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam Kayıt</span>
          <strong className={styles.statValue}>{totals.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Kuyrukta</span>
          <strong className={styles.statValue}>{totals.queued}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Tamamlanan</span>
          <strong className={styles.statValue}>{totals.done}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Hatalı</span>
          <strong className={styles.statValue}>{totals.failed}</strong>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.leftCol}>
          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Hazır Mesaj Şablonları</h2>
                <p className={styles.cardDesc}>
                  Tek tıkla kampanya, stok, sipariş veya test akışı doldur.
                </p>
              </div>
            </div>

            <div className={styles.templateToolbar}>
              <label className={styles.field}>
                <span>Şablon Seç</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">Şablon seç...</option>
                  {READY_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.quickActions}>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => fillQuick("campaign")}
                >
                  Kampanya
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => fillQuick("stock")}
                >
                  Stok
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => fillQuick("announcement")}
                >
                  Duyuru
                </button>
              </div>
            </div>

            <div className={styles.templateGrid}>
              {READY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`${styles.templateCard} ${
                    selectedTemplate === tpl.id ? styles.templateCardActive : ""
                  }`}
                  onClick={() => applyTemplate(tpl.id)}
                >
                  <strong>{tpl.name}</strong>
                  <span>{tpl.description}</span>
                </button>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Yeni Bildirim</h2>
                <p className={styles.cardDesc}>
                  Push kaydı <code>notifications</code> koleksiyonuna yazılır.
                </p>
              </div>
              <span
                className={`${styles.badge} ${
                  form.testMode ? styles.badgeWarn : styles.badgeOk
                }`}
              >
                {form.testMode ? "Test Mode" : "Canlı"}
              </span>
            </div>

            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.full}`}>
                <span>Başlık</span>
                <input
                  value={form.title}
                  onChange={onText((v) => update("title", v))}
                  placeholder="Örn: Yeni kampanya başladı"
                />
              </label>

              <label className={`${styles.field} ${styles.full}`}>
                <span>Mesaj</span>
                <textarea
                  rows={5}
                  value={form.body}
                  onChange={onText((v) => update("body", v))}
                  placeholder="Örn: Seçili ürünlerde fırsatlar seni bekliyor."
                />
                <small className={styles.fieldHint}>
                  Karakter: {bodyLength} / önerilen 40-140
                </small>
              </label>

              <label className={styles.field}>
                <span>Tür</span>
                <select
                  value={form.type}
                  onChange={onText((v) => update("type", normalizeType(v)))}
                >
                  <option value="campaign">campaign</option>
                  <option value="order">order</option>
                  <option value="stock">stock</option>
                  <option value="announcement">announcement</option>
                  <option value="manual">manual</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Yönlendirme URL</span>
                <input
                  value={form.url}
                  onChange={onText((v) => update("url", v))}
                  placeholder="/shop"
                />
              </label>

              <label className={`${styles.field} ${styles.full}`}>
                <span>Görsel URL</span>
                <input
                  value={form.image}
                  onChange={onText((v) => update("image", v))}
                  placeholder="https://..."
                />
              </label>

              <label className={`${styles.switchRow} ${styles.full}`}>
                <div>
                  <strong>Sadece test kuyruğu</strong>
                  <small>Aktif ise kayıt test modunda işaretlenir.</small>
                </div>
                <input
                  type="checkbox"
                  checked={form.testMode}
                  onChange={(e) => update("testMode", e.target.checked)}
                />
              </label>
            </div>

            <div className={styles.submitRow}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleSend}
                disabled={loading || sending}
              >
                {sending ? "Kuyruğa Alınıyor..." : "Bildirimi Kuyruğa Al"}
              </button>

              <button
                type="button"
                className={styles.ghostBtn}
                onClick={async () => {
                  try {
                    setLoading(true);
                    await reloadRows(statusFilter);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Listeyi Yenile
              </button>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Operasyon Notu</h2>
                <p className={styles.cardDesc}>Bu ekran doğrudan cihazlara push atmaz.</p>
              </div>
            </div>

            <div className={styles.noteBox}>
              Bildirim kaydı Firestore’a yazılır. Arka plandaki Function aktif tokenları
              toplar, chunk’lara böler ve web + iOS cihazlara gönderimi tamamlar.
              Test/canlı ayrımı payload üzerinden takip edilir.
            </div>
          </article>
        </div>

        <div className={styles.rightCol}>
          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Canlı Önizleme</h2>
                <p className={styles.cardDesc}>Kullanıcının ekranda göreceği özet görünüm.</p>
              </div>
            </div>

            <div className={styles.previewWrap}>
              <div className={styles.previewPhone}>
                <div className={styles.previewTopBar}>
                  <span>Şimdi</span>
                  <span>{form.testMode ? "Test" : typeLabel(form.type)}</span>
                </div>

                <div className={styles.previewCard}>
                  <div className={styles.previewEyebrow}>{typeLabel(form.type)}</div>
                  <div className={styles.previewTitle}>{form.title || "Bildirim başlığı"}</div>
                  <div className={styles.previewBody}>
                    {form.body || "Bildirim açıklaması burada görünür."}
                  </div>

                  <div className={styles.previewMeta}>
                    <span>{form.url || "/"}</span>
                    <span>{form.testMode ? "Test" : "Canlı"}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Son Gönderimler</h2>
                <p className={styles.cardDesc}>Kuyruğa alınan son 20 kayıt.</p>
              </div>

              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value === "all"
                      ? "all"
                      : normalizeStatus(e.target.value)
                  )
                }
              >
                <option value="all">Tümü</option>
                <option value="queued">queued</option>
                <option value="processing">processing</option>
                <option value="done">done</option>
                <option value="failed">failed</option>
              </select>
            </div>

            {loading ? (
              <div className={styles.empty}>Yükleniyor...</div>
            ) : rows.length === 0 ? (
              <div className={styles.empty}>Henüz bildirim kaydı yok.</div>
            ) : (
              <div className={styles.logList}>
                {rows.map((row) => (
                  <div key={row.id} className={styles.logItem}>
                    <div className={styles.logTop}>
                      <div>
                        <div className={styles.logTitle}>{row.title || "-"}</div>
                        <div className={styles.logSub}>
                          {typeLabel(row.type)} • {formatDate(row.createdAt)}
                        </div>
                      </div>

                      <div className={styles.logBadges}>
                        {row.testMode ? (
                          <span className={`${styles.badge} ${styles.badgeWarn}`}>Test</span>
                        ) : null}
                        <span
                          className={`${styles.badge} ${
                            row.status === "done"
                              ? styles.badgeOk
                              : row.status === "failed"
                              ? styles.badgeBad
                              : styles.badgeMuted
                          }`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.logBody}>{row.body || "-"}</div>

                    <div className={styles.logMeta}>
                      <span>Sent: {row.sentCount}</span>
                      <span>Failed: {row.failedCount}</span>
                      <span>URL: {row.url || "-"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

export default function AdminNotificationsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <AdminNotificationsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
