/**
 * Dromocob Control Agent — Firebase Admin (Named App)
 *
 * Mevcut initAdmin() ile çakışmamak için ayrı bir named app kullanılır.
 * Bu dosya yalnızca Dromocob control durumunu okumak ve komut almak
 * için kullanılan Firestore bağlantısını sağlar.
 */
import "server-only";

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

const CONTROL_APP_NAME = "dromocob-control-agent";

/**
 * Service account JSON'ını env'den parse eder.
 * Mevcut firebase.admin.ts ile aynı pattern.
 */
function parseServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_KEY_JSON || "";
  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed.private_key && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }

    return parsed;
  } catch {
    console.error("[DROMOCOB CONTROL] FIREBASE_ADMIN_KEY_JSON geçersiz JSON.");
    return null;
  }
}

function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "dromocob-demo";

  return projectId;
}

function getControlAdminApp(): App {
  const exists = getApps().some((app) => app.name === CONTROL_APP_NAME);

  if (exists) {
    return getApp(CONTROL_APP_NAME);
  }

  const serviceAccount = parseServiceAccount();
  const projectId = getProjectId();

  if (serviceAccount) {
    return initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      },
      CONTROL_APP_NAME
    );
  }

  // Emulator veya Cloud Run ortamında applicationDefault kullanılabilir
  return initializeApp(
    {
      credential: applicationDefault(),
      projectId,
    },
    CONTROL_APP_NAME
  );
}

export function getControlDb(): Firestore {
  return getFirestore(getControlAdminApp());
}
