/**
 * ratingsService.js
 * Fetches analyst consensus ratings via yahoo-finance2 quoteSummary (financialData module).
 * CDRs (e.g. GOOG.TO) are handled by stripping the exchange suffix for lookup.
 * Results cached in-memory for 4 hours.
 */
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// In-memory cache: Map<ticker, { data: RatingData|null, ts: number }>
const cache = new Map();

const KEY_LABEL = {
  strong_buy:     'Strong Buy',
  buy:            'Buy',
  hold:           'Hold',
  sell:           'Sell',
  strong_sell:    'Strong Sell',
  underperform:   'Underperform',
  outperform:     'Outperform',
  overweight:     'Overweight',
  underweight:    'Underweight',
  market_perform: 'Market Perform',
  neutral:        'Neutral',
};

function toLabel(key) {
  return KEY_LABEL[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Fetch analyst ratings for an array of tickers.
 * Returns { TICKER: { mean, key, label, analysts } | null }
 */
async function fetchRatings(tickers) {
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
  const now    = Date.now();
  const result = {};
  const toFetch = [];

  for (const t of unique) {
    const hit = cache.get(t);
    if (hit && now - hit.ts < TTL_MS) {
      result[t] = hit.data;
    } else {
      toFetch.push(t);
    }
  }

  if (toFetch.length) {
    await Promise.allSettled(toFetch.map(async ticker => {
      // CDR / international variant: GOOG.TO → GOOG
      const base = ticker.split('.')[0];
      try {
        const summary = await yf.quoteSummary(
          base,
          { modules: ['financialData'] },
          { validateResult: false }
        );
        const fd  = summary?.financialData;
        const key = fd?.recommendationKey ?? null;
        const raw = fd?.recommendationMean ?? null;
        const analysts = fd?.numberOfAnalystOpinions ?? 0;
        const data = (key && raw != null)
          ? { mean: Number(Number(raw).toFixed(2)), key, label: toLabel(key), analysts }
          : null;
        cache.set(ticker, { data, ts: now });
        result[ticker] = data;
      } catch {
        cache.set(ticker, { data: null, ts: now });
        result[ticker] = null;
      }
    }));
  }

  return result;
}

module.exports = { fetchRatings };
