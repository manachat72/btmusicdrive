import { Router, Request, Response } from 'express';
import { askSupportAI } from '../lib/supportAI';

const router = Router();

const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || '';

// Send a text message back to a Messenger user via the Graph API.
async function sendMessage(recipientId: string, text: string): Promise<void> {
  if (!PAGE_TOKEN) {
    console.error('[Messenger] FB_PAGE_ACCESS_TOKEN is missing — cannot reply');
    return;
  }

  const resp = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      // Messenger hard-limits a text message to 2000 chars.
      message: { text: text.slice(0, 1900) },
    }),
  });

  // Facebook returns 200 on success; surface the exact error otherwise.
  if (!resp.ok) {
    console.error('[Messenger] Graph API rejected the reply:', resp.status, await resp.text());
  }
}

// GET /api/messenger/webhook — Facebook calls this once to verify the webhook.
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /api/messenger/webhook — incoming messages (uses express.json()).
router.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body;

  // Only handle Page subscriptions.
  if (body?.object !== 'page') {
    return res.sendStatus(404);
  }

  // On serverless (Vercel) the function is frozen once the response is sent,
  // so finish OpenAI + the reply BEFORE responding.
  await Promise.all(
    (body.entry || []).flatMap((entry: any) =>
      (entry.messaging || []).map(async (ev: any) => {
        const senderId = ev.sender?.id;
        const text = ev.message?.text;
        // Skip echoes (messages the page itself sent) and non-text events.
        if (!senderId || !text || ev.message?.is_echo) return;

        const reply = await askSupportAI(text);
        try {
          await sendMessage(senderId, reply);
        } catch (err: any) {
          console.error('[Messenger] send failed:', err?.message || err);
        }
      })
    )
  );

  res.status(200).send('EVENT_RECEIVED');
});

export default router;
