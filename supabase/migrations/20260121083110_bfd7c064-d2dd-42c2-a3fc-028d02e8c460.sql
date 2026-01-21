-- Create table to track bank ledger update jobs
CREATE TABLE IF NOT EXISTS public.bank_ledger_update_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'payment_reference' or 'hyperpay'
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  from_date_int INTEGER,
  to_date_int INTEGER,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  updated_records INTEGER DEFAULT 0,
  error_records INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  force_kill BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.bank_ledger_update_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view all jobs" ON public.bank_ledger_update_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert jobs" ON public.bank_ledger_update_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update jobs" ON public.bank_ledger_update_jobs
  FOR UPDATE TO authenticated USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_bank_ledger_update_jobs_updated_at
  BEFORE UPDATE ON public.bank_ledger_update_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_ledger_update_jobs;