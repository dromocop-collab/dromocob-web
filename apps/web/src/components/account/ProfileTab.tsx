"use client";

import Link from "next/link";
import { useMemo } from "react";
import styles from "@/styles/account-profile-tab.module.css";

type Profile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  defaultAddressId?: string;
  consentApproved?: boolean;
};

type FieldErrors = Partial<Record<keyof Profile, string>> & {
  general?: string;
};

function onlyDigits(v: string) {
  return String(v || "").replace(/\D+/g, "");
}

function formatPhoneTR(v: string) {
  const d = onlyDigits(v).slice(0, 11);

  if (!d) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length < 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

function isAdultEnough(dateStr: string) {
  if (!dateStr) return false;

  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return false;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();

  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 18;
}

function getAdultMaxDate() {
  const now = new Date();
  const yyyy = now.getFullYear() - 18;
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function validateProfile(profile: Profile, loc: "tr" | "en"): FieldErrors {
  const errors: FieldErrors = {};

  const phone = onlyDigits(profile.phone || "");
  const birthDate = String(profile.birthDate || "").trim();

  if (phone && !(phone.length === 10 || phone.length === 11)) {
    errors.phone =
      loc === "en"
        ? "Enter a valid phone number."
        : "Geçerli bir telefon numarası gir.";
  }

  if (birthDate && !isAdultEnough(birthDate)) {
    errors.birthDate =
      loc === "en"
        ? "You must be at least 18 years old."
        : "Üyelik için 18 yaş ve üzeri olmalısın.";
  }

  return errors;
}

export default function ProfileTab({
  loc,
  profile,
  setProfile,
  userEmail,
  canWrite,
  pBusy,
  pMsg,
  lockMsg,
  onSave,
}: {
  loc: "tr" | "en";
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  userEmail: string;
  canWrite: boolean;
  pBusy: boolean;
  pMsg: string | null;
  lockMsg: string;
  onSave: () => void;
}) {
  const errors = useMemo(() => validateProfile(profile, loc), [profile, loc]);
  const hasErrors = Object.keys(errors).length > 0;
  const maxBirthDate = useMemo(() => getAdultMaxDate(), []);

  const text = {
    title: loc === "en" ? "Profile Information" : "Profil Bilgileri",
    desc:
      loc === "en"
        ? "You can update your profile information here. All fields are optional."
        : "Profil bilgilerini buradan güncelleyebilirsin. Tüm alanlar isteğe bağlıdır.",
    firstName: loc === "en" ? "First name" : "Ad",
    lastName: loc === "en" ? "Last name" : "Soyad",
    phone: loc === "en" ? "Phone" : "Telefon",
    email: loc === "en" ? "Email" : "E-posta",
    birthDate: loc === "en" ? "Birth date" : "Doğum Tarihi",
    consent:
      loc === "en"
        ? "I confirm that the information I entered is correct."
        : "Girdiğim bilgilerin doğru olduğunu onaylıyorum.",
    save: loc === "en" ? "Save Information" : "Bilgileri Kaydet",
    saveBusy: loc === "en" ? "Saving..." : "Kaydediliyor...",
    shop: loc === "en" ? "Go to shop" : "Mağazaya git",
    readonlyEmail:
      loc === "en"
        ? "Email address is taken from your account and cannot be edited here."
        : "E-posta adresi hesabından alınır, burada değiştirilemez.",
    requiredNote:
      loc === "en"
        ? "All fields are optional. If you enter data, it must be valid."
        : "Tüm alanlar isteğe bağlıdır. Bilgi girersen geçerli olmalıdır.",
    completeRequired:
      loc === "en" ? "Fix invalid fields." : "Hatalı alanları düzelt.",
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{text.title}</h2>
          <p className={styles.desc}>{text.desc}</p>
        </div>
      </div>

      {pMsg ? <div className={styles.alert}>{pMsg}</div> : null}

      <div className={styles.note}>{text.requiredNote}</div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>{text.firstName}</span>
          <input
            className={`${styles.input} ${errors.firstName ? styles.inputError : ""}`}
            value={profile.firstName || ""}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, firstName: e.target.value }))
            }
            placeholder={loc === "en" ? "Your name" : "Adınız"}
            disabled={!canWrite}
            autoComplete="given-name"
          />
          {errors.firstName ? <small className={styles.error}>{errors.firstName}</small> : null}
        </label>

        <label className={styles.field}>
          <span>{text.lastName}</span>
          <input
            className={`${styles.input} ${errors.lastName ? styles.inputError : ""}`}
            value={profile.lastName || ""}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, lastName: e.target.value }))
            }
            placeholder={loc === "en" ? "Your surname" : "Soyadınız"}
            disabled={!canWrite}
            autoComplete="family-name"
          />
          {errors.lastName ? <small className={styles.error}>{errors.lastName}</small> : null}
        </label>

        <label className={styles.field}>
          <span>{text.phone}</span>
          <input
            className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
            value={formatPhoneTR(profile.phone || "")}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                phone: onlyDigits(e.target.value).slice(0, 11),
              }))
            }
            inputMode="numeric"
            placeholder="05xx xxx xx xx"
            disabled={!canWrite}
            autoComplete="tel"
          />
          {errors.phone ? <small className={styles.error}>{errors.phone}</small> : null}
        </label>

        <label className={styles.field}>
          <span>{text.email}</span>
          <input
            className={`${styles.input} ${styles.inputReadonly}`}
            value={userEmail}
            readOnly
            disabled
            autoComplete="email"
          />
          <small className={styles.help}>{text.readonlyEmail}</small>
        </label>

        <label className={styles.field}>
          <span>{text.birthDate}</span>
          <input
            className={`${styles.input} ${errors.birthDate ? styles.inputError : ""}`}
            type="date"
            value={profile.birthDate || ""}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, birthDate: e.target.value }))
            }
            disabled={!canWrite}
            max={maxBirthDate}
          />
          {errors.birthDate ? <small className={styles.error}>{errors.birthDate}</small> : null}
        </label>
      </div>

      <div className={styles.checkboxWrap}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!profile.consentApproved}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                consentApproved: e.target.checked,
              }))
            }
            disabled={!canWrite}
          />
          <span>{text.consent}</span>
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          type="button"
          disabled={pBusy || !canWrite || hasErrors}
          onClick={onSave}
          title={!canWrite ? lockMsg : hasErrors ? text.completeRequired : ""}
        >
          {pBusy ? text.saveBusy : text.save}
        </button>

        <Link className={styles.secondaryBtn} href="/shop">
          {text.shop}
        </Link>
      </div>
    </section>
  );
}