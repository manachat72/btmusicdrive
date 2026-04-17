import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'ส่งฟอร์มได้สูงสุด 5 ครั้ง/ชั่วโมง กรุณาลองใหม่ภายหลัง' },
});

// POST /api/contact
router.post('/', contactLimiter, async (req: Request, res: Response) => {
  const { name, email, phone, subject, message, _hp } = req.body;

  // Honeypot check
  if (_hp) return res.status(200).json({ ok: true });

  // Validation
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ อีเมล และข้อความให้ครบถ้วน' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ error: 'ข้อความต้องมีอย่างน้อย 10 ตัวอักษร' });
  }
  if (name.trim().length > 100 || message.trim().length > 2000) {
    return res.status(400).json({ error: 'ข้อความยาวเกินไป' });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Contact] SMTP not configured');
    return res.status(200).json({ ok: true });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const subjectLine = subject?.trim()
    ? `[ติดต่อเรา] ${subject.trim()}`
    : `[ติดต่อเรา] ข้อความจาก ${name.trim()}`;

  const html = `
<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#0F172A;padding:20px 28px;">
    <p style="margin:0;color:#C8A84E;font-size:12px;letter-spacing:3px;font-weight:700;">BT MUSIC DRIVE</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:18px;">ข้อความจากลูกค้า</h1>
  </div>
  <div style="padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#6b7280;width:100px;">ชื่อ</td><td style="padding:8px 0;font-weight:600;color:#111;">${escHtml(name)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">อีเมล</td><td style="padding:8px 0;"><a href="mailto:${escHtml(email)}" style="color:#8B7355;">${escHtml(email)}</a></td></tr>
      ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;">โทรศัพท์</td><td style="padding:8px 0;">${escHtml(phone)}</td></tr>` : ''}
      ${subject ? `<tr><td style="padding:8px 0;color:#6b7280;">หัวข้อ</td><td style="padding:8px 0;font-weight:600;">${escHtml(subject)}</td></tr>` : ''}
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <p style="color:#374151;line-height:1.7;white-space:pre-wrap;margin:0;">${escHtml(message)}</p>
  </div>
  <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">ส่งผ่านหน้าติดต่อเรา — btmusicdrive.com</p>
  </div>
</div>
</body></html>`;

  try {
    await transporter.sendMail({
      from: `"Bt music drive Contact" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      subject: subjectLine,
      html,
    });

    // Auto-reply to sender
    await transporter.sendMail({
      from: `"Bt music drive" <${process.env.SMTP_USER}>`,
      to: email.trim(),
      subject: 'ได้รับข้อความของคุณแล้ว — Bt music drive',
      html: `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="height:4px;background:linear-gradient(90deg,#C8A84E,#f5d98b,#C8A84E);"></div>
  <div style="padding:28px;">
    <p style="font-size:16px;color:#111;margin:0 0 8px;">สวัสดีคุณ <strong>${escHtml(name)}</strong>,</p>
    <p style="color:#6b7280;line-height:1.7;margin:0 0 20px;">เราได้รับข้อความของคุณเรียบร้อยแล้ว ทีมงานจะติดต่อกลับภายใน <strong>1 วันทำการ</strong> 🎵</p>
    <p style="color:#374151;background:#f9fafb;border-radius:8px;padding:16px;border-left:3px solid #8B7355;line-height:1.7;white-space:pre-wrap;font-size:14px;">${escHtml(message)}</p>
    <p style="margin-top:20px;color:#6b7280;font-size:13px;">หากมีข้อสงสัยเพิ่มเติม ติดต่อเราได้ที่ LINE: <strong>@bt1992</strong> หรือโทร <strong>097-295-7663</strong></p>
  </div>
  <div style="background:#0F172A;padding:16px 28px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#6b7280;">© ${new Date().getFullYear()} Bt music drive · btmusicdrive.com</p>
  </div>
</div></body></html>`,
    });

    res.json({ ok: true, message: 'ส่งข้อความเรียบร้อยแล้ว เราจะติดต่อกลับภายใน 1 วันทำการ' });
  } catch (err: any) {
    console.error('[Contact] Email error:', err.message);
    res.status(500).json({ error: 'ไม่สามารถส่งข้อความได้ กรุณาติดต่อผ่าน LINE หรือโทรศัพท์' });
  }
});

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
