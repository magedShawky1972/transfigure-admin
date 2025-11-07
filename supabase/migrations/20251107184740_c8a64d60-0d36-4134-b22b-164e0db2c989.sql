-- Create user permissions table
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item text NOT NULL,
  has_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_item)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all permissions"
ON public.user_permissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert permissions"
ON public.user_permissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update permissions"
ON public.user_permissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete permissions"
ON public.user_permissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_permissions_updated_at();

-- Initialize permissions for magedashawky@gmail.com
INSERT INTO public.user_permissions (user_id, menu_item, has_access)
SELECT 
  u.id,
  menu_item,
  true
FROM auth.users u
CROSS JOIN (
  VALUES 
    ('dashboard'),
    ('reports'),
    ('transactions'),
    ('pivotTable'),
    ('loadData'),
    ('uploadLog'),
    ('clearData'),
    ('reportsSetup'),
    ('customerSetup'),
    ('customerTotals'),
    ('brandSetup'),
    ('productSetup'),
    ('paymentMethodSetup'),
    ('userSetup'),
    ('apiConfig'),
    ('excelSetup'),
    ('tableConfig')
) AS menu_items(menu_item)
WHERE u.email = 'magedashawky@gmail.com'
ON CONFLICT (user_id, menu_item) DO UPDATE SET has_access = true;