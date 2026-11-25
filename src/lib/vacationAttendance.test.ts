import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { vacationWork } from '../../supabase/functions/_shared/vacationAttendance';

test('one-hour visit during vacation is 60 overtime minutes, not 445 minutes late', () => {
  const result = vacationWork('16:40:54', '17:40:52');
  assert.equal(result.overtime_minutes, 60);
  assert.equal(result.total_work_minutes, 60);
  assert.equal(result.late_minutes, 0);
  assert.equal(result.early_leave_minutes, 0);
  assert.equal(result.deduction_amount, 0);
  assert.equal(result.status, 'vacation');
});
test('vacation without punches remains vacation and is not absent', () => {
  const result = vacationWork(null, null);
  assert.equal(result.overtime_minutes, 0);
  assert.equal(result.is_absent, false);
  assert.equal(result.status, 'vacation');
});
test('incomplete vacation visit does not invent worked overtime', () => {
  assert.equal(vacationWork('16:40:54', null).overtime_minutes, 0);
});
test('vacation work ignores the fixed shift and excludes breaks', () => {
  assert.equal(vacationWork('10:00:00', '11:30:00', 30).overtime_minutes, 60);
});
test('vacation cannot keep recovery credits against nonexistent vacation lateness', () => {
  assert.equal(vacationWork('16:40:54', '17:40:52').late_recovery_minutes, 0);
});