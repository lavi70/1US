import { Router } from 'express';
import axios from 'axios';
import { searchListings } from '../services/etsy.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { keyword, style, material, audience } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword is required' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'GEMINI_API_KEY לא מוגדר. הוסף אותו בהגדרות.' });
    }

    let marketContext = '';
    try {
      const market = await searchListings(keyword, undefined, { limit: 10, sort_on: 'score' });
      const listings = market.results || [];
      const prices = listings.map((l: any) => parseFloat(l.price?.amount || '0') / (l.price?.divisor || 100)).filter((p: number) => p > 0);
      const avgPrice = prices.length ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : 'unknown';
      const allTags = listings.flatMap((l: any) => l.tags || []);
      const tagFreq: Record<string, number> = {};
      allTags.forEach((t: string) => { tagFreq[t] = (tagFreq[t] || 0) + 1; });
      const topTags = Object.entries(tagFreq).sort(([, a], [, b]) => b - a).slice(0, 20).map(([t]) => t);
      const sampleTitles = listings.slice(0, 3).map((l: any) => l.title).join(' | ');
      marketContext = `Market data: avg price $${avgPrice}, top tags: ${topTags.join(', ')}, sample titles: ${sampleTitles}`;
    } catch {}

    const prompt = `You are an expert Etsy SEO specialist. Generate a high-converting Etsy listing for the following product.

Product: ${keyword}
${style ? `Style: ${style}` : ''}
${material ? `Material: ${material}` : ''}
${audience ? `Target audience: ${audience}` : ''}
${marketContext}

Respond in JSON format only:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "price_suggestion": { "min": 0, "max": 0, "recommended": 0 },
  "seo_notes": ["tip1", "tip2", "tip3"]
}`;

    const key = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${key}`;
    const geminiRes = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
    const content = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate
    if (!parsed.title || !parsed.tags || !Array.isArray(parsed.tags)) {
      throw new Error('Invalid AI response structure');
    }

    parsed.tags = parsed.tags.slice(0, 13).map((t: string) => String(t).toLowerCase().trim().slice(0, 20));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tag suggestions based on partial input + market data
router.post('/suggest-tags', async (req, res) => {
  try {
    const { keyword, existing_tags = [] } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const market = await searchListings(keyword, undefined, { limit: 25 });
    const listings = market.results || [];
    const tagFreq: Record<string, number> = {};
    for (const listing of listings) {
      for (const tag of listing.tags || []) {
        if (!existing_tags.includes(tag)) {
          tagFreq[tag] = (tagFreq[tag] || 0) + 1;
        }
      }
    }

    const suggestions = Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
