import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  formatTo24HourTime, 
  formatTo12HourTime, 
  mapRowToTransaction, 
  mapTransactionToRow,
  transactionService 
} from '../services/transactionService.js';

describe('Transaction Service — Mapping & Time Utilities', () => {
  it('converts 12-hour AM/PM time strings to 24-hour HH:MM:SS for PostgreSQL', () => {
    assert.equal(formatTo24HourTime('01:30 PM'), '13:30:00');
    assert.equal(formatTo24HourTime('12:00 AM'), '00:00:00');
    assert.equal(formatTo24HourTime('12:00 PM'), '12:00:00');
    assert.equal(formatTo24HourTime('09:45 AM'), '09:45:00');
    assert.equal(formatTo24HourTime('11:59 PM'), '23:59:00');
    assert.equal(formatTo24HourTime(null), '12:00:00');
    assert.equal(formatTo24HourTime('invalid'), '12:00:00');
  });

  it('converts PostgreSQL 24-hour time to 12-hour AM/PM for UI display', () => {
    assert.equal(formatTo12HourTime('13:30:00'), '01:30 PM');
    assert.equal(formatTo12HourTime('00:00:00'), '12:00 AM');
    assert.equal(formatTo12HourTime('12:00:00'), '12:00 PM');
    assert.equal(formatTo12HourTime('09:15:00'), '09:15 AM');
    assert.equal(formatTo12HourTime(null), '12:00 PM');
  });

  it('maps PostgreSQL row with minor units (paise) to frontend Transaction model with zero loss', () => {
    const row = {
      id: 'tx-uuid-1234',
      user_id: 'user-uuid-9999',
      amount_paise: 45000, // 450 INR
      currency: 'INR',
      type: 'expense',
      merchant: 'Swiggy',
      description: 'Dinner delivery',
      category_name: 'Food & Dining',
      category_id: 'cat-uuid-5678',
      date: '2026-10-21',
      time: '13:30:00',
      payment_method: 'UPI',
      note: 'Ordered biryani',
      source: 'manual',
      is_demo: false,
      import_metadata: {
        status: 'Completed',
        isSplit: true,
        groupId: 'grp-1',
        groupTitle: 'Flatmates',
        splitPeopleCount: 3,
        splitType: 'equal'
      },
      created_at: '2026-10-21T13:30:00.000Z',
      updated_at: '2026-10-21T13:30:00.000Z'
    };

    const mapped = mapRowToTransaction(row);

    assert.equal(mapped.id, 'tx-uuid-1234');
    assert.equal(mapped.userId, 'user-uuid-9999');
    assert.equal(mapped.amount, 450); // In rupees
    assert.equal(mapped.amount_paise, 45000);
    assert.equal(mapped.merchant, 'Swiggy');
    assert.equal(mapped.category, 'Food & Dining');
    assert.equal(mapped.time, '01:30 PM');
    assert.equal(mapped.paymentMethod, 'UPI');
    assert.equal(mapped.notes, 'Ordered biryani');
    assert.equal(mapped.isSplit, true);
    assert.equal(mapped.groupId, 'grp-1');
    assert.equal(mapped.groupTitle, 'Flatmates');
    assert.equal(mapped.splitPeopleCount, 3);
    assert.equal(mapped.isDemo, false);
  });

  it('maps frontend input object to database row converting amount to paise', () => {
    const input = {
      merchant: '  Uber Ride  ',
      amount: 280.50,
      category: 'Travel',
      date: '2026-10-21',
      time: '09:15 AM',
      paymentMethod: 'Card',
      notes: 'Office commute',
      type: 'expense',
      isDemo: false
    };

    const row = mapTransactionToRow(input, 'user-123');

    assert.equal(row.user_id, 'user-123');
    assert.equal(row.amount_paise, 28050); // 280.50 * 100
    assert.equal(row.merchant, 'Uber Ride'); // Trimmed
    assert.equal(row.category_name, 'Travel');
    assert.equal(row.date, '2026-10-21');
    assert.equal(row.time, '09:15:00');
    assert.equal(row.payment_method, 'Card');
    assert.equal(row.note, 'Office commute');
    assert.equal(row.is_demo, false);
  });
});

describe('Transaction Service — Validation & Security Constraints', () => {
  it('rejects transaction creation when user authentication ID is missing', async () => {
    const res = await transactionService.createTransaction(null, {
      amount: 450,
      merchant: 'Swiggy'
    });

    assert.equal(res.data, null);
    assert.ok(res.error);
    assert.match(res.error.message, /authentication required/i);
  });

  it('rejects transaction creation when amount is zero or negative', async () => {
    const resZero = await transactionService.createTransaction('user-1', {
      amount: 0,
      merchant: 'Swiggy'
    });
    assert.equal(resZero.data, null);
    assert.ok(resZero.error);
    assert.match(resZero.error.message, /greater than zero/i);

    const resNeg = await transactionService.createTransaction('user-1', {
      amount: -100,
      merchant: 'Swiggy'
    });
    assert.equal(resNeg.data, null);
    assert.ok(resNeg.error);
    assert.match(resNeg.error.message, /greater than zero/i);
  });

  it('rejects transaction creation when merchant name is missing or blank', async () => {
    const res = await transactionService.createTransaction('user-1', {
      amount: 450,
      merchant: '   '
    });
    assert.equal(res.data, null);
    assert.ok(res.error);
    assert.match(res.error.message, /merchant name is required/i);
  });

  it('rejects transaction creation when date is malformed', async () => {
    const res = await transactionService.createTransaction('user-1', {
      amount: 450,
      merchant: 'Swiggy',
      date: '21/10/2026'
    });
    assert.equal(res.data, null);
    assert.ok(res.error);
    assert.match(res.error.message, /YYYY-MM-DD/i);
  });

  it('rejects updates without userId or txId', async () => {
    const res = await transactionService.updateTransaction(null, 'tx-1', { amount: 500 });
    assert.equal(res.data, null);
    assert.ok(res.error);
    assert.match(res.error.message, /required/i);
  });

  it('rejects delete without userId or txId', async () => {
    const res = await transactionService.deleteTransaction('user-1', null);
    assert.equal(res.success, false);
    assert.ok(res.error);
    assert.match(res.error.message, /required/i);
  });
});
