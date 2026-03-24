// db/database.js — plain JSON file, no dependencies needed
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './holdout.db.json');

const DEFAULT = { products: [], price_points: [], watches: [] };

function load() {
  if (!fs.existsSync(DB_PATH)) return { ...DEFAULT };
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { ...DEFAULT }; }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function initDb() {
  if (!fs.existsSync(DB_PATH)) save(DEFAULT);
  console.log('✅ Database ready at', DB_PATH);
}

// ─── Products ─────────────────────────────────────────────────────────────────

function getProduct(id) {
  return load().products.find(p => p.id === id) || null;
}

function getProductByUrl(url) {
  return load().products.find(p => p.url === url) || null;
}

function insertProduct({ id, url, name, platform, image_url }) {
  const data = load();
  if (data.products.find(p => p.url === url)) return;
  data.products.push({ id, url, name, platform, image_url, created_at: new Date().toISOString() });
  save(data);
}

// ─── Price Points ─────────────────────────────────────────────────────────────

function insertPricePoint({ product_id, price }) {
  const data = load();
  data.price_points.push({ id: Date.now(), product_id, price, checked_at: new Date().toISOString() });
  save(data);
}

function getPriceHistory(product_id) {
  return load().price_points
    .filter(p => p.product_id === product_id)
    .sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at))
    .slice(-720);
}

function getLatestPrice(product_id) {
  const pts = load().price_points.filter(p => p.product_id === product_id);
  if (!pts.length) return null;
  return pts.sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))[0];
}

// ─── Watches ──────────────────────────────────────────────────────────────────

function getWatch(id) {
  return load().watches.find(w => w.id === id) || null;
}

function insertWatch({ id, product_id, fcm_token, wait_window_hours, expires_at, lowest_seen_price }) {
  const data = load();
  data.watches.push({ id, product_id, fcm_token, wait_window_hours, expires_at, lowest_seen_price, is_bought: false, created_at: new Date().toISOString() });
  save(data);
}

function getActiveWatches() {
  const data = load();
  const now  = new Date();
  return data.watches
    .filter(w => !w.is_bought && new Date(w.expires_at) > now)
    .map(w => {
      const p = data.products.find(p => p.id === w.product_id);
      return { ...w, url: p?.url, name: p?.name, platform: p?.platform };
    });
}

function getWatchesByToken(fcm_token) {
  const data = load();
  const now  = new Date();
  return data.watches
    .filter(w => w.fcm_token === fcm_token && !w.is_bought && new Date(w.expires_at) > now)
    .map(w => {
      const p = data.products.find(p => p.id === w.product_id);
      return { ...w, url: p?.url, name: p?.name, platform: p?.platform, image_url: p?.image_url };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function markWatchBought(id) {
  const data = load();
  const w = data.watches.find(w => w.id === id);
  if (w) { w.is_bought = true; save(data); }
}

function deleteWatch(id) {
  const data = load();
  data.watches = data.watches.filter(w => w.id !== id);
  save(data);
}

function updateLowestPrice(price, id) {
  const data = load();
  const w = data.watches.find(w => w.id === id);
  if (w) { w.lowest_seen_price = price; save(data); }
}

function extendWatch(expires_at, wait_window_hours, id) {
  const data = load();
  const w = data.watches.find(w => w.id === id);
  if (w) { w.expires_at = expires_at; w.wait_window_hours = wait_window_hours; save(data); }
}

module.exports = {
  initDb, getProduct, getProductByUrl, insertProduct,
  insertPricePoint, getPriceHistory, getLatestPrice,
  insertWatch, getWatch, getActiveWatches, getWatchesByToken,
  markWatchBought, deleteWatch, updateLowestPrice, extendWatch,
};
