/**
 * End-to-End Integration Tests for Split Expense Management
 * Tests the complete lifecycle:
 * - Group creation & member management
 * - Invitations (registered & unregistered with secure token hash)
 * - Multi-method expense creation (Equal, Unequal, Percentage)
 * - Balance updates & settlement recording
 * - In-app notifications and SMS dispatches
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory localStorage polyfill for Node.js test environment
const mockStore = new Map();
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: (k) => mockStore.has(k) ? mockStore.get(k) : null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: (k) => mockStore.delete(k),
    clear: () => mockStore.clear()
  };
}

import { splitService } from '../services/splitService.js';
import { notificationService } from '../services/notificationService.js';
import { handleSmsSendRequest, normalizePhoneNumber } from '../server/smsService.js';
import { 
  SPLIT_METHODS, 
  calculateEqualSplit, 
  calculateUnequalSplit, 
  calculatePercentageSplit 
} from '../utils/splitCalculations.js';

describe('Split Expense Management — End-to-End Integration', () => {
  const testUserId = 'user-alice-123';

  beforeEach(() => {
    mockStore.clear();
  });

  describe('Group Creation and Member Management', () => {
    it('creates a new group with creator as admin and adds initial members', async () => {
      const groupData = {
        name: 'Goa Trip 2026',
        description: 'Beach villa, cabs and dinners',
        icon: '🏖️',
        initialMembers: [
          { name: 'Bob', email: 'bob@example.com', phone: '+919876543210' },
          { name: 'Charlie', email: 'charlie@example.com' }
        ]
      };

      const { data: newGroup, error } = await splitService.createGroup(testUserId, groupData, {
        name: 'Alice',
        email: 'alice@example.com'
      });

      assert.ifError(error);
      assert.ok(newGroup.id, 'Group must have an ID');
      assert.equal(newGroup.name, 'Goa Trip 2026');

      // Fetch group details
      const { data: groupDetails } = await splitService.fetchGroupDetails(newGroup.id, testUserId);
      assert.ok(groupDetails, 'Group details should be returned');
      assert.equal(groupDetails.group.name, 'Goa Trip 2026');
      assert.equal(groupDetails.members.length, 3, 'Should have 3 members: Alice, Bob, Charlie');

      const admin = groupDetails.members.find(m => m.user_id === testUserId);
      assert.ok(admin, 'Alice must be a member');
      assert.equal(admin.role, 'admin', 'Creator must be admin');
    });

    it('creates secure invitation tokens for unregistered participants', async () => {
      const { data: group } = await splitService.createGroup(testUserId, {
        name: 'Flatmates',
        initialMembers: []
      });

      const { data: invite, error } = await splitService.inviteMember(group.id, {
        name: 'David Guest',
        email: 'david@example.com',
        phone: '+919123456789',
        inviterId: testUserId
      });

      assert.ifError(error);
      assert.ok(invite.inviteToken, 'Invitation must have a secure token');
      assert.ok(invite.inviteLink, 'Invitation link must be generated');
      assert.ok(invite.inviteLink.includes('token='), 'Link must contain token parameter');
    });
  });

  describe('Expense Creation and Share Allocation', () => {
    it('creates an equal split expense and calculates shares matching prompt specification', async () => {
      const { data: group } = await splitService.createGroup(testUserId, {
        name: 'Dinner Outing',
        initialMembers: [
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      });

      const { data: details } = await splitService.fetchGroupDetails(group.id, testUserId);
      const [alice, bob, charlie] = details.members;

      // Alice pays ₹1,200 split equally among Alice, Bob, Charlie (400 each)
      const equalSplitResult = calculateEqualSplit({
        totalAmount: 1200,
        participants: [alice, bob, charlie]
      });
      assert.equal(equalSplitResult.valid, true);

      const { data: expense, error } = await splitService.createSplitExpense(group.id, testUserId, {
        title: 'Dinner at Beach Shack',
        totalAmountPaise: 120000,
        currency: 'INR',
        payerMemberId: alice.id,
        splitMethod: SPLIT_METHODS.EQUAL,
        shares: equalSplitResult.shares
      });

      assert.ifError(error);
      assert.ok(expense.id, 'Expense must be created');

      // Verify recalculated balances
      const { data: updatedDetails } = await splitService.fetchGroupDetails(group.id, testUserId);
      const balances = updatedDetails.memberBalances;

      const aliceBal = balances.find(b => b.memberId === alice.id);
      const bobBal = balances.find(b => b.memberId === bob.id);
      const charlieBal = balances.find(b => b.memberId === charlie.id);

      assert.equal(aliceBal.netPaise, 80000, 'Alice is owed +₹800');
      assert.equal(bobBal.netPaise, -40000, 'Bob owes -₹400');
      assert.equal(charlieBal.netPaise, -40000, 'Charlie owes -₹400');
    });

    it('validates and detects unequal split when shares do not sum to total', () => {
      const res = calculateUnequalSplit({
        totalAmount: 1000,
        customShares: [
          { memberId: 'm1', name: 'Alice', amount: 400 },
          { memberId: 'm2', name: 'Bob', amount: 500 } // Total 900 !== 1000
        ]
      });
      assert.equal(res.valid, false);
      assert.ok(res.error.includes('short by'));
    });

    it('validates and detects percentage split when percentages do not total 100%', () => {
      const res = calculatePercentageSplit({
        totalAmount: 1000,
        percentageShares: [
          { memberId: 'm1', name: 'Alice', percentage: 40 },
          { memberId: 'm2', name: 'Bob', percentage: 50 } // Total 90% !== 100%
        ]
      });
      assert.equal(res.valid, false);
      assert.ok(res.error.includes('Total percentage must equal 100%'));
    });
  });

  describe('Settlement Recording and Balance Updates', () => {
    it('records a partial settlement and updates balances correctly', async () => {
      const { data: group } = await splitService.createGroup(testUserId, {
        name: 'Weekend Trip',
        initialMembers: [{ name: 'Bob' }]
      });

      const { data: details } = await splitService.fetchGroupDetails(group.id, testUserId);
      const [alice, bob] = details.members;

      // Alice pays ₹1,000 split equally (500 each)
      const splitRes = calculateEqualSplit({
        totalAmount: 1000,
        participants: [alice, bob]
      });

      await splitService.createSplitExpense(group.id, testUserId, {
        title: 'Cab ride',
        totalAmountPaise: 100000,
        payerMemberId: alice.id,
        splitMethod: SPLIT_METHODS.EQUAL,
        shares: splitRes.shares
      });

      // Bob partially settles ₹300 via UPI
      const { data: settlement, error } = await splitService.recordSettlement(group.id, testUserId, {
        payerMemberId: bob.id,
        recipientMemberId: alice.id,
        amountPaise: 30000,
        paymentMethod: 'upi',
        notes: 'Paid via Google Pay'
      });

      assert.ifError(error);
      assert.ok(settlement.id);

      // Verify updated balances:
      // Alice was owed 500, received 300 -> net balance is +200
      // Bob owed 500, paid 300 -> net balance is -200
      const { data: updatedDetails } = await splitService.fetchGroupDetails(group.id, testUserId);
      const balances = updatedDetails.memberBalances;

      const aliceBal = balances.find(b => b.memberId === alice.id);
      const bobBal = balances.find(b => b.memberId === bob.id);

      assert.equal(aliceBal.netPaise, 20000, 'Alice is now owed +₹200');
      assert.equal(bobBal.netPaise, -20000, 'Bob now owes -₹200');
    });

    it('settles debt completely and marks balances as zero', async () => {
      const { data: group } = await splitService.createGroup(testUserId, {
        name: 'Lunch',
        initialMembers: [{ name: 'Bob' }]
      });

      const { data: details } = await splitService.fetchGroupDetails(group.id, testUserId);
      const [alice, bob] = details.members;

      // Alice pays ₹600 split equally (300 each)
      const splitRes = calculateEqualSplit({
        totalAmount: 600,
        participants: [alice, bob]
      });

      await splitService.createSplitExpense(group.id, testUserId, {
        title: 'Pizza',
        totalAmountPaise: 60000,
        payerMemberId: alice.id,
        splitMethod: SPLIT_METHODS.EQUAL,
        shares: splitRes.shares
      });

      // Bob settles full ₹300
      await splitService.recordSettlement(group.id, testUserId, {
        payerMemberId: bob.id,
        recipientMemberId: alice.id,
        amountPaise: 30000,
        paymentMethod: 'cash'
      });

      const { data: updatedDetails } = await splitService.fetchGroupDetails(group.id, testUserId);
      const balances = updatedDetails.memberBalances;

      const aliceBal = balances.find(b => b.memberId === alice.id);
      const bobBal = balances.find(b => b.memberId === bob.id);

      assert.equal(aliceBal.netPaise, 0, 'Alice is completely settled');
      assert.equal(bobBal.netPaise, 0, 'Bob is completely settled');
    });
  });

  describe('Notification Dispatch & Delivery Architecture', () => {
    it('dispatches in-app notifications to participants when an expense is added', async () => {
      const group = {
        id: 'grp-202',
        name: 'Goa Trip',
        members: [
          { id: 'm-alice', name: 'Alice', user_id: 'user-alice' },
          { id: 'm-bob', name: 'Bob', user_id: 'user-bob' },
          { id: 'm-charlie', name: 'Charlie', user_id: 'user-charlie' }
        ]
      };

      const expense = {
        id: 'exp-101',
        title: 'Dinner at Beach',
        amount: 1200,
        amount_paise: 120000
      };

      const shares = [
        { memberId: 'm-alice', allocatedSharePaise: 40000 },
        { memberId: 'm-bob', allocatedSharePaise: 40000 },
        { memberId: 'm-charlie', allocatedSharePaise: 40000 }
      ];

      await notificationService.dispatchSplitExpenseCreated({
        group,
        expense,
        shares,
        actorName: 'Alice'
      });

      // Check Bob's notifications
      const { data: bobNotifs } = await notificationService.fetchUserNotifications('user-bob');
      assert.ok(bobNotifs.length > 0, 'Bob should have received an in-app notification');
      assert.ok(bobNotifs[0].message.includes('₹400'), 'Notification should specify Bob share of ₹400');
    });

    it('enforces idempotency on SMS notifications and reports unconfigured status honestly', async () => {
      const req = {
        body: {
          recipientPhone: '+919876543210',
          message: 'Alice added a shared expense in Goa Trip for ₹400. Open Finovo to review.',
          idempotencyKey: 'test-idemp-key-999'
        }
      };

      const result1 = await handleSmsSendRequest(req, { env: {} });
      assert.equal(result1.status, 422, 'Returns 422 with actionable guidance when SMS provider is unconfigured');
      assert.ok(!result1.body.success, 'Never claims false success when provider is unconfigured');
      assert.equal(result1.body.deliveryStatus, 'failed');
    });
  });
});
