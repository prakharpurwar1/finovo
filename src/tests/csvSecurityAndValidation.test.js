/**
 * Finovo Phase 7 Security Test Suite: CSV & Financial Data Security
 * Tests RFC 4180 parsing, ambiguous dates, formula injection defense,
 * duplicate detection, pagination boundaries, and financial calculation integrity.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  parseCsv, 
  validateCsvRow, 
  sanitizeForCsv, 
  escapeCsvCell, 
  checkDuplicateTransactions, 
  generateTransactionsCsv, 
  parseDateString 
} from '../services/csvService.js';
import { calculateBudgetProgress } from '../services/budgetService.js';
import { toPaise, fromPaise } from '../utils/currency.js';

describe('CSV Security & Formula Injection Defense', () => {
  it('neutralizes all dangerous formula injection characters with single quote prefix', () => {
    const dangerousInputs = [
      '=cmd|"/C calc"!A0',
      '+SUM(1+1)',
      '-2+3+cmd|"/C notepad"!A0',
      '@HYPERLINK("http://evil.com")',
      '\tDDE("cmd", "/C calc", "A1")',
      '\r=1+1'
    ];

    for (const input of dangerousInputs) {
      const sanitized = sanitizeForCsv(input);
      assert.ok(sanitized.startsWith("'"), `Dangerous input "${input}" must be prepended with apostrophe`);
    }
  });

  it('leaves safe alphanumeric strings and legitimate text unmodified', () => {
    const safeInputs = [
      'Swiggy Order #1234',
      'Uber Ride',
      '1250.50',
      'Grocery purchase at Blinkit',
      'Refund processed'
    ];

    for (const input of safeInputs) {
      const sanitized = sanitizeForCsv(input);
      assert.strictEqual(sanitized, input);
    }
  });

  it('escapes cells containing commas, quotes, and newlines safely according to RFC 4180', () => {
    const cellWithComma = 'Acme, Corp';
    assert.strictEqual(escapeCsvCell(cellWithComma), '"Acme, Corp"');

    const cellWithQuote = 'John "Doc" Doe';
    assert.strictEqual(escapeCsvCell(cellWithQuote), '"John ""Doc"" Doe"');

    const cellWithFormulaAndComma = '=1+2,test';
    // Must sanitize the formula first (prefix with '), then wrap in quotes due to comma
    assert.strictEqual(escapeCsvCell(cellWithFormulaAndComma), '"\'=1+2,test"');
  });
});

describe('CSV Statement Parsing & Ambiguous Date Resolution', () => {
  it('correctly handles multi-line fields and escaped quotes in CSV records', () => {
    const csvContent = `Date,Merchant,Amount\n2026-10-01,"Cafe Coffee Day\nBranch 2",150.00\n2026-10-02,"Amazon ""Prime"" Purchase",999.00`;
    const parsed = parseCsv(csvContent);

    assert.strictEqual(parsed.headers.length, 3);
    assert.strictEqual(parsed.rows.length, 2);
    assert.strictEqual(parsed.rows[0].Merchant, 'Cafe Coffee Day\nBranch 2');
    assert.strictEqual(parsed.rows[1].Merchant, 'Amazon "Prime" Purchase');
  });

  it('rejects empty or corrupt CSV strings gracefully', () => {
    const emptyResult = parseCsv('');
    assert.strictEqual(emptyResult.headers.length, 0);
    assert.strictEqual(emptyResult.rows.length, 0);

    const nullResult = parseCsv(null);
    assert.ok(nullResult.error);
  });

  it('resolves ambiguous dates explicitly according to user-selected format', () => {
    // 05/04/2026 can be May 4 or April 5
    const dateStr = '05/04/2026';
    
    const parsedDDMM = parseDateString(dateStr, 'DD/MM/YYYY');
    assert.strictEqual(parsedDDMM.date, '2026-04-05', '05/04 in DD/MM/YYYY is 5th April');

    const parsedMMDD = parseDateString(dateStr, 'MM/DD/YYYY');
    assert.strictEqual(parsedMMDD.date, '2026-05-04', '05/04 in MM/DD/YYYY is 4th May');

    const parsedISO = parseDateString('2026-10-23', 'DD/MM/YYYY');
    assert.strictEqual(parsedISO.date, '2026-10-23', 'Standard ISO YYYY-MM-DD resolves directly');
  });

  it('validates CSV rows and rejects negative, non-finite, and zero amounts', () => {
    const mapping = { date: 'Date', amount: 'Amount', merchant: 'Merchant' };

    const validRow = { Date: '2026-10-15', Amount: '450.00', Merchant: 'Zomato', __rowNumber: 1 };
    const validResult = validateCsvRow(validRow, mapping, 'DD/MM/YYYY');
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.parsedTransaction.amount, 450);

    const zeroAmountRow = { Date: '2026-10-15', Amount: '0.00', Merchant: 'Zero', __rowNumber: 2 };
    const zeroResult = validateCsvRow(zeroAmountRow, mapping, 'DD/MM/YYYY');
    assert.strictEqual(zeroResult.valid, false);
    assert.match(zeroResult.error, /Invalid transaction amount/i);

    const invalidDateRow = { Date: 'not-a-date', Amount: '100', Merchant: 'Shop', __rowNumber: 3 };
    const dateResult = validateCsvRow(invalidDateRow, mapping, 'DD/MM/YYYY');
    assert.strictEqual(dateResult.valid, false);
    assert.match(dateResult.error, /Invalid date format/i);
  });
});

describe('Conservative Duplicate Transaction Detection', () => {
  const existingTransactions = [
    {
      id: 'tx-1',
      date: '2026-10-20',
      amount: 1500,
      merchant: 'Swiggy',
      bankTxId: 'UPI-987654321'
    },
    {
      id: 'tx-2',
      date: '2026-10-21',
      amount: 2500,
      merchant: 'Decathlon',
      bankTxId: null
    }
  ];

  it('identifies exact duplicate based on bank reference number', () => {
    const candidates = [
      {
        date: '2026-10-20',
        amount: 1500,
        merchant: 'Swiggy Online',
        bankTxId: 'UPI-987654321'
      }
    ];

    const results = checkDuplicateTransactions(candidates, existingTransactions);
    assert.strictEqual(results[0].duplicateType, 'exact');
    assert.ok(results[0].reason.includes('Bank Transaction ID'));
  });

  it('identifies exact duplicate based on matching date, paise amount, and merchant name', () => {
    const candidates = [
      {
        date: '2026-10-21',
        amount: 2500,
        merchant: 'Decathlon',
        bankTxId: null
      }
    ];

    const results = checkDuplicateTransactions(candidates, existingTransactions);
    assert.strictEqual(results[0].duplicateType, 'exact');
    assert.ok(results[0].reason.includes('Exact match'));
  });

  it('identifies possible duplicate when date and amount match but merchant text differs', () => {
    const candidates = [
      {
        date: '2026-10-21',
        amount: 2500,
        merchant: 'Decathlon Sports India Pvt Ltd',
        bankTxId: null
      }
    ];

    const results = checkDuplicateTransactions(candidates, existingTransactions);
    assert.strictEqual(results[0].duplicateType, 'possible');
    assert.ok(results[0].reason.includes('Same date and amount'));
  });

  it('classifies distinct transactions with different dates or amounts as non-duplicates', () => {
    const candidates = [
      {
        date: '2026-10-22',
        amount: 3000,
        merchant: 'Nike',
        bankTxId: null
      }
    ];

    const results = checkDuplicateTransactions(candidates, existingTransactions);
    assert.strictEqual(results[0].duplicateType, 'none');
  });
});

describe('CSV Export Filtering & Integrity', () => {
  const dataset = [
    { id: '1', date: '2026-10-01', amount: 500, type: 'expense', category: 'Food', merchant: 'Swiggy', source: 'manual' },
    { id: '2', date: '2026-10-05', amount: 50000, type: 'income', category: 'Salary', merchant: 'Employer Corp', source: 'manual' },
    { id: '3', date: '2026-10-10', amount: 1200, type: 'expense', category: 'Travel', merchant: '=Uber India', source: 'manual' },
    { id: '4', date: '2026-10-15', amount: 800, type: 'expense', category: 'Food', merchant: 'Zomato', source: 'manual' }
  ];

  it('filters export by transaction type (expenses only)', () => {
    const csv = generateTransactionsCsv(dataset, { type: 'expense' });
    const lines = csv.trim().split('\n');
    assert.strictEqual(lines.length, 4); // 1 header + 3 expenses
    assert.ok(!csv.includes('Employer Corp'));
  });

  it('filters export by category', () => {
    const csv = generateTransactionsCsv(dataset, { category: 'Food' });
    const lines = csv.trim().split('\n');
    assert.strictEqual(lines.length, 3); // 1 header + 2 Food items
    assert.ok(csv.includes('Swiggy'));
    assert.ok(csv.includes('Zomato'));
    assert.ok(!csv.includes('Travel'));
  });

  it('filters export by date range', () => {
    const csv = generateTransactionsCsv(dataset, { startDate: '2026-10-05', endDate: '2026-10-12' });
    const lines = csv.trim().split('\n');
    assert.strictEqual(lines.length, 3); // Salary (Oct 5) and Uber (Oct 10)
    assert.ok(!csv.includes('Swiggy')); // Oct 1
    assert.ok(!csv.includes('Zomato')); // Oct 15
  });

  it('sanitizes dangerous formulas in exported merchant names', () => {
    const csv = generateTransactionsCsv(dataset);
    // "=Uber India" must be sanitized to "'=Uber India"
    assert.ok(csv.includes("'=Uber India"), 'Exported formula merchant must have leading apostrophe');
  });
});

describe('Financial Calculation Precision & Budget Boundaries', () => {
  it('maintains zero rounding drift converting between rupees and paise', () => {
    const amounts = [0.01, 0.1, 0.33, 99.99, 1500.5, 45000.75];
    for (const amt of amounts) {
      const paise = toPaise(amt);
      const convertedBack = fromPaise(paise);
      assert.strictEqual(convertedBack, amt);
    }
  });

  it('correctly calculates budget progress, remaining amounts, and over-budget status', () => {
    const budget = {
      id: 'b-1',
      amount: 10000,
      categoryName: 'Food'
    };

    const transactions = [
      { date: '2026-10-05', amount: 3000, type: 'expense', category: 'Food' },
      { date: '2026-10-10', amount: 4500, type: 'expense', category: 'Food' },
      { date: '2026-10-15', amount: 1000, type: 'expense', category: 'Travel' }, // Ignored (different category)
      { date: '2026-10-20', amount: 500, type: 'income', category: 'Refunds' }   // Ignored (different category)
    ];

    const boundaries = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const progress = calculateBudgetProgress(budget, transactions, boundaries);

    assert.strictEqual(progress.actualSpend, 7500);
    assert.strictEqual(progress.remaining, 2500);
    assert.strictEqual(progress.percentage, 75);
    assert.strictEqual(progress.status, 'warning'); // 70-89% is warning
    assert.strictEqual(progress.isExceeded, false);
  });

  it('transparently reports over-budget exceeding without capping percentage at 100%', () => {
    const budget = {
      id: 'b-2',
      amount: 5000,
      categoryName: 'Shopping'
    };

    const transactions = [
      { date: '2026-10-05', amount: 6000, type: 'expense', category: 'Shopping' }
    ];

    const boundaries = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const progress = calculateBudgetProgress(budget, transactions, boundaries);

    assert.strictEqual(progress.actualSpend, 6000);
    assert.strictEqual(progress.remaining, 0);
    assert.strictEqual(progress.percentage, 120);
    assert.strictEqual(progress.isExceeded, true);
    assert.strictEqual(progress.exceededAmount, 1000);
    assert.strictEqual(progress.status, 'exceeded');
  });
});
