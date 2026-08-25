import "server-only";

import { createHash, randomInt } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase.admin";

export type AuthCodePurpose = "verify-email" | "reset-password";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export class AuthCodeError extends Error {
  constructor(public readonly code: "cooldown" | "invalid" | "expired" | "attempts" | "missing") {
    super(code);
  }
}

export function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 180);
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function codeHash(purpose: AuthCodePurpose, key: string, code: string) {
  return digest(`dromocob:${purpose}:${key}:${code}`);
}

export function authCodeKey(purpose: AuthCodePurpose, identity: string) {
  return `${purpose === "verify-email" ? "verify" : "reset"}_${digest(identity).slice(0, 48)}`;
}

export async function issueAuthCode(input: {
  purpose: AuthCodePurpose;
  identity: string;
  email: string;
  uid: string;
  ip: string;
}) {
  const db = adminDb();
  const key = authCodeKey(input.purpose, input.identity);
  const ref = db.collection("auth_codes").doc(key);
  const now = Date.now();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const availableAt = snapshot.data()?.resendAvailableAt?.toMillis?.() || 0;
    if (availableAt > now) throw new AuthCodeError("cooldown");

    transaction.set(ref, {
      purpose: input.purpose,
      uid: input.uid,
      email: input.email,
      codeHash: codeHash(input.purpose, key, code),
      attempts: 0,
      used: false,
      expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS),
      resendAvailableAt: Timestamp.fromMillis(now + RESEND_COOLDOWN_MS),
      requestedAt: FieldValue.serverTimestamp(),
      ipHash: digest(`${input.ip}:dromocob-auth`).slice(0, 32),
    });
  });

  return { code, key, expiresInMinutes: CODE_TTL_MS / 60_000 };
}

export async function consumeAuthCode(input: {
  purpose: AuthCodePurpose;
  identity: string;
  code: string;
}) {
  const db = adminDb();
  const key = authCodeKey(input.purpose, input.identity);
  const ref = db.collection("auth_codes").doc(key);
  const now = Date.now();

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { ok: false as const, reason: "missing" as const };

    const data = snapshot.data() || {};
    if (data.used === true) return { ok: false as const, reason: "missing" as const };
    if ((data.expiresAt?.toMillis?.() || 0) < now) {
      transaction.update(ref, { used: true, usedAt: FieldValue.serverTimestamp() });
      return { ok: false as const, reason: "expired" as const };
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "attempts" as const };

    const matches = data.codeHash === codeHash(input.purpose, key, input.code);
    if (!matches) {
      transaction.update(ref, { attempts: attempts + 1, lastAttemptAt: FieldValue.serverTimestamp() });
      return { ok: false as const, reason: attempts + 1 >= MAX_ATTEMPTS ? "attempts" as const : "invalid" as const };
    }

    transaction.update(ref, { used: true, usedAt: FieldValue.serverTimestamp() });
    return { ok: true as const, uid: String(data.uid || ""), email: String(data.email || "") };
  });

  if (!result.ok) throw new AuthCodeError(result.reason);
  return result;
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export function authCodeMail(input: {
  email: string;
  code: string;
  purpose: AuthCodePurpose;
  expiresInMinutes: number;
}) {
  const reset = input.purpose === "reset-password";
  const eyebrow = reset ? "HESAP KURTARMA" : "GÜVENLİ HESAP AKTİVASYONU";
  const title = reset ? "Şifreni güvenle yenile" : "Dromocob hesabını doğrula";
  const intro = reset
    ? "Şifreni yenilemek için aşağıdaki tek kullanımlık kodu kullan."
    : "Hesabını etkinleştirmek ve güvenli müşteri alanına erişmek için kodunu gir.";
  const subject = reset ? `Dromocob şifre yenileme kodun: ${input.code}` : `Dromocob doğrulama kodun: ${input.code}`;
  const safeCode = esc(input.code);

  return {
    to: [input.email],
    message: {
      subject,
      text: `${title}\n\nDoğrulama kodun: ${input.code}\nKod ${input.expiresInMinutes} dakika geçerlidir. Bu işlemi sen başlatmadıysan mesajı yok sayabilirsin.`,
      html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#07101f;font-family:Inter,Arial,sans-serif;color:#eaf1ff">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07101f;padding:32px 14px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #243552;border-radius:28px;overflow:hidden;background:#0b1629;box-shadow:0 30px 80px rgba(0,0,0,.35)">
<tr><td style="height:8px;background:linear-gradient(90deg,#6d5dfc,#2dd4bf,#65a7ff)"></td></tr>
<tr><td style="padding:38px 42px 18px">
<table role="presentation"><tr><td style="width:48px;height:48px;border-radius:15px;background:linear-gradient(145deg,#7868ff,#3b82f6);text-align:center;font-size:23px;font-weight:900;color:#fff">D</td><td style="padding-left:14px"><div style="font-size:18px;font-weight:900;letter-spacing:4px;color:#fff">DROMOCOB</div><div style="font-size:10px;letter-spacing:2.5px;color:#8ea3c4;margin-top:4px">DIGITAL EXPERIENCE STUDIO</div></td></tr></table>
</td></tr>
<tr><td style="padding:22px 42px 12px"><div style="font-size:11px;font-weight:800;letter-spacing:2.4px;color:#61dcc7">${eyebrow}</div><h1 style="margin:13px 0 10px;font-size:32px;line-height:1.15;color:#fff">${title}</h1><p style="margin:0;color:#a9bad2;font-size:16px;line-height:1.7">${intro}</p></td></tr>
<tr><td style="padding:24px 42px"><div style="border:1px solid #334765;border-radius:22px;background:linear-gradient(135deg,#101f38,#0c1830);padding:27px;text-align:center"><div style="font-size:11px;letter-spacing:2px;color:#8ea3c4;margin-bottom:12px">TEK KULLANIMLIK KOD</div><div style="font-family:Arial,sans-serif;font-size:42px;font-weight:900;letter-spacing:12px;color:#fff">${safeCode}</div><div style="margin-top:14px;font-size:12px;color:#61dcc7">${input.expiresInMinutes} dakika boyunca geçerli</div></div></td></tr>
<tr><td style="padding:0 42px 38px"><div style="border-top:1px solid #22324b;padding-top:22px;color:#7f93b1;font-size:12px;line-height:1.7">Bu kod yalnızca bir kez kullanılabilir. Dromocob ekibi hiçbir zaman senden bu kodu telefonla veya mesajla istemez. Bu işlemi sen başlatmadıysan e-postayı güvenle yok sayabilirsin.</div></td></tr>
</table>
</td></tr></table></body></html>`,
    },
    createdAt: FieldValue.serverTimestamp(),
    category: `auth-${input.purpose}`,
  };
}

export async function queueAuthMail(input: Parameters<typeof authCodeMail>[0]) {
  await adminDb().collection("mail").add(authCodeMail(input));
}
