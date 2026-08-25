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

        const [productsSnap, analyticsSnap, homeSnap, ordersSnap] =
            await Promise.all([
                db.collection("products").limit(250).get(),
                db.collection("analytics_daily").orderBy("date", "desc").limit(30).get(),
                db.collection("home_sections").orderBy("sortOrder", "asc").limit(100).get(),
                db.collection("orders").orderBy("createdAt", "desc").limit(50).get(),
            ]);

        const products = productsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const analytics = analyticsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const homeSections = homeSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const orders = ordersSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return ok({
            products,
            analytics,
            homeSections,
            orders,
        });
    } catch (error) {
        return fail(error, 500);
    }
}