-- Step 1: Clean up duplicate shift_sessions
-- We keep only the most recently opened session per assignment and delete the rest.
-- First delete orphan children (those belonging to sessions we'll delete),
-- keeping only child rows of the canonical (kept) session.

WITH ranked AS (
  SELECT
    id,
    shift_assignment_id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_assignment_id
      ORDER BY opened_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.shift_sessions
),
to_delete_sessions AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.shift_brand_balances
WHERE shift_session_id IN (SELECT id FROM to_delete_sessions);

-- Delete duplicates from ludo_transactions
WITH ranked AS (
  SELECT
    id,
    shift_assignment_id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_assignment_id
      ORDER BY opened_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.shift_sessions
),
to_delete_sessions AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.ludo_transactions
WHERE shift_session_id IN (SELECT id FROM to_delete_sessions);

-- Now delete the duplicate session rows themselves
WITH ranked AS (
  SELECT
    id,
    shift_assignment_id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_assignment_id
      ORDER BY opened_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.shift_sessions
)
DELETE FROM public.shift_sessions s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Step 2: Add a UNIQUE constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_sessions_unique_assignment'
  ) THEN
    ALTER TABLE public.shift_sessions
      ADD CONSTRAINT shift_sessions_unique_assignment UNIQUE (shift_assignment_id);
  END IF;
END $$;