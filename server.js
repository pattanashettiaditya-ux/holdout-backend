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

app.listen(PORT, () => {
  console.log(`\n🚀 Holdout API running on http://localhost:${PORT}`);
  console.log(`📋 Test it: http://localhost:${PORT}/api/health\n`);
  startCron();
});
