import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'etsy_manager.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    etsy_shop_id TEXT UNIQUE,
    etsy_user_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    proxy_url TEXT,
    proxy_username TEXT,
    proxy_password TEXT,
    status TEXT DEFAULT 'disconnected',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id),
    etsy_listing_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    quantity INTEGER DEFAULT 1,
    tags TEXT DEFAULT '[]',
    category_id INTEGER,
    who_made TEXT DEFAULT 'i_did',
    when_made TEXT DEFAULT 'made_to_order',
    is_supply INTEGER DEFAULT 0,
    shipping_profile_id TEXT,
    status TEXT DEFAULT 'draft',
    images TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS research_sessions (
    id TEXT PRIMARY KEY,
    shop_id TEXT REFERENCES shops(id),
    query TEXT NOT NULL,
    type TEXT NOT NULL,
    results TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    shop_id TEXT PRIMARY KEY,
    requests_this_second INTEGER DEFAULT 0,
    window_start INTEGER DEFAULT (unixepoch())
  );
`);

export default db;
