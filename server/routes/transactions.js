const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { recalculatePosition } = require('../services/positionService');

router.use(authMiddleware);

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
