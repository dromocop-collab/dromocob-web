import { NextRequest } from "next/server";
import { requireDesktopAdmin } from "../_lib/auth";
import { fail, ok } from "../_lib/response";
import { desktopDb } from "../_lib/firebase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const auth = requireDesktopAdmin(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    try {
        const db = desktopDb();

        const snap = await db
            .collection("analytics_daily")
            .orderBy("date", "desc")
            .limit(30)
            .get();

        const analytics = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return ok(analytics);
    } catch (error) {
        return fail(error, 500);
    }
}