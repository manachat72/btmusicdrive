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
        <td style="padding:14px 16px;border-bottom:1px solid #2a2a2a;font-size:14px;color:#e5e7eb;">${item.name}</td>
        <td style="padding:14px 16px;border-bottom:1px solid #2a2a2a;font-size:14px;color:#e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:14px 16px;border-bottom:1px solid #2a2a2a;font-size:14px;color:#C8A84E;text-align:right;font-weight:700;">฿${(item.priceAtTime * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      </tr>`
    )
    .join('');

  const trackingSection = data.trackingNumber && data.carrier
    ? `
      <div style="margin:28px 0;padding:24px;background:#1a1a1a;border-radius:12px;border:1px solid #C8A84E;">
        <p style="margin:0 0 10px;font-size:15px;color:#C8A84E;font-weight:700;">📦 พัสดุของคุณกำลังเดินทาง!</p>
        <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">ขนส่ง: <strong style="color:#e5e7eb;">${data.carrier}</strong></p>
        <p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">หมายเลขติดตาม: <strong style="color:#e5e7eb;font-family:monospace;">${data.trackingNumber}</strong></p>
        <a href="${getTrackingUrl(data.carrier, data.trackingNumber)}"
           style="display:inline-block;background:linear-gradient(135deg,#C8A84E,#a8873e);color:#0F172A;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:0.3px;">
          ติดตามพัสดุ →
        </a>
      </div>`
    : `
      <div style="margin:28px 0;padding:20px;background:#1a1a1a;border-radius:12px;border:1px solid #374151;">
        <p style="margin:0;font-size:14px;color:#9ca3af;">⏳ คำสั่งซื้อของคุณกำลังดำเนินการ เราจะแจ้งอีกครั้งเมื่อพัสดุถูกจัดส่ง</p>
      </div>`;

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">

    <!-- Card -->
    <div style="background:#111111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;box-shadow:0 8px 40px rgba(0,0,0,0.6);">

      <!-- Header with gold gradient bar -->
      <div style="height:4px;background:linear-gradient(90deg,#C8A84E,#f5d98b,#C8A84E);"></div>

      <!-- Logo area -->
      <div style="background:linear-gradient(180deg,#1a1a1a 0%,#111111 100%);padding:36px 40px 28px;text-align:center;border-bottom:1px solid #2a2a2a;">
        <img src="https://btmusicdrive.com/images/logo%20(60%20x%2060%20px)%20(1).png"
             alt="BT Music Drive"
             width="80"
             style="display:block;margin:0 auto 16px;border-radius:50%;"
             onerror="this.style.display='none'">
        <h1 style="margin:0;font-size:13px;font-weight:600;letter-spacing:4px;color:#C8A84E;text-transform:uppercase;">BT MUSIC DRIVE</h1>
        <div style="margin:16px auto 0;width:48px;height:1px;background:linear-gradient(90deg,transparent,#C8A84E,transparent);"></div>
      </div>

      <!-- Confirmation badge -->
      <div style="padding:28px 40px 0;text-align:center;">
        <div style="display:inline-block;background:linear-gradient(135deg,#C8A84E22,#C8A84E11);border:1px solid #C8A84E44;border-radius:50px;padding:10px 28px;">
          <span style="font-size:13px;color:#C8A84E;font-weight:700;letter-spacing:1px;">✅ ยืนยันคำสั่งซื้อแล้ว</span>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:28px 40px;">

        <!-- Greeting -->
        <p style="font-size:16px;color:#f9fafb;margin:0 0 6px;">สวัสดีคุณ <strong style="color:#C8A84E;">${data.customerName || 'ลูกค้า'}</strong>,</p>
        <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">ขอบคุณที่ไว้วางใจ BT Music Drive นะคะ 🎵<br>นี่คือสรุปคำสั่งซื้อของคุณ</p>

        <!-- Order ID box -->
        <div style="background:#1a1a1a;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #2a2a2a;display:flex;align-items:center;">
          <div>
            <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;">หมายเลขคำสั่งซื้อ</span>
            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#C8A84E;font-family:monospace;letter-spacing:1px;">#${data.orderId.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <!-- Items table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:0;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
          <thead>
            <tr style="background:#1a1a1a;">
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">สินค้า</th>
              <th style="padding:12px 16px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">จำนวน</th>
              <th style="padding:12px 16px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">ราคา</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <!-- Total -->
        <div style="background:linear-gradient(135deg,#1a1a1a,#222222);border:1px solid #C8A84E44;border-top:none;border-radius:0 0 12px 12px;padding:16px 20px;text-align:right;">
          <span style="font-size:13px;color:#9ca3af;margin-right:12px;">ยอดรวมทั้งหมด</span>
          <span style="font-size:20px;font-weight:900;color:#C8A84E;">฿${data.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        </div>

        ${trackingSection}

        <!-- CTA -->
        <div style="margin-top:28px;text-align:center;">
          <a href="https://btmusicdrive.com/orders.html"
             style="display:inline-block;background:linear-gradient(135deg,#C8A84E,#a8873e);color:#0F172A;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:0.5px;">
            ดูคำสั่งซื้อของฉัน
          </a>
        </div>

      </div>

      <!-- Divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#2a2a2a,transparent);margin:0 40px;"></div>

      <!-- Footer -->
      <div style="padding:24px 40px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#4b5563;">มีคำถาม? ตอบกลับอีเมลนี้ได้เลยนะคะ</p>
        <p style="margin:0;font-size:11px;color:#374151;">© ${new Date().getFullYear()} BT Music Drive · All rights reserved</p>
      </div>

      <!-- Bottom gold bar -->
      <div style="height:3px;background:linear-gradient(90deg,#C8A84E,#f5d98b,#C8A84E);"></div>

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
