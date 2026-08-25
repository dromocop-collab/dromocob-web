"use client";

import { useEffect, type CSSProperties } from "react";
import type { WheelCampaignDoc } from "@/types/wheel";
import WheelGuestForm, { type WheelGuestFormValue } from "./WheelGuestForm";
import { getFirebaseAuth } from "@/lib/firebase.client";
import styles from "./WheelPopup.module.css";
import WheelMemberPanel from "./WheelMemberPanel";

type WheelPopupProps = {
  open: boolean;
  campaign: WheelCampaignDoc | null;
  memberDisplayName?: string;
  onClose: () => void;
  onStart?: (guestData?: WheelGuestFormValue | null) => void;
};

function safeColor(v: string | undefined, fallback: string) {
  const x = String(v || "").trim();
  return x || fallback;
}

export default function WheelPopup({
  open,
  campaign,
  memberDisplayName,
  onClose,
  onStart,
}: WheelPopupProps) {
  const auth = getFirebaseAuth();
  const authUser = auth.currentUser;
  const isMember = !!(authUser && !authUser.isAnonymous);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !campaign) return null;

  const theme = campaign.wheelTheme || {};
  const ui = campaign.ui || {};

  const primary = safeColor(theme.primary, "#15213b");
  const secondary = safeColor(theme.secondary, "#d7b45d");
  const tertiary = safeColor(theme.tertiary, "#ead7aa");
  const neutral = safeColor(theme.neutral, "#f8f2e6");

  const headline =
    ui.headline ||
    campaign.heroTitle ||
    "Şansını Çevir, İndirimini Kap";

  const subheadline =
    ui.subheadline ||
    campaign.heroText ||
    "Kampanyaya katıl, çarkı çevir, anında kupon kazan.";

function handleGuestContinue(data: WheelGuestFormValue) {
  console.log("[WheelPopup] guest continue fired", data);
  onStart?.(data);
}

  function handleMemberContinue() {
    onStart?.(null);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={
          {
            ["--wheel-primary" as any]: primary,
            ["--wheel-secondary" as any]: secondary,
            ["--wheel-tertiary" as any]: tertiary,
            ["--wheel-neutral" as any]: neutral,
          } as CSSProperties
        }
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Kapat"
        >
          ×
        </button>

        <div className={styles.left}>
          <div className={styles.kicker}>DROMOCOB • ŞANS ÇARKI</div>
          <h2 className={styles.title}>{headline}</h2>
          <p className={styles.sub}>{subheadline}</p>

          <div className={styles.tags}>
            <span className={styles.tag}>✦ Anında kupon</span>
            <span className={styles.tag}>✓ Güvenli tek çevirim</span>
            <span className={styles.tag}>✉ E-posta teslimi</span>
          </div>

          {isMember ? (
            <WheelMemberPanel
              displayName={memberDisplayName || authUser?.displayName || "Üye kullanıcı"}
              email={authUser?.email || ""}
              onContinue={handleMemberContinue}
            />
          ) : (
            <WheelGuestForm
              requireEmail
              requirePhone={campaign.requirePhone !== false}
              requireConsent={campaign.requireConsent !== false}
              onSubmit={handleGuestContinue}
            />
          )}

          <div className={styles.noteCardLeft}>
            <div className={styles.noteTitle}>Bugünün fırsatı</div>
            <div className={styles.noteText}>
              Çarkı çevir, kuponunu anında kap.
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.wheelPreview}>
            <div className={styles.pointer} />
            <div className={styles.previewWheel}>
              <div className={styles.previewCenter}>6</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
