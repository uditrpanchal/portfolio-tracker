import type { BudgetCategory, BudgetLineItem, BudgetStore, MonthData, DailyExpense } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CURRENCIES = [
  { code: 'CAD', symbol: 'CA$', label: 'CAD — Canadian Dollar' },
  { code: 'USD', symbol: '$',   label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',   label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',   label: 'GBP — British Pound' },
  { code: 'INR', symbol: '₹',   label: 'INR — Indian Rupee' },
  { code: 'AUD', symbol: 'A$',  label: 'AUD — Australian Dollar' },
  { code: 'JPY', symbol: '¥',   label: 'JPY — Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF — Swiss Franc' },
];

export function getSymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code;
}

export const CATEGORY_COLORS = [
  '#22D3EE', // income   — cyan
  '#4ADE80', // housing  — green
  '#F97316', // transport — orange
  '#FACC15', // food     — yellow
  '#A78BFA', // personal — violet
  '#FB7185', // health   — pink/rose
  '#38BDF8', // savings  — sky blue
  '#C084FC', // entertainment — light purple
];

export const FREQ_LABELS: Record<string, string> = {
  daily:     'Daily',
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  annual:    'Annually',
};

// ─── Frequency conversion ────────────────────────────────────────────────────

export function toMonthly(value: number, frequency: string): number {
  const n = isNaN(value) ? 0 : value;
  switch (frequency) {
    case 'daily':    return n * 30.44;
    case 'weekly':   return (n * 52) / 12;
    case 'biweekly': return (n * 26) / 12;
    case 'annual':   return n / 12;
    default:         return n;
  }
}

// ─── Month key helpers ────────────────────────────────────────────────────────

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function prevMonthKey(year: number, month: number): string {
  if (month === 0) return monthKey(year - 1, 11);
  return monthKey(year, month - 1);
}

export function nextMonthKey(year: number, month: number): string {
  if (month === 11) return monthKey(year + 1, 0);
  return monthKey(year, month + 1);
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-');
  return { year: parseInt(y), month: parseInt(m) - 1 };
}

// ─── Default categories ───────────────────────────────────────────────────────

function item(id: string, label: string): BudgetLineItem {
  return { id, label, targetRaw: '', actualRaw: '', frequency: 'monthly' };
}

export function getDefaultCategories(): BudgetCategory[] {
  return [
    {
      id: 'income', label: 'Income', type: 'income',
      items: [
        item('emp',       'Employment Income'),
        item('self',      'Self-Employment'),
        item('gov',       'Government Benefits'),
        item('invest',    'Investment Income'),
        item('rental',    'Rental Income'),
        item('other-inc', 'Other Income'),
      ],
    },
    {
      id: 'housing', label: 'Housing', type: 'expense',
      items: [
        item('mortgage',    'Rent / Mortgage'),
        item('prop-tax',    'Property Tax'),
        item('home-ins',    'Home Insurance'),
        item('utilities',   'Utilities'),
        item('internet',    'Internet & Phone'),
        item('maintenance', 'Maintenance'),
      ],
    },
    {
      id: 'transport', label: 'Transportation', type: 'expense',
      items: [
        item('car-pay',   'Car Payment'),
        item('car-ins',   'Car Insurance'),
        item('gas',       'Gas / Fuel'),
        item('transit',   'Public Transit'),
        item('parking',   'Parking'),
        item('car-maint', 'Car Maintenance'),
      ],
    },
    {
      id: 'food', label: 'Food & Dining', type: 'expense',
      items: [
        item('groceries', 'Groceries'),
        item('dining',    'Dining Out'),
        item('coffee',    'Coffee & Snacks'),
      ],
    },
    {
      id: 'personal', label: 'Personal & Family', type: 'expense',
      items: [
        item('childcare',     'Childcare / Education'),
        item('clothing',      'Clothing & Shoes'),
        item('personal-care', 'Personal Care'),
        item('subscriptions', 'Subscriptions'),
        item('gifts',         'Gifts & Donations'),
      ],
    },
    {
      id: 'health', label: 'Health & Wellness', type: 'expense',
      items: [
        item('health-ins',   'Health Insurance'),
        item('prescriptions','Prescriptions'),
        item('dental',       'Dental & Vision'),
        item('gym',          'Gym / Fitness'),
      ],
    },
    {
      id: 'savings', label: 'Savings & Debt', type: 'expense',
      items: [
        item('emergency',    'Emergency Fund'),
        item('rrsp',         'RRSP / TFSA'),
        item('credit-card',  'Credit Card'),
        item('student-loan', 'Student Loan'),
        item('other-debt',   'Other Debt'),
      ],
    },
    {
      id: 'entertainment', label: 'Entertainment', type: 'expense',
      items: [
        item('streaming', 'Streaming Services'),
        item('hobbies',   'Hobbies'),
        item('travel',    'Travel / Vacation'),
        item('sports',    'Sports & Recreation'),
      ],
    },
  ];
}

// ─── Totals ───────────────────────────────────────────────────────────────────

export function catMonthlyTotal(cat: BudgetCategory, field: 'target' | 'actual'): number {
  return cat.items.reduce((sum, it) => {
    const raw = parseFloat(field === 'target' ? it.targetRaw : it.actualRaw) || 0;
    return sum + toMonthly(raw, it.frequency);
  }, 0);
}

export function calcTotals(cats: BudgetCategory[]) {
  const incComeCats = cats.filter(c => c.type === 'income');
  const expCats     = cats.filter(c => c.type === 'expense');
  const totalIncomeTarget  = incComeCats.reduce((s, c) => s + catMonthlyTotal(c, 'target'), 0);
  const totalIncomeActual  = incComeCats.reduce((s, c) => s + catMonthlyTotal(c, 'actual'), 0);
  const totalExpensesTarget = expCats.reduce((s, c) => s + catMonthlyTotal(c, 'target'), 0);
  const totalExpensesActual = expCats.reduce((s, c) => s + catMonthlyTotal(c, 'actual'), 0);
  return { totalIncomeTarget, totalIncomeActual, totalExpensesTarget, totalExpensesActual };
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pt_budget_v1';

export function loadBudgetStore(): BudgetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetStore;
      // migrate old data that may not have dailyExpenses
      if (!parsed.dailyExpenses) parsed.dailyExpenses = {};
      return parsed;
    }
  } catch { /* ignore */ }
  return { currency: 'CAD', months: {}, dailyExpenses: {} };
}

export function saveBudgetStore(store: BudgetStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getOrInitMonth(store: BudgetStore, key: string): MonthData {
  return store.months[key] ?? { categories: getDefaultCategories() };
}

// ─── Daily Expense helpers ────────────────────────────────────────────────────

export function getDailyExpenses(store: BudgetStore, monthKey: string): DailyExpense[] {
  return store.dailyExpenses[monthKey] ?? [];
}

export function addDailyExpense(store: BudgetStore, monthKey: string, expense: DailyExpense): BudgetStore {
  const existing = store.dailyExpenses[monthKey] ?? [];
  return {
    ...store,
    dailyExpenses: {
      ...store.dailyExpenses,
      [monthKey]: [expense, ...existing],
    },
  };
}

export function removeDailyExpense(store: BudgetStore, monthKey: string, expenseId: string): BudgetStore {
  const existing = store.dailyExpenses[monthKey] ?? [];
  return {
    ...store,
    dailyExpenses: {
      ...store.dailyExpenses,
      [monthKey]: existing.filter(e => e.id !== expenseId),
    },
  };
}

export function updateDailyExpense(store: BudgetStore, monthKey: string, updated: DailyExpense): BudgetStore {
  const existing = store.dailyExpenses[monthKey] ?? [];
  return {
    ...store,
    dailyExpenses: {
      ...store.dailyExpenses,
      [monthKey]: existing.map(e => e.id === updated.id ? updated : e),
    },
  };
}

// Sum daily expenses per category for a given month
export function dailyTotalsByCategory(expenses: DailyExpense[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    totals[e.categoryId] = (totals[e.categoryId] ?? 0) + e.amount;
  }
  return totals;
}

// Grand total for all daily expenses
export function dailyGrandTotal(expenses: DailyExpense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

// Carry forward: previous month's net actual balance
export function getCarryForward(store: BudgetStore, prevKey: string): number {
  const prev = store.months[prevKey];
  if (!prev) return 0;
  const { totalIncomeActual, totalExpensesActual } = calcTotals(prev.categories);
  return totalIncomeActual - totalExpensesActual;
}
