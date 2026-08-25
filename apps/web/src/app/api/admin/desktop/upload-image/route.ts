import { NextRequest } from "next/server";
import { requireDesktopAdmin } from "../_lib/auth";
import { fail, ok } from "../_lib/response";
import { desktopBucket } from "../_lib/firebase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const auth = requireDesktopAdmin(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    try {
        const formData = await req.formData();

        const file = formData.get("file");
        const productId = String(formData.get("productId") ?? "general");

        if (!(file instanceof File)) {
            return fail("Dosya bulunamadı.", 400);
        }

        const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

        if (!allowedTypes.includes(file.type)) {
            return fail("Sadece PNG, JPG/JPEG veya WEBP kabul edilir.", 400);
        }

        const bucket = desktopBucket();
        const buffer = Buffer.from(await file.arrayBuffer());

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-")
            .replace(/-+/g, "-");

        const path = `desktop-admin/products/${productId}/${Date.now()}-${safeName}`;
        const storageFile = bucket.file(path);

        await storageFile.save(buffer, {
            metadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000",
            },
        });

        await storageFile.makePublic();

        const publicURL = `https://storage.googleapis.com/${bucket.name}/${path}`;

        return ok({
            url: publicURL,
            path,
            contentType: file.type,
            size: file.size,
        });
    } catch (error) {
        return fail(error, 500);
    }
}