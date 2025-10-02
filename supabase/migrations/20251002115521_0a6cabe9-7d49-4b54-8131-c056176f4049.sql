-- Create function to execute arbitrary SQL (admin use only)
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;