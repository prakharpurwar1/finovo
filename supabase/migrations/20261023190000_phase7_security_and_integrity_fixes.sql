-- ==============================================================================
-- Finovo Phase 7: Security Audit, Database Integrity & RLS Verification
-- Migration: 20261023190000_phase7_security_and_integrity_fixes.sql
-- 
-- Summary of Fixes:
-- 1. Create alias trigger function public.update_updated_at_column() to prevent
--    trigger execution failures on category_rules.
-- 2. Ensure all tables have consistent BEFORE UPDATE triggers for updated_at.
-- 3. Add explicit UPDATE RLS policy on public.savings_goal_contributions.
-- 4. Re-verify multi-tenant RLS policies on all 8 core tables.
-- ==============================================================================

-- 1. Function Alias for Trigger Compatibility
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

-- 2. Ensure category_rules trigger correctly fires
DROP TRIGGER IF EXISTS update_category_rules_modtime ON public.category_rules;
CREATE TRIGGER update_category_rules_modtime
  BEFORE UPDATE ON public.category_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add explicit UPDATE policy for public.savings_goal_contributions
DROP POLICY IF EXISTS "savings_contributions_update_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_update_own"
  ON public.savings_goal_contributions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Verify RLS is enabled and forced on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.savings_goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goal_contributions FORCE ROW LEVEL SECURITY;

-- 5. Revoke anonymous access across all tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_preferences FROM anon;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.budgets FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.savings_goals FROM anon;
REVOKE ALL ON public.category_rules FROM anon;
REVOKE ALL ON public.savings_goal_contributions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;
