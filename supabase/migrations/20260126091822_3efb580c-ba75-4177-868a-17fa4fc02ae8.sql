-- Create trigger function to automatically recalculate treasury balance
CREATE OR REPLACE FUNCTION public.recalculate_treasury_balance_trigger()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    SELECT 
      COALESCE(SUM(CASE WHEN te.entry_type = 'receipt' THEN te.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN te.entry_type = 'payment' THEN te.amount + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN te.entry_type = 'transfer' THEN te.amount + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0)
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

  -- Calculate sums from ALL posted treasury entries
  SELECT 
    COALESCE(SUM(CASE WHEN te.entry_type = 'receipt' THEN te.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN te.entry_type = 'payment' THEN te.amount + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN te.entry_type = 'transfer' THEN te.amount + COALESCE(te.bank_charges, 0) + COALESCE(te.other_charges, 0) ELSE 0 END), 0)
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
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS treasury_balance_auto_recalc ON treasury_entries;

-- Create trigger on treasury_entries table
CREATE TRIGGER treasury_balance_auto_recalc
AFTER INSERT OR UPDATE OR DELETE ON treasury_entries
FOR EACH ROW
EXECUTE FUNCTION recalculate_treasury_balance_trigger();

-- Add comment explaining the trigger
COMMENT ON FUNCTION recalculate_treasury_balance_trigger() IS 
'Automatically recalculates treasury current_balance as: opening_balance + SUM(receipts) - SUM(payments) - SUM(transfers) whenever treasury entries are modified';