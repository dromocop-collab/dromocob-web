import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase.admin";
import { FieldValue } from "firebase-admin/firestore";

function generateCouponCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NL";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/newsletter/subscribe
 * Public endpoint — anasayfadaki newsletter strip'ten çağrılır.
 * Abone olunca %5 indirim kuponu oluşturur.
 * - Üye (uid varsa): users/{uid}/wheel_coupons'a eklenir
 * - Misafir (uid yoksa): mail otomatik gider (wheel_leads trigger)
 */
export async function POST(req: NextRequest) {
  try {
    const { email, locale, source } = await req.json();

    const trimmed = String(email || "").trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
    }

    const db = adminDb();
    let safeUid = "";
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (token) {
      try {
        const decoded = await adminAuth().verifyIdToken(token, true);
        const accountEmail = String(decoded.email || "").trim().toLowerCase();
        if (!accountEmail || accountEmail !== trimmed) {
          return NextResponse.json(
            { error: "Abonelik e-postası, giriş yaptığınız hesabın e-postasıyla eşleşmeli." },
            { status: 403 }
          );
        }
        safeUid = decoded.uid;
      } catch {
        return NextResponse.json({ error: "Oturumunuz geçersiz. Lütfen tekrar giriş yapın." }, { status: 401 });
      }
    }

    // Check duplicate
    const existing = await db
      .collection("newsletter_subscribers")
      .where("email", "==", trimmed)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Zaten abone — mevcut kupon kodunu bul ve dön
      const subDoc = existing.docs[0];
      const subData = subDoc.data();
      const couponCode = subData?.couponCode || "";

      // Üye girişi varsa, kuponu profiline de ekle (önceden misafir olarak abone olmuş olabilir)
      if (safeUid && couponCode) {
        const couponRef = db
          .collection("users")
          .doc(safeUid)
          .collection("wheel_coupons")
          .doc(couponCode);

        const couponSnap = await couponRef.get();
        if (!couponSnap.exists) {
          await couponRef.set({
            code: couponCode,
            label: "%5 İndirim",
            status: "active",
            discountType: "percent",
            discountValue: 5,
            campaignTitle: "Newsletter Abonelik",
            source: "newsletter",
            expiresAt: subData?.expiresAt || null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // Newsletter subscriber doc'una da uid'yi güncelle
        if (!subData?.uid) {
          await subDoc.ref.update({ uid: safeUid });
        }
      }

      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        couponCode,
        message: "Zaten abone.",
      });
    }

    // Kupon kodu oluştur
    const couponCode = generateCouponCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 gün geçerli



    // Üye adını al (varsa)
    let fullName = "";
    if (safeUid) {
      try {
        const userDoc = await db.doc(`users/${safeUid}`).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        fullName = String(
          userData?.displayName || userData?.fullName || userData?.firstName || ""
        ).trim();
      } catch {
        // ignore
      }
    }

    // Newsletter subscriber kaydet
    await db.collection("newsletter_subscribers").add({
      email: trimmed,
      locale: locale || "tr",
      source: source || "homepage",
      couponCode,
      expiresAt,
      uid: safeUid || null,
      subscribedAt: FieldValue.serverTimestamp(),
    });

    // wheel_leads'e kupon ekle (checkout verifyGuestWheelCoupon ile doğrulanabilir)
    // Bu kayıt sendWheelCouponMail trigger'ını çalıştırır ve kuponu e-postayla gönderir.
    await db.collection("wheel_leads").add({
      email: trimmed,
      fullName: fullName || "Değerli müşterimiz",
      couponCode,
      couponStatus: "active",
      rewardLabel: "%5 İndirim",
      campaignTitle: "Newsletter Abonelik",
      discountType: "percent",
      discountValue: 5,
      expiresAt,
      source: "newsletter",
      uid: safeUid || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Üye girişi yapılmışsa profildeki kuponlarıma da ekle
    if (safeUid) {
      await db
        .collection("users")
        .doc(safeUid)
        .collection("wheel_coupons")
        .doc(couponCode)
        .set({
          code: couponCode,
          label: "%5 İndirim",
          status: "active",
          discountType: "percent",
          discountValue: 5,
          campaignTitle: "Newsletter Abonelik",
          source: "newsletter",
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({
      success: true,
      alreadySubscribed: false,
      couponCode,
    });
  } catch (err: any) {
    console.error("newsletter subscribe error:", err);
    return NextResponse.json({ error: err?.message || "Hata oluştu." }, { status: 500 });
  }
}
