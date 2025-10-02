-- Create table for storing Excel sheet configurations
CREATE TABLE IF NOT EXISTS public.excel_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_code TEXT NOT NULL UNIQUE,
  sheet_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing Excel column mappings
CREATE TABLE IF NOT EXISTS public.excel_column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.excel_sheets(id) ON DELETE CASCADE,
  excel_column TEXT NOT NULL,
  table_column TEXT NOT NULL,
  data_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing generated table metadata
CREATE TABLE IF NOT EXISTS public.generated_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  columns JSONB NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.excel_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_tables ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (admin app)
CREATE POLICY "Allow all operations on excel_sheets" 
ON public.excel_sheets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on excel_column_mappings" 
ON public.excel_column_mappings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on generated_tables" 
ON public.generated_tables FOR ALL USING (true) WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_excel_sheets_updated_at
BEFORE UPDATE ON public.excel_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generated_tables_updated_at
BEFORE UPDATE ON public.generated_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();