
ALTER TABLE public.timesheets
  ADD COLUMN manager_note TEXT,
  ADD COLUMN manager_note_by TEXT,
  ADD COLUMN manager_note_at TIMESTAMPTZ;
