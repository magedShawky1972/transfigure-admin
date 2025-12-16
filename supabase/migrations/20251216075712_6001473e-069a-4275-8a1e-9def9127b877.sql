-- Create internal chat conversations table
CREATE TABLE public.internal_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group boolean NOT NULL DEFAULT false,
    group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    conversation_name text,
    created_by uuid NOT NULL
);

-- Create conversation participants table
CREATE TABLE public.internal_conversation_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

-- Create internal messages table
CREATE TABLE public.internal_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL,
    message_text text,
    media_url text,
    media_type text,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Policies for internal_conversations
CREATE POLICY "Users can view their conversations"
ON public.internal_conversations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.internal_conversation_participants
        WHERE conversation_id = internal_conversations.id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create conversations"
ON public.internal_conversations FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Policies for internal_conversation_participants
CREATE POLICY "Users can view their participation"
ON public.internal_conversation_participants FOR SELECT
USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM internal_conversation_participants p2 
    WHERE p2.conversation_id = internal_conversation_participants.conversation_id 
    AND p2.user_id = auth.uid()
));

CREATE POLICY "Users can insert participants"
ON public.internal_conversation_participants FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their read status"
ON public.internal_conversation_participants FOR UPDATE
USING (user_id = auth.uid());

-- Policies for internal_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.internal_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.internal_conversation_participants
        WHERE conversation_id = internal_messages.conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can send messages to their conversations"
ON public.internal_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.internal_conversation_participants
        WHERE conversation_id = internal_messages.conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages"
ON public.internal_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_conversation_participants;

-- Triggers for updated_at
CREATE TRIGGER update_internal_conversations_updated_at
BEFORE UPDATE ON public.internal_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_internal_messages_updated_at
BEFORE UPDATE ON public.internal_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();