-- Add is_api_reviewed column to purpletransaction table
ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS is_api_reviewed BOOLEAN DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.purpletransaction.is_api_reviewed IS 'Indicates if API-inserted transactions have been reviewed. API inserts set this to false, manual review sets to true.';

-- Create index for filtering unreviewed API transactions
CREATE INDEX IF NOT EXISTS idx_purpletransaction_api_reviewed 
ON public.purpletransaction(is_api_reviewed) 
WHERE is_api_reviewed = false;