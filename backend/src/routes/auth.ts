import { Router } from 'express';
import { buildAuthUrl, exchangeCode } from '../services/etsy.js';
import db from '../db/database.js';
import { randomBytes } from 'crypto';

const router = Router();

router.get('/url/:shopId', (req, res) => {
  const { shopId } = req.params;
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const state = randomBytes(16).toString('hex');
  const url = buildAuthUrl(shopId, state);
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/shops?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/shops?error=missing_params`);
  }

  const [shopId] = state.split(':');

  try {
    await exchangeCode(code, shopId);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-callback?connected=${shopId}`);
  } catch (err: any) {
    console.error('OAuth callback error:', err.message, err.response?.data);
    const msg = encodeURIComponent(err.response?.data?.error_description || err.message || 'auth_failed');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-callback?error=${msg}`);
  }
});

router.post('/disconnect/:shopId', (req, res) => {
  const { shopId } = req.params;
  db.prepare(`
    UPDATE shops SET access_token = NULL, refresh_token = NULL, token_expires_at = NULL,
    etsy_shop_id = NULL, status = 'disconnected', updated_at = unixepoch()
    WHERE id = ?
  `).run(shopId);
  res.json({ success: true });
});

export default router;
