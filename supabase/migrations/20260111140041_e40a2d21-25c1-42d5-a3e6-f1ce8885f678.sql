-- Allow the new 'Cancelled' status on tickets
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'Open'::text,
        'In Progress'::text,
        'Closed'::text,
        'Rejected'::text,
        'Cancelled'::text
      ]
    )
  );