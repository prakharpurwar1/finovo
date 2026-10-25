/**
 * Comprehensive Unit Tests for Finovo Split Calculations & Debt Simplification Engine
 * Uses Node.js native test runner (node:test & node:assert).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateMemberBalances,
  calculateSimplifiedDebts
} from '../utils/splitCalculations.js';

describe('Split Expense Calculation Engine', () => {
  describe('Equal Split', () => {
    it('splits ₹1,000 across 3 members with exact remainder distribution', () => {
      const participants = [
        { id: 'user-1', name: 'Alice' },
        { id: 'user-2', name: 'Bob' },
        { id: 'user-3', name: 'Charlie' }
      ];

      const result = calculateEqualSplit({ totalAmount: 1000, participants });
      assert.equal(result.valid, true);
      assert.equal(result.shares.length, 3);

      assert.equal(result.shares[0].allocatedShare, 333.34);
      assert.equal(result.shares[1].allocatedShare, 333.33);
      assert.equal(result.shares[2].allocatedShare, 333.33);

      // Verify exact sum equals total without a single paisa drift
      const totalAllocatedPaise = result.shares.reduce((sum, s) => sum + s.allocatedSharePaise, 0);
      assert.equal(totalAllocatedPaise, 100000); // 100,000 paise = ₹1,000.00
    });

    it('rejects zero or negative amounts and empty participant lists', () => {
      const resZero = calculateEqualSplit({ totalAmount: 0, participants: [{ id: '1', name: 'Alice' }] });
      assert.equal(resZero.valid, false);

      const resEmpty = calculateEqualSplit({ totalAmount: 500, participants: [] });
      assert.equal(resEmpty.valid, false);
    });
  });

  describe('Unequal Split', () => {
    it('validates unequal split when shares sum to total', () => {
      const customShares = [
        { memberId: 'm1', name: 'Alice', amount: 500 },
        { memberId: 'm2', name: 'Bob', amount: 300 },
        { memberId: 'm3', name: 'Charlie', amount: 200 }
      ];

      const result = calculateUnequalSplit({ totalAmount: 1000, customShares });
      assert.equal(result.valid, true);
      assert.equal(result.remainingPaise, 0);
      assert.equal(result.error, null);
    });

    it('detects mismatch when shares are short or exceed total', () => {
      const shortShares = [
        { memberId: 'm1', name: 'Alice', amount: 400 },
        { memberId: 'm2', name: 'Bob', amount: 300 }
      ];

      const resShort = calculateUnequalSplit({ totalAmount: 1000, customShares: shortShares });
      assert.equal(resShort.valid, false);
      assert.equal(resShort.remainingPaise, 30000); // ₹300 short

      const excessShares = [
        { memberId: 'm1', name: 'Alice', amount: 800 },
        { memberId: 'm2', name: 'Bob', amount: 400 }
      ];

      const resExcess = calculateUnequalSplit({ totalAmount: 1000, customShares: excessShares });
      assert.equal(resExcess.valid, false);
      assert.equal(resExcess.remainingPaise, -20000); // ₹200 excess
    });
  });

  describe('Percentage Split', () => {
    it('calculates percentage shares and distributes remainder on last member', () => {
      const percentageShares = [
        { memberId: 'm1', name: 'Alice', percentage: 33.33 },
        { memberId: 'm2', name: 'Bob', percentage: 33.33 },
        { memberId: 'm3', name: 'Charlie', percentage: 33.34 }
      ];

      const result = calculatePercentageSplit({ totalAmount: 1000, percentageShares });
      assert.equal(result.valid, true);
      const totalPaise = result.shares.reduce((s, item) => s + item.allocatedSharePaise, 0);
      assert.equal(totalPaise, 100000); // exactly ₹1,000
    });

    it('rejects percentage distributions that do not total 100%', () => {
      const invalidPct = [
        { memberId: 'm1', name: 'Alice', percentage: 50 },
        { memberId: 'm2', name: 'Bob', percentage: 40 }
      ];

      const result = calculatePercentageSplit({ totalAmount: 1000, percentageShares: invalidPct });
      assert.equal(result.valid, false);
      assert.ok(result.error.includes('100%'));
    });
  });

  describe('Balance Calculations and Prompt Example Verification', () => {
    it('reproduces prompt specification: Alice pays ₹1,200 split equally among Alice, Bob, Charlie', () => {
      // Alice: +₹800, Bob: -₹400, Charlie: -₹400
      const members = [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' },
        { id: 'charlie', name: 'Charlie' }
      ];

      const expenses = [
        {
          id: 'exp-1',
          payer_member_id: 'alice',
          amount_paise: 120000, // ₹1,200
          status: 'active',
          shares: [
            { member_id: 'alice', allocated_share_paise: 40000 },
            { member_id: 'bob', allocated_share_paise: 40000 },
            { member_id: 'charlie', allocated_share_paise: 40000 }
          ]
        }
      ];

      const { memberBalances } = calculateMemberBalances({ members, expenses, settlements: [] });

      const aliceBal = memberBalances.find(m => m.memberId === 'alice');
      const bobBal = memberBalances.find(m => m.memberId === 'bob');
      const charlieBal = memberBalances.find(m => m.memberId === 'charlie');

      assert.equal(aliceBal.netBalance, 800);
      assert.equal(aliceBal.balanceStatus, 'owed');

      assert.equal(bobBal.netBalance, -400);
      assert.equal(bobBal.balanceStatus, 'owes');

      assert.equal(charlieBal.netBalance, -400);
      assert.equal(charlieBal.balanceStatus, 'owes');
    });

    it('accurately updates balances upon recording a partial settlement', () => {
      const members = [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' }
      ];

      const expenses = [
        {
          id: 'exp-1',
          payer_member_id: 'alice',
          amount_paise: 100000, // ₹1,000
          status: 'active',
          shares: [
            { member_id: 'alice', allocated_share_paise: 50000 },
            { member_id: 'bob', allocated_share_paise: 50000 }
          ]
        }
      ];

      // Bob pays Alice ₹200 (partial settlement)
      const settlements = [
        {
          id: 'set-1',
          payer_member_id: 'bob',
          recipient_member_id: 'alice',
          amount_paise: 20000, // ₹200
          status: 'confirmed'
        }
      ];

      const { memberBalances } = calculateMemberBalances({ members, expenses, settlements });
      const aliceBal = memberBalances.find(m => m.memberId === 'alice');
      const bobBal = memberBalances.find(m => m.memberId === 'bob');

      // Alice was owed 500, received 200 -> now owed 300
      assert.equal(aliceBal.netBalance, 300);
      // Bob owed 500, paid 200 -> now owes 300
      assert.equal(bobBal.netBalance, -300);
    });

    it('fully settles debts when full payment is confirmed', () => {
      const members = [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' }
      ];

      const expenses = [
        {
          id: 'exp-1',
          payer_member_id: 'alice',
          amount_paise: 100000,
          status: 'active',
          shares: [
            { member_id: 'alice', allocated_share_paise: 50000 },
            { member_id: 'bob', allocated_share_paise: 50000 }
          ]
        }
      ];

      // Full settlement of ₹500
      const settlements = [
        {
          id: 'set-1',
          payer_member_id: 'bob',
          recipient_member_id: 'alice',
          amount_paise: 50000,
          status: 'confirmed'
        }
      ];

      const { memberBalances } = calculateMemberBalances({ members, expenses, settlements });
      const aliceBal = memberBalances.find(m => m.memberId === 'alice');
      const bobBal = memberBalances.find(m => m.memberId === 'bob');

      assert.equal(aliceBal.netBalance, 0);
      assert.equal(aliceBal.balanceStatus, 'settled');
      assert.equal(bobBal.netBalance, 0);
      assert.equal(bobBal.balanceStatus, 'settled');
    });

    it('ignores cancelled or deleted expenses from balances', () => {
      const members = [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' }
      ];

      const expenses = [
        {
          id: 'exp-1',
          payer_member_id: 'alice',
          amount_paise: 100000,
          status: 'deleted',
          shares: [
            { member_id: 'alice', allocated_share_paise: 50000 },
            { member_id: 'bob', allocated_share_paise: 50000 }
          ]
        }
      ];

      const { memberBalances } = calculateMemberBalances({ members, expenses, settlements: [] });
      assert.equal(memberBalances[0].netBalance, 0);
      assert.equal(memberBalances[1].netBalance, 0);
    });
  });

  describe('Debt Simplification Algorithm', () => {
    it('simplifies 3-party circular/linear debts into minimal transfers', () => {
      // Alice: +₹800, Bob: -₹400, Charlie: -₹400
      const memberBalances = [
        { memberId: 'alice', name: 'Alice', netBalancePaise: 80000 },
        { memberId: 'bob', name: 'Bob', netBalancePaise: -40000 },
        { memberId: 'charlie', name: 'Charlie', netBalancePaise: -40000 }
      ];

      const plan = calculateSimplifiedDebts(memberBalances);

      // Should be 2 transfers: Bob pays Alice ₹400, Charlie pays Alice ₹400
      assert.equal(plan.length, 2);

      const bobTransfer = plan.find(t => t.fromMemberId === 'bob');
      assert.equal(bobTransfer.toMemberId, 'alice');
      assert.equal(bobTransfer.amount, 400);

      const charlieTransfer = plan.find(t => t.fromMemberId === 'charlie');
      assert.equal(charlieTransfer.toMemberId, 'alice');
      assert.equal(charlieTransfer.amount, 400);
    });

    it('conserves total debt amount across all simplified transactions', () => {
      const memberBalances = [
        { memberId: 'm1', name: 'User 1', netBalancePaise: 50000 }, // +500
        { memberId: 'm2', name: 'User 2', netBalancePaise: 30000 }, // +300
        { memberId: 'm3', name: 'User 3', netBalancePaise: -45000 }, // -450
        { memberId: 'm4', name: 'User 4', netBalancePaise: -35000 }  // -350
      ];

      const plan = calculateSimplifiedDebts(memberBalances);
      const totalTransferred = plan.reduce((sum, t) => sum + t.amountPaise, 0);

      assert.equal(totalTransferred, 80000); // 450 + 350 = 800
      assert.ok(plan.length <= 3); // Guaranteed minimum transfers <= n-1
    });
  });
});
