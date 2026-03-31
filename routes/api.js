const express = require('express');
const router  = express.Router();
const { v4: uuid } = require('uuid');
const db = require('../db/database');
const { scrapeProduct } = require('../services/scraper');

router.post('/product', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    let product = await db.getProductByUrl(url);
    if (!product) {
      const scraped = await scrapeProduct(url);
      const id = uuid();
      await db.insertProduct({ id, url, name: scraped.name, platform: scraped.platform, image_url: scraped.image || null });
      await db.insertPricePoint({ product_id: id, price: scraped.price });
      product = await db.getProduct(id);
    }
    const history  = await db.getPriceHistory(product.id);
    const latest   = await db.getLatestPrice(product.id);
    const prices   = history.map(h => h.price);
    const allTimeLow  = prices.length ? Math.min(...prices) : 0;
    const allTimeHigh = prices.length ? Math.max(...prices) : 0;
    const range       = (allTimeHigh - allTimeLow) || 1;
    const dealScore   = Math.round(Math.max(0, Math.min(100, ((allTimeHigh - (latest?.price || 0)) / range) * 100)));
    return res.json({
      id: product.id, url: product.url, name: product.name,
      platform: product.platform, image_url: product.image_url,
      current_price: latest?.price || 0,
      all_time_low: allTimeLow, all_time_high: allTimeHigh,
      deal_score: dealScore, price_history: history,
    });
  } catch (err) {
    console.error('Product fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/watch', async (req, res) => {
  const { product_id, fcm_token, wait_window_hours } = req.body;
  console.log('Watch request received:', req.body);
  if (!product_id || !fcm_token || !wait_window_hours)
    return res.status(400).json({ error: 'product_id, fcm_token, wait_window_hours required' });
  const product = await db.getProduct(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const latest       = await db.getLatestPrice(product_id);
  const currentPrice = latest?.price || 0;
  const expiresAt    = new Date(Date.now() + wait_window_hours * 3600 * 1000).toISOString();
  const id           = uuid();
  await db.insertWatch({ id, product_id, fcm_token, wait_window_hours, expires_at: expiresAt, lowest_seen_price: currentPrice });
  return res.json({ id, product_id, expires_at: expiresAt, lowest_seen_price: currentPrice });
});

router.get('/watches', async (req, res) => {
  const { fcm_token } = req.query;
  if (!fcm_token) return res.status(400).json({ error: 'fcm_token required' });
  return res.json(await db.getWatchesByToken(fcm_token));
});

router.post('/watch/:id/bought', async (req, res) => {
  const watch = await db.getWatch(req.params.id);
  if (!watch) return res.status(404).json({ error: 'Watch not found' });
  await db.markWatchBought(req.params.id);
  return res.json({ success: true });
});

router.post('/watch/:id/extend', async (req, res) => {
  const { wait_window_hours } = req.body;
  if (!wait_window_hours) return res.status(400).json({ error: 'wait_window_hours required' });
  const watch = await db.getWatch(req.params.id);
  if (!watch) return res.status(404).json({ error: 'Watch not found' });
  const newExpiry = new Date(Date.now() + wait_window_hours * 3600 * 1000).toISOString();
  await db.extendWatch(newExpiry, wait_window_hours, req.params.id);
  return res.json({ success: true, expires_at: newExpiry });
});

router.delete('/watch/:id', async (req, res) => {
  const watch = await db.getWatch(req.params.id);
  if (!watch) return res.status(404).json({ error: 'Watch not found' });
  await db.deleteWatch(req.params.id);
  return res.json({ success: true });
});

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

module.exports = router;
