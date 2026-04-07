import { useState, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Wallet, Home, Car, ShoppingCart, User, Heart, PiggyBank, Gamepad2,
  Plus, Trash2, RotateCcw, Download, FileText, Globe,
  TrendingUp, TrendingDown, ArrowDownUp, Info,
  CalendarDays, Receipt, Tag, X,
} from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  MONTHS, CURRENCIES, CATEGORY_COLORS, FREQ_LABELS, getSymbol,
  toMonthly, monthKey, prevMonthKey, nextMonthKey, parseMonthKey,
  catMonthlyTotal, calcTotals,
  loadBudgetStore, saveBudgetStore, getOrInitMonth, getCarryForward,
  getDailyExpenses, addDailyExpense, removeDailyExpense, dailyTotalsByCategory, dailyGrandTotal,
} from './budgetHelpers';
import { exportCSV, exportPDF } from './budgetExport';
import type { BudgetCategory, BudgetLineItem, BudgetStore, DailyExpense } from './types';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const CAT_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  income:        Wallet,
  housing:       Home,
  transport:     Car,
  food:          ShoppingCart,
  personal:      User,
  health:        Heart,
  savings:       PiggyBank,
  entertainment: Gamepad2,
};

// ─── Donut Chart ─────────────────────────────────────────────────────────────
interface DonutProps {
  segments: { value: number; color: string; label: string }[];
  symbol: string;
  total: number;
}
function DonutChart({ segments, symbol, total }: DonutProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const radius = 52;
  const stroke = 20;
  const cx = 70, cy = 70;
  const circ = 2 * Math.PI * radius;

  const filled = segments.filter(s => s.value > 0);
  let offset = 0;
  const arcs = filled.map((seg, i) => {
    const pct = seg.value / (total || 1);
    const len = pct * circ;
    const dash = `${len.toFixed(2)} ${(circ - len).toFixed(2)}`;
    const dashOff = (-offset * circ).toFixed(2);
    offset += pct;
    return { ...seg, dash, dashOff, i };
  });

  const hov = hovered !== null ? arcs[hovered] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg viewBox="0 0 140 140" width={140} height={140}>
          <circle cx={cx} cy={cy} r={radius} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          {arcs.map((arc, i) => (
            <circle
              key={arc.label}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={hovered === i ? stroke + 4 : stroke}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.dashOff}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
                transition: 'stroke-width 0.15s, stroke-dasharray 0.4s ease',
                cursor: 'pointer',
                filter: hovered === i ? `drop-shadow(0 0 6px ${arc.color})` : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Center text */}
          {hov ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize={7.5} fill="#94A3B8" fontFamily="Inter, sans-serif">
                {hov.label.length > 14 ? hov.label.slice(0, 13) + '…' : hov.label}
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={10} fontWeight="700" fill="#F1F5F9" fontFamily="Inter, sans-serif">
                {symbol}{hov.value.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 5} textAnchor="middle" fontSize={8} fill="#94A3B8" fontFamily="Inter, sans-serif">Expenses</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fontWeight="700" fill="#F1F5F9" fontFamily="Inter, sans-serif">
                {symbol}{total.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtMoney(v: number, symbol: string) {
  return `${symbol}${Math.abs(v).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BudgetPlanner() {
  useAppTheme();
  const now = new Date();

  // ── State ──
  const [store, setStore] = useState<BudgetStore>(() => loadBudgetStore());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<'overview' | 'daily'>('overview');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['income', 'housing']));
  const [showReset, setShowReset] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  // Daily log form state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [dForm, setDForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    categoryId: 'food',
    amount: '',
  });
  const currencyRef = useRef<HTMLDivElement>(null);

  const mk = monthKey(year, month);
  const pmk = prevMonthKey(year, month);
  const currency = store.currency;
  const symbol = getSymbol(currency);

  // ── Current month data ──
  const monthData = useMemo(() => getOrInitMonth(store, mk), [store, mk]);
  const cats = monthData.categories;

  // ── Daily expenses ──
  const dailyExpenses = useMemo(() => getDailyExpenses(store, mk), [store, mk]);
  const dailyByCategory = useMemo(() => dailyTotalsByCategory(dailyExpenses), [dailyExpenses]);
  const dailyTotal = useMemo(() => dailyGrandTotal(dailyExpenses), [dailyExpenses]);
  // Sorted by date descending for display
  const dailySorted = useMemo(() =>
    [...dailyExpenses].sort((a, b) => b.date.localeCompare(a.date)),
  [dailyExpenses]);

  // ── Carry forward ──
  const carryForward = useMemo(() => getCarryForward(store, pmk), [store, pmk]);

  // ── Totals ──
  const { totalIncomeTarget, totalIncomeActual, totalExpensesTarget, totalExpensesActual } = useMemo(
    () => calcTotals(cats),
    [cats]
  );
  const netActual = totalIncomeActual + carryForward - totalExpensesActual;
  const netTarget = totalIncomeTarget - totalExpensesTarget;

  // ── Donut segments (expense actual values) ──
  const donutSegments = useMemo(() => {
    return cats
      .filter(c => c.type === 'expense')
      .map((c, i) => ({
        value: catMonthlyTotal(c, 'actual'),
        color: CATEGORY_COLORS[i + 1] ?? '#94A3B8',
        label: c.label,
      }))
      .filter(s => s.value > 0);
  }, [cats]);

  // ── Persist helper ──
  const updateStore = useCallback((updated: BudgetStore) => {
    saveBudgetStore(updated);
    setStore({ ...updated });
  }, []);

  // ── Add daily expense ──
  const handleAddDailyExpense = useCallback(() => {
    const amt = parseFloat(dForm.amount);
    if (!dForm.description.trim() || isNaN(amt) || amt <= 0) return;
    const expense: DailyExpense = {
      id: `de-${Date.now()}`,
      date: dForm.date,
      description: dForm.description.trim(),
      categoryId: dForm.categoryId,
      amount: amt,
    };
    updateStore(addDailyExpense(store, mk, expense));
    setDForm(f => ({ ...f, description: '', amount: '' }));
    setShowAddExpense(false);
  }, [dForm, store, mk, updateStore]);

  // ── Remove daily expense ──
  const handleRemoveDailyExpense = useCallback((id: string) => {
    updateStore(removeDailyExpense(store, mk, id));
  }, [store, mk, updateStore]);

  // ── Update a line item ──
  const updateItem = useCallback((catId: string, itemId: string, patch: Partial<BudgetLineItem>) => {
    const newCats = cats.map(c => {
      if (c.id !== catId) return c;
      return { ...c, items: c.items.map(it => it.id === itemId ? { ...it, ...patch } : it) };
    });
    updateStore({ ...store, months: { ...store.months, [mk]: { categories: newCats } } });
  }, [store, cats, mk, updateStore]);

  // ── Add custom item ──
  const addItem = useCallback((catId: string) => {
    const newId = `custom-${Date.now()}`;
    const newCats = cats.map(c => {
      if (c.id !== catId) return c;
      return { ...c, items: [...c.items, { id: newId, label: 'New Item', targetRaw: '', actualRaw: '', frequency: 'monthly' as const }] };
    });
    updateStore({ ...store, months: { ...store.months, [mk]: { categories: newCats } } });
  }, [store, cats, mk, updateStore]);

  // ── Remove item ──
  const removeItem = useCallback((catId: string, itemId: string) => {
    const newCats = cats.map(c => {
      if (c.id !== catId) return c;
      return { ...c, items: c.items.filter(it => it.id !== itemId) };
    });
    updateStore({ ...store, months: { ...store.months, [mk]: { categories: newCats } } });
  }, [store, cats, mk, updateStore]);

  // ── Navigate months ──
  const prevMonth = () => {
    const { year: ny, month: nm } = parseMonthKey(prevMonthKey(year, month));
    setYear(ny); setMonth(nm);
  };
  const nextMonth = () => {
    const { year: ny, month: nm } = parseMonthKey(nextMonthKey(year, month));
    setYear(ny); setMonth(nm);
  };

  // ── Copy previous month's targets ──
  const copyPrevTargets = () => {
    const prev = store.months[pmk];
    if (!prev) return;
    const newCats: BudgetCategory[] = cats.map(c => {
      const prevCat = prev.categories.find(pc => pc.id === c.id);
      if (!prevCat) return c;
      return {
        ...c,
        items: c.items.map(it => {
          const pi = prevCat.items.find(pi => pi.id === it.id);
          return pi ? { ...it, targetRaw: pi.targetRaw, frequency: pi.frequency } : it;
        }),
      };
    });
    updateStore({ ...store, months: { ...store.months, [mk]: { categories: newCats } } });
  };

  // ── Reset current month ──
  const resetMonth = () => {
    const newMonths = { ...store.months };
    delete newMonths[mk];
    updateStore({ ...store, months: newMonths });
    setShowReset(false);
  };

  // ── Change currency ──
  const setCurrency = (code: string) => {
    updateStore({ ...store, currency: code });
    setShowCurrencyMenu(false);
  };

  // ── Toggle category expand ──
  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ── Progress bar color ──
  function progColor(pct: number, isIncome: boolean) {
    if (isIncome) return pct >= 1 ? '#4ADE80' : '#22D3EE';
    if (pct > 1) return '#F87171';
    if (pct > 0.8) return '#FACC15';
    return '#4ADE80';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  const hasPrevData = !!store.months[pmk];
  // expense categories only (for daily log dropdown)
  const expenseCats = cats.filter(c => c.type === 'expense');

  return (
    <div style={{
      minHeight: '100vh',
      padding: '28px 32px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.5px' }}>Budget Planner</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Track your monthly income and expenses</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Currency picker */}
          <div ref={currencyRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCurrencyMenu(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 10, fontSize: 13,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E2E8F0', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <Globe size={14} />
              <span style={{ fontWeight: 600 }}>{currency}</span>
              <ChevronDown size={13} style={{ color: '#94A3B8', marginLeft: 2 }} />
            </button>
            {showCurrencyMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                background: '#0D1B2E', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '6px', minWidth: 220,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              }}>
                {CURRENCIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: 'none', cursor: 'pointer', fontSize: 13,
                      background: currency === c.code ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: currency === c.code ? '#F1F5F9' : '#CBD5E1',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = currency === c.code ? 'rgba(255,255,255,0.08)' : 'transparent')}
                  >
                    <span>{c.label}</span>
                    <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 12 }}>{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={() => exportCSV(store, mk, carryForward)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10, fontSize: 13,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#E2E8F0', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <Download size={14} /> CSV
          </button>

          {/* Export PDF */}
          <button
            onClick={() => exportPDF(store, mk, carryForward)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10, fontSize: 13,
              background: `rgba(var(--pt-accent-rgb),0.14)`,
              border: `1px solid rgba(var(--pt-accent-rgb),0.28)`,
              color: 'var(--pt-accent-light)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `rgba(var(--pt-accent-rgb),0.24)`)}
            onMouseLeave={e => (e.currentTarget.style.background = `rgba(var(--pt-accent-rgb),0.14)`)}
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.07)' }}>
        {[{ id: 'overview' as const, label: 'Budget Overview', icon: Receipt },
          { id: 'daily' as const, label: 'Daily Expenses', icon: CalendarDays }]
          .map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 9, fontSize: 13, border: 'none',
                cursor: 'pointer', transition: 'all 0.2s',
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: isActive ? '#F1F5F9' : '#64748B',
                fontWeight: isActive ? 600 : 400,
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              }}>
                <TabIcon size={15} />
                {tab.label}
                {tab.id === 'daily' && dailyExpenses.length > 0 && (
                  <span style={{ background: 'var(--pt-accent)', color: 'var(--pt-accent-text)', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                    {dailyExpenses.length}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* ── Month navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px', marginBottom: 24,
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={prevMonth}
            style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#CBD5E1', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', minWidth: 180, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#CBD5E1', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <ChevronRight size={18} />
          </button>

          {/* Jump to today */}
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#94A3B8', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
          >
            Today
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasPrevData && (
            <button
              onClick={copyPrevTargets}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 8, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#94A3B8', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
              title="Copy last month's budget targets to this month"
            >
              <ArrowDownUp size={12} /> Copy prev. targets
            </button>
          )}
          <button
            onClick={() => setShowReset(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, fontSize: 12, border: '1px solid rgba(244,63,94,0.25)',
              background: 'transparent', color: '#94A3B8', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <RotateCcw size={12} /> Reset month
          </button>
        </div>
      </div>

      {/* ── Carry forward banner ── */}
      {carryForward !== 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 10, marginBottom: 20,
          background: carryForward > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${carryForward > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
          <Info size={15} color={carryForward > 0 ? '#4ADE80' : '#F87171'} />
          <span style={{ fontSize: 13, color: carryForward > 0 ? '#4ADE80' : '#F87171', fontWeight: 500 }}>
            {carryForward > 0 ? 'Surplus' : 'Deficit'} of&nbsp;
            <strong>{symbol}{Math.abs(carryForward).toFixed(2)}</strong>&nbsp;
            carried forward from {MONTHS[parseMonthKey(pmk).month]} {parseMonthKey(pmk).year}
          </span>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          {
            label: 'Total Income', icon: TrendingUp,
            target: totalIncomeTarget, actual: totalIncomeActual,
            color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.15)',
          },
          {
            label: 'Total Expenses', icon: TrendingDown,
            target: totalExpensesTarget, actual: totalExpensesActual,
            color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.15)',
          },
          ...(carryForward !== 0 ? [{
            label: 'Carry Forward', icon: ArrowDownUp,
            target: 0, actual: carryForward,
            color: carryForward >= 0 ? '#22D3EE' : '#FACC15',
            bg: carryForward >= 0 ? 'rgba(34,211,238,0.08)' : 'rgba(250,204,21,0.08)',
            border: carryForward >= 0 ? 'rgba(34,211,238,0.15)' : 'rgba(250,204,21,0.15)',
          }] : []),
          {
            label: 'Net Balance', icon: Wallet,
            target: netTarget, actual: netActual,
            color: netActual >= 0 ? '#4ADE80' : '#F87171',
            bg: netActual >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: netActual >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          },
        ].map(card => {
          const Icon = card.icon;
          const showTarget = card.label !== 'Carry Forward' && card.target !== 0;
          return (
            <div key={card.label} style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 14, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {card.label}
                </span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={card.color} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color, letterSpacing: '-0.5px' }}>
                  {card.actual < 0 ? '−' : ''}{fmtMoney(card.actual, symbol)}
                </div>
                {showTarget && (
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Budget: {fmtMoney(card.target, symbol)} / mo
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main grid ── */}
      {activeTab === 'overview' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Category accordion ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cats.map((cat, catIdx) => {
            const Icon = CAT_ICONS[cat.id] ?? Wallet;
            const color = CATEGORY_COLORS[catIdx] ?? '#94A3B8';
            const isExpanded = expandedCats.has(cat.id);
            const catTarget = catMonthlyTotal(cat, 'target');
            const catActual = catMonthlyTotal(cat, 'actual');
            const pct = catTarget > 0 ? catActual / catTarget : 0;
            const isIncome = cat.type === 'income';

            return (
              <div key={cat.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {/* Category header */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', background: 'transparent', border: 'none',
                    cursor: 'pointer', color: '#F1F5F9', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748B' }}>Budget: {fmtMoney(catTarget, symbol)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isIncome ? '#4ADE80' : (catActual > catTarget && catTarget > 0 ? '#F87171' : '#F1F5F9') }}>
                          {fmtMoney(catActual, symbol)}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.min(pct * 100, 100)}%`,
                        background: progColor(pct, isIncome),
                        transition: 'width 0.4s ease, background 0.3s',
                      }} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="#64748B" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="#64748B" style={{ flexShrink: 0 }} />}
                </button>

                {/* Expanded items */}
                {isExpanded && (
                  <div style={{ padding: '0 18px 14px' }}>
                    {/* Column headers */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 110px 110px 100px 32px',
                      gap: 8, padding: '6px 8px 6px 4px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4,
                    }}>
                      {['Item', 'Frequency', 'Budget / mo', 'Actual / mo', ''].map((h, i) => (
                        <span key={i} style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 1 ? 'right' : 'left' }}>
                          {h}
                        </span>
                      ))}
                    </div>

                    {cat.items.map(item => {
                      const tgt = toMonthly(parseFloat(item.targetRaw) || 0, item.frequency);
                      const act = toMonthly(parseFloat(item.actualRaw) || 0, item.frequency);
                      const overBudget = !isIncome && act > tgt && tgt > 0;

                      return (
                        <div key={item.id} style={{
                          display: 'grid', gridTemplateColumns: '1fr 110px 110px 100px 32px',
                          gap: 8, alignItems: 'center', padding: '4px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                        }}>
                          {/* Label */}
                          <input
                            value={item.label}
                            onChange={e => updateItem(cat.id, item.id, { label: e.target.value })}
                            style={{
                              background: 'transparent', border: 'none', color: '#CBD5E1',
                              fontSize: 13, width: '100%', outline: 'none', padding: '4px 2px',
                            }}
                            onFocus={e => (e.currentTarget.style.color = '#F1F5F9')}
                            onBlur={e => (e.currentTarget.style.color = '#CBD5E1')}
                          />

                          {/* Frequency */}
                          <select
                            value={item.frequency}
                            onChange={e => updateItem(cat.id, item.id, { frequency: e.target.value as any })}
                            style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 6, color: '#94A3B8', fontSize: 11,
                              padding: '4px 6px', cursor: 'pointer', width: '100%', outline: 'none',
                            }}
                          >
                            {Object.entries(FREQ_LABELS).map(([v, l]) => (
                              <option key={v} value={v} style={{ background: '#0D1B2E' }}>{l}</option>
                            ))}
                          </select>

                          {/* Target */}
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#64748B', pointerEvents: 'none' }}>
                              {symbol}
                            </span>
                            <input
                              type="number" min={0} placeholder="0"
                              value={item.targetRaw}
                              onChange={e => updateItem(cat.id, item.id, { targetRaw: e.target.value })}
                              style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
                                color: '#F1F5F9', fontSize: 12, padding: '5px 6px 5px 20px',
                                outline: 'none', textAlign: 'right',
                              }}
                              onFocus={e => (e.currentTarget.style.borderColor = `rgba(var(--pt-accent-rgb),0.5)`)}
                              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                            />
                          </div>

                          {/* Actual */}
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#64748B', pointerEvents: 'none' }}>
                              {symbol}
                            </span>
                            <input
                              type="number" min={0} placeholder="0"
                              value={item.actualRaw}
                              onChange={e => updateItem(cat.id, item.id, { actualRaw: e.target.value })}
                              style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${overBudget ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 7,
                                color: overBudget ? '#F87171' : '#F1F5F9',
                                fontSize: 12, padding: '5px 6px 5px 20px',
                                outline: 'none', textAlign: 'right',
                              }}
                              onFocus={e => (e.currentTarget.style.borderColor = overBudget ? 'rgba(248,113,113,0.6)' : `rgba(var(--pt-accent-rgb),0.5)`)}
                              onBlur={e => (e.currentTarget.style.borderColor = overBudget ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.08)')}
                            />
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => removeItem(cat.id, item.id)}
                            style={{
                              padding: 5, background: 'transparent', border: 'none',
                              color: 'transparent', borderRadius: 6, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}

                    {/* Add item */}
                    <button
                      onClick={() => addItem(cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
                        padding: '6px 10px', borderRadius: 8, fontSize: 12,
                        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)',
                        color: '#64748B', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      <Plus size={13} /> Add item
                    </button>

                    {/* Subtotals */}
                    <div style={{
                      display: 'flex', justifyContent: 'flex-end', gap: 16,
                      marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        Subtotal Budget: <strong style={{ color: '#CBD5E1' }}>{fmtMoney(catTarget, symbol)}</strong>
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        Subtotal Actual: <strong style={{ color: isIncome ? '#4ADE80' : (catActual > catTarget && catTarget > 0 ? '#F87171' : '#CBD5E1') }}>
                          {fmtMoney(catActual, symbol)}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right: Chart sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>

          {/* Donut chart */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px 16px',
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Expense Breakdown
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <DonutChart
                segments={donutSegments}
                symbol={symbol}
                total={totalExpensesActual}
              />
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {cats.filter(c => c.type === 'expense').map((cat, i) => {
                const actual = catMonthlyTotal(cat, 'actual');
                if (actual === 0) return null;
                const pct = totalExpensesActual > 0 ? (actual / totalExpensesActual * 100).toFixed(0) : '0';
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[i + 1] ?? '#94A3B8', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{pct}%</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1' }}>{fmtMoney(actual, symbol)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Net balance card */}
          <div style={{
            background: netActual >= 0 ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)',
            border: `1px solid ${netActual >= 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`,
            borderRadius: 14, padding: '16px',
          }}>
            <p style={{ fontSize: 11, color: '#64748B', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Net Balance
            </p>
            <p style={{ fontSize: 26, fontWeight: 800, color: netActual >= 0 ? '#4ADE80' : '#F87171', letterSpacing: '-0.5px' }}>
              {netActual < 0 ? '−' : '+'}{fmtMoney(netActual, symbol)}
            </p>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              {netActual >= 0 ? '✓ Within budget' : '⚠ Over budget'}
              {carryForward !== 0 && ` (incl. ${carryForward >= 0 ? '+' : '-'}${fmtMoney(carryForward, symbol)} carry forward)`}
            </p>
          </div>

          {/* Budget adherence */}
          {totalExpensesTarget > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '16px',
            }}>
              <p style={{ fontSize: 11, color: '#64748B', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Budget Adherence
              </p>
              {cats.filter(c => c.type === 'expense').map((cat, i) => {
                const tgt = catMonthlyTotal(cat, 'target');
                if (tgt === 0) return null;
                const act = catMonthlyTotal(cat, 'actual');
                const pct = Math.min(act / tgt, 1.1);
                const over = act > tgt;
                
                return (
                  <div key={cat.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{cat.label}</span>
                      <span style={{ fontSize: 11, color: over ? '#F87171' : '#94A3B8', fontWeight: 500 }}>
                        {(act / tgt * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.min(pct * 100, 100)}%`,
                        background: over ? '#F87171' : CATEGORY_COLORS[i + 1] ?? '#4ADE80',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DAILY EXPENSES TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, color: '#94A3B8' }}>
                Log individual daily expenses for <strong style={{ color: '#F1F5F9' }}>{MONTHS[month]} {year}</strong>
              </p>
              {dailyExpenses.length > 0 && (
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  {dailyExpenses.length} entries · Total: <strong style={{ color: '#F87171' }}>{fmtMoney(dailyTotal, symbol)}</strong>
                </p>
              )}
            </div>
            <button
              onClick={() => setShowAddExpense(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 11, fontSize: 13, border: 'none',
                background: 'var(--pt-accent)', color: 'var(--pt-accent-text)',
                cursor: 'pointer', fontWeight: 600, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={15} /> Add Expense
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
            {/* Expense table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 36px',
                gap: 8, padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                {['Date', 'Description', 'Category', 'Amount', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i >= 3 ? 'right' : 'left' }}>
                    {h}
                  </span>
                ))}
              </div>

              {dailySorted.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <CalendarDays size={36} color="#334155" style={{ marginBottom: 12 }} />
                  <p style={{ color: '#64748B', fontSize: 14, fontWeight: 500 }}>No daily expenses yet</p>
                  <p style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>Click "Add Expense" to log your first entry</p>
                </div>
              ) : (
                dailySorted.map((exp, i) => {
                  const cat = cats.find(c => c.id === exp.categoryId);
                  const catIdx = cats.findIndex(c => c.id === exp.categoryId);
                  const catColor = CATEGORY_COLORS[catIdx] ?? '#94A3B8';
                  const [, mon, day] = exp.date.split('-');
                  return (
                    <div key={exp.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 36px',
                        gap: 8, padding: '11px 16px', alignItems: 'center',
                        borderBottom: i < dailySorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>
                        {MONTHS[parseInt(mon) - 1].slice(0, 3)} {day}
                      </span>
                      <span style={{ fontSize: 13, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.description}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat?.label ?? exp.categoryId}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#F87171', textAlign: 'right' }}>
                        {fmtMoney(exp.amount, symbol)}
                      </span>
                      <button
                        onClick={() => handleRemoveDailyExpense(exp.id)}
                        style={{
                          padding: 5, background: 'transparent', border: 'none',
                          color: 'transparent', borderRadius: 6, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s', marginLeft: 'auto',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}

              {dailySorted.length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: 6,
                  padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Total logged:</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>{fmtMoney(dailyTotal, symbol)}</span>
                </div>
              )}
            </div>

            {/* Daily summary sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px' }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  By Category
                </h3>
                {Object.keys(dailyByCategory).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '12px 0' }}>No data yet</p>
                ) : (
                  expenseCats.map((cat, i) => {
                    const spent = dailyByCategory[cat.id] ?? 0;
                    if (spent === 0) return null;
                    const color = CATEGORY_COLORS[i + 1] ?? '#94A3B8';
                    const pct = dailyTotal > 0 ? spent / dailyTotal : 0;
                    return (
                      <div key={cat.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>{cat.label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{fmtMoney(spent, symbol)}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, width: `${(pct * 100).toFixed(1)}%`, background: color, transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#475569', marginTop: 2, display: 'block' }}>{(pct * 100).toFixed(0)}% of total</span>
                      </div>
                    );
                  })
                )}
              </div>

              {dailyExpenses.length > 0 && (() => {
                const uniqueDays = new Set(dailyExpenses.map(e => e.date)).size;
                const avgPerDay = dailyTotal / uniqueDays;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const projectedTotal = avgPerDay * daysInMonth;
                return (
                  <div style={{ background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 14, padding: '16px' }}>
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                      Insights
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>Days logged</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{uniqueDays}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>Avg / day</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#FACC15' }}>{fmtMoney(avgPerDay, symbol)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>Projected / month</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316' }}>{fmtMoney(projectedTotal, symbol)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ── */}

      {showAddExpense && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(6px)',
        }} onClick={e => { if (e.target === e.currentTarget) setShowAddExpense(false); }}>
          <div style={{
            background: '#0D1B2E', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18, padding: '28px 28px 24px', width: 420, maxWidth: '95vw',
            animation: 'modalFade 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(var(--pt-accent-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={16} color="var(--pt-accent-light)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Add Daily Expense</h3>
              </div>
              <button onClick={() => setShowAddExpense(false)} style={{ padding: 6, background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', borderRadius: 7, display: 'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              ><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Date */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={dForm.date} onChange={e => setDForm(f => ({ ...f, date: e.target.value }))}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 9, color: '#F1F5F9', fontSize: 13, padding: '9px 12px', outline: 'none',
                    colorScheme: 'dark',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(var(--pt-accent-rgb),0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Description</label>
                <input
                  type="text" placeholder="e.g. Coffee at Starbucks"
                  value={dForm.description}
                  onChange={e => setDForm(f => ({ ...f, description: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddDailyExpense(); }}
                  autoFocus
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 9, color: '#F1F5F9', fontSize: 13, padding: '9px 12px', outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(var(--pt-accent-rgb),0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              {/* Category + Amount row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}><Tag size={10} style={{ display: 'inline', marginRight: 4 }} />Category</label>
                  <select
                    value={dForm.categoryId}
                    onChange={e => setDForm(f => ({ ...f, categoryId: e.target.value }))}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 9, color: '#F1F5F9', fontSize: 13, padding: '9px 10px', cursor: 'pointer', outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(var(--pt-accent-rgb),0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  >
                    {expenseCats.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#0D1B2E' }}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Amount ({symbol})</label>
                  <input
                    type="number" min={0} step={0.01} placeholder="0.00"
                    value={dForm.amount}
                    onChange={e => setDForm(f => ({ ...f, amount: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddDailyExpense(); }}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 9, color: '#F1F5F9', fontSize: 13, padding: '9px 12px', outline: 'none', textAlign: 'right',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(var(--pt-accent-rgb),0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => setShowAddExpense(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#CBD5E1', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button onClick={handleAddDailyExpense}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: 'var(--pt-accent)', color: 'var(--pt-accent-text)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <Plus size={15} /> Add Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirm modal ── */}
      {showReset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0D1B2E', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '28px 32px', maxWidth: 380, textAlign: 'center',
            animation: 'modalFade 0.2s ease',
          }}>
            <RotateCcw size={28} color="#F87171" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Reset Month?</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, marginBottom: 24 }}>
              This will clear all data for <strong>{MONTHS[month]} {year}</strong>.
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowReset(false)}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 13,
                  background: 'rgba(255,255,255,0.07)', border: 'none',
                  color: '#CBD5E1', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={resetMonth}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 13,
                  background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
                  color: '#F87171', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
