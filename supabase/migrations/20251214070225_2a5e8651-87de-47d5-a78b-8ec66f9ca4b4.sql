-- Add is_deleted column to purpletransaction table
ALTER TABLE public.purpletransaction 
ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;

-- Add index for filtering deleted transactions
CREATE INDEX idx_purpletransaction_is_deleted ON public.purpletransaction(is_deleted);