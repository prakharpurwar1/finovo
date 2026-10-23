-- ==============================================================================
-- Finovo Phase 6: Budgets, Savings Goals & Contribution Tracking Schema
-- Migration: 20261023180000_phase6_budgets_savings_enhancements.sql
-- 
-- Description:
-- 1. Enhances public.budgets with category_name and uniqueness constraints.
-- 2. Creates public.savings_goal_contributions for auditable goal contributions.
-- 3. Enforces strict multi-tenant Row Level Security (RLS) via auth.uid().
-- ==============================================================================

-- 1. Enhance public.budgets
ALTER TABLE public.budgets 
  ADD COLUMN IF NOT EXISTS category_name TEXT;

-- Prevent duplicate budgets for the same user, category and period
CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_category_period
  ON public.budgets (user_id, COALESCE(category_name, '__GLOBAL__'), period);

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_budgets_user_period
  ON public.budgets (user_id, period);

-- 2. Create public.savings_goal_contributions table for auditable savings contributions
CREATE TABLE IF NOT EXISTS public.savings_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for contribution lookups
CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal 
  ON public.savings_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_user 
  ON public.savings_goal_contributions(user_id);

-- Enable and Force Row Level Security (RLS)
ALTER TABLE public.savings_goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goal_contributions FORCE ROW LEVEL SECURITY;

-- Revoke all permissions from anon / public
REVOKE ALL ON public.savings_goal_contributions FROM PUBLIC;
REVOKE ALL ON public.savings_goal_contributions FROM anon;

-- Grant permissions strictly to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goal_contributions TO authenticated;

-- RLS Policies for contributions: Authenticated user ownership only
DROP POLICY IF EXISTS "savings_contributions_select_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_select_own"
  ON public.savings_goal_contributions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_contributions_insert_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_insert_own"
  ON public.savings_goal_contributions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_contributions_delete_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_delete_own"
  ON public.savings_goal_contributions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
