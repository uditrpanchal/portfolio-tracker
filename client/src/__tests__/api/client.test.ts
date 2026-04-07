import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../api/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeOkResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function makeErrorResponse(body: unknown, status = 400) {
  return { ok: false, status, json: async () => body } as Response;
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sends the JSON body correctly', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ token: 't', user: {} }));
    await api.emailLogin('user@test.com', 'pass');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ email: 'user@test.com', password: 'pass' });
  });

  it('includes Authorization header when a token is stored', async () => {
    localStorage.setItem('pt_token', 'stored-token');
    mockFetch.mockResolvedValueOnce(makeOkResponse({ token: 't', user: {} }));
    await api.emailLogin('user@test.com', 'pass');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer stored-token');
  });

  it('omits Authorization header when no token is stored', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ token: 't', user: {} }));
    await api.emailLogin('user@test.com', 'pass');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('throws with the server error message on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({ message: 'Invalid credentials' }, 401));
    await expect(api.emailLogin('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('throws "Request failed" when the server returns no message', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({}, 500));
    await expect(api.emailLogin('x@x.com', 'y')).rejects.toThrow('Request failed');
  });

  it('calls the correct endpoint for getPositions without portfolioId', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));
    await api.getPositions();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/tracker$/);
  });

  it('appends portfolioId query param when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));
    await api.getPositions('portfolio-123');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('portfolioId=portfolio-123');
  });
});
