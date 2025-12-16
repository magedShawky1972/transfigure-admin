-- Create security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_conversation_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.internal_conversation_participants;

-- Create non-recursive policy using the function
CREATE POLICY "Users can view participants in their conversations"
ON public.internal_conversation_participants
FOR SELECT
USING (
  user_id = auth.uid() OR
  public.is_conversation_member(auth.uid(), conversation_id)
);