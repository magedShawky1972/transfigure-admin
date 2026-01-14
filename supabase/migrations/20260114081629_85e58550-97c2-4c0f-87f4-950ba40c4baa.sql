-- RLS DELETE policies required for Odoo sync history cleanup

-- odoo_sync_runs: allow authenticated users to delete rows
CREATE POLICY "Authenticated users can delete sync runs"
ON public.odoo_sync_runs
FOR DELETE
TO public
USING (auth.role() = 'authenticated');

-- aggregated_order_mapping: allow authenticated users to delete rows
CREATE POLICY "Authenticated users can delete aggregated_order_mapping"
ON public.aggregated_order_mapping
FOR DELETE
TO authenticated
USING (true);