-- Fix infinite recursion on internal_conversation_participants by removing any SELECT policy that references the same table.

-- 1) Drop problematic policies (idempotent)
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.internal_conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants for their conversations" ON public.internal_conversation_participants;

-- 2) Drop helper function that caused recursion when used inside policy
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid);

-- 3) Minimal, non-recursive participant policies
-- Users can only read their own participant rows.
CREATE POLICY "Users can view their own conversation participation"
ON public.internal_conversation_participants
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own participant row (rare), and conversation creator can insert additional participants.
CREATE POLICY "Users can insert participants when they create the conversation"
ON public.internal_conversation_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.internal_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

-- 4) RPC: find or create a direct (1:1) conversation (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.find_or_create_direct_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid;
  conv_id uuid;
BEGIN
  me := auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'other_user_id is required';
  END IF;
  IF other_user_id = me THEN
    RAISE EXCEPTION 'cannot create conversation with self';
  END IF;

  -- Find existing direct conversation (exactly two participants)
  SELECT c.id INTO conv_id
  FROM public.internal_conversations c
  JOIN public.internal_conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = me
  JOIN public.internal_conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = other_user_id
  WHERE c.is_group = false
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO public.internal_conversations (is_group, group_id, conversation_name, created_by)
  VALUES (false, NULL, NULL, me)
  RETURNING id INTO conv_id;

  -- Add both participants
  INSERT INTO public.internal_conversation_participants (conversation_id, user_id)
  VALUES (conv_id, me);

  INSERT INTO public.internal_conversation_participants (conversation_id, user_id)
  VALUES (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;