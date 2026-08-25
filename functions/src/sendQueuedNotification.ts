import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

type PushTokenDoc = {
  token?: string;
  platform?: string;
  isActive?: boolean;
};

type NormalizedTokenRow = {
  ref: FirebaseFirestore.DocumentReference;
  path: string;
  token: string;
  platform: string;
  uid: string;
  isActive: boolean;
};

if (!admin.apps.length) {
  admin.initializeApp();
}

function normalizeUrl(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function safeStr(v: unknown): string {
  return String(v || "").trim();
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(values.map((x) => safeStr(x)).filter(Boolean))
  );
}
function buildFcmData(
  data: Record<string, any>,
  notificationId: string,
  url: string,
  image: string
) {
  const nested = data.data && typeof data.data === "object" ? data.data : {};

  const type = safeStr(data.type || nested.type || "manual");
  const action = safeStr(data.action || nested.action || "");

  const threadId = safeStr(
    data.threadId ||
      nested.threadId ||
      data.supportThreadId ||
      nested.supportThreadId
  );

  const supportThreadId = safeStr(
    data.supportThreadId ||
      nested.supportThreadId ||
      threadId
  );

  const messageId = safeStr(data.messageId || nested.messageId);

  const orderId = safeStr(data.orderId || nested.orderId);
  const refundId = safeStr(data.refundId || nested.refundId);
  const productId = safeStr(data.productId || nested.productId);

  const kind = safeStr(data.kind || nested.kind);
  const paymentLabel = safeStr(data.paymentLabel || nested.paymentLabel);
  const paymentMethod = safeStr(data.paymentMethod || nested.paymentMethod);
  const paymentProvider = safeStr(data.paymentProvider || nested.paymentProvider);
  const paymentStatus = safeStr(data.paymentStatus || nested.paymentStatus);
  const orderStatus = safeStr(data.orderStatus || nested.orderStatus);
  const totalTry = safeStr(data.totalTry || nested.totalTry);

  const fcmData: Record<string, string> = {
    notificationId,
    url,
    type,
    action,
  };

  if (threadId) fcmData.threadId = threadId;
  if (supportThreadId) fcmData.supportThreadId = supportThreadId;
  if (messageId) fcmData.messageId = messageId;

  if (orderId) fcmData.orderId = orderId;
  if (refundId) fcmData.refundId = refundId;
  if (productId) fcmData.productId = productId;

  if (kind) fcmData.kind = kind;
  if (paymentLabel) fcmData.paymentLabel = paymentLabel;
  if (paymentMethod) fcmData.paymentMethod = paymentMethod;
  if (paymentProvider) fcmData.paymentProvider = paymentProvider;
  if (paymentStatus) fcmData.paymentStatus = paymentStatus;
  if (orderStatus) fcmData.orderStatus = orderStatus;
  if (totalTry) fcmData.totalTry = totalTry;

  if (image) fcmData.image = image;

  return fcmData;
}
export const sendQueuedNotification = onDocumentCreated(
  {
    region: "europe-west1",
    document: "notifications/{notificationId}",
  },
  async (event) => {
    logger.info("STEP 0: trigger entered", {
      hasEventData: !!event.data,
      params: event.params || null,
    });

    const snap = event.data;
    if (!snap) {
      logger.error("STEP X: event.data missing");
      return;
    }

    try {
      logger.info("STEP 1: snapshot ok", {
        notificationId: snap.id,
        path: snap.ref.path,
      });

      const db = admin.firestore();
      const messaging = admin.messaging();

      const data = snap.data() || {};
      const notificationId = snap.id;

      const title = safeStr(data.title);
      const body = safeStr(data.body);
      const image = safeStr(data.image);
      const url = normalizeUrl(data.url);
const fcmData = buildFcmData(data, notificationId, url, image);
      const targetUserIds = Array.isArray(data.targetUserIds)
        ? uniqueStrings(data.targetUserIds)
        : [];

      const targetRoles = Array.isArray(data.targetRoles)
        ? uniqueStrings(data.targetRoles).map((x) => x.toLowerCase())
        : [];

      const targetPermission = safeStr(data.targetPermission).toLowerCase();

      logger.info("STEP 2: notification parsed", {
        notificationId,
        title,
        bodyLength: body.length,
        hasImage: !!image,
        url,
        type: safeStr(data.type),
        testMode: data.testMode === true,
        currentStatus: safeStr(data.status),
        targetUserIds,
        targetRoles,
        targetPermission,
        rawData: data,
        fcmData,
      });

      if (!title || !body) {
        logger.error("STEP X: missing title/body", {
          notificationId,
          title,
          body,
        });

        await snap.ref.set(
          {
            status: "failed",
            failReason: "missing_title_or_body",
            failedCount: 0,
            sentCount: 0,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      logger.info("STEP 3: setting processing status", { notificationId });

      await snap.ref.set(
        {
          status: "processing",
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      let allowedUserIds = new Set<string>();

      if (targetUserIds.length > 0) {
        allowedUserIds = new Set(targetUserIds);

        logger.info("STEP 4A: using explicit targetUserIds", {
          notificationId,
          targetCount: allowedUserIds.size,
        });
      } else if (targetRoles.length > 0 || !!targetPermission) {
        logger.info("STEP 4B: resolving users by role/permission", {
          notificationId,
          targetRoles,
          targetPermission,
        });

        const usersSnap = await db.collection("users").get();

        usersSnap.forEach((docSnap) => {
          const x: any = docSnap.data() || {};
          const uid = docSnap.id;
          const role = safeStr(x.role).toLowerCase();
          const isActiveUser = x.isActive !== false;
          const perms = x.permissions || {};

          if (!isActiveUser) return;
          if (targetRoles.length > 0 && !targetRoles.includes(role)) return;

          if (targetPermission) {
            const hasPermission =
              role === "admin" || perms[targetPermission] === true;
            if (!hasPermission) return;
          }

          allowedUserIds.add(uid);
        });

        logger.info("STEP 4C: resolved users by role/permission", {
          notificationId,
          allowedUserCount: allowedUserIds.size,
          allowedUserIds: Array.from(allowedUserIds),
        });
      }

      logger.info("STEP 5: querying push_tokens collectionGroup", {
        notificationId,
      });

      const tokensSnap = await db.collectionGroup("push_tokens").get();

      logger.info("STEP 6: query completed", {
        notificationId,
        docsCount: tokensSnap.size,
      });

      const tokenRows: NormalizedTokenRow[] = tokensSnap.docs
        .map((docSnap) => {
          const tokenData = docSnap.data() as PushTokenDoc;
          const token = safeStr(tokenData.token);
          const platform = safeStr(tokenData.platform).toLowerCase();
          const isActive = tokenData.isActive === true;
          const userRef = docSnap.ref.parent.parent;
          const uid = userRef?.id || "";

          return {
            ref: docSnap.ref,
            path: docSnap.ref.path,
            token,
            platform,
            uid,
            isActive,
          };
        })
        .filter(
          (x) =>
            x.isActive &&
            !!x.token &&
            !!x.uid &&
            (x.platform === "web" || x.platform === "ios")
        )
        .filter((x) => {
          if (allowedUserIds.size === 0) return true;
          return allowedUserIds.has(x.uid);
        });

      logger.info("STEP 7: tokens normalized + filtered", {
        notificationId,
        tokenCount: tokenRows.length,
        tokenPaths: tokenRows.map((x) => x.path),
        targetUserCount: allowedUserIds.size,
        targetUserIds: Array.from(allowedUserIds),
        tokenPreview: tokenRows.map((x) => x.token.slice(0, 18)),
      });

      if (!tokenRows.length) {
        logger.warn("STEP 8: no active tokens found after filtering", {
          notificationId,
          targetUserIds: Array.from(allowedUserIds),
        });

        await snap.ref.set(
          {
            status: "done",
            sentCount: 0,
            failedCount: 0,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        logger.info("STEP 9: completed with 0 send", { notificationId });
        return;
      }

      const chunks: NormalizedTokenRow[][] = [];
      for (let i = 0; i < tokenRows.length; i += 500) {
        chunks.push(tokenRows.slice(i, i + 500));
      }

      logger.info("STEP 10: chunks prepared", {
        notificationId,
        chunkCount: chunks.length,
        chunkSizes: chunks.map((x) => x.length),
      });

      let success = 0;
      let failure = 0;
      const refsToDeactivate: FirebaseFirestore.DocumentReference[] = [];

      for (const [chunkIndex, chunk] of chunks.entries()) {
        const tokens = chunk.map((x) => x.token);

        logger.info("STEP 11: sending chunk", {
          notificationId,
          chunkIndex,
          chunkSize: tokens.length,
          tokenPreview: tokens.map((t) => t.slice(0, 18)),
        });

        const response = await messaging.sendEachForMulticast({
  tokens,
  notification: {
    title,
    body,
  },
  data: fcmData,
  webpush: {
    fcmOptions: {
      link: url,
    },
    notification: {
      title,
      body,
      ...(image ? { image } : {}),
    },
  },
  apns: {
    payload: {
      aps: {
        sound: "default",
        badge: 1,
      },
    },
    fcmOptions: {
      imageUrl: image || undefined,
    },
  },
});

        const inboxBatch = db.batch();
        const seenInboxKeys = new Set<string>();

        response.responses.forEach((item, idx) => {
          if (!item.success) return;

          const target = chunk[idx];
          if (!target?.uid) return;

          const inboxKey = `${target.uid}_${notificationId}`;
          if (seenInboxKeys.has(inboxKey)) return;
          seenInboxKeys.add(inboxKey);

          const inboxRef = db
            .collection("users")
            .doc(target.uid)
            .collection("inbox_notifications")
            .doc(notificationId);

   inboxBatch.set(
  inboxRef,
  {
    notificationId,
    title,
    body,
    image: image || "",
    url,

    type: fcmData.type || "manual",
    action: fcmData.action || "",

    threadId: fcmData.threadId || "",
    supportThreadId: fcmData.supportThreadId || "",
    messageId: fcmData.messageId || "",

    orderId: fcmData.orderId || "",
    refundId: fcmData.refundId || "",
    productId: fcmData.productId || "",

    kind: fcmData.kind || "",
    paymentLabel: fcmData.paymentLabel || "",
    paymentMethod: fcmData.paymentMethod || "",
    paymentProvider: fcmData.paymentProvider || "",
    paymentStatus: fcmData.paymentStatus || "",
    orderStatus: fcmData.orderStatus || "",
    totalTry: fcmData.totalTry || "",

    data: fcmData,

    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "push",
  },
  { merge: true }
);
        });

        if (seenInboxKeys.size > 0) {
          await inboxBatch.commit();

          logger.info("STEP 11B: inbox notifications written", {
            notificationId,
            count: seenInboxKeys.size,
          });
        }

        logger.info("STEP 12: chunk result", {
          notificationId,
          chunkIndex,
          successCount: response.successCount,
          failureCount: response.failureCount,
          responses: response.responses.map((r) => ({
            success: r.success,
            errorCode: r.error?.code || null,
            errorMessage: r.error?.message || null,
          })),
        });

        success += response.successCount;
        failure += response.failureCount;

        response.responses.forEach((item, idx) => {
          if (item.success) return;

          const errCode = item.error?.code || "unknown";
          const errMsg = item.error?.message || "unknown_error";

          logger.error("STEP 13: push send failure", {
            notificationId,
            chunkIndex,
            tokenIndex: idx,
            tokenPath: chunk[idx]?.path || null,
            code: errCode,
            message: errMsg,
          });

          if (
            errCode === "messaging/registration-token-not-registered" ||
            errCode === "messaging/invalid-registration-token"
          ) {
            refsToDeactivate.push(chunk[idx].ref);
          }
        });
      }

      logger.info("STEP 14: all chunks completed", {
        notificationId,
        success,
        failure,
        deactivateCount: refsToDeactivate.length,
      });

      if (refsToDeactivate.length) {
        const batchSize = 400;

        for (let i = 0; i < refsToDeactivate.length; i += batchSize) {
          const group = refsToDeactivate.slice(i, i + batchSize);
          const batch = db.batch();

          group.forEach((ref) => {
            batch.set(
              ref,
              {
                isActive: false,
                invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          });

          await batch.commit();
        }

        logger.info("STEP 15: invalid tokens deactivated", {
          notificationId,
          count: refsToDeactivate.length,
        });
      }

      await snap.ref.set(
        {
          status: "done",
          sentCount: success,
          failedCount: failure,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("STEP 16: notification finished", {
        notificationId,
        success,
        failure,
      });
    } catch (error: any) {
      logger.error("STEP FATAL: sendQueuedNotification crashed", {
        message: error?.message || "unknown",
        code: error?.code || null,
        stack: error?.stack || null,
      });

      try {
        await snap.ref.set(
          {
            status: "failed",
            failReason: error?.message || "unknown_error",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (writeErr: any) {
        logger.error("STEP FATAL-2: failed to mark notification as failed", {
          message: writeErr?.message || "unknown",
          stack: writeErr?.stack || null,
        });
      }
    }
  }
);