const Transaction = require('../models/Transaction');
const Position    = require('../models/Position');

/**
 * Replay all transactions for a position and persist the derived fields:
 *   shares, purchasePrice, realizedGain, totalDividends, totalInvested
 *
 * Returns the updated position document (or undefined if not found).
 */
async function recalculatePosition(positionId, userId) {
  const position = await Position.findOne({ _id: positionId, userId });
  if (!position) return;

  const txs = await Transaction.find({ positionId, userId }).sort({ date: 1, createdAt: 1 });

  let shares         = 0;
  let totalCost      = 0;
  let realizedGain   = 0;
  let totalDividends = 0;
  let totalInvested  = 0;

  for (const tx of txs) {
    if (tx.type === 'Buy') {
      shares        += tx.shares;
      totalCost     += tx.shares * tx.price;
      totalInvested += tx.shares * tx.price;
    } else if (tx.type === 'Sell') {
      if (shares > 0) {
        const avgCost        = totalCost / shares;
        const costOfSharesSold = avgCost * tx.shares;
        realizedGain += (tx.shares * tx.price) - costOfSharesSold;
        shares       -= tx.shares;
        totalCost    -= costOfSharesSold;
      }
      if (shares <= 0) { shares = 0; totalCost = 0; }
    } else if (tx.type === 'Dividend') {
      totalDividends += tx.amount;
    } else if (tx.type === 'DividendReinvest') {
      totalDividends += tx.amount;
      shares         += tx.shares;
      totalCost      += tx.shares * tx.price;
    }
  }

  position.shares         = shares;
  position.purchasePrice  = shares > 0 ? totalCost / shares : 0;
  position.realizedGain   = realizedGain;
  position.totalDividends = totalDividends;
  position.totalInvested  = totalInvested;
  await position.save();
  return position;
}

module.exports = { recalculatePosition };
