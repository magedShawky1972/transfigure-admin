-- Allow authenticated users to view basic profile information
-- This is needed so department admins can see who created tickets
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);