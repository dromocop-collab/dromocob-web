"use client";

import { useMemo, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase.client";
import {
  deleteMyAccountClient,
  reauthForAccountDelete,
} from "@/lib/deleteMyAccountClient";

type Props = {
  onDeleted?: () => void;
};

export default function DeleteAccountBox({ onDeleted }: Props) {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const user = auth.currentUser;
  const providerIds = user?.providerData?.map((p) => p.providerId) || [];
  const needsPassword = providerIds.includes("password");

  async function onDelete() {
    if (!user) {
      setErr("Oturum bulunamadı.");
      return;
    }

    if (confirmText !== "SİL") {
      setErr('Onay için kutuya tam olarak "SİL" yaz.');
      return;
    }

    setBusy(true);
    setErr("");
    setOk("");

    try {
      await reauthForAccountDelete(user, needsPassword ? password : undefined);
      await deleteMyAccountClient();

      setOk("Hesap silindi. Yönlendiriliyorsun...");
      onDeleted?.();

      setTimeout(() => {
        window.location.href = "/register";
      }, 800);
    } catch (e: any) {
      setErr(e?.message || "Hesap silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid rgba(220,38,38,.2)",
        borderRadius: 18,
        padding: 16,
        background: "rgba(220,38,38,.04)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 8 }}>Hesabı Sil</h3>

      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Bu işlem geri alınamaz. Profil verilerin silinir, kayıtlı adreslerin kaldırılır.
        Sipariş kayıtların operasyonel sebeplerle anonimleştirilerek saklanabilir.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {needsPassword ? (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifren"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.12)",
            }}
          />
        ) : null}

        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Onay için SİL yaz'
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,.12)",
          }}
        />

        {err ? (
          <div style={{ color: "#b91c1c", fontWeight: 700 }}>{err}</div>
        ) : null}

        {ok ? (
          <div style={{ color: "#166534", fontWeight: 700 }}>{ok}</div>
        ) : null}

        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: 0,
            background: "#b91c1c",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {busy ? "Siliniyor..." : "Hesabımı Kalıcı Olarak Sil"}
        </button>
      </div>
    </section>
  );
}