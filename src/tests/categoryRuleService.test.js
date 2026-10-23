import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { 
  categoryRuleService, 
  mapRowToRule,
  getSafeStorage
} from '../services/categoryRuleService.js';

describe('Category Rules Service & Multi-Tenant Persistence', () => {
  beforeEach(() => {
    // Clear test keys from safe storage
    const storage = getSafeStorage();
    if (storage && typeof storage.clear === 'function') {
      storage.clear();
    }
  });

  describe('Row Mapping Utility', () => {
    it('correctly maps PostgreSQL snake_case database row to camelCase domain model', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: 'user-abc',
        merchant_pattern: 'Blue Tokai',
        category_name: 'Food',
        category_id: null,
        match_type: 'exact',
        created_at: '2026-10-22T02:00:00Z',
        updated_at: '2026-10-22T02:00:00Z'
      };

      const mapped = mapRowToRule(dbRow);
      assert.equal(mapped.id, dbRow.id);
      assert.equal(mapped.userId, 'user-abc');
      assert.equal(mapped.merchantPattern, 'Blue Tokai');
      assert.equal(mapped.categoryName, 'Food');
      assert.equal(mapped.matchType, 'exact');
    });

    it('handles null row safely', () => {
      assert.equal(mapRowToRule(null), null);
    });
  });

  describe('Validation & Scoped Creation', () => {
    it('rejects rule creation when userId is missing', async () => {
      const { data, error } = await categoryRuleService.createUserRule(null, {
        merchantPattern: 'Blue Tokai',
        categoryName: 'Food'
      });
      assert.equal(data, null);
      assert.equal(error.message, 'User ID is required.');
    });

    it('rejects rule creation when merchantPattern is empty', async () => {
      const { data, error } = await categoryRuleService.createUserRule('user-1', {
        merchantPattern: '   ',
        categoryName: 'Food'
      });
      assert.equal(data, null);
      assert.equal(error.message, 'Merchant pattern is required.');
    });

    it('rejects rule creation when categoryName is empty', async () => {
      const { data, error } = await categoryRuleService.createUserRule('user-1', {
        merchantPattern: 'Blue Tokai',
        categoryName: '  '
      });
      assert.equal(data, null);
      assert.equal(error.message, 'Category name is required.');
    });

    it('successfully creates and returns user rule with valid inputs', async () => {
      const { data, error } = await categoryRuleService.createUserRule('user-1', {
        merchantPattern: 'Blue Tokai Coffee',
        categoryName: 'Food'
      });
      assert.equal(error, null);
      assert.equal(data.userId, 'user-1');
      assert.equal(data.merchantPattern, 'Blue Tokai Coffee');
      assert.equal(data.categoryName, 'Food');
      assert.equal(data.matchType, 'exact');
    });
  });

  describe('Multi-Tenant Isolation & Duplicate Replacement', () => {
    it('ensures User A cannot see User B rules (multi-tenant boundary)', async () => {
      await categoryRuleService.createUserRule('user-A', {
        merchantPattern: 'Secret Vendor',
        categoryName: 'Shopping'
      });

      await categoryRuleService.createUserRule('user-B', {
        merchantPattern: 'Private Merchant',
        categoryName: 'Travel'
      });

      const resA = await categoryRuleService.fetchUserRules('user-A');
      const resB = await categoryRuleService.fetchUserRules('user-B');

      assert.equal(resA.data.length, 1);
      assert.equal(resA.data[0].merchantPattern, 'Secret Vendor');

      assert.equal(resB.data.length, 1);
      assert.equal(resB.data[0].merchantPattern, 'Private Merchant');
    });

    it('replaces existing rule when user updates pattern rather than creating duplicate', async () => {
      await categoryRuleService.createUserRule('user-1', {
        merchantPattern: 'Zomato',
        categoryName: 'Food'
      });

      // User later chooses to categorize Zomato as Entertainment
      await categoryRuleService.createUserRule('user-1', {
        merchantPattern: 'Zomato',
        categoryName: 'Entertainment'
      });

      const res = await categoryRuleService.fetchUserRules('user-1');
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].categoryName, 'Entertainment');
    });

    it('deletes user rule cleanly', async () => {
      const { data: created } = await categoryRuleService.createUserRule('user-1', {
        merchantPattern: 'Temp Merchant',
        categoryName: 'Others'
      });

      const deleteRes = await categoryRuleService.deleteUserRule('user-1', created.id);
      assert.equal(deleteRes.success, true);

      const fetchRes = await categoryRuleService.fetchUserRules('user-1');
      assert.equal(fetchRes.data.length, 0);
    });
  });
});
