const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Position       = require('../models/Position');
const Transaction    = require('../models/Transaction');
const YahooFinance   = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

router.use(authMiddleware);

/**
 * GET /api/history
 * Optional query: ?portfolioId=xxx
 *
 * Returns daily { date, portfolioValue, netDeposits } from the first
 * transaction date to today, computed by replaying all transactions
 * against yahoo-finance2 historical closing prices.
 */
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.portfolioId) filter.portfolioId = req.query.portfolioId;

    const positions = await Position.find(filter);
    if (!positions.length) return res.json({ data: [] });

    // positionId → ticker lookup
    const positionMap = {};
    positions.forEach(p => { positionMap[p._id.toString()] = p.ticker.toUpperCase(); });

    const tickers     = [...new Set(positions.map(p => p.ticker.toUpperCase()))];
    const positionIds = positions.map(p => p._id);

    // Fetch all transactions in chronological order
    const txs = await Transaction.find({
      positionId: { $in: positionIds },
      userId: req.user.id,
    }).sort({ date: 1, createdAt: 1 });

    if (!txs.length) return res.json({ data: [] });

    const startDate = new Date(txs[0].date);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch daily historical prices for every ticker via chart() (historical() is deprecated)
    const priceHistory = {};
    await Promise.allSettled(
      tickers.map(async (ticker) => {
        try {
          const result = await yahooFinance.chart(
            ticker,
            { period1: startDate, period2: today, interval: '1d' },
            { validateResult: false },
          );
          const map = {};
          const quotes = result?.quotes ?? [];
          for (const row of quotes) {
            if (!row.date) continue;
            const key = new Date(row.date).toISOString().slice(0, 10);
            // chart() returns adjclose (lowercase) or close
            map[key] = row.adjclose ?? row.close;
          }
          priceHistory[ticker] = map;
        } catch (e) {
          console.warn(`history: failed prices for ${ticker}: ${e.message}`);
          priceHistory[ticker] = {};
        }
      }),
    );

    // Enrich transactions with ticker symbol
    const enrichedTxs = txs.map(tx => ({
      ...tx.toObject(),
      ticker: positionMap[tx.positionId.toString()] || '',
    }));

    // Day-by-day replay
    const sharesHeld     = {};
    const totalCostBasis = {};   // per ticker, for avg-cost calculation on sells
    const lastKnownPrice = {};
    tickers.forEach(t => { sharesHeld[t] = 0; totalCostBasis[t] = 0; lastKnownPrice[t] = null; });

    let totalInvested   = 0;   // cumulative BUY costs — never decreases (for % denominator)
    let realizedNetGain = 0;   // cumulative (proceeds − cost-of-shares-sold): profit only
    let txIndex         = 0;
    const days          = [];
    const current       = new Date(startDate);

    while (current <= today) {
      const dateKey = current.toISOString().slice(0, 10);

      // Apply all transactions on or before this date
      while (txIndex < enrichedTxs.length) {
        const tx    = enrichedTxs[txIndex];
        const txDay = new Date(tx.date);
        txDay.setHours(0, 0, 0, 0);
        if (txDay > current) break;

        if (tx.ticker) {
          if (tx.type === 'Buy') {
            sharesHeld[tx.ticker]     = (sharesHeld[tx.ticker]     || 0) + tx.shares;
            totalCostBasis[tx.ticker] = (totalCostBasis[tx.ticker] || 0) + tx.shares * tx.price;
            totalInvested            += tx.shares * tx.price;
          } else if (tx.type === 'Sell') {
            const held = sharesHeld[tx.ticker] || 0;
            if (held > 0) {
              const avgCost  = (totalCostBasis[tx.ticker] || 0) / held;
              const costSold = avgCost * tx.shares;
              realizedNetGain             += (tx.shares * tx.price) - costSold;  // profit only
              sharesHeld[tx.ticker]        = Math.max(0, held - tx.shares);
              totalCostBasis[tx.ticker]    = Math.max(0, (totalCostBasis[tx.ticker] || 0) - costSold);
            }
          } else if (tx.type === 'DividendReinvest') {
            sharesHeld[tx.ticker]     = (sharesHeld[tx.ticker]     || 0) + tx.shares;
            totalCostBasis[tx.ticker] = (totalCostBasis[tx.ticker] || 0) + tx.shares * tx.price;
          }
        }
        txIndex++;
      }

      // Forward-fill prices
      for (const ticker of tickers) {
        const p = priceHistory[ticker]?.[dateKey];
        if (p != null) lastKnownPrice[ticker] = p;
      }

      // openMarketValue = live value of shares still held
      let openMarketValue = 0;
      let hasAnyPrice     = false;
      for (const ticker of tickers) {
        if (lastKnownPrice[ticker] != null) {
          openMarketValue += (sharesHeld[ticker] || 0) * lastKnownPrice[ticker];
          hasAnyPrice = true;
        }
      }

      // openCostBasis = cost basis of positions still open
      // (drops to 0 as positions are sold — used as the "Net Deposits" line)
      const openCostBasis = tickers.reduce((s, t) => s + (totalCostBasis[t] || 0), 0);

      // portfolioValue = unrealized market value + realized net profit
      // → consistent with what the position table shows for closed positions ($13.80, not $354.75)
      if (hasAnyPrice || realizedNetGain !== 0) {
        days.push({
          date:           dateKey,
          portfolioValue: Math.max(0, openMarketValue + realizedNetGain),
          netDeposits:    Math.max(0, openCostBasis),
          totalInvested,                              // for % denominator in frontend
        });
      }

      current.setDate(current.getDate() + 1);
    }

    res.json({ data: days });
  } catch (err) {
    console.error('history route error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
