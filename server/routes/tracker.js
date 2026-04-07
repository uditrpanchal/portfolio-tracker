const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Position       = require('../models/Position');
const { fetchPrice, fetchPrices } = require('../services/priceService');

// All routes require authentication
router.use(authMiddleware);

// ── GET /api/tracker ──────────────────────────────────────────────────────────
// Optional query: ?portfolioId=xxx  (omit for "All" / unassigned)
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.portfolioId) filter.portfolioId = req.query.portfolioId;

    const positions = await Position.find(filter).sort({ createdAt: -1 });
    if (positions.length === 0) return res.json([]);

    const tickers  = positions.map(p => p.ticker);
    const priceMap = await fetchPrices(tickers);

    // Update stored prices in DB, then return
    const updated = await Promise.all(
      positions.map(async (p) => {
        const live = priceMap[p.ticker];
        if (live != null && live !== p.currentPrice) {
          p.currentPrice = live;
          await p.save();
        }
        return p;
      })
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/tracker ─────────────────────────────────────────────────────────
// Auto-fetches current price — do NOT accept currentPrice from client.
router.post('/', async (req, res) => {
  const { ticker, securityType, shares, purchasePrice, portfolioId, entryMethod } = req.body;
  try {
    const livePrice = await fetchPrice(ticker);
    if (!livePrice) {
      return res.status(422).json({
        message: `Could not fetch live price for "${ticker}". Check the ticker symbol and try again.`,
      });
    }

    const position = await Position.create({
      userId: req.user.id,
      portfolioId: portfolioId ?? null,
      ticker: ticker.toUpperCase(),
      securityType,
      shares,
      purchasePrice,
      currentPrice: livePrice,
      entryMethod: entryMethod || 'Manual'
    });
    res.status(201).json(position);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/tracker/:id ──────────────────────────────────────────────────────
// Re-fetches live price on every update.
router.put('/:id', async (req, res) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, userId: req.user.id });
    if (!position) return res.status(404).json({ message: 'Position not found' });

    const { ticker, securityType, shares, purchasePrice, entryMethod, portfolioId } = req.body;
    if (ticker)                    position.ticker        = ticker.toUpperCase();
    if (securityType)              position.securityType  = securityType;
    if (shares      != null)       position.shares        = shares;
    if (purchasePrice != null)     position.purchasePrice = purchasePrice;
    if (entryMethod)               position.entryMethod   = entryMethod;
    if (portfolioId !== undefined) position.portfolioId   = portfolioId || null;

    // Always refresh the live price
    const livePrice = await fetchPrice(position.ticker);
    if (livePrice) position.currentPrice = livePrice;

    await position.save();
    res.json(position);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/tracker/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const position = await Position.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!position) return res.status(404).json({ message: 'Position not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
