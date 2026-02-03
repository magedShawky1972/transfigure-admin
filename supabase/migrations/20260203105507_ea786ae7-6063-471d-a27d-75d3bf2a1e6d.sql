-- Add unique constraint on ordernumber column for upsert support
ALTER TABLE public.purpletransaction 
ADD CONSTRAINT purpletransaction_ordernumber_unique UNIQUE (ordernumber);