import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

/* ─── Theme Definitions ─── */
export interface AppTheme {
  id: string;
  label: string;
  /** Solid accent color for buttons/highlights */
  accent: string;
  /** Comma-separated R,G,B for rgba(var(--pt-accent-rgb), alpha) in inline styles */
  accentRgb: string;
  /** Lighter tint of accent for text/link states */
  accentLight: string;
  /** Main page background */
  bg: string;
  /** Sidebar / dark overlay background (includes opacity) */
  sidebar: string;
  /** Elevated surface (table rows, select options) */
  elevated: string;
}

export const APP_THEMES: Record<string, AppTheme> = {
  midnight: {
    id: 'midnight',
    label: 'Midnight Blue',
    accent: '#2563EB',
    accentRgb: '37, 99, 235',
    accentLight: '#60A5FA',
    bg: '#0A1628',
    sidebar: 'rgba(10,22,40,0.97)',
    elevated: '#1E293B',
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    accent: '#7C3AED',
    accentRgb: '124, 58, 237',
    accentLight: '#A78BFA',
    bg: '#0C0A14',
    sidebar: 'rgba(12,10,20,0.97)',
    elevated: '#1A1428',
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    accent: '#06B6D4',
    accentRgb: '6, 182, 212',
    accentLight: '#67E8F9',
    bg: '#0A1B24',
    sidebar: 'rgba(10,27,36,0.97)',
    elevated: '#152532',
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    accent: '#10B981',
    accentRgb: '16, 185, 129',
    accentLight: '#6EE7B7',
    bg: '#0A1A12',
    sidebar: 'rgba(10,26,18,0.97)',
    elevated: '#14261A',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    accent: '#F59E0B',
    accentRgb: '245, 158, 11',
    accentLight: '#FCD34D',
    bg: '#1C1008',
    sidebar: 'rgba(28,16,8,0.97)',
    elevated: '#2A1A0C',
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    accent: '#E2E8F0',
    accentRgb: '226, 232, 240',
    accentLight: '#F8FAFC',
    bg: '#000000',
    sidebar: 'rgba(0,0,0,0.98)',
    elevated: '#111111',
  },
};

/* ─── Context ─── */
interface AppThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
  appTheme: AppTheme;
}

const AppThemeCtx = createContext<AppThemeContextValue>({
  themeId: 'midnight',
  setThemeId: () => {},
  appTheme: APP_THEMES.midnight,
});

export function useAppTheme() {
  return useContext(AppThemeCtx);
}

/* ─── Provider ─── */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    return localStorage.getItem('pt_theme') ?? 'midnight';
  });

  const appTheme = APP_THEMES[themeId] ?? APP_THEMES.midnight;

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    localStorage.setItem('pt_theme', id);
  };

  /* Inject CSS custom properties on :root so all var(--pt-*) inline styles update */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pt-accent', appTheme.accent);
    root.style.setProperty('--pt-accent-rgb', appTheme.accentRgb);
    root.style.setProperty('--pt-accent-light', appTheme.accentLight);
    root.style.setProperty('--pt-bg', appTheme.bg);
    root.style.setProperty('--pt-sidebar', appTheme.sidebar);
    root.style.setProperty('--pt-elevated', appTheme.elevated);
  }, [appTheme]);

  const muiTheme = createTheme({
    palette: {
      mode: 'dark',
      background: { default: appTheme.bg, paper: appTheme.elevated },
      primary: { main: appTheme.accent },
    },
    typography: { fontFamily: "'Inter', sans-serif" },
    shape: { borderRadius: 12 },
  });

  return (
    <AppThemeCtx.Provider value={{ themeId, setThemeId, appTheme }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeCtx.Provider>
  );
}
