import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/newsletter/send
 *
 * Firebase "Trigger Email from Firestore" extension kullanarak
 * toplu newsletter mail gönderimi.
 *
 * Extension, `mail` koleksiyonuna yazılan dokümanları otomatik olarak
 * SMTP üzerinden gönderir. Nodemailer'a gerek yok.
 */
export async function POST(req: NextRequest) {
  try {
    const { subject, body, template, recipients } = await req.json();

    if (!subject || !body || !Array.isArray(recipients) || !recipients.length) {
      return NextResponse.json(
        { error: "subject, body ve recipients gereklidir." },
        { status: 400 }
      );
    }

    const db = adminDb();

    // WhatsApp numarasını Firestore'dan oku (admin paneldeki merkezi ayar)
    let waNumber = "905078482448";
    try {
      const settingsSnap = await db.doc("settings/site").get();
      const settingsData = settingsSnap.data() as any;
      const wa = String(settingsData?.site?.contact?.whatsapp || "").trim();
      if (wa) waNumber = wa;
    } catch {
      // fallback'te kal
    }

    const _brandColor = "#d4af37"; // eslint-disable-line @typescript-eslint/no-unused-vars
    const html = `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">

<!-- Outer wrapper -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f0e8">
  <tr>
    <td align="center" style="padding:32px 16px">

      <!-- Main container -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:#0f1728;padding:0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <!-- Gold accent line -->
              <tr><td style="height:4px;background:linear-gradient(90deg,#b8941f,#d4af37,#e6c874,#d4af37,#b8941f);font-size:0;line-height:0">&nbsp;</td></tr>
              <!-- Logo area -->
              <tr>
                <td align="center" style="padding:36px 32px 8px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="width:56px;height:56px;border-radius:50%;background:#d4af37;text-align:center;vertical-align:middle">
                        <span style="font-size:18px;font-weight:900;color:#0f1728;font-family:Georgia,serif;line-height:56px">6'ncı</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Brand name -->
              <tr>
                <td align="center" style="padding:12px 32px 4px">
                  <span style="font-size:13px;font-weight:700;color:#d4af37;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif">DROMOCOB</span>
                </td>
              </tr>
              <!-- Subject -->
              <tr>
                <td align="center" style="padding:8px 32px 36px">
                  <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;font-family:Georgia,'Times New Roman',serif;line-height:1.3">${subject}</h1>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ BODY ═══ -->
        <tr>
          <td style="background:#ffffff;padding:40px 36px 32px">
            <!-- Greeting -->
            <p style="margin:0 0 8px;font-size:15px;color:#b8941f;font-weight:700;font-family:Arial,sans-serif">Merhaba,</p>
            <!-- Content -->
            <p style="margin:0 0 28px;font-size:16px;line-height:1.85;color:#333333;font-family:Georgia,'Times New Roman',serif;white-space:pre-wrap">${body}</p>
            <!-- Divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e5ddd0,transparent);font-size:0;line-height:0">&nbsp;</td></tr>
            </table>
            <!-- CTA Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="border-radius:10px;background:linear-gradient(135deg,#d4af37,#b8941f);padding:1px">
                        <a href="https://demo.dromocob.com/shop" target="_blank" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#d4af37,#b8941f);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;font-family:Arial,sans-serif;letter-spacing:0.5px">MAĞAZAYA GİT &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="background:#faf7f2;padding:28px 36px;border-top:1px solid #ede8df">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <!-- Social links placeholder -->
              <tr>
                <td align="center" style="padding-bottom:16px">
                  <a href="https://instagram.com/dromocob" target="_blank" style="display:inline-block;margin:0 8px;color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;font-family:Arial,sans-serif">Instagram</a>
                  <span style="color:#d4cfc6">&bull;</span>
                  <a href="https://demo.dromocob.com" target="_blank" style="display:inline-block;margin:0 8px;color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;font-family:Arial,sans-serif">Web Site</a>
                  <span style="color:#d4cfc6">&bull;</span>
                  <a href="https://wa.me/${waNumber}" target="_blank" style="display:inline-block;margin:0 8px;color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;font-family:Arial,sans-serif">WhatsApp</a>
                </td>
              </tr>
              <!-- Address -->
              <tr>
                <td align="center" style="padding-bottom:8px">
                  <p style="margin:0;font-size:12px;color:#999;font-family:Arial,sans-serif;line-height:1.6">Bizim Dromocob<br>İstanbul &bull; Türkiye</p>
                </td>
              </tr>
              <!-- Unsubscribe -->
              <tr>
                <td align="center">
                  <p style="margin:0;font-size:11px;color:#bbb;font-family:Arial,sans-serif">Bu e-postayı aldınız çünkü bültenimize abone oldunuz.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Gold bottom accent -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#b8941f,#d4af37,#e6c874,#d4af37,#b8941f);font-size:0;line-height:0">&nbsp;</td></tr>

      </table>
      <!-- /Main container -->

    </td>
  </tr>
</table>
<!-- /Outer wrapper -->

</body>
</html>`;

    // Trigger Email extension: `mail` koleksiyonuna doküman yaz
    // Extension BCC destekler — 50'lik batch'ler halinde gönder
    const batchSize = 50;
    const batches: Promise<any>[] = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      batches.push(
        db.collection("mail").add({
          bcc: batch,
          message: {
            subject,
            html,
          },
          createdAt: FieldValue.serverTimestamp(),
        })
      );
    }

    // Kampanyayı kaydet
    batches.push(
      db.collection("newsletter_campaigns").add({
        subject: subject.trim(),
        template,
        body: body.trim(),
        recipientCount: recipients.length,
        recipients,
        status: "sent",
        createdAt: FieldValue.serverTimestamp(),
      })
    );

    await Promise.all(batches);

    return NextResponse.json({
      success: true,
      sentCount: recipients.length,
      message: `${recipients.length} alıcıya mail gönderimi tetiklendi.`,
    });
  } catch (err: any) {
    console.error("Newsletter send error:", err);
    return NextResponse.json(
      { error: err?.message || "Mail gönderilirken hata oluştu." },
      { status: 500 }
    );
  }
}
