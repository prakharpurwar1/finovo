/**
 * Finovo Financial Calculation & Analytics Engine
 * Pure, reusable calculation functions independent of UI components.
 * Enforces:
 * - Integer minor units (paise: 1 INR = 100 paise) for exact precision
 * - Explicit period boundaries without midnight or month-transition off-by-one errors
 * - Positive monetary values with dedicated transaction types ('income' vs 'expense')
 * - Net cash flow derived purely as income minus expense
 * - Transparent budget health tracking without artificial percentage capping
 */

import { toPaise, fromPaise } from './currency.js';
import { parseLocalDate, isDateInRange, getTodayDateString } from './date.js';

/**
 * Supported period filter identifiers.
 */
export const PERIOD_FILTERS = Object.freeze({
  TODAY: 'today',
  THIS_WEEK: 'this_week',
  THIS_MONTH: 'this_month',
  PREV_MONTH: 'prev_month',
  ALL: 'all',
  CUSTOM: 'custom'
});

/**
 * Returns formatted ISO date YYYY-MM-DD from a local Date object.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateToISO(date) {
  if (!date || isNaN(date.getTime())) return getTodayDateString();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates precise start and end dates for a period, along with its previous equivalent period.
 * Avoids UTC timezone shifts and month-end discrepancies (e.g. Feb 28/29, 30 vs 31 days).
 * @param {string} periodType - 'today' | 'this_week' | 'this_month' | 'prev_month' | 'all' | 'custom'
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {string} [options.customStartDate]
 * @param {string} [options.customEndDate]
 * @returns {{ startDate: string|null, endDate: string|null, prevStartDate: string|null, prevEndDate: string|null, label: string, prevLabel: string }}
 */
export function getPeriodBoundaries(periodType = PERIOD_FILTERS.THIS_MONTH, {
  referenceDate = new Date(),
  customStartDate = '',
  customEndDate = ''
} = {}) {
  const ref = new Date(referenceDate);
  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-indexed
  const todayStr = formatDateToISO(ref);

  switch (periodType) {
    case PERIOD_FILTERS.TODAY: {
      const yesterday = new Date(ref);
      yesterday.setDate(ref.getDate() - 1);
      const yesterdayStr = formatDateToISO(yesterday);
      return {
        startDate: todayStr,
        endDate: todayStr,
        prevStartDate: yesterdayStr,
        prevEndDate: yesterdayStr,
        label: 'Today',
        prevLabel: 'Yesterday'
      };
    }

    case PERIOD_FILTERS.THIS_WEEK: {
      // Monday to Sunday current week
      const currentDay = ref.getDay(); // 0 = Sun, 1 = Mon...
      const distToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() + distToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);

      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);

      return {
        startDate: formatDateToISO(monday),
        endDate: formatDateToISO(sunday),
        prevStartDate: formatDateToISO(prevMonday),
        prevEndDate: formatDateToISO(prevSunday),
        label: 'This Week',
        prevLabel: 'Last Week'
      };
    }

    case PERIOD_FILTERS.THIS_MONTH: {
      // 1st of current month to last day of current month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0); // Last day of month

      // Previous month
      const startOfPrevMonth = new Date(year, month - 1, 1);
      const endOfPrevMonth = new Date(year, month, 0);

      return {
        startDate: formatDateToISO(startOfMonth),
        endDate: formatDateToISO(endOfMonth),
        prevStartDate: formatDateToISO(startOfPrevMonth),
        prevEndDate: formatDateToISO(endOfPrevMonth),
        label: 'This Month',
        prevLabel: 'Last Month'
      };
    }

    case PERIOD_FILTERS.PREV_MONTH: {
      const startOfPrevMonth = new Date(year, month - 1, 1);
      const endOfPrevMonth = new Date(year, month, 0);

      const startOfPrev2Month = new Date(year, month - 2, 1);
      const endOfPrev2Month = new Date(year, month - 1, 0);

      return {
        startDate: formatDateToISO(startOfPrevMonth),
        endDate: formatDateToISO(endOfPrevMonth),
        prevStartDate: formatDateToISO(startOfPrev2Month),
        prevEndDate: formatDateToISO(endOfPrev2Month),
        label: 'Last Month',
        prevLabel: '2 Months Ago'
      };
    }

    case PERIOD_FILTERS.CUSTOM: {
      return {
        startDate: customStartDate || todayStr,
        endDate: customEndDate || todayStr,
        prevStartDate: null,
        prevEndDate: null,
        label: 'Custom Period',
        prevLabel: 'Previous Period'
      };
    }

    case PERIOD_FILTERS.ALL:
    default: {
      return {
        startDate: null,
        endDate: null,
        prevStartDate: null,
        prevEndDate: null,
        label: 'All Time',
        prevLabel: 'Previous'
      };
    }
  }
}

/**
 * Filters transactions based on period boundaries or category/type.
 * Guarantees every transaction is included at most once.
 * @param {Array<Object>} transactions
 * @param {Object} [filterOptions]
 * @returns {Array<Object>}
 */
export function filterTransactionsByPeriod(transactions = [], {
  startDate = null,
  endDate = null,
  category = 'All',
  type = 'all',
  excludeDemo = true
} = {}) {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  return transactions.filter(tx => {
    if (!tx || typeof tx.amount === 'undefined') return false;

    // Demo data isolation
    if (excludeDemo && tx.isDemo) return false;

    // Date range filter
    if (startDate || endDate) {
      if (!isDateInRange(tx.date, startDate, endDate)) {
        return false;
      }
    }

    // Category filter
    if (category && category !== 'All') {
      if ((tx.category || '').toLowerCase() !== category.toLowerCase()) {
        return false;
      }
    }

    // Type filter
    if (type && type !== 'all') {
      if (tx.type !== type) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates core cash flow metrics from a list of transactions using integer minor units (paise).
 * Avoids IEEE-754 precision errors.
 * @param {Array<Object>} transactions
 * @returns {{
 *   totalIncome: number,
 *   totalExpense: number,
 *   netCashFlow: number,
 *   savingsRate: number,
 *   transactionCount: number,
 *   incomeCount: number,
 *   expenseCount: number,
 *   averageExpense: number,
 *   averageIncome: number,
 *   highestExpense: Object|null
 * }}
 */
export function calculateCashFlowMetrics(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      netCashFlow: 0,
      savingsRate: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0,
      averageExpense: 0,
      averageIncome: 0,
      highestExpense: null
    };
  }

  let incomePaise = 0;
  let expensePaise = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let highestExpense = null;
  let maxExpensePaise = 0;

  for (const tx of transactions) {
    if (!tx || typeof tx.amount === 'undefined') continue;
    const amountPaise = toPaise(tx.amount);

    if (tx.type === 'income') {
      incomePaise += amountPaise;
      incomeCount++;
    } else {
      // Default to expense
      expensePaise += amountPaise;
      expenseCount++;

      if (amountPaise > maxExpensePaise) {
        maxExpensePaise = amountPaise;
        highestExpense = tx;
      }
    }
  }

  const totalIncome = fromPaise(incomePaise);
  const totalExpense = fromPaise(expensePaise);
  const netCashFlow = fromPaise(incomePaise - expensePaise);

  // Savings rate = max(0, (income - expense) / income * 100)
  const savingsRate = incomePaise > 0 
    ? Math.max(0, Math.round(((incomePaise - expensePaise) / incomePaise) * 100))
    : 0;

  const averageExpense = expenseCount > 0 
    ? fromPaise(Math.round(expensePaise / expenseCount)) 
    : 0;

  const averageIncome = incomeCount > 0 
    ? fromPaise(Math.round(incomePaise / incomeCount)) 
    : 0;

  return {
    totalIncome,
    totalExpense,
    netCashFlow,
    savingsRate,
    transactionCount: transactions.length,
    incomeCount,
    expenseCount,
    averageExpense,
    averageIncome,
    highestExpense
  };
}

/**
 * Calculates comparative trend percentages between current period transactions and previous period transactions.
 * @param {Array<Object>} currentTransactions
 * @param {Array<Object>} previousTransactions
 * @returns {{
 *   current: Object,
 *   previous: Object,
 *   expenseChangePercentage: number,
 *   incomeChangePercentage: number,
 *   isExpenseIncreased: boolean,
 *   isIncomeIncreased: boolean
 * }}
 */
export function calculatePeriodComparison(currentTransactions = [], previousTransactions = []) {
  const current = calculateCashFlowMetrics(currentTransactions);
  const previous = calculateCashFlowMetrics(previousTransactions);

  let expenseChangePercentage = 0;
  if (previous.totalExpense > 0) {
    const diffPaise = toPaise(current.totalExpense) - toPaise(previous.totalExpense);
    expenseChangePercentage = Math.round((diffPaise / toPaise(previous.totalExpense)) * 100);
  } else if (current.totalExpense > 0) {
    expenseChangePercentage = 100; // First spending in this period
  }

  let incomeChangePercentage = 0;
  if (previous.totalIncome > 0) {
    const diffPaise = toPaise(current.totalIncome) - toPaise(previous.totalIncome);
    incomeChangePercentage = Math.round((diffPaise / toPaise(previous.totalIncome)) * 100);
  } else if (current.totalIncome > 0) {
    incomeChangePercentage = 100;
  }

  return {
    current,
    previous,
    expenseChangePercentage,
    incomeChangePercentage,
    isExpenseIncreased: expenseChangePercentage > 0,
    isIncomeIncreased: incomeChangePercentage > 0
  };
}

/**
 * Aggregates expenses by category with percentages and sorted order.
 * @param {Array<Object>} transactions
 * @returns {Array<{ category: string, amount: number, amount_paise: number, count: number, percentage: number }>}
 */
export function getCategorySpendingBreakdown(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const categoryMap = new Map();
  let totalExpensePaise = 0;

  for (const tx of transactions) {
    if (!tx || tx.type !== 'expense') continue;
    const cat = tx.category || 'Others';
    const amountPaise = toPaise(tx.amount);
    totalExpensePaise += amountPaise;

    const existing = categoryMap.get(cat) || { count: 0, amountPaise: 0 };
    categoryMap.set(cat, {
      count: existing.count + 1,
      amountPaise: existing.amountPaise + amountPaise
    });
  }

  if (totalExpensePaise === 0) return [];

  const breakdown = [];
  for (const [category, data] of categoryMap.entries()) {
    const percentage = Math.round((data.amountPaise / totalExpensePaise) * 100);
    breakdown.push({
      category,
      amount: fromPaise(data.amountPaise),
      amount_paise: data.amountPaise,
      count: data.count,
      percentage
    });
  }

  // Sort descending by highest expenditure
  return breakdown.sort((a, b) => b.amount_paise - a.amount_paise);
}

/**
 * Computes transparent budget health and progress without artificial percentage caps.
 * If spending exceeds budget, percentage correctly exceeds 100% (e.g. 125%).
 * @param {number} totalExpense - Total expenditure in rupees
 * @param {number} budgetLimit - Total budget in rupees
 * @returns {{
 *   hasBudget: boolean,
 *   percentage: number,
 *   remaining: number,
 *   isExceeded: boolean,
 *   exceededAmount: number,
 *   status: 'unconfigured' | 'safe' | 'warning' | 'danger' | 'exceeded'
 * }}
 */
export function calculateBudgetHealth(totalExpense, budgetLimit) {
  const limitPaise = toPaise(budgetLimit);
  const expensePaise = toPaise(totalExpense);

  if (limitPaise <= 0) {
    return {
      hasBudget: false,
      percentage: 0,
      remaining: 0,
      isExceeded: false,
      exceededAmount: 0,
      status: 'unconfigured'
    };
  }

  // Exact percentage used (can legitimately exceed 100%)
  const percentage = Math.round((expensePaise / limitPaise) * 100);
  const isExceeded = expensePaise > limitPaise;
  const remainingPaise = Math.max(0, limitPaise - expensePaise);
  const exceededPaise = Math.max(0, expensePaise - limitPaise);

  let status = 'safe';
  if (isExceeded) {
    status = 'exceeded';
  } else if (percentage >= 90) {
    status = 'danger';
  } else if (percentage >= 70) {
    status = 'warning';
  }

  return {
    hasBudget: true,
    percentage,
    remaining: fromPaise(remainingPaise),
    isExceeded,
    exceededAmount: fromPaise(exceededPaise),
    status
  };
}

/**
 * Generates continuous daily spending data points across a given date range [startDate, endDate].
 * Dates with 0 spending are included with amount: 0 to ensure accurate chart continuity.
 * @param {Array<Object>} transactions
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @returns {Array<{ date: string, label: string, dayName: string, amount: number, income: number, count: number }>}
 */
export function getDailySpendingSeries(transactions = [], startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return [];

  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  if (!start || !end || start > end) return [];

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Map each day in the date range
  const daysMap = new Map();
  const current = new Date(start);

  while (current <= end) {
    const dateKey = formatDateToISO(current);
    const dayName = dayLabels[current.getDay()];
    const label = `${current.getDate()} ${monthLabels[current.getMonth()]}`;

    daysMap.set(dateKey, {
      date: dateKey,
      label,
      dayName,
      amountPaise: 0,
      incomePaise: 0,
      count: 0
    });
    current.setDate(current.getDate() + 1);
  }

  // Aggregate matching transactions
  if (Array.isArray(transactions)) {
    for (const tx of transactions) {
      if (!tx || !tx.date) continue;
      const dayData = daysMap.get(tx.date);
      if (dayData) {
        const paise = toPaise(tx.amount);
        if (tx.type === 'expense') {
          dayData.amountPaise += paise;
          dayData.count++;
        } else if (tx.type === 'income') {
          dayData.incomePaise += paise;
        }
      }
    }
  }

  return Array.from(daysMap.values()).map(d => ({
    date: d.date,
    label: d.label,
    dayName: d.dayName,
    amount: fromPaise(d.amountPaise),
    income: fromPaise(d.incomePaise),
    count: d.count
  }));
}
