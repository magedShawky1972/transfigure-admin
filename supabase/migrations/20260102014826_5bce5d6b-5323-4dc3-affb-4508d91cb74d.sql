-- Delete the old cron job and recreate it with fixed timezone handling
SELECT cron.unschedule('check-scheduled-backup');

SELECT cron.schedule(
  'check-scheduled-backup',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT 
    net.http_post(
      url := 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/backup-database-background',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcXFua2Jna3Jqb3hyemxlanh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgwNzAsImV4cCI6MjA3NDgyNDA3MH0._x2rVaRxVwYBvxxbOFgRNClPWClIQkWH-4yi8c_UvAU"}'::jsonb,
      body := '{"action": "check-schedule", "isScheduled": true}'::jsonb
    ) AS request_id
  FROM public.backup_schedule
  WHERE is_enabled = true
    AND (last_run_at IS NULL OR last_run_at::date < (now() AT TIME ZONE 'Asia/Riyadh')::date)
    AND schedule_time BETWEEN ((now() AT TIME ZONE 'Asia/Riyadh')::time - INTERVAL '5 minutes')
                        AND ((now() AT TIME ZONE 'Asia/Riyadh')::time + INTERVAL '5 minutes');
  $$
);