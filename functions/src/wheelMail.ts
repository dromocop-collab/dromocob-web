import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

function buildNewsletterMailHtml(fullName: string, couponCode: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f8f5ef;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eee4d2;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(180deg,#fffdf9 0%,#fff8ef 100%);padding:28px 24px 20px;text-align:center;border-bottom:1px solid #f1e8da;">
      <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#f5ead7;color:#b98c3c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
        Dromocob
      </div>
      <h2 style="margin:16px 0 8px;font-size:28px;line-height:1.2;color:#1d2433;font-weight:800;">
        Hoş geldin, indirim kodun hazır! 🎁
      </h2>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#6b7280;">
        Bültenimize abone olduğun için teşekkür ederiz.
      </p>
    </div>

    <div style="padding:28px 24px 18px;">
      <p style="margin:0 0 16px;font-size:16px;color:#374151;">
        Merhaba ${fullName},
      </p>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#4b5563;">
        Bültenimize abone oldun ve ilk siparişinde kullanabileceğin <strong>%5 indirim</strong> kuponu kazandın!
      </p>

      <div style="text-align:center;margin:0 0 26px;">
        <div style="display:inline-block;min-width:240px;padding:18px 24px;border-radius:16px;background:#fff8ef;border:1px solid #ead7b5;">
          <div style="font-size:12px;line-height:1;margin-bottom:10px;color:#b98c3c;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
            İndirim Kodun
          </div>
          <div style="font-size:30px;font-weight:800;letter-spacing:2px;color:#111827;">
            ${couponCode}
          </div>
        </div>
      </div>

      <div style="margin:0 0 22px;padding:16px 18px;background:#fcfaf6;border:1px solid #efe6d8;border-radius:14px;">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
          Bu kuponu ödeme sayfasında "Kupon Kodu" alanına girerek kullanabilirsin. Kupon 30 gün süreyle geçerlidir.
        </p>
      </div>

      <div style="text-align:center;margin:0 0 20px;">
        <a href="https://dromocob.tr" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#d9aa42,#b98c3c);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          Alışverişe Başla →
        </a>
      </div>
    </div>

    <div style="padding:18px 24px 24px;text-align:center;border-top:1px solid #f1e8da;background:#fffdfa;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1f2937;">
        Dromocob
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
      </p>
    </div>

  </div>
</div>
`;
}

function buildWheelMailHtml(
  fullName: string,
  couponCode: string,
  rewardLabel: string,
  campaignTitle: string,
  expiryText: string
): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f8f5ef;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eee4d2;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(180deg,#fffdf9 0%,#fff8ef 100%);padding:28px 24px 20px;text-align:center;border-bottom:1px solid #f1e8da;">
      <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#f5ead7;color:#b98c3c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
        Dromocob
      </div>
      <h2 style="margin:16px 0 8px;font-size:28px;line-height:1.2;color:#1d2433;font-weight:800;">
        Tebrikler, kuponun hazır
      </h2>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#6b7280;">
        Şans çarkından kazandığın kupon kodun aşağıda seni bekliyor.
      </p>
    </div>

    <div style="padding:28px 24px 18px;">
      <p style="margin:0 0 16px;font-size:16px;color:#374151;">
        Merhaba ${escapeHtml(fullName)},
      </p>

      <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#4b5563;">
        <strong>${escapeHtml(campaignTitle)}</strong> kampanyasında kazandığın ödül:
        <strong>${escapeHtml(rewardLabel)}</strong>
      </p>

      <div style="text-align:center;margin:0 0 26px;">
        <div style="display:inline-block;min-width:240px;padding:18px 24px;border-radius:16px;background:#fff8ef;border:1px solid #ead7b5;">
          <div style="font-size:12px;line-height:1;margin-bottom:10px;color:#b98c3c;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
            Kupon Kodun
          </div>
          <div style="font-size:30px;font-weight:800;letter-spacing:2px;color:#111827;">
            ${escapeHtml(couponCode)}
          </div>
        </div>
      </div>

      <div style="margin:0 0 22px;padding:16px 18px;background:#fcfaf6;border:1px solid #efe6d8;border-radius:14px;">
        <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
          Bu kuponu ödeme ekranında kullanabilirsin. Son kullanım tarihi: <strong>${escapeHtml(expiryText)}</strong>.
          Kampanya koşulları sipariş tutarına göre değişebilir.
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6b7280;">
        Seni mağazamızda da bekliyoruz. Güzel denk geldi, kader çarkı biraz sana çalışmış.
      </p>
    </div>

    <div style="padding:18px 24px 24px;text-align:center;border-top:1px solid #f1e8da;background:#fffdfa;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1f2937;">
        Dromocob
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
      </p>
    </div>

  </div>
</div>
`;
}

function escapeHtml(value: string): string {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char] || char));
}

function formatExpiry(value: any): string {
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return "kampanya koşullarında belirtilen tarih";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export const sendWheelCouponMail = onDocumentCreated(
  {
    region: "europe-west1",
    document: "wheel_leads/{leadId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() || {};

    const email = String(data.email || "").trim().toLowerCase();
    const fullName = String(data.fullName || "Değerli müşterimiz").trim();
    const couponCode = String(data.couponCode || "").trim();
    const rewardLabel = String(data.rewardLabel || "").trim();
    const campaignTitle = String(data.campaignTitle || "Dromocob Şans Çarkı").trim();
    const source = String(data.source || "").trim();
    const expiryText = formatExpiry(data.expiresAt);

    if (!email || !couponCode) {
      logger.warn("wheel mail skipped: missing email or couponCode", {
        leadId: snap.id,
        email,
        couponCode,
      });
      return;
    }

    // Aynı lead için tekrar tekrar mail atmasın
    if (data.mailSent === true) {
      logger.info("wheel mail already sent, skipping", { leadId: snap.id, email });
      return;
    }

    // Newsletter kaynaklı ise farklı template ve subject
    const isNewsletter = source === "newsletter";
    const subject = isNewsletter
      ? "Dromocob | %5 İndirim Kodunuz Hazır 🎁"
      : "Dromocob | Şans Çarkı Kuponun Hazır";
    const html = isNewsletter
      ? buildNewsletterMailHtml(fullName, couponCode)
      : buildWheelMailHtml(fullName, couponCode, rewardLabel, campaignTitle, expiryText);

    await admin.firestore().collection("mail").add({
      to: email,
      from: "Dromocob <no-reply@dromocob.com>",
      message: {
        subject,
        html,
      },
    });

    await snap.ref.set(
      {
        mailSent: true,
        mailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("coupon mail queued", {
      leadId: snap.id,
      email,
      couponCode,
      source,
    });
  }
);
