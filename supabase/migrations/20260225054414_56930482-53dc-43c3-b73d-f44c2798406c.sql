
-- Add extra approval tracking columns to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS extra_approval_user_id UUID;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS extra_approval_status TEXT DEFAULT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS extra_approval_sent_by UUID;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS extra_approval_responded_at TIMESTAMPTZ;

-- extra_approval_status can be: 'pending', 'approved', 'rejected', or NULL (no extra approval requested)
