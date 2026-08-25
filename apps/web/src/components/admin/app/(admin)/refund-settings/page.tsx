"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getIdTokenResult, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import s from "./refund-settings.module.css";

type RefundSettings = {
  enabled: boolean;
  allowPartial: boolean;

  maxDaysAfterPaid: number;
  minAmountTry: number;

  autoCreateReturnShipment: boolean;
  allowReturnShipmentCancel: boolean;
  requireReturnReceivedBeforePaytrRefund: boolean;
  allowManualReturnTrackingFallback: boolean;

  defaultCarrier: "mng" | "manual";
  customerNote: string;
  returnCodeNote: string;

  returnReceiver: {
    companyName: string;
    fullName: string;
    phone: string;
    email: string;
    city: string;
    district: string;
    postalCode: string;
    addressLine: string;
  };
};

const DEFAULT_SETTINGS: RefundSettings = {
  enabled: true,
  allowPartial: true,

  maxDaysAfterPaid: 14,
  minAmountTry: 1,

  autoCreateReturnShipment: false,
  allowReturnShipmentCancel: true,
  requireReturnReceivedBeforePaytrRefund: true,
  allowManualReturnTrackingFallback: true,

  defaultCarrier: "mng",

  customerNote: "İade talepleri sipariş tarihinden itibaren 14 gün içinde alınır.",
  returnCodeNote:
    "İade talebiniz onaylandıktan sonra size MNG iade kargo kodu oluşturulur. Bu kod ile ürünü anlaşmalı MNG Kargo şubesinden ücretsiz gönderebilirsiniz.",

  returnReceiver: {
    companyName: "DROMOCOB",
    fullName: "DROMOCOB",
    phone: "05304788298",
    email: "info@dromocob.tr",
    city: "İSTANBUL",
    district: "FETHİYE",
    postalCode: "48303",
    addressLine: "Demo Showroom",
  },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function clampNumber(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, n));
}

function cleanPhone(v: unknown) {
  return safeStr(v).replace(/[^\d+]/g, "");
}

function normalizeSettings(raw: Partial<RefundSettings> | any): RefundSettings {
  const receiver = raw?.returnReceiver || {};

  return {
    enabled: raw?.enabled ?? DEFAULT_SETTINGS.enabled,
    allowPartial: raw?.allowPartial ?? DEFAULT_SETTINGS.allowPartial,

    maxDaysAfterPaid: Number(
      raw?.maxDaysAfterPaid ?? DEFAULT_SETTINGS.maxDaysAfterPaid
    ),
    minAmountTry: Number(raw?.minAmountTry ?? DEFAULT_SETTINGS.minAmountTry),

    autoCreateReturnShipment:
      raw?.autoCreateReturnShipment ?? DEFAULT_SETTINGS.autoCreateReturnShipment,
    allowReturnShipmentCancel:
      raw?.allowReturnShipmentCancel ?? DEFAULT_SETTINGS.allowReturnShipmentCancel,
    requireReturnReceivedBeforePaytrRefund:
      raw?.requireReturnReceivedBeforePaytrRefund ??
      DEFAULT_SETTINGS.requireReturnReceivedBeforePaytrRefund,
    allowManualReturnTrackingFallback:
      raw?.allowManualReturnTrackingFallback ??
      DEFAULT_SETTINGS.allowManualReturnTrackingFallback,

    defaultCarrier:
      raw?.defaultCarrier === "manual" ? "manual" : DEFAULT_SETTINGS.defaultCarrier,

    customerNote: safeStr(raw?.customerNote) || DEFAULT_SETTINGS.customerNote,
    returnCodeNote: safeStr(raw?.returnCodeNote) || DEFAULT_SETTINGS.returnCodeNote,

    returnReceiver: {
      companyName:
        safeStr(receiver?.companyName) ||
        DEFAULT_SETTINGS.returnReceiver.companyName,
      fullName:
        safeStr(receiver?.fullName) ||
        safeStr(receiver?.companyName) ||
        DEFAULT_SETTINGS.returnReceiver.fullName,
      phone: safeStr(receiver?.phone) || DEFAULT_SETTINGS.returnReceiver.phone,
      email: safeStr(receiver?.email) || DEFAULT_SETTINGS.returnReceiver.email,
      city: safeStr(receiver?.city) || DEFAULT_SETTINGS.returnReceiver.city,
      district:
        safeStr(receiver?.district) || DEFAULT_SETTINGS.returnReceiver.district,
      postalCode:
        safeStr(receiver?.postalCode) ||
        DEFAULT_SETTINGS.returnReceiver.postalCode,
      addressLine:
        safeStr(receiver?.addressLine) ||
        DEFAULT_SETTINGS.returnReceiver.addressLine,
    },
  };
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={s.settingRow}>
      <div>
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>

      <button
        type="button"
        className={`${s.switch} ${checked ? s.switchOn : ""}`}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}

export default function AdminRefundSettingsPage() {
  const db = useMemo(() => getFirebaseDb(), []);
const auth = useMemo(() => getFirebaseAuth(), []);

const [isMainAdmin, setIsMainAdmin] = useState(false);
const [deleteBusy, setDeleteBusy] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState("");
const [refundCount, setRefundCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<RefundSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setIsMainAdmin(false);
      return;
    }

    try {
      const tokenResult = await getIdTokenResult(user, true);
      const claims: any = tokenResult.claims || {};

      const roles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];
      const claimRole = String(claims.role || "").trim();

      let firestoreRole = "";

      try {
        const _userSnap = await getDocs( // eslint-disable-line @typescript-eslint/no-unused-vars
          query(collection(db, "users"), limit(1))
        );
      } catch {
        //
      }

      const userDocSnap = await import("firebase/firestore").then(({ getDoc }) =>
        getDoc(doc(db, "users", user.uid))
      );

      if (userDocSnap.exists()) {
        const userData: any = userDocSnap.data();
        firestoreRole = String(userData?.role || "").trim();
      }

      const mainAdmin =
        claims.admin === true ||
        claimRole === "admin" ||
        firestoreRole === "admin" ||
        roles.includes("admin");

      setIsMainAdmin(mainAdmin);
    } catch (e) {
      console.error("main admin check error:", e);
      setIsMainAdmin(false);
    }
  });

  return () => unsub();
}, [auth, db]);
useEffect(() => {
  if (!isMainAdmin) {
    setRefundCount(null);
    return;
  }

  const unsub = onSnapshot(
    collection(db, "refund_requests"),
    (snap) => {
      setRefundCount(snap.size);
    },
    (e) => {
      console.error("refund count listen error:", e);
      setRefundCount(null);
    }
  );

  return () => unsub();
}, [db, isMainAdmin]);
  useEffect(() => {
    const ref = doc(db, "settings", "refunds");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.exists() ? (snap.data() as Partial<RefundSettings>) : {};
        setSettings(normalizeSettings(d));
        setLoading(false);
      },
      (e) => {
        console.error("refund settings snapshot error:", e);
        setErr("İade ayarları yüklenemedi.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db]);

  function updateReceiver<K extends keyof RefundSettings["returnReceiver"]>(
    key: K,
    value: RefundSettings["returnReceiver"][K]
  ) {
    setSettings((p) => ({
      ...p,
      returnReceiver: {
        ...p.returnReceiver,
        [key]: value,
      },
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const clean: RefundSettings = {
        enabled: Boolean(settings.enabled),
        allowPartial: Boolean(settings.allowPartial),

        maxDaysAfterPaid: Math.floor(
          clampNumber(settings.maxDaysAfterPaid, 1, 365, 14)
        ),
        minAmountTry: Number(
          clampNumber(settings.minAmountTry, 1, 1_000_000, 1).toFixed(2)
        ),

        autoCreateReturnShipment: Boolean(settings.autoCreateReturnShipment),
        allowReturnShipmentCancel: Boolean(settings.allowReturnShipmentCancel),
        requireReturnReceivedBeforePaytrRefund: Boolean(
          settings.requireReturnReceivedBeforePaytrRefund
        ),
        allowManualReturnTrackingFallback: Boolean(
          settings.allowManualReturnTrackingFallback
        ),

        defaultCarrier: settings.defaultCarrier === "manual" ? "manual" : "mng",

        customerNote: safeStr(settings.customerNote),
        returnCodeNote: safeStr(settings.returnCodeNote),

        returnReceiver: {
          companyName: safeStr(settings.returnReceiver.companyName),
          fullName:
            safeStr(settings.returnReceiver.fullName) ||
            safeStr(settings.returnReceiver.companyName),
          phone: cleanPhone(settings.returnReceiver.phone),
          email: safeStr(settings.returnReceiver.email).toLowerCase(),
          city: safeStr(settings.returnReceiver.city),
          district: safeStr(settings.returnReceiver.district),
          postalCode: safeStr(settings.returnReceiver.postalCode),
          addressLine: safeStr(settings.returnReceiver.addressLine),
        },
      };

      if (!clean.returnReceiver.fullName) {
        throw new Error("İade alıcı adı / firma adı boş olamaz.");
      }

      if (!clean.returnReceiver.phone) {
        throw new Error("İade kargo kodu için mağaza telefon numarası zorunlu.");
      }

      if (!clean.returnReceiver.city || !clean.returnReceiver.district) {
        throw new Error("İade adresi için il ve ilçe zorunlu.");
      }

      if (!clean.returnReceiver.addressLine) {
        throw new Error("İade adres satırı boş olamaz.");
      }

      const nowIso = new Date().toISOString();

      await setDoc(
        doc(db, "settings", "refunds"),
        {
          ...clean,
          updatedAt: serverTimestamp(),
          updatedAtIso: nowIso,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "settings", "shipping"),
        {
          returnReceiver: clean.returnReceiver,
          store: clean.returnReceiver,
          updatedAt: serverTimestamp(),
          updatedAtIso: nowIso,
        },
        { merge: true }
      );

      setMsg("İade ayarları ve MNG iade alıcı bilgileri güncellendi.");
      window.setTimeout(() => setMsg(""), 2600);
    } catch (e: any) {
      console.error("refund settings save error:", e);
      setErr(e?.message || "İade ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }
async function deleteAllRefundRequests() {
  if (!isMainAdmin) {
    setErr("Bu işlem sadece ana admin tarafından yapılabilir.");
    return;
  }

  if (deleteConfirm.trim() !== "IADELERI SIL") {
    setErr('Devam etmek için kutuya tam olarak "IADELERI SIL" yazmalısın.');
    return;
  }

  const ok = window.confirm(
    "TÜM iade talepleri kalıcı olarak silinecek.\n\nBu işlem geri alınamaz. Emin misin?"
  );

  if (!ok) return;

  setDeleteBusy(true);
  setErr("");
  setMsg("");

  try {
    let deleted = 0;

    while (true) {
      const snap = await getDocs(query(collection(db, "refund_requests"), limit(450)));

      if (snap.empty) break;

      const batch = writeBatch(db);

      snap.docs.forEach((d) => {
        batch.delete(d.ref);
        deleted += 1;
      });

      await batch.commit();

      if (snap.size < 450) break;
    }

    setDeleteConfirm("");
    setMsg(`${deleted} adet iade talebi silindi.`);
    window.setTimeout(() => setMsg(""), 3000);
  } catch (e: any) {
    console.error("delete all refunds error:", e);
    setErr(e?.message || "İade talepleri silinemedi.");
  } finally {
    setDeleteBusy(false);
  }
}
  if (loading) {
    return (
      <main className={s.page}>
        <div className={s.stateCard}>İade ayarları yükleniyor…</div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div>
          <div className={s.kicker}>İADE / MNG KARGO / PAYTR</div>
          <h1 className={s.title}>İade Sistemi Ayarları</h1>
          <p className={s.desc}>
            Müşteri iade talebi, MNG iade kodu ve PayTR para iadesi akışını
            tek merkezden yönet.
          </p>
        </div>

        <div className={`${s.statusPill} ${settings.enabled ? s.statusOn : s.statusOff}`}>
          {settings.enabled ? "Aktif" : "Kapalı"}
        </div>
      </section>

      {err ? <div className={s.alertBad}>{err}</div> : null}
      {msg ? <div className={s.alertOk}>{msg}</div> : null}

      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2>Genel Kurallar</h2>
            <p>
              Bu ayarlar müşteri sipariş detayındaki iade talebi akışını ve
              admin operasyon ekranını etkiler.
            </p>
          </div>
        </div>

        <ToggleRow
          title="İade talepleri"
          desc="Müşteriler uygun siparişlerden iade talebi oluşturabilir."
          checked={settings.enabled}
          onChange={() => setSettings((p) => ({ ...p, enabled: !p.enabled }))}
        />

        <ToggleRow
          title="Kısmi iade"
          desc="Kapalıysa müşteri sadece tam iade talebi oluşturabilir."
          checked={settings.allowPartial}
          onChange={() =>
            setSettings((p) => ({ ...p, allowPartial: !p.allowPartial }))
          }
        />

        <ToggleRow
          title="MNG iade kodu otomatik oluşturulsun"
          desc="Açılırsa talep onaylandığında iade kargo kodu otomatik oluşturulabilir. Şimdilik manuel kullanım daha kontrollüdür."
          checked={settings.autoCreateReturnShipment}
          onChange={() =>
            setSettings((p) => ({
              ...p,
              autoCreateReturnShipment: !p.autoCreateReturnShipment,
            }))
          }
        />

        <ToggleRow
          title="İade kodu iptaline izin ver"
          desc="Admin, oluşturulan MNG iade kodunu iptal edebilir."
          checked={settings.allowReturnShipmentCancel}
          onChange={() =>
            setSettings((p) => ({
              ...p,
              allowReturnShipmentCancel: !p.allowReturnShipmentCancel,
            }))
          }
        />

        <ToggleRow
          title="Ürün teslim alınmadan para iadesini engelle"
          desc="Açık kalması önerilir. Ürün mağazaya ulaşmadan PayTR iadesi yapılmaz."
          checked={settings.requireReturnReceivedBeforePaytrRefund}
          onChange={() =>
            setSettings((p) => ({
              ...p,
              requireReturnReceivedBeforePaytrRefund:
                !p.requireReturnReceivedBeforePaytrRefund,
            }))
          }
        />

        <ToggleRow
          title="Manuel takip numarası fallback"
          desc="MNG iade kodu üretilemezse müşteri manuel kargo takip numarası girebilir."
          checked={settings.allowManualReturnTrackingFallback}
          onChange={() =>
            setSettings((p) => ({
              ...p,
              allowManualReturnTrackingFallback:
                !p.allowManualReturnTrackingFallback,
            }))
          }
        />

        <div className={s.grid2}>
          <label className={s.field}>
            <span>Maksimum iade günü</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.maxDaysAfterPaid}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  maxDaysAfterPaid: Number(e.target.value || 14),
                }))
              }
            />
          </label>

          <label className={s.field}>
            <span>Minimum iade tutarı</span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={settings.minAmountTry}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  minAmountTry: Number(e.target.value || 1),
                }))
              }
            />
          </label>
        </div>

        <label className={s.field}>
          <span>Varsayılan iade taşıyıcısı</span>
          <select
            value={settings.defaultCarrier}
            onChange={(e) =>
              setSettings((p) => ({
                ...p,
                defaultCarrier: e.target.value === "manual" ? "manual" : "mng",
              }))
            }
          >
            <option value="mng">MNG Kargo — anlaşmalı iade kodu</option>
            <option value="manual">Manuel takip numarası</option>
          </select>
        </label>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2>Müşteri Bilgilendirme Metinleri</h2>
            <p>
              Müşteri panelinde ve sipariş detayında görünen iade açıklamalarını
              buradan yönet.
            </p>
          </div>
        </div>

        <label className={s.field}>
          <span>Genel iade bilgilendirme metni</span>
          <textarea
            rows={4}
            value={settings.customerNote}
            onChange={(e) =>
              setSettings((p) => ({
                ...p,
                customerNote: e.target.value,
              }))
            }
          />
        </label>

        <label className={s.field}>
          <span>MNG iade kodu bilgilendirme metni</span>
          <textarea
            rows={4}
            value={settings.returnCodeNote}
            onChange={(e) =>
              setSettings((p) => ({
                ...p,
                returnCodeNote: e.target.value,
              }))
            }
          />
        </label>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2>MNG İade Alıcı Bilgileri</h2>
            <p>
              İade kargo kodu oluşturulurken MNG tarafına alıcı mağaza bilgisi
              olarak gönderilir. Telefon boş kalırsa MNG barkod oluşturmaz.
            </p>
          </div>
        </div>

        <div className={s.grid2}>
          <label className={s.field}>
            <span>Firma adı</span>
            <input
              value={settings.returnReceiver.companyName}
              onChange={(e) => updateReceiver("companyName", e.target.value)}
            />
          </label>

          <label className={s.field}>
            <span>Alıcı adı</span>
            <input
              value={settings.returnReceiver.fullName}
              onChange={(e) => updateReceiver("fullName", e.target.value)}
            />
          </label>

          <label className={s.field}>
            <span>Telefon</span>
            <input
              value={settings.returnReceiver.phone}
              onChange={(e) => updateReceiver("phone", e.target.value)}
              placeholder="05304788298"
            />
          </label>

          <label className={s.field}>
            <span>E-posta</span>
            <input
              value={settings.returnReceiver.email}
              onChange={(e) => updateReceiver("email", e.target.value)}
              placeholder="info@dromocob.tr"
            />
          </label>

          <label className={s.field}>
            <span>İl</span>
            <input
              value={settings.returnReceiver.city}
              onChange={(e) => updateReceiver("city", e.target.value)}
              placeholder="İSTANBUL"
            />
          </label>

          <label className={s.field}>
            <span>İlçe</span>
            <input
              value={settings.returnReceiver.district}
              onChange={(e) => updateReceiver("district", e.target.value)}
              placeholder="FETHİYE"
            />
          </label>

          <label className={s.field}>
            <span>Posta kodu</span>
            <input
              value={settings.returnReceiver.postalCode}
              onChange={(e) => updateReceiver("postalCode", e.target.value)}
              placeholder="48303"
            />
          </label>

          <label className={s.field}>
            <span>Adres</span>
            <input
              value={settings.returnReceiver.addressLine}
              onChange={(e) => updateReceiver("addressLine", e.target.value)}
              placeholder="Demo Showroom"
            />
          </label>
        </div>

        <div className={s.actions}>
          <button
            type="button"
            className={s.primaryBtn}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </section>
            {isMainAdmin ? (
        <section className={`${s.card} ${s.dangerCard}`}>
          <div className={s.cardHead}>
            <div>
              <h2>Tehlikeli Alan</h2>
              <p>
                Bu bölüm sadece ana admin içindir. Tüm iade taleplerini toplu
                olarak silebilirsin. Ayarlar silinmez, sadece
                refund_requests kayıtları temizlenir.
              </p>
            </div>
          </div>

          <div className={s.dangerBox}>
            <div>
              <strong>Mevcut iade kaydı</strong>
              <span>
                {refundCount === null
                  ? "Sayılıyor..."
                  : `${refundCount} kayıt`}
              </span>
            </div>

            <p>
              Bu işlem iade geçmişini, müşteri iade taleplerini ve muhasebede
              görünen iade hareketlerini temizler. Geri alınamaz.
            </p>

            <label className={s.field}>
              <span>Onay metni</span>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Devam etmek için: IADELERI SIL'
              />
            </label>

            <button
              type="button"
              className={s.dangerBtn}
              onClick={deleteAllRefundRequests}
              disabled={deleteBusy || deleteConfirm.trim() !== "IADELERI SIL"}
            >
              {deleteBusy ? "İadeler siliniyor..." : "Tüm İade Taleplerini Sil"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}