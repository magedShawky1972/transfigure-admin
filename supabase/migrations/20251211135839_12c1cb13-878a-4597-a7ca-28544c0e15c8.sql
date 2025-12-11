-- Add attachment columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS external_links TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS file_attachments JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS video_attachments JSONB DEFAULT '[]';