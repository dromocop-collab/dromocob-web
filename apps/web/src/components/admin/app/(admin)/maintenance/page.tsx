"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./maintenance.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type MaintenanceSettings = {
  enabled?: boolean;
  title?: LocaleText;
  subtitle?: LocaleText;
  note?: LocaleText;
  allowAdminPreview?: boolean;
  launchCountdownSeconds?: number;
  launchActive?: boolean;
  launchStartedAt?: any;
  launchEndsAt?: any;
};

const DEFAULTS: Required<Omit<MaintenanceSettings, "launchStartedAt" | "launchEndsAt">> = {
  enabled: false,
  title: {
    tr: "Dromocob yenileniyor",
    en: "6’ncı lifestyle is being updated",
  },
  subtitle: {
    tr: "Size daha hızlı, güvenli ve premium bir alışveriş deneyimi hazırlıyoruz.",
    en: "We are preparing a faster, safer and more premium shopping experience.",
  },
  note: {
    tr: "Kısa süre içinde tekrar yayındayız.",
    en: "We will be back shortly.",
  },
  allowAdminPreview: true,
  launchCountdownSeconds: 10,
  launchActive: false,
};

function safeText(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(data: MaintenanceSettings | null): Required<MaintenanceSettings> {
  return {
    enabled: data?.enabled === true,
    title: {
      tr: safeText(data?.title?.tr) || DEFAULTS.title.tr,
      en: safeText(data?.title?.en) || DEFAULTS.title.en,
    },
    subtitle: {
      tr: safeText(data?.subtitle?.tr) || DEFAULTS.subtitle.tr,
      en: safeText(data?.subtitle?.en) || DEFAULTS.subtitle.en,
    },
    note: {
      tr: safeText(data?.note?.tr) || DEFAULTS.note.tr,
      en: safeText(data?.note?.en) || DEFAULTS.note.en,
    },
    allowAdminPreview: data?.allowAdminPreview !== false,
    launchCountdownSeconds: Math.max(
      3,
      Math.min(120, toNum(data?.launchCountdownSeconds, DEFAULTS.launchCountdownSeconds))
    ),
    launchActive: data?.launchActive === true,
    launchStartedAt: data?.launchStartedAt || null,
    launchEndsAt: data?.launchEndsAt || null,
  };
}

export default function AdminMaintenancePage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [form, setForm] = useState<Required<MaintenanceSettings>>(normalize(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const ref = useMemo(() => doc(db, "site_options", "maintenance_settings"), [db]);

  useEffect(() => {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setForm(normalize(snap.exists() ? (snap.data() as MaintenanceSettings) : null));
        setLoading(false);
      },
      (err) => {
        console.error("maintenance settings listen error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [ref]);

  async function saveSettings(next = form) {
    try {
      setSaving(true);

      await setDoc(
        ref,
        {
          enabled: next.enabled,
          title: next.title,
          subtitle: next.subtitle,
          note: next.note,
          allowAdminPreview: next.allowAdminPreview,
          launchCountdownSeconds: next.launchCountdownSeconds,
          launchActive: next.launchActive,
          launchStartedAt: next.launchStartedAt || null,
          launchEndsAt: next.launchEndsAt || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("maintenance save error:", e);
      window.alert("Bakım modu ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function enableMaintenance() {
    const next = {
      ...form,
      enabled: true,
      launchActive: false,
      launchStartedAt: null,
      launchEndsAt: null,
    };

    setForm(next);
    await saveSettings(next);
  }

  async function disableMaintenanceInstant() {
    const next = {
      ...form,
      enabled: false,
      launchActive: false,
      launchStartedAt: null,
      launchEndsAt: null,
    };

    setForm(next);
    await saveSettings(next);
  }

  async function startLaunchCountdown() {
    const seconds = Math.max(3, Math.min(120, Number(form.launchCountdownSeconds || 10)));
    const now = new Date();
    const ends = new Date(now.getTime() + seconds * 1000);

    const next = {
      ...form,
      enabled: true,
      launchActive: true,
      launchStartedAt: Timestamp.fromDate(now),
      launchEndsAt: Timestamp.fromDate(ends),
    };

    setForm(next);

    await setDoc(
      ref,
      {
        enabled: true,
        launchActive: true,
        launchStartedAt: Timestamp.fromDate(now),
        launchEndsAt: Timestamp.fromDate(ends),
        launchCountdownSeconds: seconds,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div>
          <div className={s.kicker}>ADMIN • SITE CONTROL CENTER</div>
          <h1>Bakım Modu & Site Açılış Merkezi</h1>
          <p>
            Siteyi tek tuşla bakım moduna al, metinleri yönet ve yayına dönüşte
            geri sayımlı premium açılış animasyonu başlat.
          </p>
        </div>

        <div className={`${s.statusCard} ${form.enabled ? s.statusDanger : s.statusOk}`}>
          <span>Site Durumu</span>
          <b>{form.enabled ? "Bakım Modunda" : "Yayında"}</b>
          <small>
            {form.launchActive
              ? "Açılış geri sayımı aktif"
              : form.enabled
              ? "Ziyaretçilere bakım ekranı gösterilir"
              : "Ziyaretçiler siteyi normal görür"}
          </small>
        </div>
      </section>

      {loading ? (
        <section className={s.loading}>Ayarlar yükleniyor…</section>
      ) : (
        <section className={s.grid}>
          <div className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <h2>Genel Kontrol</h2>
                <p>Bakım modunu aç/kapat ve açılış senaryosunu başlat.</p>
              </div>
            </div>

            <div className={s.actionGrid}>
              <button
                type="button"
                className={`${s.bigAction} ${s.maintenanceBtn}`}
                onClick={enableMaintenance}
                disabled={saving}
              >
                <span>Bakım Moduna Al</span>
                <b>Siteyi geçici olarak kapat</b>
              </button>

              <button
                type="button"
                className={`${s.bigAction} ${s.launchBtn}`}
                onClick={startLaunchCountdown}
                disabled={saving}
              >
                <span>Siteyi Aç</span>
                <b>Geri sayım + açılış animasyonu</b>
              </button>

              <button
                type="button"
                className={`${s.bigAction} ${s.instantBtn}`}
                onClick={disableMaintenanceInstant}
                disabled={saving}
              >
                <span>Direkt Yayına Al</span>
                <b>Animasyonsuz hızlı açılış</b>
              </button>
            </div>

            <div className={s.switchLine}>
              <div>
                <b>Admin Önizleme İzni</b>
                <small>Admin kullanıcılar bakım modundayken siteyi gezebilsin.</small>
              </div>

              <button
                type="button"
                className={form.allowAdminPreview ? s.switchOn : s.switchOff}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    allowAdminPreview: !p.allowAdminPreview,
                  }))
                }
              >
                {form.allowAdminPreview ? "Aktif" : "Pasif"}
              </button>
            </div>

            <label className={s.field}>
              <span>Açılış geri sayımı / saniye</span>
              <input
                type="number"
                min={3}
                max={120}
                value={form.launchCountdownSeconds}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    launchCountdownSeconds: Math.max(
                      3,
                      Math.min(120, Number(e.target.value || 10))
                    ),
                  }))
                }
              />
            </label>
          </div>

          <div className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <h2>Bakım Ekranı Metinleri</h2>
                <p>TR/EN destekli ziyaretçi mesajlarını düzenle.</p>
              </div>

              <button
                type="button"
                className={s.saveBtn}
                onClick={() => saveSettings()}
                disabled={saving}
              >
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>

            <div className={s.formGrid}>
              <label className={s.field}>
                <span>TR Başlık</span>
                <input
                  value={form.title.tr || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      title: { ...p.title, tr: e.target.value },
                    }))
                  }
                />
              </label>

              <label className={s.field}>
                <span>EN Başlık</span>
                <input
                  value={form.title.en || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      title: { ...p.title, en: e.target.value },
                    }))
                  }
                />
              </label>

              <label className={s.fieldWide}>
                <span>TR Açıklama</span>
                <textarea
                  rows={3}
                  value={form.subtitle.tr || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      subtitle: { ...p.subtitle, tr: e.target.value },
                    }))
                  }
                />
              </label>

              <label className={s.fieldWide}>
                <span>EN Açıklama</span>
                <textarea
                  rows={3}
                  value={form.subtitle.en || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      subtitle: { ...p.subtitle, en: e.target.value },
                    }))
                  }
                />
              </label>

              <label className={s.fieldWide}>
                <span>TR Not</span>
                <input
                  value={form.note.tr || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      note: { ...p.note, tr: e.target.value },
                    }))
                  }
                />
              </label>

              <label className={s.fieldWide}>
                <span>EN Not</span>
                <input
                  value={form.note.en || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      note: { ...p.note, en: e.target.value },
                    }))
                  }
                />
              </label>
            </div>

            <div className={s.preview}>
              <span>BAKIM EKRANI ÖNİZLEME</span>
              <h3>{form.title.tr}</h3>
              <p>{form.subtitle.tr}</p>
              <small>{form.note.tr}</small>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}