/**
 * Dromocob Control — Remote Command Endpoint
 *
 * Dromocob Control OS'tan gelen HMAC imzalı komutları doğrular
 * ve site durumunu günceller.
 *
 * Güvenlik katmanları:
 * 1. HMAC-SHA256 imza doğrulama (timingSafeEqual)
 * 2. Site ID eşleşme kontrolü
 * 3. Timestamp freshness (60 saniye pencere)
 * 4. Nonce ile replay attack önleme (Firestore transaction)
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getControlDb } from "@/lib/dromocob-control-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ControlStatus = "active" | "maintenance" | "disabled";

type ControlCommand = {
  siteId?: unknown;
  status?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  commandId?: unknown;
};

const ALLOWED_STATUSES = new Set<ControlStatus>([
  "active",
  "maintenance",
  "disabled",
]);

const COMMAND_MAX_AGE_MS = 60_000;
const NONCE_TTL_MS = 24 * 60 * 60 * 1000;

function safeSignatureEqual(received: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }

  try {
    const receivedBuffer = Buffer.from(received, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.DROMOCOB_CONTROL_SECRET;
  const expectedSiteId = process.env.DROMOCOB_CONTROL_SITE_ID;

  if (!secret || !expectedSiteId) {
    return NextResponse.json(
      { ok: false, error: "CONTROL_AGENT_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  // ── İmza doğrulama ──
  const rawBody = await request.text();
  const receivedSignature = request.headers.get("x-dromocob-signature") || "";
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!safeSignatureEqual(receivedSignature, expectedSignature)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SIGNATURE" },
      { status: 401 }
    );
  }

  // ── JSON parse ──
  let command: ControlCommand;

  try {
    command = JSON.parse(rawBody) as ControlCommand;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400 }
    );
  }

  // ── Site ID kontrolü ──
  if (command.siteId !== expectedSiteId) {
    return NextResponse.json(
      { ok: false, error: "SITE_ID_MISMATCH" },
      { status: 403 }
    );
  }

  // ── Status doğrulama ──
  if (
    typeof command.status !== "string" ||
    !ALLOWED_STATUSES.has(command.status as ControlStatus)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  // ── Nonce & commandId kontrolü ──
  if (
    typeof command.nonce !== "string" ||
    !command.nonce ||
    typeof command.commandId !== "string" ||
    !command.commandId
  ) {
    return NextResponse.json(
      { ok: false, error: "COMMAND_METADATA_MISSING" },
      { status: 400 }
    );
  }

  // ── Timestamp freshness ──
  const timestamp = Number(command.timestamp);

  if (!Number.isFinite(timestamp)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_TIMESTAMP" },
      { status: 400 }
    );
  }

  if (Math.abs(Date.now() - timestamp) > COMMAND_MAX_AGE_MS) {
    return NextResponse.json(
      { ok: false, error: "COMMAND_EXPIRED" },
      { status: 400 }
    );
  }

  // ── Firestore transaction (nonce + state) ──
  try {
    const db = getControlDb();
    const nonceReference = db.collection("system_control_nonces").doc(command.nonce);
    const stateReference = db.collection("system_control").doc("current");

    await db.runTransaction(async (transaction) => {
      const nonceSnapshot = await transaction.get(nonceReference);

      if (nonceSnapshot.exists) {
        throw new Error("REPLAY_DETECTED");
      }

      const now = new Date();

      transaction.set(nonceReference, {
        nonce: command.nonce,
        commandId: command.commandId,
        siteId: expectedSiteId,
        receivedAt: now,
        expireAt: new Date(Date.now() + NONCE_TTL_MS),
      });

      transaction.set(
        stateReference,
        {
          status: command.status,
          source: "dromocob-control",
          siteId: expectedSiteId,
          commandId: command.commandId,
          updatedAt: now,
        },
        { merge: true }
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REPLAY_DETECTED") {
      return NextResponse.json(
        { ok: false, error: "REPLAY_DETECTED" },
        { status: 409 }
      );
    }

    console.error("[DROMOCOB CONTROL] Command failed:", error);

    return NextResponse.json(
      { ok: false, error: "STATE_WRITE_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      siteId: expectedSiteId,
      status: command.status,
      commandId: command.commandId,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
