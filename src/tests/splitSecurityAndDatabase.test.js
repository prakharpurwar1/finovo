/**
 * Database Schema & Multi-Tenant Security Audit for Split Expense Management
 * Tests migration 20261025040000_split_expense_management.sql for:
 * - Proper table definitions & column constraints
 * - Strict Row Level Security (ENABLE & FORCE)
 * - Multi-tenant security definers
 * - Strict role restrictions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationFile = path.resolve(__dirname, '../../supabase/migrations/20261025040000_split_expense_management.sql');

describe('Split Expense Management Schema & RLS Audit', () => {
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  const splitTables = [
    'groups',
    'group_members',
    'split_expenses',
    'split_shares',
    'group_invitations',
    'settlements',
    'group_activities',
    'notifications',
    'notification_delivery_records'
  ];

  it('defines all 9 split and notification tables in migration', () => {
    for (const table of splitTables) {
      assert.ok(
        sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
        `Table public.${table} must be defined in migration`
      );
    }
  });

  it('enforces Row Level Security (ENABLE and FORCE) on all 9 tables', () => {
    for (const table of splitTables) {
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

  it('defines non-recursive security definer helper functions', () => {
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_group_member'), 'is_group_member function must exist');
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_group_admin'), 'is_group_admin function must exist');
    assert.ok(sql.includes('SECURITY DEFINER'), 'Helper functions must be SECURITY DEFINER');
  });

  it('enforces integer minor units (paise) for expenses and settlements', () => {
    assert.ok(sql.includes('amount_paise BIGINT NOT NULL CHECK (amount_paise > 0)'), 'split_expenses and settlements must use positive integer paise');
    assert.ok(sql.includes('allocated_share_paise BIGINT NOT NULL CHECK (allocated_share_paise >= 0)'), 'split_shares must use integer paise');
  });

  it('revokes public/anon access and explicitly grants permissions to authenticated role', () => {
    for (const table of splitTables) {
      assert.ok(sql.includes(`REVOKE ALL ON public.${table} FROM PUBLIC;`), `Must revoke public from ${table}`);
      assert.ok(sql.includes(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated;`), `Must grant authenticated on ${table}`);
    }
  });
});
