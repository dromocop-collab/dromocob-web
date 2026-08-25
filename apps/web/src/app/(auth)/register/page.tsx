"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register, loginWithGoogle, loginWithApple } from "@/lib/authClient";

import { getLocale, type Locale } from "@/lib/i18n";
import styles from "@/styles/authPage.module.css";

function humanizeRegisterError(err: any) {
  const raw = String(err?.code || err?.message || err || "");
  const m = raw.toLowerCase();

  if (m.includes("auth/email-already-in-use")) return "Bu e-posta zaten kayıtlı.";
  if (m.includes("auth/weak-password")) return "Şifre çok zayıf (en az 6 karakter).";
  if (m.includes("auth/invalid-email")) return "Geçersiz e-posta.";
  if (m.includes("auth/account-exists-with-different-credential"))
    return "Bu e-posta farklı bir yöntemle kayıtlı. O yöntemle giriş yap.";
  if (m.includes("popup-closed-by-user") || m.includes("popup_closed_by_user"))
    return "Pencere kapatıldı. Tekrar dene.";
  if (m.includes("cancelled") || m.includes("canceled"))
    return "İşlem iptal edildi.";
  if (m.includes("popup")) return "Popup engellendi. Tarayıcı izinlerini kontrol et.";
  if (m.includes("network")) return "Bağlantı hatası. İnternetini kontrol et.";
  return "Kayıt başarısız. Bilgileri kontrol et.";
}

export default function RegisterPage() {
  const router = useRouter();

  const [loc, setLoc] = useState<Locale>("tr");
  useEffect(() => {
    setLoc(getLocale());
    const on = (e: any) => setLoc((e?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", on);
    return () => window.removeEventListener("locale-changed", on);
  }, []);

  const [email, setEmail] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && p1.trim().length >= 6 && p2.trim().length >= 6 && !busy;
  }, [email, p1, p2, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setOk(null);

    if (p1 !== p2) {
      setErr(loc === "en" ? "Passwords do not match." : "Şifreler aynı değil.");
      return;
    }

    setBusy(true);
    try {
      await register(email.trim(), p1);
      setOk(
        loc === "en"
          ? "Account created. Verification email sent. Please verify to unlock full features."
          : "Hesap oluşturuldu. Doğrulama e-postası gönderildi. Tüm özellikler için doğrula."
      );
      // Hesabım’a gönder; orada doğrulama bannerı + resend var
      router.push("/hesabim");
    } catch (e: any) {
      setErr(humanizeRegisterError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await loginWithGoogle(true);
      router.push("/hesabim");
    } catch (e: any) {
      setErr(humanizeRegisterError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await loginWithApple(true);
      router.push("/hesabim");
    } catch (e: any) {
      setErr(humanizeRegisterError(e));
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
    {loc === "en" ? "Create account" : "Hesap Oluştur"}
  </h1>

  <div className={styles.breadcrumb}>
    <Link href="/">{loc === "en" ? "Home" : "Anasayfa"}</Link>
    <span>›</span>
    <span>{loc === "en" ? "Register" : "Kayıt"}</span>
  </div>

  <div className={styles.infoStack}>
    <div className={styles.infoCard}>
      <div className={styles.infoCardTitle}>
        {loc === "en" ? "Fast start" : "Hızlı başlangıç"}
      </div>
      <div className={styles.infoCardText}>
        {loc === "en"
          ? "Create your account to manage orders, addresses and favorites."
          : "Hesabını oluştur, siparişlerini, adreslerini ve favorilerini yönet."}
      </div>
    </div>

    <div className={styles.infoMiniGrid}>
      <div className={styles.infoMini}>
        <strong>{loc === "en" ? "Orders" : "Siparişler"}</strong>
        <span>{loc === "en" ? "Track easily" : "Kolay takip"}</span>
      </div>

      <div className={styles.infoMini}>
        <strong>{loc === "en" ? "Favorites" : "Favoriler"}</strong>
        <span>{loc === "en" ? "Save items" : "Ürün kaydet"}</span>
      </div>
    </div>
  </div>
</aside>

        <section className={styles.right}>
          <div className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{loc === "en" ? "Register" : "Kayıt Ol"}</h2>
              <p className={styles.cardDesc}>
                {loc === "en" ? "Create your account securely." : "Hesabını güvenli şekilde oluştur."}
              </p>
            </header>

            {err ? <div className={styles.alert}>{err}</div> : null}
            {ok ? (
              <div
                className={styles.alert}
                style={{ borderColor: "rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.04)", color: "#111" }}
              >
                {ok}
              </div>
            ) : null}

            <div className={styles.providerGrid}>
              <button className={styles.providerBtn} type="button" onClick={onGoogle} disabled={busy}>
                {loc === "en" ? " Google" : " Google ile kayıt"}
              </button>
              <button className={`${styles.providerBtn} ${styles.providerBtnApple}`} type="button" onClick={onApple} disabled={busy}>
                {loc === "en" ? " Apple" : " Apple ile kayıt"}
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
                <input
                  className={styles.input}
                  type="password"
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  placeholder={loc === "en" ? "At least 6 characters" : "En az 6 karakter"}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className={styles.label}>
                <span>{loc === "en" ? "Password (again)" : "Şifre (tekrar)"}</span>
                <input
                  className={styles.input}
                  type="password"
                  value={p2}
                  onChange={(e) => setP2(e.target.value)}
                  placeholder={loc === "en" ? "Repeat password" : "Tekrar yaz"}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={!canSubmit}>
                  {busy ? (loc === "en" ? "Creating..." : "Oluşturuluyor...") : (loc === "en" ? "Create account" : "Hesap Oluştur")}
                </button>

                <Link className={styles.secondaryBtn} href="/login">
                  {loc === "en" ? "Back to login" : "Girişe Dön"}
                </Link>
              </div>

              <p className={styles.note}>Kayıt sonrası e-posta doğrulaması zorunlu. Güvenlik için.</p>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}