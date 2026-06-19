import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import db from '../db/database.js';

const ETSY_BASE = 'https://openapi.etsy.com/v3';
const ETSY_AUTH = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN = 'https://api.etsy.com/v3/public/oauth/token';

export interface Shop {
  id: string;
  name: string;
  etsy_shop_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  proxy_url: string | null;
  proxy_username: string | null;
  proxy_password: string | null;
  status: string;
}

function buildProxyAgent(shop: Shop) {
  if (!shop.proxy_url) return undefined;
  let url = shop.proxy_url;
  if (shop.proxy_username && shop.proxy_password) {
    const u = new URL(url);
    u.username = encodeURIComponent(shop.proxy_username);
    u.password = encodeURIComponent(shop.proxy_password);
    url = u.toString();
  }
  return new HttpsProxyAgent(url);
}

function getClient(shop: Shop): AxiosInstance {
  const agent = buildProxyAgent(shop);
  return axios.create({
    baseURL: ETSY_BASE,
    httpsAgent: agent,
    httpAgent: agent,
    headers: {
      Authorization: `Bearer ${shop.access_token}`,
      'x-api-key': process.env.ETSY_API_KEY || '',
    },
    timeout: 15000,
  });
}

// Rate limiter: max 10 req/sec per shop (Etsy limit)
async function rateLimit(shopId: string) {
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM rate_limits WHERE shop_id = ?').get(shopId) as any;
  if (!row || row.window_start < now) {
    db.prepare('INSERT OR REPLACE INTO rate_limits (shop_id, requests_this_second, window_start) VALUES (?, 1, ?)').run(shopId, now);
    return;
  }
  if (row.requests_this_second >= 9) {
    await new Promise(r => setTimeout(r, 1000 - (Date.now() % 1000) + 50));
    db.prepare('INSERT OR REPLACE INTO rate_limits (shop_id, requests_this_second, window_start) VALUES (?, 1, ?)').run(shopId, Math.floor(Date.now() / 1000));
    return;
  }
  db.prepare('UPDATE rate_limits SET requests_this_second = requests_this_second + 1 WHERE shop_id = ?').run(shopId);
}

async function refreshTokenIfNeeded(shop: Shop): Promise<Shop> {
  if (!shop.token_expires_at || !shop.refresh_token) return shop;
  const expiresIn = shop.token_expires_at - Math.floor(Date.now() / 1000);
  if (expiresIn > 300) return shop;

  const agent = buildProxyAgent(shop);
  const res = await axios.post(ETSY_TOKEN, new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ETSY_API_KEY || '',
    refresh_token: shop.refresh_token,
  }), { httpsAgent: agent, httpAgent: agent });

  const { access_token, refresh_token, expires_in } = res.data;
  const expires_at = Math.floor(Date.now() / 1000) + expires_in;

  db.prepare(`
    UPDATE shops SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(access_token, refresh_token, expires_at, shop.id);

  return { ...shop, access_token, refresh_token, token_expires_at: expires_at };
}

export function buildAuthUrl(shopId: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.ETSY_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
    scope: 'listings_r listings_w listings_d shops_r shops_w transactions_r profile_r',
    client_id: process.env.ETSY_API_KEY || '',
    state: `${shopId}:${state}`,
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  });
  return `${ETSY_AUTH}?${params.toString()}`;
}

export async function exchangeCode(code: string, shopId: string): Promise<void> {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  const agent = buildProxyAgent(shop);

  const res = await axios.post(ETSY_TOKEN, new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ETSY_API_KEY || '',
    redirect_uri: process.env.ETSY_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
    code,
    code_verifier: 'challenge',
  }), { httpsAgent: agent, httpAgent: agent });

  const { access_token, refresh_token, expires_in } = res.data;
  const expires_at = Math.floor(Date.now() / 1000) + expires_in;

  db.prepare(`
    UPDATE shops SET access_token = ?, refresh_token = ?, token_expires_at = ?, status = 'connected', updated_at = unixepoch()
    WHERE id = ?
  `).run(access_token, refresh_token, expires_at, shopId);

  // Fetch and store Etsy shop info
  await fetchAndStoreShopInfo(shopId);
}

async function fetchAndStoreShopInfo(shopId: string): Promise<void> {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  const client = getClient(shop);
  await rateLimit(shopId);
  const me = await client.get('/application/openapi-ping');
  // After successful auth, get user's shop
  const userRes = await client.get('/application/users/me');
  const userId = userRes.data.user_id;
  await rateLimit(shopId);
  const shopsRes = await client.get(`/application/users/${userId}/shops`);
  if (shopsRes.data?.shop_id) {
    db.prepare('UPDATE shops SET etsy_shop_id = ?, etsy_user_id = ? WHERE id = ?')
      .run(String(shopsRes.data.shop_id), String(userId), shopId);
  }
}

export async function getShopListings(shopId: string, params: { limit?: number; offset?: number; state?: string } = {}) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  const { limit = 25, offset = 0, state = 'active' } = params;
  const res = await client.get(`/application/shops/${shop.etsy_shop_id}/listings`, {
    params: { limit, offset, state },
  });
  return res.data;
}

export async function createListing(shopId: string, data: Record<string, unknown>) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  const res = await client.post(`/application/shops/${shop.etsy_shop_id}/listings`, data);
  return res.data;
}

export async function uploadListingImage(shopId: string, listingId: string, imageBuffer: Buffer, mimeType: string) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const form = new (await import('form-data')).default();
  form.append('image', imageBuffer, { filename: 'image.jpg', contentType: mimeType });
  await rateLimit(shopId);
  const agent = buildProxyAgent(shop);
  const res = await axios.post(
    `${ETSY_BASE}/application/shops/${shop.etsy_shop_id}/listings/${listingId}/images`,
    form,
    {
      httpsAgent: agent,
      httpAgent: agent,
      headers: {
        Authorization: `Bearer ${shop.access_token}`,
        'x-api-key': process.env.ETSY_API_KEY || '',
        ...(form as any).getHeaders(),
      },
    }
  );
  return res.data;
}

export async function updateListing(shopId: string, listingId: string, data: Record<string, unknown>) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  const res = await client.patch(`/application/shops/${shop.etsy_shop_id}/listings/${listingId}`, data);
  return res.data;
}

export async function deleteListing(shopId: string, listingId: string) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  await client.delete(`/application/listings/${listingId}`);
}

export async function searchListings(query: string, shopId?: string, params: Record<string, unknown> = {}) {
  let axiosConfig: Record<string, unknown> = {
    baseURL: ETSY_BASE,
    headers: { 'x-api-key': process.env.ETSY_API_KEY || '' },
    timeout: 15000,
  };

  if (shopId) {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
    const agent = buildProxyAgent(shop);
    if (agent) {
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
    }
    await rateLimit(shopId);
  }

  const client = axios.create(axiosConfig as any);
  const res = await client.get('/application/listings/active', {
    params: { keywords: query, limit: 25, ...params },
  });
  return res.data;
}

export async function getShopInfo(shopId: string) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  const res = await client.get(`/application/shops/${shop.etsy_shop_id}`);
  return res.data;
}

export async function getShippingProfiles(shopId: string) {
  let shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
  shop = await refreshTokenIfNeeded(shop);
  const client = getClient(shop);
  await rateLimit(shopId);
  const res = await client.get(`/application/shops/${shop.etsy_shop_id}/shipping-profiles`);
  return res.data;
}

export async function getListingsByShopExternal(etsyShopId: string, shopId?: string) {
  let axiosConfig: Record<string, unknown> = {
    baseURL: ETSY_BASE,
    headers: { 'x-api-key': process.env.ETSY_API_KEY || '' },
    timeout: 15000,
  };

  if (shopId) {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as Shop;
    const agent = buildProxyAgent(shop);
    if (agent) {
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
    }
    await rateLimit(shopId);
  }

  const client = axios.create(axiosConfig as any);
  const res = await client.get(`/application/shops/${etsyShopId}/listings/active`, {
    params: { limit: 25, includes: ['Images', 'MainImage'] },
  });
  return res.data;
}
