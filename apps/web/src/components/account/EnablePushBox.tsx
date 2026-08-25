"use client";

import { useEffect, useState } from "react";
import {
  disableCurrentPushToken,
  getCurrentPushState,
  requestPushPermissionAndSaveToken,
} from "@/lib/push";
import styles from "@/styles/auth.module.css";

export default function EnablePushBox({
  loc = "tr",
}: {
  loc?: "tr" | "en";
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loadingState, setLoadingState] = useState(true);

  const isEn = loc === "en";

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const state = await getCurrentPushState();
        if (!mounted) return;
        setEnabled(state.enabled);
      } catch {
        if (!mounted) return;
        setEnabled(false);
      } finally {
        if (mounted) setLoadingState(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onToggle() {
    setBusy(true);
    setMsg(null);

    try {
      if (enabled) {
        await disableCurrentPushToken();
        setEnabled(false);
        setMsg(
          isEn
            ? "Push notifications are disabled."
            : "Push bildirimleri kapatıldı."
        );
      } else {
        await requestPushPermissionAndSaveToken();
        setEnabled(true);
        setMsg(
          isEn
            ? "Push notifications are enabled."
            : "Push bildirimleri açıldı."
        );
      }
    } catch (e: any) {
      setMsg(
        String(
          e?.message ||
            (isEn
              ? "Push notifications could not be updated."
              : "Push bildirimleri güncellenemedi.")
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.securityCard}>
      <div className={styles.securityTitle}>
        {isEn ? "Push notifications" : "Push bildirimleri"}
      </div>

      <div className={styles.securityText}>
        {isEn
          ? "Get instant notifications for campaigns, stock alerts, and order updates."
          : "Kampanya, stok ve sipariş güncellemelerini anında al."}
      </div>

      <button
        className={enabled ? styles.dangerWideBtn : styles.heroPrimaryBtn}
        type="button"
        onClick={onToggle}
        disabled={busy || loadingState}
      >
        {loadingState
          ? isEn
            ? "Checking..."
            : "Kontrol ediliyor..."
          : busy
          ? isEn
            ? "Updating..."
            : "Güncelleniyor..."
          : enabled
          ? isEn
            ? "Disable notifications"
            : "Bildirimleri Kapat"
          : isEn
          ? "Enable notifications"
          : "Bildirimleri Aç"}
      </button>

      {msg ? <div className={styles.inlineAlert}>{msg}</div> : null}
    </div>
  );
}