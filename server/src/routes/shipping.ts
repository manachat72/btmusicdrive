import { Router, Response } from 'express';

const router = Router();

// Shipping routes removed — SHIPPOP integration discontinued.
// Tracking is managed via admin panel (manual carrier + tracking number).

export default router;

// ── Helper: SHIPPOP request ───────────────────────────────────────────────────
async function shippopRequest(endpoint: string, method: 'GET' | 'POST', body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'api-key': SHIPPOP_API_KEY,
  };
  const res = await fetch(`${SHIPPOP_API_URL}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

// ── POST /api/shipping/booking ────────────────────────────────────────────────
// สร้าง Booking + จอง SHIPPOP แล้วบันทึก tracking กลับที่ order
router.post('/booking', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const { orderId, courierCode } = req.body;
    if (!orderId || !courierCode) {
      return res.status(400).json({ error: 'orderId และ courierCode จำเป็น' });
    }

    // ดึงข้อมูล order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true, email: true } },
      },
    }) as any;

    if (!order) return res.status(404).json({ error: 'ไม่พบ order' });

    const itemDesc = order.items.map((i: any) => i.product.name).join(', ').substring(0, 100);
    const totalWeight = order.items.reduce((sum: number, i: any) => sum + (i.quantity * 0.1), 0) || 0.5;

    // Parse shipping address
    const addressParts = (order.shippingAddress || '').split(',').map((s: string) => s.trim());

    const bookingPayload = {
      data: [
        {
          courier_code: courierCode,
          from: {
            name: 'btmusicdrive',
            address: '123 ถนนสุขุมวิท',
            district: 'คลองเตย',
            state: 'กรุงเทพมหานคร',
            postcode: '10110',
            tel: '0800000000',
          },
          to: {
            name: order.user?.name || 'ลูกค้า',
            address: addressParts[0] || '',
            district: addressParts[2] || '',
            state: addressParts[3] || '',
            postcode: addressParts[4] || '',
            tel: order.phone || '0800000000',
          },
          parcel: {
            name: itemDesc,
            weight: totalWeight,
            width: 20,
            length: 20,
            height: 10,
          },
          cod_amount: 0,
          remark: `Order #${order.id.slice(-8).toUpperCase()}`,
          url_callback: CALLBACK_URL,
        },
      ],
      email: SHIPPOP_EMAIL,
    };

    const result = await shippopRequest('/purchase/order/', 'POST', bookingPayload);

    if (!result?.data?.[0]) {
      console.error('[SHIPPOP] Booking error:', result);
      return res.status(400).json({ error: result?.message || 'SHIPPOP booking ล้มเหลว', detail: result });
    }

    const bookingData = result.data[0];
    const purchaseId  = String(bookingData.purchase_id || '');
    const trackingCode = bookingData.tracking_code || '';
    const courierName  = bookingData.courier_code || courierCode;

    // บันทึก tracking กลับที่ order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: trackingCode,
        carrier: courierName,
        status: 'SHIPPED',
      },
    });

    return res.json({
      success: true,
      purchaseId,
      trackingCode,
      courierCode: courierName,
      raw: bookingData,
    });

  } catch (error: any) {
    console.error('[SHIPPOP] booking error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── POST /api/shipping/confirm ────────────────────────────────────────────────
// ยืนยัน booking (จำเป็นก่อน get label)
router.post('/confirm', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const { purchaseId } = req.body;
    if (!purchaseId) return res.status(400).json({ error: 'purchaseId จำเป็น' });

    const result = await shippopRequest(`/purchase/order/${purchaseId}/confirm/`, 'POST');

    if (result?.status !== 'success' && !result?.data) {
      return res.status(400).json({ error: result?.message || 'ยืนยัน booking ล้มเหลว', detail: result });
    }

    return res.json({ success: true, raw: result });

  } catch (error: any) {
    console.error('[SHIPPOP] confirm error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── GET /api/shipping/label/:purchaseId ───────────────────────────────────────
// ดึง Label URL สำหรับพิมพ์
router.get('/label/:purchaseId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const { purchaseId } = req.params;
    const paperSize = (req.query.size as string) || 'A4'; // A4 หรือ THERMAL

    const result = await shippopRequest(`/purchase/order/${purchaseId}/label/?paper_size=${paperSize}`, 'GET');

    if (!result?.data?.label_url && !result?.label_url) {
      return res.status(400).json({ error: result?.message || 'ดึง label ไม่สำเร็จ', detail: result });
    }

    const labelUrl = result?.data?.label_url || result?.label_url;
    return res.json({ success: true, labelUrl });

  } catch (error: any) {
    console.error('[SHIPPOP] label error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── GET /api/shipping/rates ───────────────────────────────────────────────────
// ดึงราคาขนส่งทั้งหมดที่มี
router.post('/rates', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const { weight = 0.5, from_postcode = '10110', to_postcode } = req.body;
    if (!to_postcode) return res.status(400).json({ error: 'to_postcode จำเป็น' });

    const result = await shippopRequest('/purchase/price/', 'POST', {
      from: { postcode: from_postcode },
      to: { postcode: to_postcode },
      parcel: { weight },
      email: SHIPPOP_EMAIL,
    });

    return res.json(result);

  } catch (error: any) {
    console.error('[SHIPPOP] rates error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── POST /api/shipping/callback ───────────────────────────────────────────────
// SHIPPOP Webhook — รับสถานะพัสดุแบบ real-time
router.post('/callback', async (req: any, res: Response) => {
  try {
    // Verify webhook secret if configured
    if (SHIPPOP_WEBHOOK_SECRET) {
      const secret = req.query?.secret || req.headers['x-webhook-secret'];
      if (secret !== SHIPPOP_WEBHOOK_SECRET) {
        console.warn('[SHIPPOP Callback] Invalid webhook secret');
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const body = req.body;
    console.log('[SHIPPOP Callback]', JSON.stringify(body));

    // SHIPPOP ส่งข้อมูลในรูปแบบ:
    // { tracking_code, status, status_text, courier_code, purchase_id, ... }
    const trackingCode = body?.tracking_code || body?.trackingCode || '';
    const statusText   = body?.status_text || body?.statusText || '';
    const rawStatus    = body?.status || '';

    if (!trackingCode) {
      return res.status(200).json({ received: true }); // ตอบ 200 เสมอเพื่อไม่ให้ SHIPPOP retry
    }

    // Map SHIPPOP status -> ระบบเรา
    let orderStatus: string | null = null;
    const s = String(rawStatus).toLowerCase();
    if (s === 'delivered' || statusText.includes('ส่งสำเร็จ') || statusText.includes('delivered')) {
      orderStatus = 'DELIVERED';
    } else if (s === 'returned' || statusText.includes('คืน') || statusText.includes('return')) {
      orderStatus = 'CANCELLED';
    } else if (s === 'shipping' || statusText.includes('กำลังขนส่ง') || statusText.includes('transit')) {
      orderStatus = 'SHIPPED';
    }

    if (orderStatus) {
      await prisma.order.updateMany({
        where: { trackingNumber: trackingCode },
        data: { status: orderStatus as any },
      });
      console.log(`[SHIPPOP Callback] updated order tracking=${trackingCode} → ${orderStatus}`);
    }

    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('[SHIPPOP Callback] error:', error);
    return res.status(200).json({ received: true }); // ตอบ 200 เสมอ
  }
});

export default router;
