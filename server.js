require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDb } = require('./db/database');
const apiRoutes  = require('./routes/api');
const { startCron } = require('./jobs/priceChecker');

const app  = express();
const PORT = process.env.PORT || 3000;

// Init DB (synchronous)
initDb();

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({ name: 'Holdout API', version: '1.0.0', status: 'running' });
});
app.get('/chrome-path', async (req, res) => {
  const { execSync } = require('child_process');
  try {
    const path1 = execSync('which google-chrome || which chromium || which chromium-browser || find /home -name "chrome" 2>/dev/null | head -5').toString();
    res.json({ path: path1 });
  } catch(e) {
    res.json({ error: e.message });
  }
});
app.listen(PORT, () => {
  console.log(`\n🚀 Holdout API running on http://localhost:${PORT}`);
  console.log(`📋 Test it: http://localhost:${PORT}/api/health\n`);
  startCron();
});
