const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPER_KEY = process.env.SCRAPERAPI_KEY;

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('amazon.in') || u.includes('amazon.com')) return 'amazon';
  if (u.includes('myntra.com')) return 'myntra';
  if (u.includes('nykaa.com'))  return 'nykaa';
  return 'unknown';
}

async function fetchHtml(url) {
  const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}&render=true`;
  const { data } = await axios.get(apiUrl, { timeout: 60000 });
  return cheerio.load(data);
}

async function scrapeAmazon(url) {
  const $ = await fetchHtml(url);
  const name = $('#productTitle').text().trim() || 'Amazon Product';
  const selectors = [
    '.a-price[data-a-size="xl"] .a-price-whole',
    '.priceToPay .a-price-whole',
    '.a-price-whole',
    '#priceblock_ourprice',
    '.a-offscreen',
  ];
  let priceText = '';
  for (const sel of selectors) {
    priceText = $(sel).first().text().trim();
    if (priceText) break;
  }
  const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
  if (!price || isNaN(price)) throw new Error('Could not extract Amazon price');
  const image = $('#landingImage').attr('src') || null;
  return { name, price, image, platform: 'amazon' };
}

async function scrapeMyntra(url) {
  const $ = await fetchHtml(url);
  const name = $('h1.pdp-title').text().trim()
    || $('h1.pdp-name').text().trim()
    || 'Myntra Product';
  const priceText = $('span.pdp-price strong').text().trim()
    || $('span.pdp-discount-container span').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
  if (!price || isNaN(price)) throw new Error('Could not extract Myntra price');
  return { name, price, image: null, platform: 'myntra' };
}

async function scrapeNykaa(url) {
  const $ = await fetchHtml(url);
  const name = $('h1.css-1gc4x7i').text().trim()
    || $('h1').first().text().trim()
    || 'Nykaa Product';
  const priceText = $('span.css-1jczs19').first().text().trim()
    || $('span[class*="price"]').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
  if (!price || isNaN(price)) throw new Error('Could not extract Nykaa price');
  return { name, price, image: null, platform: 'nykaa' };
}

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
