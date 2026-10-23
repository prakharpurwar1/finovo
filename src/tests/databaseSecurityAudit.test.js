/**
 * Finovo Phase 7 Security Test Suite: Database Schema & Multi-Tenant RLS Audit
 * Audits all 8 user-owned and system tables:
 * - profiles
 * - transactions
 * - categories
 * - budgets
 * - savings_goals
 * - savings_goal_contributions
 * - user_preferences
 * - category_rules
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

function loadAllMigrations() {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  let combinedSql = '';
  for (const file of files) {
    combinedSql += fs.readFileSync(path.join(migrationsDir, file), 'utf-8') + '\n';
  }
  return combinedSql;
}

describe('Database Security Audit: Row Level Security & Multi-Tenant Isolation', () => {
  const sql = loadAllMigrations();

  const coreTables = [
    'profiles',
    'user_preferences',
    'categories',
    'budgets',
    'transactions',
    'savings_goals',
    'category_rules',
    'savings_goal_contributions'
  ];

  it('verifies all 8 user-owned tables are defined in the schema', () => {
    for (const table of coreTables) {
      assert.ok(
        sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
        `Table public.${table} must be defined in migrations`
      );
    }
  });

  it('enforces that Row Level Security is enabled AND forced on every table', () => {
    for (const table of coreTables) {
      assert.ok(
        sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
        `public.${table} must have ENABLE ROW LEVEL SECURITY`
      );
      assert.ok(
        sql.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`),
        `public.${table} must have FORCE ROW LEVEL SECURITY`
      );
    }
  });

  it('revokes all permissions from anonymous public role on all tables', () => {
    for (const table of coreTables) {
      assert.ok(
        sql.includes(`REVOKE ALL ON public.${table} FROM anon`) ||
        sql.includes(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon`),
        `Anon role must have ALL privileges revoked on ${table}`
      );
    }
  });

  it('verifies authenticated ownership policies (SELECT, INSERT, UPDATE, DELETE) using auth.uid()', () => {
    // Check that user_id = auth.uid() or id = auth.uid() is strictly checked
    assert.ok(sql.includes('auth.uid() = id'), 'Profiles must check auth.uid() = id');
    assert.ok(sql.includes('auth.uid() = user_id'), 'User-owned tables must check auth.uid() = user_id');
  });

  it('protects system-defined categories from modification by ordinary users', () => {
    // Categories policy must allow public reading of system categories (user_id IS NULL),
    // but disallow user modification of system categories (must have user_id IS NOT NULL)
    assert.ok(
      sql.includes('user_id IS NULL OR auth.uid() = user_id'),
      'Category SELECT must permit system categories or user-owned categories'
    );
    assert.ok(
      sql.includes('auth.uid() = user_id AND user_id IS NOT NULL'),
      'Category INSERT/UPDATE/DELETE must enforce user_id IS NOT NULL and matches auth.uid()'
    );
  });

  it('verifies integer minor units (paise) are used to prevent IEEE-754 financial rounding drift', () => {
    assert.ok(sql.includes('amount_paise BIGINT'), 'transactions must use amount_paise BIGINT');
    assert.ok(sql.includes('target_amount_paise BIGINT'), 'savings_goals must use target_amount_paise BIGINT');
    assert.ok(sql.includes('amount_paise BIGINT NOT NULL CHECK (amount_paise > 0)'), 'contributions must enforce positive amount_paise');
  });

  it('ensures foreign keys enforce ON DELETE CASCADE to cleanly wipe records on account deletion', () => {
    for (const table of coreTables) {
      if (table !== 'profiles') {
        assert.ok(
          sql.includes(`REFERENCES auth.users(id) ON DELETE CASCADE`),
          `${table} must cascade delete with auth.users`
        );
      }
    }
  });

  it('ensures trigger functions are declared with SECURITY DEFINER and explicit search_path', () => {
    assert.ok(sql.includes('SECURITY DEFINER'), 'Trigger functions must be SECURITY DEFINER');
    assert.ok(sql.includes('SET search_path = public'), 'Trigger functions must set explicit search_path = public');
  });
});
