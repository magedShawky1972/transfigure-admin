-- Drop and recreate the view with the new structure
DROP VIEW IF EXISTS notin_customer_incustomer;

CREATE VIEW notin_customer_incustomer AS
SELECT DISTINCT 
  customer_phone,
  customer_name,
  MIN(created_at_date) as creation_date
FROM purpletransaction
WHERE customer_phone NOT IN (SELECT customer_phone FROM customers)
  AND customer_phone IS NOT NULL
GROUP BY customer_phone, customer_name;