export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'annual';

export interface BudgetLineItem {
  id: string;
  label: string;
  targetRaw: string;
  actualRaw: string;
  frequency: Frequency;
}

export interface BudgetCategory {
  id: string;
  label: string;
  type: 'income' | 'expense';
  items: BudgetLineItem[];
}

export interface MonthData {
  categories: BudgetCategory[];
}

export interface DailyExpense {
  id: string;
  date: string;        // "YYYY-MM-DD"
  description: string;
  categoryId: string;  // maps to a BudgetCategory id
  amount: number;
}

export interface BudgetStore {
  currency: string;
  months: Record<string, MonthData>;          // key: "YYYY-MM"
  dailyExpenses: Record<string, DailyExpense[]>; // key: "YYYY-MM"
}
