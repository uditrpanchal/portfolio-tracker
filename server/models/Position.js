const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    portfolioId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Portfolio', default: null },
    ticker:        { type: String, required: true, uppercase: true, trim: true },
    securityType:  { type: String, required: true, enum: ['Stock', 'ETF', 'International', 'Crypto', 'Bond'] },
    shares:        { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0 },
    currentPrice:  { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

positionSchema.index({ userId: 1, ticker: 1 });

module.exports = mongoose.model('Position', positionSchema);
