"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./champaign.module.css";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "archived";

type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  popupEnabled: boolean;
  published: boolean;
  status: CampaignStatus;
  startsAt?: any;
  endsAt?: any;
};

const STATUS_OPTIONS: CampaignStatus[] = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "archived",
];

function slugify(v: string) {
  return String(v || "")
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeStatus(v: unknown): CampaignStatus {
  const x = String(v || "").trim();
  if (
    x === "draft" ||
    x === "scheduled" ||
    x === "active" ||
    x === "paused" ||
    x === "archived"
  ) {
    return x;
  }
  return "draft";
}

function defaultCampaignWindow() {
  const now = new Date();
  const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endsAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 23, 59, 59);
  return {
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
  };
}

function prettyStatus(x: CampaignStatus) {
  switch (x) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Zamanlı";
    case "active":
      return "Active";
    case "paused":
      return "Duraklatıldı";
    case "archived":
      return "Arşiv";
    default:
      return x;
  }
}

function WheelCampaignsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const qy = query(
      collection(db, "wheel_campaigns"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: CampaignRow[] = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            id: d.id,
            title: String(x?.title || ""),
            slug: String(x?.slug || ""),
            isActive: x?.isActive === true,
            popupEnabled: x?.popupEnabled !== false,
            published: x?.published === true,
            status: safeStatus(x?.status),
            startsAt: x?.startsAt,
            endsAt: x?.endsAt,
          };
        });
        setRows(list);
      },
      (error) => {
        console.error("wheel campaigns read error:", error);
        setRows([]);
        setNote("Kampanya listesi okunamadı.");
      }
    );
  }, [db]);

  function setRowBusy(id: string, value: boolean) {
    setBusyMap((prev) => ({ ...prev, [id]: value }));
  }
async function handleDeleteCampaign(row: CampaignRow) {
  const ok = window.confirm(
    `"${row.title || row.slug || row.id}" kampanyasını silmek istediğine emin misin?\n\nBu işlem geri alınmaz.`
  );

  if (!ok) return;

  try {
    setRowBusy(row.id, true);
    setNote("");

    await deleteDoc(doc(db, "wheel_campaigns", row.id));

    setNote(`Kampanya silindi: ${row.title || row.id}`);
  } catch (error: any) {
    console.error("wheel campaign delete error:", error);
    setNote(`Kampanya silinemedi: ${error?.message || "bilinmeyen hata"}`);
  } finally {
    setRowBusy(row.id, false);
  }
}
  async function patchCampaign(
    id: string,
    payload: Record<string, unknown>,
    successText: string
  ) {
    if (!id) return;

    try {
      setRowBusy(id, true);
      setNote("");

      await updateDoc(doc(db, "wheel_campaigns", id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      setNote(successText);
    } catch (error: any) {
      console.error("wheel campaign update error:", error);
      setNote(
        `Kampanya güncellenemedi: ${error?.message || "bilinmeyen hata"}`
      );
    } finally {
      setRowBusy(id, false);
    }
  }

  async function handleQuickStatusChange(id: string, nextStatus: CampaignStatus) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    const nextPayload: Record<string, unknown> = {
      status: nextStatus,
    };

    if (nextStatus === "active") {
      nextPayload.published = true;
      nextPayload.isActive = true;
    }

    if (nextStatus === "paused" || nextStatus === "archived" || nextStatus === "draft") {
      nextPayload.isActive = false;
    }

    await patchCampaign(
      id,
      nextPayload,
      `"${row.title || row.slug || id}" durumu "${prettyStatus(nextStatus)}" oldu.`
    );
  }

  async function handleTogglePopup(row: CampaignRow) {
    await patchCampaign(
      row.id,
      { popupEnabled: !row.popupEnabled },
      `"${row.title || row.slug || row.id}" popup ${
        row.popupEnabled ? "kapatıldı" : "açıldı"
      }.`
    );
  }

  async function handleToggleActive(row: CampaignRow) {
    const nextIsActive = !row.isActive;

    await patchCampaign(
      row.id,
      {
        isActive: nextIsActive,
        published: nextIsActive ? true : row.published,
        status: nextIsActive && row.status === "draft" ? "active" : row.status,
      },
      `"${row.title || row.slug || row.id}" ${
        nextIsActive ? "yayına alındı" : "pasife çekildi"
      }.`
    );
  }

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault();

    const cleanTitle = titleRef.current?.value?.trim() || title.trim();

    if (!cleanTitle || saving) {
      setNote(!cleanTitle ? "Önce kampanya başlığı gir." : "İşlem zaten sürüyor.");
      return;
    }

    setSaving(true);
    setNote("");

    try {
      const campaignWindow = defaultCampaignWindow();

      const docRef = await addDoc(collection(db, "wheel_campaigns"), {
        title: cleanTitle,
        slug: slugify(cleanTitle),

        description: "",
        heroTitle: "Şansını Çevir, İndirimini Kap",
        heroText: "",
        buttonLabel: "Çevir ve Kazan",

        status,
        popupEnabled: true,
        isActive: false,
        published: false,

        requireConsent: true,
        requirePhone: true,
        requireEmail: true,
        maxSpinsPerUser: 1,
        cooldownHours: 720,

        startsAt: campaignWindow.startsAt,
        endsAt: campaignWindow.endsAt,

        rules: {
          couponExpireDays: 7,
          minOrderTry: "0",
          oneSpinPerDevice: true,
          oneSpinPerEmail: true,
          oneSpinPerPhone: true,
          oneSpinPerUser: true,
          requireConsent: true,
          requireLogin: false,
        },

        ui: {
          bgImage: "",
          buttonLabel: "Çevir ve Kazan",
          headline: "Anneler Günü Özel Çarkı!",
          subheadline: "Kuponunu hemen kullan",
        },

        wheelTheme: {
          primary: "#182a8f",
          secondary: "#ead447",
          tertiary: "#b7d7c8",
          neutral: "#f4efef",
        },

        overlayStyle: "premium-light",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle("");
      if (titleRef.current) titleRef.current.value = "";
      setStatus("draft");
      setNote(`Kampanya oluşturuldu: ${docRef.id}`);

      router.push(`/admin/wheel/campaigns/${docRef.id}`);
    } catch (error: any) {
      console.error("wheel campaign create error:", error);
      setNote(`Kampanya oluşturulamadı: ${error?.message || "bilinmeyen hata"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Wheel • Campaigns</div>
          <h1 className={styles.h1}>Kampanyalar</h1>
          <p className={styles.sub}>
            Çark kampanyası burada başlar. Önce kampanya açılır, sonra ödüller ve kupon mantığı buna bağlanır.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel" className={styles.ghostBtn}>
            ← Wheel Dashboard
          </Link>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Yeni Kampanya Oluştur</h2>
            <p className={styles.cardDesc}>
              Başlığı gir, durumu seç ve ilk kaydı oluştur. Kayıt sonrası otomatik detay sayfası açılır.
            </p>
          </div>
        </div>

        <form className={styles.toolbar} onSubmit={handleCreate}>
          <input
            ref={titleRef}
            className={styles.search}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Anneler Günü 2026 Çarkı"
          />

          <div className={styles.segmentRow}>
            {STATUS_OPTIONS.map((x) => (
              <button
                key={x}
                type="button"
                className={`${styles.segmentBtn} ${status === x ? styles.segmentBtnOn : ""}`}
                onClick={() => setStatus(x)}
              >
                {x}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={saving}
          >
            {saving ? "Oluşturuluyor..." : "Yeni Kampanya Oluştur"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Kampanya Listesi</h2>
            <p className={styles.cardDesc}>
              Satırdan hızlı yönet. Durum, popup ve aktiflik için içeri girmene gerek kalmasın.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className={styles.empty}>Henüz kampanya yok. Yukarıdan ilk kampanyayı aç.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Slug</th>
                  <th>Durum</th>
                  <th>Popup</th>
                  <th>Aktif</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowBusy = busyMap[row.id] === true;

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleMain}>{row.title || "-"}</div>
                          <div className={styles.rowTitleSub}>ID: {row.id}</div>
                        </div>
                      </td>

                      <td className={styles.rowTitleSub}>{row.slug || "-"}</td>

                      <td>
                        <div className={styles.actionsRow}>
                          <select
                            className={styles.inlineSelect}
                            value={row.status}
                            disabled={rowBusy}
                            onChange={(e) =>
                              handleQuickStatusChange(
                                row.id,
                                e.target.value as CampaignStatus
                              )
                            }
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {prettyStatus(opt)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={
                            row.popupEnabled
                              ? `${styles.badgeAction} ${styles.badgeOk}`
                              : `${styles.badgeAction} ${styles.badgeMuted}`
                          }
                          disabled={rowBusy}
                          onClick={() => handleTogglePopup(row)}
                        >
                          {rowBusy ? "..." : row.popupEnabled ? "Açık" : "Kapalı"}
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={
                            row.isActive
                              ? `${styles.badgeAction} ${styles.badgeOk}`
                              : `${styles.badgeAction} ${styles.badgeMuted}`
                          }
                          disabled={rowBusy}
                          onClick={() => handleToggleActive(row)}
                        >
                          {rowBusy ? "..." : row.isActive ? "Yayında" : "Pasif"}
                        </button>
                      </td>

                      <td>
                        <div className={styles.actionsRow}>
                          <Link
                            href={`/admin/wheel/campaigns/${row.id}`}
                            className={styles.softBtn}
                          >
                            Düzenle
                          </Link>
                          <button
                            type="button"
                              className={styles.dangerBtn}
                              disabled={rowBusy}
                              onClick={() => handleDeleteCampaign(row)}
                            >
                              {rowBusy ? "..." : "Sil"}

                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function WheelCampaignsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <WheelCampaignsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
