"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

type WebAppConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readConfig(): WebAppConfig {
  const rawJson = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG || "";
  if (rawJson) {
    const parsed = safeJsonParse<WebAppConfig>(rawJson);
    if (parsed?.apiKey && parsed?.projectId) return parsed;
    throw new Error("NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG var ama JSON geçersiz.");
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

  if (apiKey && projectId) {
    return {
      apiKey,
      projectId,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
    };
  }

  throw new Error("Firebase client config missing. NEXT_PUBLIC env’leri kontrol et.");
}

declare global {
  // eslint-disable-next-line no-var
  var __dromocob_fb_app: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var __dromocob_fb_auth: Auth | undefined;
  // eslint-disable-next-line no-var
  var __dromocob_fb_db: Firestore | undefined;
  // eslint-disable-next-line no-var
  var __dromocob_fb_storage: FirebaseStorage | undefined;
  // eslint-disable-next-line no-var
  var __dromocob_fb_messaging: Messaging | null | undefined;
}

export function getFirebaseApp(): FirebaseApp {
  if (globalThis.__dromocob_fb_app) return globalThis.__dromocob_fb_app;

  const cfg = readConfig();
  const app = getApps().length ? getApp() : initializeApp(cfg);

  globalThis.__dromocob_fb_app = app;
  return app;
}

export function getFirebaseAuth(): Auth {
  if (globalThis.__dromocob_fb_auth) return globalThis.__dromocob_fb_auth;

  const auth = getAuth(getFirebaseApp());
  globalThis.__dromocob_fb_auth = auth;
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (globalThis.__dromocob_fb_db) return globalThis.__dromocob_fb_db;

  const app = getFirebaseApp();

  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    // experimentalForceLongPolling: true,
  });

  globalThis.__dromocob_fb_db = db;
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (globalThis.__dromocob_fb_storage) return globalThis.__dromocob_fb_storage;

  const storage = getStorage(getFirebaseApp());
  globalThis.__dromocob_fb_storage = storage;
  return storage;
}

export async function getFirebaseMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;

  if (globalThis.__dromocob_fb_messaging !== undefined) {
    return globalThis.__dromocob_fb_messaging;
  }

  const cfg = readConfig();

  if (!cfg.messagingSenderId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID eksik.");
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    globalThis.__dromocob_fb_messaging = null;
    return null;
  }

  const messaging = getMessaging(getFirebaseApp());
  globalThis.__dromocob_fb_messaging = messaging;
  return messaging;
}
