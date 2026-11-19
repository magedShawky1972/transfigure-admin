DROP FUNCTION public.prepare_koon_backfill(UUID);

ALTER TABLE public.koon_backfill_runs DROP CONSTRAINT koon_backfill_runs_status_check;
ALTER TABLE public.koon_backfill_runs
  ADD CONSTRAINT koon_backfill_runs_status_check
  CHECK (status IN ('preparing','ready','running','paused','completed','completed_with_errors','failed'));