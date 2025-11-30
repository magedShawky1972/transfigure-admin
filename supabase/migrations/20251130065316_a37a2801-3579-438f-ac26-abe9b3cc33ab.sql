-- Make player_id nullable in ludo_transactions table
ALTER TABLE public.ludo_transactions ALTER COLUMN player_id DROP NOT NULL;