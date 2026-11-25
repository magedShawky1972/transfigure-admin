import { lateRecoveryCredit } from './flexibleHours';

export interface RecoveryRow {
  id: string;
  employee_id: string;
  work_date: string;
  late_minutes: number;
  late_recovery_minutes?: number | null;
  deduction_amount: number;
}

export function recoveryTargets<T extends RecoveryRow>(rows: T[], employeeIds: Set<string>, eligible: (row: T) => boolean): T[] {
  return rows.filter(row => employeeIds.has(row.employee_id) && eligible(row))
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || a.id.localeCompare(b.id));
}

export function recoveryAdjustment(row: RecoveryRow, previous: { late_minutes: number; late_recovery_minutes?: number | null } | undefined, percent: number) {
  const previousLate = (previous?.late_minutes || 0) + (previous?.late_recovery_minutes || 0);
  const credit = lateRecoveryCredit(previousLate, percent, row.late_minutes);
  const remaining = row.late_minutes - credit;
  return {
    credit,
    late_minutes: remaining,
    late_recovery_minutes: (row.late_recovery_minutes || 0) + credit,
    deduction_amount: remaining <= 0 ? 0 : Math.round(row.deduction_amount * remaining / (row.late_minutes || 1) * 100) / 100,
    ...(remaining <= 0 ? { deduction_rule_id: null } : {}),
  };
}

/** Completed, approved WFH sessions supply whole-minute credit; unfinished sessions supply none. */
export function wfhRecoveryCredit(workMinutes: number, usedMinutes = 0): number {
  if (!Number.isFinite(workMinutes) || workMinutes <= 0) return 0;
  return Math.max(0, Math.floor(workMinutes * 20 / 100) - Math.max(0, usedMinutes));
}

export function canRecoverWfh(row: {
  status: string; actual_start: string | null; actual_end: string | null;
  total_work_minutes: number; wfh_recovery_used_minutes?: number;
}, mayEdit: boolean): boolean {
  return mayEdit && row.status === 'approved' && !!row.actual_start && !!row.actual_end
    && wfhRecoveryCredit(row.total_work_minutes, row.wfh_recovery_used_minutes) > 0;
}

/** Who may approve late recovery for one attendance row, and when a row is eligible at all. */
export function canApproveLateRecovery<T extends RecoveryRow>(
  row: T,
  opts: { percent: number; mayEdit: boolean; hasApprovedDelay?: boolean | null; isVirtual?: boolean },
): boolean {
  return !opts.hasApprovedDelay
    && (row.late_minutes || 0) > 0
    && !opts.isVirtual
    && opts.mayEdit
    && opts.percent > 0;
}