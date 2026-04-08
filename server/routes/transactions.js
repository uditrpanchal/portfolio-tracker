const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Position = require('../models/Position');

router.use(authMiddleware);

// Helper to recalculate position based on its transactions
async function recalculatePosition(positionId, userId) {
  const position = await Position.findOne({ _id: positionId, userId });
  if (!position) return;

  const txs = await Transaction.find({ positionId, userId }).sort({ date: 1, createdAt: 1 });

  let shares = 0;
  let totalCost = 0;
  let realizedGain = 0;
  let totalDividends = 0;
  let totalInvested = 0;

  for (const tx of txs) {
    if (tx.type === 'Buy') {
      shares += tx.shares;
      totalCost += tx.shares * tx.price;
      totalInvested += tx.shares * tx.price;
    } else if (tx.type === 'Sell') {
      if (shares > 0) {
        const avgCost = totalCost / shares;
        const costOfSharesSold = avgCost * tx.shares;
        realizedGain += (tx.shares * tx.price) - costOfSharesSold;
        
        shares -= tx.shares;
        totalCost -= costOfSharesSold;
      }
      if (shares <= 0) {
        shares = 0;
        totalCost = 0;
      }
    } else if (tx.type === 'Dividend') {
      totalDividends += tx.amount;
    } else if (tx.type === 'DividendReinvest') {
      totalDividends += tx.amount;
      shares += tx.shares;
      totalCost += tx.shares * tx.price;
    }
  }

  position.shares = shares;
  position.purchasePrice = shares > 0 ? (totalCost / shares) : 0;
  position.realizedGain = realizedGain;
  position.totalDividends = totalDividends;
  position.totalInvested = totalInvested;
  await position.save();
  return position;
}

// GET transactions for a position
router.get('/:positionId', async (req, res) => {
  try {
    const txs = await Transaction.find({ 
      positionId: req.params.positionId, 
      userId: req.user.id 
    }).sort({ date: -1, createdAt: -1 });
    res.json(txs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST transaction
router.post('/:positionId', async (req, res) => {
  try {
    const { type, date, shares, price, amount } = req.body;
    
    const tx = await Transaction.create({
      userId: req.user.id,
      positionId: req.params.positionId,
      type,
      date,
      shares: Number(shares || 0),
      price: Number(price || 0),
      amount: Number(amount || 0)
    });

    const updatedPosition = await recalculatePosition(req.params.positionId, req.user.id);
    
    res.status(201).json({ transaction: tx, position: updatedPosition });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE transaction
router.delete('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    
    const positionId = tx.positionId;
    await Transaction.deleteOne({ _id: tx._id });
    
    const updatedPosition = await recalculatePosition(positionId, req.user.id);
    
    res.json({ message: 'Transaction deleted', position: updatedPosition });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
