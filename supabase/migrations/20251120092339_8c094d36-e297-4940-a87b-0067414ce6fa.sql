-- Add soft delete columns to tickets table
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Create index for better query performance on deleted tickets
CREATE INDEX IF NOT EXISTS idx_tickets_is_deleted ON public.tickets(is_deleted);

-- Drop existing delete policy for users
DROP POLICY IF EXISTS "Users can delete their own open unassigned tickets" ON public.tickets;

-- Add new policy for admins to soft delete (update is_deleted flag)
CREATE POLICY "Admins can soft delete any ticket" 
ON public.tickets 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update existing select policies to exclude deleted tickets for non-admins
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Department admins can view department tickets" ON public.tickets;

CREATE POLICY "Users can view their own non-deleted tickets" 
ON public.tickets 
FOR SELECT 
USING (user_id = auth.uid() AND is_deleted = false);

CREATE POLICY "Department admins can view non-deleted department tickets" 
ON public.tickets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM department_admins da
    WHERE da.department_id = tickets.department_id 
      AND da.user_id = auth.uid()
  ) AND is_deleted = false
);

-- Admins can view all tickets including deleted ones
CREATE POLICY "Admins can view all tickets including deleted" 
ON public.tickets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));