-- Create company_news table
CREATE TABLE public.company_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_news ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage company news"
ON public.company_news
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view published news"
ON public.company_news
FOR SELECT
USING (is_published = true);

-- Trigger for updated_at
CREATE TRIGGER update_company_news_updated_at
BEFORE UPDATE ON public.company_news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();