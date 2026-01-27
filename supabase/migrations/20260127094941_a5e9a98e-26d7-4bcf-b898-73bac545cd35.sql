-- Drop existing check constraints
ALTER TABLE treasury_entries DROP CONSTRAINT IF EXISTS treasury_entries_entry_type_check;
ALTER TABLE treasury_entries DROP CONSTRAINT IF EXISTS treasury_entries_status_check;
ALTER TABLE bank_entries DROP CONSTRAINT IF EXISTS bank_entries_entry_type_check;
ALTER TABLE bank_entries DROP CONSTRAINT IF EXISTS bank_entries_status_check;

-- Recreate with void_reversal and voided values
ALTER TABLE treasury_entries ADD CONSTRAINT treasury_entries_entry_type_check 
CHECK (entry_type IN ('opening', 'receipt', 'payment', 'transfer', 'void_reversal'));

ALTER TABLE treasury_entries ADD CONSTRAINT treasury_entries_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected', 'voided'));

ALTER TABLE bank_entries ADD CONSTRAINT bank_entries_entry_type_check 
CHECK (entry_type IN ('opening', 'deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'void_reversal'));

ALTER TABLE bank_entries ADD CONSTRAINT bank_entries_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected', 'voided'));