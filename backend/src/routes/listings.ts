import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { createListing, updateListing, deleteListing, getShopListings, uploadListingImage } from '../services/etsy.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Get listings for a shop
router.get('/shop/:shopId', (req, res) => {
  const { shopId } = req.params;
  const { status } = req.query;
  let query = 'SELECT * FROM listings WHERE shop_id = ?';
  const params: any[] = [shopId];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  const listings = db.prepare(query).all(...params).map((l: any) => ({
    ...l,
    tags: JSON.parse(l.tags || '[]'),
    images: JSON.parse(l.images || '[]'),
  }));
  res.json(listings);
});

// Sync listings from Etsy
router.post('/shop/:shopId/sync', async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as any;
    if (!shop?.etsy_shop_id) return res.status(400).json({ error: 'Shop not connected to Etsy' });

    const data = await getShopListings(shopId, { limit: 100, state: 'active' });
    let synced = 0;
    for (const listing of data.results || []) {
      const existing = db.prepare('SELECT id FROM listings WHERE etsy_listing_id = ?').get(String(listing.listing_id));
      if (!existing) {
        db.prepare(`
          INSERT INTO listings (id, shop_id, etsy_listing_id, title, description, price, quantity, tags, status, images)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(), shopId, String(listing.listing_id),
          listing.title, listing.description,
          parseFloat(listing.price?.amount || '0') / (listing.price?.divisor || 100),
          listing.quantity || 1,
          JSON.stringify(listing.tags || []),
          listing.state || 'active',
          JSON.stringify([listing.main_image?.url_570xN].filter(Boolean))
        );
        synced++;
      }
    }
    res.json({ synced, total: data.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create listing (local draft)
router.post('/shop/:shopId', (req, res) => {
  const { shopId } = req.params;
  const { title, description, price, quantity, tags, category_id, who_made, when_made, is_supply, shipping_profile_id } = req.body;

  if (!title || !price) return res.status(400).json({ error: 'Title and price are required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO listings (id, shop_id, title, description, price, quantity, tags, category_id, who_made, when_made, is_supply, shipping_profile_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(id, shopId, title, description || '', price, quantity || 1,
         JSON.stringify(tags || []), category_id || null,
         who_made || 'i_did', when_made || 'made_to_order',
         is_supply ? 1 : 0, shipping_profile_id || null);

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as any;
  res.status(201).json({ ...listing, tags: JSON.parse(listing.tags), images: JSON.parse(listing.images || '[]') });
});

// Update listing
router.put('/:id', (req, res) => {
  const { title, description, price, quantity, tags, status, category_id, who_made, when_made, is_supply, shipping_profile_id } = req.body;
  db.prepare(`
    UPDATE listings SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      quantity = COALESCE(?, quantity),
      tags = COALESCE(?, tags),
      status = COALESCE(?, status),
      category_id = COALESCE(?, category_id),
      who_made = COALESCE(?, who_made),
      when_made = COALESCE(?, when_made),
      is_supply = COALESCE(?, is_supply),
      shipping_profile_id = COALESCE(?, shipping_profile_id),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(title || null, description || null, price || null, quantity || null,
         tags ? JSON.stringify(tags) : null, status || null,
         category_id || null, who_made || null, when_made || null,
         is_supply != null ? (is_supply ? 1 : 0) : null,
         shipping_profile_id || null, req.params.id);

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as any;
  res.json({ ...listing, tags: JSON.parse(listing.tags || '[]'), images: JSON.parse(listing.images || '[]') });
});

// Upload image to a listing
router.post('/:id/images', upload.single('image'), async (req, res) => {
  try {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as any;
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Optimize image: max 3000x3000, JPEG, quality 90 (Etsy requirement)
    const optimized = await sharp(req.file.buffer)
      .resize(3000, 3000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    let imageUrl = '';

    // If listing is published on Etsy, upload there too
    if (listing.etsy_listing_id && listing.status !== 'draft') {
      const result = await uploadListingImage(listing.shop_id, listing.etsy_listing_id, optimized, 'image/jpeg');
      imageUrl = result.url_570xN || result.url_fullxfull || '';
    } else {
      // Store locally (in a real app, use cloud storage)
      imageUrl = `data:image/jpeg;base64,${optimized.toString('base64').substring(0, 100)}...`;
    }

    const images = JSON.parse(listing.images || '[]');
    images.push(imageUrl);
    db.prepare('UPDATE listings SET images = ?, updated_at = unixepoch() WHERE id = ?')
      .run(JSON.stringify(images), req.params.id);

    res.json({ success: true, image_url: imageUrl, images });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Publish listing to Etsy
router.post('/:id/publish', async (req, res) => {
  try {
    const listing = db.prepare('SELECT l.*, s.etsy_shop_id FROM listings l JOIN shops s ON l.shop_id = s.id WHERE l.id = ?').get(req.params.id) as any;
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (!listing.etsy_shop_id) return res.status(400).json({ error: 'Shop not connected to Etsy' });

    const etsyData = {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      quantity: listing.quantity,
      tags: JSON.parse(listing.tags || '[]'),
      who_made: listing.who_made,
      when_made: listing.when_made,
      is_supply: listing.is_supply === 1,
      taxonomy_id: listing.category_id || 1,
      shipping_profile_id: listing.shipping_profile_id ? parseInt(listing.shipping_profile_id) : undefined,
      type: 'physical',
      state: 'active',
    };

    const result = await createListing(listing.shop_id, etsyData);
    db.prepare('UPDATE listings SET etsy_listing_id = ?, status = ?, updated_at = unixepoch() WHERE id = ?')
      .run(String(result.listing_id), 'active', req.params.id);

    res.json({ success: true, etsy_listing_id: result.listing_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete listing
router.delete('/:id', async (req, res) => {
  try {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as any;
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.etsy_listing_id) {
      await deleteListing(listing.shop_id, listing.etsy_listing_id);
    }
    db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
