-- Add country column to official_holidays table
ALTER TABLE public.official_holidays 
ADD COLUMN country TEXT DEFAULT 'all' CHECK (country IN ('all', 'egypt', 'ksa'));

-- Update existing holidays - set Egyptian-specific holidays
UPDATE public.official_holidays SET country = 'egypt' 
WHERE holiday_name IN (
  'Coptic Christmas', 
  'January 25 Revolution', 
  'Sinai Liberation Day', 
  'June 30 Revolution', 
  'July 23 Revolution', 
  'Armed Forces Day'
);

-- Islamic holidays are for all (both countries)
UPDATE public.official_holidays SET country = 'all' 
WHERE holiday_name LIKE 'Eid%' 
   OR holiday_name = 'Islamic New Year' 
   OR holiday_name = 'Prophet Birthday'
   OR holiday_name = 'Labor Day';