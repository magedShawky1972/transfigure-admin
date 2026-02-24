CREATE POLICY "Authenticated users can delete coins_purchase_receiving"
ON public.coins_purchase_receiving
FOR DELETE
USING (true);