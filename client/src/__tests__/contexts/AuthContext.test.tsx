import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the entire api module — no real fetch calls in context tests.
vi.mock('../../api/client', () => ({
  api: {
    me:              vi.fn(),
    googleLogin:     vi.fn(),
    emailLogin:      vi.fn(),
    emailRegister:   vi.fn(),
  },
}));

import { api } from '../../api/client';

// ── Helper test component ─────────────────────────────────────────────────────
function AuthDisplay() {
  const { user, loading } = useAuth();
  if (loading) return <span data-testid="loading">loading</span>;
  return <span data-testid="user">{user?.name ?? 'none'}</span>;
}

function WithActions() {
  const { user, loading, loginWithEmail, logout } = useAuth();
  if (loading) return <span data-testid="loading">loading</span>;
  return (
    <>
      <span data-testid="user">{user?.name ?? 'none'}</span>
      <button onClick={() => loginWithEmail('bob@test.com', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('resolves to no user (loading=false) when no token is stored', async () => {
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );
    await act(async () => {});
    // No token → effect sets loading=false immediately; user should be null
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('loads the user from the server when a stored token is present', async () => {
    localStorage.setItem('pt_token', 'valid-token');
    vi.mocked(api.me).mockResolvedValueOnce({ user: { id: '1', name: 'Alice', email: 'a@test.com' } });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('user')).toHaveTextContent('Alice');
  });

  it('clears user and token from localStorage on logout', async () => {
    localStorage.setItem('pt_token', 'valid-token');
    vi.mocked(api.me).mockResolvedValueOnce({ user: { id: '1', name: 'Alice', email: 'a@test.com' } });

    render(
      <AuthProvider>
        <WithActions />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('user')).toHaveTextContent('Alice');

    await act(async () => {
      screen.getByText('Logout').click();
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('pt_token')).toBeNull();
  });

  it('loginWithEmail sets user and persists token', async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new Error('no token'));
    vi.mocked(api.emailLogin).mockResolvedValueOnce({
      token: 'new-jwt',
      user: { id: '2', name: 'Bob', email: 'b@test.com' },
    });

    render(
      <AuthProvider>
        <WithActions />
      </AuthProvider>,
    );
    await act(async () => {});

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('Bob');
    expect(localStorage.getItem('pt_token')).toBe('new-jwt');
  });

  it('clears invalid stored token on api.me failure', async () => {
    localStorage.setItem('pt_token', 'expired-token');
    vi.mocked(api.me).mockRejectedValueOnce(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('pt_token')).toBeNull();
  });
});
