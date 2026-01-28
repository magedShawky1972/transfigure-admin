-- Add attachment_url column for sick leave and other attachments
ALTER TABLE public.employee_requests 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.employee_requests.attachment_url IS 'URL for attachments like sick leave medical certificates';