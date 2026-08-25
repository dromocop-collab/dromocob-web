"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import WheelPopup from "@/components/wheel/WheelPopup";
import WheelSpinModal from "@/components/wheel/WheelSpinModal";
import type { WheelCampaignDoc } from "@/types/wheel";
import type { WheelGuestFormValue } from "@/components/wheel/WheelGuestForm";
import {
  getActiveWheelCampaign,
  hasDismissedWheelCampaign,
  hasSpunWheelCampaign,
  markDismissedWheelCampaign,
  markSeenWheelCampaign,
} from "@/lib/wheel";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import styles from "./WheelBoot.module.css";

const EXCLUDED_PREFIXES = ["/admin", "/api", "/login", "/register"];

function shouldSkipWheel(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function unlockBodyScroll() {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

export default function WheelBoot() {
  const pathname = usePathname();

  const [campaign, setCampaign] = useState<WheelCampaignDoc | null>(null);
  const [openIntro, setOpenIntro] = useState(false);
  const [openSpin, setOpenSpin] = useState(false);
  const [showLauncher, setShowLauncher] = useState(false);
  const [ready, setReady] = useState(false);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  const [guestDataFromIntro, setGuestDataFromIntro] =
    useState<WheelGuestFormValue | null>(null);

  const [wheelRefreshKey, setWheelRefreshKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const uid = authUser && !authUser.isAnonymous ? authUser.uid : null;

  const hasSpun = !isMainAdmin && campaign?.id
    ? hasSpunWheelCampaign(campaign.id, uid)
    : false;

  const canShowWheelButton =
    authReady &&
    ready &&
    Boolean(campaign?.id) &&
    showLauncher &&
    !openIntro &&
    !openSpin &&
    !hasSpun;

function clearIntroTimer() {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

 function closeAllWheelUi() {
  setOpenIntro(false);
  setOpenSpin(false);
  setGuestDataFromIntro(null);
  unlockBodyScroll();
}

  useEffect(() => {
    mountedRef.current = true;

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
  if (!mountedRef.current) return;
  setAuthUser(user ?? null);
  const realUser = user && !user.isAnonymous ? user : null;

  if (!realUser) {
    setIsMainAdmin(false);
    setAuthReady(true);
    return;
  }

  void realUser.getIdTokenResult().then((token) => {
    if (!mountedRef.current) return;
    const roles = Array.isArray(token.claims.roles) ? token.claims.roles : [];
    setIsMainAdmin(token.claims.admin === true || roles.includes("admin"));
  }).catch(() => {
    if (mountedRef.current) setIsMainAdmin(false);
  }).finally(() => {
    if (mountedRef.current) setAuthReady(true);
  });
});

return () => {
  mountedRef.current = false;
  unsub();
  clearIntroTimer();
  unlockBodyScroll();
};
  }, []);

  useEffect(() => {
    const realUser = authUser && !authUser.isAnonymous ? authUser : null;

    if (!realUser) {
      setMemberDisplayName("");
      return;
    }

    let cancelled = false;
    setMemberDisplayName(realUser.displayName?.trim() || "Üye kullanıcı");

    void getDoc(doc(getFirebaseDb(), "users", realUser.uid))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return;
        const profile = snapshot.data() as Record<string, unknown>;
        const firstName = String(profile.firstName || "").trim();
        const lastName = String(profile.lastName || "").trim();
        const fullName = String(profile.fullName || profile.name || "").trim();
        const resolvedName =
          `${firstName} ${lastName}`.trim() ||
          fullName ||
          realUser.displayName?.trim() ||
          "Üye kullanıcı";
        setMemberDisplayName(resolvedName);
      })
      .catch((error) => console.warn("[WheelBoot] profile name load error:", error));

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    const refreshCampaign = () => {
      if (document.visibilityState === "visible") {
        setWheelRefreshKey((value) => value + 1);
      }
    };

    window.addEventListener("focus", refreshCampaign);
    document.addEventListener("visibilitychange", refreshCampaign);

    return () => {
      window.removeEventListener("focus", refreshCampaign);
      document.removeEventListener("visibilitychange", refreshCampaign);
    };
  }, []);

useEffect(() => {
  if (!authReady) {
    return;
  }

  clearIntroTimer();

  if (shouldSkipWheel(pathname)) {
    setCampaign(null);
   closeAllWheelUi();
    setReady(true);
    return;
  }

  let cancelled = false;

  async function loadCampaign() {
    try {
      setReady(false);

      const active = await getActiveWheelCampaign();

      if (cancelled || !mountedRef.current) return;

      setCampaign(active ?? null);
      setReady(true);

      if (!active?.id) {
        setShowLauncher(false);
        closeAllWheelUi();
        return;
      }

      const currentUid = uid;
      const dismissed = hasDismissedWheelCampaign(active.id, currentUid);
      const spun = !isMainAdmin && hasSpunWheelCampaign(active.id, currentUid);

  

      if (spun) {
        setShowLauncher(false);
        if (openSpin) {
        
          return;
        }

        closeAllWheelUi();
        return;
      }

      if (dismissed) {
        setShowLauncher(true);
        setOpenIntro(false);
        setOpenSpin(false);
        setGuestDataFromIntro(null);
        unlockBodyScroll();
        return;
      }

      setOpenIntro(false);
      setOpenSpin(false);
      setShowLauncher(false);
      setGuestDataFromIntro(null);

      timerRef.current = window.setTimeout(() => {
        if (cancelled || !mountedRef.current) return;

        const latestSpun = !isMainAdmin && hasSpunWheelCampaign(active.id, currentUid);

        if (latestSpun) {
          closeAllWheelUi();
          return;
        }

        markSeenWheelCampaign(active.id, currentUid);
        setShowLauncher(false);
        setOpenIntro(true);
      }, 1200);
    } catch (error) {
      console.error("[WheelBoot] load error:", error);

      if (cancelled || !mountedRef.current) return;

      setCampaign(null);
      closeAllWheelUi();
      setReady(true);
    }
  }

  void loadCampaign();

  return () => {
    cancelled = true;
    clearIntroTimer();
  };
}, [pathname, authReady, uid, isMainAdmin, wheelRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCloseIntro() {
    

    if (campaign?.id) {
      markDismissedWheelCampaign(campaign.id, uid);
    }

    setOpenIntro(false);
    setShowLauncher(true);
    setGuestDataFromIntro(null);
    unlockBodyScroll();
  }

function handleStartSpin(guestData?: WheelGuestFormValue | null) {


  if (!campaign?.id) return;

  const spun = !isMainAdmin && hasSpunWheelCampaign(campaign.id, uid);

if (spun) {
  closeAllWheelUi();
  setWheelRefreshKey((v) => v + 1);
  return;
}

  setGuestDataFromIntro(guestData ?? null);
  markDismissedWheelCampaign(campaign.id, uid);
  setShowLauncher(false);
  setOpenIntro(false);
  setOpenSpin(true);

}

function handleCloseSpin() {
  const spun = !isMainAdmin && campaign?.id
    ? hasSpunWheelCampaign(campaign.id, uid)
    : false;
  closeAllWheelUi();
  setShowLauncher(!spun);
  setWheelRefreshKey((v) => v + 1);
}

  function handleOpenAgain() {
   

    if (!campaign?.id) return;

    const spun = !isMainAdmin && hasSpunWheelCampaign(campaign.id, uid);

  

    if (spun) {
      closeAllWheelUi();
      setWheelRefreshKey((v) => v + 1);
      return;
    }

    setGuestDataFromIntro(null);
    setShowLauncher(false);
    setOpenIntro(true);
  }

  if (!authReady || !ready || !campaign?.id) return null;

  return (
    <>
      <WheelPopup
        open={openIntro}
        campaign={campaign}
        memberDisplayName={memberDisplayName}
        onClose={handleCloseIntro}
        onStart={handleStartSpin}
      />

      <WheelSpinModal
        open={openSpin}
        campaign={campaign}
        authUser={authUser}
        memberDisplayName={memberDisplayName}
        unlimitedSpins={isMainAdmin}
        guestDataFromIntro={guestDataFromIntro}
        onClose={handleCloseSpin}
      />

      {canShowWheelButton ? (
        <button
          type="button"
          onClick={handleOpenAgain}
          aria-label="Şans çarkını aç"
          title="Şans çarkını aç"
          className={styles.launcher}
        >
          <span className={styles.launcherGlow} aria-hidden="true" />
          <svg className={styles.launcherIcon} viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="25" />
            <path d="M32 7v50M7 32h50M14.3 14.3l35.4 35.4M49.7 14.3 14.3 49.7" />
            <circle cx="32" cy="32" r="6" />
          </svg>
          <span className={styles.launcherBadge} aria-hidden="true">✦</span>
          <span className={styles.srOnly}>Şans Çarkı</span>
        </button>
      ) : null}
    </>
  );
}
