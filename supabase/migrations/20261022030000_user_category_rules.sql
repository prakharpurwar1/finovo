-- ==============================================================================
-- Finovo Smart Categorisation Rules Schema & Security Policies
-- Migration: 20261022030000_user_category_rules.sql
-- 
-- Description:
-- Creates public.category_rules for user-defined merchant categorisation rules.
-- Strict multi-tenant isolation via auth.uid() Row Level Security.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category_name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'contains', 'regex')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for speedy lookups by user_id
CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON public.category_rules(user_id);

-- Unique index to prevent duplicate conflicting patterns per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_rules_user_pattern 
  ON public.category_rules (user_id, LOWER(TRIM(merchant_pattern)));

-- Enable and Force Row Level Security (RLS)
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules FORCE ROW LEVEL SECURITY;

-- Revoke all permissions from anon / public
REVOKE ALL ON public.category_rules FROM PUBLIC;
REVOKE ALL ON public.category_rules FROM anon;

-- Grant authenticated user permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_rules TO authenticated;

-- RLS Policies
CREATE POLICY "category_rules_select_own"
  ON public.category_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "category_rules_insert_own"
  ON public.category_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "category_rules_update_own"
  ON public.category_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "category_rules_delete_own"
  ON public.category_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE TRIGGER update_category_rules_modtime
  BEFORE UPDATE ON public.category_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
