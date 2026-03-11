
-- Add receiving_date and brand_id to header
ALTER TABLE public.coins_sheet_orders ADD COLUMN IF NOT EXISTS receiving_date date;
ALTER TABLE public.coins_sheet_orders ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id);

-- Add extra_coins to lines
ALTER TABLE public.coins_sheet_order_lines ADD COLUMN IF NOT EXISTS extra_coins numeric DEFAULT 0;

-- Create line attachments table
CREATE TABLE IF NOT EXISTS public.coins_sheet_line_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid REFERENCES public.coins_sheet_order_lines(id) ON DELETE CASCADE NOT NULL,
  sheet_order_id uuid REFERENCES public.coins_sheet_orders(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by text,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coins_sheet_line_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sheet line attachments"
  ON public.coins_sheet_line_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
