"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./installments.module.css";

type InstallmentOption = {
  months: number;
  interestFree: boolean;
  enabled: boolean;
};

type InstallmentSettings = {
  enabled: boolean;
  title: string;
  note: string;
  options: InstallmentOption[];
  updatedAt?: unknown;
};

const DEFAULT_OPTIONS: InstallmentOption[] = [
  { months: 3, interestFree: true, enabled: true },
  { months: 6, interestFree: true, enabled: true },
  { months: 9, interestFree: true, enabled: true },
  { months: 12, interestFree: true, enabled: true },
];

const DEFAULTS: InstallmentSettings = {
  enabled: true,
  title: "Taksit Seçenekleri",
  note: "Vade farksız taksit imkanı",
  options: DEFAULT_OPTIONS,
};

function AdminInstallmentsInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState(DEFAULTS.title);
  const [note, setNote] = useState(DEFAULTS.note);
  const [options, setOptions] = useState<InstallmentOption[]>(DEFAULT_OPTIONS);
  const [newMonths, setNewMonths] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function fireToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "settings", "installments"));
        if (!alive) return;

        if (snap.exists()) {
          const d = snap.data() as InstallmentSettings;
          setEnabled(d.enabled !== false);
          setTitle(d.title || DEFAULTS.title);
          setNote(d.note || DEFAULTS.note);
          if (Array.isArray(d.options) && d.options.length > 0) {
            setOptions(d.options);
          }
        }
      } catch (err) {
        console.error("installments load:", err);
        fireToast("Yüklenemedi");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [db]);

  async function handleSave() {
    try {
      setSaving(true);
      const payload: InstallmentSettings = {
        enabled,
        title,
        note,
        options: options.sort((a, b) => a.months - b.months),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "settings", "installments"), payload, { merge: true });
      fireToast("Taksit ayarları kaydedildi ✅");
    } catch (err) {
      console.error("installments save:", err);
      fireToast("Kayıt başarısız ❌");
    } finally {
      setSaving(false);
    }
  }

  function toggleOption(idx: number) {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, enabled: !o.enabled } : o))
    );
  }

  function toggleInterestFree(idx: number) {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, interestFree: !o.interestFree } : o))
    );
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOption() {
    const m = parseInt(newMonths, 10);
    if (!m || m < 1 || m > 48) {
      fireToast("1-48 arası ay değeri girin");
      return;
    }
    if (options.some((o) => o.months === m)) {
      fireToast("Bu ay zaten mevcut");
      return;
    }
    setOptions((prev) => [...prev, { months: m, interestFree: true, enabled: true }].sort((a, b) => a.months - b.months));
    setNewMonths("");
  }

  const activeCount = options.filter((o) => o.enabled).length;

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Taksit Yönetimi</div>
          <h1 className={styles.h1}>Taksit Kontrol Merkezi</h1>
          <p className={styles.sub}>
            Ürün sayfalarında görünen taksit tablosunu buradan yönet.
            Açıp kapatabilir, ay seçeneklerini düzenleyebilir, vade farkı ayarlayabilirsin.
          </p>

          <div className={styles.heroPills}>
            <span className={enabled ? styles.pillOk : styles.pillOff}>
              {enabled ? "Aktif" : "Pasif"}
            </span>
            <span>{activeCount} seçenek aktif</span>
            <span>Firestore: settings/installments</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      </section>

      {loading ? (
        <section className={styles.card}>
          <div className={styles.empty}>Yükleniyor...</div>
        </section>
      ) : (
        <div className={styles.grid}>
          {/* Sol: Ana Ayarlar */}
          <div className={styles.leftCol}>
            <article className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>Genel Ayarlar</h2>
                  <p className={styles.cardDesc}>
                    Taksit bölümünü açıp kapatabilir, başlık ve açıklama metnini düzenleyebilirsin.
                  </p>
                </div>
                <span className={`${styles.badge} ${enabled ? styles.badgeOk : styles.badgeMuted}`}>
                  {enabled ? "Aktif" : "Pasif"}
                </span>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.switchRow}>
                  <span>
                    <b>Taksit bölümü aktif</b>
                    <small>Kapatırsan ürün sayfalarında taksit tablosu gizlenir.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Başlık</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Taksit Seçenekleri"
                  />
                </label>

                <label className={styles.field}>
                  <span>Açıklama Notu</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Vade farksız taksit imkanı"
                  />
                </label>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>Taksit Seçenekleri</h2>
                  <p className={styles.cardDesc}>
                    Her bir taksit seçeneğini açıp kapatabilir, vade farkı durumunu değiştirebilirsin.
                  </p>
                </div>
              </div>

              <div className={styles.optionsList}>
                {options.map((opt, idx) => (
                  <div key={opt.months} className={`${styles.optionRow} ${opt.enabled ? "" : styles.optionDisabled}`}>
                    <div className={styles.optionMonths}>
                      <strong>{opt.months}</strong>
                      <span>ay</span>
                    </div>

                    <div className={styles.optionToggles}>
                      <label className={styles.miniSwitch}>
                        <input
                          type="checkbox"
                          checked={opt.enabled}
                          onChange={() => toggleOption(idx)}
                        />
                        <span>{opt.enabled ? "Aktif" : "Pasif"}</span>
                      </label>

                      <label className={styles.miniSwitch}>
                        <input
                          type="checkbox"
                          checked={opt.interestFree}
                          onChange={() => toggleInterestFree(idx)}
                          disabled={!opt.enabled}
                        />
                        <span>{opt.interestFree ? "Vade farksız" : "Vade farklı"}</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeOption(idx)}
                      title="Sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.addRow}>
                <input
                  type="number"
                  className={styles.addInput}
                  value={newMonths}
                  onChange={(e) => setNewMonths(e.target.value)}
                  placeholder="Ay (ör: 18)"
                  min={1}
                  max={48}
                />
                <button type="button" className={styles.addBtn} onClick={addOption}>
                  + Ekle
                </button>
              </div>
            </article>
          </div>

          {/* Sağ: Önizleme */}
          <div className={styles.rightCol}>
            <article className={`${styles.card} ${styles.stickyCard}`}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>Canlı Önizleme</h2>
                  <p className={styles.cardDesc}>
                    Ürün sayfasında müşterinin göreceği taksit tablosu.
                  </p>
                </div>
              </div>

              {enabled ? (
                <div className={styles.previewBox}>
                  <div className={styles.previewHead}>
                    <span className={styles.previewTitle}>💳 {title}</span>
                    <span className={styles.previewNote}>{note}</span>
                  </div>
                  <div className={styles.previewGrid}>
                    {options.filter((o) => o.enabled).map((opt) => (
                      <div key={opt.months} className={styles.previewItem}>
                        <span className={styles.previewMonth}>{opt.months} ay</span>
                        <strong className={styles.previewAmount}>
                          ₺{(5000 / opt.months).toFixed(2)}/ay
                        </strong>
                        {opt.interestFree && (
                          <span className={styles.previewFree}>Vade farksız</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={styles.previewNote2}>
                    * Örnek fiyat: ₺5.000 üzerinden hesaplanmıştır.
                  </div>
                </div>
              ) : (
                <div className={styles.previewOff}>
                  Taksit bölümü kapalı — müşteriler görmeyecek.
                </div>
              )}
            </article>

            <article className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>Bilgi</h2>
                  <p className={styles.cardDesc}>Taksit nasıl çalışır?</p>
                </div>
              </div>
              <div className={styles.noteBox}>
                Taksit tablosu bilgilendirme amaçlıdır. Gerçek taksit işlemi ödeme provider&apos;ı
                (PayTR vb.) üzerinden gerçekleşir. Bu panel sadece ürün sayfasında gösterilen
                taksit bilgisini kontrol eder.
              </div>
            </article>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AdminInstallmentsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <AdminInstallmentsInner />
      </PermissionGate>
    </AdminGate>
  );
}
