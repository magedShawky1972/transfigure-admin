-- Ensure approval chain starts from admin_order = 0
ALTER TABLE public.tickets
  ALTER COLUMN next_admin_order SET DEFAULT 0;

COMMENT ON COLUMN public.tickets.next_admin_order IS 'Tracks which admin_order level should approve next (0 for first admin, 1 for second, etc.)';

-- Fix the specific tickets reported as stuck so first-level admin (order 0) can approve
UPDATE public.tickets
SET next_admin_order = 0
WHERE ticket_number IN (
  'TKT-20260122-0126',
  'TKT-20260120-0123',
  'TKT-20260119-0120',
  'TKT-20251224-0092',
  'TKT-20251222-0087',
  'TKT-20251215-0070',
  'TKT-20251208-0048'
)
AND status = 'Open'
AND (approved_at IS NULL);
