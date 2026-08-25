import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

if (!admin.apps.length) admin.initializeApp();

function safeStr(v: unknown): string {
  return String(v || "").trim();
}

function clipText(text: string, max = 160): string {
  const clean = safeStr(text).replace(/\s+/g, " ");
  if (!clean) return "Yeni destek mesajı geldi.";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function resolveRole(data: Record<string, any>): string {
  const role = safeStr(data.role).toLowerCase();
  const sender = safeStr(data.sender).toLowerCase();
  const senderType = safeStr(data.senderType).toLowerCase();

  if (role === "admin" || sender === "admin" || senderType === "admin") {
    return "admin";
  }

  return "user";
}

export const queueSupportAdminNotification = onDocumentCreated(
  {
    region: "europe-west1",
    document: "support_threads/{threadId}/messages/{messageId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msg = snap.data() || {};
    const threadId = safeStr(event.params.threadId);
    const messageId = safeStr(event.params.messageId);

    if (!threadId) {
      logger.warn("support notify skipped: missing threadId", { messageId });
      return;
    }

    const role = resolveRole(msg);
    const text = safeStr(msg.text);

    if (role !== "user") {
      logger.info("support notify skipped: not user message", {
        threadId,
        messageId,
        role,
      });
      return;
    }

    const db = admin.firestore();

    const threadSnap = await db.collection("support_threads").doc(threadId).get();
    const thread = threadSnap.exists ? threadSnap.data() || {} : {};

    const displayName =
      safeStr(thread.name) ||
      safeStr(thread.fullName) ||
      safeStr(thread.email) ||
      safeStr(thread.phone) ||
      "Yeni ziyaretçi";

    const body = clipText(text || "Yeni destek mesajı geldi.");

    const usersSnap = await db.collection("users").get();

    const targets: string[] = [];
    const targetDebug: Array<{
      uid: string;
      role: string;
      isActive: boolean;
      support: boolean;
      supportNotifications: boolean;
    }> = [];

    usersSnap.forEach((docSnap) => {
      const x: any = docSnap.data() || {};
      const userRole = safeStr(x.role).toLowerCase();
      const isActive = x.isActive !== false;
      const perms = x.permissions || {};

      const canSupportNotification =
        userRole === "admin" ||
        (
          userRole === "sub_admin" &&
          perms.support === true &&
          perms.support_notifications === true
        );

      if (isActive && canSupportNotification) {
        targets.push(docSnap.id);

        targetDebug.push({
          uid: docSnap.id,
          role: userRole,
          isActive,
          support: perms.support === true,
          supportNotifications: perms.support_notifications === true,
        });
      }
    });

    if (!targets.length) {
      logger.info("support notify skipped: no admin targets", { threadId });
      return;
    }

    const url = `/admin/support/${threadId}`;

    logger.info("support notify targets resolved", {
      threadId,
      messageId,
      targetCount: targets.length,
      targetDebug,
    });

    await db.collection("notifications").add({
      title: `Yeni destek mesajı • ${displayName}`,
      body,
      image: "",
      url,

      // Route / action bilgileri
      type: "support_thread",
      action: "open_support_thread",
      threadId,
      supportThreadId: threadId,
      messageId,

      // iOS ve web push data payload için net alan
      data: {
        type: "support_thread",
        action: "open_support_thread",
        threadId,
        supportThreadId: threadId,
        messageId,
        url,
      },

      targetRoles: ["admin", "sub_admin"],
      targetPermission: "support_notifications",
      targetUserIds: targets,
      status: "queued",

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("support notification queued", {
      threadId,
      messageId,
      targetCount: targets.length,
    });
  }
);