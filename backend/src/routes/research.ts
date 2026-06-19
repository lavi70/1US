import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { analyzeKeyword, analyzeCompetitor, multiKeywordAnalysis, findTrendingTags } from '../services/research.js';

const router = Router();

router.post('/keyword', async (req, res) => {
  try {
    const { keyword, shop_id } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    const data = await analyzeKeyword(keyword, shop_id);

    if (shop_id) {
      db.prepare('INSERT INTO research_sessions (id, shop_id, query, type, results) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), shop_id, keyword, 'keyword', JSON.stringify(data));
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/keywords/bulk', async (req, res) => {
  try {
    const { keywords, shop_id } = req.body;
    if (!keywords?.length) return res.status(400).json({ error: 'Keywords array is required' });
    if (keywords.length > 10) return res.status(400).json({ error: 'Max 10 keywords at once' });

    const results = await multiKeywordAnalysis(keywords, shop_id);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/competitor', async (req, res) => {
  try {
    const { shop_name, shop_id } = req.body;
    if (!shop_name) return res.status(400).json({ error: 'shop_name is required' });

    const data = await analyzeCompetitor(shop_name, shop_id);

    if (shop_id) {
      db.prepare('INSERT INTO research_sessions (id, shop_id, query, type, results) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), shop_id, shop_name, 'competitor', JSON.stringify(data));
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trends', async (req, res) => {
  try {
    const { keyword, shop_id } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });
    const data = await findTrendingTags(keyword, shop_id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:shopId', (req, res) => {
  const sessions = db.prepare(`
    SELECT id, query, type, created_at FROM research_sessions
    WHERE shop_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.params.shopId);
  res.json(sessions);
});

router.get('/history/:shopId/:sessionId', (req, res) => {
  const session = db.prepare('SELECT * FROM research_sessions WHERE id = ? AND shop_id = ?')
    .get(req.params.sessionId, req.params.shopId) as any;
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ ...session, results: JSON.parse(session.results || '{}') });
});

export default router;
