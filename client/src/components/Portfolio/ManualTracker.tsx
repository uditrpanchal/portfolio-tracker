import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown,
  ChevronUp, ChevronDown, BarChart2, X, Search, RefreshCw, Wallet, FolderPlus, Check,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid,
} from 'recharts';
import {
  CircularProgress, Snackbar, Alert,
} from '@mui/material';
import { api } from '../../api/client';
import type { Position, PositionInput, Portfolio, Transaction } from '../../api/client';

/* ─── Constants ─── */
const CHART_COLORS = ['#2563EB','#8B5CF6','#10B981','#F59E0B','#F43F5E','#06B6D4','#EC4899','#84CC16'];
const LOGO_COLORS  = ['#2563EB','#8B5CF6','#10B981','#F59E0B','#F43F5E','#06B6D4','#EC4899','#84CC16','#6366F1','#14B8A6'];
const SECURITY_TYPES = ['Stock', 'ETF', 'International', 'Crypto', 'Bond'] as const;

const CURRENCIES = [
  { code:'CAD', label:'CAD — Canadian Dollar' },
  { code:'USD', label:'USD — US Dollar' },
  { code:'EUR', label:'EUR — Euro' },
  { code:'GBP', label:'GBP — British Pound' },
  { code:'JPY', label:'JPY — Japanese Yen' },
  { code:'AUD', label:'AUD — Australian Dollar' },
  { code:'CHF', label:'CHF — Swiss Franc' },
  { code:'INR', label:'INR — Indian Rupee' },
  { code:'HKD', label:'HKD — Hong Kong Dollar' },
];

const CURRENCY_LOCALE: Record<string, string> = {
  CAD:'en-CA', USD:'en-US', EUR:'de-DE', GBP:'en-GB', JPY:'ja-JP',
  AUD:'en-AU', CHF:'de-CH', INR:'en-IN', HKD:'zh-HK',
};

function makeFmt(currency: string) {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-CA';
  return {
    fmtMoney:   (n: number) => new Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits:2 }).format(n),
    fmtCompact: (n: number) => {
      const sym = new Intl.NumberFormat(locale, { style:'currency', currency, maximumFractionDigits:0 }).format(0).replace(/[\d.,\s]/g,'').trim();
      return Math.abs(n) >= 1000 ? (n < 0 ? '-' : '') + sym + (Math.abs(n)/1000).toFixed(1) + 'k'
        : new Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits:2 }).format(n);
    },
  };
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  Stock:         { bg: 'rgba(59,130,246,0.15)',  color: 'var(--pt-accent-light)' },
  ETF:           { bg: 'rgba(139,92,246,0.15)',  color: '#C4B5FD' },
  International: { bg: 'rgba(168,85,247,0.15)',  color: '#D8B4FE' },
  Crypto:        { bg: 'rgba(245,158,11,0.15)',  color: '#FCD34D' },
  Bond:          { bg: 'rgba(16,185,129,0.15)',  color: '#6EE7B7' },
};

const TYPE_EMOJI: Record<string, string> = { Stock:'📈', ETF:'🏦', International:'🌐', Crypto:'₿', Bond:'📄' };

/* ─── Formatters ─── */
const fmtCAD     = (n: number) => new Intl.NumberFormat('en-CA', { style:'currency', currency:'CAD', minimumFractionDigits:2 }).format(n);
const fmtPct     = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtShares  = (n: number) => n.toFixed(4);

/* ─── Types ─── */
interface Derived extends Position {
  costBasis: number; marketValue: number; totalReturnCAD: number; totalReturnPct: number;
}
type SortKey = 'ticker'|'securityType'|'shares'|'purchasePrice'|'currentPrice'|'costBasis'|'marketValue'|'totalReturnCAD'|'totalReturnPct';

/* ─── Helpers ─── */
function tickerColor(t: string) {
  const h = [...(t||'X')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return LOGO_COLORS[h % LOGO_COLORS.length];
}
function derive(p: Position): Derived {
  const costBasis = p.shares * p.purchasePrice;
  const marketValue = p.shares * p.currentPrice;
  const totalReturnCAD = marketValue - costBasis + (p.realizedGain || 0) + (p.totalDividends || 0);
  const totalReturnPct = costBasis !== 0 ? (totalReturnCAD / costBasis) * 100 : 0;
  return { ...p, costBasis, marketValue, totalReturnCAD, totalReturnPct };
}

/* ─── Design tokens ─── */
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset',
};
const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12, color: '#F1F5F9',
  padding: '10px 14px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13, width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const optStyle: React.CSSProperties = { background: 'var(--pt-elevated)', color: '#F1F5F9' };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: '#E2E8F0', display: 'block', marginBottom: 6 };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.1em' };
const monoNum: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const tickAxis = { fill: '#CBD5E1', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" };

/* ─── TickerLogo ─── */
function TickerLogo({ ticker, size = 28 }: { ticker: string; size?: number }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [ticker]);
  if (err || !ticker) return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: tickerColor(ticker),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
      fontFamily: "'Inter', sans-serif",
    }}>{(ticker||'X')[0]?.toUpperCase()}</span>
  );
  return (
    <img
      src={`https://financialmodelingprep.com/image-stock/${ticker.toUpperCase()}.png`}
      alt={ticker} width={size} height={size} onError={() => setErr(true)}
      style={{ borderRadius:'50%', objectFit:'contain', background:'rgba(255,255,255,0.08)', flexShrink:0, display:'block' }}
    />
  );
}

/* ─── ChartTooltip ─── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--pt-sidebar)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 16px', backdropFilter:'blur(12px)', fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
      <p style={{ color:'#E2E8F0', marginBottom:6 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color:p.color, margin:'2px 0' }}>{p.name}: {fmtCAD(p.value)}</p>)}
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ label, value, accent, sub, isReturn, positive, animKey }:
  { label:string; value:string; accent:string; sub:string; isReturn?:boolean; positive?:boolean; animKey:string }) {
  return (
    <div style={{ ...glass, padding:24, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', left:0, top:12, bottom:12, width:3, borderRadius:2, background:accent }} />
      <p style={{ ...sectionLabel, paddingLeft:12, marginBottom:8 }}>{label}</p>
      <p key={animKey+label} style={{ ...monoNum, fontSize:22, fontWeight:700, color:isReturn?accent:'#F1F5F9', paddingLeft:12, animation:'valuePop 0.3s ease-out' }}>{value}</p>
      <p style={{ fontSize:11, color:'#94A3B8', marginTop:4, paddingLeft:12 }}>{sub}</p>
      {isReturn && (
        <div style={{ position:'absolute', bottom:8, right:12, opacity:0.08 }}>
          {positive ? <TrendingUp size={32} color={accent}/> : <TrendingDown size={32} color={accent}/>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function ManualTracker() {
  const [positions,   setPositions]   = useState<Position[]>([]);
  const [portfolios,  setPortfolios]  = useState<Portfolio[]>([]);
  const [activePortfolio, setActivePortfolio] = useState<string|null>(null); // null = "All"
  const [apiLoading,  setApiLoading]  = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [snack,       setSnack]       = useState<{ msg:string; severity:'success'|'error' }|null>(null);

  // portfolio management inline state
  const [newPortfolioName,    setNewPortfolioName]    = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('CAD');
  const [addingPortfolio,     setAddingPortfolio]     = useState(false);
  const [savingPortfolio,     setSavingPortfolio]     = useState(false);
  const [renamingId,          setRenamingId]          = useState<string|null>(null);
  const [renameValue,         setRenameValue]         = useState('');
  const [renameCurrency,      setRenameCurrency]      = useState('CAD');
  const [deletingPortfolioId, setDeletingPortfolioId] = useState<string|null>(null);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editId,      setEditId]      = useState<string|null>(null);
  const [deleteId,    setDeleteId]    = useState<string|null>(null);
  const [removingId,  setRemovingId]  = useState<string|null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('marketValue');
  const [sortDir,     setSortDir]     = useState<'asc'|'desc'>('desc');
  const [hoverRow,    setHoverRow]    = useState<string|null>(null);

  /* ratings (analyst consensus via yahoo-finance2): fetched once after positions load */
  type RatingData = { mean: number; key: string; label: string; analysts: number } | null;
  const [ratings,       setRatings]       = useState<Record<string, RatingData>>({});
  const [ratingsLoading, setRatingsLoading] = useState(false);

  /* dividends */
  type DividendInfo = {
    annualRate: number | null; dividendYield: number | null;
    exDividendDate: string | null; exDivEstimated: boolean;
    lastAmount: number | null; lastDate: string | null;
    ytdPerShare: number; frequency: number;
  } | null;
  const [dividendData,    setDividendData]    = useState<Record<string, DividendInfo>>({});
  const [dividendLoading, setDividendLoading] = useState(false);

  /* form */
  const [fTicker,   setFTicker]   = useState('');
  const [fType,     setFType]     = useState('Stock');
  const [fShares,   setFShares]   = useState('');
  const [fPurchase, setFPurchase] = useState('');
  const [fPortfolio, setFPortfolio] = useState<string>('');
  const [fEntryMethod, setFEntryMethod] = useState<'Manual' | 'Transactions'>('Manual');
  const [touched,   setTouched]   = useState<Record<string,boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  /* transactions */
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [fTxType, setFTxType] = useState<'Buy'|'Sell'|'Dividend'|'DividendReinvest'>('Buy');
  const [fTxDate, setFTxDate] = useState(new Date().toISOString().slice(0,10));
  const [fTxShares, setFTxShares] = useState('');
  const [fTxPrice, setFTxPrice] = useState('');
  const [fTxAmount, setFTxAmount] = useState('');

  const fetchTransactions = useCallback((pid: string) => {
    setTxLoading(true);
    api.getTransactions(pid)
       .then(txs => setTransactions(txs))
       .catch(err => setSnack({ msg: err.message, severity: 'error' }))
       .finally(() => setTxLoading(false));
  }, []);

  const handleAddTx = async () => {
    if (!editId) return;
    try {
      setTxLoading(true);
      const res = await api.addTransaction(editId, {
        type: fTxType, date: fTxDate,
        shares: +fTxShares || 0, price: +fTxPrice || 0, amount: +fTxAmount || 0
      });
      setTransactions([res.transaction, ...transactions]);
      setPositions(prev => prev.map(p => p._id === editId ? res.position : p));
      setIsAddingTx(false); setFTxShares(''); setFTxPrice(''); setFTxAmount('');
      setSnack({ msg: 'Transaction added.', severity: 'success' });
    } catch (err: any) {
      setSnack({ msg: err.message, severity: 'error' });
    } finally {
      setTxLoading(false);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    try {
      setTxLoading(true);
      const res = await api.deleteTransaction(txId);
      setTransactions(prev => prev.filter(t => t._id !== txId));
      setPositions(prev => prev.map(p => p._id === editId ? res.position : p));
      setSnack({ msg: 'Transaction removed.', severity: 'success' });
    } catch (err: any) {
      setSnack({ msg: err.message, severity: 'error' });
    } finally {
      setTxLoading(false);
    }
  };

  /* ── fx rates for All-tab cross-currency grand totals ── */
  // rates[X] = how many X per 1 USD  (e.g. rates.CAD ≈ 1.38)
  const [fxRates,   setFxRates]   = useState<Record<string,number>>({});
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError,   setFxError]   = useState(false);

  /* ── active currency formatter ── */
  const activeCurrency = useMemo(() => {
    if (!activePortfolio) return 'CAD';
    return portfolios.find(p => p._id === activePortfolio)?.currency ?? 'CAD';
  }, [activePortfolio, portfolios]);

  const { fmtMoney, fmtCompact: fmtCmp } = useMemo(() => makeFmt(activeCurrency), [activeCurrency]);

  /* ── currency formatter for a specific portfolioId (used on All tab rows) ── */
  const currencyOf = useCallback((portfolioId?: string | null) => {
    if (!portfolioId) return 'CAD';
    return portfolios.find(p => p._id === portfolioId)?.currency ?? 'CAD';
  }, [portfolios]);

  /* ── load positions + portfolios on mount ── */
  useEffect(() => {
    Promise.all([api.getPositions(), api.getPortfolios()])
      .then(([pos, ports]) => { setPositions(pos); setPortfolios(ports); })
      .catch(() => setSnack({ msg: 'Failed to load data.', severity: 'error' }))
      .finally(() => setApiLoading(false));
  }, []);

  /* ── fetch analyst ratings after positions are known ── */
  useEffect(() => {
    if (!positions.length) return;
    const tickers = [...new Set(positions.map(p => p.ticker))];
    setRatingsLoading(true);
    api.getRatings(tickers)
      .then(data => setRatings(data))
      .catch(() => { /* ratings are best-effort; silently ignore */ })
      .finally(() => setRatingsLoading(false));
  }, [positions.length]);  // re-run only when ticker count changes

  /* ── fetch dividend data after positions are known ── */
  useEffect(() => {
    if (!positions.length) return;
    const tickers = [...new Set(positions.map(p => p.ticker))];
    setDividendLoading(true);
    api.getDividends(tickers)
      .then(data => setDividendData(data))
      .catch(() => {})
      .finally(() => setDividendLoading(false));
  }, [positions.length]);

  /* ── fetch FX rates via our own backend (yahoo-finance2 currency pairs) ── */
  useEffect(() => {
    if (activePortfolio !== null) { setFxRates({}); return; }
    setFxLoading(true); setFxError(false);
    api.getRates()
      .then(data => setFxRates(data.rates))
      .catch(() => setFxError(true))
      .finally(() => setFxLoading(false));
  }, [activePortfolio]);

  /* ── derived (filtered by active portfolio) ── */
  const filteredPositions = useMemo(() =>
    activePortfolio ? positions.filter(p => p.portfolioId === activePortfolio) : positions,
  [positions, activePortfolio]);

  const derived = useMemo(() => filteredPositions.map(derive), [filteredPositions]);
  const totals  = useMemo(() => {
    const cost = derived.reduce((s,p) => s+p.costBasis, 0);
    const mval = derived.reduce((s,p) => s+p.marketValue, 0);
    const ret  = mval - cost;
    return { cost, mval, ret, retPct: cost!==0 ? (ret/cost)*100 : 0 };
  }, [derived]);

  /* ── per-currency subtotals (All tab only) ── */
  const allCurrencyTotals = useMemo(() => {
    if (activePortfolio !== null) return {} as Record<string, { cost: number; mval: number }>;
    const result: Record<string, { cost: number; mval: number }> = {};
    for (const p of derived) {
      const cur = currencyOf(p.portfolioId);
      if (!result[cur]) result[cur] = { cost: 0, mval: 0 };
      result[cur].cost += p.costBasis;
      result[cur].mval += p.marketValue;
    }
    return result;
  }, [derived, activePortfolio, currencyOf]);

  /* ── grand totals: ALL portfolios converted to each portfolio currency ── */
  const grandTotals = useMemo((): { currency:string; cost:number; mval:number; ret:number; retPct:number }[] => {
    if (activePortfolio !== null || !Object.keys(fxRates).length) return [];
    const targetCurrencies = [...new Set(Object.keys(allCurrencyTotals))];
    const result: { currency:string; cost:number; mval:number; ret:number; retPct:number }[] = [];
    for (const targetCur of targetCurrencies) {
      const toRate = fxRates[targetCur];
      if (toRate === undefined) continue;
      let cost = 0, mval = 0, valid = true;
      for (const p of derived) {
        const fromCur  = currencyOf(p.portfolioId);
        const fromRate = fxRates[fromCur];
        if (fromRate === undefined) { valid = false; break; }
        cost += (p.costBasis   / fromRate) * toRate;
        mval += (p.marketValue / fromRate) * toRate;
      }
      if (!valid) continue;
      const ret = mval - cost;
      result.push({ currency: targetCur, cost, mval, ret, retPct: cost !== 0 ? (ret / cost) * 100 : 0 });
    }
    return result;
  }, [derived, allCurrencyTotals, fxRates, activePortfolio, currencyOf]);

  /* ── aggregate by ticker (used for charts AND All-tab table) ── */
  const chartDerived = useMemo(() => {
    const map = new Map<string, Derived>();
    for (const p of derived) {
      const existing = map.get(p.ticker);
      if (!existing) {
        map.set(p.ticker, { ...p });
      } else {
        const shares         = existing.shares + p.shares;
        const costBasis      = existing.costBasis + p.costBasis;
        const marketValue    = existing.marketValue + p.marketValue;
        const realizedGain   = (existing.realizedGain || 0) + (p.realizedGain || 0);
        const totalDividends = (existing.totalDividends || 0) + (p.totalDividends || 0);
        const totalReturnCAD = marketValue - costBasis + realizedGain + totalDividends;
        const totalReturnPct = costBasis !== 0 ? (totalReturnCAD / costBasis) * 100 : 0;
        const purchasePrice  = shares > 0 ? costBasis / shares : 0;
        const currentPrice   = shares > 0 ? marketValue / shares : p.currentPrice;
        map.set(p.ticker, { ...existing, shares, costBasis, marketValue, totalReturnCAD, totalReturnPct, purchasePrice, currentPrice, realizedGain, totalDividends });
      }
    }
    return [...map.values()];
  }, [derived]);

  /* ── sort + filter ── */
  const sorted = useMemo(() => {
    const list = [...(activePortfolio === null ? chartDerived : derived)];
    list.sort((a,b) => {
      const av=a[sortKey], bv=b[sortKey];
      if (typeof av==='string'&&typeof bv==='string')
        return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir==='asc' ? (av as number)-(bv as number) : (bv as number)-(av as number);
    });
    return list;
  }, [derived, chartDerived, activePortfolio, sortKey, sortDir]);

  const filtered = useMemo(() =>
    filterQuery ? sorted.filter(p => p.ticker.includes(filterQuery.toUpperCase())) : sorted,
  [sorted, filterQuery]);

  /* ── dividend totals (based on chartDerived = deduplicated by ticker) ── */
  const divYtdTotal = useMemo(() =>
    chartDerived.reduce((sum, p) => sum + (dividendData[p.ticker]?.ytdPerShare ?? 0) * p.shares, 0),
  [chartDerived, dividendData]);

  const divAnnualTotal = useMemo(() =>
    chartDerived.reduce((sum, p) => sum + (dividendData[p.ticker]?.annualRate ?? 0) * p.shares, 0),
  [chartDerived, dividendData]);

  /* rows for dividend table: dividend payers first (sorted by ex-div date), then non-payers */
  const divRows = useMemo(() => {
    const payers    = chartDerived.filter(p => dividendData[p.ticker] != null);
    const nonPayers = chartDerived.filter(p => dividendData[p.ticker] == null);
    payers.sort((a, b) => {
      const da = dividendData[a.ticker]?.exDividendDate;
      const db = dividendData[b.ticker]?.exDividendDate;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return new Date(da).getTime() - new Date(db).getTime();
    });
    return [...payers, ...nonPayers];
  }, [chartDerived, dividendData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey===key) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  /* ── modal ── */
  const openAdd = () => {
    setEditId(null); setFTicker(''); setFType('Stock'); setFShares(''); setFPurchase('');
    setFPortfolio(activePortfolio ?? ''); setFEntryMethod('Manual'); setTransactions([]); setIsAddingTx(false);
    setTouched({}); setModalOpen(true);
  };
  const openEdit = (p: Position) => {
    setEditId(p._id); setFTicker(p.ticker); setFType(p.securityType);
    setFShares(String(p.shares)); setFPurchase(String(p.purchasePrice));
    setFPortfolio(p.portfolioId ?? ''); setFEntryMethod(p.entryMethod || 'Manual');
    setIsAddingTx(false);
    if ((p.entryMethod || 'Manual') === 'Transactions') fetchTransactions(p._id);
    else setTransactions([]);
    setTouched({}); setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  /* ── validation ── */
  const errors = useMemo(() => {
    const e: Record<string,string> = {};
    if (!fTicker.trim()) e.ticker = 'Required';
    if (fEntryMethod === 'Manual') {
      if (!fShares || isNaN(+fShares) || +fShares<0) e.shares = 'Must be ≥ 0';
      if (!fPurchase || isNaN(+fPurchase) || +fPurchase<0) e.purchasePrice = 'Must be ≥ 0';
    }
    return e;
  }, [fTicker, fShares, fPurchase, fEntryMethod]);

  const isValid = Object.keys(errors).length === 0;

  /* ── save (API) ── */
  const handleSave = useCallback(async () => {
    setTouched({ ticker:true, shares:true, purchasePrice:true });
    if (!isValid) return;
    const payload: PositionInput = {
      ticker: fTicker.trim().toUpperCase(),
      securityType: fType,
      shares: fEntryMethod === 'Manual' ? +fShares : (editId ? (positions.find(p => p._id === editId)?.shares || 0) : 0),
      purchasePrice: fEntryMethod === 'Manual' ? +fPurchase : (editId ? (positions.find(p => p._id === editId)?.purchasePrice || 0) : 0),
      portfolioId: fPortfolio || null,
      entryMethod: fEntryMethod,
    };
    setSaving(true);
    try {
      if (editId) {
        const updated = await api.updatePosition(editId, payload);
        setPositions(prev => prev.map(p => p._id===editId ? updated : p));
        setSnack({ msg: 'Position updated.', severity: 'success' });
      } else {
        const created = await api.createPosition(payload);
        setPositions(prev => [...prev, created]);
        setSnack({ msg: 'Position added.', severity: 'success' });
      }
      closeModal();
    } catch (err: any) {
      setSnack({ msg: err.message ?? 'Save failed.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [isValid, editId, fTicker, fType, fShares, fPurchase, fPortfolio, fEntryMethod, positions]);

  /* ── delete (API) ── */
  const confirmDelete = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await api.deletePosition(id);
      setTimeout(() => {
        setPositions(prev => prev.filter(p => p._id!==id));
        setDeleteId(null); setRemovingId(null);
        setSnack({ msg: 'Position removed.', severity: 'success' });
      }, 200);
    } catch (err: any) {
      setRemovingId(null);
      setSnack({ msg: err.message ?? 'Delete failed.', severity: 'error' });
    }
  }, []);

  /* ── keyboard escape ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key==='Escape') { setDeleteId(null); if (modalOpen) closeModal(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modalOpen]);

  /* ── click outside row ── */
  useEffect(() => {
    if (!deleteId) return;
    const h = (e: MouseEvent) => {
      const row = document.querySelector(`[data-row="${deleteId}"]`);
      if (row && !row.contains(e.target as Node)) setDeleteId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [deleteId]);

  /* ── refresh handler ── */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const fetch_ = activePortfolio ? api.getPositions(activePortfolio) : api.getPositions();
    fetch_
      .then(data => { setPositions(prev => {
        // replace only the positions visible in current view; keep others intact
        const ids = new Set(data.map((p:Position) => p._id));
        return [...prev.filter(p => !ids.has(p._id)), ...data];
      }); setSnack({ msg: 'Prices refreshed.', severity: 'success' }); })
      .catch(() => setSnack({ msg: 'Failed to refresh prices.', severity: 'error' }))
      .finally(() => setRefreshing(false));
  }, [activePortfolio]);

  /* ── preview ── */
  const pCost       = (+fShares||0)*(+fPurchase||0);
  const showPreview = +fShares>0 && +fPurchase>0;

  /* ── portfolio management handlers ── */
  const handleCreatePortfolio = useCallback(async () => {
    if (!newPortfolioName.trim()) return;
    setSavingPortfolio(true);
    try {
      const p = await api.createPortfolio(newPortfolioName.trim(), newPortfolioCurrency);
      setPortfolios(prev => [...prev, p]);
      setActivePortfolio(p._id);
      setNewPortfolioName(''); setNewPortfolioCurrency('CAD'); setAddingPortfolio(false);
      setSnack({ msg: `“${p.name}” (${p.currency}) created.`, severity: 'success' });
    } catch (err: any) {
      setSnack({ msg: err.message, severity: 'error' });
    } finally { setSavingPortfolio(false); }
  }, [newPortfolioName, newPortfolioCurrency]);

  const handleRenamePortfolio = useCallback(async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const p = await api.updatePortfolio(id, renameValue.trim(), renameCurrency);
      setPortfolios(prev => prev.map(x => x._id === id ? p : x));
      setRenamingId(null);
      setSnack({ msg: `Portfolio updated to "${p.name}" (${p.currency}).`, severity: 'success' });
    } catch (err: any) {
      setSnack({ msg: err.message, severity: 'error' });
    }
  }, [renameValue, renameCurrency]);

  const handleDeletePortfolio = useCallback(async (id: string) => {
    try {
      await api.deletePortfolio(id);
      setPortfolios(prev => prev.filter(x => x._id !== id));
      setPositions(prev => prev.filter(p => p.portfolioId !== id));
      if (activePortfolio === id) setActivePortfolio(null);
      setDeletingPortfolioId(null);
      setSnack({ msg: 'Portfolio deleted.', severity: 'success' });
    } catch (err: any) {
      setSnack({ msg: err.message, severity: 'error' });
    }
  }, [activePortfolio]);

  /* ── chart data ── */
  const donutData   = chartDerived.map((p,i) => ({ name:p.ticker, value:p.marketValue, color:CHART_COLORS[i%CHART_COLORS.length] }));
  const returnsData = chartDerived.map(p => ({ ticker:p.ticker, return:p.totalReturnCAD }));
  const barData     = chartDerived.map(p => ({ ticker:p.ticker, costBasis:p.costBasis, marketValue:p.marketValue }));
  const animKey     = `${totals.mval.toFixed(0)}`;

  const cols: [string, SortKey, 'left'|'right'][] = [
    ['Ticker','ticker','left'], ['Type','securityType','left'],
    ['Shares','shares','right'], ['Avg Cost','purchasePrice','right'],
    ['Cur. Price','currentPrice','right'], ['Cost Basis','costBasis','right'],
    ['Mkt Value','marketValue','right'], ['Return $','totalReturnCAD','right'],
    ['Return %','totalReturnPct','right'],
  ];

  /* ── Analyst consensus rating cell renderer ── */
  function RatingCell({ ticker }: { ticker: string }) {
    const base = ticker.split('.')[0];
    const r = ratings[ticker] ?? ratings[base] ?? null;
    if (ratingsLoading && !r) {
      return <span style={{ fontSize:10, color:'#94A3B8' }}>…</span>;
    }
    if (!r) return <span style={{ fontSize:11, color:'#94A3B8' }}>—</span>;

    const STYLE: Record<string, { bg: string; color: string }> = {
      strong_buy:     { bg: 'rgba(34,197,94,0.15)',   color: '#4ADE80' },
      buy:            { bg: 'rgba(74,222,128,0.12)',   color: '#86EFAC' },
      outperform:     { bg: 'rgba(74,222,128,0.12)',   color: '#86EFAC' },
      overweight:     { bg: 'rgba(74,222,128,0.12)',   color: '#86EFAC' },
      hold:           { bg: 'rgba(234,179,8,0.15)',    color: '#FCD34D' },
      neutral:        { bg: 'rgba(234,179,8,0.15)',    color: '#FCD34D' },
      market_perform: { bg: 'rgba(234,179,8,0.15)',    color: '#FCD34D' },
      underperform:   { bg: 'rgba(251,146,60,0.15)',   color: '#FB923C' },
      underweight:    { bg: 'rgba(251,146,60,0.15)',   color: '#FB923C' },
      sell:           { bg: 'rgba(248,113,113,0.15)',  color: '#F87171' },
      strong_sell:    { bg: 'rgba(239,68,68,0.15)',    color: '#FCA5A5' },
    };
    const { bg, color } = STYLE[r.key] ?? { bg: 'rgba(100,116,139,0.15)', color: '#E2E8F0' };
    const title = `${r.mean} / 5 · ${r.analysts} analyst${r.analysts !== 1 ? 's' : ''}`;

    return (
      <span
        style={{ background: bg, color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}
        title={title}
      >
        {r.label}
      </span>
    );
  }

  /* ════════════════ RENDER ════════════════ */
  if (apiLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <CircularProgress sx={{ color:'var(--pt-accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical:'bottom', horizontal:'right' }}>
        <Alert severity={snack?.severity ?? 'info'} sx={{ borderRadius:2 }} onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>

      {/* ══ PORTFOLIO TABS ══ */}
      <div style={{ ...glass, padding:'12px 16px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <Wallet size={16} color="#CBD5E1" style={{ flexShrink:0 }}/>

        {/* All tab */}
        <button onClick={() => setActivePortfolio(null)}
          style={{ padding:'6px 16px', borderRadius:999, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', transition:'all 0.15s',
            background: activePortfolio === null ? 'var(--pt-accent)' : 'rgba(255,255,255,0.06)',
            color:       activePortfolio === null ? 'var(--pt-accent-text)'    : '#E2E8F0',
            boxShadow:   activePortfolio === null ? '0 0 12px rgba(var(--pt-accent-rgb),0.4)' : 'none',
          }}>All</button>

        {/* Portfolio tabs */}
        {portfolios.map(pt => (
          <div key={pt._id} style={{ display:'flex', alignItems:'center', gap:4, position:'relative' }}>
            {renamingId === pt._id ? (
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') handleRenamePortfolio(pt._id); if (e.key==='Escape') setRenamingId(null); }}
                  style={{ ...inputBase, padding:'5px 10px', fontSize:13, width:120 }}/>
                <select value={renameCurrency} onChange={e => setRenameCurrency(e.target.value)}
                  style={{ ...inputBase, padding:'5px 8px', fontSize:12, cursor:'pointer', width:90 }}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code} style={optStyle}>{c.code}</option>)}
                </select>
                <button onClick={() => handleRenamePortfolio(pt._id)} style={{ padding:6, borderRadius:8, background:'rgba(var(--pt-accent-rgb),0.2)', color:'var(--pt-accent-light)', border:'none', cursor:'pointer', display:'flex' }}><Check size={13}/></button>
                <button onClick={() => setRenamingId(null)} style={{ padding:6, borderRadius:8, background:'none', color:'#CBD5E1', border:'none', cursor:'pointer', display:'flex' }}><X size={13}/></button>
              </div>
            ) : deletingPortfolioId === pt._id ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(244,63,94,0.1)', borderRadius:999, padding:'4px 12px' }}>
                <span style={{ fontSize:12, color:'#E2E8F0' }}>Delete "{pt.name}"?</span>
                <button onClick={() => handleDeletePortfolio(pt._id)} style={{ fontSize:11, color:'#F87171', background:'rgba(244,63,94,0.2)', border:'none', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>Yes</button>
                <button onClick={() => setDeletingPortfolioId(null)} style={{ fontSize:11, color:'#CBD5E1', background:'none', border:'none', cursor:'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'inline-flex', alignItems:'center', gap:0,
                background: activePortfolio === pt._id ? 'rgba(var(--pt-accent-rgb),0.2)' : 'rgba(255,255,255,0.06)',
                borderRadius:999, border: activePortfolio === pt._id ? '1px solid rgba(var(--pt-accent-rgb),0.4)' : '1px solid transparent',
              }}>
                <button onClick={() => setActivePortfolio(pt._id)}
                  style={{ padding:'6px 14px', fontSize:13, fontWeight:500, cursor:'pointer', border:'none', background:'none', borderRadius:999,
                    color: activePortfolio === pt._id ? 'var(--pt-accent-light)' : '#E2E8F0',
                  }}>{pt.name}</button>
                {activePortfolio === pt._id && (
                  <span style={{ fontSize:10, color:'var(--pt-accent-light)', fontWeight:600, fontFamily:"'JetBrains Mono',monospace", background:'rgba(var(--pt-accent-rgb),0.15)', borderRadius:4, padding:'1px 5px', marginRight:2 }}>{pt.currency ?? 'CAD'}</span>
                )}
                {activePortfolio === pt._id && (
                  <div style={{ display:'flex', alignItems:'center', paddingRight:6, gap:2 }}>
                    <button onClick={() => { setRenamingId(pt._id); setRenameValue(pt.name); setRenameCurrency(pt.currency ?? 'CAD'); }}
                      style={{ padding:4, border:'none', background:'none', color:'#CBD5E1', cursor:'pointer', borderRadius:6, display:'flex',
                        transition:'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='var(--pt-accent-light)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#CBD5E1'}
                    ><Pencil size={11}/></button>
                    <button onClick={() => setDeletingPortfolioId(pt._id)}
                      style={{ padding:4, border:'none', background:'none', color:'#CBD5E1', cursor:'pointer', borderRadius:6, display:'flex',
                        transition:'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#F87171'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#CBD5E1'}
                    ><Trash2 size={11}/></button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add portfolio */}
        {addingPortfolio ? (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <input autoFocus placeholder="e.g. TFSA" value={newPortfolioName}
              onChange={e => setNewPortfolioName(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') handleCreatePortfolio(); if (e.key==='Escape') { setAddingPortfolio(false); setNewPortfolioName(''); setNewPortfolioCurrency('CAD'); } }}
              style={{ ...inputBase, padding:'5px 12px', fontSize:13, width:130 }}/>
            <select value={newPortfolioCurrency} onChange={e => setNewPortfolioCurrency(e.target.value)}
              style={{ ...inputBase, padding:'5px 10px', fontSize:12, width:'auto', fontFamily:"'JetBrains Mono',monospace" }}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code} style={optStyle}>{c.label}</option>)}
            </select>
            <button onClick={handleCreatePortfolio} disabled={savingPortfolio || !newPortfolioName.trim()}
              style={{ padding:'5px 14px', borderRadius:999, fontSize:13, background:'var(--pt-accent)', color:'var(--pt-accent-text)', border:'none', cursor:'pointer', opacity: (!newPortfolioName.trim()||savingPortfolio) ? 0.5 : 1 }}>
              {savingPortfolio ? '…' : 'Add'}
            </button>
            <button onClick={() => { setAddingPortfolio(false); setNewPortfolioName(''); setNewPortfolioCurrency('CAD'); }}
              style={{ padding:6, borderRadius:8, background:'none', color:'#CBD5E1', border:'none', cursor:'pointer', display:'flex' }}><X size={14}/></button>
          </div>
        ) : (
          <button onClick={() => setAddingPortfolio(true)}
            style={{ padding:'5px 12px', borderRadius:999, fontSize:12, color:'#CBD5E1', background:'none', border:'1px dashed rgba(255,255,255,0.15)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, transition:'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--pt-accent-light)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(var(--pt-accent-rgb),0.4)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#CBD5E1'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)'; }}
          ><FolderPlus size={13}/> New Portfolio</button>
        )}
      </div>

      {/* ══ HERO ══ */}
      <div style={{ ...glass, padding:24, display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16, backgroundImage:'linear-gradient(135deg, rgba(var(--pt-accent-rgb),0.15) 0%, transparent 60%)' }}>
        <div>
          {activePortfolio === null ? (
            <>
              <p style={{ fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#CBD5E1', marginBottom:10 }}>Total Portfolio Value — All Portfolios</p>
              {fxLoading ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#CBD5E1', fontSize:13 }}>
                  <CircularProgress size={14} sx={{ color:'var(--pt-accent-light)' }}/>
                  <span>Loading exchange rates…</span>
                </div>
              ) : grandTotals.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                  {grandTotals.map(gt => {
                    const { fmtMoney: fmt } = makeFmt(gt.currency);
                    return (
                      <div key={gt.currency} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:12, padding:'12px 18px', minWidth:200 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <span style={{ color:'var(--pt-accent-light)', fontWeight:700, fontSize:11, fontFamily:"'JetBrains Mono',monospace", background:'rgba(var(--pt-accent-rgb),0.15)', borderRadius:4, padding:'1px 6px' }}>{gt.currency}</span>
                          <span style={{ fontSize:10, color:'#94A3B8' }}>all portfolios</span>
                        </div>
                        <p key={animKey} style={{ ...monoNum, fontSize:24, fontWeight:700, color:'#F1F5F9', lineHeight:1.15, animation:'valuePop 0.3s ease-out' }}>{fmt(gt.mval)}</p>
                        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                          {gt.ret>=0 ? <TrendingUp size={12} color="#10B981"/> : <TrendingDown size={12} color="#F43F5E"/>}
                          <span style={{ ...monoNum, fontSize:11, color:gt.ret>=0?'#10B981':'#F43F5E' }}>{gt.ret>=0?'+':''}{fmt(gt.ret)} ({fmtPct(gt.retPct)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* fallback: error or no positions — show native per-currency */
                <>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:fxError ? 6 : 0 }}>
                    {Object.entries(allCurrencyTotals).map(([cur, vals]) => {
                      const { fmtMoney: fmt } = makeFmt(cur);
                      const ret = vals.mval - vals.cost;
                      const retPct = vals.cost !== 0 ? (ret / vals.cost) * 100 : 0;
                      return (
                        <div key={cur} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:12, padding:'12px 18px', minWidth:180 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                            <span style={{ color:'var(--pt-accent-light)', fontWeight:700, fontSize:11, fontFamily:"'JetBrains Mono',monospace", background:'rgba(var(--pt-accent-rgb),0.15)', borderRadius:4, padding:'1px 6px' }}>{cur}</span>
                          </div>
                          <p key={animKey} style={{ ...monoNum, fontSize:24, fontWeight:700, color:'#F1F5F9', lineHeight:1.15, animation:'valuePop 0.3s ease-out' }}>{fmt(vals.mval)}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                            {ret>=0 ? <TrendingUp size={12} color="#10B981"/> : <TrendingDown size={12} color="#F43F5E"/>}
                            <span style={{ ...monoNum, fontSize:11, color:ret>=0?'#10B981':'#F43F5E' }}>{ret>=0?'+':''}{fmt(ret)} ({fmtPct(retPct)})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {fxError && <p style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>Could not load exchange rates — showing native currency totals</p>}
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#CBD5E1', marginBottom:4 }}>Total Portfolio Value</p>
              <p key={animKey} style={{ ...monoNum, fontSize:36, fontWeight:700, color:'#F1F5F9', animation:'valuePop 0.3s ease-out', lineHeight:1.1 }}>{fmtMoney(totals.mval)}</p>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                {totals.ret>=0 ? <TrendingUp size={16} color="#10B981"/> : <TrendingDown size={16} color="#F43F5E"/>}
                <span style={{ ...monoNum, fontSize:13, color:totals.ret>=0?'#10B981':'#F43F5E' }}>
                  {totals.ret>=0?'+':''}{fmtMoney(totals.ret)} ({fmtPct(totals.retPct)})
                </span>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--pt-accent-light)', fontFamily:"'JetBrains Mono',monospace", background:'rgba(var(--pt-accent-rgb),0.12)', borderRadius:4, padding:'1px 6px', marginLeft:4 }}>{activeCurrency}</span>
              </div>
            </>
          )}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <GhostBtn onClick={handleRefresh}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
              {refreshing ? 'Refreshing…' : 'Refresh Prices'}
            </span>
          </GhostBtn>
          {activePortfolio !== null && <Btn onClick={openAdd}><Plus size={16}/> Add Position</Btn>}
        </div>
      </div>

      {/* ══ KPI ROW ══ */}
      {activePortfolio === null ? (
        /* All tab: one KPI row per currency (converted grand totals, or native fallback) */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {(grandTotals.length > 0 ? grandTotals
            : Object.entries(allCurrencyTotals).map(([cur, vals]) => {
                const ret = vals.mval - vals.cost;
                return { currency: cur, cost: vals.cost, mval: vals.mval, ret, retPct: vals.cost !== 0 ? (ret / vals.cost) * 100 : 0 };
              })
          ).map(gt => {
            const fmt = makeFmt(gt.currency).fmtMoney;
            const sub = grandTotals.length > 0 ? 'all portfolios converted' : 'cost basis';
            return (
              <div key={gt.currency} style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                <KPICard label={`Invested (${gt.currency})`}  value={fmt(gt.cost)} accent="var(--pt-accent)" sub={sub} animKey={animKey}/>
                <KPICard label={`Value (${gt.currency})`}     value={fmt(gt.mval)} accent="#8B5CF6" sub={grandTotals.length > 0 ? 'all portfolios converted' : 'market value'} animKey={animKey}/>
                <KPICard label={`Return $ (${gt.currency})`} value={(gt.ret>=0?'+':'')+fmt(gt.ret)} accent={gt.ret>=0?'#10B981':'#F43F5E'} sub="vs. cost basis" isReturn positive={gt.ret>=0} animKey={animKey}/>
                <KPICard label={`Return % (${gt.currency})`} value={fmtPct(gt.retPct)} accent={gt.retPct>=0?'#10B981':'#F43F5E'} sub="overall performance" isReturn positive={gt.retPct>=0} animKey={animKey}/>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <KPICard label="Total Invested"  value={fmtMoney(totals.cost)} accent="var(--pt-accent)" sub="cost basis" animKey={animKey}/>
          <KPICard label="Portfolio Value" value={fmtMoney(totals.mval)} accent="#8B5CF6" sub="market value" animKey={animKey}/>
          <KPICard label="Total Return $"  value={(totals.ret>=0?'+':'')+fmtMoney(totals.ret)} accent={totals.ret>=0?'#10B981':'#F43F5E'} sub="vs. cost basis" isReturn positive={totals.ret>=0} animKey={animKey}/>
          <KPICard label="Total Return %"  value={fmtPct(totals.retPct)} accent={totals.retPct>=0?'#10B981':'#F43F5E'} sub="overall performance" isReturn positive={totals.retPct>=0} animKey={animKey}/>
        </div>
      )}

      {/* ══ TABLE ══ */}
      <div style={{ ...glass, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <p style={sectionLabel}>Positions</p>
            <span style={{ background:'rgba(var(--pt-accent-rgb),0.2)', color:'var(--pt-accent-light)', borderRadius:999, padding:'2px 10px', fontSize:12, ...monoNum }}>{filtered.length}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ position:'relative' }}>
              <Search size={14} color="#CBD5E1" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
              <input type="text" placeholder="Filter ticker…" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
                style={{ ...inputBase, paddingLeft:32, padding:'7px 12px 7px 32px', fontSize:12, width:180 }}/>
            </div>
            {activePortfolio !== null && <IconBtn onClick={openAdd}><Plus size={16}/></IconBtn>}
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px' }}>
              <TrendingUp size={48} color="var(--pt-elevated)" style={{ marginBottom:16 }}/>
              <p style={{ fontSize:18, fontWeight:600, color:'#CBD5E1', marginBottom:6 }}>{filterQuery?'No matches found': activePortfolio===null ? 'No positions yet' : 'This portfolio is empty'}</p>
              <p style={{ fontSize:13, color:'#94A3B8', marginBottom:20 }}>{filterQuery?'Try a different ticker.': activePortfolio===null ? 'Select a portfolio tab and add positions.' : 'Click Add Position to start tracking.'}</p>
              {!filterQuery && activePortfolio !== null && <Btn onClick={openAdd}><Plus size={16}/> Add Position</Btn>}
            </div>
          ) : (
            <table>
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.025)' }}>
                  {cols.map(([label, key, align]) => (
                    <th key={key} onClick={() => toggleSort(key)} style={{ textAlign:align, padding:'12px 16px', whiteSpace:'nowrap', fontSize:11, fontWeight:600, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', userSelect:'none', transition:'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#E2E8F0'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#CBD5E1'}
                    >
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                        {label}{sortKey===key && (sortDir==='asc'?<ChevronUp size={12}/>:<ChevronDown size={12}/>)}
                      </span>
                    </th>
                  ))}
                  <th style={{ padding:'12px 16px', fontSize:11, fontWeight:600, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>Rating</th>
                  <th style={{ width:90 }}/>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isHov = hoverRow===p._id;
                  const canEdit = activePortfolio !== null;
                  return (
                    <tr key={p._id} data-row={p._id}
                      onMouseEnter={() => setHoverRow(p._id)}
                      onMouseLeave={() => setHoverRow(null)}
                      style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background:isHov?'rgba(255,255,255,0.025)':'transparent', transition:'background 0.15s', animation:removingId===p._id?'rowOut 0.2s ease-out both':'rowIn 0.25s ease-out both' }}
                    >
                      <td style={{ padding:'0 16px', height:56 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <TickerLogo ticker={p.ticker} size={28}/>
                          <div>
                            <p style={{ ...monoNum, fontWeight:700, color:'#F1F5F9', fontSize:14 }}>{p.ticker}</p>
                            <p style={{ fontSize:11, color:'#94A3B8' }}>
                              {p.securityType}
                              {activePortfolio === null && (
                                <span style={{ marginLeft:6, color:'var(--pt-accent-light)', fontFamily:"'JetBrains Mono',monospace", fontWeight:600, fontSize:10, background:'rgba(var(--pt-accent-rgb),0.12)', borderRadius:4, padding:'1px 5px' }}>{currencyOf(p.portfolioId)}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'0 16px' }}>
                        <span style={{ background:TYPE_STYLE[p.securityType]?.bg, color:TYPE_STYLE[p.securityType]?.color, borderRadius:999, padding:'3px 10px', fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{p.securityType}</span>
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right', ...monoNum, fontSize:13, color:'#CBD5E1' }}>{fmtShares(p.shares)}</td>
                      <td style={{ padding:'0 16px', textAlign:'right', ...monoNum, fontSize:13, color:'#CBD5E1' }}>
                        {activePortfolio === null
                          ? makeFmt(currencyOf(p.portfolioId)).fmtMoney(p.purchasePrice)
                          : fmtMoney(p.purchasePrice)}
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right', ...monoNum, fontSize:13, color:'#CBD5E1' }}>
                        {activePortfolio === null
                          ? makeFmt(currencyOf(p.portfolioId)).fmtMoney(p.currentPrice)
                          : fmtMoney(p.currentPrice)}
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right', ...monoNum, fontSize:13, color:'#CBD5E1' }}>
                        {activePortfolio === null
                          ? makeFmt(currencyOf(p.portfolioId)).fmtMoney(p.costBasis)
                          : fmtMoney(p.costBasis)}
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right', ...monoNum, fontSize:13, color:'#CBD5E1' }}>
                        {activePortfolio === null
                          ? makeFmt(currencyOf(p.portfolioId)).fmtMoney(p.marketValue)
                          : fmtMoney(p.marketValue)}
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right' }}>
                        <span style={{ ...monoNum, fontSize:13, color:p.totalReturnCAD>=0?'#10B981':'#F43F5E', background:p.totalReturnCAD>=0?'rgba(16,185,129,0.10)':'rgba(244,63,94,0.10)', borderRadius:6, padding:'2px 8px', display:'inline-block' }}>
                          {p.totalReturnCAD>=0?'+':''}{activePortfolio === null
                            ? makeFmt(currencyOf(p.portfolioId)).fmtMoney(p.totalReturnCAD)
                            : fmtMoney(p.totalReturnCAD)}
                        </span>
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'right' }}>
                        <span style={{ ...monoNum, fontSize:13, color:p.totalReturnPct>=0?'#10B981':'#F43F5E', background:p.totalReturnPct>=0?'rgba(16,185,129,0.10)':'rgba(244,63,94,0.10)', borderRadius:6, padding:'2px 8px', display:'inline-block' }}>
                          {fmtPct(p.totalReturnPct)}
                        </span>
                        <div style={{ height:3, borderRadius:2, marginTop:3, marginLeft:'auto', width:Math.min(Math.abs(p.totalReturnPct),100)+'%', maxWidth:80, background:p.totalReturnPct>=0?'#10B981':'#F43F5E' }}/>
                      </td>
                      <td style={{ padding:'0 16px', textAlign:'center' }}>
                        <RatingCell ticker={p.ticker}/>
                      </td>
                      <td style={{ padding:'0 12px', textAlign:'center' }}>
                        {canEdit && (deleteId===p._id ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                            <span style={{ fontSize:11, color:'#E2E8F0' }}>Remove?</span>
                            <button onClick={() => confirmDelete(p._id)} style={{ background:'rgba(244,63,94,0.2)', color:'#F87171', borderRadius:8, padding:'3px 10px', fontSize:11, cursor:'pointer', border:'none', transition:'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(244,63,94,0.35)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(244,63,94,0.2)'}
                            >Yes</button>
                            <button onClick={() => setDeleteId(null)} style={{ color:'#CBD5E1', borderRadius:8, padding:'3px 10px', fontSize:11, cursor:'pointer', border:'none', background:'none', transition:'color 0.15s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#E2E8F0'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#CBD5E1'}
                            >Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:4, opacity:isHov?1:0, transition:'opacity 0.15s' }}>
                            <RowIconBtn onClick={() => openEdit(p)} hoverColor="var(--pt-accent-light)"><Pencil size={14}/></RowIconBtn>
                            <RowIconBtn onClick={() => setDeleteId(p._id)} hoverColor="#F87171"><Trash2 size={14}/></RowIconBtn>
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ CHARTS ══ */}
      {derived.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
          {/* Donut */}
          <div style={{ ...glass, padding:24 }}>
            <p style={{ ...sectionLabel, marginBottom:20 }}>Portfolio Mix</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="transparent" isAnimationActive animationDuration={900} animationEasing="ease-out">
                  {donutData.map(e => <Cell key={e.name} fill={e.color}/>)}
                </Pie>
                <text x="50%" y="47%" textAnchor="middle" style={{ fill:'#CBD5E1', fontSize:10 }}>TOTAL</text>
                <text x="50%" y="57%" textAnchor="middle" style={{ fill:'#F1F5F9', fontSize:14, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{fmtCmp(totals.mval)}</text>
                <Tooltip content={<ChartTip/>} wrapperStyle={{ outline:'none', background:'transparent', border:'none', boxShadow:'none', padding:0 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              {donutData.map(e => {
                const pct = totals.mval>0 ? ((e.value/totals.mval)*100).toFixed(1) : '0.0';
                return (
                  <div key={e.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <TickerLogo ticker={e.name} size={18}/>
                    <span style={{ fontSize:12, color:'#CBD5E1', fontWeight:500 }}>{e.name}</span>
                    <span style={{ ...monoNum, fontSize:11, color:'#CBD5E1', marginLeft:'auto' }}>{fmtMoney(e.value)}</span>
                    <span style={{ ...monoNum, fontSize:11, color:'#94A3B8', width:40, textAlign:'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Returns Bar */}
          <div style={{ ...glass, padding:24 }}>
            <p style={{ ...sectionLabel, marginBottom:20 }}>My Returns</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={returnsData} margin={{ left:8, right:16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                <XAxis type="number" tick={tickAxis} axisLine={{ stroke:'rgba(255,255,255,0.08)' }} tickLine={false} tickFormatter={fmtCmp}/>
                <YAxis type="category" dataKey="ticker" tick={tickAxis} axisLine={{ stroke:'rgba(255,255,255,0.08)' }} tickLine={false} width={52}/>
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4"/>
                <Tooltip content={<ChartTip/>} cursor={{ fill:'rgba(255,255,255,0.04)' }} wrapperStyle={{ outline:'none', background:'transparent', border:'none', boxShadow:'none', padding:0 }}/>
                <Bar dataKey="return" name="Return" radius={[0,4,4,0] as any} isAnimationActive animationDuration={800} animationEasing="ease-out">
                  {returnsData.map((e,i) => <Cell key={i} fill={e.return>=0?'#10B981':'#F43F5E'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Grouped Bar */}
          <div style={{ ...glass, padding:24 }}>
            <p style={{ ...sectionLabel, marginBottom:20 }}>Cost vs Value</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ left:8, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="ticker" tick={tickAxis} axisLine={{ stroke:'rgba(255,255,255,0.08)' }} tickLine={false}/>
                <YAxis tick={tickAxis} axisLine={{ stroke:'rgba(255,255,255,0.08)' }} tickLine={false} tickFormatter={fmtCmp}/>
                <Tooltip content={<ChartTip/>} cursor={{ fill:'rgba(255,255,255,0.04)' }} wrapperStyle={{ outline:'none', background:'transparent', border:'none', boxShadow:'none', padding:0 }}/>
                <Legend formatter={(v:string) => <span style={{ color:'#E2E8F0', fontSize:11 }}>{v}</span>}/>
                <Bar dataKey="costBasis"   name="Cost Basis"   fill="#1E3D6E" radius={[4,4,0,0] as any} isAnimationActive animationDuration={900} animationEasing="ease-out"/>
                <Bar dataKey="marketValue" name="Market Value" fill="var(--pt-accent)" radius={[4,4,0,0] as any} isAnimationActive animationDuration={900} animationEasing="ease-out"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ DIVIDENDS ══ */}
      {chartDerived.length > 0 && (() => {
        const YEAR = new Date().getFullYear();
        const fmtDate = (iso: string | null, estimated: boolean) => {
          if (!iso) return '—';
          const d = new Date(iso);
          const s = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
          return estimated ? `~${s}` : s;
        };
        const freqLabel = (f: number) =>
          f === 12 ? 'Monthly' : f === 4 ? 'Quarterly' : f === 2 ? 'Semi-Annual' : 'Annual';
        const payerCount = divRows.filter(p => dividendData[p.ticker] != null).length;

        return (
          <div style={{ ...glass, overflow: 'hidden' }}>
            {/* ── header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={sectionLabel}>Dividends</p>
                <span style={{ background: 'rgba(var(--pt-accent-rgb),0.2)', color: 'var(--pt-accent-light)', borderRadius: 999, padding: '2px 10px', fontSize: 12, ...monoNum }}>
                  {payerCount} payer{payerCount !== 1 ? 's' : ''}
                </span>
                {dividendLoading && <span style={{ fontSize: 11, color: '#CBD5E1' }}>Loading…</span>}
              </div>
              {/* Summary KPIs */}
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 10, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>YTD {YEAR} Received</p>
                  <p style={{ ...monoNum, fontSize: 18, fontWeight: 700, color: '#10B981' }}>{fmtMoney(divYtdTotal)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Projected Annual</p>
                  <p style={{ ...monoNum, fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>{fmtMoney(divAnnualTotal)}</p>
                </div>
              </div>
            </div>

            {/* ── table ── */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {(['Ticker', 'Shares', 'Annual $/Sh', 'Yield', 'Frequency', 'Last Div', 'Next Ex-Div', 'YTD $/Sh', 'YTD Total'] as const).map((col, i) => (
                      <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', textAlign: i === 0 ? 'left' : 'right' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divRows.map((p) => {
                    const d = dividendData[p.ticker];
                    const ytdTotal = (d?.ytdPerShare ?? 0) * p.shares;
                    const annualTotal2 = (d?.annualRate ?? 0) * p.shares;
                    const isUpcoming = d?.exDividendDate && new Date(d.exDividendDate) > new Date();
                    const td: React.CSSProperties = { padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', textAlign: 'right', ...monoNum };
                    return (
                      <tr key={p.ticker} style={{ transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        {/* Ticker */}
                        <td style={{ ...td, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TickerLogo ticker={p.ticker} size={24} />
                            <span style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>{p.ticker}</span>
                          </div>
                        </td>
                        {/* Shares */}
                        <td style={{ ...td, color: '#CBD5E1' }}>{fmtShares(p.shares)}</td>
                        {/* Annual $/Sh */}
                        <td style={{ ...td, color: d?.annualRate ? '#F1F5F9' : '#94A3B8' }}>
                          {d?.annualRate != null ? `$${d.annualRate.toFixed(4)}` : '—'}
                        </td>
                        {/* Yield */}
                        <td style={{ ...td, color: d?.dividendYield ? '#10B981' : '#94A3B8' }}>
                          {d?.dividendYield != null ? (d.dividendYield * 100).toFixed(2) + '%' : '—'}
                        </td>
                        {/* Frequency */}
                        <td style={{ ...td, color: d ? '#E2E8F0' : '#94A3B8', textAlign: 'right' }}>
                          {d ? freqLabel(d.frequency) : '—'}
                        </td>
                        {/* Last Div */}
                        <td style={{ ...td, color: d?.lastAmount ? '#CBD5E1' : '#94A3B8' }}>
                          {d?.lastAmount != null ? `$${d.lastAmount.toFixed(4)}` : '—'}
                        </td>
                        {/* Ex-Div Date */}
                        <td style={{ ...td, color: isUpcoming ? '#FCD34D' : '#CBD5E1' }}>
                          {d ? fmtDate(d.exDividendDate, d.exDivEstimated) : '—'}
                        </td>
                        {/* YTD $/Sh */}
                        <td style={{ ...td, color: (d?.ytdPerShare ?? 0) > 0 ? '#86EFAC' : '#94A3B8' }}>
                          {(d?.ytdPerShare ?? 0) > 0 ? `$${d!.ytdPerShare.toFixed(4)}` : '—'}
                        </td>
                        {/* YTD Total */}
                        <td style={{ ...td, color: ytdTotal > 0 ? '#10B981' : '#94A3B8', fontWeight: ytdTotal > 0 ? 700 : 400 }}>
                          {ytdTotal > 0 ? fmtMoney(ytdTotal) : annualTotal2 > 0 ? `proj. ${fmtMoney(annualTotal2)}/yr` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 10, color: '#94A3B8', padding: '8px 16px', textAlign: 'right' }}>
              ~ estimated ex-div date  ·  Dividend data via Yahoo Finance  ·  Not financial advice
            </p>
          </div>
        );
      })()}

      {/* ══ MODAL ══ */}
      {modalOpen && (
        <div
          style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', animation:'modalFade 0.2s ease-out' }}
          onClick={e => { if (e.target===e.currentTarget) closeModal(); }}
        >
          <div style={{ ...glass, maxWidth:520, width:'calc(100% - 32px)', backdropFilter:'blur(20px)', animation:'modalFade 0.25s ease-out' }}>
            {/* header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <BarChart2 size={20} color="var(--pt-accent)"/>
                <h2 style={{ fontSize:16, fontWeight:600, color:'#F1F5F9' }}>{editId?'Edit Position':'Add Position'}</h2>
              </div>
              <IconBtn onClick={closeModal}><X size={18}/></IconBtn>
            </div>

            {/* form */}
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* Entry Method */}
                <div style={{ gridColumn: '1 / -1', background:'rgba(255,255,255,0.02)', padding:4, borderRadius:12, display:'flex', gap:4 }}>
                  {(['Manual', 'Transactions'] as const).map(m => (
                    <button key={m} type="button" onClick={() => { setFEntryMethod(m); setTouched({}); }}
                      style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                        background: fEntryMethod===m ? 'var(--pt-accent)' : 'transparent', color: fEntryMethod===m ? 'var(--pt-accent-text)' : '#E2E8F0' }}
                    >
                      {m === 'Manual' ? 'Manual Entry' : 'Transactions'}
                    </button>
                  ))}
                </div>

                {/* Ticker */}
                <div>
                  <label style={labelStyle}>Ticker</label>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <input type="text" value={fTicker} placeholder="AAPL"
                        onChange={e => { setFTicker(e.target.value.toUpperCase()); setTouched(t=>({...t,ticker:true})); }}
                        style={{ ...inputBase, ...(touched.ticker&&errors.ticker?{borderColor:'#F43F5E'}:{}) }}
                        onFocus={e => { e.currentTarget.style.borderColor='var(--pt-accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(var(--pt-accent-rgb),0.25)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow='none'; }}
                      />
                      {touched.ticker&&errors.ticker && <p style={{ fontSize:11, color:'#F87171', marginTop:4 }}>{errors.ticker}</p>}
                    </div>
                    {fTicker.length>=1 && <TickerLogo ticker={fTicker} size={32}/>}
                  </div>
                </div>
                {/* Type */}
                <div>
                  <label style={labelStyle}>Security Type</label>
                  <select value={fType} onChange={e => setFType(e.target.value)} style={inputBase}
                    onFocus={e => { e.currentTarget.style.borderColor='var(--pt-accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(var(--pt-accent-rgb),0.25)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow='none'; }}
                  >
                    {SECURITY_TYPES.map(t => <option key={t} value={t} style={optStyle}>{TYPE_EMOJI[t]} {t}</option>)}
                  </select>
                </div>
                {/* Manual Fields */}
                {fEntryMethod === 'Manual' && (
                  <>
                    {/* Shares */}
                    <div>
                      <label style={labelStyle}>Shares</label>
                      <input type="number" step="any" value={fShares} placeholder="0.0000"
                        onChange={e => { setFShares(e.target.value); setTouched(t=>({...t,shares:true})); }}
                        style={{ ...inputBase, ...(touched.shares&&errors.shares?{borderColor:'#F43F5E'}:{}) }}
                        onFocus={e => { e.currentTarget.style.borderColor='var(--pt-accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(var(--pt-accent-rgb),0.25)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow='none'; }}
                      />
                      {touched.shares&&errors.shares && <p style={{ fontSize:11, color:'#F87171', marginTop:4 }}>{errors.shares}</p>}
                    </div>
                    {/* Purchase Price */}
                    <div>
                      <label style={labelStyle}>Purchase Price</label>
                      <input type="number" step="any" value={fPurchase} placeholder="0.00"
                        onChange={e => { setFPurchase(e.target.value); setTouched(t=>({...t,purchasePrice:true})); }}
                        style={{ ...inputBase, ...(touched.purchasePrice&&errors.purchasePrice?{borderColor:'#F43F5E'}:{}) }}
                        onFocus={e => { e.currentTarget.style.borderColor='var(--pt-accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(var(--pt-accent-rgb),0.25)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow='none'; }}
                      />
                      {touched.purchasePrice&&errors.purchasePrice && <p style={{ fontSize:11, color:'#F87171', marginTop:4 }}>{errors.purchasePrice}</p>}
                    </div>
                  </>
                )}
              </div>
              {/* Transactions Section */}
              {fEntryMethod === 'Transactions' && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                  {!editId ? (
                    <div style={{ background:'rgba(var(--pt-accent-rgb),0.08)', borderRadius:12, padding:'16px', textAlign:'center' }}>
                      <p style={{ fontSize:13, color:'var(--pt-accent-light)' }}>Save this position first to start adding transactions.</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <p style={sectionLabel}>Transactions</p>
                        <GhostBtn onClick={() => setIsAddingTx(!isAddingTx)}>
                          {isAddingTx ? 'Cancel' : '+ Add Transaction'}
                        </GhostBtn>
                      </div>

                      {isAddingTx && (
                        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                              <label style={labelStyle}>Type</label>
                              <select value={fTxType} onChange={e=>setFTxType(e.target.value as any)} style={inputBase}>
                                <option value="Buy" style={optStyle}>Buy</option><option value="Sell" style={optStyle}>Sell</option>
                                <option value="Dividend" style={optStyle}>Dividend</option><option value="DividendReinvest" style={optStyle}>Div Reinvest</option>
                              </select>
                            </div>
                            <div>
                              <label style={labelStyle}>Date</label>
                              <input type="date" value={fTxDate} onChange={e=>setFTxDate(e.target.value)} style={inputBase} />
                            </div>
                            {fTxType !== 'Dividend' && (
                              <div>
                                <label style={labelStyle}>Shares</label>
                                <input type="number" step="any" value={fTxShares} onChange={e=>setFTxShares(e.target.value)} placeholder="0" style={inputBase} />
                              </div>
                            )}
                            {(fTxType === 'Buy' || fTxType === 'Sell' || fTxType === 'DividendReinvest') && (
                              <div>
                                <label style={labelStyle}>Price / Share</label>
                                <input type="number" step="any" value={fTxPrice} onChange={e=>setFTxPrice(e.target.value)} placeholder="0.00" style={inputBase} />
                              </div>
                            )}
                            {(fTxType === 'Dividend' || fTxType === 'DividendReinvest') && (
                              <div>
                                <label style={labelStyle}>Total Amount</label>
                                <input type="number" step="any" value={fTxAmount} onChange={e=>setFTxAmount(e.target.value)} placeholder="0.00" style={inputBase} />
                              </div>
                            )}
                          </div>
                          <div style={{ alignSelf:'flex-end' }}>
                            <Btn onClick={handleAddTx} disabled={txLoading}>{txLoading ? 'Saving...' : 'Save Tx'}</Btn>
                          </div>
                        </div>
                      )}

                      {txLoading && !isAddingTx && <p style={{ fontSize:12, color:'#CBD5E1', textAlign:'center', padding:10 }}>Loading transactions...</p>}
                      {!txLoading && transactions.length === 0 && !isAddingTx && (
                        <p style={{ fontSize:12, color:'#CBD5E1', textAlign:'center', padding:10 }}>No transactions recorded.</p>
                      )}
                      {!txLoading && transactions.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                          {transactions.map(tx => (
                            <div key={tx._id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:8 }}>
                              <div>
                                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                  <span style={{ fontSize:10, fontWeight:600, color:tx.type==='Buy'?'#10B981':tx.type==='Sell'?'#F43F5E':'#8B5CF6', textTransform:'uppercase' }}>{tx.type}</span>
                                  <span style={{ fontSize:11, color:'#E2E8F0' }}>{new Date(tx.date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</span>
                                </div>
                                <p style={{ ...monoNum, fontSize:13, color:'#CBD5E1', marginTop:2 }}>
                                  {tx.type==='Dividend' ? fmtMoney(tx.amount) : `${fmtShares(tx.shares)} @ ${fmtMoney(tx.price)}`}
                                </p>
                              </div>
                              <RowIconBtn hoverColor="#F87171" onClick={() => handleDeleteTx(tx._id)}><Trash2 size={13}/></RowIconBtn>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Live price notice */}
              <div style={{ background:'rgba(var(--pt-accent-rgb),0.08)', border:'1px solid rgba(var(--pt-accent-rgb),0.2)', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <TrendingUp size={15} color="var(--pt-accent-light)" style={{ flexShrink:0 }}/>
                <p style={{ fontSize:12, color:'var(--pt-accent-light)', lineHeight:1.5 }}>Current price is <strong>automatically fetched</strong> from live market data when you save, and refreshed each time you load the page.</p>
              </div>

              {/* Portfolio assignment */}
              {portfolios.length > 0 && (
                <div>
                  <label style={labelStyle}>Portfolio (optional)</label>
                  <select value={fPortfolio} onChange={e => setFPortfolio(e.target.value)} style={inputBase}
                    onFocus={e => { e.currentTarget.style.borderColor='var(--pt-accent)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(var(--pt-accent-rgb),0.25)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow='none'; }}
                  >
                    <option value="" style={optStyle}>— No portfolio —</option>
                    {portfolios.map(pt => <option key={pt._id} value={pt._id} style={optStyle}>{pt.name}</option>)}
                  </select>
                </div>
              )}

              {/* Preview */}
              {fEntryMethod === 'Manual' && showPreview && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:16 }}>
                  <p style={{ ...sectionLabel, marginBottom:12 }}>Preview</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:16 }}>
                    <div>
                      <p style={{ fontSize:11, color:'#CBD5E1', marginBottom:4 }}>Cost Basis</p>
                      <p style={{ ...monoNum, fontSize:13, fontWeight:600, color:'#CBD5E1' }}>{fmtMoney(pCost)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize:11, color:'#CBD5E1', marginBottom:4 }}>Shares</p>
                      <p style={{ ...monoNum, fontSize:13, fontWeight:600, color:'#CBD5E1' }}>{fmtShares(+fShares)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
              <GhostBtn onClick={closeModal}>Cancel</GhostBtn>
              <Btn onClick={handleSave} disabled={!isValid||saving}>
                {saving
                  ? <><CircularProgress size={14} sx={{ color:'var(--pt-accent-text)', mr:0.5 }}/>Fetching price…</>
                  : 'Save Position'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Micro button helpers ─── */
function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: ()=>void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, fontSize:14, fontWeight:600,
      color:'var(--pt-accent-text)', background:'var(--pt-accent)', border:'none', cursor:disabled?'not-allowed':'pointer',
      boxShadow:disabled?'none':'0 0 20px rgba(var(--pt-accent-rgb),0.5)', opacity:disabled?0.5:1,
      transition:'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { if(!disabled){ (e.currentTarget).style.transform='scale(1.05)'; (e.currentTarget).style.boxShadow='0 0 28px rgba(var(--pt-accent-rgb),0.7)'; } }}
      onMouseLeave={e => { (e.currentTarget).style.transform='scale(1)'; (e.currentTarget).style.boxShadow=disabled?'none':'0 0 20px rgba(var(--pt-accent-rgb),0.5)'; }}
    >{children}</button>
  );
}
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: ()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:'9px 16px', borderRadius:12, fontSize:13, color:'#E2E8F0', cursor:'pointer', border:'none', background:'none', transition:'color 0.15s, background 0.15s' }}
      onMouseEnter={e => { (e.currentTarget).style.color='#F1F5F9'; (e.currentTarget).style.background='rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { (e.currentTarget).style.color='#E2E8F0'; (e.currentTarget).style.background='transparent'; }}
    >{children}</button>
  );
}
function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: ()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:8, borderRadius:10, color:'#CBD5E1', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', background:'none', transition:'color 0.15s, background 0.15s', display:'flex', alignItems:'center' }}
      onMouseEnter={e => { (e.currentTarget).style.color='var(--pt-accent-light)'; (e.currentTarget).style.background='rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { (e.currentTarget).style.color='#CBD5E1'; (e.currentTarget).style.background='transparent'; }}
    >{children}</button>
  );
}
function RowIconBtn({ children, onClick, hoverColor }: { children: React.ReactNode; onClick: ()=>void; hoverColor: string }) {
  return (
    <button onClick={onClick} style={{ borderRadius:8, padding:6, color:'#CBD5E1', cursor:'pointer', border:'none', background:'none', transition:'color 0.15s, background 0.15s', display:'flex', alignItems:'center' }}
      onMouseEnter={e => { (e.currentTarget).style.color=hoverColor; (e.currentTarget).style.background='rgba(255,255,255,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget).style.color='#CBD5E1'; (e.currentTarget).style.background='transparent'; }}
    >{children}</button>
  );
}
