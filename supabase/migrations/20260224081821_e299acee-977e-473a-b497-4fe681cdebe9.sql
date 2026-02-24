-- Add per-line confirmation columns to receiving_coins_line
ALTER TABLE public.receiving_coins_line
ADD COLUMN is_confirmed boolean DEFAULT false,
ADD COLUMN confirmed_by text,
ADD COLUMN confirmed_by_name text,
ADD COLUMN confirmed_at timestamptz;