"use client";

import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { useLocale } from "@/lib/useT";
import { getFirebaseAuth } from "@/lib/firebase.client";
import { onAuthStateChanged, type User } from "firebase/auth";
import styles from "./newsletterStrip.module.css";

const LS_KEY = "nci_newsletter_sub";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SavedSub = {
  email: string;
  couponCode: string;
  subscribedAt: number;
};

type Props = {
  cfg?: {
    enabled?: boolean;
    title?: { tr?: string; en?: string };
    text?: { tr?: string; en?: string };
    btnLabel?: { tr?: string; en?: string };
    incentive?: { tr?: string; en?: string };
  } | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function NewsletterStrip({ cfg }: Props) {
  const loc = useLocale();
  const copyTimerRef = useRef<number | null>(null);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [savedSub, setSavedSub] = useState<SavedSub | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as SavedSub;
      if (parsed?.email) {
        setSavedSub(parsed);
        setCouponCode(parsed.couponCode || "");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && !u.isAnonymous && u.email) {
        setUser(u);
        setEmail((prev) => prev || u.email || "");
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const isLoggedIn = !!user?.email;

  const normalizedUserEmail = normalizeEmail(user?.email || "");
  const normalizedSavedEmail = normalizeEmail(savedSub?.email || "");

  const isAlreadySubscribed =
    !!savedSub?.email &&
    (!isLoggedIn || normalizedSavedEmail === normalizedUserEmail);

  const title =
    (loc === "en" ? cfg?.title?.en : cfg?.title?.tr) ||
    (loc === "en" ? "Stay in the Loop" : "Yeniliklerden Haberdar Ol");

  const text =
    (loc === "en" ? cfg?.text?.en : cfg?.text?.tr) ||
    (loc === "en"
      ? "Subscribe to our newsletter for exclusive offers, new collections and special discounts."
      : "Yeni koleksiyonlar, özel indirimler ve kampanyalardan ilk sen haberdar ol.");

  const btnLabel =
    (loc === "en" ? cfg?.btnLabel?.en : cfg?.btnLabel?.tr) ||
    (loc === "en" ? "Subscribe" : "Abone Ol");

  const incentive =
    (loc === "en" ? cfg?.incentive?.en : cfg?.incentive?.tr) ||
    (loc === "en"
      ? "🎁 Get 5% off your first order when you subscribe!"
      : "🎁 Abone olana ilk siparişte %5 indirim!");

  const setSavedSubscription = useCallback((sub: SavedSub) => {
    setSavedSub(sub);
    setCouponCode(sub.couponCode || "");

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sub));
    } catch {
      // ignore
    }
  }, []);

  const subscribe = useCallback(
    async (targetEmail: string) => {
      const trimmed = normalizeEmail(targetEmail);

      if (!trimmed || !EMAIL_RE.test(trimmed)) {
        setStatus("error");
        setErrorText(
          loc === "en"
            ? "Please enter a valid email address."
            : "Lütfen geçerli bir e-posta adresi girin."
        );
        return;
      }

      setStatus("saving");
      setErrorText("");

      try {
        const idToken = user ? await user.getIdToken() : "";
        const res = await fetch("/api/newsletter/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            email: trimmed,
            locale: loc,
            source: "homepage",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setStatus("error");
          setErrorText(
            data?.error || (loc === "en"
              ? "Something went wrong. Please try again."
              : "Bir hata oluştu. Lütfen tekrar deneyin.")
          );
          return;
        }

        const data = await res.json();
        const code = data?.couponCode || "";

        setSavedSubscription({
          email: trimmed,
          couponCode: code,
          subscribedAt: Date.now(),
        });

        setStatus("done");
      } catch {
        setStatus("error");
        setErrorText(
          loc === "en"
            ? "Network error. Please try again."
            : "Bağlantı hatası. Lütfen tekrar deneyin."
        );
      }
    },
    [loc, user, setSavedSubscription]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await subscribe(email);
    },
    [email, subscribe]
  );

  const handleQuickSubscribe = useCallback(async () => {
    if (user?.email) {
      await subscribe(user.email);
    }
  }, [user?.email, subscribe]);

  const copyCode = useCallback(async () => {
    if (!couponCode) return;

    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // ignore
    }
  }, [couponCode]);

  if (cfg?.enabled === false) return null;

  return (
    <section className={styles.strip} aria-labelledby="newsletter-strip-title">
      <div className={styles.shell}>
        <div className={styles.content}>
          <div className={styles.badge}>{incentive}</div>
          <h2 id="newsletter-strip-title" className={styles.title}>
            {title}
          </h2>
          <p className={styles.text}>{text}</p>
        </div>

        <div className={styles.form}>
          {status === "done" || isAlreadySubscribed ? (
            <div className={styles.successMsg} role="status" aria-live="polite">
              <div className={styles.successTitle}>
                {loc === "en"
                  ? "✅ Thank you! You're subscribed."
                  : "✅ Teşekkürler! Aboneliğiniz aktif."}
              </div>

              {couponCode ? (
                <div className={styles.couponWrap}>
                  <span className={styles.couponLabel}>
                    {loc === "en" ? "Your 5% discount code:" : "%5 indirim kodunuz:"}
                  </span>

                  <button
                    type="button"
                    className={styles.couponCode}
                    onClick={copyCode}
                    title={loc === "en" ? "Click to copy" : "Kopyalamak için tıkla"}
                  >
                    <span>{couponCode}</span>
                    <span className={styles.copyIcon}>
                      {copied ? (loc === "en" ? "✓ Copied" : "✓ Kopyalandı") : "📋"}
                    </span>
                  </button>

                  <span className={styles.couponNote}>
                    {loc === "en"
                      ? "Use this code at checkout for 5% off your first order."
                      : "Bu kodu ödeme sayfasında kullanarak ilk siparişinizde %5 indirim kazanın."}
                  </span>
                </div>
              ) : null}
            </div>
          ) : isLoggedIn ? (
            <>
              <div className={styles.inputWrap}>
                <div className={styles.loggedInInfo}>
                  <span className={styles.loggedInIcon}>✉️</span>
                  <span className={styles.loggedInEmail}>{user?.email}</span>
                </div>

                <button
                  type="button"
                  className={styles.btn}
                  onClick={handleQuickSubscribe}
                  disabled={status === "saving"}
                >
                  {status === "saving"
                    ? loc === "en"
                      ? "Saving..."
                      : "Kaydediliyor..."
                    : btnLabel}
                </button>
              </div>

              {status === "error" ? (
                <div className={styles.errorMsg} role="alert">
                  {errorText}
                </div>
              ) : null}

              <p className={styles.privacy}>
                {loc === "en"
                  ? "We respect your privacy. Unsubscribe anytime."
                  : "Gizliliğinize saygı duyuyoruz. İstediğiniz zaman abonelikten çıkabilirsiniz."}
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className={styles.inputWrap}>
                <input
                  type="email"
                  className={styles.input}
                  placeholder={loc === "en" ? "Your email address" : "E-posta adresiniz"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "saving"}
                  autoComplete="email"
                />

                <button type="submit" className={styles.btn} disabled={status === "saving"}>
                  {status === "saving"
                    ? loc === "en"
                      ? "Saving..."
                      : "Kaydediliyor..."
                    : btnLabel}
                </button>
              </div>

              {status === "error" ? (
                <div className={styles.errorMsg} role="alert">
                  {errorText}
                </div>
              ) : null}

              <p className={styles.privacy}>
                {loc === "en"
                  ? "We respect your privacy. Unsubscribe anytime."
                  : "Gizliliğinize saygı duyuyoruz. İstediğiniz zaman abonelikten çıkabilirsiniz."}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
