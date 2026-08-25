import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase.admin";

/**
 * Doğrulanmış admin kullanıcı bilgisi.
 */
export type VerifiedAdmin = {
  uid: string;
  email: string | null;
  role: "admin" | "sub_admin";
};

/**
 * API Route için admin kimlik doğrulama.
 *
 * 1. Authorization: Bearer <idToken> header'ından token alır
 * 2. Firebase Admin SDK ile token'ı doğrular
 * 3. Custom claims VEYA Firestore'dan admin rolünü kontrol eder
 * 4. Admin değilse 401/403 döner
 *
 * Kullanım:
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const authResult = await verifyAdmin(req);
 *   if (authResult instanceof NextResponse) return authResult; // hata
 *   // authResult = { uid, email, role }
 * }
 * ```
 */
export async function verifyAdmin(
  req: NextRequest
): Promise<VerifiedAdmin | NextResponse> {
  try {
    // 1) Token'ı header'dan al
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Yetkilendirme başlığı eksik. Authorization: Bearer <token> gerekli.",
          code: "AUTH_MISSING",
        },
        { status: 401 }
      );
    }

    // 2) Token'ı doğrula
    const auth = adminAuth();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(token, true); // checkRevoked = true
    } catch (err: any) {
      const code = err?.code || "";
      const isExpired = code.includes("expired");
      const isRevoked = code.includes("revoked");

      return NextResponse.json(
        {
          ok: false,
          error: isExpired
            ? "Oturum süresi dolmuş. Tekrar giriş yapın."
            : isRevoked
            ? "Oturum iptal edilmiş. Tekrar giriş yapın."
            : "Geçersiz token.",
          code: isExpired
            ? "TOKEN_EXPIRED"
            : isRevoked
            ? "TOKEN_REVOKED"
            : "TOKEN_INVALID",
        },
        { status: 401 }
      );
    }

    const uid = decoded.uid;
    const email = decoded.email || null;

    if (
      decoded.email_verified === true &&
      String(email || "").trim().toLowerCase() === "zerayakkabi@gmail.com"
    ) {
      return { uid, email, role: "admin" };
    }

    // 3) Admin rolünü kontrol et

    // 3a) Custom claims'den kontrol
    const claims = decoded as Record<string, any>;
    const claimRole = String(claims?.role || "").trim();
    const claimAdmin = claims?.admin === true;
    const claimRoles = Array.isArray(claims?.roles) ? claims.roles : [];

    if (
      claimAdmin ||
      claimRole === "admin" ||
      claimRole === "sub_admin" ||
      claimRoles.includes("admin") ||
      claimRoles.includes("sub_admin")
    ) {
      const role =
        claimRole === "admin" || claimAdmin || claimRoles.includes("admin")
          ? "admin"
          : "sub_admin";
      return { uid, email, role } as VerifiedAdmin;
    }

    // 3b) Firestore admins/{email}.enabled (legacy)
    const db = adminDb();
    const emailLower = (email || "").toLowerCase();

    if (emailLower) {
      const adminSnap = await db.collection("admins").doc(emailLower).get();
      if (adminSnap.exists && adminSnap.data()?.enabled === true) {
        return { uid, email, role: "admin" } as VerifiedAdmin;
      }
    }

    // 3c) Firestore users/{uid}.role
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() as Record<string, any>;
      const userRole = String(userData?.role || "").trim();
      const isActive = userData?.isActive !== false;

      if (userRole === "admin" && isActive) {
        return { uid, email, role: "admin" } as VerifiedAdmin;
      }
      if (userRole === "sub_admin" && isActive) {
        return { uid, email, role: "sub_admin" } as VerifiedAdmin;
      }
    }

    // 4) Admin değil → 403
    return NextResponse.json(
      {
        ok: false,
        error: "Bu işlem için admin yetkisi gerekli.",
        code: "FORBIDDEN",
        uid,
      },
      { status: 403 }
    );
  } catch (err: any) {
    console.error("[verifyAdmin] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Kimlik doğrulama sırasında hata oluştu.",
        code: "AUTH_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * API Route için kullanıcı kimlik doğrulama (admin olmak zorunda değil).
 * Giriş yapmış herhangi bir kullanıcı yeterli.
 */
export async function verifyUser(
  req: NextRequest
): Promise<{ uid: string; email: string | null } | NextResponse> {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Giriş yapmanız gerekli.", code: "AUTH_MISSING" },
        { status: 401 }
      );
    }

    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz oturum.", code: "TOKEN_INVALID" },
      { status: 401 }
    );
  }
}
