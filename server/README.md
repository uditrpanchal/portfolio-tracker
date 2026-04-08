# Server — Express Backend

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?logo=mongodb)](https://mongoosejs.com)
[![Tests](https://img.shields.io/badge/tests-18%20passed-brightgreen?logo=vitest)](tests)

The Express + MongoDB backend for Portfolio Tracker. Exposes a REST API consumed by the React frontend.

---

## 📁 Structure

```
server/
├── middleware/
│   └── auth.js             # JWT verification middleware (Bearer token)
├── models/
│   ├── User.js             # email, password (bcrypt), googleId, name
│   ├── Portfolio.js        # userId, name, currency (default: CAD)
│   ├── Position.js         # userId, portfolioId, ticker, shares, purchasePrice,
│   │                        #   currentPrice, entryMethod, realizedGain, totalDividends, totalInvested
│   └── Transaction.js      # userId, positionId, type, date, shares, price, amount
├── routes/
│   ├── auth.js             # /api/auth  — register, login, Google OAuth
│   ├── tracker.js          # /api/tracker — positions CRUD + live price refresh + backfill
│   ├── portfolios.js       # /api/portfolios — named portfolio CRUD
│   ├── transactions.js     # /api/transactions — Buy/Sell/Dividend ledger per position
│   ├── history.js          # /api/history — daily portfolio value time series
│   ├── rates.js            # /api/rates — FX rates (1h in-memory cache)
│   ├── mstar.js            # /api/ratings — analyst consensus (4h cache)
│   └── dividends.js        # /api/dividends — dividend info + ex-div dates (4h cache)
├── services/
│   ├── priceService.js     # fetchPrice / fetchPrices via yahoo-finance2 quote()
│   ├── positionService.js  # recalculatePosition — shared avg-cost replay logic
│   ├── ratingsService.js   # analyst consensus (Strong Buy…Strong Sell) via financialData
│   └── dividendService.js  # dividendRate, yield, exDivDate, YTD via summaryDetail + chart()
├── .env                    # secrets — never committed (see .gitignore)
├── package.json
└── server.js               # Entry point: connects MongoDB, starts Express
```

---

## 🔌 API Reference

All authenticated routes require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | — | Register a new user (email + password) |
| `POST` | `/api/auth/login` | — | Login with email + password |
| `POST` | `/api/auth/google` | — | Sign in / sign up via Google OAuth ID token |

**Register / Login request body:**
```json
{ "email": "user@example.com", "password": "secret123", "name": "Alice" }
```

**Response (all auth routes):**
```json
{ "token": "<jwt>", "user": { "id": "...", "name": "Alice", "email": "user@example.com" } }
```

---

### Positions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tracker` | JWT | List all positions (live prices refreshed) |
| `POST` | `/api/tracker` | JWT | Add a position (auto-fetches current price) |
| `PUT` | `/api/tracker/:id` | JWT | Update shares, purchase price, or portfolio |
| `DELETE` | `/api/tracker/:id` | JWT | Remove a position |

**POST body:**
```json
{
  "ticker": "AAPL",
  "securityType": "Stock",
  "shares": 10,
  "purchasePrice": 175.00,
  "portfolioId": "<portfolio-object-id>"
}
```

---

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|--------------|
| `GET` | `/api/transactions/:positionId` | JWT | List all transactions for a position (newest first) |
| `POST` | `/api/transactions/:positionId` | JWT | Add a transaction; recalculates position fields |
| `DELETE` | `/api/transactions/:id` | JWT | Remove a transaction; recalculates position fields |

**POST body:**
```json
{
  "type": "Buy",
  "date": "2026-04-07",
  "shares": 15,
  "price": 22.73,
  "amount": 0
}
```
`type` values: `Buy` | `Sell` | `Dividend` | `DividendReinvest`  
For `Dividend` only `amount` is required (shares/price ignored).  

**Response:** `{ transaction: <Transaction>, position: <Position> }` — both updated atomically.

---

### Performance History

| Method | Endpoint | Auth | Description |
|--------|----------|------|--------------|
| `GET` | `/api/history` | JWT | Daily `{ date, portfolioValue, netDeposits, totalInvested }` from first transaction to today |
| `GET` | `/api/history?portfolioId=xxx` | JWT | Same, scoped to one portfolio |

Builds the series by replaying all transactions chronologically against `yahoo-finance2 chart()` daily prices. Weekends/holidays are forward-filled from the last known closing price.

**Response:**
```json
{
  "data": [
    { "date": "2026-04-01", "portfolioValue": 340.95, "netDeposits": 340.95, "totalInvested": 340.95 },
    { "date": "2026-04-07", "portfolioValue": 13.80,  "netDeposits": 0,      "totalInvested": 340.95 }
  ]
}
```

---

### Portfolios

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/portfolios` | JWT | List all portfolios for the user |
| `POST` | `/api/portfolios` | JWT | Create a new named portfolio |
| `PUT` | `/api/portfolios/:id` | JWT | Rename or change portfolio currency |
| `DELETE` | `/api/portfolios/:id` | JWT | Delete portfolio (does not delete positions) |

**POST / PUT body:**
```json
{ "name": "TFSA", "currency": "CAD" }
```

---

### Market Data

| Method | Endpoint | Auth | Cache | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/rates` | — | 1 hour | FX rates (USD as base) |
| `GET` | `/api/ratings?tickers=AAPL,MSFT` | JWT | 4 hours | Analyst consensus per ticker |
| `GET` | `/api/dividends?tickers=AAPL,T` | JWT | 4 hours | Dividend rate, yield, ex-div date, YTD |

**`/api/rates` response:**
```json
{ "rates": { "CADUSD=X": 0.73, "EURUSD=X": 1.08 }, "fetchedAt": "2026-01-01T00:00:00.000Z" }
```

**`/api/ratings` response:**
```json
{
  "AAPL": { "rating": "Buy", "score": 2.1, "analystCount": 38 }
}
```

**`/api/dividends` response:**
```json
{
  "AAPL": {
    "dividendRate": 1.00,
    "dividendYield": 0.0051,
    "exDividendDate": "2026-02-07",
    "ytdDividends": 0.75
  }
}
```

---

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | — | Returns `{ "ok": true }` |

---

## 🗄️ Data Models

### User
```js
{
  email:    String (unique, required),
  password: String (bcrypt, null for OAuth-only users),
  googleId: String,
  name:     String
}
```

### Portfolio
```js
{
  userId:   ObjectId (ref User),
  name:     String (e.g. "TFSA"),
  currency: String (default "CAD")
}
```

### Position
```js
{
  userId:         ObjectId (ref User),
  portfolioId:    ObjectId (ref Portfolio, nullable),
  ticker:         String (uppercase),
  securityType:   String ("Stock" | "ETF" | "International" | "Crypto" | "Bond"),
  shares:         Number,           // current open shares (recalculated from transactions)
  purchasePrice:  Number,           // avg cost per share of open position
  currentPrice:   Number,           // populated/refreshed at query time
  entryMethod:    String ("Manual" | "Transactions"),
  realizedGain:   Number,           // cumulative (proceeds − cost) of sold shares
  totalDividends: Number,           // cumulative dividend cash received
  totalInvested:  Number            // cumulative BUY cost (never decreases — return % denominator)
}
```

### Transaction
```js
{
  userId:     ObjectId (ref User),
  positionId: ObjectId (ref Position),
  type:       String ("Buy" | "Sell" | "Dividend" | "DividendReinvest"),
  date:       Date,
  shares:     Number,
  price:      Number,
  amount:     Number   // used for Dividend cash amount
}
```

---

## ⚙️ Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server with `node server.js` |
| `npm run dev` | Start with `nodemon` (auto-restart on change) |
| `npm test` | Run Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage report |

---

## 🔑 Environment Variables

Create `server/.env` (never commit this file):

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/portfolio
JWT_SECRET=<random-256-bit-string>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
PORT=5000
```

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 client ID |
| `PORT` | No | Defaults to 5000 |

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.19.2 | HTTP framework |
| mongoose | 8.4.0 | MongoDB ODM |
| yahoo-finance2 | 3.14.0 | Live prices, FX, analyst data, dividends |
| jsonwebtoken | 9.0.2 | JWT issuance + verification |
| bcryptjs | 2.4.3 | Password hashing |
| google-auth-library | 9.10.0 | Google ID token verification |
| nodemon | 3.1.3 | Dev: auto-restart |

---

## 🧪 Tests

**18 tests** — Vitest + Supertest + mongodb-memory-server. No real database or network calls required; an in-memory MongoDB instance is spun up per test run.

```bash
npm test                # run once
npm run test:watch      # watch mode
npm run test:coverage   # V8 coverage report
```

| File | What's tested |
|------|---------------|
| `tests/health.test.js` | `GET /api/health` returns `{ ok: true }` |
| `tests/auth.test.js` | Register, login, duplicate email (409), bad password (401), missing fields (400), `GET /api/auth/me` |
| `tests/tracker.test.js` | Auth guard (401), positions CRUD (create/read/update/delete), 422 on invalid ticker, cross-user 404 |

**Tools:** Vitest · Supertest · mongodb-memory-server · @vitest/coverage-v8

---

## � Notes

- The **Budget Planner** stores all data in browser `localStorage` (key: `pt_budget_v1`) — there are no backend endpoints for it
- `recalculatePosition` in `services/positionService.js` is shared by both `transactions.js` (on add/delete) and `tracker.js` (one-time backfill for positions saved before the `totalInvested` field was introduced)

---

## 🔒 Security Notes

- All secrets are stored in `.env` which is listed in `.gitignore` — never commit it
- JWT tokens expire after **7 days**; stored client-side as `pt_token` in `localStorage`
- Passwords are hashed with **bcrypt** (salt rounds: 10) before storage — plaintext is never persisted
- Google ID tokens are verified server-side with `google-auth-library` before trusting claims
- All mutating routes (positions, portfolios, transactions) are guarded by the JWT middleware and scope queries to the authenticated `userId`
