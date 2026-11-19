ALTER TABLE public.api_consumption_logs
  ADD COLUMN IF NOT EXISTS retry_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_by UUID;

COMMENT ON COLUMN public.api_consumption_logs.retry_started_at IS 'Set while an admin-only KOON manual retry is in progress; cleared when the delivery result is recorded.';
COMMENT ON COLUMN public.api_consumption_logs.last_retry_at IS 'Most recent manual KOON retry attempt time.';
COMMENT ON COLUMN public.api_consumption_logs.last_retry_by IS 'User ID of the administrator who most recently retried the KOON delivery.';