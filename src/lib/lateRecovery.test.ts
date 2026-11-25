import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { recoveryTargets, recoveryAdjustment } from './lateRecovery';

const row = (id: string, employee_id: string, work_date: string, late_minutes = 150) => ({ id, employee_id, work_date, late_minutes, deduction_amount: 100 });

test('bulk recovery only processes selected employees', () => {
  assert.deepEqual(recoveryTargets([row('1', 'A', '2026-10-28'), row('2', 'B', '2026-10-28')], new Set(['A']), () => true).map(r => r.id), ['1']);
});
test('bulk recovery excludes rows without edit permission or recovery eligibility', () => {
  assert.deepEqual(recoveryTargets([row('1', 'A', '2026-10-28'), row('2', 'A', '2026-10-29')], new Set(['A']), r => r.id !== '2').map(r => r.id), ['1']);
});
test('bulk recovery processes the supplied visible rows chronologically', () => {
  assert.deepEqual(recoveryTargets([row('2', 'A', '2026-10-29'), row('1', 'A', '2026-10-28')], new Set(['A']), () => true).map(r => r.id), ['1', '2']);
});
test('50% of five hours recovers all of todays 2.5 hours and clears deduction', () => {
  const result = recoveryAdjustment(row('1', 'A', '2026-10-28'), { late_minutes: 300 }, 50);
  assert.equal(result.credit, 150);
  assert.equal(result.late_minutes, 0);
  assert.equal(result.deduction_amount, 0);
  assert.equal(result.deduction_rule_id, null);
});
test('partial recovery preserves proportional deduction and earlier approved credit', () => {
  const result = recoveryAdjustment({ ...row('1', 'A', '2026-10-28', 200), late_recovery_minutes: 10 }, { late_minutes: 200, late_recovery_minutes: 100 }, 50);
  assert.equal(result.late_minutes, 50);
  assert.equal(result.late_recovery_minutes, 160);
  assert.equal(result.deduction_amount, 25);
});
test('no previous recorded lateness does not grant recovery', () => {
  assert.equal(recoveryAdjustment(row('1', 'A', '2026-10-28'), undefined, 50).credit, 0);
});