-- Update the automatic license status function to preserve manual statuses like "canceled"
-- The function should only update licenses with automatic statuses (active, expired, expiring_soon)
-- and leave manual statuses (canceled, etc.) untouched

CREATE OR REPLACE FUNCTION public.update_software_license_status()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.software_licenses
  SET status = CASE
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END
  WHERE expiry_date IS NOT NULL
    AND status IN ('active', 'expired', 'expiring_soon');
END;
$function$;