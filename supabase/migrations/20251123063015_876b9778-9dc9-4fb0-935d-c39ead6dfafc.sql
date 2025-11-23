-- Create job_positions lookup table
CREATE TABLE IF NOT EXISTS public.job_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add job_position_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_position_id UUID REFERENCES public.job_positions(id);

-- Enable RLS on job_positions
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_positions
CREATE POLICY "Authenticated users can view job positions"
  ON public.job_positions
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage job positions"
  ON public.job_positions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_job_positions_updated_at
  BEFORE UPDATE ON public.job_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default job positions
INSERT INTO public.job_positions (position_name) VALUES
  ('Manager'),
  ('Developer'),
  ('Sales Representative'),
  ('Customer Support'),
  ('Administrator')
ON CONFLICT (position_name) DO NOTHING;