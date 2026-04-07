/**
 * dividendService.js
 * Fetches dividend data (annual rate, ex-dividend date, YTD per-share amounts)
 * via yahoo-finance2.  Results cached 4 hours.
 *
 * Tickers are looked up AS-IS so that CDRs (e.g. MSFT.TO, AAPL.TO on TSX/NEO)
 * use their own CAD-denominated per-share dividend (e.g. ~$0.065 CAD/qtr for
 * MSFT.TO) rather than the underlying US stock's USD dividend ($0.91/qtr).
 * Canadian ETFs (VFV.TO) and stocks (RY.TO) are also handled directly.
 */
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const cache  = new Map();           // Map<ticker, { data, ts }>

/**
 * Estimate payment frequency (payments per year) from an array of dividend events.
 * Each event: { amount: number, date: Date }
 */
function estimateFrequency(events) {
  if (events.length < 2) return 4; // assume quarterly
  const recent = events.slice(-6);
  const gaps = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push((recent[i].date - recent[i - 1].date) / 86_400_000);
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avg < 45)  return 12; // monthly
  if (avg < 120) return 4;  // quarterly
  if (avg < 240) return 2;  // semi-annual
  return 1;                  // annual
}

/**
 * Fetch dividend information for a list of tickers.
 * Returns: Record<ticker, DividendInfo | null>
 *
 * DividendInfo shape:
 *   annualRate       number | null  — trailing 12-month div/share
 *   dividendYield    number | null  — as a fraction (0.02 = 2%)
 *   exDividendDate   string | null  — ISO date; may be estimated
 *   exDivEstimated   boolean
 *   lastAmount       number | null  — most-recent single payment per share
 *   lastDate         string | null  — date of most-recent single payment
 *   ytdPerShare      number         — sum of all div payments in current calendar year
 *   frequency        number         — 1/2/4/12
 */
async function fetchDividendInfo(tickers) {
  const unique   = [...new Set(tickers.map(t => t.toUpperCase()))];
  const now      = Date.now();
  const result   = {};
  const toFetch  = [];

  for (const t of unique) {
    const hit = cache.get(t);
    if (hit && now - hit.ts < TTL_MS) {
      result[t] = hit.data;
    } else {
      toFetch.push(t);
    }
  }

  if (toFetch.length) {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);   // Jan 1 this year
    const histStart = new Date(new Date().getFullYear() - 1, 0, 1); // Jan 1 last year
    const yearEnd   = new Date(new Date().getFullYear(), 11, 31); // Dec 31 this year

    await Promise.allSettled(toFetch.map(async (ticker) => {
      // Use the full ticker so CDRs (MSFT.TO, GOOG.TO …) get their own
      // CAD-denominated per-share dividends rather than the US parent stock's.
      try {
        const [summaryResult, chartResult] = await Promise.allSettled([
          yf.quoteSummary(ticker, { modules: ['summaryDetail'] }, { validateResult: false }),
          yf.chart(ticker, { period1: histStart, period2: yearEnd, interval: '1mo' }, { validateResult: false }),
        ]);

        const sd = summaryResult.status === 'fulfilled'
          ? summaryResult.value?.summaryDetail
          : null;

        // Raw chart dividend events (sorted chronologically by yahoo)
        const rawEvents = chartResult.status === 'fulfilled'
          ? (chartResult.value?.events?.dividends ?? [])
          : [];

        // Normalise dates to proper Date objects
        const events = rawEvents.map(e => ({ amount: e.amount, date: new Date(e.date) }));

        const annualRate  = sd?.dividendRate ?? sd?.trailingAnnualDividendRate ?? null;
        const divYield    = sd?.dividendYield ?? sd?.trailingAnnualDividendYield ?? null;
        const exDivDate   = sd?.exDividendDate ? new Date(sd.exDividendDate) : null;

        // Nothing useful → not a dividend payer
        if (!annualRate && events.length === 0) {
          cache.set(ticker, { data: null, ts: now });
          result[ticker] = null;
          return;
        }

        const frequency = estimateFrequency(events);

        // YTD payments (current calendar year only)
        const ytdEvents  = events.filter(e => e.date >= yearStart);
        const ytdPerShare = Number(ytdEvents.reduce((s, e) => s + e.amount, 0).toFixed(4));

        // Most recent payment
        const lastEvent = events.length ? events[events.length - 1] : null;

        // Resolve the NEXT upcoming ex-div date:
        //  1. Yahoo provides a future date → use it directly (authoritative)
        //  2. Yahoo provides a past date, OR no date at all → estimate from
        //     the last known payment date + one payment-interval forward,
        //     repeating until we land in the future.
        const today       = new Date();
        const daysPerPmt  = 365 / estimateFrequency(events);

        let nextExDivDate  = exDivDate && exDivDate > today ? exDivDate : null;
        let exDivEstimated = false;

        if (!nextExDivDate) {
          // Starting point: Yahoo's past date if available, otherwise last event date
          const anchor = exDivDate ?? (lastEvent ? lastEvent.date : null);
          if (anchor) {
            let candidate = new Date(anchor.getTime());
            // Step forward by one interval until we cross today
            while (candidate <= today) {
              candidate = new Date(candidate.getTime() + daysPerPmt * 86_400_000);
            }
            nextExDivDate  = candidate;
            exDivEstimated = true;
          }
        }

        const data = {
          annualRate:      annualRate ?? Number((ytdPerShare * (365 / ((new Date() - yearStart) / 86_400_000))).toFixed(4)),
          dividendYield:   divYield,
          exDividendDate:  nextExDivDate ? nextExDivDate.toISOString() : null,
          exDivEstimated,
          lastAmount:      lastEvent?.amount ?? (annualRate ? Number((annualRate / frequency).toFixed(4)) : null),
          lastDate:        lastEvent ? lastEvent.date.toISOString() : null,
          ytdPerShare,
          frequency,
        };
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

module.exports = { fetchDividendInfo };
