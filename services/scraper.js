// services/scraper.js
// Supported platforms: Amazon, Myntra, Nykaa
const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('amazon.in') || u.includes('amazon.com')) return 'amazon';
  if (u.includes('myntra.com')) return 'myntra';
  if (u.includes('nykaa.com'))  return 'nykaa';
  return 'unknown';
}

async function getBrowser() {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
  });
}
async function getPage(url) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 1366, height: 768 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    return { page, browser };
  } catch (err) {
    await browser.close();
    throw err;
  }
}async function getPage(url) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 1366, height: 768 });

    // Full stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
      window.chrome = { runtime: {} };
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 4000)); // wait longer for JS

    return { page, browser };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// ─── Amazon ───────────────────────────────────────────────────────────────────
async function scrapeAmazon(url) {
  const { page, browser } = await getPage(url);
  try {
    const result = await page.evaluate(() => {
      const name = document.querySelector('#productTitle')?.innerText?.trim()
        || document.querySelector('h1')?.innerText?.trim()
        || 'Amazon Product';

      // Try every possible price selector
      const selectors = [
        '.a-price[data-a-size="xl"] .a-price-whole',
        '.a-price[data-a-size="b"] .a-price-whole',
        '.priceToPay .a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#price_inside_buybox',
        '.a-price-whole',
        'span.a-offscreen',
        '#corePrice_feature_div .a-price .a-offscreen',
        '.apexPriceToPay .a-offscreen',
      ];

      let priceText = '';
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.innerText || el?.textContent) {
          priceText = el.innerText || el.textContent;
          break;
        }
      }

      const image = document.querySelector('#landingImage')?.src
        || document.querySelector('#imgTagWrapperId img')?.src || null;

      // Debug: dump all price-like text on page
      const allPrices = Array.from(document.querySelectorAll('[class*="price"]'))
        .map(el => el.innerText?.trim())
        .filter(t => t && t.includes('₹'))
        .slice(0, 5);

      return { name, priceText, image, allPrices };
    });

    console.log('Amazon debug:', JSON.stringify(result));

    const price = parseFloat(result.priceText.replace(/[^0-9.]/g, ''));
    if (!price || isNaN(price)) {
      // Try extracting from allPrices fallback
      for (const p of result.allPrices || []) {
        const extracted = parseFloat(p.replace(/[^0-9.]/g, ''));
        if (extracted > 0) return { name: result.name, price: extracted, image: result.image, platform: 'amazon' };
      }
      throw new Error('Could not extract Amazon price');
    }

    return { name: result.name, price, image: result.image, platform: 'amazon' };
  } finally {
    await browser.close();
  }
}

// ─── Myntra ───────────────────────────────────────────────────────────────────

async function scrapeMyntra(url) {
  const { page, browser } = await getPage(url);
  try {
    const result = await page.evaluate(() => {
      const name = document.querySelector('h1.pdp-title')?.innerText?.trim()
        || document.querySelector('h1.pdp-name')?.innerText?.trim()
        || document.querySelector('h1')?.innerText?.trim()
        || 'Myntra Product';

      const priceText = document.querySelector('span.pdp-price strong')?.innerText?.trim()
        || document.querySelector('span.pdp-discount-container span')?.innerText?.trim()
        || '';

      const image = document.querySelector('img.pdp-image')?.src
        || document.querySelector('div.image-grid-image img')?.src || null;

      return { name, priceText, image };
    });

    const price = parseFloat(result.priceText.replace(/[^0-9.]/g, ''));
    if (!price || isNaN(price)) throw new Error('Could not extract Myntra price');
    return { name: result.name, price, image: result.image, platform: 'myntra' };
  } finally {
    await browser.close();
  }
}

// ─── Nykaa ────────────────────────────────────────────────────────────────────

async function scrapeNykaa(url) {
  const { page, browser } = await getPage(url);
  try {
    const result = await page.evaluate(() => {
      const name = document.querySelector('h1.css-1gc4x7i')?.innerText?.trim()
        || document.querySelector('h1[class*="product-title"]')?.innerText?.trim()
        || document.querySelector('h1')?.innerText?.trim()
        || 'Nykaa Product';

      const priceText = document.querySelector('span.css-1jczs19')?.innerText?.trim()
        || document.querySelector('span[class*="price"]')?.innerText?.trim()
        || '';

      const image = document.querySelector('img.product-image')?.src
        || document.querySelector('div[class*="product-image"] img')?.src || null;

      return { name, priceText, image };
    });

    const price = parseFloat(result.priceText.replace(/[^0-9.]/g, ''));
    if (!price || isNaN(price)) throw new Error('Could not extract Nykaa price');
    return { name: result.name, price, image: result.image, platform: 'nykaa' };
  } finally {
    await browser.close();
  }
}

// ─── Main exports ─────────────────────────────────────────────────────────────

async function scrapeProduct(url) {
  const platform = detectPlatform(url);
  switch (platform) {
    case 'amazon': return scrapeAmazon(url);
    case 'myntra': return scrapeMyntra(url);
    case 'nykaa':  return scrapeNykaa(url);
    default: throw new Error('Unsupported platform. Supported: amazon.in, myntra.com, nykaa.com');
  }
}

async function scrapeCurrentPrice(url) {
  const result = await scrapeProduct(url);
  return result.price;
}

module.exports = { scrapeProduct, scrapeCurrentPrice, detectPlatform };
