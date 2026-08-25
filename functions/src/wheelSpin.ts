import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) admin.initializeApp();

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function normalizeIp(raw: string) {
  return String(raw || "").split(",")[0].trim();
}

function safeStr(v: unknown, fallback = "") {
  const x = String(v ?? "").trim();
  return x || fallback;
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildCouponCode(label: string, prefix = "WHEEL") {
  const clean = String(label || "")
    .toUpperCase()
    .replace(/%/g, "YUZDE")
    .replace(/\s+/g, "")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  const safePrefix = String(prefix || "WHEEL")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "WHEEL";

  const rand = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${safePrefix}-${clean}-${rand}`;
}

function normalizeEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeDeviceId(v: unknown) {
  return safeStr(v).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
}

function pickWeightedWinner(rewards: Array<Record<string, any>>) {
  const pool = rewards.filter(
    (x) => x?.isWinnable !== false && Number(x?.probabilityWeight || 0) > 0
  );

  if (!pool.length) {
    throw new HttpsError("failed-precondition", "Aktif ödül yok.");
  }

  const total = pool.reduce(
    (acc, item) => acc + Number(item?.probabilityWeight || 0),
    0
  );

  let r = Math.random() * total;

  for (const item of pool) {
    r -= Number(item?.probabilityWeight || 0);
    if (r <= 0) return item;
  }

  return pool[pool.length - 1];
}

function addDaysTs(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return admin.firestore.Timestamp.fromDate(d);
}

function getDiscountType(rewardType: unknown) {
  const x = safeStr(rewardType, "fixed");

  if (
    x === "percent" ||
    x === "fixed" ||
    x === "free_shipping" ||
    x === "gift"
  ) {
    return x;
  }

  return "fixed";
}

function getMillis(v: any) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (v instanceof admin.firestore.Timestamp) return v.toMillis();
  return 0;
}

function isCampaignLive(data: any) {
  const now = Date.now();
  const startsAt = getMillis(data?.startsAt);
  const endsAt = getMillis(data?.endsAt);

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

export const spinWheelV1 = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request) => {
    const campaignId = safeStr(request.data?.campaignId);
    const guestData = request.data?.guestData || null;
    const deviceId = normalizeDeviceId(request.data?.deviceId);

    if (!campaignId) {
      throw new HttpsError("invalid-argument", "campaignId zorunlu.");
    }

    const db = admin.firestore();
    const auth = request.auth;

    const isAdmin =
      auth?.token?.admin === true ||
      safeStr(auth?.token?.role).toLowerCase() === "admin" ||
      (Array.isArray(auth?.token?.roles) &&
        auth.token.roles.some((role: unknown) => safeStr(role).toLowerCase() === "admin"));

    const rawIp =
      normalizeIp(String(request.rawRequest.headers["x-forwarded-for"] || "")) ||
      normalizeIp(String((request.rawRequest as any).ip || ""));

    if (!rawIp && !isAdmin) {
      throw new HttpsError("permission-denied", "IP alınamadı.");
    }

    if (!deviceId && !isAdmin) {
      throw new HttpsError("invalid-argument", "Cihaz doğrulaması alınamadı.");
    }

    const email = normalizeEmail(guestData?.email || auth?.token?.email);
    if (!auth?.uid && !isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Geçerli bir e-posta adresi gerekli.");
    }

    const campaignRef = db.collection("wheel_campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      throw new HttpsError("not-found", "Kampanya bulunamadı.");
    }

    const campaignData = campaignSnap.data() || {};
    const campaignRules = campaignData?.rules && typeof campaignData.rules === "object"
      ? campaignData.rules
      : {};

    if (!isAdmin) {
      const published = campaignData?.published === true;
      const popupEnabled = campaignData?.popupEnabled !== false;
      const isActive = campaignData?.isActive === true;
      const status = safeStr(campaignData?.status, "draft");

      if (!published || !popupEnabled || !isActive || status !== "active") {
        throw new HttpsError("failed-precondition", "Kampanya aktif değil.");
      }

      if (!isCampaignLive(campaignData)) {
        throw new HttpsError("failed-precondition", "Kampanya süresi aktif değil.");
      }

      if (!isValidEmail(email)) {
        throw new HttpsError("invalid-argument", "Kupon teslimi için geçerli bir e-posta gerekli.");
      }

      if (!auth?.uid) {
        if (!safeStr(guestData?.fullName)) {
          throw new HttpsError("invalid-argument", "Ad soyad gerekli.");
        }
        if (campaignRules?.requirePhone !== false && !safeStr(guestData?.phone)) {
          throw new HttpsError("invalid-argument", "Telefon numarası gerekli.");
        }
        if (campaignRules?.requireConsent !== false && guestData?.consent !== true) {
          throw new HttpsError("failed-precondition", "Kampanya ve iletişim onayı gerekli.");
        }
      }
    }

    const campaignTitle =
      safeStr(campaignData?.title) ||
      safeStr(campaignData?.heroTitle) ||
      "Şans Çarkı";

    const ipHash = sha256(`wheel:${campaignId}:ip:${rawIp}`);
    const deviceHash = sha256(`wheel:${campaignId}:device:${deviceId}`);
    const lockKeys = [
      ...(rawIp ? [`ip:${ipHash}`] : []),
      ...(deviceId ? [`device:${deviceHash}`] : []),
      ...(auth?.uid ? [`user:${sha256(auth.uid)}`] : []),
      ...(email ? [`email:${sha256(email)}`] : []),
    ];
    const lockRefs = lockKeys.map((key) =>
      db.collection("wheel_spin_locks").doc(sha256(`${campaignId}:${key}`))
    );
    // Önceki sürümde kullanılan tekil kilidi de kontrol ederek mevcut
    // katılımcılara dağıtım sonrası ikinci hak açılmasını engelle.
    const legacyIpHash = sha256(`wheel:${campaignId}:${rawIp}`);
    const legacySourceKey = auth?.uid ? `user:${auth.uid}` : `guest:${legacyIpHash}`;
    const legacyLockRef = db
      .collection("wheel_spin_locks")
      .doc(`${campaignId}__${legacySourceKey}`);

    if (!isAdmin) {
      const existing = await db.getAll(...lockRefs, legacyLockRef);
      if (existing.some((snap) => snap.exists)) {
        throw new HttpsError(
          "already-exists",
          "Bu kampanya için bu hesap, e-posta, cihaz veya bağlantıdan daha önce çark çevrilmiş."
        );
      }

      // Kilit sistemi devreye alınmadan önce oluşturulmuş çevirimleri de yakala.
      const legacySpinQueries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
      if (auth?.uid) {
        legacySpinQueries.push(
          db.collection("wheel_leads")
            .where("campaignId", "==", campaignId)
            .where("uid", "==", auth.uid)
            .limit(1)
            .get()
        );
      }
      if (email) {
        legacySpinQueries.push(
          db.collection("wheel_leads")
            .where("campaignId", "==", campaignId)
            .where("email", "==", email)
            .limit(1)
            .get()
        );
      }
      if (deviceId) {
        legacySpinQueries.push(
          db.collection("wheel_leads")
            .where("campaignId", "==", campaignId)
            .where("deviceHash", "==", deviceHash)
            .limit(1)
            .get()
        );
      }

      const legacySpins = await Promise.all(legacySpinQueries);
      if (legacySpins.some((snap) => !snap.empty)) {
        throw new HttpsError(
          "already-exists",
          "Bu kampanya için bu hesap, e-posta veya cihazdan daha önce çark çevrilmiş."
        );
      }
    }

    const rewardsSnap = await db
      .collection("wheel_rewards")
      .where("campaignId", "==", campaignId)
      .where("isActive", "==", true)
      .get();

    const rewards = rewardsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    if (!rewards.length) {
      throw new HttpsError(
        "failed-precondition",
        "Bu kampanya için ödül bulunamadı."
      );
    }

    const winner = pickWeightedWinner(rewards);

    const couponPrefix = safeStr(winner?.couponPrefix, "WHEEL");
    const couponCode = buildCouponCode(
      safeStr(winner?.label, "ODUL"),
      couponPrefix
    );

    const rewardType = safeStr(winner?.rewardType, "fixed");
    const rewardValue = safeNum(winner?.value, 0);
    const discountType = getDiscountType(rewardType);
    const discountValue =
      discountType === "free_shipping" ? 0 : rewardValue;
    const couponDurationDays = Math.max(1, Math.min(365, safeNum(winner?.couponDurationDays, 7)));
    const singleUse = winner?.singleUse !== false;
    const minCartAmount = safeNum(winner?.minCartAmount, 0);

    await db.runTransaction(async (tx) => {
      if (!isAdmin) {
        const transactionLocks = await Promise.all(
          [...lockRefs, legacyLockRef].map((ref) => tx.get(ref))
        );

        if (transactionLocks.some((snap) => snap.exists)) {
          throw new HttpsError(
            "already-exists",
            "Bu kampanya için bu hesap, e-posta, cihaz veya bağlantıdan daha önce çark çevrilmiş."
          );
        }

        [...lockRefs, legacyLockRef].forEach((lockRef, index) => {
          tx.set(lockRef, {
            campaignId,
            lockType: index < lockKeys.length
              ? lockKeys[index].split(":", 1)[0]
              : "legacy",
            ipHash,
            deviceHash,
            uid: auth?.uid || null,
            email,
            source: auth?.uid ? "member" : "guest",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      }

      if (auth?.uid) {
        const couponRef = db
          .collection("users")
          .doc(auth.uid)
          .collection("wheel_coupons")
          .doc(couponCode);

        tx.set(couponRef, {
          code: couponCode,
          label: safeStr(winner?.label),
          status: "active",
          campaignId,
          campaignTitle,
          rewardId: winner.id,
          rewardType,
          rewardValue,
          discountType,
          discountValue,
          singleUse,
          minCartAmount,
          expiresAt: addDaysTs(couponDurationDays),
          source: "wheel",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const leadRef = db.collection("wheel_leads").doc();
      tx.set(leadRef, {
          fullName: safeStr(guestData?.fullName || auth?.token?.name),
          email,
          phone: safeStr(guestData?.phone),
          consent: auth?.uid ? true : guestData?.consent === true,
          uid: auth?.uid || null,
          campaignId,
          campaignTitle,
          rewardId: winner.id,
          rewardLabel: safeStr(winner?.label),
          rewardType,
          rewardValue,
          couponCode,
          couponStatus: "active",
          discountType,
          discountValue,
          singleUse,
          minCartAmount,
          expiresAt: addDaysTs(couponDurationDays),
          source: auth?.uid ? "wheel_member" : "wheel_guest",
          ipHash,
          deviceHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    logger.info("wheel spin success", {
      campaignId,
      campaignTitle,
      rewardId: winner.id,
      rewardLabel: safeStr(winner?.label),
      uid: auth?.uid || null,
      isAdmin,
    });

    return {
      ok: true,
      winner: {
        id: winner.id,
        label: safeStr(winner?.label),
        rewardType,
        value: rewardValue,
      },
      couponCode,
      campaignTitle,
    };
  }
);
