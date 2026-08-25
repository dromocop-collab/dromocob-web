import { NextRequest } from "next/server";

export function requireDesktopAdmin(req: NextRequest) {
    const expected = process.env.DESKTOP_ADMIN_TOKEN;

    if (!expected) {
        return {
            ok: false as const,
            status: 500,
            error: "DESKTOP_ADMIN_TOKEN env eksik.",
        };
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    if (!token || token !== expected) {
        return {
            ok: false as const,
            status: 401,
            error: "Yetkisiz erişim. Admin token hatalı veya eksik.",
        };
    }

    return {
        ok: true as const,
    };
}