-- Add deduction_rule_id column to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS deduction_rule_id UUID REFERENCES public.deduction_rules(id);