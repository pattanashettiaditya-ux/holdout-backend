// services/notifier.js
const admin = require('firebase-admin');
require('dotenv').config();

let initialized = false;

function initFirebase() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('⚠️  Firebase not configured. Push notifications disabled.');
    console.warn('    Add FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL to .env');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });

  initialized = true;
  console.log('✅ Firebase initialized');
}

initFirebase();

/**
 * Send a price drop alert to a device
 * @param {string} fcmToken - Device FCM token from Flutter app
 * @param {object} product  - { name, platform }
 * @param {number} newPrice - The new low price
 * @param {number} oldPrice - Previous lowest seen price
 */
async function sendPriceAlert(fcmToken, product, newPrice, oldPrice) {
  if (!initialized) {
    console.log(`[Notification SKIPPED - Firebase not configured]`);
    console.log(`  Would alert: ${product.name} dropped to ₹${newPrice} (was ₹${oldPrice})`);
    return;
  }

  const drop = Math.round(oldPrice - newPrice);
  const dropPct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

  const message = {
    token: fcmToken,
    notification: {
      title: `🔻 New low! ₹${Math.round(newPrice).toLocaleString('en-IN')}`,
      body: `${product.name.slice(0, 60)} dropped ₹${drop} (${dropPct}% lower than before)`,
    },
    data: {
      type: 'PRICE_DROP',
      product_name: product.name,
      new_price: String(newPrice),
      old_price: String(oldPrice),
      platform: product.platform,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'price_alerts',
        icon: 'ic_notification',
        color: '#00FF87',
        sound: 'default',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent: ${response}`);
  } catch (err) {
    console.error(`❌ Notification failed for token ${fcmToken.slice(0, 20)}...:`, err.message);
  }
}

/**
 * Send a "watch expired" summary notification
 */
async function sendWatchExpired(fcmToken, product, lowestSeenPrice) {
  if (!initialized) return;

  const message = {
    token: fcmToken,
    notification: {
      title: `⏰ Watch expired — ${product.name.slice(0, 40)}`,
      body: `Best price we saw: ₹${Math.round(lowestSeenPrice).toLocaleString('en-IN')}. Still interested?`,
    },
    data: {
      type: 'WATCH_EXPIRED',
      product_name: product.name,
      lowest_price: String(lowestSeenPrice),
    },
    android: {
      priority: 'normal',
      notification: { channelId: 'price_alerts' },
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error('Expiry notification failed:', err.message);
  }
}

module.exports = { sendPriceAlert, sendWatchExpired };
