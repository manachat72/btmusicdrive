import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { askSupportAI } from '../lib/supportAI';

const router = Router();

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Human-like typing delay scaled to how long the reply is, so a long answer
// feels like it took longer to "type". Clamped to keep replies snappy and
// within LINE's 30s webhook timeout.
function typingDelay(text: string): number {
  const ms = 600 + text.length * 35; // ~base + per-character
  return Math.min(ms, 6000);
}

// Show the typing/loading animation (3 dots) in the chat while the AI thinks.
// LINE shows it for `seconds` (5–60, multiples of 5) or until the bot replies.
async function showLoading(userId: string, seconds = 20): Promise<void> {
  if (!userId) return;
  try {
    await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({ chatId: userId, loadingSeconds: seconds }),
    });
  } catch (err: any) {
    console.error('[LINE] loading animation failed:', err?.message || err);
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
        // Show "typing…" while the AI generates a reply (1:1 chats only).
        if (ev.source?.userId) await showLoading(ev.source.userId);
        const reply = await askSupportAI(ev.message.text);
        // Delay scaled to reply length so it feels like real typing.
        await sleep(typingDelay(reply));
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
