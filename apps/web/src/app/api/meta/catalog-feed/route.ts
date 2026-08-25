import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductDoc = {
    title?: any;
    name?: any;
    description?: any;
    shortDescription?: any;
    slug?: string;
    sku?: string;
    image?: string;
    imageUrl?: string;
    mainImage?: string;
    coverImage?: string;
    thumbnail?: string;
    gallery?: any;
    images?: any;
    price?: number;
    finalPrice?: number;
    oldPriceTry?: number;
    stock?: number;
    isActive?: boolean;
    status?: string;
    categoryName?: any;
    categoryNames?: any[];
    brand?: string;
    updatedAt?: any;
};

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://demo.dromocob.com";

const BRAND_NAME = "Dromocob";

function cleanText(value: any, fallback = ""): string {
    if (typeof value === "string") return value.trim();

    if (value && typeof value === "object") {
        return String(
            value.tr ||
            value.en ||
            value.title ||
            value.name ||
            value.text ||
            fallback ||
            ""
        ).trim();
    }

    return String(value || fallback || "").trim();
}

function stripHtml(value: any): string {
    return cleanText(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function csvEscape(value: any): string {
    const text = String(value ?? "")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function toNumber(value: any, fallback = 0): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

    const raw = String(value ?? "").trim();
    if (!raw) return fallback;

    let normalized = raw.replace(/\s/g, "");

    if (normalized.includes(".") && normalized.includes(",")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
}

function absoluteUrl(value: any): string {
    const raw = cleanText(value);
    if (!raw) return "";

    if (raw.startsWith("http://")) return raw.replace(/^http:\/\//i, "https://");
    if (raw.startsWith("https://")) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;

    if (raw.startsWith("/")) {
        return `${SITE_URL.replace(/\/$/, "")}${raw}`;
    }

    return raw;
}

function pickImage(product: ProductDoc): string {
    const direct =
        product.image ||
        product.imageUrl ||
        product.mainImage ||
        product.coverImage ||
        product.thumbnail;

    if (direct) return absoluteUrl(direct);

    if (Array.isArray(product.images) && product.images.length) {
        const first = product.images[0];
        if (typeof first === "string") return absoluteUrl(first);
        return absoluteUrl(first?.url || first?.src || first?.image || "");
    }

    if (Array.isArray(product.gallery) && product.gallery.length) {
        const first = product.gallery[0];
        if (typeof first === "string") return absoluteUrl(first);
        return absoluteUrl(first?.url || first?.src || first?.image || "");
    }

    return "";
}

function pickTitle(product: ProductDoc, id: string): string {
    return cleanText(product.title || product.name, `Dromocob Ürünü ${id}`);
}

function pickDescription(product: ProductDoc, title: string): string {
    const desc = stripHtml(product.description || product.shortDescription);

    if (desc.length >= 20) return desc.slice(0, 5000);

    return `${title} modeli, Dromocob güvencesiyle sunulan zarif ve modern e-ticaret ürünüdür.`;
}

function pickCategory(product: ProductDoc): string {
    if (Array.isArray(product.categoryNames) && product.categoryNames.length) {
        return product.categoryNames.map((x) => cleanText(x)).filter(Boolean).join(" > ");
    }

    return cleanText(product.categoryName, "tasarım ürünleri");
}

function pickPrice(product: ProductDoc): number {
    const finalPrice = toNumber(product.finalPrice, 0);
    if (finalPrice > 0) return finalPrice;

    const price = toNumber(product.price, 0);
    if (price > 0) return price;

    return 0;
}

function isProductActive(product: ProductDoc): boolean {
    if (product.isActive === false) return false;

    const status = cleanText(product.status).toLowerCase();
    if (["draft", "deleted", "archived", "passive", "inactive"].includes(status)) {
        return false;
    }

    return true;
}

function productLink(product: ProductDoc, id: string): string {
    const slug = cleanText(product.slug);

    if (slug) {
        return `${SITE_URL.replace(/\/$/, "")}/products/${encodeURIComponent(slug)}`;
    }

    return `${SITE_URL.replace(/\/$/, "")}/products/id/${encodeURIComponent(id)}`;
}

export async function GET() {
    try {
        const db = adminDb();

        const snap = await db.collection("products").limit(5000).get();

        const headers = [
            "id",
            "title",
            "description",
            "availability",
            "condition",
            "price",
            "link",
            "image_link",
            "brand",
            "google_product_category",
            "product_type",
            "custom_label_0",
            "custom_label_1",
            "inventory",
        ];

        const rows: string[][] = [];

        snap.forEach((doc) => {
            const product = doc.data() as ProductDoc;
            const id = doc.id;

            if (!isProductActive(product)) return;

            const title = pickTitle(product, id);
            const description = pickDescription(product, title);
            const image = pickImage(product);
            const price = pickPrice(product);
            const stock = Math.max(0, Math.floor(toNumber(product.stock, 0)));
            const category = pickCategory(product);

            if (!title || !image || price <= 0) return;

            const availability = stock > 0 ? "in stock" : "out of stock";

            rows.push([
                cleanText(product.sku || id),
                title,
                description,
                availability,
                "new",
                `${price.toFixed(2)} TRY`,
                productLink(product, id),
                image,
                cleanText(product.brand, BRAND_NAME),
                "Apparel & Accessories > lifestyle",
                category,
                availability === "in stock" ? "stokta" : "stok_yok",
                price >= 50000 ? "premium" : price >= 15000 ? "orta_segment" : "giris_segment",
                String(stock),
            ]);
        });

        const csv = [
            headers.map(csvEscape).join(","),
            ...rows.map((row) => row.map(csvEscape).join(",")),
        ].join("\n");

        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Cache-Control": "public, max-age=900, s-maxage=900",
                "Content-Disposition": 'inline; filename="meta-catalog-feed.csv"',
            },
        });
    } catch (error: any) {
        console.error("Meta catalog feed error:", error);

        return NextResponse.json(
            {
                ok: false,
                error: error?.message || "Meta katalog feed oluşturulamadı.",
            },
            { status: 500 }
        );
    }
}