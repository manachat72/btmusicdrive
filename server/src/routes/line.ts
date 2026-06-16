import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getProductContext } from '../lib/productContext';
import { SUPPORT_KNOWLEDGE } from '../lib/supportKnowledge';

const router = Router();

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const OPENAI_KEY = process.env.OPENAI_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Verify the request genuinely came from LINE (HMAC-SHA256 over the raw body).
function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!LINE_SECRET || !signature) return false;
  const hash = crypto.createHmac('sha256', LINE_SECRET).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Ask OpenAI to answer a customer message using the live product catalog.
async function askAI(userText: string): Promise<string> {
  if (!OPENAI_KEY) {
    return 'ขออภัยค่ะ ระบบแชทอัตโนมัติยังไม่พร้อมใช้งาน กรุณาทักแอดมินโดยตรงนะคะ 🙏';
  }

  const systemPrompt = `คุณคือผู้ช่วยดูแลลูกค้า (customer support) ของร้าน "BT Music Drive" ร้านขายแฟลชไดร์ฟ USB รวมเพลง MP3
ลูกค้าส่วนใหญ่ทักมา "แจ้งปัญหา" — โดยเฉพาะแฟลชไดร์ฟเสีย/ใช้ไม่ได้ และขอเปลี่ยน/คืน/เคลม
หน้าที่หลักของคุณคือช่วยแก้ปัญหาเบื้องต้นให้ลูกค้าก่อน แล้วจึงส่งต่อแอดมินถ้าจำเป็น

กฎการตอบ:
- ตอบเป็นภาษาไทย สุภาพ เห็นอกเห็นใจ ลงท้าย "ค่ะ/นะคะ" ใช้อิโมจิได้พอประมาณ
- ตอบสั้น กระชับ อ่านง่ายบนมือถือ (ไม่เกิน 5-6 บรรทัด) ถ้าต้องไกด์หลายขั้นให้ทำเป็นข้อ 1, 2, 3
- เรื่องแฟลชไดร์ฟเสีย/ใช้ไม่ได้: ให้ไกด์ "วิธีแก้เบื้องต้น" จากคลังความรู้ก่อนเสมอ (ส่วนใหญ่ไม่ได้เสียจริง) อย่าเพิ่งบอกให้เคลมทันที
- ถ้าลองแก้แล้วยังไม่หาย หรือเข้าเงื่อนไขเคลม/เปลี่ยน/คืน: บอกเงื่อนไข (รับประกัน 7 วัน) สั้นๆ แล้วขอเลขออเดอร์+อาการ+รูป/คลิป และแจ้งว่าแอดมินจะติดต่อกลับในแชทนี้
- เรื่องที่ต้องเช็คข้อมูลจริง (สถานะออเดอร์, ติดตามพัสดุ, อนุมัติเคลม/คืนเงิน): อย่าเดาหรือสัญญาแทนร้าน ให้บอกว่าแอดมินจะมาดูแลต่อ
- ห้ามแต่งเงื่อนไข/ราคา/สินค้าที่ไม่มีในข้อมูลด้านล่าง ยึดตามคลังความรู้และรายการสินค้าเท่านั้น
- จัดส่งทั่วไทยผ่าน Flash Express ปกติ 1-3 วันทำการ

${SUPPORT_KNOWLEDGE}

=== รายการสินค้าในร้าน (อ้างอิงเมื่อลูกค้าถามชื่อ/ราคา/แนวเพลง) ===
${getProductContext()}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
    });

    if (!resp.ok) {
      console.error('[LINE] OpenAI API error:', resp.status, await resp.text());
      return 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบนะคะ 🙏';
    }

    const data: any = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || 'ขออภัยค่ะ ตอบไม่ได้ในขณะนี้ เดี๋ยวแอดมินมาช่วยนะคะ 🙏';
  } catch (err: any) {
    console.error('[LINE] OpenAI request failed:', err?.message || err);
    return 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบนะคะ 🙏';
  }
}

// Reply to a LINE event using its one-time replyToken.
async function replyToLine(replyToken: string, text: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: text.slice(0, 4900) }],
    }),
  });
}

// POST /api/line/webhook — receives raw body (registered with express.raw in index.ts)
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-line-signature'] as string | undefined;
  const rawBody: Buffer = req.body; // Buffer thanks to express.raw()

  if (!Buffer.isBuffer(rawBody) || !verifySignature(rawBody, signature || '')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let events: any[] = [];
  try {
    events = JSON.parse(rawBody.toString('utf-8')).events || [];
  } catch {
    return res.status(200).end();
  }

  // On serverless (Vercel) the function is frozen once the response is sent,
  // so all async work (OpenAI + LINE reply) must finish BEFORE we respond.
  await Promise.all(
    events.map(async (ev) => {
      if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
        const reply = await askAI(ev.message.text);
        try {
          await replyToLine(ev.replyToken, reply);
        } catch (err: any) {
          console.error('[LINE] reply failed:', err?.message || err);
        }
      }
    })
  );

  res.status(200).end();
});

export default router;
