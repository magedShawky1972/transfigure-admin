export interface TimesheetJobStartRow {
  work_date: string;
  changed_by?: string | null;
}

/**
 * Automatic attendance before the job start date stays hidden, but an explicitly
 * saved manual entry is authoritative and must remain visible.
 */
export function isTimesheetVisibleForJobStart(
  row: TimesheetJobStartRow,
  jobStartDate?: string | null,
): boolean {
  return !jobStartDate || row.work_date >= jobStartDate || Boolean(row.changed_by);
}
