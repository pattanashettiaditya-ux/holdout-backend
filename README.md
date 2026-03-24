# Holdout Backend

## Setup & Run

### 1. Install dependencies
```bash
cd holdout-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
For now you can leave .env as-is — the server runs fine without Firebase
(notifications will just be skipped with a warning).

### 3. Start the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:3000**

---

## Test it works

### Health check
```
GET http://localhost:3000/api/health
```

### Fetch a product (replace with real URL)
```bash
curl -X POST http://localhost:3000/api/product \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.in/dp/B09JQMJHXY"}'
```

### Add a watch
```bash
curl -X POST http://localhost:3000/api/watch \
  -H "Content-Type: application/json" \
  -d '{"product_id": "...", "fcm_token": "test-token", "wait_window_hours": 48}'
```

---

## Firebase Setup (for real push notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project → "Holdout"
3. Project Settings → Service Accounts → Generate new private key
4. Copy the values into your `.env` file
5. In Flutter app, add `firebase_messaging` package and send the FCM token to the backend with each watch

---

## Deploy to Render (free)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add your `.env` values as Environment Variables in Render dashboard
7. Deploy → you get a free URL like `https://holdout-api.onrender.com`

---

## Folder Structure
```
holdout-backend/
├── server.js              # Express entry point
├── .env.example           # Environment template
├── db/
│   └── database.js        # SQLite schema + query helpers
├── services/
│   ├── scraper.js         # Axios + Cheerio price scraper
│   └── notifier.js        # Firebase push notifications
├── routes/
│   └── api.js             # All API endpoints
└── jobs/
    └── priceChecker.js    # Hourly cron job
```
