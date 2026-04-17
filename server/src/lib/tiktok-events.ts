import crypto from 'crypto';

const PIXEL_CODE = process.env.TIKTOK_PIXEL_ID || 'D7E0Q1RC77U88C4ADOSG';
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN || '';
const API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface UserData {
  email?: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
}

interface ProductData {
  id: string;
  name?: string;
  price?: number;
}

async function sendEvent(
  event: string,
  eventId: string,
  properties: Record<string, any>,
  userData: UserData,
): Promise<void> {
  if (!ACCESS_TOKEN) return;

  const user: Record<string, string> = {};
  if (userData.email) user.email = sha256(userData.email);
  if (userData.phone) user.phone_number = sha256(userData.phone.replace(/\D/g, ''));

  const payload = {
    pixel_code: PIXEL_CODE,
    event,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    properties,
    context: {
      page: { url: userData.pageUrl || 'https://btmusicdrive.com' },
      ip: userData.clientIp || '',
      user_agent: userData.userAgent || '',
      ...(Object.keys(user).length > 0 && { user }),
    },
  };

  await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': ACCESS_TOKEN,
    },
    body: JSON.stringify(payload),
  }).catch((err) => console.error(`[TikTok Events API] ${event} failed:`, err));
}

// ── CompletePayment (Purchase) ───────────────────────────────────────────────
export async function sendTikTokPurchaseEvent(data: {
  orderId: string;
  totalAmount: number;
  contentIds: string[];
  numItems: number;
  userData: UserData;
}): Promise<void> {
  await sendEvent(
    'CompletePayment',
    `purchase_${data.orderId}`,
    {
      currency: 'THB',
      value: data.totalAmount,
      contents: data.contentIds.map(id => ({ content_id: id, content_type: 'product', quantity: 1 })),
      num_items: data.numItems,
    },
    { ...data.userData, pageUrl: 'https://btmusicdrive.com/checkout' },
  );
}

// ── PlaceAnOrder (COD — สั่งซื้อแต่ยังไม่จ่าย) ───────────────────────────────
export async function sendTikTokPlaceOrderEvent(data: {
  orderId: string;
  totalAmount: number;
  products: ProductData[];
  userData: UserData;
}): Promise<void> {
  await sendEvent(
    'PlaceAnOrder',
    `order_${data.orderId}`,
    {
      currency: 'THB',
      value: data.totalAmount,
      contents: data.products.map(p => ({
        content_id: p.id,
        content_type: 'product',
        content_name: p.name || '',
        price: p.price || 0,
        quantity: 1,
      })),
    },
    { ...data.userData, pageUrl: 'https://btmusicdrive.com/checkout' },
  );
}

// ── CompleteRegistration ─────────────────────────────────────────────────────
export async function sendTikTokRegistrationEvent(data: {
  userId: string;
  userData: UserData;
}): Promise<void> {
  await sendEvent(
    'CompleteRegistration',
    `reg_${data.userId}`,
    { currency: 'THB' },
    { ...data.userData, pageUrl: 'https://btmusicdrive.com' },
  );
}
