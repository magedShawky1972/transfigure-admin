-- Create table for storing ZK attendance data
CREATE TABLE public.zk_attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code TEXT NOT NULL,
  attendance_date DATE NOT NULL,
  attendance_time TIME NOT NULL,
  record_type TEXT DEFAULT 'unknown', -- 'entry', 'exit', 'unknown'
  raw_data JSONB,
  api_key_id UUID REFERENCES public.api_keys(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  is_processed BOOLEAN DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX idx_zk_attendance_employee_code ON public.zk_attendance_logs(employee_code);
CREATE INDEX idx_zk_attendance_date ON public.zk_attendance_logs(attendance_date);
CREATE INDEX idx_zk_attendance_employee_date ON public.zk_attendance_logs(employee_code, attendance_date);

-- Enable RLS
ALTER TABLE public.zk_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view attendance logs"
ON public.zk_attendance_logs
FOR SELECT
TO authenticated
USING (true);

-- Allow insert via service role (edge function)
CREATE POLICY "Service role can insert attendance logs"
ON public.zk_attendance_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.zk_attendance_logs IS 'Stores attendance data received from ZK time attendance machines';

-- Add to api_keys table permission for zk_attendance if not exists
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS allow_zk_attendance BOOLEAN DEFAULT false;