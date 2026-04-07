const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Portfolio      = require('../models/Portfolio');
const Position       = require('../models/Position');

router.use(authMiddleware);

// ── GET /api/portfolios ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ userId: req.user.id }).sort({ createdAt: 1 });
    res.json(portfolios);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/portfolios ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, currency } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
  try {
    const portfolio = await Portfolio.create({
      userId: req.user.id,
      name: name.trim(),
      currency: (currency || 'CAD').toUpperCase(),
    });
    res.status(201).json(portfolio);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: `"${name}" already exists` });
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/portfolios/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, currency } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
  try {
    const update = { name: name.trim() };
    if (currency) update.currency = currency.toUpperCase();
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    res.json(portfolio);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: `"${name}" already exists` });
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/portfolios/:id ────────────────────────────────────────────────
// Also deletes all positions inside it
router.delete('/:id', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!portfolio) return res.status(404).json({ message: 'Portfolio not found' });
    await Position.deleteMany({ portfolioId: req.params.id, userId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
