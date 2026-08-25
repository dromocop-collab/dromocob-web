"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { login, loginWithApple, loginWithGoogle } from "@/lib/authClient";
import { getLocale, type Locale } from "@/lib/i18n";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import styles from "@/styles/authPage.module.css";

function humanizeAuthError(err: any) {
  const raw = String(err?.code || err?.message || err || "");
  const m = raw.toLowerCase();

  if (m.includes("auth/invalid-credential")) return "E-posta veya şifre hatalı.";
  if (m.includes("auth/user-not-found")) return "Bu e-posta ile kullanıcı bulunamadı.";
  if (m.includes("auth/wrong-password")) return "Şifre yanlış.";
  if (m.includes("auth/too-many-requests")) return "Çok deneme yapıldı, biraz bekle.";
  if (m.includes("auth/invalid-email")) return "Geçersiz e-posta.";
  if (m.includes("auth/account-exists-with-different-credential"))
    return "Bu e-posta farklı bir yöntemle kayıtlı. O yöntemle giriş yap.";
  if (m.includes("popup-closed-by-user") || m.includes("popup_closed_by_user"))
    return "Giriş penceresi kapatıldı. Tekrar dene.";
  if (m.includes("cancelled") || m.includes("canceled"))
    return "Giriş iptal edildi.";
  if (m.includes("popup")) return "Popup engellendi. Tarayıcı izinlerini kontrol et.";
  if (m.includes("network")) return "Bağlantı hatası. İnternetini kontrol et.";
  return "Giriş başarısız. Bilgileri kontrol et.";
}

export default function LoginPage() {
  const router = useRouter();

  const [loc, setLoc] = useState<Locale>("tr");
  useEffect(() => {
    setLoc(getLocale());
    const on = (e: any) => setLoc((e?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", on);
    return () => window.removeEventListener("locale-changed", on);
  }, []);

  const _msg = (loc === "tr" ? (tr as any) : (en as any)) ?? {}; // eslint-disable-line @typescript-eslint/no-unused-vars

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.trim().length >= 6 && !busy;
  }, [email, password, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      router.replace("/hesabim");
    } catch (e: any) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await loginWithGoogle(remember);
      router.replace("/hesabim");
    } catch (e: any) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    setErr(null);
    setBusy(true);
    try {
      await loginWithApple(remember);
      router.replace("/hesabim");
    } catch (e: any) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.shell}>
        <aside className={styles.left}>
          <div className={styles.brandRow}>
            <div className={styles.mark}>6</div>
            <div>
              <div className={styles.brandTitle}>Dromocob</div>
              <div className={styles.brandSub}>
                {loc === "en" ? "Premium customer panel" : "Premium müşteri paneli"}
              </div>
            </div>
          </div>

          <div className={styles.kicker}>
            {loc === "en" ? "Account Center" : "Hesap Merkezi"}
          </div>

          <h1 className={styles.heroTitle}>
            {loc === "en" ? "My Account" : "Hesabım"}
          </h1>

          <div className={styles.breadcrumb}>
            <Link href="/">{loc === "en" ? "Home" : "Anasayfa"}</Link>
            <span>›</span>
            <span>{loc === "en" ? "Login" : "Giriş"}</span>
          </div>

          <div className={styles.infoStack}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>
                {loc === "en" ? "Secure access" : "Güvenli erişim"}
              </div>
              <div className={styles.infoCardText}>
                {loc === "en"
                  ? "Manage profile, addresses and orders from one premium panel."
                  : "Profilini, adreslerini ve siparişlerini tek panelden yönet."}
              </div>
            </div>

            <div className={styles.infoMiniGrid}>
              <div className={styles.infoMini}>
                <strong>{loc === "en" ? "Orders" : "Siparişler"}</strong>
                <span>{loc === "en" ? "Track easily" : "Kolay takip"}</span>
              </div>

              <div className={styles.infoMini}>
                <strong>{loc === "en" ? "Addresses" : "Adresler"}</strong>
                <span>{loc === "en" ? "Fast checkout" : "Hızlı ödeme"}</span>
              </div>
            </div>
          </div>
        </aside>

        <section className={styles.right}>
          <div className={styles.card}>
            <header className={styles.cardHead}>
              <div className={styles.cardBadge}>
                {loc === "en" ? "Welcome back" : "Tekrar hoş geldin"}
              </div>

              <h2 className={styles.cardTitle}>
                {loc === "en" ? "Sign in" : "Giriş Yap"}
              </h2>

              <p className={styles.cardDesc}>
                {loc === "en"
                  ? "Secure access to your profile, addresses and orders."
                  : "Profil, adres ve siparişlerini güvenle yönet."}
              </p>
            </header>

            {err ? <div className={styles.alert}>{err}</div> : null}

            <div className={styles.providerGrid}>
              <button className={styles.providerBtn} type="button" onClick={onGoogle} disabled={busy}>
                {loc === "en" ? " Google" : " Google ile giriş"}
              </button>
              <button className={`${styles.providerBtn} ${styles.providerBtnApple}`} type="button" onClick={onApple} disabled={busy}>
                {loc === "en" ? " Apple" : " Apple ile giriş"}
              </button>
            </div>

            <div className={styles.divider}>
              <span>{loc === "en" ? "or" : "veya"}</span>
            </div>

            <form onSubmit={onSubmit} className={styles.form}>
              <label className={styles.label}>
                <span>{loc === "en" ? "Email" : "E-posta"}</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className={styles.label}>
                <span>{loc === "en" ? "Password" : "Şifre"}</span>
                <div className={styles.passRow}>
                  <input
                    className={styles.input}
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className={styles.passBtn}
                    onClick={() => setShowPass((s) => !s)}
                    aria-label="Şifreyi göster/gizle"
                  >
                    {showPass ? (loc === "en" ? "Hide" : "Gizle") : (loc === "en" ? "Show" : "Göster")}
                  </button>
                </div>
              </label>

              <div className={styles.rowBetween}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>{loc === "en" ? "Remember me" : "Beni hatırla"}</span>
                </label>

                <Link className={styles.link} href="/forgot">
                  {loc === "en" ? "Forgot password?" : "Şifremi unuttum"}
                </Link>
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={!canSubmit}>
                  {busy
                    ? loc === "en"
                      ? "Signing in..."
                      : "Giriş yapılıyor..."
                    : loc === "en"
                    ? "Sign in"
                    : "Giriş Yap"}
                </button>

                <Link className={styles.secondaryBtn} href="/register">
                  {loc === "en" ? "Create account" : "Kayıt Ol"}
                </Link>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}