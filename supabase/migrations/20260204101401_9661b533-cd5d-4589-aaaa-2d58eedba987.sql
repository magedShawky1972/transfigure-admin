-- Remove the unique constraint on order_number since an order can have multiple payments
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_order_number_key;