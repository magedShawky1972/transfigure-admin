-- Add unique constraint on txn_number for upsert functionality
ALTER TABLE public.riyadbankstatement 
ADD CONSTRAINT riyadbankstatement_txn_number_key UNIQUE (txn_number);