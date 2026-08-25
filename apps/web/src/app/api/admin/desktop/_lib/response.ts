import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
    return NextResponse.json(
        {
            ok: true,
            data,
        },
        { status }
    );
}

export function fail(error: unknown, status = 400) {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : "Bilinmeyen hata";

    return NextResponse.json(
        {
            ok: false,
            error: message,
        },
        { status }
    );
}