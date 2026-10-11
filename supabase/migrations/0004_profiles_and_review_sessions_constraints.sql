-- =============================================================================
-- RMQR — Forward-Only Schema Fix: Profiles Foreign Key & Customer Review Sessions
-- Migration: 0004_profiles_and_review_sessions_constraints.sql
-- Safe to run on existing databases: Forward-only, idempotent DDL.
-- Does NOT drop tables, truncate data, or delete existing rows.
-- =============================================================================

-- 1. Safely drop auth.users foreign key constraint from public.profiles if present.
-- This allows hybrid session authentication where profiles may be created
-- with application-generated UUIDs or synced from RMQR session auth.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- 2. Ensure customer_review_sessions table exists with updated status constraint
-- Allowing 'started', 'drafts_generated', 'drafts_ready', 'copied', 'google_opened', 'completed'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_review_sessions'
  ) THEN
    -- Relax/update status check constraint to accept all application states
    ALTER TABLE public.customer_review_sessions
      DROP CONSTRAINT IF EXISTS customer_review_sessions_status_check;

    ALTER TABLE public.customer_review_sessions
      ADD CONSTRAINT customer_review_sessions_status_check
      CHECK (status IN ('started', 'drafts_generated', 'drafts_ready', 'copied', 'google_opened', 'completed'));
  END IF;
END $$;
