-- Add missing columns to purpletransaction table for sales header data
ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS ordernumber TEXT,
ADD COLUMN IF NOT EXISTS payment_term TEXT,
ADD COLUMN IF NOT EXISTS transaction_type TEXT,
ADD COLUMN IF NOT EXISTS media TEXT,
ADD COLUMN IF NOT EXISTS profit_center TEXT,
ADD COLUMN IF NOT EXISTS status INTEGER,
ADD COLUMN IF NOT EXISTS status_description TEXT,
ADD COLUMN IF NOT EXISTS register_user_id INTEGER,
ADD COLUMN IF NOT EXISTS player_id TEXT,
ADD COLUMN IF NOT EXISTS is_point BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS point_value NUMERIC;

-- Create index on ordernumber for upsert performance
CREATE INDEX IF NOT EXISTS idx_purpletransaction_ordernumber ON public.purpletransaction(ordernumber);