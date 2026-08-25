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
            .collection("products")
            .orderBy("updatedAt", "desc")
            .limit(250)
            .get();

        const products = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return ok(products);
    } catch (error) {
        return fail(error, 500);
    }
}

export async function POST(req: NextRequest) {
    const auth = requireDesktopAdmin(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    try {
        const db = desktopDb();
        const body = await req.json();

        const now = new Date();

        const productData = {
            title: body.title ?? "",
            slug: body.slug ?? "",
            sku: body.sku ?? "",
            category: body.category ?? "",
            image: body.image ?? body.imageURL ?? "",
            price: Number(body.price ?? body.priceTRY ?? 0),
            stock: Number(body.stock ?? 0),
            shortDescription: body.shortDescription ?? "",
            description: body.description ?? "",
            seoTitle: body.seoTitle ?? "",
            seoDescription: body.seoDescription ?? "",
            isActive: Boolean(body.isActive ?? true),
            isFeatured: Boolean(body.isFeatured ?? false),
            createdAt: now,
            updatedAt: now,
        };

        const ref = await db.collection("products").add(productData);

        return ok(
            {
                id: ref.id,
                ...productData,
            },
            201
        );
    } catch (error) {
        return fail(error, 500);
    }
}