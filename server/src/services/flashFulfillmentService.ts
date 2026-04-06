import crypto from 'crypto';

const BASE_URL = process.env.FLASH_FULFILLMENT_BASE_URL || 'https://open-training.flashfulfillment.co.th';
const MCH_ID = process.env.FLASH_FULFILLMENT_MCH_ID || '';
const SECRET = process.env.FLASH_FULFILLMENT_SECRET || '';

// ── Signature (Algorithm 1) ───────────────────────────────────────────────────
function buildSign(params: Record<string, string | number>): string {
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  const stringA = filtered.map(([k, v]) => `${k}=${v}`).join('&');
  const stringSignTemp = `${stringA}&key=${SECRET}`;
  return crypto.createHash('sha256').update(stringSignTemp).digest('hex').toUpperCase();
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function post(endpoint: string, params: Record<string, string | number>): Promise<any> {
  if (!MCH_ID || !SECRET) {
    console.warn('[Flash Fulfillment] MCH_ID or SECRET not set — skipping sync');
    return null;
  }

  const nonceStr = Math.random().toString(36).substring(2, 18);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const allParams: Record<string, string | number> = {
    ...params,
    mchId: MCH_ID,
    nonceStr,
    timestamp,
  };

  allParams.sign = buildSign(allParams);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(allParams)) {
    body.append(k, String(v));
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await res.json();
  return json;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * แจ้งของเข้าคลัง Flash Fulfillment (Inbound / Arrival Notice)
 * ใช้เมื่อจะส่ง USB stock ไปเก็บที่โกดัง Flash
 */
export async function createArrivalNotice(params: {
  orderSn: string;
  items: { sku: string; quantity: number; price: number }[];
  type?: 1 | 3 | 4; // 1=purchase, 3=return, 4=other
  remark?: string;
}): Promise<{ success: boolean; inboundSn?: string; message: string }> {
  try {
    const WAREHOUSE_ID = process.env.FLASH_FULFILLMENT_WAREHOUSE_ID || '';

    const goods = params.items.map((item, idx) => ({
      i: idx + 1,
      barCode: item.sku,
      num: item.quantity,
      price: Math.round(item.price * 100), // satang
    }));

    const body: Record<string, string | number> = {
      warehouseId: WAREHOUSE_ID,
      orderSn: params.orderSn,
      type: params.type || 1,
      goods: JSON.stringify(goods),
    };

    if (params.remark) body.remark = params.remark;

    const result = await post('/arrival_notice/create', body);
    if (!result) return { success: true, message: 'skipped (no credentials)' };

    if (result.code === 1) {
      return { success: true, inboundSn: result.data, message: 'Arrival notice created' };
    }
    return { success: false, message: result.msg || 'Unknown error' };
  } catch (err: any) {
    console.error('[Flash Fulfillment] createArrivalNotice error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * ดูสถานะ inbound จาก Flash Fulfillment
 * status: 10=รอตรวจ, 20=ตรวจแล้ว, 30=ถึงคลัง, 40=กำลังรับ, 50=รับสำเร็จ
 */
export async function getInboundStatus(inboundSn: string): Promise<{
  status: number;
  statusLabel: string;
  goods?: any[];
} | null> {
  const STATUS_LABELS: Record<number, string> = {
    10: 'รอตรวจสอบ',
    20: 'ตรวจสอบแล้ว',
    30: 'ถึงคลังแล้ว',
    40: 'กำลังรับเข้าคลัง',
    50: 'รับเข้าคลังสำเร็จ',
  };

  try {
    const result = await post('/Inbound/getInBoundDetail', { inboundSn });
    if (!result || result.code !== 1) return null;

    const data = result.data;
    return {
      status: data.status,
      statusLabel: STATUS_LABELS[data.status] || `status ${data.status}`,
      goods: data.goods,
    };
  } catch (err: any) {
    console.error('[Flash Fulfillment] getInboundStatus error:', err.message);
    return null;
  }
}

/**
 * ลงทะเบียนสินค้าใน Flash Fulfillment
 * barCode ใช้ sku ของสินค้า (ต้อง unique)
 */
export async function addGoods(product: {
  sku: string;
  name: string;
  price: number;
  weight?: number;
  imageUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const params: Record<string, string | number> = {
      barCode: product.sku,
      name: product.name,
      price: Math.round(product.price * 100), // satang
    };

    if (product.weight) params.weight = product.weight;
    if (product.imageUrl) params.image = product.imageUrl;

    const result = await post('/open/add_goods', params);
    if (!result) return { success: true, message: 'skipped (no credentials)' };

    if (result.code === 1) {
      return { success: true, message: 'Goods added to Flash Fulfillment' };
    }
    return { success: false, message: result.msg || 'Unknown error' };
  } catch (err: any) {
    console.error('[Flash Fulfillment] addGoods error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * แก้ไขสินค้าใน Flash Fulfillment
 */
export async function editGoods(product: {
  sku: string;
  name?: string;
  price?: number;
  weight?: number;
  imageUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const params: Record<string, string | number> = {
      barCode: product.sku,
    };

    if (product.name) params.name = product.name;
    if (product.price !== undefined) params.price = Math.round(product.price * 100);
    if (product.weight) params.weight = product.weight;
    if (product.imageUrl) params.image = product.imageUrl;

    const result = await post('/open/edit_goods', params);
    if (!result) return { success: true, message: 'skipped (no credentials)' };

    if (result.code === 1) {
      return { success: true, message: 'Goods updated in Flash Fulfillment' };
    }
    return { success: false, message: result.msg || 'Unknown error' };
  } catch (err: any) {
    console.error('[Flash Fulfillment] editGoods error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * ดู stock สินค้าจาก Flash Fulfillment
 */
export async function getStock(barCode: string): Promise<number | null> {
  try {
    const result = await post('/goods/list', { barCode, pageSize: 1 });
    if (!result || result.code !== 1) return null;

    const item = result.data?.list?.[0];
    return item?.stock ?? null;
  } catch (err: any) {
    console.error('[Flash Fulfillment] getStock error:', err.message);
    return null;
  }
}

/**
 * ดูสถานะ order จาก Flash Fulfillment ด้วย orderSn
 * status codes: 1001=อนุมัติ, 1005=รับพัสดุ, 1007=กำลังส่ง, 1009=ส่งสำเร็จ, 1011=ส่งคืน
 */
export async function getOrderStatus(orderSn: string): Promise<{
  success: boolean;
  deliverySn?: string;
  expressSn?: string;
  latestStatus?: number;
  delivered?: boolean;
  returned?: boolean;
} | null> {
  try {
    const result = await post('/order/getOrderStatusByNo', { orderSn });
    if (!result || result.code !== 1) return null;

    const data = result.data;
    const statusList: number[] = (data?.statusDetail || []).map((s: any) => s.status);
    const latestStatus = statusList[statusList.length - 1];

    return {
      success: true,
      deliverySn: data?.deliverySn,
      expressSn: data?.expressSn,
      latestStatus,
      delivered: latestStatus === 1009,
      returned: latestStatus === 1011,
    };
  } catch (err: any) {
    console.error('[Flash Fulfillment] getOrderStatus error:', err.message);
    return null;
  }
}

/**
 * สร้าง B2C delivery order ใน Flash Fulfillment หลังลูกค้าจ่ายเงินสำเร็จ
 */
export async function createB2COrder(params: {
  orderSn: string;
  consigneeName: string;
  phoneNumber: string;
  consigneeAddress: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  totalPrice: number; // บาท (จะแปลงเป็น satang อัตโนมัติ)
  items: { sku: string; quantity: number; price: number }[];
}): Promise<{ success: boolean; trackingNumber?: string; message: string }> {
  try {
    const STORE_CODE = process.env.FLASH_FULFILLMENT_STORE_CODE || '';

    const goodsJson = JSON.stringify(
      params.items.map((i) => ({
        barCode: i.sku,
        num: i.quantity,
        price: Math.round(i.price * 100), // satang
      }))
    );

    const body: Record<string, string | number> = {
      storeCode: STORE_CODE,
      orderSn: params.orderSn,
      consigneeName: params.consigneeName,
      phoneNumber: params.phoneNumber,
      consigneeAddress: params.consigneeAddress,
      province: params.province,
      city: params.city,
      district: params.district,
      postalCode: params.postalCode,
      logisticCharge: 5000, // 50 บาท = 5000 satang
      totalPrice: Math.round(params.totalPrice * 100),
      payMode: 3, // e-payment
      goodsList: goodsJson,
    };

    const result = await post('/Order/addOrder', body);
    if (!result) return { success: true, message: 'skipped (no credentials)' };

    if (result.code === 1) {
      return {
        success: true,
        trackingNumber: result.data,
        message: 'B2C order created',
      };
    }
    return { success: false, message: result.msg || result.message || 'Unknown error' };
  } catch (err: any) {
    console.error('[Flash Fulfillment] createB2COrder error:', err.message);
    return { success: false, message: err.message };
  }
}
