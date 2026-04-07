/**
 * GET /api/dividends?tickers=VTI,MSFT,GOOG.TO
 * Returns dividend info (annual rate, ex-div date, YTD per share, etc.) for
 * each ticker.  Auth-protected.  Results served from in-memory cache (4 h TTL).
 */
const express        = require('express');
const authMiddleware = require('../middleware/auth');
const { fetchDividendInfo } = require('../services/dividendService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const raw = (req.query.tickers || '').toString().trim();
  if (!raw) return res.status(400).json({ error: 'tickers param required' });

  const tickers = raw.split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);

  if (!tickers.length) return res.status(400).json({ error: 'no valid tickers' });

  try {
    const data = await fetchDividendInfo(tickers);
    res.json(data);
  } catch (err) {
    console.error('dividends route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dividend data' });
  }
});

module.exports = router;
