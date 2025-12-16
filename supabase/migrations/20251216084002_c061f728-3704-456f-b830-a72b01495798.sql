-- Fix RLS infinite recursion on internal_conversation_participants by replacing self-referencing policy

-- Helper function to check membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view their participation" ON public.internal_conversation_participants;

-- Recreate a safe policy: allow users to see participant rows for conversations they belong to
CREATE POLICY "Users can view conversation participants"
ON public.internal_conversation_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_conversation_participant(conversation_id, auth.uid())
);
