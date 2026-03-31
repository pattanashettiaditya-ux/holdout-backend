const cron = require('node-cron');
const db = require('../db/database');
const { scrapeCurrentPrice } = require('../services/scraper');
const { sendPriceAlert } = require('../services/notifier');

let isRunning = false;

async function checkAllPrices() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[PriceChecker] Starting — ${new Date().toISOString()}`);
  const watches = await db.getActiveWatches();
  console.log(`[PriceChecker] ${watches.length} active watches`);
  for (const watch of watches) {
    try {
      const currentPrice = await scrapeCurrentPrice(watch.url);
      await db.insertPricePoint({ product_id: watch.product_id, price: currentPrice });
      console.log(`  ${watch.name}: ₹${currentPrice} (lowest: ₹${watch.lowest_seen_price})`);
      if (currentPrice < watch.lowest_seen_price) {
        console.log(`  🔻 New low! Notifying...`);
        await sendPriceAlert(watch.fcm_token, { name: watch.name, platform: watch.platform }, currentPrice, watch.lowest_seen_price);
        await db.updateLowestPrice(currentPrice, watch.id);
      }
      await sleep(1500);
    } catch (err) {
      console.error(`  Error on watch ${watch.id}:`, err.message);
    }
  }
  isRunning = false;
  console.log(`[PriceChecker] Done — ${new Date().toISOString()}`);
}

function startCron() {
  console.log('[PriceChecker] Scheduled — runs every hour');
  cron.schedule('0 * * * *', checkAllPrices);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startCron, checkAllPrices };
