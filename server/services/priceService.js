const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * Fetch the current market price for a single ticker.
 * Returns null if the ticker is invalid or the request fails.
 */
async function fetchPrice(ticker) {
  const symbol = ticker.toUpperCase();
  try {
    const quote = await yahooFinance.quote(symbol, {}, { validateResult: false });
    return quote?.regularMarketPrice ?? null;
  } catch (err) {
    console.warn(`fetchPrice(${symbol}) failed:`, err.message);
    return null;
  }
}

/**
 * Fetch prices for multiple tickers in parallel.
 * Returns a map { TICKER: price | null }
 */
async function fetchPrices(tickers) {
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
  const results = await Promise.allSettled(unique.map(t => fetchPrice(t)));
  const map = {};
  unique.forEach((t, i) => {
    map[t] = results[i].status === 'fulfilled' ? results[i].value : null;
  });
  return map;
}

module.exports = { fetchPrice, fetchPrices };
