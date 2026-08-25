"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetCodeClient } from "@/lib/passwordResetClient";
import styles from "@/styles/authPage.module.css";

function humanizeError(err: any) {
  const raw = String(err?.message || err || "").toLowerCase();
  if (raw.includes("45")) return "Çok hızlı tekrar denendi. 45 saniye bekle.";
  return "Kod gönderilemedi. Lütfen tekrar dene.";
}

export default function ForgotPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setBusy(true);
    setMsg(null);

    try {
      await sendPasswordResetCodeClient(cleanEmail);

      router.push(
        `/reset-password?email=${encodeURIComponent(cleanEmail)}&sent=1`
      );
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
              <div className={styles.cardBadge}>Şifre Sıfırlama</div>
              <h1 className={styles.cardTitle}>Kod Gönder</h1>
              <p className={styles.cardDesc}>
                E-posta adresini gir, sana 6 haneli sıfırlama kodu gönderelim.
              </p>
            </header>

            {msg ? <div className={styles.alert}>{msg}</div> : null}

            <form onSubmit={onSubmit} className={styles.form}>
              <label className={styles.label}>
                <span>E-posta</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  required
                />
              </label>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={busy || !email.trim()}>
                  {busy ? "Gönderiliyor..." : "Kod Gönder"}
                </button>

                <Link className={styles.secondaryBtn} href="/login">
                  Vazgeç
                </Link>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}