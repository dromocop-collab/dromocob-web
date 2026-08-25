"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  confirmPasswordResetCodeClient,
  sendPasswordResetCodeClient,
} from "@/lib/passwordResetClient";
import styles from "@/styles/authPage.module.css";

function humanizeError(err: any) {
  const raw = String(err?.message || err || "").toLowerCase();

  if (raw.includes("kod yanlış")) return "Kod yanlış.";
  if (raw.includes("süresi dolmuş")) return "Kodun süresi dolmuş. Yeni kod iste.";
  if (raw.includes("zaten kullanılmış")) return "Bu kod zaten kullanılmış. Yeni kod iste.";
  if (raw.includes("en az 6")) return "Yeni şifre en az 6 karakter olmalı.";
  if (raw.includes("45")) return "Yeni kod istemek için biraz bekle.";
  return "Şifre sıfırlanamadı. Bilgileri kontrol et.";
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = useMemo(
    () => String(searchParams.get("email") || "").trim().toLowerCase(),
    [searchParams]
  );
  const sent = searchParams.get("sent") === "1";

  const [email] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    sent && initialEmail
      ? `${initialEmail} adresine doğrulama kodu gönderildi.`
      : null
  );

  const canSubmit =
    !!email &&
    code.trim().length >= 6 &&
    newPassword.trim().length >= 6 &&
    newPassword2.trim().length >= 6 &&
    !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      setMsg("E-posta bilgisi eksik. Lütfen yeniden başlat.");
      return;
    }

    if (newPassword.trim().length < 6) {
      setMsg("Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    if (newPassword !== newPassword2) {
      setMsg("Şifreler eşleşmiyor.");
      return;
    }

    setBusy(true);
    setMsg(null);

    try {
      await confirmPasswordResetCodeClient(email, code.trim(), newPassword);
      setMsg("Şifre başarıyla yenilendi. Giriş sayfasına yönlendiriliyorsun.");

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (e: any) {
      setMsg(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email) return;
    setBusy(true);
    setMsg(null);

    try {
      await sendPasswordResetCodeClient(email);
      setMsg("Kod yeniden gönderildi. Gelen kutusu ve spam klasörünü kontrol et.");
    } catch (e: any) {
      setMsg(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.shell}>
        <section className={styles.right} style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className={styles.card}>
            <header className={styles.cardHead}>
              <div className={styles.cardBadge}>Şifre Yenile</div>
              <h1 className={styles.cardTitle}>Kod ile Sıfırla</h1>
              <p className={styles.cardDesc}>Doğrulama kodunu ve yeni şifreni gir.</p>
            </header>

            {msg ? <div className={styles.alert}>{msg}</div> : null}

            <form onSubmit={onSubmit} className={styles.form}>
              <label className={styles.label}>
                <span>E-posta</span>
                <input className={styles.input} type="email" value={email} readOnly />
              </label>

              <div style={{ marginTop: -8, marginBottom: 8 }}>
                <Link className={styles.link} href="/forgot">
                  Başka bir e-posta kullan
                </Link>
              </div>

              <label className={styles.label}>
                <span>Doğrulama Kodu</span>
                <input
                  className={styles.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  required
                />
              </label>

              <label className={styles.label}>
                <span>Yeni Şifre</span>
                <input
                  className={styles.input}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>

              <label className={styles.label}>
                <span>Yeni Şifre Tekrar</span>
                <input
                  className={styles.input}
                  type="password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={!canSubmit}>
                  {busy ? "Kontrol ediliyor..." : "Şifreyi Yenile"}
                </button>

                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={onResend}
                  disabled={busy || !email}
                >
                  Kodu yeniden gönder
                </button>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}