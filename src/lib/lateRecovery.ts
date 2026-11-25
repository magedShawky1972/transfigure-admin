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