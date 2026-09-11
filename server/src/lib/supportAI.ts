import { getProductContext } from './productContext';
import { SUPPORT_KNOWLEDGE } from './supportKnowledge';

const OPENAI_KEY = process.env.OPENAI_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Ollama backend (gpt-oss:20b) — used instead of OpenAI when OLLAMA_URL is set.
//   production:   OLLAMA_URL=https://ai.btmusicdrive.com + OLLAMA_API_KEY
//                 (Cloudflare Tunnel → scripts/ollama-gateway.js on the shop PC)
//   local dev:    OLLAMA_URL=http://localhost:11434
// Uses the native /api/chat (not /v1) so we can set num_ctx — the catalog +
// KB system prompt is ~10k tokens and Ollama's 4k default would truncate it —
// and think:'low' so gpt-oss doesn't burn the token budget on reasoning.
const OLLAMA_URL = (process.env.OLLAMA_URL || '').replace(/\/$/, '');
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 16384;

const useOllama = !!OLLAMA_URL;
// 30s per provider so Ollama + OpenAI fallback still fit in one webhook call
const TIMEOUT_MS = 30_000;

const FALLBACK = 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบนะคะ 🙏';

// LINE/Messenger render plain text — strip Markdown the model slips in
// (gpt-oss does this even when told not to) and keep the shop's "ค่ะ" voice.
function toChatText(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((\S+?)\)/g, '$1 $2')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/ครับ/g, 'ค่ะ')
    .trim();
}

let cachedSystemPrompt: string | null = null;

function buildSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = `คุณคือผู้ช่วยร้าน "BT Music Drive" ร้านขายแฟลชไดร์ฟ USB รวมเพลง MP3
คุณทำหน้าที่ทั้ง "ช่วยขาย" และ "ดูแลลูกค้า/แก้ปัญหา" — ให้ดูจากสิ่งที่ลูกค้าทักเข้ามาแล้วตอบให้เหมาะ

แยกเจตนาลูกค้าก่อนตอบ:
1) มาถามซื้อ/สนใจสินค้า (ถามราคา แนวเพลง มีเพลงอะไร อยากได้ของขวัญ ฯลฯ) → โหมด "ขาย":
   - แนะนำสินค้าที่ตรงความต้องการจากรายการสินค้าจริงด้านล่าง พร้อมราคาและลิงก์สินค้า
   - บอกจุดเด่นสั้นๆ ชวนให้ตัดสินใจ ปิดการขายอย่างเป็นมิตร (ไม่ยัดเยียด) เชิญสั่งซื้อที่ btmusicdrive.com
2) มาแจ้งปัญหา (แฟลชไดร์ฟเสีย/ใช้ไม่ได้ ขอเปลี่ยน/คืน/เคลม) → โหมด "ช่วยเหลือ":
   - ไกด์ "วิธีแก้เบื้องต้น" จากคลังความรู้ก่อนเสมอ (ส่วนใหญ่ไม่ได้เสียจริง) อย่าเพิ่งบอกให้เคลมทันที
   - ถ้าแก้แล้วไม่หาย/เข้าเงื่อนไขเคลม: บอกเงื่อนไข (รับประกัน 7 วัน) สั้นๆ แล้วขอเลขออเดอร์+อาการ+รูป/คลิป และแจ้งว่าแอดมินจะติดต่อกลับในแชทนี้

กฎการตอบ:
- ตอบเป็นภาษาไทย สุภาพ เป็นมิตร เห็นอกเห็นใจ ลงท้าย "ค่ะ/นะคะ" ใช้อิโมจิได้พอประมาณ
- ตอบสั้น กระชับ อ่านง่ายบนมือถือ (ไม่เกิน 5-6 บรรทัด) ถ้ามีหลายขั้น/หลายตัวเลือกให้ทำเป็นข้อ 1, 2, 3
- ใช้ "ค่ะ/นะคะ" เท่านั้น ห้ามใช้ "ครับ"
- ห้ามใช้ Markdown (**ตัวหนา**, [ข้อความ](ลิงก์), #หัวข้อ) เพราะแชทแสดงเป็นตัวอักษรดิบ — ใส่ลิงก์เป็น URL ตรงๆ เช่น https://btmusicdrive.com/product/...
- เวลาแนะนำสินค้า ให้แนบลิงก์สินค้าจากรายการเสมอ
- เรื่องที่ต้องเช็คข้อมูลจริง (สถานะออเดอร์, ติดตามพัสดุ, อนุมัติเคลม/คืนเงิน): อย่าเดาหรือสัญญาแทนร้าน ให้บอกว่าแอดมินจะมาดูแลต่อ
- ห้ามแต่งเงื่อนไข/ราคา/สินค้า/วิธีแก้ที่ไม่มีในข้อมูลด้านล่าง ยึดตามคลังความรู้และรายการสินค้าเท่านั้น
- จัดส่งทั่วไทยผ่าน Flash Express ปกติ 1-3 วันทำการ

${SUPPORT_KNOWLEDGE}

=== รายการสินค้าในร้าน (อ้างอิงเมื่อลูกค้าถามชื่อ/ราคา/แนวเพลง) ===
${getProductContext()}`;
  return cachedSystemPrompt;
}

/**
 * Shared support-bot brain used by the LINE bot.
 * Answers a customer message via Ollama (gpt-oss) or OpenAI using the live catalog + KB.
 * Always resolves to a string — never throws — so callers can just reply.
 */
export async function askSupportAI(userText: string): Promise<string> {
  if (!useOllama && !OPENAI_KEY) {
    return 'ขออภัยค่ะ ระบบแชทอัตโนมัติยังไม่พร้อมใช้งาน กรุณาทักแอดมินโดยตรงนะคะ 🙏';
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userText },
  ];

  // Local Ollama first (free). If the PC is off / tunnel down, fall back to
  // OpenAI so customers still get an answer — remove OPENAI_KEY to disable.
  let text: string | null = null;
  if (useOllama) {
    text = await callChat('Ollama', OLLAMA_URL + '/api/chat', OLLAMA_API_KEY, {
      model: OLLAMA_MODEL,
      stream: false,
      // gpt-oss only accepts effort levels; for others (qwen etc.) thinking just adds latency
      think: OLLAMA_MODEL.startsWith('gpt-oss') ? 'low' : false,
      messages,
      options: { num_ctx: OLLAMA_NUM_CTX, num_predict: 1500 },
    }, (d) => d?.message?.content);
  }
  if (text === null && OPENAI_KEY) {
    text = await callChat('OpenAI', 'https://api.openai.com/v1/chat/completions', OPENAI_KEY,
      { model: OPENAI_MODEL, max_tokens: 500, messages },
      (d) => d?.choices?.[0]?.message?.content);
  }
  if (text === null) return FALLBACK;
  return toChatText(text) || 'ขออภัยค่ะ ตอบไม่ได้ในขณะนี้ เดี๋ยวแอดมินมาช่วยนะคะ 🙏';
}

/** POST a chat request; returns the reply text ('' if empty) or null on any failure. */
async function callChat(
  provider: string,
  url: string,
  key: string,
  body: object,
  pick: (data: any) => string | undefined,
): Promise<string | null> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.error(`[supportAI] ${provider} API error:`, resp.status, (await resp.text()).slice(0, 300));
      return null;
    }
    return pick(await resp.json()) || '';
  } catch (err: any) {
    console.error(`[supportAI] ${provider} request failed:`, err?.message || err);
    return null;
  }
}
