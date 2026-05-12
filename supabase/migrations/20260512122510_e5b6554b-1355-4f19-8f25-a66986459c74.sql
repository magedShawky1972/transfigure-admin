CREATE TABLE public.task_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_messages_task_id ON public.task_messages(task_id);
CREATE INDEX idx_task_messages_created_at ON public.task_messages(created_at);

ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task messages"
ON public.task_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own task messages"
ON public.task_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task messages"
ON public.task_messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task messages"
ON public.task_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_task_messages_updated_at
BEFORE UPDATE ON public.task_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_messages;
ALTER TABLE public.task_messages REPLICA IDENTITY FULL;