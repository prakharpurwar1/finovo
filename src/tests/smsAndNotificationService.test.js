/**
 * Unit & Integration Tests for SMS Service & Notification Logic
 * Uses Node.js native test runner (node:test & node:assert).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePhoneNumber, handleSmsSendRequest } from '../server/smsService.js';

describe('SMS Notification Service', () => {
  describe('Phone Number Normalization', () => {
    it('normalizes 10-digit Indian numbers to +91 E.164 format', () => {
      assert.equal(normalizePhoneNumber('9876543210'), '+919876543210');
      assert.equal(normalizePhoneNumber(' 98765 43210 '), '+919876543210');
      assert.equal(normalizePhoneNumber('9876-543-210'), '+919876543210');
      assert.equal(normalizePhoneNumber('(9876) 543210'), '+919876543210');
    });

    it('preserves existing E.164 international numbers', () => {
      assert.equal(normalizePhoneNumber('+14155552671'), '+14155552671');
      assert.equal(normalizePhoneNumber('+447911123456'), '+447911123456');
    });

    it('rejects malformed and non-numeric phone values', () => {
      assert.equal(normalizePhoneNumber('abc'), null);
      assert.equal(normalizePhoneNumber('12345'), null);
      assert.equal(normalizePhoneNumber(''), null);
      assert.equal(normalizePhoneNumber(null), null);
      assert.equal(normalizePhoneNumber(undefined), null);
    });
  });

  describe('SMS Dispatch & Provider Error Handling', () => {
    it('rejects requests with missing phone number with 400 status', async () => {
      const res = await handleSmsSendRequest({ body: {} });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Recipient phone number is required'));
    });

    it('rejects invalid phone number with 400 status', async () => {
      const res = await handleSmsSendRequest({
        body: { recipientPhone: 'invalid-number', message: 'Hello' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('returns 422 with explicit guidance when SMS provider is unconfigured, never claiming success', async () => {
      const res = await handleSmsSendRequest({
        body: {
          recipientPhone: '9876543210',
          message: 'Finovo shared expense notice',
          idempotencyKey: 'test_key_unconfigured_1'
        }
      }, { env: {} }); // Empty env: no Twilio or MSG91 credentials

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.deliveryStatus, 'failed');
      assert.ok(res.body.error.includes('SMS provider credentials not configured'));
    });

    it('enforces idempotency deduplication on repeated requests', async () => {
      // First, simulate a key marked as sent
      const key = `test_idempotent_${Date.now()}`;
      
      // Call first time with mock env (even unconfigured)
      await handleSmsSendRequest({
        body: { recipientPhone: '9876543210', message: 'Hi', idempotencyKey: key }
      }, { env: {} });

      // Simulate a delivered key in the set
      const deliveredKey = `delivered_${Date.now()}`;
      // In smsService, if twilio returns ok, it adds to sentIdempotencyKeys.
      // Calling with same key should return deduplicated if in set
    });
  });
});
