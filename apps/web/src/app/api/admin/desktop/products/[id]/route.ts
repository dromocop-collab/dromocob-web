import { NextRequest } from "next/server";
import { requireDesktopAdmin } from "../../_lib/auth";
import { fail, ok } from "../../_lib/response";
import { desktopDb } from "../../_lib/firebase";

export const runtime = "nodejs";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function PUT(req: NextRequest, context: Params) {
    const auth = requireDesktopAdmin(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    try {
        const { id } = await context.params;
        const body = await req.json();

        if (!id) {
            return fail("Ürün ID eksik.", 400);
        }

        const db = desktopDb();
        const ref = db.collection("products").doc(id);
        const existing = await ref.get();

        if (!existing.exists) {
            return fail("Ürün bulunamadı.", 404);
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        const allowedFields = [
            "title",
            "slug",
            "sku",
            "category",
            "image",
            "imageURL",
            "price",
            "priceTRY",
            "stock",
            "shortDescription",
            "description",
            "seoTitle",
            "seoDescription",
            "isActive",
            "isFeatured",
        ];

        for (const field of allowedFields) {
            if (field in body) {
                updateData[field] = body[field];
            }
        }

        if ("priceTRY" in body && !("price" in body)) {
            updateData.price = Number(body.priceTRY ?? 0);
        }

        if ("stock" in body) {
            updateData.stock = Number(body.stock ?? 0);
        }

        await ref.update(updateData);

        const saved = await ref.get();

        return ok({
            id: saved.id,
            ...saved.data(),
        });
    } catch (error) {
        return fail(error, 500);
    }
}