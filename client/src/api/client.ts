const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

function getToken(): string | null {
  return localStorage.getItem('pt_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data as T;
}

export const api = {
  // Auth
  googleLogin: (credential: string) =>
    request<{ token: string; user: UserProfile }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  emailLogin: (email: string, password: string) =>
    request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  emailRegister: (email: string, password: string, name: string) =>
    request<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  me: () => request<{ user: UserProfile }>('/api/auth/me'),

  // Portfolios
  getPortfolios: () => request<Portfolio[]>('/api/portfolios'),

  createPortfolio: (name: string, currency: string) =>
    request<Portfolio>('/api/portfolios', { method: 'POST', body: JSON.stringify({ name, currency }) }),

  updatePortfolio: (id: string, name: string, currency?: string) =>
    request<Portfolio>(`/api/portfolios/${id}`, { method: 'PUT', body: JSON.stringify({ name, currency }) }),

  deletePortfolio: (id: string) =>
    request<{ message: string }>(`/api/portfolios/${id}`, { method: 'DELETE' }),

  // Tracker positions
  getPositions: (portfolioId?: string) =>
    request<Position[]>('/api/tracker' + (portfolioId ? `?portfolioId=${portfolioId}` : '')),

  createPosition: (p: PositionInput) =>
    request<Position>('/api/tracker', { method: 'POST', body: JSON.stringify(p) }),

  updatePosition: (id: string, p: Partial<PositionInput>) =>
    request<Position>(`/api/tracker/${id}`, { method: 'PUT', body: JSON.stringify(p) }),

  deletePosition: (id: string) =>
    request<{ message: string }>(`/api/tracker/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (positionId: string) =>
    request<Transaction[]>(`/api/transactions/${positionId}`),

  addTransaction: (positionId: string, tx: TransactionInput) =>
    request<{ transaction: Transaction; position: Position }>(`/api/transactions/${positionId}`, { method: 'POST', body: JSON.stringify(tx) }),

  deleteTransaction: (id: string) =>
    request<{ message: string; position: Position }>(`/api/transactions/${id}`, { method: 'DELETE' }),

  getRates: () => request<{ base: string; rates: Record<string, number>; updatedAt: string }>('/api/rates'),

  getRatings: (tickers: string[]) =>
    request<Record<string, { mean: number; key: string; label: string; analysts: number } | null>>(
      `/api/ratings?tickers=${tickers.map(encodeURIComponent).join(',')}`
    ),

  getDividends: (tickers: string[]) =>
    request<Record<string, {
      annualRate: number | null;
      dividendYield: number | null;
      exDividendDate: string | null;
      exDivEstimated: boolean;
      lastAmount: number | null;
      lastDate: string | null;
      ytdPerShare: number;
      frequency: number;
    } | null>>(`/api/dividends?tickers=${tickers.map(encodeURIComponent).join(',')}`),
};

export interface Portfolio {
  _id: string;
  name: string;
  currency: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

export interface Position {
  _id: string;
  ticker: string;
  securityType: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  portfolioId?: string | null;
  entryMethod?: 'Manual' | 'Transactions';
  realizedGain?: number;
  totalDividends?: number;
}

export interface PositionInput {
  ticker: string;
  securityType: string;
  shares: number;
  purchasePrice: number;
  portfolioId?: string | null;
  entryMethod?: 'Manual' | 'Transactions';
}

export interface Transaction {
  _id: string;
  positionId: string;
  type: 'Buy' | 'Sell' | 'Dividend' | 'DividendReinvest';
  date: string;
  shares: number;
  price: number;
  amount: number;
}

export interface TransactionInput {
  type: 'Buy' | 'Sell' | 'Dividend' | 'DividendReinvest';
  date: string;
  shares?: number;
  price?: number;
  amount?: number;
}
