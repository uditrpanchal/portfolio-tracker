const express = require('express');
const { fetchPrices } = require('../services/priceService');

const router = express.Router();

// Supported currencies (must match frontend CURRENCIES list)
const SUPPORTED = ['CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'INR', 'HKD'];

// Simple in-memory cache: refresh at most once per hour
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/rates
 * Returns exchange rates relative to USD base.
 * Uses Yahoo Finance currency pairs (e.g. USDCAD=X).
 * Response: { base: 'USD', rates: { USD:1, CAD:1.38, EUR:0.92, ... }, updatedAt: <iso> }
 */
router.get('/', async (_req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_TTL) {
      return res.json(cache);
    }

    // Build Yahoo Finance fx tickers: USDCAD=X, USDEUR=X, ...
    const tickers = SUPPORTED.map(c => `USD${c}=X`);
    const prices = await fetchPrices(tickers);

    const rates = { USD: 1 };
    for (const cur of SUPPORTED) {
      const price = prices[`USD${cur}=X`];
      if (price != null) rates[cur] = price;
    }

    cache = { base: 'USD', rates, updatedAt: new Date().toISOString() };
    cacheTime = now;
    return res.json(cache);
  } catch (err) {
    console.error('rates fetch error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch exchange rates' });
  }
});

module.exports = router;
