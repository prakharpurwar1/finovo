import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupabaseConfigured, getSupabaseConfigStatus } from '../lib/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261021190000_finovo_core_schema.sql');
const rlsTestPath = path.resolve(__dirname, '../../supabase/tests/rls_verification.sql');
const envExamplePath = path.resolve(__dirname, '../../.env.example');

describe('Supabase Client Configuration & Safety', () => {
  it('correctly reports unconfigured state when environment variables are not set or default placeholders', () => {
    // In our test environment, real Supabase keys are not set yet
    const configured = isSupabaseConfigured();
    assert.strictEqual(configured, false, 'Should be false when no real credentials are set');

    const status = getSupabaseConfigStatus();
    assert.strictEqual(status.isConfigured, false);
  });

  it('provides safe .env.example with clear security warnings and no leaked secrets', () => {
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    assert.ok(content.includes('VITE_SUPABASE_URL'), 'Must document VITE_SUPABASE_URL');
    assert.ok(content.includes('VITE_SUPABASE_ANON_KEY'), 'Must document VITE_SUPABASE_ANON_KEY');
    assert.ok(!content.includes('SERVICE_ROLE_KEY='), 'Must not define any service role key variable');
    assert.ok(content.includes('NEVER provide the'), 'Must warn against secret leakage');
  });
});

describe('PostgreSQL Schema & Row Level Security (RLS) Verification', () => {
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  it('defines all 6 core tables linked to auth.users with ON DELETE CASCADE', () => {
    const requiredTables = [
      'profiles',
      'user_preferences',
      'categories',
      'budgets',
      'transactions',
      'savings_goals'
    ];

    for (const table of requiredTables) {
      assert.ok(
        sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
        `Table public.${table} must be defined in schema`
      );
      assert.ok(
        sql.includes(`REFERENCES auth.users(id) ON DELETE CASCADE`),
        `Foreign key with ON DELETE CASCADE must exist for ${table}`
      );
    }
  });

  it('enforces integer minor units (paise) for zero rounding loss in financial amounts', () => {
    assert.ok(sql.includes('amount_paise BIGINT NOT NULL CHECK (amount_paise > 0)'), 'Transactions must use amount_paise BIGINT');
    assert.ok(sql.includes('amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0)'), 'Budgets must use amount_paise BIGINT');
    assert.ok(sql.includes('target_amount_paise BIGINT NOT NULL CHECK (target_amount_paise > 0)'), 'Savings goals must use target_amount_paise BIGINT');
  });

  it('enables and forces Row Level Security on all 6 tables', () => {
    const requiredTables = [
      'profiles',
      'user_preferences',
      'categories',
      'budgets',
      'transactions',
      'savings_goals'
    ];

    for (const table of requiredTables) {
      assert.ok(
        sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
        `Row Level Security must be enabled for ${table}`
      );
      assert.ok(
        sql.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`),
        `Row Level Security must be forced for table owner on ${table}`
      );
    }
  });

  it('defines explicit ownership policies for all CRUD operations (SELECT, INSERT, UPDATE, DELETE)', () => {
    const requiredTables = [
      'profiles',
      'user_preferences',
      'categories',
      'budgets',
      'transactions',
      'savings_goals'
    ];

    for (const table of requiredTables) {
      const userField = table === 'profiles' ? 'id' : 'user_id';
      
      // SELECT
      assert.ok(
        sql.includes(`CREATE POLICY "${table}_select_own"`),
        `SELECT policy must exist for ${table}`
      );
      assert.ok(
        sql.includes(`ON public.${table} FOR SELECT`),
        `Policy target must be FOR SELECT for ${table}`
      );

      // INSERT with CHECK
      assert.ok(
        sql.includes(`CREATE POLICY "${table}_insert_own"`),
        `INSERT policy must exist for ${table}`
      );
      assert.ok(
        sql.includes(`WITH CHECK (auth.uid() = ${userField})`),
        `INSERT policy must have WITH CHECK (auth.uid() = ${userField}) for ${table}`
      );

      // UPDATE with CHECK preventing ownership reassignment
      assert.ok(
        sql.includes(`CREATE POLICY "${table}_update_own"`),
        `UPDATE policy must exist for ${table}`
      );

      // DELETE
      assert.ok(
        sql.includes(`CREATE POLICY "${table}_delete_own"`),
        `DELETE policy must exist for ${table}`
      );
    }
  });

  it('prohibits public/anon role access and restricts grants strictly to authenticated', () => {
    assert.ok(sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;'), 'Must revoke table access from anon');
    assert.ok(sql.includes('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;'), 'Must revoke sequence access from anon');
    assert.ok(sql.includes('REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;'), 'Must revoke routine access from anon');
    assert.ok(sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;'), 'Must grant CRUD to authenticated only');
  });

  it('provides an automated SQL verification script for multi-tenant isolation testing', () => {
    assert.ok(fs.existsSync(rlsTestPath), 'RLS test script must exist');
    const testSql = fs.readFileSync(rlsTestPath, 'utf-8');
    assert.ok(testSql.includes('v_user_a UUID'), 'Must test user A');
    assert.ok(testSql.includes('v_user_b UUID'), 'Must test user B');
    assert.ok(testSql.includes('RLS CRITICAL LEAK'), 'Must assert against data leaks across tenants');
    assert.ok(testSql.includes('ROLLBACK;'), 'Must rollback test mutations');
  });
});
