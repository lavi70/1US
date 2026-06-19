import { Router } from 'express';
import db from '../db/database.js';
import { refreshTokenIfNeeded, getClient, rateLimit } from '../services/etsy.js';

const router = Router();

router.get('/shop/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const days = Math.min(parseInt(String(req.query.days || '30')), 90);

    let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as any;
    if (!shop?.etsy_shop_id) return res.status(400).json({ error: 'Shop not connected' });

    shop = await refreshTokenIfNeeded(shop);
    const client = getClient(shop);

    const since = Math.floor(Date.now() / 1000) - days * 86400;

    // Get receipts (orders) in date range
    await rateLimit(shopId);
    const receiptsRes = await client.get(`/application/shops/${shop.etsy_shop_id}/receipts`, {
      params: { limit: 100, min_created: since, was_paid: true },
    });
    const receipts: any[] = receiptsRes.data.results || [];

    // Aggregate data
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    const revenueByListing: Record<string, { title: string; revenue: number; quantity: number }> = {};

    let totalRevenue = 0;
    let totalOrders = receipts.length;

    for (const receipt of receipts) {
      const date = new Date(receipt.create_timestamp * 1000).toISOString().slice(0, 10);
      const amount = parseFloat(receipt.grandtotal?.amount || '0') / (receipt.grandtotal?.divisor || 100);

      revenueByDay[date] = (revenueByDay[date] || 0) + amount;
      ordersByDay[date] = (ordersByDay[date] || 0) + 1;
      totalRevenue += amount;

      for (const t of receipt.transactions || []) {
        const key = String(t.listing_id);
        const price = parseFloat(t.price?.amount || '0') / (t.price?.divisor || 100) * (t.quantity || 1);
        if (!revenueByListing[key]) {
          revenueByListing[key] = { title: t.title || key, revenue: 0, quantity: 0 };
        }
        revenueByListing[key].revenue += price;
        revenueByListing[key].quantity += t.quantity || 1;
      }
    }

    // Fill in missing days
    const allDays: { date: string; revenue: number }[] = [];
    const allOrderDays: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      allDays.push({ date: d, revenue: revenueByDay[d] || 0 });
      allOrderDays.push({ date: d, count: ordersByDay[d] || 0 });
    }

    // Get active listings count
    await rateLimit(shopId);
    const listingsRes = await client.get(`/application/shops/${shop.etsy_shop_id}/listings`, {
      params: { limit: 1, state: 'active' },
    });
    const activeListings = listingsRes.data.count || 0;

    // Previous period for comparison
    const prevSince = since - days * 86400;
    await rateLimit(shopId);
    const prevRes = await client.get(`/application/shops/${shop.etsy_shop_id}/receipts`, {
      params: { limit: 100, min_created: prevSince, max_created: since, was_paid: true },
    });
    const prevReceipts: any[] = prevRes.data.results || [];
    const prevRevenue = prevReceipts.reduce((sum, r) => sum + parseFloat(r.grandtotal?.amount || '0') / (r.grandtotal?.divisor || 100), 0);
    const prevOrders = prevReceipts.length;

    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

    const topListings = Object.values(revenueByListing)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const revenueByListingArr = Object.values(revenueByListing)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    res.json({
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      active_listings: activeListings,
      avg_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      revenue_change: revenueChange,
      orders_change: ordersChange,
      revenue_by_day: allDays,
      orders_by_day: allOrderDays,
      top_listings: topListings,
      revenue_by_listing: revenueByListingArr,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
