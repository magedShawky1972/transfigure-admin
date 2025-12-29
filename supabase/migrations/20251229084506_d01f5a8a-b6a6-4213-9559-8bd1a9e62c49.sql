-- Create table for Odoo sync run history
CREATE TABLE public.odoo_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  total_orders INTEGER NOT NULL DEFAULT 0,
  successful_orders INTEGER NOT NULL DEFAULT 0,
  failed_orders INTEGER NOT NULL DEFAULT 0,
  skipped_orders INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for sync run details (individual order results)
CREATE TABLE public.odoo_sync_run_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.odoo_sync_runs(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  order_date DATE,
  customer_phone VARCHAR(50),
  product_names TEXT,
  total_amount DECIMAL(12,2),
  sync_status VARCHAR(20) NOT NULL,
  error_message TEXT,
  step_customer VARCHAR(20),
  step_brand VARCHAR(20),
  step_product VARCHAR(20),
  step_order VARCHAR(20),
  step_purchase VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odoo_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_sync_run_details ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view sync runs" 
ON public.odoo_sync_runs 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sync runs" 
ON public.odoo_sync_runs 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update sync runs" 
ON public.odoo_sync_runs 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view sync run details" 
ON public.odoo_sync_run_details 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sync run details" 
ON public.odoo_sync_run_details 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_odoo_sync_runs_run_date ON public.odoo_sync_runs(run_date DESC);
CREATE INDEX idx_odoo_sync_run_details_run_id ON public.odoo_sync_run_details(run_id);
CREATE INDEX idx_odoo_sync_run_details_status ON public.odoo_sync_run_details(sync_status);

-- Create trigger for updating timestamps
CREATE TRIGGER update_odoo_sync_runs_updated_at
BEFORE UPDATE ON public.odoo_sync_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();