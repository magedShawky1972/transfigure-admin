-- Drop existing problematic policies on internal_conversation_participants
DROP POLICY IF EXISTS "Users can view their own participants" ON public.internal_conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON public.internal_conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.internal_conversation_participants;

-- Create simpler non-recursive policies
CREATE POLICY "Users can view participants in their conversations"
ON public.internal_conversation_participants
FOR SELECT
USING (
  user_id = auth.uid() OR
  conversation_id IN (
    SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert participants for their conversations"
ON public.internal_conversation_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.internal_conversations 
    WHERE id = conversation_id AND created_by = auth.uid()
  )
);