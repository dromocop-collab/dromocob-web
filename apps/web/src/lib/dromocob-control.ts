/**
 * Dromocob Control — State Reader
 *
 * Firestore'daki system_control/current document'ından
 * merkezi kontrol durumunu okur.
 *
 * Hata durumunda "active" döner — site kapalı kalmaz.
 */
import "server-only";

import { getControlDb } from "@/lib/dromocob-control-admin";

export type ControlStatus = "active" | "maintenance" | "disabled";

export type ControlState = {
  status: ControlStatus;
  commandId: string | null;
  source: string | null;
  updatedAt: unknown;
};

const DEFAULT_CONTROL_STATE: ControlState = {
  status: "active",
  commandId: null,
  source: null,
  updatedAt: null,
};

const ALLOWED_STATUSES = new Set<ControlStatus>([
  "active",
  "maintenance",
  "disabled",
]);

export async function getControlState(): Promise<ControlState> {
  try {
    const db = getControlDb();

    const snapshot = await db
      .collection("system_control")
      .doc("current")
      .get();

    if (!snapshot.exists) {
      return { ...DEFAULT_CONTROL_STATE };
    }

    const data = snapshot.data() || {};
    const status = data.status as ControlStatus | undefined;

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return { ...DEFAULT_CONTROL_STATE };
    }

    return {
      status,
      commandId:
        typeof data.commandId === "string" ? data.commandId : null,
      source:
        typeof data.source === "string" ? data.source : null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch (error) {
    console.error("[DROMOCOB CONTROL] State read failed:", error);

    // Kontrol servisi hata verirse site aktif kalır.
    return { ...DEFAULT_CONTROL_STATE };
  }
}

export async function getControlStatus(): Promise<ControlStatus> {
  const state = await getControlState();
  return state.status;
}
