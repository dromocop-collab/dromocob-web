import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase.admin";
import { verifyUser } from "@/lib/apiAuth";

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(req: NextRequest) {
  try {
    const verified = await verifyUser(req);
    if (verified instanceof NextResponse) return verified;

    const uid = String(verified.uid || "").trim();
    const email = String(verified.email || "").trim().toLowerCase();
    if (!uid || !email) {
      return NextResponse.json(
        { synced: false, reason: "account_has_no_email" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const leadsSnap = await db
      .collection("wheel_leads")
      .where("email", "==", email)
      .limit(50)
      .get();

    const syncedCodes: string[] = [];
    const now = Date.now();

    for (const lead of leadsSnap.docs) {
      const data = lead.data() || {};
      const code = String(data.couponCode || "").trim().toUpperCase();
      const status = String(data.couponStatus || "active");
      const expiresAtMs = toMillis(data.expiresAt);
      const claimedUid = String(data.uid || "").trim();

      if (!code || status !== "active") continue;
      if (claimedUid && claimedUid !== uid) continue;

      if (expiresAtMs && expiresAtMs <= now) {
        await lead.ref.set(
          {
            couponStatus: "expired",
            expiredAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      const couponRef = db
        .collection("users")
        .doc(uid)
        .collection("wheel_coupons")
        .doc(code);

      await db.runTransaction(async (tx) => {
        const [freshLead, existingCoupon] = await Promise.all([
          tx.get(lead.ref),
          tx.get(couponRef),
        ]);
        if (!freshLead.exists) return;

        const fresh = freshLead.data() || {};
        if (String(fresh.couponStatus || "active") !== "active") return;
        const freshUid = String(fresh.uid || "").trim();
        if (freshUid && freshUid !== uid) return;

        if (!existingCoupon.exists) {
          tx.set(couponRef, {
            code,
            label: String(fresh.rewardLabel || "Kampanya Kuponu"),
            status: "active",
            campaignId: String(fresh.campaignId || ""),
            campaignTitle: String(fresh.campaignTitle || "Dromocob Kampanyası"),
            rewardId: String(fresh.rewardId || ""),
            rewardType: String(fresh.rewardType || fresh.discountType || "fixed"),
            rewardValue: Number(fresh.rewardValue || fresh.discountValue || 0),
            discountType: String(fresh.discountType || "fixed"),
            discountValue: Number(fresh.discountValue || 0),
            minCartAmount: Number(fresh.minCartAmount || 0),
            singleUse: fresh.singleUse !== false,
            expiresAt: fresh.expiresAt || null,
            source: String(fresh.source || "wheel_guest"),
            claimedFromGuest: true,
            createdAt: fresh.createdAt || FieldValue.serverTimestamp(),
            claimedAt: FieldValue.serverTimestamp(),
          });
        }

        tx.set(
          lead.ref,
          {
            uid,
            claimedAt: FieldValue.serverTimestamp(),
            claimedToAccount: true,
          },
          { merge: true }
        );
      });

      syncedCodes.push(code);
    }

    return NextResponse.json({
      synced: syncedCodes.length > 0,
      count: syncedCodes.length,
      couponCodes: syncedCodes,
    });
  } catch (error: any) {
    console.error("[wheel/sync-coupons] error:", error);
    return NextResponse.json(
      { synced: false, error: error?.message || "Kuponlar eşitlenemedi." },
      { status: 500 }
    );
  }
}
