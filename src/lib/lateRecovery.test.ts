import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { recoveryTargets, recoveryAdjustment, canApproveLateRecovery, wfhRecoveryCredit, canRecoverWfh } from './lateRecovery';

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
// --- who may approve late recovery ---
const recoveryRow = (over: any = {}) => ({
  id: "t1", employee_id: "e1", work_date: "2026-11-23", late_minutes: 60, deduction_amount: 30, ...over,
});

test("an administrator may approve recovery for an employee they cannot otherwise edit", () => {
  assert.equal(canApproveLateRecovery(recoveryRow(), { percent: 40, mayEdit: true, isVirtual: false }), true);
});
test("a user without edit rights cannot approve recovery", () => {
  assert.equal(canApproveLateRecovery(recoveryRow(), { percent: 40, mayEdit: false, isVirtual: false }), false);
});
test("recovery needs a percentage configured on the attendance type", () => {
  assert.equal(canApproveLateRecovery(recoveryRow(), { percent: 0, mayEdit: true, isVirtual: false }), false);
});
test("an approved delay request is never recovered again", () => {
  assert.equal(canApproveLateRecovery(recoveryRow(), { percent: 40, mayEdit: true, hasApprovedDelay: true }), false);
});
test("virtual WFH rows carry no recovery", () => {
  assert.equal(canApproveLateRecovery(recoveryRow({ id: "wfh-virtual-1" }), { percent: 40, mayEdit: true, isVirtual: true }), false);
});

test('WFH recovery is 20% of working time: five hours supplies 60 minutes', () => {
  assert.equal(wfhRecoveryCredit(300), 60);
  assert.equal(wfhRecoveryCredit(480), 96);
});
test('WFH credits already used cannot be recovered a second time', () => {
  assert.equal(wfhRecoveryCredit(300, 60), 0);
  assert.equal(wfhRecoveryCredit(300, 25), 35);
});
test('WFH recovery rounds down to whole minutes and rejects invalid work', () => {
  assert.equal(wfhRecoveryCredit(7), 1);
  assert.equal(wfhRecoveryCredit(-1), 0);
  assert.equal(wfhRecoveryCredit(NaN), 0);
});
test('only completed approved WFH work can supply recovery with approval rights', () => {
  const session = { status: 'approved', actual_start: '09:00', actual_end: '14:00', total_work_minutes: 300 };
  assert.equal(canRecoverWfh(session, true), true);
  assert.equal(canRecoverWfh({ ...session, status: 'pending' }, true), false);
  assert.equal(canRecoverWfh({ ...session, actual_end: null }, true), false);
  assert.equal(canRecoverWfh(session, false), false);
});
