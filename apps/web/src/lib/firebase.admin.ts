import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_ADMIN_KEY_JSON || "";
  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed.private_key && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }

    return parsed;
  } catch {
    throw new Error("FIREBASE_ADMIN_KEY_JSON geçersiz JSON.");
  }
}

export function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "dromocob-demo";

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "";
  const serviceAccount = parseServiceAccountFromEnv();

  // Local emulator
  if (emulatorHost) {
    return initializeApp({ projectId });
  }

  // Prod / gerçek servis hesabı
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  }

  throw new Error(
    "Firebase Admin başlatılamadı. Local için FIRESTORE_EMULATOR_HOST, prod için FIREBASE_ADMIN_KEY_JSON gerekli."
  );
}

export function adminDb() {
  initAdmin();
  return getFirestore();
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}