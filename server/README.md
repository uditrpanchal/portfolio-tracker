# Server — Express Backend

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?logo=mongodb)](https://mongoosejs.com)

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
│   └── Position.js         # userId, portfolioId, ticker, securityType, shares, purchasePrice, currentPrice
├── routes/
│   ├── auth.js             # /api/auth  — register, login, Google OAuth
│   ├── tracker.js          # /api/tracker — positions CRUD + live price refresh
│   ├── portfolios.js       # /api/portfolios — named portfolio CRUD
│   ├── rates.js            # /api/rates — FX rates (1h in-memory cache)
│   ├── mstar.js            # /api/ratings — analyst consensus (4h cache)
│   └── dividends.js        # /api/dividends — dividend info + ex-div dates (4h cache)
├── services/
│   ├── priceService.js     # fetchPrice / fetchPrices via yahoo-finance2 quoteSummary
│   ├── ratingsService.js   # analyst consensus (Strong Buy…Strong Sell) via financialData
│   └── dividendService.js  # dividendRate, yield, exDivDate, YTD via summaryDetail + chart()
├── .env                    # secrets — never committed (see .gitignore)
├── package.json
└── server.js               # Express app, CORS, route registration
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
  portfolioId:    ObjectId (ref Portfolio),
  ticker:         String,
  securityType:   String ("Stock" | "ETF" | "Mutual Fund" | "Crypto" | "Other"),
  shares:         Number,
  purchasePrice:  Number,
  currentPrice:   Number (populated at query time)
}
```

---

## ⚙️ Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server with `node server.js` |
| `npm run dev` | Start with `nodemon` (auto-restart on change) |

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

No automated test suite currently. Manual smoke tests:

```bash
# Health check
curl http://localhost:5000/api/health

# Verify Yahoo Finance connectivity
node -e "require('./services/priceService').fetchPrice('AAPL').then(console.log)"

# Verify FX rates
node -e "const r=require('./routes/rates'); console.log('loaded')"
```

**Planned:** Supertest integration tests for all REST endpoints.

---

## 🔒 Security Notes

- All secrets are stored in `.env` which is listed in `.gitignore` — never commit it
- JWT tokens expire after **7 days**; stored client-side as `pt_token` in `localStorage`
- Passwords are hashed with **bcrypt** (salt rounds: 10) before storage — plaintext is never persisted
- Google ID tokens are verified server-side with `google-auth-library` before trusting claims
- All mutating routes (positions, portfolios) are guarded by the JWT middleware and scope queries to the authenticated `userId`
