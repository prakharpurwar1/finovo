-- ==============================================================================
-- Finovo Phase 5C: User-Controlled Categorisation & Privacy Controls
-- Migration: 20261023160000_category_rules_enhancements.sql
-- 
-- Description:
-- 1. Enhances public.category_rules with:
--    - is_active: Allows user to toggle rules on/off without deletion.
--    - transaction_type: Scopes rules to 'expense', 'income', or 'all'.
-- 2. Enhances public.user_preferences with:
--    - ai_categorization_enabled: Allows users to disable AI categorisation globally.
-- 3. Strict Row Level Security (RLS) is preserved on all modified tables.
-- ==============================================================================

-- 1. Add is_active and transaction_type to category_rules
ALTER TABLE public.category_rules 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_rules_transaction_type_check'
  ) THEN
    ALTER TABLE public.category_rules 
      ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'all';
    
    ALTER TABLE public.category_rules 
      ADD CONSTRAINT category_rules_transaction_type_check 
      CHECK (transaction_type IN ('expense', 'income', 'all'));
  END IF;
END $$;

-- 2. Add ai_categorization_enabled to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS ai_categorization_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Ensure index exists for active user rules lookup
CREATE INDEX IF NOT EXISTS idx_category_rules_active 
  ON public.category_rules(user_id, is_active);

-- 4. Re-verify permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
