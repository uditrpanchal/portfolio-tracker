const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
    type:       { type: String, enum: ['Buy', 'Sell', 'Dividend', 'DividendReinvest'], required: true },
    date:       { type: Date, required: true },
    shares:     { type: Number, default: 0 },
    price:      { type: Number, default: 0 },
    amount:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

transactionSchema.index({ positionId: 1, date: -1 });
transactionSchema.index({ userId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
