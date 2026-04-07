/**
 * GET /api/ratings?tickers=AAPL,VTI,GOOG.TO
 * Returns Morningstar star rating (stocks) or medalist rating (ETFs/funds).
 * Results are cached 24 h in ratingsService.
 * CDRs like GOOG.TO are handled in the Python script (strips exchange suffix).
 */
const express      = require('express');
const authMiddleware = require('../middleware/auth');
const { fetchRatings } = require('../services/ratingsService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const raw = (req.query.tickers || '').toString().trim();
  if (!raw) return res.status(400).json({ error: 'tickers query param required' });

  const tickers = raw.split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40); // cap at 40

  if (!tickers.length) return res.status(400).json({ error: 'no valid tickers' });

  try {
    const ratings = await fetchRatings(tickers);
    res.json(ratings);
  } catch (err) {
    console.error('ratings route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

module.exports = router;
