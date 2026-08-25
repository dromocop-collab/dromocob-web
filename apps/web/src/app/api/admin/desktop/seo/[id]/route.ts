import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp, cert } from "firebase-admin/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type SeoPayload = {
    title?: string;
    shortDescription?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    metaTitle?: string;
    metaDescription?: string;
    tags?: string[] | string;
    keywords?: string[] | string;
    instagramCaption?: string;
    googleAdsHeadlines?: string[];
    googleAdsDescriptions?: string[];
};

function initAdmin() {
    if (getApps().length) return;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Firebase Admin env eksik: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
    }

    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

function json(data: unknown, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    });
}

function getBearerToken(req: NextRequest) {
    const header = req.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || "";
}

function assertAuth(req: NextRequest) {
    const expected = process.env.DESKTOP_ADMIN_TOKEN?.trim();
    const given = getBearerToken(req);

    if (!expected) {
        return {
            ok: false,
            message: "Sunucuda DESKTOP_ADMIN_TOKEN tanımlı değil.",
        };
    }

    if (!given || given !== expected) {
        return {
            ok: false,
            message: "Yetkisiz erişim. Admin token hatalı veya eksik.",
        };
    }

    return {
        ok: true,
        message: "",
    };
}

function cleanString(value: unknown) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .replace(/[<>]/g, "")
        .trim();
}

function cleanLongText(value: unknown) {
    return String(value ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/[<>]/g, "")
        .trim();
}

function cleanStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return Array.from(
            new Set(
                value
                    .map((x) => cleanString(x).toLocaleLowerCase("tr-TR"))
                    .filter(Boolean)
            )
        ).slice(0, 30);
    }

    if (typeof value === "string") {
        return Array.from(
            new Set(
                value
                    .split(",")
                    .map((x) => cleanString(x).toLocaleLowerCase("tr-TR"))
                    .filter(Boolean)
            )
        ).slice(0, 30);
    }

    return [];
}

function truncate(text: string, max: number) {
    const clean = cleanString(text);
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 1).trimEnd() + "…";
}

function normalizeSlug(value: string) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function pickTitle(payload: SeoPayload) {
    return (
        cleanString(payload.seoTitle) ||
        cleanString(payload.metaTitle) ||
        cleanString(payload.title)
    );
}

function pickDescription(payload: SeoPayload) {
    return (
        cleanString(payload.seoDescription) ||
        cleanString(payload.metaDescription) ||
        cleanString(payload.shortDescription) ||
        cleanString(payload.description)
    );
}

export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        const auth = assertAuth(req);

        if (!auth.ok) {
            return json(
                {
                    ok: false,
                    error: auth.message,
                },
                401
            );
        }

        const { id } = await context.params;
        const productId = decodeURIComponent(id || "").trim();

        if (!productId) {
            return json(
                {
                    ok: false,
                    error: "Ürün ID eksik.",
                },
                400
            );
        }

        const payload = (await req.json().catch(() => null)) as SeoPayload | null;

        if (!payload || typeof payload !== "object") {
            return json(
                {
                    ok: false,
                    error: "Geçersiz JSON body.",
                },
                400
            );
        }

        const seoTitle = truncate(pickTitle(payload), 70);
        const seoDescription = truncate(pickDescription(payload), 170);

        const title = cleanString(payload.title);
        const shortDescription = cleanString(payload.shortDescription);
        const description = cleanLongText(payload.description);

        const tags = cleanStringArray(payload.tags);
        const keywords = cleanStringArray(payload.keywords || payload.tags);

        const instagramCaption = cleanLongText(payload.instagramCaption);
        const googleAdsHeadlines = Array.isArray(payload.googleAdsHeadlines)
            ? payload.googleAdsHeadlines.map(cleanString).filter(Boolean).slice(0, 15)
            : [];

        const googleAdsDescriptions = Array.isArray(payload.googleAdsDescriptions)
            ? payload.googleAdsDescriptions.map(cleanString).filter(Boolean).slice(0, 8)
            : [];

        if (!seoTitle && !seoDescription && !shortDescription && !description && !tags.length) {
            return json(
                {
                    ok: false,
                    error: "Güncellenecek SEO alanı bulunamadı.",
                },
                400
            );
        }

        initAdmin();

        const db = getFirestore();
        const ref = db.collection("products").doc(productId);
        const snap = await ref.get();

        if (!snap.exists) {
            return json(
                {
                    ok: false,
                    error: "Ürün bulunamadı.",
                    productId,
                },
                404
            );
        }

        const current = snap.data() || {};
        const currentTitle =
            typeof current.title === "string"
                ? current.title
                : current.title?.tr || current.title?.en || "";

        const currentSlug = String(current.slug || "");
        const finalTitle = title || currentTitle || productId;
        const finalSlug = currentSlug || normalizeSlug(finalTitle);

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),

            advanced: {
                ...(typeof current.advanced === "object" && current.advanced ? current.advanced : {}),

                shortDescription: {
                    tr: shortDescription || current.advanced?.shortDescription?.tr || "",
                    en: current.advanced?.shortDescription?.en || "",
                },

                description: {
                    tr: description || current.advanced?.description?.tr || "",
                    en: current.advanced?.description?.en || "",
                },

                tags: tags.length ? tags : current.advanced?.tags || [],

                seo: {
                    ...(typeof current.advanced?.seo === "object" && current.advanced?.seo ? current.advanced.seo : {}),

                    title: {
                        tr: seoTitle || current.advanced?.seo?.title?.tr || finalTitle,
                        en: current.advanced?.seo?.title?.en || "",
                    },

                    description: {
                        tr: seoDescription || current.advanced?.seo?.description?.tr || "",
                        en: current.advanced?.seo?.description?.en || "",
                    },

                    keywords: keywords.length
                        ? keywords
                        : Array.isArray(current.advanced?.seo?.keywords)
                            ? current.advanced.seo.keywords
                            : [],

                    canonical:
                        current.advanced?.seo?.canonical ||
                        (finalSlug ? `/products/${finalSlug}` : ""),

                    ogImage:
                        current.advanced?.seo?.ogImage ||
                        current.image ||
                        current.mainImage ||
                        (Array.isArray(current.images) ? current.images[0] : "") ||
                        "",
                },

                marketing: {
                    ...(typeof current.advanced?.marketing === "object" && current.advanced?.marketing
                        ? current.advanced.marketing
                        : {}),

                    instagramCaption,
                    googleAdsHeadlines,
                    googleAdsDescriptions,
                },
            },
        };

        if (title) {
            updateData.title = finalTitle;
        }

        if (shortDescription) {
            updateData.shortDescription = shortDescription;
        }

        if (description) {
            updateData.description = description;
        }

        if (seoTitle) {
            updateData.seoTitle = seoTitle;
            updateData.metaTitle = seoTitle;
        }

        if (seoDescription) {
            updateData.seoDescription = seoDescription;
            updateData.metaDescription = seoDescription;
        }

        if (tags.length) {
            updateData.tags = tags;
        }

        await ref.set(updateData, { merge: true });

        const updatedSnap = await ref.get();
        const updated = updatedSnap.data() || {};

        return json({
            ok: true,
            message: "SEO güncellendi.",
            productId,
            data: {
                id: productId,
                title:
                    typeof updated.title === "string"
                        ? updated.title
                        : updated.title?.tr || updated.title?.en || finalTitle,
                slug: updated.slug || finalSlug,
                sku: updated.sku || "",
                seoTitle:
                    updated.seoTitle ||
                    updated.metaTitle ||
                    updated.advanced?.seo?.title?.tr ||
                    "",
                seoDescription:
                    updated.seoDescription ||
                    updated.metaDescription ||
                    updated.advanced?.seo?.description?.tr ||
                    "",
                shortDescription:
                    updated.shortDescription ||
                    updated.advanced?.shortDescription?.tr ||
                    "",
                description:
                    updated.description ||
                    updated.advanced?.description?.tr ||
                    "",
                tags:
                    Array.isArray(updated.tags)
                        ? updated.tags
                        : Array.isArray(updated.advanced?.tags)
                            ? updated.advanced.tags
                            : [],
            },
        });
    } catch (error: any) {
        console.error("desktop seo update error:", error);

        return json(
            {
                ok: false,
                error: error?.message || "SEO güncellenemedi.",
            },
            500
        );
    }
}

export async function POST(req: NextRequest, context: RouteContext) {
    return PUT(req, context);
}