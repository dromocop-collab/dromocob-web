"use client";

import { useMemo, useState } from "react";
import styles from "./WheelPopup.module.css";

export type WheelGuestFormValue = {
  fullName: string;
  email: string;
  phone: string;
  consent: boolean;
};

type WheelGuestFormProps = {
  requireEmail?: boolean;
  requirePhone?: boolean;
  requireConsent?: boolean;
  disabled?: boolean;
  onSubmit: (data: WheelGuestFormValue) => void | Promise<void>;
};

function normalizeName(v: string) {
  return v.replace(/\s+/g, " ").trim();
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function normalizePhone(v: string) {
  return v.replace(/[^\d+]/g, "").trim();
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function WheelGuestForm({
  requireEmail = true,
  requirePhone = true,
  requireConsent = true,
  disabled = false,
  onSubmit,
}: WheelGuestFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBlocked = useMemo(
    () => disabled || isSubmitting,
    [disabled, isSubmitting]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isBlocked) return;

    const safeFullName = normalizeName(fullName);
    const safeEmail = normalizeEmail(email);
    const safePhone = normalizePhone(phone);

    if (!safeFullName) {
      setError("Ad soyad zorunlu.");
      return;
    }

    if (requireEmail && !safeEmail) {
      setError("E-posta zorunlu.");
      return;
    }

    if (requireEmail && safeEmail && !isValidEmail(safeEmail)) {
      setError("Geçerli bir e-posta gir.");
      return;
    }

    if (requirePhone && !safePhone) {
      setError("Telefon zorunlu.");
      return;
    }

    if (requireConsent && !consent) {
      setError("Onay vermen gerekiyor.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit({
        fullName: safeFullName,
        email: safeEmail,
        phone: safePhone,
        consent,
      });
    } catch (err) {
      console.error("WheelGuestForm submit error:", err);
      setError("Form gönderilemedi. Tekrar dene.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formBox}>
      <div className={styles.formTitle}>
        Çarkı çevirmeden önce bilgilerini bırak
      </div>

      <input
        className={styles.formInput}
        placeholder="Ad Soyad"
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value);
          if (error) setError("");
        }}
        disabled={isBlocked}
        autoComplete="name"
      />

      <input
        className={styles.formInput}
        placeholder="E-posta"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError("");
        }}
        disabled={isBlocked}
        autoComplete="email"
        inputMode="email"
      />

      <input
        className={styles.formInput}
        placeholder="Telefon"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (error) setError("");
        }}
        disabled={isBlocked}
        autoComplete="tel"
        inputMode="tel"
      />

      <label className={styles.formCheck}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (error) setError("");
          }}
          disabled={isBlocked}
        />
        <span>Kampanya ve iletişim onayını kabul ediyorum.</span>
      </label>

      {error ? <div className={styles.formError}>{error}</div> : null}

      <button type="submit" className={styles.ctaAlt} disabled={isBlocked}>
        {isBlocked ? "İşleniyor..." : "Devam Et"}
      </button>
    </form>
  );
}