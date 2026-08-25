"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";

/**
 * Generates a stable browser-tab id so each tab is one visitor row.
 */
function getTabId(): string {
  if (typeof window === "undefined") return "";

  let id = sessionStorage.getItem("nci_tab_id");
  if (!id) {
    id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("nci_tab_id", id);
  }
  return id;
}


const HEARTBEAT_MS = 15_000;

function clientInfo() {
  const ua = navigator.userAgent;
  const deviceType = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Other";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  return { deviceType, browser, os };
}

export function usePresence() {
  const pathname = usePathname();
  const userRef = useRef<User | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabIdRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    tabIdRef.current = getTabId();

    async function heartbeat(online = document.visibilityState === "visible") {
      const tabId = tabIdRef.current;
      if (!tabId) return;

      const u = userRef.current;
      const isReal = !!u && !u.isAnonymous;
      const page = window.location.pathname;

      try {
        const ref = doc(db, "site_visitors", tabId);
        await setDoc(
          ref,
          {
            uid: isReal ? u!.uid : null,
            email: isReal ? u!.email || null : null,
            displayName: isReal ? u!.displayName || null : null,
            isAnonymous: u?.isAnonymous ?? true,
            page,
            pageTitle: document.title.slice(0, 140),
            referrer: document.referrer || null,
            userAgent: navigator.userAgent.slice(0, 200),
            locale: document.documentElement.lang || "tr",
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            online,
            ...clientInfo(),
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.debug("[presence] heartbeat error:", e);
      }
    }

    // Auth listener
    const unsubAuth = onIdTokenChanged(auth, (u) => {
      userRef.current = u;
      heartbeat();
    });

    // Initial heartbeat
    heartbeat();

    // Periodic heartbeat
    intervalRef.current = setInterval(heartbeat, HEARTBEAT_MS);

    function onVisibility() {
      heartbeat(document.visibilityState === "visible");
    }

    function onFocus() { heartbeat(true); }

    // Cleanup on tab close
    function cleanup() {
      const tabId = tabIdRef.current;
      if (!tabId) return;

      try {
        const ref = doc(db, "site_visitors", tabId);
        deleteDoc(ref).catch(() => {});
      } catch {
        // noop
      }
    }

    window.addEventListener("beforeunload", cleanup);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      unsubAuth();
      window.removeEventListener("beforeunload", cleanup);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      cleanup();
    };
  }, [pathname]);
}
