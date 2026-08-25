"use client";

import DeleteAccountBox from "@/components/account/DeleteAccountBox";
import EnablePushBox from "@/components/account/EnablePushBox";
import styles from "@/styles/auth.module.css";

type Props = {
  loc: "tr" | "en";
  sBusy: boolean;
  sMsg: string | null;
  onStartPasswordReset: () => void;
  onLogout: () => void;
};

export default function SecurityTab({
  loc,
  sBusy,
  sMsg,
  onStartPasswordReset,
  onLogout,
}: Props) {
  const isEn = loc === "en";

  const securityItems = [
    {
      key: "session",
      label: isEn ? "Secure session" : "Güvenli oturum",
      desc: isEn
        ? "Your account actions are protected through verified session controls."
        : "Hesap işlemlerin doğrulanmış oturum kontrolleriyle korunur.",
      value: isEn ? "Active" : "Aktif",
      tone: "ok",
      icon: "◆",
    },
    {
      key: "notifications",
      label: isEn ? "Notifications" : "Bildirimler",
      desc: isEn
        ? "Receive important order, refund and support updates."
        : "Sipariş, iade ve destek süreçleri için önemli bildirimleri al.",
      value: isEn ? "Optional" : "İsteğe bağlı",
      tone: "info",
      icon: "◌",
    },
    {
      key: "privacy",
      label: isEn ? "Privacy controls" : "Gizlilik kontrolü",
      desc: isEn
        ? "Manage sensitive account actions from one secure area."
        : "Hassas hesap işlemlerini tek güvenli alandan yönet.",
      value: isEn ? "Protected" : "Korunuyor",
      tone: "gold",
      icon: "✦",
    },
  ];

  return (
    <div className={`${styles.contentCard} ${styles.securityVipCard}`}>
      <section className={styles.securityHero}>
        <div className={styles.securityHeroGlow} />

        <div className={styles.securityHeroLeft}>
          <div className={styles.securityKicker}>
            <span className={styles.securityLiveDot} />
            {isEn ? "Account Protection" : "Hesap Koruma Merkezi"}
          </div>

          <h2 className={styles.securityHeroTitle}>
            {isEn ? "Security Center" : "Güvenlik Merkezi"}
          </h2>

          <p className={styles.securityHeroDesc}>
            {isEn
              ? "Manage password reset, device session, push permissions and critical account actions from one premium control panel."
              : "Şifre yenileme, cihaz oturumu, bildirim izinleri ve kritik hesap işlemlerini tek premium kontrol panelinden yönet."}
          </p>
        </div>

        <div className={styles.securityHeroBadge}>
          <span>{isEn ? "Status" : "Durum"}</span>
          <b>{isEn ? "Protected" : "Koruma aktif"}</b>
        </div>
      </section>

      {sMsg ? (
        <div className={styles.securityAlert}>
          <span className={styles.securityAlertIcon}>✓</span>
          <span>{sMsg}</span>
        </div>
      ) : null}

      <section className={styles.securityStatusGrid}>
        {securityItems.map((item) => (
          <article key={item.key} className={styles.securityStatusCard}>
            <div className={styles.securityStatusIcon}>{item.icon}</div>

            <div className={styles.securityStatusBody}>
              <div className={styles.securityStatusTop}>
                <h3>{item.label}</h3>
                <span
                  className={`${styles.securityStatusPill} ${
                    styles[`securityTone_${item.tone}`]
                  }`}
                >
                  {item.value}
                </span>
              </div>

              <p>{item.desc}</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.securityActionGrid}>
        <article className={`${styles.securityActionCard} ${styles.passwordActionCard}`}>
          <div className={styles.securityActionTop}>
            <div className={styles.securityActionIcon}>⌁</div>

            <div>
              <h3>{isEn ? "Password reset" : "Şifre yenileme"}</h3>
              <p>
                {isEn
                  ? "Start a secure password reset flow for your account."
                  : "Hesabın için güvenli şifre yenileme akışını başlat."}
              </p>
            </div>
          </div>

          <div className={styles.securityActionNote}>
            {isEn
              ? "Recommended if you suspect unusual activity or want to refresh your access credentials."
              : "Şüpheli bir hareket fark ettiysen veya erişim bilgilerini yenilemek istiyorsan önerilir."}
          </div>

          <button
            className={styles.securityPrimaryBtn}
            type="button"
            onClick={onStartPasswordReset}
            disabled={sBusy}
          >
            <span>{sBusy ? "…" : "→"}</span>
            {sBusy
              ? isEn
                ? "Redirecting..."
                : "Yönlendiriliyor..."
              : isEn
              ? "Go to password reset"
              : "Şifre yenileme ekranına git"}
          </button>
        </article>

        <article className={`${styles.securityActionCard} ${styles.logoutActionCard}`}>
          <div className={styles.securityActionTop}>
            <div className={styles.securityActionIcon}>⨉</div>

            <div>
              <h3>{isEn ? "Sign out" : "Çıkış yap"}</h3>
              <p>
                {isEn
                  ? "Safely end your current session on this device."
                  : "Bu cihazdaki mevcut oturumunu güvenli şekilde sonlandır."}
              </p>
            </div>
          </div>

          <div className={styles.securityActionNote}>
            {isEn
              ? "Use this option especially on shared or public devices."
              : "Özellikle ortak veya herkese açık cihazlarda bu seçeneği kullan."}
          </div>

          <button
            className={styles.securityDangerBtn}
            type="button"
            onClick={onLogout}
          >
            <span>⨉</span>
            {isEn ? "Log out securely" : "Güvenli çıkış yap"}
          </button>
        </article>
      </section>

      <section className={styles.securityPushShell}>
        <div className={styles.securityBlockHead}>
          <div>
            <h3>{isEn ? "Push notification permission" : "Bildirim izni"}</h3>
            <p>
              {isEn
                ? "Enable notifications to receive order, refund and support updates instantly."
                : "Sipariş, iade ve destek gelişmelerini anında almak için bildirimleri etkinleştir."}
            </p>
          </div>

          <span className={styles.securityMiniBadge}>
            {isEn ? "Recommended" : "Önerilir"}
          </span>
        </div>

        <EnablePushBox loc={loc} />
      </section>

      <section className={styles.securityDangerZone}>
        <div className={styles.securityBlockHead}>
          <div>
            <h3>{isEn ? "Critical account actions" : "Kritik hesap işlemleri"}</h3>
            <p>
              {isEn
                ? "Account deletion is permanent. Review carefully before taking action."
                : "Hesap silme işlemi kalıcıdır. İşlem yapmadan önce dikkatlice kontrol et."}
            </p>
          </div>

          <span className={styles.securityDangerBadge}>
            {isEn ? "Sensitive" : "Hassas"}
          </span>
        </div>

        <DeleteAccountBox />
      </section>
    </div>
  );
}