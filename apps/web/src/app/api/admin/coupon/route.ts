/**
 * DELETE /api/admin/coupon
 *
 * Admin panelinden kupon silme.
 * source: "member" → users/{uid}/wheel_coupons/{code}
 * source: "guest"  → wheel_leads/{docId}
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

export async function DELETE(req: NextRequest) {
  try {
    const { source, docId, uid, code } = await req.json();

    if (!source || !docId) {
      return NextResponse.json(
        { error: "source and docId required" },
        { status: 400 }
      );
    }

    const db = adminDb();

    if (source === "member") {
      // member kuponları collectionGroup'tan geliyor,
      // uid ve code ile doğru doc'u bulup silmemiz lazım
      if (uid && code) {
        await db
          .collection("users")
          .doc(uid)
          .collection("wheel_coupons")
          .doc(code)
          .delete();
      } else {
        // collectionGroup'tan gelen doc path'i ile sil
        const snap = await db
          .collectionGroup("wheel_coupons")
          .where("code", "==", docId)
          .limit(1)
          .get();

        if (!snap.empty) {
          await snap.docs[0].ref.delete();
        }
      }
    } else if (source === "guest") {
      await db.collection("wheel_leads").doc(docId).delete();
    } else {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[DELETE /api/admin/coupon] error:", e);
    return NextResponse.json(
      { error: e?.message || "Silme hatası" },
      { status: 500 }
    );
  }
}
