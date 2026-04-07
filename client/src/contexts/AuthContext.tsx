import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem('pt_token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify stored token is still valid
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => { localStorage.removeItem('pt_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = useCallback((tok: string, u: UserProfile) => {
    localStorage.setItem('pt_token', tok);
    setToken(tok);
    setUser(u);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const { token: tok, user: u } = await api.googleLogin(credential);
    handleAuth(tok, u);
  }, [handleAuth]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { token: tok, user: u } = await api.emailLogin(email, password);
    handleAuth(tok, u);
  }, [handleAuth]);

  const registerWithEmail = useCallback(async (email: string, password: string, name: string) => {
    const { token: tok, user: u } = await api.emailRegister(email, password, name);
    handleAuth(tok, u);
  }, [handleAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('pt_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
