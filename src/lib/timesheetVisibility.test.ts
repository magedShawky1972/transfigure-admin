import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isTimesheetVisibleForJobStart } from "./timesheetVisibility";

test("Shrouk's manual November 1 entry remains visible before her November 2 job start", () => {
  assert.equal(isTimesheetVisibleForJobStart({
    work_date: "2026-11-01",
    changed_by: "4e38e7e3-6e16-4fea-97ea-24e588a76695",
  }, "2026-11-02"), true);
});

test("automatic attendance before the job start date remains hidden", () => {
  assert.equal(isTimesheetVisibleForJobStart({
    work_date: "2026-11-01",
    changed_by: null,
  }, "2026-11-02"), false);
});

test("entries on or after the job start date remain visible", () => {
  assert.equal(isTimesheetVisibleForJobStart({ work_date: "2026-11-02" }, "2026-11-02"), true);
  assert.equal(isTimesheetVisibleForJobStart({ work_date: "2026-11-03" }, "2026-11-02"), true);
});

test("entries remain visible when no job start date is configured", () => {
  assert.equal(isTimesheetVisibleForJobStart({ work_date: "2026-11-01" }, null), true);
});
