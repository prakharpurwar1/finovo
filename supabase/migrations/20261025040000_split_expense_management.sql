-- ==============================================================================
-- Migration: 20261025040000_split_expense_management.sql
-- Description: Comprehensive End-to-End Split Expense Management Schema & RLS
-- Target: Supabase PostgreSQL 15+
-- ==============================================================================

BEGIN;


-- ------------------------------------------------------------------------------
-- 1. TABLE: public.groups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Users',
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_groups_creator ON public.groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_groups_archived ON public.groups(is_archived);

DROP TRIGGER IF EXISTS trg_groups_updated_at ON public.groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.group_members
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'declined', 'removed')),
  invitation_token_hash TEXT,
  invitation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_token ON public.group_members(invitation_token_hash);

DROP TRIGGER IF EXISTS trg_group_members_updated_at ON public.group_members;
CREATE TRIGGER trg_group_members_updated_at
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.split_expenses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.split_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payer_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  split_method TEXT NOT NULL DEFAULT 'equal' CHECK (split_method IN ('equal', 'unequal', 'percentage')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_split_expenses_group ON public.split_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_split_expenses_creator ON public.split_expenses(creator_id);
CREATE INDEX IF NOT EXISTS idx_split_expenses_payer ON public.split_expenses(payer_member_id);

DROP TRIGGER IF EXISTS trg_split_expenses_updated_at ON public.split_expenses;
CREATE TRIGGER trg_split_expenses_updated_at
  BEFORE UPDATE ON public.split_expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.split_shares
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.split_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.split_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  allocated_share_paise BIGINT NOT NULL CHECK (allocated_share_paise >= 0),
  share_percentage NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_split_shares_expense ON public.split_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_split_shares_member ON public.split_shares(member_id);

DROP TRIGGER IF EXISTS trg_split_shares_updated_at ON public.split_shares;
CREATE TRIGGER trg_split_shares_updated_at
  BEFORE UPDATE ON public.split_shares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.group_invitations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  recipient_email TEXT,
  recipient_phone TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON public.group_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON public.group_invitations(group_id);

DROP TRIGGER IF EXISTS trg_group_invitations_updated_at ON public.group_invitations;
CREATE TRIGGER trg_group_invitations_updated_at
  BEFORE UPDATE ON public.group_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.settlements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE RESTRICT,
  recipient_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_settlements_group ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payer ON public.settlements(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_recipient ON public.settlements(recipient_member_id);

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON public.settlements;
CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABLE: public.group_activities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  amount_paise BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_group_activities_group ON public.group_activities(group_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. TABLE: public.notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.split_expenses(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. TABLE: public.notification_delivery_records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_delivery_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'push')),
  provider TEXT NOT NULL DEFAULT 'system',
  recipient_contact TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('delivered', 'pending', 'failed', 'opted_out')),
  attempt_count INT NOT NULL DEFAULT 1,
  provider_ref TEXT,
  last_error TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_delivery_records_status ON public.notification_delivery_records(delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_records_idempotency ON public.notification_delivery_records(idempotency_key);

DROP TRIGGER IF EXISTS trg_delivery_records_updated_at ON public.notification_delivery_records;
CREATE TRIGGER trg_delivery_records_updated_at
  BEFORE UPDATE ON public.notification_delivery_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 10. Helper Security Definer Functions (avoids recursive RLS policies)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id 
      AND gm.user_id = p_user_id
      AND gm.status = 'active'
  ) OR EXISTS (
    SELECT 1 
    FROM public.groups g
    WHERE g.id = p_group_id 
      AND g.creator_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.groups g
    WHERE g.id = p_group_id 
      AND g.creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id 
      AND gm.user_id = p_user_id
      AND gm.role = 'admin'
      AND gm.status = 'active'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups FORCE ROW LEVEL SECURITY;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_expenses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.split_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_shares FORCE ROW LEVEL SECURITY;

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.group_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notification_delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_records FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- groups policies
DROP POLICY IF EXISTS "groups_select_policy" ON public.groups;
CREATE POLICY "groups_select_policy" ON public.groups
  FOR SELECT USING (creator_id = auth.uid() OR public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "groups_insert_policy" ON public.groups;
CREATE POLICY "groups_insert_policy" ON public.groups
  FOR INSERT WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "groups_update_policy" ON public.groups;
CREATE POLICY "groups_update_policy" ON public.groups
  FOR UPDATE USING (public.is_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "groups_delete_policy" ON public.groups;
CREATE POLICY "groups_delete_policy" ON public.groups
  FOR DELETE USING (creator_id = auth.uid());

-- group_members policies
DROP POLICY IF EXISTS "group_members_select_policy" ON public.group_members;
CREATE POLICY "group_members_select_policy" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_members_insert_policy" ON public.group_members;
CREATE POLICY "group_members_insert_policy" ON public.group_members
  FOR INSERT WITH CHECK (public.is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_members_update_policy" ON public.group_members;
CREATE POLICY "group_members_update_policy" ON public.group_members
  FOR UPDATE USING (public.is_group_admin(group_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "group_members_delete_policy" ON public.group_members;
CREATE POLICY "group_members_delete_policy" ON public.group_members
  FOR DELETE USING (public.is_group_admin(group_id, auth.uid()));

-- split_expenses policies
DROP POLICY IF EXISTS "split_expenses_select_policy" ON public.split_expenses;
CREATE POLICY "split_expenses_select_policy" ON public.split_expenses
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "split_expenses_insert_policy" ON public.split_expenses;
CREATE POLICY "split_expenses_insert_policy" ON public.split_expenses
  FOR INSERT WITH CHECK (creator_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "split_expenses_update_policy" ON public.split_expenses;
CREATE POLICY "split_expenses_update_policy" ON public.split_expenses
  FOR UPDATE USING (creator_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "split_expenses_delete_policy" ON public.split_expenses;
CREATE POLICY "split_expenses_delete_policy" ON public.split_expenses
  FOR DELETE USING (creator_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- split_shares policies
DROP POLICY IF EXISTS "split_shares_select_policy" ON public.split_shares;
CREATE POLICY "split_shares_select_policy" ON public.split_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.split_expenses se
      WHERE se.id = expense_id AND public.is_group_member(se.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "split_shares_insert_policy" ON public.split_shares;
CREATE POLICY "split_shares_insert_policy" ON public.split_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.split_expenses se
      WHERE se.id = expense_id AND (se.creator_id = auth.uid() OR public.is_group_admin(se.group_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "split_shares_update_policy" ON public.split_shares;
CREATE POLICY "split_shares_update_policy" ON public.split_shares
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.split_expenses se
      WHERE se.id = expense_id AND (se.creator_id = auth.uid() OR public.is_group_admin(se.group_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "split_shares_delete_policy" ON public.split_shares;
CREATE POLICY "split_shares_delete_policy" ON public.split_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.split_expenses se
      WHERE se.id = expense_id AND (se.creator_id = auth.uid() OR public.is_group_admin(se.group_id, auth.uid()))
    )
  );

-- group_invitations policies
DROP POLICY IF EXISTS "group_invitations_select_policy" ON public.group_invitations;
CREATE POLICY "group_invitations_select_policy" ON public.group_invitations
  FOR SELECT USING (inviter_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_invitations_insert_policy" ON public.group_invitations;
CREATE POLICY "group_invitations_insert_policy" ON public.group_invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid() AND public.is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_invitations_update_policy" ON public.group_invitations;
CREATE POLICY "group_invitations_update_policy" ON public.group_invitations
  FOR UPDATE USING (inviter_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()) OR accepted_user_id = auth.uid());

-- settlements policies
DROP POLICY IF EXISTS "settlements_select_policy" ON public.settlements;
CREATE POLICY "settlements_select_policy" ON public.settlements
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "settlements_insert_policy" ON public.settlements;
CREATE POLICY "settlements_insert_policy" ON public.settlements
  FOR INSERT WITH CHECK (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "settlements_update_policy" ON public.settlements;
CREATE POLICY "settlements_update_policy" ON public.settlements
  FOR UPDATE USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- group_activities policies
DROP POLICY IF EXISTS "group_activities_select_policy" ON public.group_activities;
CREATE POLICY "group_activities_select_policy" ON public.group_activities
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_activities_insert_policy" ON public.group_activities;
CREATE POLICY "group_activities_insert_policy" ON public.group_activities
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- notifications policies (strictly multi-tenant isolated to recipient)
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT WITH CHECK (actor_id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- notification_delivery_records policies
DROP POLICY IF EXISTS "delivery_records_select_policy" ON public.notification_delivery_records;
CREATE POLICY "delivery_records_select_policy" ON public.notification_delivery_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.id = notification_id AND n.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_records_insert_policy" ON public.notification_delivery_records;
CREATE POLICY "delivery_records_insert_policy" ON public.notification_delivery_records
  FOR INSERT WITH CHECK (true);

-- Explicitly revoke public access and grant to authenticated
REVOKE ALL ON public.groups FROM PUBLIC;
REVOKE ALL ON public.group_members FROM PUBLIC;
REVOKE ALL ON public.split_expenses FROM PUBLIC;
REVOKE ALL ON public.split_shares FROM PUBLIC;
REVOKE ALL ON public.group_invitations FROM PUBLIC;
REVOKE ALL ON public.settlements FROM PUBLIC;
REVOKE ALL ON public.group_activities FROM PUBLIC;
REVOKE ALL ON public.notifications FROM PUBLIC;
REVOKE ALL ON public.notification_delivery_records FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_delivery_records TO authenticated;

COMMIT;
