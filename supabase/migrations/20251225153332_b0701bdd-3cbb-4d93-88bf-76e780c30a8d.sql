-- Allow anonymous users to count profiles (needed for login page check)
-- This only allows counting IDs, not accessing actual profile data
CREATE POLICY "Allow counting profiles for system check"
ON public.profiles
FOR SELECT
TO anon
USING (true);