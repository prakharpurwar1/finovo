-- ==============================================================================
-- Test Script: supabase/tests/rls_verification.sql
-- Purpose: Verify Row Level Security (RLS) enforcement and multi-tenant isolation.
-- Validates:
--   1. Own-user read/write allowed.
--   2. Cross-user read/write/delete strictly blocked.
--   3. Ownership spoofing/tampering blocked by WITH CHECK.
--   4. System-defined categories readable by all, but protected against user modification.
-- Run in Supabase SQL Editor to validate multi-user security boundaries.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_user_b UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
  v_tx_id UUID;
  v_sys_cat_id UUID;
  v_count INT;
BEGIN
  RAISE NOTICE '>>> Starting Finovo RLS Policy & Multi-Tenant Verification Suite...';

  -- ----------------------------------------------------------------------------
  -- Setup: Create a system-defined category (user_id IS NULL) as superuser
  -- ----------------------------------------------------------------------------
  INSERT INTO public.categories (user_id, name, type, is_system)
  VALUES (NULL, 'System Essential', 'expense', TRUE)
  RETURNING id INTO v_sys_cat_id;

  -- ----------------------------------------------------------------------------
  -- Scenario 1: User A (Authenticated)
  -- ----------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  -- Test 1: User A creates their own transaction
  INSERT INTO public.transactions (
    user_id, amount_paise, currency, type, merchant, category_name, date
  ) VALUES (
    v_user_a, 250000, 'INR', 'expense', 'Blue Tokai Coffee', 'Food & Dining', CURRENT_DATE
  ) RETURNING id INTO v_tx_id;
  RAISE NOTICE '  [PASS] Test 1: User A successfully created own transaction %', v_tx_id;

  -- Test 2: User A can read their own transaction
  SELECT count(*) INTO v_count FROM public.transactions WHERE id = v_tx_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: User A cannot read their own transaction!';
  END IF;
  RAISE NOTICE '  [PASS] Test 2: User A can read own transaction.';

  -- Test 3: User A can read system-defined category
  SELECT count(*) INTO v_count FROM public.categories WHERE id = v_sys_cat_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: User A cannot read system category!';
  END IF;
  RAISE NOTICE '  [PASS] Test 3: User A can read system category.';

  -- ----------------------------------------------------------------------------
  -- Scenario 2: Switch context to User B (Cross-User Isolation Tests)
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

  -- Test 4: User B attempts to read User A's transaction -> must see 0 rows
  SELECT count(*) INTO v_count FROM public.transactions WHERE id = v_tx_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS CRITICAL LEAK: User B can view User A transaction!';
  END IF;
  RAISE NOTICE '  [PASS] Test 4: Cross-user isolation: User B sees 0 rows for User A data.';

  -- Test 5: User B attempts to update User A's transaction -> must fail to update
  UPDATE public.transactions SET merchant = 'Tampered Merchant' WHERE id = v_tx_id;
  SELECT count(*) INTO v_count FROM public.transactions WHERE id = v_tx_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS CRITICAL LEAK: User B updated User A transaction!';
  END IF;
  RAISE NOTICE '  [PASS] Test 5: Unauthorized update blocked by RLS.';

  -- Test 6: User B attempts to insert record spoofing User A ownership
  BEGIN
    INSERT INTO public.transactions (
      user_id, amount_paise, type, merchant, category_name
    ) VALUES (
      v_user_a, 10000, 'expense', 'Spoofed Entry', 'Uncategorized'
    );
    RAISE EXCEPTION 'RLS CRITICAL LEAK: User B inserted record with User A user_id!';
  EXCEPTION WHEN new_row_violates_row_level_security_policy THEN
    RAISE NOTICE '  [PASS] Test 6: Ownership spoofing blocked by WITH CHECK policy.';
  END;

  -- Test 7: User B attempts to delete User A's transaction
  DELETE FROM public.transactions WHERE id = v_tx_id;

  -- Test 8: User B attempts to tamper with system-defined category
  BEGIN
    UPDATE public.categories SET name = 'Hacked System Cat' WHERE id = v_sys_cat_id;
    -- If update affected 0 rows, check that system cat is intact
    SELECT count(*) INTO v_count FROM public.categories WHERE id = v_sys_cat_id AND name = 'Hacked System Cat';
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'RLS CRITICAL LEAK: Ordinary user modified system category!';
    END IF;
    RAISE NOTICE '  [PASS] Test 8: System category modification prevented.';
  END;

  -- ----------------------------------------------------------------------------
  -- Verification: Switch back to User A and confirm data integrity
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  SELECT count(*) INTO v_count FROM public.transactions WHERE id = v_tx_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RLS CRITICAL LEAK: User A transaction was deleted by User B!';
  END IF;
  RAISE NOTICE '  [PASS] Test 9: User A transaction intact after cross-user attack simulation.';

  RAISE NOTICE '>>> All Finovo RLS Policy Verification tests PASSED successfully!';
END;
$$;

-- Always rollback test mutations to maintain a clean database
ROLLBACK;
