/**
 * Flexible hours: late arrival (after the late allowance) up to `flexMinutes`
 * is forgiven by the minutes the employee stays after the scheduled end.
 */
export function applyFlexibleLate(netLateMinutes: number, minutesAfterEnd: number, flexMinutes: number): number {
  if (netLateMinutes <= 0) return 0;
  const credit = Math.min(Math.max(0, flexMinutes || 0), Math.max(0, minutesAfterEnd || 0));
  return Math.max(0, netLateMinutes - credit);
}
