-- Add user_id column to user_emails table
ALTER TABLE public.user_emails ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Populate user_id from owner column by matching with profiles
UPDATE public.user_emails ue
SET user_id = p.user_id
FROM public.profiles p
WHERE ue.owner = p.user_name AND ue.user_id IS NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage user emails" ON public.user_emails;
DROP POLICY IF EXISTS "Users can delete their own emails" ON public.user_emails;
DROP POLICY IF EXISTS "Users can insert their own emails" ON public.user_emails;
DROP POLICY IF EXISTS "Users can update their own emails" ON public.user_emails;
DROP POLICY IF EXISTS "Users can view emails they own" ON public.user_emails;

-- Create new RLS policies using user_id
CREATE POLICY "Users can view their own emails"
ON public.user_emails
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own emails"
ON public.user_emails
FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own emails"
ON public.user_emails
FOR UPDATE
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own emails"
ON public.user_emails
FOR DELETE
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));