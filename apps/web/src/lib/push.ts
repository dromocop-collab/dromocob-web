"use client";

import { deleteToken, getToken, isSupported, onMessage } from "firebase/messaging";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseMessagingSafe,
} from "@/lib/firebase.client";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

function isLocalhostHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function assertSecureContextForPush() {
  if (typeof window === "undefined") return;

  const isSecure =
    window.location.protocol === "https:" ||
    isLocalhostHost(window.location.hostname);

  if (!isSecure) {
    throw new Error("Push bildirimleri için HTTPS gerekir.");
  }
}

async function ensureActiveServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Bu tarayıcı service worker desteklemiyor.");
  }

  await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });

  await navigator.serviceWorker.ready;

  const readyRegistration = await navigator.serviceWorker.ready;

  if (!readyRegistration.active) {
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  const finalRegistration = await navigator.serviceWorker.ready;

  if (!finalRegistration.active) {
    throw new Error("Service Worker aktif hale gelmedi.");
  }

  return finalRegistration;
}

export async function getCurrentPushState(): Promise<{
  supported: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
}> {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return {
      supported: false,
      enabled: false,
      permission: "unsupported",
    };
  }

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    return {
      supported: true,
      enabled: false,
      permission: Notification.permission,
    };
  }

  const snap = await getDocs(
    query(
      collection(db, "users", user.uid, "push_tokens"),
      where("platform", "==", "web"),
      where("isActive", "==", true)
    )
  );

  return {
    supported: true,
    enabled: !snap.empty && Notification.permission === "granted",
    permission: Notification.permission,
  };
}

export async function requestPushPermissionAndSaveToken() {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    throw new Error("Bu tarayıcı push bildirim desteklemiyor.");
  }

  assertSecureContextForPush();

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const messaging = await getFirebaseMessagingSafe();

  if (!messaging) {
    throw new Error("Bu tarayıcıda push messaging kullanılamıyor.");
  }

  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Push bildirimi için giriş yapmalısın.");
  }

  if (!VAPID_KEY) {
    throw new Error("Web push VAPID key eksik.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Bildirim izni verilmedi.");
  }

  const serviceWorkerRegistration = await ensureActiveServiceWorker();

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (!token) {
    throw new Error("Push token alınamadı.");
  }
console.log("push current uid:", user.uid);
console.log("push token path:", `users/${user.uid}/push_tokens/${token}`);
  await setDoc(
    doc(db, "users", user.uid, "push_tokens", token),
    {
      token,
      platform: "web",
      isActive: true,
      permission,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}

export async function disableCurrentPushToken() {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    throw new Error("Bu tarayıcı push bildirim desteklemiyor.");
  }

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const messaging = await getFirebaseMessagingSafe();

  if (!messaging) {
    throw new Error("Bu tarayıcıda push messaging kullanılamıyor.");
  }

  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("Push bildirimi için giriş yapmalısın.");
  }

  const serviceWorkerRegistration = await ensureActiveServiceWorker();

  const currentToken = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (currentToken) {
    await setDoc(
      doc(db, "users", user.uid, "push_tokens", currentToken),
      {
        token: currentToken,
        platform: "web",
        isActive: false,
        permission: Notification.permission,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await deleteToken(messaging).catch(() => false);
  } else {
    const existing = await getDocs(
      query(
        collection(db, "users", user.uid, "push_tokens"),
        where("platform", "==", "web"),
        where("isActive", "==", true)
      )
    );

    await Promise.all(
      existing.docs.map((d) =>
        updateDoc(d.ref, {
          isActive: false,
          updatedAt: serverTimestamp(),
        })
      )
    );
  }

  return true;
}

export async function bindForegroundPushListener(
  onPayload: (payload: unknown) => void
) {
  const supported = await isSupported().catch(() => false);
  if (!supported) return () => {};

  const messaging = await getFirebaseMessagingSafe();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    onPayload(payload);
  });
}