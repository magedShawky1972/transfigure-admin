-- Add link column to tickets table for external URLs (Amazon, etc.)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS external_link TEXT;