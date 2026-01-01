-- Enable RLS on encryption_keys table
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view encryption keys
CREATE POLICY "Only admins can view encryption keys"
ON public.encryption_keys
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert encryption keys
CREATE POLICY "Only admins can insert encryption keys"
ON public.encryption_keys
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update encryption keys
CREATE POLICY "Only admins can update encryption keys"
ON public.encryption_keys
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete encryption keys
CREATE POLICY "Only admins can delete encryption keys"
ON public.encryption_keys
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));