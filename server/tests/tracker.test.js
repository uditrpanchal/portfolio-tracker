import request from 'supertest';
import app from '../app.js';

const TEST_USER = { email: 'trader@example.com', password: 'pass1234', name: 'Trader' };

async function registerAndLogin() {
  const res = await request(app).post('/api/auth/register').send(TEST_USER);
  return res.body.token;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
describe('GET /api/tracker (auth)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/tracker');
    expect(res.status).toBe(401);
  });
});

// ── Positions CRUD ────────────────────────────────────────────────────────────
describe('Positions CRUD', () => {
  let token;

  beforeEach(async () => {
    token = await registerAndLogin();
  });

  it('GET /api/tracker returns an empty array for a new user', async () => {
    const res = await request(app)
      .get('/api/tracker')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/tracker creates a position with live price', async () => {
    const res = await request(app)
      .post('/api/tracker')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker: 'AAPL', securityType: 'Stock', shares: 10, purchasePrice: 140 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticker: 'AAPL',
      shares: 10,
      purchasePrice: 140,
    });
    // currentPrice is fetched live from Yahoo Finance in integration tests
    expect(res.body.currentPrice).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('_id');
  });

  it('POST /api/tracker returns 422 for an invalid ticker', async () => {
    const res = await request(app)
      .post('/api/tracker')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker: 'INVALID999', securityType: 'Stock', shares: 1, purchasePrice: 1 });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/could not fetch/i);
  });

  it('PUT /api/tracker/:id updates shares on an owned position', async () => {
    const create = await request(app)
      .post('/api/tracker')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker: 'AAPL', securityType: 'Stock', shares: 5, purchasePrice: 140 });
    const id = create.body._id;

    const update = await request(app)
      .put(`/api/tracker/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ shares: 20 });
    expect(update.status).toBe(200);
    expect(update.body.shares).toBe(20);
  });

  it('DELETE /api/tracker/:id removes an owned position', async () => {
    const create = await request(app)
      .post('/api/tracker')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker: 'AAPL', securityType: 'Stock', shares: 5, purchasePrice: 140 });
    const id = create.body._id;

    const del = await request(app)
      .delete(`/api/tracker/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    // Confirm it is gone
    const list = await request(app)
      .get('/api/tracker')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });

  it('DELETE /api/tracker/:id returns 404 for another user\'s position', async () => {
    // Create position with user 1
    const create = await request(app)
      .post('/api/tracker')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticker: 'AAPL', securityType: 'Stock', shares: 5, purchasePrice: 140 });
    const id = create.body._id;

    // Register user 2 and try to delete
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@example.com', password: 'pass1234' });
    const token2 = res2.body.token;

    const del = await request(app)
      .delete(`/api/tracker/${id}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(del.status).toBe(404);
  });
});
