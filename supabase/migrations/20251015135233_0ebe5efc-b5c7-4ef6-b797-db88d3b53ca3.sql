-- Create CRM follow-up table for tracking customer notes and reminders
CREATE TABLE public.crm_customer_followup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  notes TEXT,
  reminder_date TIMESTAMP WITH TIME ZONE,
  next_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.crm_customer_followup ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM follow-up
CREATE POLICY "Users can view all CRM follow-ups" 
ON public.crm_customer_followup 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create CRM follow-ups" 
ON public.crm_customer_followup 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update CRM follow-ups" 
ON public.crm_customer_followup 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own CRM follow-ups" 
ON public.crm_customer_followup 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_crm_customer_followup_updated_at
BEFORE UPDATE ON public.crm_customer_followup
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster phone lookups
CREATE INDEX idx_crm_customer_followup_phone ON public.crm_customer_followup(customer_phone);