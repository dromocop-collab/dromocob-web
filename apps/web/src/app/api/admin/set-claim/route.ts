import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase.admin";
import { verifyAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 🔒 Admin auth kontrolü
    const caller = await verifyAdmin(req);
    if (caller instanceof NextResponse) return caller;

    // Sadece "admin" rolü claim basabilir (sub_admin yapamaz)
    if (caller.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Sadece admin rolü bu işlemi yapabilir.", code: "ROLE_INSUFFICIENT" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const uid = String(body?.uid || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!uid && !email) {
      return NextResponse.json(
        { ok: false, error: "uid veya email gerekli" },
        { status: 400 }
      );
    }

    const auth = adminAuth();

    let targetUid = uid;

    if (!targetUid && email) {
      const user = await auth.getUserByEmail(email);
      targetUid = user.uid;
    }

    await auth.setCustomUserClaims(targetUid, {
      admin: true,
      role: "admin",
      roles: ["admin"],
    });

    return NextResponse.json({
      ok: true,
      uid: targetUid,
      message: "Admin claim basıldı",
    });
  } catch (e: any) {
    console.error("set-claim error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "claim basılamadı" },
      { status: 500 }
    );
  }
}