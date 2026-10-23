import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  transactionService, 
  mapRowToTransaction, 
  mapTransactionToRow 
} from '../services/transactionService.js';
import { validateTransaction } from '../utils/validation.js';
import { toPaise, fromPaise, calculatePortfolioMetrics } from '../utils/currency.js';

describe('Transaction Management — CRUD & Edge Cases (Mocked Supabase)', () => {

  // 1. Valid and Invalid Creation
  describe('Transaction Creation Validation', () => {
    it('creates a valid expense and produces exact paise representation', () => {
      const input = {
        amount: 450,
        merchant: 'Swiggy',
        category: 'Food & Dining',
        date: '2026-10-21',
        time: '01:30 PM',
        notes: 'Dinner with colleagues',
        type: 'expense'
      };

      const validation = validateTransaction(input);
      assert.equal(validation.isValid, true);
      assert.deepEqual(validation.errors, {});

      const row = mapTransactionToRow(input, 'user-uuid-1');
      assert.equal(row.user_id, 'user-uuid-1');
      assert.equal(row.amount_paise, 45000); // 450 INR = 45000 paise
      assert.equal(row.type, 'expense');
      assert.equal(row.merchant, 'Swiggy');
      assert.equal(row.category_name, 'Food & Dining');
      assert.equal(row.note, 'Dinner with colleagues');
      assert.equal(row.is_demo, false);
    });

    it('creates a valid income transaction with appropriate defaults', () => {
      const input = {
        amount: 85000,
        merchant: 'Acme Corp',
        category: 'Salary',
        date: '2026-10-01',
        type: 'income'
      };

      const validation = validateTransaction(input);
      assert.equal(validation.isValid, true);

      const row = mapTransactionToRow(input, 'user-uuid-1');
      assert.equal(row.type, 'income');
      assert.equal(row.amount_paise, 8500000); // 85,000 INR
      assert.equal(row.merchant, 'Acme Corp');
      assert.equal(row.category_name, 'Salary');
    });

    it('rejects invalid inputs: blank amount, negative amount, zero amount, and missing merchant', () => {
      const cases = [
        { data: { amount: '', merchant: 'Swiggy' }, expectedKey: 'amount' },
        { data: { amount: 0, merchant: 'Swiggy' }, expectedKey: 'amount' },
        { data: { amount: -50, merchant: 'Swiggy' }, expectedKey: 'amount' },
        { data: { amount: NaN, merchant: 'Swiggy' }, expectedKey: 'amount' },
        { data: { amount: 450, merchant: '' }, expectedKey: 'merchant' },
        { data: { amount: 450, merchant: '   ' }, expectedKey: 'merchant' },
        { data: { amount: 450, merchant: 'Valid', date: '21/10/2026' }, expectedKey: 'date' }
      ];

      for (const c of cases) {
        const result = validateTransaction(c.data);
        assert.equal(result.isValid, false, `Expected invalid for: ${JSON.stringify(c.data)}`);
        assert.ok(result.errors[c.expectedKey], `Expected error on key: ${c.expectedKey}`);
      }
    });

    it('prevents exorbitant values exceeding maximum limit of 10 crore', () => {
      const res = validateTransaction({
        amount: 200000000, // 20 crore
        merchant: 'Real Estate'
      });
      assert.equal(res.isValid, false);
      assert.match(res.errors.amount, /cannot exceed/i);
    });
  });

  // 2. Round-Trip Persistence & Decimal Precision
  describe('Persistence Consistency & Zero Rounding Loss', () => {
    it('guarantees round-trip equality without IEEE-754 drift', () => {
      const testAmounts = [0.01, 0.10, 450.00, 1299.99, 99999.99];

      for (const originalAmount of testAmounts) {
        const paise = toPaise(originalAmount);
        const reconstructed = fromPaise(paise);
        assert.equal(reconstructed, originalAmount);
      }
    });

    it('round-trips full database row through mapper without losing properties', () => {
      const dbRow = {
        id: '2dfa8f90-1111-4444-9999-123456789abc',
        user_id: 'user-777',
        amount_paise: 45000,
        currency: 'INR',
        type: 'expense',
        merchant: 'Swiggy',
        description: 'Swiggy delivery',
        category_id: null,
        category_name: 'Food & Dining',
        date: '2026-10-21',
        time: '13:30:00',
        payment_method: 'UPI',
        note: 'Extra cheese',
        source: 'manual',
        is_demo: false,
        import_metadata: { status: 'Completed' },
        created_at: '2026-10-21T13:30:00Z',
        updated_at: '2026-10-21T13:30:00Z'
      };

      const mapped = mapRowToTransaction(dbRow);

      assert.equal(mapped.id, dbRow.id);
      assert.equal(mapped.userId, dbRow.user_id);
      assert.equal(mapped.amount, 450);
      assert.equal(mapped.merchant, 'Swiggy');
      assert.equal(mapped.category, 'Food & Dining');
      assert.equal(mapped.time, '01:30 PM');
      assert.equal(mapped.notes, 'Extra cheese');
      assert.equal(mapped.status, 'Completed');
    });
  });

  // 3. Multi-User Isolation & Security
  describe('Multi-Tenant User Isolation & Authorization', () => {
    it('always binds queries and mutations to the authenticated user ID', () => {
      const userA = 'user-alice-111';
      const userB = 'user-bob-222';

      const rowA = mapTransactionToRow({ amount: 100, merchant: 'Store A' }, userA);
      const rowB = mapTransactionToRow({ amount: 200, merchant: 'Store B' }, userB);

      assert.equal(rowA.user_id, userA);
      assert.equal(rowB.user_id, userB);
      assert.notEqual(rowA.user_id, rowB.user_id);
    });

    it('calculates portfolio metrics strictly for provided user transaction set', () => {
      const userTransactions = [
        { type: 'income', amount: 50000 },
        { type: 'expense', amount: 450 },
        { type: 'expense', amount: 280 }
      ];

      const metrics = calculatePortfolioMetrics(userTransactions);
      assert.equal(metrics.totalIncome, 50000);
      assert.equal(metrics.totalExpense, 730);
      assert.equal(metrics.portfolioBalance, 49270);
    });

    it('returns zeroes when user has an empty transaction history', () => {
      const metrics = calculatePortfolioMetrics([]);
      assert.equal(metrics.totalIncome, 0);
      assert.equal(metrics.totalExpense, 0);
      assert.equal(metrics.portfolioBalance, 0);
      assert.equal(metrics.savings, 0);
    });
  });

  // 4. Update and Delete Edge Cases
  describe('Update and Delete Validation', () => {
    it('rejects transaction update when amount is non-positive', async () => {
      const res = await transactionService.updateTransaction('user-1', 'tx-1', {
        amount: -50
      });
      assert.equal(res.data, null);
      assert.ok(res.error);
      assert.match(res.error.message, /greater than zero/i);
    });

    it('rejects transaction update when merchant name is blank', async () => {
      const res = await transactionService.updateTransaction('user-1', 'tx-1', {
        merchant: '   '
      });
      assert.equal(res.data, null);
      assert.ok(res.error);
      assert.match(res.error.message, /merchant name is required/i);
    });

    it('rejects transaction update when date format is invalid', async () => {
      const res = await transactionService.updateTransaction('user-1', 'tx-1', {
        date: '2026/10/21'
      });
      assert.equal(res.data, null);
      assert.ok(res.error);
      assert.match(res.error.message, /YYYY-MM-DD/i);
    });
  });

});
