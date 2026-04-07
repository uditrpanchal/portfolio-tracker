const express = require('express');
const cors    = require('cors');

const authRoutes      = require('./routes/auth');
const trackerRoutes   = require('./routes/tracker');
const portfolioRoutes = require('./routes/portfolios');
const ratesRoutes     = require('./routes/rates');
const mstarRoutes     = require('./routes/mstar');
const dividendRoutes  = require('./routes/dividends');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/tracker',    trackerRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/rates',      ratesRoutes);
app.use('/api/ratings',    mstarRoutes);
app.use('/api/dividends',  dividendRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
