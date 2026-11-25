/** Approved vacation has no expected shift; any recorded work is overtime. */
export function vacationWork(inTime: string | null, outTime: string | null, breakMinutes = 0) {
  const seconds = (time: string) => {
    const parts = time.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  };
  let worked = 0;
  if (inTime && outTime) {
    const duration = seconds(outTime) - seconds(inTime);
    if (Number.isFinite(duration) && duration > 0) worked = Math.max(0, Math.round(duration / 60) - breakMinutes);
  }
  return {
    status: 'vacation', is_absent: false,
    late_minutes: 0, early_leave_minutes: 0,
    total_work_minutes: worked, overtime_minutes: worked,
    deduction_amount: 0, deduction_rule_id: null,
    late_recovery_minutes: 0,
    late_recovery_approved_by: null, late_recovery_approved_at: null,
  };
}