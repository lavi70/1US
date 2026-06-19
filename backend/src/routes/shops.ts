import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { getShopInfo, getShippingProfiles } from '../services/etsy.js';

const router = Router();

router.get('/', (req, res) => {
  const shops = db.prepare(`
    SELECT id, name, etsy_shop_id, etsy_user_id, status,
           proxy_url, proxy_username,
           CASE WHEN access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
           created_at, updated_at
    FROM shops ORDER BY created_at DESC
  `).all();
  res.json(shops);
});

router.get('/:id', (req, res) => {
  const shop = db.prepare(`
    SELECT id, name, etsy_shop_id, etsy_user_id, status,
           proxy_url, proxy_username,
           CASE WHEN access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
           created_at, updated_at
    FROM shops WHERE id = ?
  `).get(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

router.post('/', (req, res) => {
  const { name, proxy_url, proxy_username, proxy_password } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO shops (id, name, proxy_url, proxy_username, proxy_password)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, proxy_url || null, proxy_username || null, proxy_password || null);

  const shop = db.prepare('SELECT id, name, etsy_shop_id, status, proxy_url FROM shops WHERE id = ?').get(id);
  res.status(201).json(shop);
});

router.put('/:id', (req, res) => {
  const { name, proxy_url, proxy_username, proxy_password } = req.body;
  const { id } = req.params;

  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  db.prepare(`
    UPDATE shops SET
      name = COALESCE(?, name),
      proxy_url = ?,
      proxy_username = ?,
      proxy_password = CASE WHEN ? IS NOT NULL THEN ? ELSE proxy_password END,
      updated_at = unixepoch()
    WHERE id = ?
  `).run(name || null, proxy_url ?? null, proxy_username ?? null,
         proxy_password || null, proxy_password || null, id);

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM listings WHERE shop_id = ?').run(req.params.id);
  db.prepare('DELETE FROM research_sessions WHERE shop_id = ?').run(req.params.id);
  db.prepare('DELETE FROM shops WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/etsy-info', async (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id) as any;
    if (!shop?.etsy_shop_id) return res.status(400).json({ error: 'Shop not connected' });
    const info = await getShopInfo(req.params.id);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/shipping-profiles', async (req, res) => {
  try {
    const data = await getShippingProfiles(req.params.id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
