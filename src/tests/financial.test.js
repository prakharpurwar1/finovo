/**
 * Unit Tests for Finovo Financial Calculations, Date Handling, Validation, and Currency
 * Uses Node.js native test runner (node:test & node:assert). Zero dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  toPaise,
  fromPaise,
  addMoney,
  subtractMoney,
  multiplyMoney,
  splitMoneyEvenly,
  formatCurrency,
  calculatePortfolioMetrics,
  calculateBudgetProgress
} from '../utils/currency.js';

import {
  parseLocalDate,
  isDateInRange,
  getWeeklyDailySpending,
  getHourlySpendDistribution
} from '../utils/date.js';

import {
  validateTransaction,
  validateGroup,
  validateBudget,
  validateAuthForm
} from '../utils/validation.js';

import {
  getDemoTransactions,
  isDemoItem,
  filterOutDemoData
} from '../data/demoFixtures.js';

describe('Financial & Currency Utilities (Minor Unit Precision)', () => {
  it('converts rupees to paise and back with exact precision', () => {
    assert.equal(toPaise(100), 10000);
    assert.equal(toPaise(19.99), 1999);
    assert.equal(toPaise('450.50'), 45050);
    assert.equal(toPaise(0), 0);

    assert.equal(fromPaise(10000), 100);
    assert.equal(fromPaise(1999), 19.99);
    assert.equal(fromPaise(45050), 450.5);
  });

  it('eliminates floating-point rounding errors (0.1 + 0.2 === 0.3)', () => {
    // In raw JavaScript: 0.1 + 0.2 === 0.30000000000000004
    assert.notEqual(0.1 + 0.2, 0.3);
    // With Finovo addMoney:
    assert.equal(addMoney(0.1, 0.2), 0.3);
    assert.equal(subtractMoney(1.0, 0.9), 0.1);
    assert.equal(addMoney(19.99, 0.01), 20);
  });

  it('multiplies money without floating point drift', () => {
    assert.equal(multiplyMoney(19.99, 3), 59.97);
    assert.equal(multiplyMoney(10.5, 0.5), 5.25);
  });

  it('splits money evenly across people down to the exact paisa with zero loss', () => {
    const split3 = splitMoneyEvenly(100, 3);
    assert.deepEqual(split3, [33.34, 33.33, 33.33]);
    const sum3 = split3.reduce((s, a) => addMoney(s, a), 0);
    assert.equal(sum3, 100);

    const split7 = splitMoneyEvenly(50, 7);
    const sum7 = split7.reduce((s, a) => addMoney(s, a), 0);
    assert.equal(sum7, 50);
  });

  it('formats currency correctly in Indian locale', () => {
    assert.equal(formatCurrency(45000), '₹45,000');
    assert.equal(formatCurrency(125050.75, { minimumFractionDigits: 2 }), '₹1,25,050.75');
    assert.equal(formatCurrency(-250), '-₹250');
    assert.equal(formatCurrency(1000, { showSymbol: false }), '1,000');
  });

  it('calculates portfolio metrics accurately from transaction list', () => {
    const txs = [
      { amount: 50000, type: 'income' },
      { amount: 1250.5, type: 'expense' },
      { amount: 3749.5, type: 'expense' }
    ];

    const metrics = calculatePortfolioMetrics(txs);
    assert.equal(metrics.totalIncome, 50000);
    assert.equal(metrics.totalExpense, 5000);
    assert.equal(metrics.portfolioBalance, 45000);
    assert.equal(metrics.savings, 45000);
  });

  it('handles negative portfolio balance when expenses exceed income', () => {
    const txs = [
      { amount: 1000, type: 'income' },
      { amount: 2500, type: 'expense' }
    ];
    const metrics = calculatePortfolioMetrics(txs);
    assert.equal(metrics.totalIncome, 1000);
    assert.equal(metrics.totalExpense, 2500);
    assert.equal(metrics.portfolioBalance, -1500);
    assert.equal(metrics.savings, 0);
  });

  it('calculates budget progress percentage and remaining amounts correctly', () => {
    const res = calculateBudgetProgress(15000, 30000);
    assert.equal(res.percentage, 50);
    assert.equal(res.remaining, 15000);
    assert.equal(res.isExceeded, false);

    const exceeded = calculateBudgetProgress(35000, 30000);
    assert.equal(exceeded.percentage, 100);
    assert.equal(exceeded.remaining, 0);
    assert.equal(exceeded.isExceeded, true);
  });
});

describe('Date Handling & Trend Aggregation Utilities', () => {
  it('parses local dates without UTC timezone shift', () => {
    const parsed = parseLocalDate('2026-10-21');
    assert.ok(parsed instanceof Date);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 9); // October is index 9
    assert.equal(parsed.getDate(), 21);
  });

  it('verifies date ranges correctly', () => {
    assert.equal(isDateInRange('2026-10-15', '2026-10-01', '2026-10-31'), true);
    assert.equal(isDateInRange('2026-09-30', '2026-10-01', '2026-10-31'), false);
    assert.equal(isDateInRange('2026-11-01', '2026-10-01', '2026-10-31'), false);
  });

  it('aggregates weekly spending ONLY for transactions within the current week', () => {
    // Reference date: Wednesday 2026-10-21
    // Week runs from Mon 2026-10-19 to Sun 2026-10-25
    const refDate = new Date(2026, 9, 21);

    const txs = [
      { amount: 500, date: '2026-10-19', type: 'expense' }, // Monday (this week)
      { amount: 300, date: '2026-10-21', type: 'expense' }, // Wednesday (this week)
      { amount: 999, date: '2025-10-21', type: 'expense' }, // Last year (MUST BE EXCLUDED)
      { amount: 400, date: '2026-10-12', type: 'expense' }  // Last week (MUST BE EXCLUDED)
    ];

    const weekly = getWeeklyDailySpending(txs, { referenceDate: refDate });
    assert.equal(weekly.length, 7);

    // Monday should be 500
    const mon = weekly.find(d => d.day === 'Mon');
    assert.equal(mon.amount, 500);

    // Wednesday should be 300
    const wed = weekly.find(d => d.day === 'Wed');
    assert.equal(wed.amount, 300);

    // Other days should be 0
    const tue = weekly.find(d => d.day === 'Tue');
    assert.equal(tue.amount, 0);

    // Total week spend should only be 800 (not 2199)
    const totalWeekly = weekly.reduce((s, d) => s + d.amount, 0);
    assert.equal(totalWeekly, 800);
  });

  it('bins transactions into hourly distribution', () => {
    const txs = [
      { amount: 150, date: '2026-10-21', time: '08:30 AM', type: 'expense' },
      { amount: 350, date: '2026-10-21', time: '01:00 PM', type: 'expense' },
      { amount: 200, date: '2026-10-21', time: '09:15 PM', type: 'expense' },
      { amount: 500, date: '2026-10-20', time: '01:00 PM', type: 'expense' } // Different date
    ];

    const hourly = getHourlySpendDistribution(txs, '2026-10-21');
    assert.equal(hourly.length, 5);
    const morning = hourly.find(h => h.time === '9 AM');
    assert.equal(morning.amount, 150);
    const afternoon = hourly.find(h => h.time === '12 PM');
    assert.equal(afternoon.amount, 350);
  });
});

describe('Validation Utilities', () => {
  it('validates transaction data with field-specific errors', () => {
    const invalidTx = validateTransaction({ amount: 0, merchant: '' });
    assert.equal(invalidTx.isValid, false);
    assert.ok(invalidTx.errors.amount);
    assert.ok(invalidTx.errors.merchant);

    const validTx = validateTransaction({
      amount: 450,
      merchant: 'Swiggy',
      date: '2026-10-21'
    });
    assert.equal(validTx.isValid, true);
    assert.deepEqual(validTx.errors, {});
  });

  it('validates group data', () => {
    const invalidGroup = validateGroup({ title: '', members: 1 });
    assert.equal(invalidGroup.isValid, false);
    assert.ok(invalidGroup.errors.title);
    assert.ok(invalidGroup.errors.members);

    const validGroup = validateGroup({ title: 'Goa Trip 2026', members: 4 });
    assert.equal(validGroup.isValid, true);
  });

  it('validates budget inputs', () => {
    assert.equal(validateBudget(-50).isValid, false);
    assert.equal(validateBudget('abc').isValid, false);
    assert.equal(validateBudget(25000).isValid, true);
  });

  it('validates authentication form fields', () => {
    const invalidLogin = validateAuthForm({ email: 'bademail', password: '123' }, false);
    assert.equal(invalidLogin.isValid, false);
    assert.ok(invalidLogin.errors.email);
    assert.ok(invalidLogin.errors.password);

    const validSignup = validateAuthForm({
      email: 'test@finovo.io',
      password: 'password123',
      name: 'Prakhar'
    }, true);
    assert.equal(validSignup.isValid, true);
  });
});

describe('Demo Fixtures Isolation', () => {
  it('generates demo transactions with explicit isDemo flag', () => {
    const demos = getDemoTransactions();
    assert.equal(demos.length, 3);
    for (const d of demos) {
      assert.equal(d.isDemo, true);
      assert.equal(isDemoItem(d), true);
    }
  });

  it('filters demo transactions out of genuine records', () => {
    const mixed = [
      { id: 'real-1', amount: 500, merchant: 'Real Store', isDemo: false },
      { id: 'demo-1', amount: 450, merchant: 'Swiggy', isDemo: true }
    ];

    const clean = filterOutDemoData(mixed);
    assert.equal(clean.length, 1);
    assert.equal(clean[0].id, 'real-1');
  });
});
