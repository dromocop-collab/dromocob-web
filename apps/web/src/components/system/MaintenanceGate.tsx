"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getIdTokenResult, onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./MaintenanceGate.module.css";
import { Cormorant_Garamond, Manrope } from "next/font/google";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

type LT = { tr?: string; en?: string };

type MaintenanceDoc = {
  enabled?: boolean;
  title?: LT;
  subtitle?: LT;
  note?: LT;
  allowAdminPreview?: boolean;
  launchActive?: boolean;
  launchEndsAt?: any;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function pickLT(loc: Locale, v: any, tr: string, en: string) {
  const textTr = safeStr(v?.tr) || tr;
  const textEn = safeStr(v?.en) || en;
  return loc === "en" ? textEn : textTr;
}

function tsToMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    return 0;
  } catch {
    return 0;
  }
}

function isAdminFromClaims(claims: Record<string, any>) {
  const role = safeStr(claims?.role);
  const roles = Array.isArray(claims?.roles) ? claims.roles.map(String) : [];

  return (
    claims?.admin === true ||
    role === "admin" ||
    role === "sub_admin" ||
    roles.includes("admin") ||
    roles.includes("sub_admin")
  );
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [cfg, setCfg] = useState<MaintenanceDoc | null>(null);

  const [settingsReady, setSettingsReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [_user, setUser] = useState<User | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isAdmin, setIsAdmin] = useState(false);

  const [leftSec, setLeftSec] = useState(0);
  const [launchDone, setLaunchDone] = useState(false);

  useEffect(() => {
    setLoc(getLocale());

    const handler = (e: Event) => {
      const next = ((e as CustomEvent).detail || getLocale() || "tr") as Locale;
      setLoc(next === "en" ? "en" : "tr");
    };

    window.addEventListener("locale-changed", handler as EventListener);

    return () => {
      window.removeEventListener("locale-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!alive) return;

      setUser(u);
      setAuthReady(false);

      if (!u || u.isAnonymous) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        /*
          KRİTİK:
          true kullanma. true = force refresh.
          Localde/HMR'da securetoken endpointini spamler.
        */
        const token = await getIdTokenResult(u, false);
        const claims = (token?.claims || {}) as Record<string, any>;

        if (!alive) return;
        setIsAdmin(isAdminFromClaims(claims));
      } catch (err) {
        console.error("[MaintenanceGate] admin claim read error:", err);
        if (!alive) return;
        setIsAdmin(false);
      } finally {
        if (alive) setAuthReady(true);
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [auth]);

  useEffect(() => {
    const ref = doc(db, "site_options", "maintenance_settings");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setCfg(snap.exists() ? (snap.data() as MaintenanceDoc) : null);
        setSettingsReady(true);
      },
      (err) => {
        console.error("[MaintenanceGate] settings read error:", err);
        setCfg(null);
        setSettingsReady(true);
      }
    );

    return () => unsub();
  }, [db]);

  const endsAtMs = tsToMs(cfg?.launchEndsAt);
  const launchActive = cfg?.launchActive === true && endsAtMs > 0;
  const maintenanceEnabled = cfg?.enabled === true;

  useEffect(() => {
    if (!launchActive) {
      setLeftSec(0);
      return;
    }

    let finishedOnce = false;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      setLeftSec(left);

      if (left <= 0 && maintenanceEnabled && !finishedOnce) {
        finishedOnce = true;
        setLaunchDone(true);

        setDoc(
          doc(db, "site_options", "maintenance_settings"),
          {
            enabled: false,
            launchActive: false,
            launchFinishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((err) => console.error("[MaintenanceGate] finish launch error:", err));
      }
    };

    tick();

    /*
      250ms gereksiz agresifti.
      Sayaç saniye gösteriyor, 1000ms tertemiz.
    */
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [db, launchActive, endsAtMs, maintenanceEnabled]);

  useEffect(() => {
    if (!launchDone) return;

    const timer = window.setTimeout(() => {
      setLaunchDone(false);
    }, 5200);

    return () => window.clearTimeout(timer);
  }, [launchDone]);

  if (!settingsReady || !authReady) {
    return null;
  }

  const adminCanPass = isAdmin && cfg?.allowAdminPreview !== false;

  if (!maintenanceEnabled || adminCanPass) {
    return (
      <>
        {children}

        {launchDone ? (
          <div className={s.fireworksLayer} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ ["--i" as any]: i }} />
            ))}

            <div className={s.launchToast}>
              <b>{loc === "en" ? "Site is live!" : "Site yayında!"}</b>
              <small>
                {loc === "en"
                  ? "Welcome to the new experience."
                  : "Yeni deneyime hoş geldiniz."}
              </small>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const title = pickLT(
    loc,
    cfg?.title,
    "Dromocob yenileniyor",
    "6’ncı lifestyle is being updated"
  );

  const subtitle = pickLT(
    loc,
    cfg?.subtitle,
    "Size daha hızlı, güvenli ve premium bir alışveriş deneyimi hazırlıyoruz.",
    "We are preparing a faster, safer and more premium shopping experience."
  );

  const note = pickLT(
    loc,
    cfg?.note,
    "Kısa süre içinde tekrar yayındayız.",
    "We will be back shortly."
  );

  return (
    <main className={`${s.page} ${bodyFont.className}`}>
      <div className={s.bgGlow} />

      <section className={s.card}>
        <div className={s.jewelField} aria-hidden="true">
          <span className={`${s.jewelIcon} ${s.jewel1}`}>✦</span>
          <span className={`${s.jewelIcon} ${s.jewel2}`}>◇</span>
          <span className={`${s.jewelIcon} ${s.jewel3}`}>✧</span>
          <span className={`${s.jewelIcon} ${s.jewel4}`}>◆</span>
          <span className={`${s.jewelIcon} ${s.jewel5}`}>✺</span>
          <span className={`${s.jewelIcon} ${s.jewel6}`}>✦</span>
        </div>

        <div className={s.floatBadgeLeft} aria-hidden="true">
          <span>24K</span>
          <b>Premium</b>
        </div>

        <div className={s.floatBadgeRight} aria-hidden="true">
          <span>SSL</span>
          <b>Secure</b>
        </div>

        <div className={s.logoMark}>6</div>

        <div className={s.kicker}>
          {launchActive
            ? loc === "en"
              ? "LAUNCH COUNTDOWN"
              : "AÇILIŞ GERİ SAYIMI"
            : loc === "en"
              ? "MAINTENANCE MODE"
              : "BAKIM MODU"}
        </div>

        <h1 className={displayFont.className}>{title}</h1>
        <p>{subtitle}</p>

        {launchActive ? (
          <div className={s.countdownBox}>
            <span>{loc === "en" ? "Opening in" : "Açılışa kalan"}</span>
            <b>{leftSec}</b>
            <small>{loc === "en" ? "seconds" : "saniye"}</small>
          </div>
        ) : null}

        <div className={s.note}>{note}</div>

        {!launchActive ? (
          <div className={s.loader}>
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </section>
    </main>
  );
}