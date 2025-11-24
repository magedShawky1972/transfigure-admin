-- Create shift_sessions table for tracking open/close shift
CREATE TABLE public.shift_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shift_assignment_id UUID NOT NULL REFERENCES public.shift_assignments(id),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift_brand_balances table for tracking brand closing balances
CREATE TABLE public.shift_brand_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  receipt_image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_session_id, brand_id)
);

-- Enable RLS
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_brand_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_sessions
CREATE POLICY "Users can view their own shift sessions"
  ON public.shift_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own shift sessions"
  ON public.shift_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own shift sessions"
  ON public.shift_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all shift sessions"
  ON public.shift_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shift_brand_balances
CREATE POLICY "Users can view brand balances for their shift sessions"
  ON public.shift_brand_balances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shift_sessions
    WHERE shift_sessions.id = shift_brand_balances.shift_session_id
    AND shift_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create brand balances for their shift sessions"
  ON public.shift_brand_balances FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shift_sessions
    WHERE shift_sessions.id = shift_brand_balances.shift_session_id
    AND shift_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can update brand balances for their shift sessions"
  ON public.shift_brand_balances FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.shift_sessions
    WHERE shift_sessions.id = shift_brand_balances.shift_session_id
    AND shift_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all brand balances"
  ON public.shift_brand_balances FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for shift receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('shift-receipts', 'shift-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for shift receipts
CREATE POLICY "Users can upload receipts for their shifts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shift-receipts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'shift-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'shift-receipts'
    AND has_role(auth.uid(), 'admin'::app_role)
  );