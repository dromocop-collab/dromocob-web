import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

type SendResp = { ok: true };
type VerifyResp = { ok: true };

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
const nowMs = () => Date.now();

export const sendVerifyCode = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request): Promise<SendResp> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Giriş gerekli.");

    const user = await admin.auth().getUser(uid);
    const email = user.email;
    if (!email) throw new HttpsError("failed-precondition", "E-posta bulunamadı.");

    const ref = admin.firestore().doc(`email_verifications/${uid}`);
    const snap = await ref.get();

    const lastSentAt = snap.exists ? Number(snap.data()?.lastSentAt || 0) : 0;
    if (lastSentAt && nowMs() - lastSentAt < 45_000) {
      throw new HttpsError("resource-exhausted", "Çok hızlı tekrar denendi. 1 dk bekle.");
    }

    const code = genCode();
    const expiresAt = nowMs() + 10 * 60 * 1000;

    await ref.set(
      {
        email,
        code,
        expiresAt,
        lastSentAt: nowMs(),
        attempts: 0,
        verified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await admin.firestore().collection("mail").add({
  to: email,
  from: "Dromocob <no-reply@dromocob.com>",
  message: {
    subject: "Dromocob Doğrulama Kodunuz",
    html: `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f8f5ef;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eee4d2;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
      
      <div style="background:linear-gradient(180deg,#fffdf9 0%,#fff8ef 100%);padding:28px 24px 20px;text-align:center;border-bottom:1px solid #f1e8da;">
        <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#f5ead7;color:#b98c3c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
          Dromocob
        </div>
        <h2 style="margin:16px 0 8px;font-size:28px;line-height:1.2;color:#1d2433;font-weight:800;">
          Doğrulama Kodunuz
        </h2>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#6b7280;">
          Hesabınızı doğrulamak için aşağıdaki tek kullanımlık kodu girin.
        </p>
      </div>

      <div style="padding:28px 24px 18px;">
        <p style="margin:0 0 16px;font-size:16px;color:#374151;">
          Merhaba,
        </p>

        <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#4b5563;">
          Dromocob hesabınız için e-posta doğrulama işlemi başlatıldı.
          Aşağıdaki kodu ilgili alana girerek işlemi tamamlayabilirsiniz:
        </p>

        <div style="text-align:center;margin:0 0 26px;">
          <div style="display:inline-block;min-width:220px;padding:18px 24px;border-radius:16px;background:#fff8ef;border:1px solid #ead7b5;">
            <div style="font-size:12px;line-height:1;margin-bottom:10px;color:#b98c3c;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
              Doğrulama Kodu
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

    logger.info("verify code sent", { uid, email });

    return { ok: true };
  }
);

export const verifyCode = onCall(
  { region: "europe-west1", cors: true },
  async (request): Promise<VerifyResp> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Giriş gerekli.");

    const code = String((request.data as any)?.code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Kod 6 haneli olmalı.");
    }

    const verifyRef = admin.firestore().doc(`email_verifications/${uid}`);
    const verifySnap = await verifyRef.get();
    if (!verifySnap.exists) {
      throw new HttpsError("not-found", "Kod bulunamadı. Önce kod gönder.");
    }

    const d = verifySnap.data() || {};
    const expiresAt = Number(d.expiresAt || 0);
    const stored = String(d.code || "").replace(/\D/g, "");
    const attempts = Number(d.attempts || 0);

    if (!expiresAt || nowMs() > expiresAt) {
      throw new HttpsError("deadline-exceeded", "Kod süresi dolmuş. Yeniden gönder.");
    }

    if (attempts >= 7) {
      throw new HttpsError("permission-denied", "Çok fazla deneme. Yeni kod iste.");
    }

    if (code !== stored) {
      await verifyRef.set({ attempts: attempts + 1 }, { merge: true });
      throw new HttpsError("permission-denied", "Kod yanlış.");
    }

    await admin.auth().updateUser(uid, { emailVerified: true });

    const authUser = await admin.auth().getUser(uid);
    const email = String(authUser.email || d.email || "").trim();

    if (!email) {
      throw new HttpsError("failed-precondition", "Doğrulanan kullanıcı için e-posta bulunamadı.");
    }

    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const authDisplayName = String(authUser.displayName || "").trim();
    const existingDisplayName = String(userData.displayName || "").trim();
    const existingFirstName = String(userData.firstName || "").trim();
    const existingLastName = String(userData.lastName || "").trim();

    let finalDisplayName = existingDisplayName || authDisplayName;
    if (!finalDisplayName && (existingFirstName || existingLastName)) {
      finalDisplayName = `${existingFirstName} ${existingLastName}`.trim();
    }
    if (!finalDisplayName) finalDisplayName = email.split("@")[0];

    await userRef.set(
      {
        email,
        displayName: finalDisplayName,
        firstName: existingFirstName,
        lastName: existingLastName,
        isActive: userData.isActive !== false,
        consentApproved: userData.consentApproved === true,
        profileCompleted: userData.profileCompleted === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await verifyRef.set(
      {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("verify code success + user ensured", { uid, email });

    return { ok: true };
  }
);