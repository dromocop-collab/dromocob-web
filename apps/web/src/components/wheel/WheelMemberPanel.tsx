"use client";

import styles from "./WheelPopup.module.css";

type WheelMemberPanelProps = {
  displayName: string;
  email: string;
  onContinue: () => void;
  disabled?: boolean;
};

export default function WheelMemberPanel({
  displayName,
  email,
  onContinue,
  disabled = false,
}: WheelMemberPanelProps) {
  const safeName = String(displayName || "").trim() || "Üye kullanıcı";
  const safeEmail = String(email || "").trim() || "-";

  return (
    <div className={styles.memberBox}>
      <div className={styles.memberTitle}>
        Hesabın hazır, direkt çevirebilirsin
      </div>

      <div className={styles.memberMeta}>
        <div className={styles.memberRow}>
          <span className={styles.memberLabel}>Kullanıcı</span>
          <strong className={styles.memberValue}>{safeName}</strong>
        </div>

        <div className={styles.memberRow}>
          <span className={styles.memberLabel}>E-posta</span>
          <strong className={styles.memberValue}>{safeEmail}</strong>
        </div>
      </div>

      <button
        type="button"
        className={styles.ctaAlt}
        onClick={onContinue}
        disabled={disabled}
      >
        {disabled ? "Çark hazırlanıyor..." : "Devam Et"}
      </button>
    </div>
  );
}