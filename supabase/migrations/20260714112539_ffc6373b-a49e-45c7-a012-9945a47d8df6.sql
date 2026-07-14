
CREATE TABLE IF NOT EXISTS public.notification_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_key text NOT NULL UNIQUE,
  process_name text NOT NULL,
  description text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_processes TO authenticated;
GRANT ALL ON public.notification_processes TO service_role;

ALTER TABLE public.notification_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notification processes"
  ON public.notification_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notification processes"
  ON public.notification_processes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_key text NOT NULL REFERENCES public.notification_processes(process_key) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  is_enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (process_key, recipient_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notification recipients"
  ON public.notification_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notification recipients"
  ON public.notification_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_notification_processes_updated
  BEFORE UPDATE ON public.notification_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_notification_recipients_updated
  BEFORE UPDATE ON public.notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_processes (process_key, process_name, description, category) VALUES
  ('ticket_escalation', 'Ticket Escalation', 'Alerts sent when tickets are pending for more than 3 days without approval', 'Tickets'),
  ('ticket_notification', 'Ticket Notifications', 'New ticket, approval, rejection and comment notifications', 'Tickets'),
  ('request_escalation', 'Employee Request Escalation', 'Alerts for stale employee requests (vacation, delay, etc.)', 'HR'),
  ('acknowledgment_email', 'Acknowledgment Documents', 'Emails for administrative acknowledgment documents', 'HR'),
  ('deduction_notification', 'Payroll Deduction Notification', 'Alerts when deductions are applied to employees', 'Payroll'),
  ('attendance_summary', 'Attendance Summary', 'Daily attendance summary email', 'HR'),
  ('shift_open_notification', 'Shift Opened', 'Sent when a shift session is opened', 'Shifts'),
  ('shift_close_notification', 'Shift Closed', 'Sent when a shift session is closed', 'Shifts'),
  ('shift_attendance_reminder', 'Shift Attendance Reminder', 'Reminder to record shift attendance', 'Shifts'),
  ('shift_overdue_reminder', 'Shift Overdue Reminder', 'Reminder for overdue shifts', 'Shifts'),
  ('coins_workflow_notification', 'Coins Workflow', 'Coins purchase workflow phase transitions', 'Coins'),
  ('coins_workflow_delays', 'Coins Workflow Delays', 'Alerts for delayed coins workflow steps', 'Coins'),
  ('advance_payment_notification', 'Supplier Advance Payment', 'Supplier advance payment workflow notifications', 'Payments'),
  ('advance_payment_delays', 'Advance Payment Delays', 'Alerts for delayed advance payment approvals', 'Payments'),
  ('reorder_notification', 'Reorder Notification', 'Product reorder alerts', 'Inventory'),
  ('task_notification', 'Task Notification', 'Task assignment and update notifications', 'Tasks'),
  ('task_reminders', 'Task Reminders', 'Reminders for upcoming or overdue tasks', 'Tasks'),
  ('password_anomaly', 'Password Access Anomalies', 'Security alerts for unusual password access', 'Security')
ON CONFLICT (process_key) DO NOTHING;
