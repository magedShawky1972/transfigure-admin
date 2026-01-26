-- Fix the treasury balance recalculation trigger to use converted_amount for payments
-- The converted_amount field stores the amount already converted to treasury currency

DROP FUNCTION IF EXISTS recalculate_treasury_balance_trigger() CASCADE;

CREATE OR REPLACE FUNCTION recalculate_treasury_balance_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_treasury_id UUID;
  new_balance NUMERIC;
  opening NUMERIC;
  receipts_total NUMERIC;
  payments_total NUMERIC;
  transfers_total NUMERIC;
BEGIN
  -- Determine which treasury to recalculate
  IF TG_OP = 'DELETE' THEN
    target_treasury_id := OLD.treasury_id;
  ELSE
    target_treasury_id := NEW.treasury_id;
  END IF;

  -- Also recalculate old treasury if treasury_id changed on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.treasury_id IS DISTINCT FROM NEW.treasury_id THEN
    -- Recalculate old treasury first
    SELECT COALESCE(t.opening_balance, 0) INTO opening
    FROM treasuries t WHERE t.id = OLD.treasury_id;

    -- Use converted_amount for proper currency conversion
    SELECT 
      COALESCE(SUM(CASE WHEN te.entry_type = 'receipt' THEN COALESCE(te.converted_amount, te.amount) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN te.entry_type = 'payment' THEN COALESCE(te.converted_amount, te.amount) + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN te.entry_type = 'transfer' THEN COALESCE(te.converted_amount, te.amount) + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0)
    INTO receipts_total, payments_total, transfers_total
    FROM treasury_entries te
    WHERE te.treasury_id = OLD.treasury_id AND te.status = 'posted';

    UPDATE treasuries 
    SET current_balance = opening + receipts_total - payments_total - transfers_total
    WHERE id = OLD.treasury_id;
  END IF;

  -- Get opening balance for target treasury
  SELECT COALESCE(t.opening_balance, 0) INTO opening
  FROM treasuries t WHERE t.id = target_treasury_id;

  -- Calculate sums from ALL posted treasury entries using converted_amount
  -- converted_amount is the amount in treasury currency after currency conversion
  SELECT 
    COALESCE(SUM(CASE WHEN te.entry_type = 'receipt' THEN COALESCE(te.converted_amount, te.amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN te.entry_type = 'payment' THEN COALESCE(te.converted_amount, te.amount) + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN te.entry_type = 'transfer' THEN COALESCE(te.converted_amount, te.amount) + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0)
  INTO receipts_total, payments_total, transfers_total
  FROM treasury_entries te
  WHERE te.treasury_id = target_treasury_id AND te.status = 'posted';

  -- Calculate new balance: opening + receipts - payments - transfers
  new_balance := opening + receipts_total - payments_total - transfers_total;

  -- Update treasury balance
  UPDATE treasuries 
  SET current_balance = new_balance
  WHERE id = target_treasury_id;

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS treasury_balance_auto_recalc ON treasury_entries;

CREATE TRIGGER treasury_balance_auto_recalc
AFTER INSERT OR UPDATE OR DELETE ON treasury_entries
FOR EACH ROW
EXECUTE FUNCTION recalculate_treasury_balance_trigger();

COMMENT ON FUNCTION recalculate_treasury_balance_trigger() IS 
'Automatically recalculates treasury balance using converted_amount field which contains the amount in treasury currency.';