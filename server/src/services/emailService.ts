import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface OrderEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    priceAtTime: number;
  }>;
  totalAmount: number;
  trackingNumber?: string;
  carrier?: string;
}

const CARRIER_TRACKING_URLS: Record<string, string> = {
  Kerry: 'https://th.kerryexpress.com/en/track/?track=',
  Flash: 'https://www.flashexpress.co.th/tracking/?se=',
};

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const base = CARRIER_TRACKING_URLS[carrier];
  return base ? `${base}${trackingNumber}` : `#`;
}

function buildOrderEmailHtml(data: OrderEmailData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;text-align:right;">฿${(item.priceAtTime * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const trackingSection = data.trackingNumber && data.carrier
    ? `
      <div style="margin:24px 0;padding:20px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
        <p style="margin:0 0 8px;font-size:14px;color:#166534;font-weight:600;">📦 Your package is on the way!</p>
        <p style="margin:0 0 4px;font-size:13px;color:#374151;">Carrier: <strong>${data.carrier}</strong></p>
        <p style="margin:0 0 16px;font-size:13px;color:#374151;">Tracking Number: <strong>${data.trackingNumber}</strong></p>
        <a href="${getTrackingUrl(data.carrier, data.trackingNumber)}"
           style="display:inline-block;background:#C8A84E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
          Track My Package →
        </a>
      </div>`
    : `
      <div style="margin:24px 0;padding:16px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe;">
        <p style="margin:0;font-size:14px;color:#1e40af;">⏳ Your order is being processed. You will receive another email when your package ships.</p>
      </div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#C8A84E,#b5953f);padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">btmusicdrive</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:14px;">Order Confirmation</p>
    </div>
    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#111827;margin:0 0 4px;">Hi <strong>${data.customerName || 'Valued Customer'}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Thank you for your order. Here's a summary:</p>

      <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Order ID</span>
        <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#111827;font-family:monospace;">#${data.orderId.slice(-8).toUpperCase()}</p>
      </div>

      <!-- Items table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="border-top:2px solid #e5e7eb;padding-top:12px;text-align:right;">
        <span style="font-size:16px;font-weight:800;color:#111827;">Total: ฿${data.totalAmount.toFixed(2)}</span>
      </div>

      ${trackingSection}
    </div>
    <!-- Footer -->
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} btmusicdrive Store · Questions? Reply to this email</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP credentials not configured, skipping email send.');
    return;
  }

  const subject = data.trackingNumber
    ? `Your btmusicdrive order has shipped! 📦 Order #${data.orderId.slice(-8).toUpperCase()}`
    : `Order Confirmed! ✅ Order #${data.orderId.slice(-8).toUpperCase()}`;

  await transporter.sendMail({
    from: `"btmusicdrive Store" <${process.env.SMTP_USER}>`,
    to: data.customerEmail,
    subject,
    html: buildOrderEmailHtml(data),
  });

  console.log(`[Email] Sent "${subject}" to ${data.customerEmail}`);
}
