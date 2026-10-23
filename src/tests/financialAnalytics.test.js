import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIOD_FILTERS,
  formatDateToISO,
  getPeriodBoundaries,
  filterTransactionsByPeriod,
  calculateCashFlowMetrics,
  calculatePeriodComparison,
  getCategorySpendingBreakdown,
  calculateBudgetHealth,
  getDailySpendingSeries
} from '../utils/financialAnalytics.js';

describe('Financial Analytics — Reconciliation & Calculation Engine', () => {

  // 1. Mandatory Test Fixture Reconciliation
  describe('Reconciliation with Standard Financial Test Fixture', () => {
    const fixtureTransactions = [
      { id: 'tx-1', type: 'income', amount: 30000, category: 'Salary', date: '2026-10-01' },
      { id: 'tx-2', type: 'expense', amount: 450, category: 'Food', date: '2026-10-05' },
      { id: 'tx-3', type: 'expense', amount: 150, category: 'Transport', date: '2026-10-12' },
      { id: 'tx-4', type: 'expense', amount: 900, category: 'Shopping', date: '2026-10-18' }
    ];

    it('correctly computes Total Income: ₹30,000, Total Expenses: ₹1,500, and Net Cash Flow: ₹28,500', () => {
      const metrics = calculateCashFlowMetrics(fixtureTransactions);

      assert.equal(metrics.totalIncome, 30000);
      assert.equal(metrics.totalExpense, 1500);
      assert.equal(metrics.netCashFlow, 28500);
      assert.equal(metrics.incomeCount, 1);
      assert.equal(metrics.expenseCount, 3);
      assert.equal(metrics.averageExpense, 500); // 1500 / 3 = 500
      assert.equal(metrics.averageIncome, 30000);
      assert.equal(metrics.savingsRate, 95); // (28500 / 30000) * 100 = 95%
    });

    it('reconciles category breakdown percentages accurately for test fixture', () => {
      const breakdown = getCategorySpendingBreakdown(fixtureTransactions);

      assert.equal(breakdown.length, 3);
      // Sorted descending: Shopping (900), Food (450), Transport (150)
      assert.equal(breakdown[0].category, 'Shopping');
      assert.equal(breakdown[0].amount, 900);
      assert.equal(breakdown[0].percentage, 60); // 900 / 1500 = 60%

      assert.equal(breakdown[1].category, 'Food');
      assert.equal(breakdown[1].amount, 450);
      assert.equal(breakdown[1].percentage, 30); // 450 / 1500 = 30%

      assert.equal(breakdown[2].category, 'Transport');
      assert.equal(breakdown[2].amount, 150);
      assert.equal(breakdown[2].percentage, 10); // 150 / 1500 = 10%
    });
  });

  // 2. Period Boundaries & Date Handling
  describe('Period Boundaries & Timezone Safety', () => {
    it('formats dates consistently to YYYY-MM-DD ISO strings', () => {
      assert.equal(formatDateToISO(new Date(2026, 0, 5)), '2026-01-05');
      assert.equal(formatDateToISO(new Date(2026, 11, 25)), '2026-12-25');
    });

    it('calculates current month boundaries without midnight off-by-one errors', () => {
      const refDate = new Date(2026, 9, 22); // Oct 22, 2026
      const boundaries = getPeriodBoundaries(PERIOD_FILTERS.THIS_MONTH, { referenceDate: refDate });

      assert.equal(boundaries.startDate, '2026-10-01');
      assert.equal(boundaries.endDate, '2026-10-31');
      assert.equal(boundaries.prevStartDate, '2026-09-01');
      assert.equal(boundaries.prevEndDate, '2026-09-30');
    });

    it('correctly handles leap year February (29 days) and non-leap February (28 days)', () => {
      // 2028 is a leap year (Feb has 29 days)
      const leapRef = new Date(2028, 1, 15); // Feb 15, 2028
      const leapBoundaries = getPeriodBoundaries(PERIOD_FILTERS.THIS_MONTH, { referenceDate: leapRef });
      assert.equal(leapBoundaries.startDate, '2028-02-01');
      assert.equal(leapBoundaries.endDate, '2028-02-29');

      // 2026 is a standard year (Feb has 28 days)
      const stdRef = new Date(2026, 1, 15); // Feb 15, 2026
      const stdBoundaries = getPeriodBoundaries(PERIOD_FILTERS.THIS_MONTH, { referenceDate: stdRef });
      assert.equal(stdBoundaries.startDate, '2026-02-01');
      assert.equal(stdBoundaries.endDate, '2026-02-28');
    });

    it('calculates this week boundaries from Monday through Sunday', () => {
      const refWednesday = new Date(2026, 9, 21); // Wed, Oct 21, 2026
      const boundaries = getPeriodBoundaries(PERIOD_FILTERS.THIS_WEEK, { referenceDate: refWednesday });

      assert.equal(boundaries.startDate, '2026-10-19'); // Monday
      assert.equal(boundaries.endDate, '2026-10-25'); // Sunday
      assert.equal(boundaries.prevStartDate, '2026-10-12'); // Prev Monday
      assert.equal(boundaries.prevEndDate, '2026-10-18'); // Prev Sunday
    });

    it('calculates today and yesterday boundaries accurately', () => {
      const ref = new Date(2026, 9, 22);
      const boundaries = getPeriodBoundaries(PERIOD_FILTERS.TODAY, { referenceDate: ref });

      assert.equal(boundaries.startDate, '2026-10-22');
      assert.equal(boundaries.endDate, '2026-10-22');
      assert.equal(boundaries.prevStartDate, '2026-10-21');
      assert.equal(boundaries.prevEndDate, '2026-10-21');
    });
  });

  // 3. Filtering Transactions By Period
  describe('Period Filtering', () => {
    const sampleTxs = [
      { id: '1', amount: 100, date: '2026-10-19', type: 'expense', category: 'Food' },
      { id: '2', amount: 200, date: '2026-10-21', type: 'expense', category: 'Food' },
      { id: '3', amount: 300, date: '2026-10-26', type: 'expense', category: 'Travel' }, // outside week
      { id: '4', amount: 500, date: '2026-09-30', type: 'expense', category: 'Bills' }, // outside month
      { id: '5', amount: 50, date: '2026-10-21', type: 'expense', isDemo: true } // demo
    ];

    it('filters transactions strictly within range and excludes demo items by default', () => {
      const filtered = filterTransactionsByPeriod(sampleTxs, {
        startDate: '2026-10-19',
        endDate: '2026-10-25',
        excludeDemo: true
      });

      assert.equal(filtered.length, 2);
      assert.deepEqual(filtered.map(t => t.id), ['1', '2']);
    });
  });

  // 4. Period Comparisons & Trends
  describe('Comparative Period Analytics', () => {
    it('computes percentage changes between consecutive periods correctly', () => {
      const current = [
        { type: 'expense', amount: 6000 },
        { type: 'income', amount: 35000 }
      ];
      const previous = [
        { type: 'expense', amount: 4000 },
        { type: 'income', amount: 30000 }
      ];

      const comp = calculatePeriodComparison(current, previous);
      // (6000 - 4000) / 4000 = +50%
      assert.equal(comp.expenseChangePercentage, 50);
      assert.equal(comp.isExpenseIncreased, true);

      // (35000 - 30000) / 30000 = +17%
      assert.equal(comp.incomeChangePercentage, 17);
      assert.equal(comp.isIncomeIncreased, true);
    });

    it('handles 0 in previous period gracefully without division by zero', () => {
      const current = [{ type: 'expense', amount: 1200 }];
      const previous = [];

      const comp = calculatePeriodComparison(current, previous);
      assert.equal(comp.expenseChangePercentage, 100);
      assert.equal(comp.incomeChangePercentage, 0);
    });
  });

  // 5. Budget Health & Over-Budget Transparency
  describe('Budget Health Calculations', () => {
    it('handles unconfigured or zero budget safely', () => {
      const zeroBudget = calculateBudgetHealth(1500, 0);
      assert.equal(zeroBudget.hasBudget, false);
      assert.equal(zeroBudget.percentage, 0);
      assert.equal(zeroBudget.status, 'unconfigured');
    });

    it('calculates safe budget usage (< 70%)', () => {
      const health = calculateBudgetHealth(20000, 50000); // 40%
      assert.equal(health.hasBudget, true);
      assert.equal(health.percentage, 40);
      assert.equal(health.remaining, 30000);
      assert.equal(health.isExceeded, false);
      assert.equal(health.status, 'safe');
    });

    it('calculates warning budget usage (70% - 89%)', () => {
      const health = calculateBudgetHealth(38000, 50000); // 76%
      assert.equal(health.percentage, 76);
      assert.equal(health.status, 'warning');
      assert.equal(health.remaining, 12000);
    });

    it('calculates danger budget usage (90% - 100%)', () => {
      const health = calculateBudgetHealth(47500, 50000); // 95%
      assert.equal(health.percentage, 95);
      assert.equal(health.status, 'danger');
      assert.equal(health.remaining, 2500);
    });

    it('calculates over-budget transparently without capping to 100%', () => {
      const health = calculateBudgetHealth(65000, 50000); // 130%
      assert.equal(health.percentage, 130);
      assert.equal(health.isExceeded, true);
      assert.equal(health.remaining, 0);
      assert.equal(health.exceededAmount, 15000);
      assert.equal(health.status, 'exceeded');
    });
  });

  // 6. Continuous Daily Spending Series
  describe('Daily Spending Series Generation', () => {
    it('fills in 0 for dates with no activity to maintain chart continuity', () => {
      const txs = [
        { date: '2026-10-01', amount: 500, type: 'expense' },
        { date: '2026-10-03', amount: 300, type: 'expense' }
      ];

      const series = getDailySpendingSeries(txs, '2026-10-01', '2026-10-03');
      assert.equal(series.length, 3);
      assert.equal(series[0].date, '2026-10-01');
      assert.equal(series[0].amount, 500);
      assert.equal(series[1].date, '2026-10-02');
      assert.equal(series[1].amount, 0); // Filled with 0
      assert.equal(series[2].date, '2026-10-03');
      assert.equal(series[2].amount, 300);
    });
  });

});
