/**
 * Finovo Financial Utilities
 * Precise monetary arithmetic using integer minor units (paise: 1 INR = 100 paise).
 * Eliminates IEEE 754 floating-point rounding errors (e.g., 0.1 + 0.2 !== 0.3).
 */

/**
 * Converts a currency value in rupees/major units to integer minor units (paise).
 * @param {number|string} amount
 * @returns {number} Integer paise
 */
export function toPaise(amount) {
  if (typeof amount === 'bigint') return Number(amount);
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer minor units (paise) back to rupees (floating point rounded to 2 decimals).
 * @param {number|bigint|string} paise
 * @returns {number}
 */
export function fromPaise(paise) {
  if (paise === null || paise === undefined) return 0;
  const num = typeof paise === 'bigint' ? Number(paise) : (typeof paise === 'number' ? paise : parseFloat(paise));
  if (isNaN(num)) return 0;
  return Math.round(num) / 100;
}

/**
 * Adds two monetary values safely.
 * @param {number|string} a
 * @param {number|string} b
 * @returns {number} Sum in rupees
 */
export function addMoney(a, b) {
  return fromPaise(toPaise(a) + toPaise(b));
}

/**
 * Subtracts b from a safely.
 * @param {number|string} a
 * @param {number|string} b
 * @returns {number} Difference in rupees
 */
export function subtractMoney(a, b) {
  return fromPaise(toPaise(a) - toPaise(b));
}

/**
 * Multiplies an amount by a factor safely.
 * @param {number|string} amount
 * @param {number} factor
 * @returns {number}
 */
export function multiplyMoney(amount, factor) {
  return fromPaise(Math.round(toPaise(amount) * factor));
}

/**
 * Splits an amount evenly among n people down to the exact paisa,
 * distributing any remainder cents/paise so that sum(shares) === total.
 * E.g., splitting 100 among 3 gives [33.34, 33.33, 33.33].
 * @param {number|string} totalAmount
 * @param {number} sharesCount
 * @returns {number[]} Array of split amounts in rupees
 */
export function splitMoneyEvenly(totalAmount, sharesCount) {
  const count = Math.max(1, Math.floor(sharesCount || 1));
  const totalPaise = toPaise(totalAmount);
  const basePaise = Math.floor(totalPaise / count);
  let remainderPaise = totalPaise % count;

  const result = [];
  for (let i = 0; i < count; i++) {
    const share = basePaise + (remainderPaise > 0 ? 1 : 0);
    if (remainderPaise > 0) remainderPaise--;
    result.push(fromPaise(share));
  }
  return result;
}

/**
 * Formats a monetary number into Indian Rupee locale (e.g. ₹1,25,000 or ₹1,25,000.50).
 * @param {number|string} amount
 * @param {Object} options
 * @param {boolean} [options.showSymbol=true]
 * @param {number} [options.minimumFractionDigits=0]
 * @param {number} [options.maximumFractionDigits=2]
 * @returns {string}
 */
export function formatCurrency(amount, {
  showSymbol = true,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2
} = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return showSymbol ? '₹0' : '0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(absNum);

  const prefix = isNegative ? '-' : '';
  const symbol = showSymbol ? '₹' : '';
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Pure calculation of portfolio metrics (total income, total expense, net balance, savings).
 * @param {Array} transactions
 * @returns {{ totalIncome: number, totalExpense: number, portfolioBalance: number, savings: number }}
 */
export function calculatePortfolioMetrics(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      portfolioBalance: 0,
      savings: 0
    };
  }

  let incomePaise = 0;
  let expensePaise = 0;

  for (const tx of transactions) {
    if (!tx || typeof tx.amount === 'undefined') continue;
    const amountPaise = toPaise(tx.amount);
    if (tx.type === 'income') {
      incomePaise += amountPaise;
    } else {
      // Default to expense
      expensePaise += amountPaise;
    }
  }

  const totalIncome = fromPaise(incomePaise);
  const totalExpense = fromPaise(expensePaise);
  const portfolioBalance = fromPaise(incomePaise - expensePaise);
  const savings = Math.max(0, portfolioBalance);

  return {
    totalIncome,
    totalExpense,
    portfolioBalance,
    savings
  };
}

/**
 * Computes monthly budget progress and status.
 * @param {number} totalExpense
 * @param {number} budgetLimit
 * @returns {{ percentage: number, remaining: number, isExceeded: boolean }}
 */
export function calculateBudgetProgress(totalExpense, budgetLimit) {
  const expensePaise = toPaise(totalExpense);
  const limitPaise = toPaise(budgetLimit);

  if (limitPaise <= 0) {
    return { percentage: 0, remaining: 0, isExceeded: false };
  }

  const percentage = Math.min(100, Math.round((expensePaise / limitPaise) * 100));
  const remainingPaise = Math.max(0, limitPaise - expensePaise);
  const isExceeded = expensePaise > limitPaise;

  return {
    percentage,
    remaining: fromPaise(remainingPaise),
    isExceeded
  };
}
