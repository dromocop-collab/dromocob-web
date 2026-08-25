"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendVerifyCodeClient, verifyCodeClient } from "@/lib/emailVerifyClient";
import { getFirebaseAuth } from "@/lib/firebase.client";
import s from "./verify.module.css";

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const canUse = !!auth.currentUser;
  const email = auth.currentUser?.email || "";

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigit = useCallback(
    (idx: number, value: string) => {
      const char = value.replace(/\D/g, "").slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[idx] = char;
        return next;
      });
      if (char && idx < CODE_LENGTH - 1) {
        inputRefs.current[idx + 1]?.focus();
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[idx] && idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
      if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) {
        inputRefs.current[idx + 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const chars = pasted.split("");
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, i) => {
        if (i < CODE_LENGTH) next[i] = c;
      });
      return next;
    });
    const focusIdx = Math.min(chars.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  const code = digits.join("");

  async function onResend() {
    if (resendCooldown > 0) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendVerifyCodeClient();
      setMsg({ text: "Doğrulama kodu gönderildi. Gelen kutusu ve spam klasörünü kontrol edin.", ok: true });
      setResendCooldown(60);
    } catch (e: any) {
      setMsg({ text: e?.message || "Kod gönderilemedi.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (code.length < CODE_LENGTH) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setMsg({ text: `Lütfen ${CODE_LENGTH} haneli doğrulama kodunu girin.`, ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await verifyCodeClient(code);
      await new Promise((r) => setTimeout(r, 800));
      await auth.currentUser?.reload();
      await auth.currentUser?.getIdToken(true);
      if (!auth.currentUser?.emailVerified) {
        setMsg({ text: "Doğrulandı fakat hesap güncellenmedi. Birkaç saniye bekleyip tekrar deneyin.", ok: false });
        return;
      }
      setVerified(true);
      setMsg({ text: "E-posta başarıyla doğrulandı! Yönlendiriliyorsunuz...", ok: true });
      setTimeout(() => router.push("/hesabim"), 1500);
    } catch (e: any) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setMsg({ text: e?.message || "Kod doğrulanamadı. Lütfen tekrar deneyin.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={s.page}>
      {/* Background decorations */}
      <div className={s.bgOrb1} aria-hidden="true" />
      <div className={s.bgOrb2} aria-hidden="true" />
      <div className={s.bgOrb3} aria-hidden="true" />

      <div className={s.container}>
        {/* Back link */}
        <Link href="/hesabim" className={s.backLink}>
          ← Hesabıma dön
        </Link>

        <div className={`${s.card} ${verified ? s.cardVerified : ""}`}>
          {/* Icon */}
          <div className={`${s.iconWrap} ${verified ? s.iconVerified : ""}`}>
            {verified ? (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </div>

          {/* Kicker */}
          <div className={s.kicker}>
            {verified ? "DOĞRULAMA BAŞARILI" : "E-POSTA DOĞRULAMA"}
          </div>

          {/* Title */}
          <h1 className={s.title}>
            {verified ? "E-posta doğrulandı" : "Hesabınızı doğrulayın"}
          </h1>

          {/* Description */}
          <p className={s.desc}>
            {verified ? (
              "Hesabınız başarıyla doğrulandı. Artık tüm özellikleri kullanabilirsiniz."
            ) : email ? (
              <>
                <span className={s.emailHighlight}>{email}</span> adresine {CODE_LENGTH} haneli bir
                doğrulama kodu gönderdik. Kodu aşağıya girin.
              </>
            ) : (
              "Devam etmek için giriş yapmanız gerekiyor."
            )}
          </p>

          {/* Alert */}
          {msg ? (
            <div className={`${s.alert} ${msg.ok ? s.alertOk : s.alertErr}`}>
              <span className={s.alertIcon}>{msg.ok ? "✓" : "!"}</span>
              <span>{msg.text}</span>
            </div>
          ) : null}

          {!verified ? (
            <>
              {/* Code inputs */}
              <div className={`${s.codeRow} ${shake ? s.shake : ""}`} onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`${s.codeInput} ${d ? s.codeInputFilled : ""}`}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={busy || !canUse}
                    autoComplete="one-time-code"
                    aria-label={`Doğrulama kodu ${i + 1}. hane`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.primaryBtn}
                  onClick={onConfirm}
                  disabled={busy || !canUse || code.length < CODE_LENGTH}
                >
                  {busy ? (
                    <span className={s.spinner} />
                  ) : null}
                  {busy ? "Doğrulanıyor..." : "Doğrula"}
                </button>

                <button
                  type="button"
                  className={s.resendBtn}
                  onClick={onResend}
                  disabled={busy || !canUse || resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? `Yeniden gönder (${resendCooldown}s)`
                    : "Kodu yeniden gönder"}
                </button>
              </div>

              {/* Help text */}
              <div className={s.helpText}>
                <p>
                  Kodu almadınız mı? Spam / gereksiz klasörünüzü kontrol edin.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Security badge */}
        <div className={s.securityBadge}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 2l7 4v5c0 5.25-3.5 10-7 11-3.5-1-7-5.75-7-11V6l7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          <span>Verileriniz 256-bit SSL şifreleme ile korunmaktadır</span>
        </div>
      </div>
    </main>
  );
}