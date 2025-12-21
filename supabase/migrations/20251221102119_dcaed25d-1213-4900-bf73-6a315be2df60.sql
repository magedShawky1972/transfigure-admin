-- Alter requesttimestamp column to timestamp type
ALTER TABLE public.hyberpaystatement 
ALTER COLUMN requesttimestamp TYPE TIMESTAMP WITH TIME ZONE 
USING CASE 
  WHEN requesttimestamp IS NULL THEN NULL
  WHEN requesttimestamp = '' THEN NULL
  ELSE requesttimestamp::TIMESTAMP WITH TIME ZONE
END;