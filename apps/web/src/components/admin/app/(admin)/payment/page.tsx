"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminPayment.module.css";

type CardProvider = "none" | "paytr";
type CurrencyCode = "TRY" | "USD" | "EUR";

type PaymentSettingsDoc = {
  card?: {
    isActive?: boolean;
    adminPreviewEnabled?: boolean;
    provider?: CardProvider;
    merchantTitle?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  bankTransfer?: {
    isActive?: boolean;
    adminPreviewEnabled?: boolean;
    companyName?: string;
    bankName?: string;
    branchName?: string;
    accountName?: string;
    accountNumber?: string;
    iban?: string;
    currency?: CurrencyCode;
    note?: string;
    supportPhone?: string;
    supportWhatsApp?: string;
  };
  updatedAt?: unknown;
  updatedBy?: string;
};

type FormState = {
  card: {
    isActive: boolean;
    adminPreviewEnabled: boolean;
    provider: CardProvider;
    merchantTitle: string;
    successUrl: string;
    cancelUrl: string;
  };
  bankTransfer: {
    isActive: boolean;
    adminPreviewEnabled: boolean;
    companyName: string;
    bankName: string;
    branchName: string;
    accountName: string;
    accountNumber: string;
    iban: string;
    currency: CurrencyCode;
    note: string;
    supportPhone: string;
    supportWhatsApp: string;
  };
};

const DEFAULT_FORM: FormState = {
  card: {
    isActive: true,
    adminPreviewEnabled: true,
    provider: "paytr",
    merchantTitle: "Dromocob",
    successUrl: "/checkout/success",
    cancelUrl: "/checkout/pay",
  },
  bankTransfer: {
    isActive: false,
    adminPreviewEnabled: true,
    companyName: "DROMOCOB DEMO MAĞAZACILIK A.Ş.",
    bankName: "",
    branchName: "",
    accountName: "DROMOCOB DEMO MAĞAZACILIK A.Ş.",
    accountNumber: "",
    iban: "",
    currency: "TRY",
    note: "Lütfen açıklama alanına referans kodunu yazınız.",
    supportPhone: "",
    supportWhatsApp: "",
  },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeProvider(v: unknown): CardProvider {
  const x = safeStr(v).toLowerCase();
  if (x === "paytr" || x === "none") return x;
  return "none";
}

function normalizeCurrency(v: unknown): CurrencyCode {
  const x = safeStr(v).toUpperCase();
  if (x === "USD" || x === "EUR" || x === "TRY") return x;
  return "TRY";
}

function cleanIban(v: string) {
  return safeStr(v).replace(/\s+/g, "").toUpperCase();
}

function formatIban(v: string) {
  const raw = cleanIban(v);
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

function isValidTrIban(v: string) {
  const raw = cleanIban(v);
  return /^TR\d{24}$/.test(raw);
}

function normalizeDoc(raw: PaymentSettingsDoc | null | undefined): FormState {
  return {
    card: {
      isActive: raw?.card?.isActive !== false,
      adminPreviewEnabled: raw?.card?.adminPreviewEnabled !== false,
      provider: normalizeProvider(raw?.card?.provider),
      merchantTitle: safeStr(raw?.card?.merchantTitle) || DEFAULT_FORM.card.merchantTitle,
      successUrl: safeStr(raw?.card?.successUrl) || DEFAULT_FORM.card.successUrl,
      cancelUrl: safeStr(raw?.card?.cancelUrl) || DEFAULT_FORM.card.cancelUrl,
    },
    bankTransfer: {
      isActive: raw?.bankTransfer?.isActive === true,
      adminPreviewEnabled: raw?.bankTransfer?.adminPreviewEnabled !== false,
      companyName:
        safeStr(raw?.bankTransfer?.companyName) || DEFAULT_FORM.bankTransfer.companyName,
      bankName: safeStr(raw?.bankTransfer?.bankName),
      branchName: safeStr(raw?.bankTransfer?.branchName),
      accountName:
        safeStr(raw?.bankTransfer?.accountName) || DEFAULT_FORM.bankTransfer.accountName,
      accountNumber: safeStr(raw?.bankTransfer?.accountNumber),
      iban: formatIban(safeStr(raw?.bankTransfer?.iban)),
      currency: normalizeCurrency(raw?.bankTransfer?.currency),
      note: safeStr(raw?.bankTransfer?.note) || DEFAULT_FORM.bankTransfer.note,
      supportPhone: safeStr(raw?.bankTransfer?.supportPhone),
      supportWhatsApp: safeStr(raw?.bankTransfer?.supportWhatsApp),
    },
  };
}

async function copyText(value: string) {
  const text = safeStr(value);
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function AdminPaymentPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        setOkMsg("");

        const snap = await getDoc(doc(db, "settings", "payment"));
        const next = snap.exists()
          ? normalizeDoc(snap.data() as PaymentSettingsDoc)
          : DEFAULT_FORM;

        if (!alive) return;

        setForm(next);
        setInitialForm(next);
      } catch (error) {
        console.error("payment settings load error:", error);
        if (!alive) return;
        setErr("Ödeme ayarları yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [db]);

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const cardReady = useMemo(() => {
    if (!form.card.isActive) return false;
    if (form.card.provider === "none") return false;
    if (!form.card.successUrl || !form.card.cancelUrl) return false;
    return true;
  }, [form.card]);

  const bankReady = useMemo(() => {
    if (!form.bankTransfer.isActive) return false;
    if (!form.bankTransfer.companyName) return false;
    if (!form.bankTransfer.bankName) return false;
    if (!isValidTrIban(form.bankTransfer.iban)) return false;
    return true;
  }, [form.bankTransfer]);

  const paymentHealth = useMemo(() => {
    if (cardReady && bankReady) return "Mükemmel";
    if (cardReady || bankReady) return "Kısmi Aktif";
    return "Kapalı";
  }, [cardReady, bankReady]);

  function updateCard<K extends keyof FormState["card"]>(
    key: K,
    value: FormState["card"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      card: {
        ...prev.card,
        [key]: value,
      },
    }));
  }

  function updateBank<K extends keyof FormState["bankTransfer"]>(
    key: K,
    value: FormState["bankTransfer"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      bankTransfer: {
        ...prev.bankTransfer,
        [key]: value,
      },
    }));
  }

  function onText(cb: (value: string) => void) {
    return (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => cb(e.target.value);
  }

  function validate() {
    if (form.card.isActive) {
      if (form.card.provider === "none") return "Kart ödeme aktifken provider seçilmelidir.";
      if (!form.card.merchantTitle) return "Merchant başlık zorunlu.";
      if (!form.card.successUrl) return "Kart ödeme için success URL zorunlu.";
      if (!form.card.cancelUrl) return "Kart ödeme için cancel URL zorunlu.";
    }

    if (form.bankTransfer.isActive) {
      if (!form.bankTransfer.companyName) return "Firma / alıcı ünvanı zorunlu.";
      if (!form.bankTransfer.bankName) return "Banka adı zorunlu.";
      if (!form.bankTransfer.iban) return "IBAN zorunlu.";
      if (!isValidTrIban(form.bankTransfer.iban)) {
        return "IBAN formatı hatalı. Türkiye IBAN formatı TR + 24 rakam olmalıdır.";
      }
    }

    return "";
  }

  async function handleSave() {
    const validationError = validate();

    if (validationError) {
      setErr(validationError);
      setOkMsg("");
      return;
    }

    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      const payload: PaymentSettingsDoc = {
        card: {
          isActive: form.card.isActive,
          adminPreviewEnabled: form.card.adminPreviewEnabled,
          provider: form.card.provider,
          merchantTitle: form.card.merchantTitle,
          successUrl: form.card.successUrl,
          cancelUrl: form.card.cancelUrl,
        },
        bankTransfer: {
          isActive: form.bankTransfer.isActive,
          adminPreviewEnabled: form.bankTransfer.adminPreviewEnabled,
          companyName: form.bankTransfer.companyName,
          bankName: form.bankTransfer.bankName,
          branchName: form.bankTransfer.branchName,
          accountName: form.bankTransfer.accountName,
          accountNumber: form.bankTransfer.accountNumber,
          iban: formatIban(form.bankTransfer.iban),
          currency: form.bankTransfer.currency,
          note: form.bankTransfer.note,
          supportPhone: form.bankTransfer.supportPhone,
          supportWhatsApp: form.bankTransfer.supportWhatsApp,
        },
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      };

      await setDoc(doc(db, "settings", "payment"), payload, { merge: true });

      const normalized = normalizeDoc(payload);
      setForm(normalized);
      setInitialForm(normalized);
      setOkMsg("Ödeme ayarları başarıyla kaydedildi.");
    } catch (error) {
      console.error("payment settings save error:", error);
      setErr("Ödeme ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setErr("");
    setOkMsg("");
  }

  async function handleCopy(value: string, label: string) {
    const ok = await copyText(value);
    if (!ok) return;

    setCopyMsg(`${label} kopyalandı`);
    window.setTimeout(() => setCopyMsg(""), 1600);
  }

  return (
    <main className={styles.page}>
      {copyMsg ? <div className={styles.toast}>{copyMsg}</div> : null}

      <section className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Ödeme Altyapısı</div>
          <h1 className={styles.h1}>Ödeme Kontrol Merkezi</h1>
          <p className={styles.sub}>
            Kart ödeme, Havale / EFT, admin test modları ve müşteri ödeme
            akışlarını tek panelden yönet. Storefront bu verileri doğrudan{" "}
            <code>settings/payment</code> dokümanından okur.
          </p>

          <div className={styles.heroPills}>
            <span>{paymentHealth}</span>
            <span>{dirty ? "Kaydedilmemiş değişiklik var" : "Senkron"}</span>
            <span>Firestore: settings/payment</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={handleReset}
            disabled={loading || saving || !dirty}
          >
            Geri Al
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </section>

      {err ? <div className={styles.alertBad}>{err}</div> : null}
      {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}

      {loading ? (
        <section className={styles.card}>
          <div className={styles.empty}>Ödeme ayarları yükleniyor...</div>
        </section>
      ) : (
        <>
          <section className={styles.statsGrid}>
            <div className={`${styles.statCard} ${cardReady ? styles.statOk : styles.statWarn}`}>
              <span className={styles.statLabel}>Kart Ödeme</span>
              <strong className={styles.statValue}>
                {form.card.isActive ? "Aktif" : "Pasif"}
              </strong>
              <small>{form.card.provider === "paytr" ? "PayTR bağlı" : "Provider yok"}</small>
            </div>

            <div className={`${styles.statCard} ${bankReady ? styles.statOk : styles.statMuted}`}>
              <span className={styles.statLabel}>Havale / EFT</span>
              <strong className={styles.statValue}>
                {form.bankTransfer.isActive ? "Aktif" : "Pasif"}
              </strong>
              <small>{isValidTrIban(form.bankTransfer.iban) ? "IBAN geçerli" : "IBAN bekleniyor"}</small>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Para Birimi</span>
              <strong className={styles.statValue}>{form.bankTransfer.currency}</strong>
              <small>Storefront gösterimi</small>
            </div>

            <div className={`${styles.statCard} ${dirty ? styles.statWarn : styles.statOk}`}>
              <span className={styles.statLabel}>Kayıt Durumu</span>
              <strong className={styles.statValue}>{dirty ? "Değişti" : "Güncel"}</strong>
              <small>{dirty ? "Kaydetmen gerekiyor" : "Her şey kayıtlı"}</small>
            </div>
          </section>

          <section className={styles.grid}>
            <div className={styles.leftCol}>
              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Kart ile Ödeme</h2>
                    <p className={styles.cardDesc}>
                      Kart akışının açık/kapalı durumu, provider ve yönlendirme URL’leri.
                    </p>
                  </div>

                  <span
                    className={`${styles.badge} ${
                      form.card.isActive ? styles.badgeOk : styles.badgeMuted
                    }`}
                  >
                    {form.card.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.switchRow}>
                    <span>
                      <b>Kart ödeme aktif</b>
                      <small>Müşteri kartla ödeme başlatabilir.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.card.isActive}
                      onChange={(e) => updateCard("isActive", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>
                      <b>Kart test modu</b>
                      <small>Kart ödeme pasifken adminler test edebilsin.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.card.adminPreviewEnabled}
                      onChange={(e) => updateCard("adminPreviewEnabled", e.target.checked)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Provider</span>
                    <select
                      value={form.card.provider}
                      onChange={onText((value) => updateCard("provider", normalizeProvider(value)))}
                    >
                      <option value="none">none</option>
                      <option value="paytr">paytr</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Merchant Başlık</span>
                    <input
                      value={form.card.merchantTitle}
                      onChange={onText((value) => updateCard("merchantTitle", value))}
                      placeholder="Dromocob"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Success URL</span>
                    <input
                      value={form.card.successUrl}
                      onChange={onText((value) => updateCard("successUrl", value))}
                      placeholder="/checkout/success"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Cancel URL</span>
                    <input
                      value={form.card.cancelUrl}
                      onChange={onText((value) => updateCard("cancelUrl", value))}
                      placeholder="/checkout/pay"
                    />
                  </label>
                </div>

                {!form.card.isActive ? (
                  <div className={styles.previewWarnBox}>
                    <strong>Online ödeme pasif</strong>
                    <span>
                      Kullanıcıya “Online ödeme çok yakında aktif olacak” uyarısı
                      gösterilir. Admin test modu açıksa adminler akışı deneyebilir.
                    </span>
                  </div>
                ) : null}
              </article>

              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Havale / EFT</h2>
                    <p className={styles.cardDesc}>
                      Müşterinin ödeme ekranında ve sipariş detayında göreceği banka bilgileri.
                    </p>
                  </div>

                  <span
                    className={`${styles.badge} ${
                      form.bankTransfer.isActive ? styles.badgeOk : styles.badgeMuted
                    }`}
                  >
                    {form.bankTransfer.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.switchRow}>
                    <span>
                      <b>Havale / EFT aktif</b>
                      <small>Müşteri banka havalesi ile sipariş oluşturabilir.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.bankTransfer.isActive}
                      onChange={(e) => updateBank("isActive", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>
                      <b>Havale test modu</b>
                      <small>Pasifken sadece adminler test edebilsin.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.bankTransfer.adminPreviewEnabled}
                      onChange={(e) => updateBank("adminPreviewEnabled", e.target.checked)}
                    />
                  </label>

                  <label className={`${styles.field} ${styles.full}`}>
                    <span>Firma / Alıcı Ünvanı</span>
                    <input
                      value={form.bankTransfer.companyName}
                      onChange={onText((value) => updateBank("companyName", value))}
                      placeholder="BİZİM 6 e-ticaret..."
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Banka Adı</span>
                    <input
                      value={form.bankTransfer.bankName}
                      onChange={onText((value) => updateBank("bankName", value))}
                      placeholder="Kuveyt Türk"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Şube</span>
                    <input
                      value={form.bankTransfer.branchName}
                      onChange={onText((value) => updateBank("branchName", value))}
                      placeholder="İstanbul Şubesi"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.full}`}>
                    <span>Hesap Sahibi</span>
                    <input
                      value={form.bankTransfer.accountName}
                      onChange={onText((value) => updateBank("accountName", value))}
                      placeholder="BİZİM 6 e-ticaret..."
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Hesap No</span>
                    <input
                      value={form.bankTransfer.accountNumber}
                      onChange={onText((value) => updateBank("accountNumber", value))}
                      placeholder="12345678"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Para Birimi</span>
                    <select
                      value={form.bankTransfer.currency}
                      onChange={onText((value) =>
                        updateBank("currency", normalizeCurrency(value))
                      )}
                    >
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>

                  <label className={`${styles.field} ${styles.full}`}>
                    <span>IBAN</span>
                    <div className={styles.inputActionRow}>
                      <input
                        value={form.bankTransfer.iban}
                        onChange={onText((value) => updateBank("iban", formatIban(value)))}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                      />
                      <button
                        type="button"
                        className={styles.miniBtn}
                        onClick={() => handleCopy(cleanIban(form.bankTransfer.iban), "IBAN")}
                        disabled={!form.bankTransfer.iban}
                      >
                        Kopyala
                      </button>
                    </div>
                    <small
                      className={
                        isValidTrIban(form.bankTransfer.iban)
                          ? styles.fieldHintOk
                          : styles.fieldHintWarn
                      }
                    >
                      {form.bankTransfer.iban
                        ? isValidTrIban(form.bankTransfer.iban)
                          ? "IBAN formatı geçerli."
                          : "IBAN formatı eksik veya hatalı."
                        : "IBAN girilmedi."}
                    </small>
                  </label>

                  <label className={styles.field}>
                    <span>Destek Telefon</span>
                    <input
                      value={form.bankTransfer.supportPhone}
                      onChange={onText((value) => updateBank("supportPhone", value))}
                      placeholder="+90 5xx xxx xx xx"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>WhatsApp</span>
                    <input
                      value={form.bankTransfer.supportWhatsApp}
                      onChange={onText((value) => updateBank("supportWhatsApp", value))}
                      placeholder="905xxxxxxxxx"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.full}`}>
                    <span>Müşteri Notu</span>
                    <textarea
                      rows={4}
                      value={form.bankTransfer.note}
                      onChange={onText((value) => updateBank("note", value))}
                      placeholder="Lütfen açıklama alanına referans kodunu yazınız."
                    />
                  </label>
                </div>
              </article>
            </div>

            <div className={styles.rightCol}>
              <article className={`${styles.card} ${styles.stickyCard}`}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Canlı Önizleme</h2>
                    <p className={styles.cardDesc}>
                      Kullanıcı tarafındaki ödeme görünümü.
                    </p>
                  </div>
                </div>

                <div className={styles.phonePreview}>
                  <div className={styles.phoneTop}>
                    <span>Dromocob</span>
                    <b>Ödeme</b>
                  </div>

                  <div className={styles.paymentPreviewCard}>
                    <div className={styles.paymentPreviewHead}>
                      <span>Kart ile Ödeme</span>
                      <b>{form.card.isActive ? "Aktif" : "Pasif"}</b>
                    </div>
                    <p>
                      Provider: <b>{form.card.provider}</b>
                    </p>
                  </div>

                  <div className={styles.paymentPreviewCard}>
                    <div className={styles.paymentPreviewHead}>
                      <span>Havale / EFT</span>
                      <b>{form.bankTransfer.isActive ? "Aktif" : "Pasif"}</b>
                    </div>

                    <div className={styles.previewLine}>
                      <span>Alıcı</span>
                      <b>{form.bankTransfer.companyName || "-"}</b>
                    </div>

                    <div className={styles.previewLine}>
                      <span>Banka</span>
                      <b>{form.bankTransfer.bankName || "-"}</b>
                    </div>

                    <div className={styles.previewLine}>
                      <span>IBAN</span>
                      <b>{form.bankTransfer.iban || "-"}</b>
                    </div>

                    <div className={styles.previewNote}>
                      {form.bankTransfer.note || "Müşteri notu girilmedi."}
                    </div>
                  </div>
                </div>
              </article>

              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Operasyon Kontrolü</h2>
                    <p className={styles.cardDesc}>
                      Yayına almadan önce hızlı checklist.
                    </p>
                  </div>
                </div>

                <div className={styles.checkList}>
                  <div className={cardReady ? styles.checkOk : styles.checkWarn}>
                    <b>Kart ödeme</b>
                    <span>{cardReady ? "Kart akışı hazır." : "Provider / URL kontrol et."}</span>
                  </div>

                  <div className={bankReady ? styles.checkOk : styles.checkWarn}>
                    <b>Havale / EFT</b>
                    <span>{bankReady ? "Banka bilgileri hazır." : "Banka adı / IBAN kontrol et."}</span>
                  </div>

                  <div className={form.card.adminPreviewEnabled ? styles.checkOk : styles.checkNeutral}>
                    <b>Admin kart testi</b>
                    <span>{form.card.adminPreviewEnabled ? "Açık." : "Kapalı."}</span>
                  </div>

                  <div className={form.bankTransfer.adminPreviewEnabled ? styles.checkOk : styles.checkNeutral}>
                    <b>Admin havale testi</b>
                    <span>{form.bankTransfer.adminPreviewEnabled ? "Açık." : "Kapalı."}</span>
                  </div>
                </div>
              </article>

              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Teknik Not</h2>
                    <p className={styles.cardDesc}>
                      Bu panel sadece ayar dokümanını yönetir.
                    </p>
                  </div>
                </div>

                <div className={styles.noteBox}>
                  Kart provider için backend callback, secret, success/cancel flow ve
                  provider entegrasyonu ayrı çalışır. Havale/EFT tarafında müşteri
                  “Ödemeyi Yaptım” der, admin sipariş detayından banka kontrolü sonrası
                  ödemeyi manuel onaylar.
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default function AdminPaymentPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <AdminPaymentPageInner />
      </PermissionGate>
    </AdminGate>
  );
}