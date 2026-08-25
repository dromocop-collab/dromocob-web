"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./AdminShipping.module.css";
import { adminFetch } from "@/lib/adminFetch";

type ShippingProvider = "mng";
type ShippingMode = "test" | "live";
type LabelFormat = "PDF" | "ZPL";
type WeightUnit = "KG" | "LB";
type DimensionUnit = "CM" | "IN";
type PackageType = "BOX" | "DOCUMENT" | "PARCEL";

type ShippingSettingsDoc = {
  activeProvider?: ShippingProvider;
  mode?: ShippingMode;
  features?: {
    createShipment?: boolean;
    cancelShipment?: boolean;
    tracking?: boolean;
    labelDownload?: boolean;
  };
  providers?: {
    mng?: {
      isActive?: boolean;
      baseUrl?: string;
      apiKey?: string;
      apiSecret?: string;
      customerCode?: string;
      customerNumber?: string;
      password?: string;
      identityType?: number;
      tokenPath?: string;
      createOrderPath?: string;
      createBarcodePath?: string;
      senderCustomerId?: string;
      accountNumber?: string;
      labelFormat?: LabelFormat;
      defaultPackageType?: PackageType;
      defaultCurrency?: string;
      defaultWeightUnit?: WeightUnit;
      defaultDimensionUnit?: DimensionUnit;
      useIBMHeaders?: boolean;
      headerClientIdKey?: string;
      headerClientSecretKey?: string;
      notes?: string;
    };
  };
  updatedAt?: unknown;
  updatedBy?: string;
};

type FormState = {
  activeProvider: ShippingProvider;
  mode: ShippingMode;
  features: {
    createShipment: boolean;
    cancelShipment: boolean;
    tracking: boolean;
    labelDownload: boolean;
  };
  providers: {
    mng: {
      isActive: boolean;
      baseUrl: string;
      apiKey: string;
      apiSecret: string;
      customerCode: string;
      customerNumber: string;
      password: string;
      identityType: number;
      tokenPath: string;
      createOrderPath: string;
      createBarcodePath: string;
      senderCustomerId: string;
      accountNumber: string;
      labelFormat: LabelFormat;
      defaultPackageType: PackageType;
      defaultCurrency: string;
      defaultWeightUnit: WeightUnit;
      defaultDimensionUnit: DimensionUnit;
      useIBMHeaders: boolean;
      headerClientIdKey: string;
      headerClientSecretKey: string;
      notes: string;
    };
  };
};

const DEFAULT_FORM: FormState = {
  activeProvider: "mng",
  mode: "test",
  features: {
    createShipment: true,
    cancelShipment: false,
    tracking: true,
    labelDownload: true,
  },
  providers: {
    mng: {
      isActive: true,
      baseUrl: "https://api.mngkargo.com.tr",
      apiKey: "",
      apiSecret: "",
      customerCode: "",
      customerNumber: "",
      password: "",
      identityType: 1,
      tokenPath: "/mngapi/api/token",
      createOrderPath: "/mngapi/api/standardcmdapi/createOrder",
      createBarcodePath: "/mngapi/api/barcodecmdapi/createbarcode",
      senderCustomerId: "",
      accountNumber: "",
      labelFormat: "PDF",
      defaultPackageType: "BOX",
      defaultCurrency: "TRY",
      defaultWeightUnit: "KG",
      defaultDimensionUnit: "CM",
      useIBMHeaders: true,
      headerClientIdKey: "X-IBM-Client-Id",
      headerClientSecretKey: "X-IBM-Client-Secret",
      notes:
        "MNG portalından alınan key ve secret değerleri burada tutulur. Final aşamada bu hassas alanlar server-side secret yönetimine taşınmalıdır.",
    },
  },
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeMode(v: unknown): ShippingMode {
  return safeStr(v) === "live" ? "live" : "test";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeProvider(_: unknown): ShippingProvider {
  return "mng";
}

function normalizeLabelFormat(v: unknown): LabelFormat {
  return safeStr(v) === "ZPL" ? "ZPL" : "PDF";
}

function normalizeWeightUnit(v: unknown): WeightUnit {
  return safeStr(v) === "LB" ? "LB" : "KG";
}

function normalizeDimensionUnit(v: unknown): DimensionUnit {
  return safeStr(v) === "IN" ? "IN" : "CM";
}

function normalizePackageType(v: unknown): PackageType {
  const x = safeStr(v);
  if (x === "DOCUMENT" || x === "PARCEL" || x === "BOX") return x;
  return "BOX";
}

function normalizeIdentityType(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function normalizeDoc(raw: ShippingSettingsDoc | null | undefined): FormState {
  const mng = raw?.providers?.mng;

  return {
    activeProvider: normalizeProvider(raw?.activeProvider),
    mode: normalizeMode(raw?.mode),
    features: {
      createShipment: raw?.features?.createShipment !== false,
      cancelShipment: raw?.features?.cancelShipment === true,
      tracking: raw?.features?.tracking !== false,
      labelDownload: raw?.features?.labelDownload !== false,
    },
    providers: {
      mng: {
        isActive: mng?.isActive !== false,
        baseUrl: safeStr(mng?.baseUrl) || "https://api.mngkargo.com.tr",
        apiKey: safeStr(mng?.apiKey),
        apiSecret: safeStr(mng?.apiSecret),
        customerCode: safeStr(mng?.customerCode),
        customerNumber: safeStr(mng?.customerNumber),
        password: safeStr(mng?.password),
        identityType: normalizeIdentityType(mng?.identityType),
        tokenPath: safeStr(mng?.tokenPath) || "/mngapi/api/token",
        createOrderPath:
          safeStr(mng?.createOrderPath) || "/mngapi/api/standardcmdapi/createOrder",
        createBarcodePath:
          safeStr(mng?.createBarcodePath) || "/mngapi/api/barcodecmdapi/createbarcode",
        senderCustomerId: safeStr(mng?.senderCustomerId),
        accountNumber: safeStr(mng?.accountNumber),
        labelFormat: normalizeLabelFormat(mng?.labelFormat),
        defaultPackageType: normalizePackageType(mng?.defaultPackageType),
        defaultCurrency: safeStr(mng?.defaultCurrency) || "TRY",
        defaultWeightUnit: normalizeWeightUnit(mng?.defaultWeightUnit),
        defaultDimensionUnit: normalizeDimensionUnit(mng?.defaultDimensionUnit),
        useIBMHeaders: mng?.useIBMHeaders !== false,
        headerClientIdKey:
          safeStr(mng?.headerClientIdKey) || "X-IBM-Client-Id",
        headerClientSecretKey:
          safeStr(mng?.headerClientSecretKey) || "X-IBM-Client-Secret",
        notes: safeStr(mng?.notes) || DEFAULT_FORM.providers.mng.notes,
      },
    },
  };
}

export default function AdminShippingPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <AdminShippingPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function AdminShippingPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [testErr, setTestErr] = useState("");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        setOkMsg("");
        setTestErr("");
        setTestMsg("");

        const snap = await getDoc(doc(db, "settings", "shipping"));
        const next = snap.exists()
          ? normalizeDoc(snap.data() as ShippingSettingsDoc)
          : DEFAULT_FORM;

        if (!alive) return;
        setForm(next);
        setInitialForm(next);
      } catch (error) {
        console.error("shipping settings load error:", error);
        if (!alive) return;
        setErr("Kargo ayarları yüklenemedi.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  function updateFeature<K extends keyof FormState["features"]>(
    key: K,
    value: FormState["features"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      },
    }));
  }

  function updateMng<K extends keyof FormState["providers"]["mng"]>(
    key: K,
    value: FormState["providers"]["mng"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        mng: {
          ...prev.providers.mng,
          [key]: value,
        },
      },
    }));
  }

  function onText(cb: (value: string) => void) {
    return (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => cb(e.target.value);
  }

  function validate(): string {
    const mng = form.providers.mng;

    if (form.activeProvider === "mng" && mng.isActive) {
      if (!mng.baseUrl.trim()) return "Base URL zorunlu.";
      if (!mng.apiKey.trim()) return "API Key / Client ID zorunlu.";
      if (!mng.apiSecret.trim()) return "API Secret / Client Secret zorunlu.";
      if (!mng.customerNumber.trim()) return "Customer Number zorunlu.";
      if (!mng.password.trim()) return "Password zorunlu.";
      if (!mng.tokenPath.trim()) return "Token path zorunlu.";
      if (!mng.createOrderPath.trim()) return "CreateOrder path zorunlu.";
      if (!mng.createBarcodePath.trim()) return "CreateBarcode path zorunlu.";
      if (!mng.defaultCurrency.trim()) return "Varsayılan para birimi zorunlu.";
      if (!mng.labelFormat) return "Label format zorunlu.";
      if (!mng.defaultPackageType) return "Varsayılan paket tipi zorunlu.";
      if (!mng.headerClientIdKey.trim()) return "Client ID header adı zorunlu.";
      if (!mng.headerClientSecretKey.trim()) {
        return "Client Secret header adı zorunlu.";
      }
    }

    return "";
  }

  function buildMngPayload() {
    const mng = form.providers.mng;

    return {
      isActive: mng.isActive,
      baseUrl: mng.baseUrl.trim(),
      apiKey: mng.apiKey.trim(),
      apiSecret: mng.apiSecret.trim(),
      customerCode: mng.customerCode.trim(),
      customerNumber: mng.customerNumber.trim(),
      password: mng.password.trim(),
      identityType: normalizeIdentityType(mng.identityType),
      tokenPath: mng.tokenPath.trim() || "/mngapi/api/token",
      createOrderPath:
        mng.createOrderPath.trim() || "/mngapi/api/standardcmdapi/createOrder",
      createBarcodePath:
        mng.createBarcodePath.trim() || "/mngapi/api/barcodecmdapi/createbarcode",
      senderCustomerId: mng.senderCustomerId.trim(),
      accountNumber: mng.accountNumber.trim(),
      labelFormat: mng.labelFormat,
      defaultPackageType: mng.defaultPackageType,
      defaultCurrency: mng.defaultCurrency.trim() || "TRY",
      defaultWeightUnit: mng.defaultWeightUnit,
      defaultDimensionUnit: mng.defaultDimensionUnit,
      useIBMHeaders: mng.useIBMHeaders,
      headerClientIdKey: mng.headerClientIdKey.trim() || "X-IBM-Client-Id",
      headerClientSecretKey:
        mng.headerClientSecretKey.trim() || "X-IBM-Client-Secret",
      notes: mng.notes.trim(),
    };
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

      const payload: ShippingSettingsDoc = {
        activeProvider: form.activeProvider,
        mode: form.mode,
        features: {
          createShipment: form.features.createShipment,
          cancelShipment: form.features.cancelShipment,
          tracking: form.features.tracking,
          labelDownload: form.features.labelDownload,
        },
        providers: {
          mng: buildMngPayload(),
        },
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      };

      await setDoc(doc(db, "settings", "shipping"), payload, { merge: true });

      setInitialForm(form);
      setOkMsg("MNG kargo ayarları başarıyla kaydedildi.");
    } catch (error) {
      console.error("shipping settings save error:", error);
      setErr("Kargo ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    const validationError = validate();
    if (validationError) {
      setTestErr(validationError);
      setTestMsg("");
      return;
    }

    try {
      setTesting(true);
      setTestErr("");
      setTestMsg("");

      const payload = {
        activeProvider: form.activeProvider,
        mode: form.mode,
        providers: {
          mng: buildMngPayload(),
        },
      };

      const res = await adminFetch("/api/shipping/test-connection", {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Bağlantı testi başarısız.");
      }

      setTestMsg(json?.message || "MNG bağlantı testi başarılı.");
    } catch (error: any) {
      console.error("shipping test error:", error);
      setTestErr(String(error?.message || "Bağlantı testi başarısız."));
    } finally {
      setTesting(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setErr("");
    setOkMsg("");
    setTestErr("");
    setTestMsg("");
  }

  const mng = form.providers.mng;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Kargo Altyapısı</div>
          <h1 className={styles.h1}>MNG Kargo Ayarları</h1>
          <p className={styles.sub}>
            MNG provider bağlantısını, test/live modunu ve shipment özelliklerini
            tek panelden yönet. Admin sipariş akışı ve shipping route’ları bu yapıdan beslenir.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={handleReset}
            disabled={loading || saving || testing || !dirty}
          >
            Geri Al
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleTestConnection}
            disabled={loading || saving || testing}
          >
            {testing ? "Test ediliyor..." : "Bağlantıyı Test Et"}
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={loading || saving || testing}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </section>

      {err ? <div className={styles.alertBad}>{err}</div> : null}
      {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
      {testErr ? <div className={styles.alertBad}>{testErr}</div> : null}
      {testMsg ? <div className={styles.alertOk}>{testMsg}</div> : null}

      {loading ? (
        <section className={styles.card}>
          <div className={styles.empty}>Yükleniyor...</div>
        </section>
      ) : (
        <>
          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Aktif Provider</span>
              <strong className={styles.statValue}>{form.activeProvider}</strong>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Mod</span>
              <strong className={styles.statValue}>{form.mode}</strong>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Shipment Create</span>
              <strong className={styles.statValue}>
                {form.features.createShipment ? "Açık" : "Kapalı"}
              </strong>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Tracking</span>
              <strong className={styles.statValue}>
                {form.features.tracking ? "Açık" : "Kapalı"}
              </strong>
            </div>
          </section>

          <section className={styles.grid}>
            <div className={styles.leftCol}>
              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Genel Kargo Ayarları</h2>
                    <p className={styles.cardDesc}>
                      Aktif provider, mod ve shipment özellikleri.
                    </p>
                  </div>
                  <span
                    className={`${styles.badge} ${
                      form.mode === "live" ? styles.badgeWarn : styles.badgeOk
                    }`}
                  >
                    {form.mode === "live" ? "LIVE" : "TEST"}
                  </span>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Aktif Provider</span>
                    <select
                      value={form.activeProvider}
                      onChange={onText((value) =>
                        setForm((prev) => ({
                          ...prev,
                          activeProvider: normalizeProvider(value),
                        }))
                      )}
                    >
                      <option value="mng">mng</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Customer Number</span>
                    <input
                      value={mng.customerNumber}
                      onChange={onText((value) => updateMng("customerNumber", value))}
                      placeholder="3575167399"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Password</span>
                    <input
                      type="password"
                      value={mng.password}
                      onChange={onText((value) => updateMng("password", value))}
                      placeholder="MNG müşteri şifresi"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Identity Type</span>
                    <input
                      type="number"
                      min={1}
                      value={mng.identityType}
                      onChange={(e) =>
                        updateMng("identityType", normalizeIdentityType(e.target.value))
                      }
                      placeholder="1"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Token Path</span>
                    <input
                      value={mng.tokenPath}
                      onChange={onText((value) => updateMng("tokenPath", value))}
                      placeholder="/mngapi/api/token"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>CreateOrder Path</span>
                    <input
                      value={mng.createOrderPath}
                      onChange={onText((value) => updateMng("createOrderPath", value))}
                      placeholder="/mngapi/api/standardcmdapi/createOrder"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>CreateBarcode Path</span>
                    <input
                      value={mng.createBarcodePath}
                      onChange={onText((value) => updateMng("createBarcodePath", value))}
                      placeholder="/mngapi/api/barcodecmdapi/createbarcode"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Çalışma Modu</span>
                    <select
                      value={form.mode}
                      onChange={onText((value) =>
                        setForm((prev) => ({
                          ...prev,
                          mode: normalizeMode(value),
                        }))
                      )}
                    >
                      <option value="test">test</option>
                      <option value="live">live</option>
                    </select>
                  </label>

                  <label className={styles.switchRow}>
                    <span>Shipment oluşturma açık</span>
                    <input
                      type="checkbox"
                      checked={form.features.createShipment}
                      onChange={(e) => updateFeature("createShipment", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>Shipment iptali açık</span>
                    <input
                      type="checkbox"
                      checked={form.features.cancelShipment}
                      onChange={(e) => updateFeature("cancelShipment", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>Tracking açık</span>
                    <input
                      type="checkbox"
                      checked={form.features.tracking}
                      onChange={(e) => updateFeature("tracking", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>Label download açık</span>
                    <input
                      type="checkbox"
                      checked={form.features.labelDownload}
                      onChange={(e) => updateFeature("labelDownload", e.target.checked)}
                    />
                  </label>
                </div>
              </article>

              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>MNG Provider Ayarları</h2>
                    <p className={styles.cardDesc}>
                      MNG portalından alınan key/secret ve shipment varsayılanları.
                    </p>
                  </div>
                  <span
                    className={`${styles.badge} ${
                      mng.isActive ? styles.badgeOk : styles.badgeMuted
                    }`}
                  >
                    {mng.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.switchRow}>
                    <span>MNG aktif</span>
                    <input
                      type="checkbox"
                      checked={mng.isActive}
                      onChange={(e) => updateMng("isActive", e.target.checked)}
                    />
                  </label>

                  <label className={styles.switchRow}>
                    <span>IBM header yapısı kullan</span>
                    <input
                      type="checkbox"
                      checked={mng.useIBMHeaders}
                      onChange={(e) => updateMng("useIBMHeaders", e.target.checked)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Base URL</span>
                    <input
                      value={mng.baseUrl}
                      onChange={onText((value) => updateMng("baseUrl", value))}
                      placeholder="https://api.mngkargo.com.tr"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>API Key / Client ID</span>
                    <input
                      value={mng.apiKey}
                      onChange={onText((value) => updateMng("apiKey", value))}
                      placeholder="X-IBM-Client-Id değeri"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>API Secret / Client Secret</span>
                    <input
                      type="password"
                      value={mng.apiSecret}
                      onChange={onText((value) => updateMng("apiSecret", value))}
                      placeholder="X-IBM-Client-Secret değeri"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Client ID Header Key</span>
                    <input
                      value={mng.headerClientIdKey}
                      onChange={onText((value) => updateMng("headerClientIdKey", value))}
                      placeholder="X-IBM-Client-Id"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Client Secret Header Key</span>
                    <input
                      value={mng.headerClientSecretKey}
                      onChange={onText((value) =>
                        updateMng("headerClientSecretKey", value)
                      )}
                      placeholder="X-IBM-Client-Secret"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Müşteri Kodu</span>
                    <input
                      value={mng.customerCode}
                      onChange={onText((value) => updateMng("customerCode", value))}
                      placeholder="opsiyonel"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Sender Customer ID</span>
                    <input
                      value={mng.senderCustomerId}
                      onChange={onText((value) => updateMng("senderCustomerId", value))}
                      placeholder="opsiyonel"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Account Number</span>
                    <input
                      value={mng.accountNumber}
                      onChange={onText((value) => updateMng("accountNumber", value))}
                      placeholder="opsiyonel"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Label Format</span>
                    <select
                      value={mng.labelFormat}
                      onChange={onText((value) =>
                        updateMng("labelFormat", normalizeLabelFormat(value))
                      )}
                    >
                      <option value="PDF">PDF</option>
                      <option value="ZPL">ZPL</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Varsayılan Paket Tipi</span>
                    <select
                      value={mng.defaultPackageType}
                      onChange={onText((value) =>
                        updateMng("defaultPackageType", normalizePackageType(value))
                      )}
                    >
                      <option value="BOX">BOX</option>
                      <option value="DOCUMENT">DOCUMENT</option>
                      <option value="PARCEL">PARCEL</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Varsayılan Para Birimi</span>
                    <input
                      value={mng.defaultCurrency}
                      onChange={onText((value) => updateMng("defaultCurrency", value))}
                      placeholder="TRY"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Weight Unit</span>
                    <select
                      value={mng.defaultWeightUnit}
                      onChange={onText((value) =>
                        updateMng("defaultWeightUnit", normalizeWeightUnit(value))
                      )}
                    >
                      <option value="KG">KG</option>
                      <option value="LB">LB</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Dimension Unit</span>
                    <select
                      value={mng.defaultDimensionUnit}
                      onChange={onText((value) =>
                        updateMng("defaultDimensionUnit", normalizeDimensionUnit(value))
                      )}
                    >
                      <option value="CM">CM</option>
                      <option value="IN">IN</option>
                    </select>
                  </label>

                  <label className={`${styles.field} ${styles.full}`}>
                    <span>Teknik Not</span>
                    <textarea
                      rows={4}
                      value={mng.notes}
                      onChange={onText((value) => updateMng("notes", value))}
                      placeholder="MNG entegrasyon notları"
                    />
                  </label>
                </div>
              </article>
            </div>

            <div className={styles.rightCol}>
              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Canlı Önizleme</h2>
                    <p className={styles.cardDesc}>
                      Shipping katmanının okuyacağı aktif yapı.
                    </p>
                  </div>
                </div>

                <div className={styles.previewBox}>
                  <div className={styles.previewItem}>
                    <span>Provider</span>
                    <b>{form.activeProvider}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Mode</span>
                    <b>{form.mode}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>MNG Aktif</span>
                    <b>{mng.isActive ? "true" : "false"}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Create Shipment</span>
                    <b>{form.features.createShipment ? "true" : "false"}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Tracking</span>
                    <b>{form.features.tracking ? "true" : "false"}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Token Path</span>
                    <b>{mng.tokenPath}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>CreateOrder Path</span>
                    <b>{mng.createOrderPath}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>CreateBarcode Path</span>
                    <b>{mng.createBarcodePath}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Label</span>
                    <b>{mng.labelFormat}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Package Type</span>
                    <b>{mng.defaultPackageType}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Currency</span>
                    <b>{mng.defaultCurrency || "-"}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Header Client ID</span>
                    <b>{mng.headerClientIdKey}</b>
                  </div>

                  <div className={styles.previewItem}>
                    <span>Header Client Secret</span>
                    <b>{mng.headerClientSecretKey}</b>
                  </div>
                </div>
              </article>

              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>Teknik Not</h2>
                    <p className={styles.cardDesc}>
                      Bu panel sadece provider konfigürasyonunu yönetir.
                    </p>
                  </div>
                </div>

                <div className={styles.noteBox}>
                  Token artık çalışıyor. Bundan sonraki kritik nokta path’lerin doğru ayrılmasıdır:
                  CreateOrder siparişi açar, CreateBarcode barkodu üretir. Tek endpoint ile devam
                  edilirse 404 kaçınılmaz olur.
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}