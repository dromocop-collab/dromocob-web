/**
 * POST /api/newsletter/sync-coupon
 *
 * Kullanıcı giriş yaptığında veya kayıt olduğunda,
 * daha önce misafirken newsletter'a abone olarak kazandığı kuponu
 * hesabına (users/{uid}/wheel_coupons) otomatik ekler.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyUser } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  try {
    const verified = await verifyUser(req);
    if (verified instanceof NextResponse) return verified;

    const trimmedEmail = String(verified.email || "").trim().toLowerCase();
    const safeUid = verified.uid;

    if (!trimmedEmail || !safeUid) {
      return NextResponse.json({ synced: false, reason: "account_has_no_email" }, { status: 400 });
    }

    const db = adminDb();

    // Newsletter subscriber kaydı var mı?
    const subSnap = await db
      .collection("newsletter_subscribers")
      .where("email", "==", trimmedEmail)
      .limit(1)
      .get();

    if (subSnap.empty) {
      // Bu email ile newsletter aboneliği yok
      return NextResponse.json({ synced: false, reason: "no_subscription" });
    }

    const subDoc = subSnap.docs[0];
    const subData = subDoc.data();
    const couponCode = String(subData?.couponCode || "").trim();

    if (!couponCode) {
      return NextResponse.json({ synced: false, reason: "no_coupon_code" });
    }

    // Kupon zaten profilde var mı?
    const couponRef = db
      .collection("users")
      .doc(safeUid)
      .collection("wheel_coupons")
      .doc(couponCode);

    const couponSnap = await couponRef.get();

    if (couponSnap.exists) {
      return NextResponse.json({ synced: false, reason: "already_synced", couponCode });
    }

    // wheel_leads'den kupon detaylarını çek
    const leadsSnap = await db
      .collection("wheel_leads")
      .where("email", "==", trimmedEmail)
      .where("couponCode", "==", couponCode)
      .limit(1)
      .get();

    const leadData = leadsSnap.empty ? null : leadsSnap.docs[0].data();

    // Kuponu profildeki wheel_coupons'a ekle
    await couponRef.set({
      code: couponCode,
      label: leadData?.rewardLabel || "%5 İndirim",
      status: leadData?.couponStatus || "active",
      discountType: leadData?.discountType || "percent",
      discountValue: leadData?.discountValue || 5,
      campaignTitle: leadData?.campaignTitle || "Newsletter Abonelik",
      source: "newsletter",
      expiresAt: leadData?.expiresAt || subData?.expiresAt || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Newsletter subscriber doc'una uid ekle
    if (!subData?.uid) {
      await subDoc.ref.update({ uid: safeUid });
    }

    // wheel_leads'deki kayda da uid ekle
    if (!leadsSnap.empty && !leadData?.uid) {
      await leadsSnap.docs[0].ref.update({ uid: safeUid });
    }

    return NextResponse.json({ synced: true, couponCode });
  } catch (err: any) {
    console.error("[newsletter/sync-coupon] error:", err);
    return NextResponse.json({ synced: false, error: err?.message || "Hata" });
  }
}
