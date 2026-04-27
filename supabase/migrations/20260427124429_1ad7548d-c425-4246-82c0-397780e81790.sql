
-- Add advanced fields to integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS latency_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_quota integer,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_label text NOT NULL DEFAULT 'restricted',
  ADD COLUMN IF NOT EXISTS access_summary text,
  ADD COLUMN IF NOT EXISTS usage_history integer[] NOT NULL DEFAULT '{}'::integer[];

-- Allow non-admins to toggle favorite? Keep admin-only since current policies are admin-only. No change needed.
