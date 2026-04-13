import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || '997999705986502';
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN || '';
const CAPI_URL = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface CapiUserData {
  email?: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string;
}

interface CapiPurchaseData {
  orderId: string;
  totalAmount: number;
  contentIds: string[];
  numItems: number;
  userData: CapiUserData;
}

export async function sendPurchaseEvent(data: CapiPurchaseData): Promise<void> {
  if (!ACCESS_TOKEN) return;

  const userDataPayload: Record<string, any> = {};
  if (data.userData.email) userDataPayload.em = [sha256(data.userData.email)];
  if (data.userData.phone) userDataPayload.ph = [sha256(data.userData.phone.replace(/\D/g, ''))];
  if (data.userData.clientIp) userDataPayload.client_ip_address = data.userData.clientIp;
  if (data.userData.userAgent) userDataPayload.client_user_agent = data.userData.userAgent;

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase_${data.orderId}`,
      action_source: 'website',
      user_data: userDataPayload,
      custom_data: {
        currency: 'THB',
        value: data.totalAmount,
        content_ids: data.contentIds,
        content_type: 'product',
        num_items: data.numItems,
        order_id: data.orderId,
      },
    }],
    access_token: ACCESS_TOKEN,
  };

  await fetch(CAPI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.error('[Meta CAPI] Purchase event failed:', err));
}
