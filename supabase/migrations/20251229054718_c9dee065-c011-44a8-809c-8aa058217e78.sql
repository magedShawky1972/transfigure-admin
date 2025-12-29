-- Add sendodoo column to purpletransaction table
ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS sendodoo boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_purpletransaction_sendodoo ON public.purpletransaction(sendodoo);