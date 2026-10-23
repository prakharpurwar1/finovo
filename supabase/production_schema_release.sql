-- ==============================================================================
-- Finovo: Complete Production Database Schema & Security Release
-- Target Engine: Supabase PostgreSQL 15+
-- Version: Production 1.0.2 (Phase 8 Release - Self-Healing & Reconciliation)
--
-- This script is completely IDEMPOTENT. It can be run safely on a fresh Supabase
-- project or an existing project without destroying genuine data.
-- Automatically reconciles legacy columns and removes stale duplicate test rows.
--
-- Tables Provisioned & Upgraded:
-- 1. public.profiles (1:1 with auth.users)
-- 2. public.user_preferences (User configuration & AI settings)
-- 3. public.categories (Default system categories & custom user categories)
-- 4. public.budgets (Monthly global & category spending limits)
-- 5. public.transactions (Ledger records with integer paise precision)
-- 6. public.savings_goals (Goal targets with target dates & progress)
-- 7. public.category_rules (Smart user-defined categorization rules)
-- 8. public.savings_goal_contributions (Auditable contributions ledger)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Timestamp Triggers & Security Definer Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
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

-- Alias function for trigger compatibility
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

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  avatar_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.user_preferences
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'INR',
  sms_permission TEXT NOT NULL DEFAULT 'Not Requested',
  categorization_preference TEXT NOT NULL DEFAULT 'instant',
  ai_categorization_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('dark', 'light', 'system')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gender TEXT DEFAULT 'neutral',
  avatar_style TEXT DEFAULT 'avatar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS sms_permission TEXT NOT NULL DEFAULT 'Not Requested';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS categorization_preference TEXT NOT NULL DEFAULT 'instant';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS ai_categorization_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'neutral';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS avatar_style TEXT DEFAULT 'avatar';

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Deduplicate any duplicate categories with identical name per user, preserving the newest record
DELETE FROM public.categories c1
USING public.categories c2
WHERE COALESCE(c1.user_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(c2.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND c1.name = c2.name
  AND (
    c1.updated_at < c2.updated_at 
    OR (c1.updated_at = c2.updated_at AND c1.created_at < c2.created_at)
    OR (c1.updated_at = c2.updated_at AND c1.created_at = c2.created_at AND c1.id < c2.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name_idx 
  ON public.categories (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.budgets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  category_name TEXT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
  month DATE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Ensure newly required columns exist on pre-existing tables before creating indexes
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS month DATE;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Auto-populate category_name for legacy budgets that only had category_id set
UPDATE public.budgets b
SET category_name = c.name
FROM public.categories c
WHERE b.category_id = c.id
  AND b.category_name IS NULL;

-- Deduplicate any duplicate budgets for the same user, category, and period, keeping the most recent entry
DELETE FROM public.budgets b1
USING public.budgets b2
WHERE b1.user_id = b2.user_id
  AND COALESCE(b1.category_name, '__GLOBAL__') = COALESCE(b2.category_name, '__GLOBAL__')
  AND b1.period = b2.period
  AND (
    b1.updated_at < b2.updated_at 
    OR (b1.updated_at = b2.updated_at AND b1.created_at < b2.created_at)
    OR (b1.updated_at = b2.updated_at AND b1.created_at = b2.created_at AND b1.id < b2.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_category_period
  ON public.budgets (user_id, COALESCE(category_name, '__GLOBAL__'), period);

CREATE INDEX IF NOT EXISTS idx_budgets_user_period
  ON public.budgets (user_id, period);

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.transactions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  merchant TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'Uncategorized',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  payment_method TEXT DEFAULT 'UPI',
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  import_metadata JSONB,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_name TEXT NOT NULL DEFAULT 'Uncategorized';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS time TIME NOT NULL DEFAULT CURRENT_TIME;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'UPI';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_metadata JSONB;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(user_id, category_id);

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABLE: public.savings_goals
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount_paise BIGINT NOT NULL CHECK (target_amount_paise > 0),
  current_amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (current_amount_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  target_date DATE,
  category TEXT DEFAULT 'general',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON public.savings_goals(user_id);

DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON public.savings_goals;
CREATE TRIGGER trg_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. TABLE: public.category_rules
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category_name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'contains', 'regex')),
  transaction_type TEXT NOT NULL DEFAULT 'all' CHECK (transaction_type IN ('expense', 'income', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'exact';
ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_rules_transaction_type_check'
  ) THEN
    ALTER TABLE public.category_rules 
      ADD CONSTRAINT category_rules_transaction_type_check 
      CHECK (transaction_type IN ('expense', 'income', 'all'));
  END IF;
END $$;

-- Deduplicate any duplicate category rules with identical pattern per user
DELETE FROM public.category_rules r1
USING public.category_rules r2
WHERE r1.user_id = r2.user_id
  AND LOWER(TRIM(r1.merchant_pattern)) = LOWER(TRIM(r2.merchant_pattern))
  AND (
    r1.updated_at < r2.updated_at 
    OR (r1.updated_at = r2.updated_at AND r1.created_at < r2.created_at)
    OR (r1.updated_at = r2.updated_at AND r1.created_at = r2.created_at AND r1.id < r2.id)
  );

CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON public.category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_active ON public.category_rules(user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_rules_user_pattern 
  ON public.category_rules (user_id, LOWER(TRIM(merchant_pattern)));

DROP TRIGGER IF EXISTS update_category_rules_modtime ON public.category_rules;
CREATE TRIGGER update_category_rules_modtime
  BEFORE UPDATE ON public.category_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. TABLE: public.savings_goal_contributions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.savings_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON public.savings_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_user ON public.savings_goal_contributions(user_id);

-- ------------------------------------------------------------------------------
-- 10. AUTH TRIGGER: Auto-Provision Profile & Defaults on Registration
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, preferred_currency, timezone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'INR',
    'Asia/Kolkata'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id, currency, sms_permission, categorization_preference, theme_mode, notifications_enabled)
  VALUES (NEW.id, 'INR', 'Not Requested', 'instant', 'dark', TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.categories (user_id, name, icon, color, type, is_system)
  VALUES
    (NEW.id, 'Food & Dining', 'Utensils', 'amber', 'expense', FALSE),
    (NEW.id, 'Groceries', 'ShoppingBag', 'emerald', 'expense', FALSE),
    (NEW.id, 'Transport', 'Car', 'indigo', 'expense', FALSE),
    (NEW.id, 'Entertainment', 'Film', 'rose', 'expense', FALSE),
    (NEW.id, 'Bills & Utilities', 'FileText', 'orange', 'expense', FALSE),
    (NEW.id, 'Shopping', 'Tag', 'purple', 'expense', FALSE),
    (NEW.id, 'Health & Wellness', 'Heart', 'cyan', 'expense', FALSE),
    (NEW.id, 'Salary / Income', 'TrendingUp', 'green', 'income', FALSE)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES — STRICT MULTI-TENANT ISOLATION
-- ------------------------------------------------------------------------------
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

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Preferences Policies
DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete_own" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Categories Policies
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
CREATE POLICY "categories_select_own" ON public.categories FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id AND user_id IS NOT NULL) WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Budgets Policies
DROP POLICY IF EXISTS "budgets_select_own" ON public.budgets;
CREATE POLICY "budgets_select_own" ON public.budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_insert_own" ON public.budgets;
CREATE POLICY "budgets_insert_own" ON public.budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_update_own" ON public.budgets;
CREATE POLICY "budgets_update_own" ON public.budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_delete_own" ON public.budgets;
CREATE POLICY "budgets_delete_own" ON public.budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Savings Goals Policies
DROP POLICY IF EXISTS "savings_goals_select_own" ON public.savings_goals;
CREATE POLICY "savings_goals_select_own" ON public.savings_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_goals_insert_own" ON public.savings_goals;
CREATE POLICY "savings_goals_insert_own" ON public.savings_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_goals_update_own" ON public.savings_goals;
CREATE POLICY "savings_goals_update_own" ON public.savings_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_goals_delete_own" ON public.savings_goals;
CREATE POLICY "savings_goals_delete_own" ON public.savings_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Category Rules Policies
DROP POLICY IF EXISTS "category_rules_select_own" ON public.category_rules;
CREATE POLICY "category_rules_select_own" ON public.category_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "category_rules_insert_own" ON public.category_rules;
CREATE POLICY "category_rules_insert_own" ON public.category_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "category_rules_update_own" ON public.category_rules;
CREATE POLICY "category_rules_update_own" ON public.category_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "category_rules_delete_own" ON public.category_rules;
CREATE POLICY "category_rules_delete_own" ON public.category_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Savings Contributions Policies
DROP POLICY IF EXISTS "savings_contributions_select_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_select_own" ON public.savings_goal_contributions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_contributions_insert_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_insert_own" ON public.savings_goal_contributions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_contributions_update_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_update_own" ON public.savings_goal_contributions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "savings_contributions_delete_own" ON public.savings_goal_contributions;
CREATE POLICY "savings_contributions_delete_own" ON public.savings_goal_contributions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 12. ROLE PERMISSION RESTRICTIONS
-- Strip all privileges from anonymous public role. Grant access strictly to authenticated.
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;

COMMIT;
