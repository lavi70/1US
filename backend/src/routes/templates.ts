import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';

const router = Router();

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    price REAL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    who_made TEXT DEFAULT 'i_did',
    when_made TEXT DEFAULT 'made_to_order',
    is_supply INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

router.get('/', (req, res) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all().map((t: any) => ({
    ...t,
    tags: JSON.parse(t.tags || '[]'),
  }));
  res.json(templates);
});

router.post('/', (req, res) => {
  const { name, title, description, price, tags, who_made, when_made, is_supply } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO templates (id, name, title, description, price, tags, who_made, when_made, is_supply)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, title || '', description || '', price || 0,
         JSON.stringify(tags || []), who_made || 'i_did',
         when_made || 'made_to_order', is_supply ? 1 : 0);
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  res.status(201).json({ ...tpl, tags: JSON.parse(tpl.tags) });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
