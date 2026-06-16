import { getProductContext } from './productContext';
import { SUPPORT_KNOWLEDGE } from './supportKnowledge';

const OPENAI_KEY = process.env.OPENAI_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Optional local Llama (Ollama) backend for dev — e.g. http://localhost:11434
// When OLLAMA_URL is set we use it instead of OpenAI. Both speak the same
// OpenAI-compatible /v1/chat/completions API, so only the URL/key/model differ.
const OLLAMA_URL = process.env.OLLAMA_URL || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'scb10x/llama3.1-typhoon2-8b-instruct';

const useOllama = !!OLLAMA_URL;
const API_URL = useOllama
  ? `${OLLAMA_URL.replace(/\/$/, '')}/v1/chat/completions`
  : 'https://api.openai.com/v1/chat/completions';
const MODEL = useOllama ? OLLAMA_MODEL : OPENAI_MODEL;

const FALLBACK = 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบนะคะ 🙏';

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
- เวลาแนะนำสินค้า ให้แนบลิงก์สินค้าจากรายการเสมอ
- เรื่องที่ต้องเช็คข้อมูลจริง (สถานะออเดอร์, ติดตามพัสดุ, อนุมัติเคลม/คืนเงิน): อย่าเดาหรือสัญญาแทนร้าน ให้บอกว่าแอดมินจะมาดูแลต่อ
- ห้ามแต่งเงื่อนไข/ราคา/สินค้าที่ไม่มีในข้อมูลด้านล่าง ยึดตามคลังความรู้และรายการสินค้าเท่านั้น
- จัดส่งทั่วไทยผ่าน Flash Express ปกติ 1-3 วันทำการ

${SUPPORT_KNOWLEDGE}

=== รายการสินค้าในร้าน (อ้างอิงเมื่อลูกค้าถามชื่อ/ราคา/แนวเพลง) ===
${getProductContext()}`;
  return cachedSystemPrompt;
}

/**
 * Shared support-bot brain used by every channel (LINE, Messenger, ...).
 * Answers a customer message via OpenAI using the live catalog + KB.
 * Always resolves to a string — never throws — so callers can just reply.
 */
export async function askSupportAI(userText: string): Promise<string> {
  // Ollama needs no key; OpenAI does.
  if (!useOllama && !OPENAI_KEY) {
    return 'ขออภัยค่ะ ระบบแชทอัตโนมัติยังไม่พร้อมใช้งาน กรุณาทักแอดมินโดยตรงนะคะ 🙏';
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (!useOllama) headers.authorization = `Bearer ${OPENAI_KEY}`;

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userText },
        ],
      }),
    });

    if (!resp.ok) {
      console.error(`[supportAI] ${useOllama ? 'Ollama' : 'OpenAI'} API error:`, resp.status, await resp.text());
      return FALLBACK;
    }

    const data: any = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || 'ขออภัยค่ะ ตอบไม่ได้ในขณะนี้ เดี๋ยวแอดมินมาช่วยนะคะ 🙏';
  } catch (err: any) {
    console.error(`[supportAI] ${useOllama ? 'Ollama' : 'OpenAI'} request failed:`, err?.message || err);
    return FALLBACK;
  }
}
