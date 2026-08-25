"use client";

import styles from "@/styles/account-verify-banner.module.css";

export default function AccountVerifyBanner({
  loc,
  onVerify,
}: {
  loc: "tr" | "en";
  onVerify: () => void;
}) {
  const isEn = loc === "en";

  return (
    <section
      className={styles.banner}
      role="status"
      aria-live="polite"
    >
      <div className={styles.left}>
        <div className={styles.badge}>
          {isEn ? "Verification Required" : "Doğrulama Gerekli"}
        </div>

        <h3 className={styles.title}>
          {isEn ? "Email not verified yet." : "E-posta henüz doğrulanmadı."}
        </h3>

        <p className={styles.text}>
          {isEn
            ? "Verify your email to save addresses, update account details and complete orders securely."
            : "Adres kaydetmek, hesap bilgilerini güncellemek ve siparişleri güvenle tamamlamak için e-postanı doğrula."}
        </p>
      </div>

      <div className={styles.right}>
        <button className={styles.verifyBtn} type="button" onClick={onVerify}>
          {isEn ? "Send verification code" : "Doğrulama kodunu gönder"}
        </button>
      </div>
    </section>
  );
}