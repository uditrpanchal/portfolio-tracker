# Client — React Frontend

[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![MUI](https://img.shields.io/badge/MUI-v7-007FFF?logo=mui)](https://mui.com)

The React + Vite + TypeScript frontend for Portfolio Tracker.

---

## 📁 Structure

```
client/
├── public/
├── src/
│   ├── api/
│   │   └── client.ts            # All typed fetch wrappers + TypeScript interfaces
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Layout.tsx       # App shell, sidebar toggle, CSS variable–themed
│   │   │   └── Sidebar.tsx      # Navigation links, theme picker, user info + logout
│   │   └── Portfolio/
│   │       └── ManualTracker.tsx  # Main dashboard: positions table, charts, dividends, ratings
│   ├── contexts/
│   │   ├── AuthContext.tsx      # JWT state, login/logout helpers, persists to localStorage
│   │   └── ThemeContext.tsx     # 6 themes, CSS custom properties, MUI ThemeProvider
│   ├── pages/
│   │   ├── SignIn.tsx
│   │   └── SignUp.tsx
│   ├── App.tsx                  # React Router routes + ProtectedRoute
│   ├── index.css                # @keyframes: rowIn, rowOut, valuePop, modalFade, spin
│   └── main.tsx                 # Providers: GoogleOAuthProvider → AppThemeProvider → BrowserRouter → AuthProvider
├── .env                         # VITE_API_URL, VITE_GOOGLE_CLIENT_ID  (git-ignored)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts               # proxy /api → http://localhost:5000, strictPort: 5177
```

---

## 🎨 Theme System

Six themes are available (settable from the sidebar):

| Theme | Class |
|-------|-------|
| Midnight Blue | `theme-midnight-blue` |
| Obsidian | `theme-obsidian` |
| Aurora | `theme-aurora` |
| Forest | `theme-forest` |
| Sunset | `theme-sunset` |
| Noir | `theme-noir` |

Each theme sets a palette of CSS custom properties (`--pt-bg`, `--pt-surface`, `--pt-primary`, `--pt-text`, etc.) that are consumed by both raw CSS and the MUI `ThemeProvider` instance.

---

## 🖥️ Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5177 |
| `npm run build` | Type-check (`tsc -b`) then bundle (`vite build`) |
| `npm run lint` | ESLint check |
| `npm run preview` | Serve production build locally |

---

## 🔑 Environment Variables

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
```

> **VITE_GOOGLE_CLIENT_ID** must match the value used in `server/.env` and must have `http://localhost:5177` listed as an authorised JavaScript origin in Google Cloud Console.

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.4 | UI |
| @mui/material | 7.3.9 | Component library |
| recharts | 3.8.1 | Portfolio charts (Pie, Bar) |
| react-router-dom | 7.14.0 | Client-side routing |
| @react-oauth/google | 0.13.4 | Google One-Tap OAuth |
| lucide-react | 1.7.0 | Icons |

---

## 🧪 Tests

There is no automated test suite currently. The project is manually tested end-to-end.

**Planned:** Vitest + React Testing Library for component unit tests.

---

## 🗺️ Roadmap

- [ ] Vitest unit tests for ManualTracker and context hooks
- [ ] Mobile-responsive table / card layout
- [ ] CSV import (Wealthsimple export format)
- [ ] Performance chart — historical portfolio value (time-series)
