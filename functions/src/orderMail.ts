import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp();
}

type MailType = "order_created" | "order_shipped" | "order_delivered" | "order_cancelled" | "order_refunded";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function escapeHtml(v: unknown) {
  return safeStr(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(v: unknown) {
  const raw = safeStr(v);
  if (!raw) return "";

  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return raw;
    return "";
  } catch {
    return "";
  }
}

function pickText(v: any, locale: "tr" | "en" = "tr") {
  if (!v) return "";

  if (typeof v === "string") return safeStr(v);

  if (typeof v === "object") {
    return (
      safeStr(v[locale]) ||
      safeStr(v.tr) ||
      safeStr(v.en) ||
      safeStr(v.title) ||
      safeStr(v.label) ||
      ""
    );
  }

  return "";
}

function formatTRY(amount: any) {
  const n =
    amount && typeof amount === "object"
      ? toNum(amount.amount, 0)
      : toNum(amount, 0);

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₺${n.toFixed(2)}`;
  }
}

function getOrderEmail(order: any) {
  return (
    safeStr(order?.customer?.email) ||
    safeStr(order?.email) ||
    safeStr(order?.shippingAddress?.email) ||
    ""
  ).toLowerCase();
}

function getCustomerName(order: any) {
  const shipping = order?.shippingAddress || {};
  const customer = order?.customer || {};

  const fullName = safeStr(shipping.fullName);
  const customerName = `${safeStr(customer.firstName)} ${safeStr(customer.lastName)}`.trim();
  const shippingName = `${safeStr(shipping.firstName)} ${safeStr(shipping.lastName)}`.trim();

  return fullName || customerName || shippingName || "Değerli müşterimiz";
}

function getPaymentLabel(order: any) {
  const provider = safeStr(order?.payment?.provider).toLowerCase();
  const method = safeStr(order?.payment?.method).toLowerCase();

  if (provider === "paytr" || method === "card") return "Kredi / Banka Kartı";
  if (provider === "manual" || method === "transfer") return "Havale / EFT";

  return "Ödeme";
}

function getAddress(order: any) {
  const a = order?.shippingAddress || {};

  return [
    safeStr(a.addressLine),
    safeStr(a.district),
    safeStr(a.city),
    safeStr(a.postalCode),
  ]
    .filter(Boolean)
    .join(" / ");
}

function getTrackingNo(order: any) {
  return (
    safeStr(order?.trackingNumber) ||
    safeStr(order?.shippingTrackingNumber) ||
    safeStr(order?.shipping?.trackingNumber) ||
    safeStr(order?.shipment?.trackingNumber) ||
    safeStr(order?.shipping?.trackingNo) ||
    safeStr(order?.shipment?.trackingNo) ||
    ""
  );
}

function getTrackingUrl(order: any) {
  return safeUrl(
    safeStr(order?.trackingUrl) ||
      safeStr(order?.shippingTrackingUrl) ||
      safeStr(order?.shipping?.trackingUrl) ||
      safeStr(order?.shipment?.trackingUrl) ||
      ""
  );
}

function getCargoCompany(order: any) {
  return (
    safeStr(order?.shippingProvider) ||
    safeStr(order?.cargoCompany) ||
    safeStr(order?.shipping?.provider) ||
    safeStr(order?.shipment?.provider) ||
    "Kargo"
  );
}

function getInvoiceUrl(order: any) {
  return safeUrl(
    safeStr(order?.invoiceUrl) ||
      safeStr(order?.invoice?.url) ||
      safeStr(order?.billing?.invoiceUrl) ||
      safeStr(order?.eInvoiceUrl) ||
      ""
  );
}

function getOrderViewUrl(orderId: string) {
  const base =
    safeStr(process.env.PUBLIC_SITE_URL) ||
    safeStr(process.env.NEXT_PUBLIC_SITE_URL) ||
    safeStr(process.env.APP_URL) ||
    "";

  if (!base) return "";

  try {
    const u = new URL(`/account/orders/${encodeURIComponent(orderId)}`, base);
    return u.toString();
  } catch {
    return "";
  }
}
function isRingSizeVariant(v: any) {
  const hay = [
    v?.groupId,
    v?.groupLabel,
    v?.label,
    v?.value,
  ]
    .map((x) => safeStr(x).toLocaleLowerCase("tr-TR"))
    .join(" ");

  return (
    hay.includes("ring_size") ||
    hay.includes("yüzük") ||
    hay.includes("yuzuk") ||
    hay.includes("ölçü") ||
    hay.includes("olcu") ||
    hay.includes("ring size")
  );
}

function getItemLineTotal(item: any, qty: number) {
  const directLine =
    item?.lineTotal?.amount ??
    item?.lineTotal ??
    item?.lineTry ??
    item?.totalTry;

  const unit =
    item?.unitPrice?.amount ??
    item?.unitPriceTry ??
    item?.resolvedUnitPrice ??
    item?.priceTry ??
    item?.price;

  const line = toNum(directLine, 0);
  if (line > 0) return line;

  return toNum(unit, 0) * qty;
}

function getItemUnitPrice(item: any, qty: number) {
  const directUnit =
    item?.unitPrice?.amount ??
    item?.unitPriceTry ??
    item?.resolvedUnitPrice ??
    item?.priceTry ??
    item?.price;

  const unit = toNum(directUnit, 0);
  if (unit > 0) return unit;

  const line = getItemLineTotal(item, qty);
  return qty > 0 ? line / qty : line;
}
function getItemCustomText(item: any) {
  return (
    safeStr(item?.customText) ||
    safeStr(item?.productCustomText) ||
    safeStr(item?.engravingText) ||
    safeStr(item?.personalizationText) ||
    safeStr(item?.textToWrite)
  ).slice(0, 240);
}
function getItemImage(item: any) {
  return safeUrl(
    safeStr(item?.image) ||
      safeStr(item?.productImage) ||
      safeStr(item?.thumbnail) ||
      safeStr(item?.cover) ||
      safeStr(Array.isArray(item?.images) ? item.images[0] : "")
  );
}
function renderItems(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (!items.length) {
    return `
      <div style="padding:18px;background:#fffdfa;border:1px solid #efe6d8;border-radius:18px;color:#6b7280;font-size:14px;">
        Ürün bilgisi bulunamadı.
      </div>
    `;
  }

  return `
    <div style="border:1px solid #eadfcf;border-radius:22px;overflow:hidden;background:#ffffff;">
      ${items
        .map((item: any, index: number) => {
          const title = escapeHtml(
            pickText(item?.title, "tr") ||
              safeStr(item?.name) ||
              safeStr(item?.sku) ||
              "Ürün"
          );

          const qty = Math.max(1, Math.floor(toNum(item?.qty, 1)));
          const sku = escapeHtml(item?.sku || item?.productSku || item?.productCode);
         const selectedSize = escapeHtml(item?.selectedSize);
const customText = escapeHtml(getItemCustomText(item));

const image = getItemImage(item);
const line = getItemLineTotal(item, qty);
const unit = getItemUnitPrice(item, qty);

          const variantItems = Array.isArray(item?.selectedVariantItems)
            ? item.selectedVariantItems
            : [];

          const visibleVariantItems = variantItems.filter((v: any) => {
            if (isRingSizeVariant(v)) return false;
            const label = safeStr(v?.label || v?.value);
            return Boolean(label);
          });

          const variantHtml = visibleVariantItems.length
            ? `
              <div style="margin-top:10px;">
                ${visibleVariantItems
                  .map((v: any) => {
                    const group = escapeHtml(v?.groupLabel || v?.groupId || "Seçenek");
                    const label = escapeHtml(v?.label || v?.value);

                    return `
                      <span style="display:inline-block;margin:0 6px 6px 0;padding:6px 10px;border-radius:999px;background:#fff7ea;border:1px solid #ead6b2;color:#73521e;font-size:12px;font-weight:700;line-height:1.2;">
                        ${group}: ${label}
                      </span>
                    `;
                  })
                  .join("")}
              </div>
            `
            : "";

          return `
            <div style="
              padding:18px;
              ${index === items.length - 1 ? "" : "border-bottom:1px solid #f0e6d8;"}
              background:${index % 2 === 0 ? "#ffffff" : "#fffdfa"};
            ">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                <tr>
                  <td width="78" valign="top" style="padding-right:14px;">
                    ${
                      image
                        ? `
                          <img src="${image}" alt="${title}" width="66" height="66" style="display:block;width:66px;height:66px;object-fit:cover;border-radius:16px;border:1px solid #eadfcf;background:#f8f5ef;" />
                        `
                        : `
                          <div style="width:66px;height:66px;border-radius:16px;border:1px solid #eadfcf;background:#2b2417;color:#d6b15d;font-size:13px;font-weight:900;letter-spacing:2px;text-align:center;line-height:66px;">
                            DROMOCOB
                          </div>
                        `
                    }
                  </td>

                  <td valign="top" style="padding-right:10px;">
                    <div style="font-size:17px;font-weight:900;color:#111827;line-height:1.35;margin:0 0 8px;">
                      ${title}
                    </div>

                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#6b7280;line-height:1.7;">
                      ${
                        sku
                          ? `
                            <tr>
                              <td style="padding:1px 10px 1px 0;color:#9ca3af;white-space:nowrap;width:88px;">Ürün Kodu</td>
                              <td style="padding:1px 0;color:#374151;font-weight:800;">${sku}</td>
                            </tr>
                          `
                          : ""
                      }

                      <tr>
                        <td style="padding:1px 10px 1px 0;color:#9ca3af;white-space:nowrap;width:88px;">Adet</td>
                        <td style="padding:1px 0;color:#374151;font-weight:800;">${qty}</td>
                      </tr>

                      ${
                        selectedSize
                          ? `
                            <tr>
                              <td style="padding:1px 10px 1px 0;color:#9ca3af;white-space:nowrap;width:88px;">Yüzük Ölçüsü</td>
                              <td style="padding:1px 0;color:#374151;font-weight:800;">${selectedSize}</td>
                            </tr>
                          `
                          : ""
                      }
${
  customText
    ? `
      <tr>
        <td style="padding:1px 10px 1px 0;color:#9ca3af;white-space:nowrap;width:88px;">Yazılacak Metin</td>
        <td style="padding:1px 0;color:#374151;font-weight:900;">“${customText}”</td>
      </tr>
    `
    : ""
}
                      <tr>
                        <td style="padding:1px 10px 1px 0;color:#9ca3af;white-space:nowrap;width:88px;">Birim</td>
                        <td style="padding:1px 0;color:#374151;font-weight:800;">${formatTRY(unit)}</td>
                      </tr>
                    </table>

                    ${variantHtml}
                  </td>

                  <td width="122" valign="top" align="right" style="padding-left:8px;">
                    <div style="display:inline-block;padding:8px 10px;border-radius:14px;background:#111827;color:#f8e7b0;font-size:15px;font-weight:900;white-space:nowrap;">
                      ${formatTRY(line)}
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function giftHtml(order: any) {
  const enabled =
    order?.giftPackage === true ||
    order?.giftWrap === true ||
    order?.packaging?.giftPackage === true ||
    order?.packaging?.giftWrap === true ||
    order?.gift?.enabled === true;

  if (!enabled) return "";

  const note =
    safeStr(order?.giftNote) ||
    safeStr(order?.giftMessage) ||
    safeStr(order?.giftPackageNote) ||
    safeStr(order?.packaging?.note) ||
    safeStr(order?.packaging?.message) ||
    "";

  return `
    <div style="margin:0 0 22px;padding:16px 18px;background:#fffdfa;border:1px solid #f1e8da;border-radius:14px;">
      <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:6px;">Hediye Paketi</div>
      <div style="font-size:14px;color:#6b7280;line-height:1.8;">
        Hediye paketi seçiminiz siparişinize eklenmiştir.
        ${note ? `<br/>Not: <strong>${escapeHtml(note)}</strong>` : ""}
      </div>
    </div>
  `;
}

function baseHtml(params: {
  title: string;
  subtitle: string;
  customerName: string;
  orderId: string;
  order: any;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  extraHtml?: string;
}) {
  const total = formatTRY(params.order?.total);
  const paymentLabel = escapeHtml(getPaymentLabel(params.order));
  const address = escapeHtml(getAddress(params.order));
  const customerName = escapeHtml(params.customerName);
  const orderId = escapeHtml(params.orderId);
  const title = escapeHtml(params.title);
  const subtitle = escapeHtml(params.subtitle);
  const ctaUrl = safeUrl(params.ctaUrl);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;background:#f8f5ef;padding:32px 16px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eee4d2;border-radius:24px;overflow:hidden;box-shadow:0 14px 38px rgba(17,24,39,0.12);">

      <div style="background:#211b12;padding:34px 26px 30px;text-align:center;border-bottom:3px solid #d6b15d;">
        <div style="display:inline-block;padding:9px 18px;border-radius:999px;background:#3a301f;color:#f8e7b0;font-size:12px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;">
          DROMOCOB
        </div>

        <h2 style="margin:20px 0 10px;font-size:30px;line-height:1.18;color:#ffffff;font-weight:900;">
          ${title}
        </h2>

        <p style="margin:0 auto;max-width:480px;font-size:15px;line-height:1.8;color:#e5e7eb;">
          ${subtitle}
        </p>
      </div>

      <div style="padding:28px 26px 20px;background:#ffffff;">
        <p style="margin:0 0 16px;font-size:16px;color:#374151;">
          Merhaba <strong style="color:#111827;">${customerName}</strong>,
        </p>

        ${params.bodyHtml}

        <div style="margin:24px 0;padding:20px;background:#111827;border:1px solid #d6b15d;border-radius:18px;">
          <div style="font-size:12px;color:#f8e7b0;font-weight:900;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:12px;">
            Sipariş Özeti
          </div>

          <div style="font-size:14px;color:#d1d5db;line-height:2;">
            Sipariş No: <strong style="color:#ffffff;">${orderId}</strong><br/>
            Ödeme Yöntemi: <strong style="color:#ffffff;">${paymentLabel}</strong><br/>
            Toplam: <strong style="color:#f8e7b0;font-size:16px;">${total}</strong>
          </div>
        </div>

        <div style="margin:0 0 22px;">
          <div style="font-size:16px;font-weight:900;color:#111827;margin-bottom:10px;">
            Ürünler
          </div>
          ${renderItems(params.order)}
        </div>

        ${giftHtml(params.order)}

        ${
          address
            ? `
          <div style="margin:0 0 22px;padding:17px 18px;background:#fffdfa;border:1px solid #f1e8da;border-radius:16px;">
            <div style="font-size:14px;font-weight:900;color:#111827;margin-bottom:7px;">Teslimat Adresi</div>
            <div style="font-size:14px;color:#6b7280;line-height:1.8;">${address}</div>
          </div>
        `
            : ""
        }

        ${params.extraHtml || ""}

        ${
          ctaUrl
            ? `
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="${ctaUrl}" style="display:inline-block;text-decoration:none;background:#111827;color:#ffffff;padding:14px 24px;border-radius:999px;font-size:14px;font-weight:900;border:1px solid #d6b15d;">
              ${escapeHtml(params.ctaLabel || "Siparişimi Görüntüle")}
            </a>
          </div>
        `
            : ""
        }

        <div style="margin:22px 0 0;padding:16px 18px;background:#fcfaf6;border:1px solid #efe6d8;border-radius:14px;">
          <p style="margin:0;font-size:13px;line-height:1.8;color:#6b7280;">
            Sipariş sürecinizle ilgili her adımda sizi bilgilendireceğiz. Bu e-posta otomatik olarak gönderilmiştir.
          </p>
        </div>
      </div>

      <div style="padding:18px 24px 24px;text-align:center;border-top:1px solid #f1e8da;background:#fffdfa;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:900;color:#1f2937;">
          Dromocob
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
          Güvenli alışveriş • Sigortalı kargo • Premium e-ticaret deneyimi
        </p>
      </div>

    </div>
  </div>
`;
}

async function queueMail(params: {
  orderId: string;
  order: any;
  type: MailType;
  subject: string;
  html: string;
}) {
  const db = admin.firestore();
  const to = getOrderEmail(params.order);

  if (!to || !to.includes("@")) {
    logger.warn("order mail skipped: missing customer email", {
      orderId: params.orderId,
      type: params.type,
      rootEmail: params.order?.email || "",
      customerEmail: params.order?.customer?.email || "",
      shippingEmail: params.order?.shippingAddress?.email || "",
    });
    return;
  }

  const mailId = `${params.type}_${params.orderId}`;
  const mailRef = db.collection("mail").doc(mailId);
  const exists = await mailRef.get();

  if (exists.exists) {
    logger.info("order mail skipped: already queued", {
      orderId: params.orderId,
      type: params.type,
      mailId,
    });
    return;
  }

  await mailRef.create({
    to,
    from: "Dromocob <no-reply@dromocob.com>",
    message: {
      subject: params.subject,
      html: params.html,
    },
    orderId: params.orderId,
    type: params.type,
    status: "queued",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });

  logger.info("order mail queued", {
    orderId: params.orderId,
    type: params.type,
    to,
  });
}

export const sendOrderCreatedMail = onDocumentCreated(
  {
    region: "europe-west1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const orderId = safeStr(event.params.orderId);
    const order = snap.data() || {};
    if (!orderId) return;

    const customerName = getCustomerName(order);

    const method = safeStr(order?.payment?.method).toLowerCase();
    const provider = safeStr(order?.payment?.provider).toLowerCase();
    const paymentStatus = safeStr(order?.paymentStatus).toLowerCase();
    const orderStatus = safeStr(order?.status).toLowerCase();

    const isCard = provider === "paytr" || method === "card";
    const isPaid = paymentStatus === "paid" || orderStatus === "paid";

    const title = isCard || isPaid ? "Siparişiniz Alındı" : "Havale Siparişiniz Oluşturuldu";

    const subtitle =
      isCard || isPaid
        ? "Ödemeniz başarıyla alındı. Siparişiniz hazırlık sürecine aktarılacaktır."
        : "Siparişiniz oluşturuldu. Havale/EFT ödemeniz sonrası hazırlık süreci başlayacaktır.";

    const bodyHtml =
      isCard || isPaid
        ? `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
            Siparişinizi aldık. Ürünleriniz özenle kontrol edilip hazırlanacaktır.
          </p>
        `
        : `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
            Havale/EFT siparişiniz oluşturuldu. Ödeme açıklamasına sipariş numaranızı yazarak işlemi tamamlayabilirsiniz.
          </p>
        `;

    const html = baseHtml({
      title,
      subtitle,
      customerName,
      orderId,
      order,
      bodyHtml,
      ctaLabel: "Siparişimi Görüntüle",
      ctaUrl: getOrderViewUrl(orderId),
    });

    await queueMail({
      orderId,
      order,
      type: "order_created",
      subject: `${title} - ${orderId}`,
      html,
    });
  }
);

export const sendOrderShippedMail = onDocumentUpdated(
  {
    region: "europe-west1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    const orderId = safeStr(event.params.orderId);
    if (!orderId) return;

    const beforeStatus = safeStr(before?.status).toLowerCase();
    const afterStatus = safeStr(after?.status).toLowerCase();

    if (beforeStatus === afterStatus) return;
    if (afterStatus !== "shipped") return;

    const customerName = getCustomerName(after);
    const cargoCompany = escapeHtml(getCargoCompany(after));
    const trackingNo = escapeHtml(getTrackingNo(after));
    const trackingUrl = getTrackingUrl(after);

    const extraHtml = `
      <div style="margin:0 0 22px;padding:16px 18px;background:#fffdfa;border:1px solid #f1e8da;border-radius:14px;">
        <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:6px;">Kargo Bilgisi</div>
        <div style="font-size:14px;color:#6b7280;line-height:1.8;">
          Kargo Firması: <strong>${cargoCompany}</strong><br/>
          ${trackingNo ? `Takip No: <strong>${trackingNo}</strong><br/>` : ""}
          ${
            trackingUrl
              ? `<a href="${trackingUrl}" style="color:#b98c3c;font-weight:800;text-decoration:none;">Kargomu takip et</a>`
              : ""
          }
        </div>
      </div>
    `;

    const html = baseHtml({
      title: "Siparişiniz Kargoya Verildi",
      subtitle: "Siparişiniz güvenli şekilde kargoya teslim edildi.",
      customerName,
      orderId,
      order: after,
      bodyHtml: `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
          Güzel haber: siparişiniz paketlendi ve kargoya teslim edildi.
        </p>
      `,
      extraHtml,
      ctaLabel: trackingUrl ? "Kargomu Takip Et" : "Siparişimi Görüntüle",
      ctaUrl: trackingUrl || getOrderViewUrl(orderId),
    });

    await queueMail({
      orderId,
      order: after,
      type: "order_shipped",
      subject: `Siparişiniz Kargoya Verildi - ${orderId}`,
      html,
    });
  }
);

export const sendOrderDeliveredMail = onDocumentUpdated(
  {
    region: "europe-west1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    const orderId = safeStr(event.params.orderId);
    if (!orderId) return;

    const beforeStatus = safeStr(before?.status).toLowerCase();
    const afterStatus = safeStr(after?.status).toLowerCase();

    if (beforeStatus === afterStatus) return;
    if (afterStatus !== "delivered") return;

    const customerName = getCustomerName(after);
    const invoiceUrl = getInvoiceUrl(after);

    const extraHtml = invoiceUrl
      ? `
        <div style="margin:0 0 22px;padding:16px 18px;background:#fffdfa;border:1px solid #f1e8da;border-radius:14px;">
          <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:6px;">Fatura</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.8;">
            Ürününüz teslim edildi. Faturanızı aşağıdaki bağlantıdan görüntüleyebilirsiniz.
            <br/>
            <a href="${invoiceUrl}" style="color:#b98c3c;font-weight:800;text-decoration:none;">Faturayı Görüntüle</a>
          </div>
        </div>
      `
      : `
        <div style="margin:0 0 22px;padding:16px 18px;background:#fffdfa;border:1px solid #f1e8da;border-radius:14px;">
          <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:6px;">Teslimat Tamamlandı</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.8;">
            Siparişiniz teslim edildi. Fatura bilgisi sisteme eklendiğinde hesabınızdan görüntüleyebilirsiniz.
          </div>
        </div>
      `;

    const html = baseHtml({
      title: "Siparişiniz Teslim Edildi",
      subtitle: "Güzel günlerde kullanmanız dileğiyle.",
      customerName,
      orderId,
      order: after,
      bodyHtml: `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
          Siparişiniz teslim edildi. Dromocob’u tercih ettiğiniz için teşekkür ederiz.
        </p>
      `,
      extraHtml,
      ctaLabel: invoiceUrl ? "Faturayı Görüntüle" : "Siparişimi Görüntüle",
      ctaUrl: invoiceUrl || getOrderViewUrl(orderId),
    });

    await queueMail({
      orderId,
      order: after,
      type: "order_delivered",
      subject: `Siparişiniz Teslim Edildi - ${orderId}`,
      html,
    });
  }
);

export const sendOrderCancelledMail = onDocumentUpdated(
  {
    region: "europe-west1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    const orderId = safeStr(event.params.orderId);
    if (!orderId) return;

    const beforeStatus = safeStr(before?.status).toLowerCase();
    const afterStatus = safeStr(after?.status).toLowerCase();

    if (beforeStatus === afterStatus) return;
    if (afterStatus !== "cancelled") return;

    const customerName = getCustomerName(after);

    const cancelReason =
      safeStr(after?.cancelReason) ||
      safeStr(after?.cancellationReason) ||
      safeStr(after?.statusNote) ||
      "";

    const extraHtml = cancelReason
      ? `
        <div style="margin:0 0 22px;padding:16px 18px;background:#fff5f5;border:1px solid #fecaca;border-radius:14px;">
          <div style="font-size:14px;font-weight:800;color:#991b1b;margin-bottom:6px;">Iptal Nedeni</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.8;">
            ${escapeHtml(cancelReason)}
          </div>
        </div>
      `
      : "";

    const html = baseHtml({
      title: "Siparissiniz Iptal Edildi",
      subtitle: "Siparissiniz iptal edilmistir.",
      customerName,
      orderId,
      order: after,
      bodyHtml: `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
          Siparissiniz iptal edilmistir. Odemeniz varsa iade sureci baslatilacaktir.
          Herhangi bir sorunuz icin bize ulasabilirsiniz.
        </p>
      `,
      extraHtml,
      ctaLabel: "Siparisimi Goruntule",
      ctaUrl: getOrderViewUrl(orderId),
    });

    await queueMail({
      orderId,
      order: after,
      type: "order_cancelled",
      subject: `Siparissiniz Iptal Edildi - ${orderId}`,
      html,
    });
  }
);

export const sendOrderRefundedMail = onDocumentUpdated(
  {
    region: "europe-west1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    const orderId = safeStr(event.params.orderId);
    if (!orderId) return;

    const beforeStatus = safeStr(before?.status).toLowerCase();
    const afterStatus = safeStr(after?.status).toLowerCase();

    if (beforeStatus === afterStatus) return;
    if (afterStatus !== "refunded") return;

    const customerName = getCustomerName(after);

    const refundAmount =
      toNum(after?.refundAmount, 0) ||
      toNum(after?.refund?.amount, 0) ||
      toNum(after?.total, 0);

    const refundReason =
      safeStr(after?.refundReason) ||
      safeStr(after?.returnReason) ||
      safeStr(after?.statusNote) ||
      "";

    const extraHtml = `
      <div style="margin:0 0 22px;padding:16px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">
        <div style="font-size:14px;font-weight:800;color:#166534;margin-bottom:6px;">Iade Bilgisi</div>
        <div style="font-size:14px;color:#6b7280;line-height:1.8;">
          ${refundAmount > 0 ? `Iade tutari: <strong>${formatTRY(refundAmount)}</strong><br/>` : ""}
          Iade isleminiz baslatilmistir. Odemeniz odeme yonteminize gore 1-14 is gunu icerisinde hesabiniza yansiyacaktir.
          ${refundReason ? `<br/>Sebep: <strong>${escapeHtml(refundReason)}</strong>` : ""}
        </div>
      </div>
    `;

    const html = baseHtml({
      title: "Iade Isleminiz Tamamlandi",
      subtitle: "Siparissinizin iade islemi gerceklestirilmistir.",
      customerName,
      orderId,
      order: after,
      bodyHtml: `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
          Iade isleminiz tamamlanmistir. Odemeniz kisa surede hesabiniza yansiyacaktir.
          Dromocob'u tercih ettiginiz icin tesekkur ederiz.
        </p>
      `,
      extraHtml,
      ctaLabel: "Siparisimi Goruntule",
      ctaUrl: getOrderViewUrl(orderId),
    });

    await queueMail({
      orderId,
      order: after,
      type: "order_refunded",
      subject: `Iade Isleminiz Tamamlandi - ${orderId}`,
      html,
    });
  }
);