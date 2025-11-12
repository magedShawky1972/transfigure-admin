-- Update existing records based on user_name
UPDATE public.purpletransaction
SET trans_type = CASE 
  WHEN user_name IS NULL THEN 'automatic'
  ELSE 'manual'
END
WHERE trans_type IS NULL OR trans_type NOT IN ('automatic', 'manual');

-- Create function to automatically set trans_type
CREATE OR REPLACE FUNCTION public.set_transaction_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.trans_type = CASE 
    WHEN NEW.user_name IS NULL THEN 'automatic'
    ELSE 'manual'
  END;
  RETURN NEW;
END;
$function$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_trans_type_trigger ON public.purpletransaction;

-- Create trigger to run before insert or update
CREATE TRIGGER set_trans_type_trigger
BEFORE INSERT OR UPDATE ON public.purpletransaction
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_type();