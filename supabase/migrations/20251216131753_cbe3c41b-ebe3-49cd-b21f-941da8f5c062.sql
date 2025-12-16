-- Table to track deleted email message IDs (prevents re-sync)
CREATE TABLE public.deleted_email_ids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Enable RLS
ALTER TABLE public.deleted_email_ids ENABLE ROW LEVEL SECURITY;

-- Users can manage their own deleted IDs
CREATE POLICY "Users can view their own deleted email ids"
  ON public.deleted_email_ids FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own deleted email ids"
  ON public.deleted_email_ids FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own deleted email ids"
  ON public.deleted_email_ids FOR DELETE
  USING (user_id = auth.uid());