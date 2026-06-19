import { searchListings, getListingsByShopExternal } from './etsy.js';

export interface KeywordData {
  keyword: string;
  listing_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  top_listings: TopListing[];
  tag_frequency: Record<string, number>;
  price_distribution: PriceBucket[];
}

export interface TopListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  shop_name: string;
  views: number;
  num_favorers: number;
  images: string[];
  tags: string[];
  url: string;
}

export interface PriceBucket {
  range: string;
  count: number;
  min: number;
  max: number;
}

export interface CompetitorData {
  shop_name: string;
  listing_count: number;
  avg_price: number;
  listings: TopListing[];
  common_tags: string[];
  price_range: { min: number; max: number };
}

function buildPriceDistribution(prices: number[]): PriceBucket[] {
  if (!prices.length) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const bucketSize = range / 5;

  const buckets: PriceBucket[] = Array.from({ length: 5 }, (_, i) => ({
    range: `$${(min + i * bucketSize).toFixed(0)}-$${(min + (i + 1) * bucketSize).toFixed(0)}`,
    count: 0,
    min: min + i * bucketSize,
    max: min + (i + 1) * bucketSize,
  }));

  for (const price of prices) {
    const idx = Math.min(Math.floor((price - min) / bucketSize), 4);
    buckets[idx].count++;
  }

  return buckets;
}

function extractListingData(listing: any): TopListing {
  const price = parseFloat(listing.price?.amount) / (listing.price?.divisor || 100);
  const image = listing.main_image?.url_570xN || listing.images?.[0]?.url_570xN || '';
  return {
    id: String(listing.listing_id),
    title: listing.title || '',
    price,
    currency: listing.price?.currency_code || 'USD',
    shop_name: listing.shop?.shop_name || listing.seller_user_id || '',
    views: listing.views || 0,
    num_favorers: listing.num_favorers || 0,
    images: image ? [image] : [],
    tags: listing.tags || [],
    url: `https://www.etsy.com/listing/${listing.listing_id}`,
  };
}

export async function analyzeKeyword(keyword: string, shopId?: string): Promise<KeywordData> {
  const results = await searchListings(keyword, shopId, { limit: 25, sort_on: 'score' });
  const listings: any[] = results.results || [];

  const prices = listings.map(l => parseFloat(l.price?.amount || '0') / (l.price?.divisor || 100)).filter(p => p > 0);
  const tagFreq: Record<string, number> = {};

  for (const listing of listings) {
    for (const tag of listing.tags || []) {
      tagFreq[tag] = (tagFreq[tag] || 0) + 1;
    }
  }

  return {
    keyword,
    listing_count: results.count || listings.length,
    avg_price: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    min_price: prices.length ? Math.min(...prices) : 0,
    max_price: prices.length ? Math.max(...prices) : 0,
    top_listings: listings.slice(0, 10).map(extractListingData),
    tag_frequency: Object.fromEntries(
      Object.entries(tagFreq).sort(([, a], [, b]) => b - a).slice(0, 20)
    ),
    price_distribution: buildPriceDistribution(prices),
  };
}

export async function analyzeCompetitor(etsyShopName: string, shopId?: string): Promise<CompetitorData> {
  // Search for the shop's listings
  const results = await getListingsByShopExternal(etsyShopName, shopId);
  const listings: any[] = results.results || [];

  const prices = listings.map(l => parseFloat(l.price?.amount || '0') / (l.price?.divisor || 100)).filter(p => p > 0);
  const tagFreq: Record<string, number> = {};

  for (const listing of listings) {
    for (const tag of listing.tags || []) {
      tagFreq[tag] = (tagFreq[tag] || 0) + 1;
    }
  }

  const commonTags = Object.entries(tagFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([tag]) => tag);

  return {
    shop_name: etsyShopName,
    listing_count: results.count || listings.length,
    avg_price: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    listings: listings.slice(0, 20).map(extractListingData),
    common_tags: commonTags,
    price_range: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
  };
}

export async function multiKeywordAnalysis(keywords: string[], shopId?: string) {
  const results = await Promise.all(
    keywords.map(kw => analyzeKeyword(kw, shopId).catch(err => ({ keyword: kw, error: err.message })))
  );
  return results;
}

export async function findTrendingTags(keyword: string, shopId?: string) {
  const data = await analyzeKeyword(keyword, shopId);
  const trending = Object.entries(data.tag_frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 13)
    .map(([tag, count]) => ({ tag, count, relevance: count / (data.top_listings.length || 1) }));
  return { keyword, trending_tags: trending, total_listings: data.listing_count };
}
