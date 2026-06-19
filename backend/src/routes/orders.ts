import { Router } from 'express';
import db from '../db/database.js';
import { refreshTokenIfNeeded, getClient, rateLimit } from '../services/etsy.js';

const router = Router();

router.get('/shop/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { limit = 25, offset = 0, status } = req.query;

    let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as any;
    if (!shop?.etsy_shop_id) return res.status(400).json({ error: 'Shop not connected' });

    shop = await refreshTokenIfNeeded(shop);
    const client = getClient(shop);
    await rateLimit(shopId);

    const params: Record<string, unknown> = { limit, offset };
    if (status) params.was_paid = status === 'paid' ? 'true' : undefined;

    const res2 = await client.get(`/application/shops/${shop.etsy_shop_id}/receipts`, { params });
    const orders = (res2.data.results || []).map((r: any) => ({
      id: String(r.receipt_id),
      receipt_id: r.receipt_id,
      status: r.status,
      total: parseFloat(r.grandtotal?.amount || '0') / (r.grandtotal?.divisor || 100),
      buyer_email: r.buyer_email,
      name: r.name,
      shipping_address: r.shipping_address,
      transactions: (r.transactions || []).map((t: any) => ({
        title: t.title,
        quantity: t.quantity,
        price: parseFloat(t.price?.amount || '0') / (t.price?.divisor || 100),
      })),
      created_at: r.create_timestamp,
    }));

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
