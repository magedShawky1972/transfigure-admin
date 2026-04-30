CREATE TABLE public.sql_saved_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sql_saved_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved queries"
ON public.sql_saved_queries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved queries"
ON public.sql_saved_queries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved queries"
ON public.sql_saved_queries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved queries"
ON public.sql_saved_queries FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_sql_saved_queries_user ON public.sql_saved_queries(user_id, name);

CREATE TRIGGER update_sql_saved_queries_updated_at
BEFORE UPDATE ON public.sql_saved_queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();