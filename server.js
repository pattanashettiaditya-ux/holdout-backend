require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDb } = require('./db/database');
const apiRoutes  = require('./routes/api');
const { startCron } = require('./jobs/priceChecker');
const { sendPriceAlert } = require('./services/notifier');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

app.get('/', (req, res) => res.json({ name: 'Holdout API', version: '1.0.0', status: 'running' }));

// Test notification endpoint
app.get('/test-notify', async (req, res) => {
  try {
    const db = require('./db/database');
    const watches = await db.getActiveWatches();
    if (watches.length === 0) return res.json({ error: 'No active watches found' });
    const watch = watches[0];
    await sendPriceAlert(
      watch.fcm_token,
      { name: watch.name, platform: watch.platform },
      watch.lowest_seen_price * 0.9,
      watch.lowest_seen_price
    );
    return res.json({ sent: true, product: watch.name, token: watch.fcm_token.slice(0, 20) + '...' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Holdout API running on http://localhost:${PORT}\n`);
    startCron();
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
