import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) admin.initializeApp();

type SendResetResp = { ok: true };
type ConfirmResetResp = { ok: true };

function nowMs() {
  return Date.now();
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function passwordResetDocId(email: string) {
  return sha256(`pwreset:${normalizeEmail(email)}`);
}

async function findUserByEmailSafe(email: string) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch {
    return null;
  }
}

export const requestPasswordResetCode = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request): Promise<SendResetResp> => {
    const email = normalizeEmail((request.data as any)?.email);

    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Geçerli bir e-posta gir.");
    }

    const user = await findUserByEmailSafe(email);

    // Kullanıcı var mı yok mu dışarı sızdırmıyoruz
    const ref = admin
      .firestore()
      .doc(`password_resets/${passwordResetDocId(email)}`);

    const snap = await ref.get();
    const data = snap.exists ? snap.data() || {} : {};

    const lastSentAt = Number(data.lastSentAt || 0);

    if (lastSentAt && nowMs() - lastSentAt < 45_000) {
      throw new HttpsError(
        "resource-exhausted",
        "Çok hızlı tekrar denendi. 45 saniye bekle."
      );
    }

    // Kullanıcı yoksa yine başarılı gibi dön
    if (!user) {
      logger.info("password reset requested for non-existing email", { email });
      return { ok: true };
    }

    const code = genCode();
    const codeHash = sha256(code);
    const expiresAt = nowMs() + 10 * 60 * 1000; // 10 dk

    await ref.set(
      {
        uid: user.uid,
        email,
        codeHash,
        expiresAt,
        lastSentAt: nowMs(),
        attempts: 0,
        used: false,
        createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await admin.firestore().collection("mail").add({
      to: email,
      from: "Dromocob <no-reply@dromocob.com>",
      message: {
        subject: "Dromocob Şifre Sıfırlama Kodunuz",
        html: `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f8f5ef;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eee4d2;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
    
    <div style="background:linear-gradient(180deg,#fffdf9 0%,#fff8ef 100%);padding:28px 24px 20px;text-align:center;border-bottom:1px solid #f1e8da;">
      <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#f5ead7;color:#b98c3c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
        Dromocob
      </div>
      <h2 style="margin:16px 0 8px;font-size:28px;line-height:1.2;color:#1d2433;font-weight:800;">
        Şifre Sıfırlama Kodu
      </h2>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#6b7280;">
        Şifrenizi yenilemek için aşağıdaki tek kullanımlık kodu girin.
      </p>
    </div>

    <div style="padding:28px 24px 18px;">
      <p style="margin:0 0 16px;font-size:16px;color:#374151;">
        Merhaba,
      </p>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#4b5563;">
        Dromocob hesabınız için şifre sıfırlama işlemi başlatıldı.
        Aşağıdaki kodu ilgili alana girerek yeni şifrenizi belirleyebilirsiniz:
      </p>

      <div style="text-align:center;margin:0 0 26px;">
        <div style="display:inline-block;min-width:220px;padding:18px 24px;border-radius:16px;background:#fff8ef;border:1px solid #ead7b5;">
          <div style="font-size:12px;line-height:1;margin-bottom:10px;color:#b98c3c;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
            Şifre Sıfırlama Kodu
          </div>
          <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#111827;">
            ${code}
          </div>
        </div>
      </div>

      <div style="margin:0 0 22px;padding:16px 18px;background:#fcfaf6;border:1px solid #efe6d8;border-radius:14px;">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
          Bu kod 10 dakika geçerlidir. Güvenliğiniz için bu kodu kimseyle paylaşmayın.
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6b7280;">
        Eğer bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayabilirsiniz.
      </p>
    </div>

    <div style="padding:18px 24px 24px;text-align:center;border-top:1px solid #f1e8da;background:#fffdfa;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1f2937;">
        Dromocob
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
      </p>
    </div>

  </div>
</div>
`,
      },
    });

    logger.info("password reset code sent", { email, uid: user.uid });

    return { ok: true };
  }
);

export const confirmPasswordResetCode = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request): Promise<ConfirmResetResp> => {
    const email = normalizeEmail((request.data as any)?.email);
    const code = String((request.data as any)?.code || "").replace(/\D/g, "");
    const newPassword = String((request.data as any)?.newPassword || "");

    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Geçerli bir e-posta gir.");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Kod 6 haneli olmalı.");
    }

    if (newPassword.trim().length < 6) {
      throw new HttpsError("invalid-argument", "Yeni şifre en az 6 karakter olmalı.");
    }

    const ref = admin
      .firestore()
      .doc(`password_resets/${passwordResetDocId(email)}`);

    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Kod bulunamadı. Önce yeni kod iste.");
    }

    const data = snap.data() || {};
    const expiresAt = Number(data.expiresAt || 0);
    const attempts = Number(data.attempts || 0);
    const used = data.used === true;
    const storedHash = String(data.codeHash || "");
    const incomingHash = sha256(code);

    if (used) {
      throw new HttpsError("permission-denied", "Bu kod zaten kullanılmış. Yeni kod iste.");
    }

    if (!expiresAt || nowMs() > expiresAt) {
      throw new HttpsError("deadline-exceeded", "Kod süresi dolmuş. Yeni kod iste.");
    }

    if (attempts >= 7) {
      throw new HttpsError("permission-denied", "Çok fazla deneme yapıldı. Yeni kod iste.");
    }

    if (!storedHash || incomingHash !== storedHash) {
      await ref.set(
        {
          attempts: attempts + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new HttpsError("permission-denied", "Kod yanlış.");
    }

    const uid = String(data.uid || "");
    if (!uid) {
      throw new HttpsError("failed-precondition", "Kullanıcı bilgisi eksik.");
    }

    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    await ref.set(
      {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        codeHash: admin.firestore.FieldValue.delete(),
        expiresAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("password reset success", { email, uid });

    return { ok: true };
  }
);