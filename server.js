require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDb } = require('./db/database');
const apiRoutes  = require('./routes/api');
const { startCron } = require('./jobs/priceChecker'); 

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

app.get('/', (req, res) => res.json({ name: 'Holdout API', version: '1.0.0', status: 'running' }));

 

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
