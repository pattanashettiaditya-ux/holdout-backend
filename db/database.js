// db/database.js — Turso (libsql) persistent database
const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS products (
      id         TEXT PRIMARY KEY,
      url        TEXT UNIQUE NOT NULL,
      name       TEXT NOT NULL,
      platform   TEXT NOT NULL,
      image_url  TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_points (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      price      REAL NOT NULL,
      checked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watches (
      id                 TEXT PRIMARY KEY,
      product_id         TEXT NOT NULL,
      fcm_token          TEXT NOT NULL,
      wait_window_hours  INTEGER NOT NULL,
      expires_at         TEXT NOT NULL,
      lowest_seen_price  REAL NOT NULL,
      is_bought          INTEGER DEFAULT 0,
      created_at         TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('✅ Turso database ready');
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function getProduct(id) {
  const r = await client.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

async function getProductByUrl(url) {
  const r = await client.execute({ sql: 'SELECT * FROM products WHERE url = ?', args: [url] });
  return r.rows[0] || null;
}

async function insertProduct({ id, url, name, platform, image_url }) {
  await client.execute({
    sql: 'INSERT OR IGNORE INTO products (id, url, name, platform, image_url) VALUES (?, ?, ?, ?, ?)',
    args: [id, url, name, platform, image_url || null],
  });
}

// ─── Price Points ─────────────────────────────────────────────────────────────

async function insertPricePoint({ product_id, price }) {
  await client.execute({
    sql: 'INSERT INTO price_points (product_id, price) VALUES (?, ?)',
    args: [product_id, price],
  });
}

async function getPriceHistory(product_id) {
  const r = await client.execute({
    sql: 'SELECT price, checked_at FROM price_points WHERE product_id = ? ORDER BY checked_at ASC LIMIT 720',
    args: [product_id],
  });
  return r.rows;
}

async function getLatestPrice(product_id) {
  const r = await client.execute({
    sql: 'SELECT price FROM price_points WHERE product_id = ? ORDER BY checked_at DESC LIMIT 1',
    args: [product_id],
  });
  return r.rows[0] || null;
}

// ─── Watches ──────────────────────────────────────────────────────────────────

async function getWatch(id) {
  const r = await client.execute({ sql: 'SELECT * FROM watches WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

async function insertWatch({ id, product_id, fcm_token, wait_window_hours, expires_at, lowest_seen_price }) {
  await client.execute({
    sql: 'INSERT INTO watches (id, product_id, fcm_token, wait_window_hours, expires_at, lowest_seen_price) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, product_id, fcm_token, wait_window_hours, expires_at, lowest_seen_price],
  });
}

async function getActiveWatches() {
  const r = await client.execute({
    sql: `SELECT w.*, p.url, p.name, p.platform
          FROM watches w JOIN products p ON w.product_id = p.id
          WHERE w.is_bought = 0 AND w.expires_at > datetime('now')`,
    args: [],
  });
  return r.rows;
}

async function getWatchesByToken(fcm_token) {
  const r = await client.execute({
    sql: `SELECT w.*, p.url, p.name, p.platform, p.image_url
          FROM watches w JOIN products p ON w.product_id = p.id
          WHERE w.fcm_token = ? AND w.is_bought = 0 AND w.expires_at > datetime('now')
          ORDER BY w.created_at DESC`,
    args: [fcm_token],
  });
  return r.rows;
}

async function markWatchBought(id) {
  await client.execute({ sql: 'UPDATE watches SET is_bought = 1 WHERE id = ?', args: [id] });
}

async function deleteWatch(id) {
  await client.execute({ sql: 'DELETE FROM watches WHERE id = ?', args: [id] });
}

async function updateLowestPrice(price, id) {
  await client.execute({ sql: 'UPDATE watches SET lowest_seen_price = ? WHERE id = ?', args: [price, id] });
}

async function extendWatch(expires_at, wait_window_hours, id) {
  await client.execute({
    sql: 'UPDATE watches SET expires_at = ?, wait_window_hours = ? WHERE id = ?',
    args: [expires_at, wait_window_hours, id],
  });
}

module.exports = {
  initDb, getProduct, getProductByUrl, insertProduct,
  insertPricePoint, getPriceHistory, getLatestPrice,
  insertWatch, getWatch, getActiveWatches, getWatchesByToken,
  markWatchBought, deleteWatch, updateLowestPrice, extendWatch,
};
