-- Step 1: Clean up existing duplicate treasury entries (keep most recent per expense_request_id)
WITH duplicates AS (
  SELECT id, expense_request_id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY expense_request_id 
      ORDER BY created_at DESC
    ) as rn
  FROM treasury_entries
  WHERE expense_request_id IS NOT NULL 
    AND status = 'posted' 
    AND entry_type = 'payment'
)
DELETE FROM treasury_entries 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Create unique partial index to prevent future duplicates
-- Ensures only ONE posted treasury payment entry can exist per expense request
CREATE UNIQUE INDEX IF NOT EXISTS unique_posted_treasury_payment_per_expense
ON treasury_entries (expense_request_id)
WHERE expense_request_id IS NOT NULL 
  AND status = 'posted' 
  AND entry_type = 'payment';