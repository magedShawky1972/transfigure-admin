import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveAttendanceSchedule } from "./seasonalAttendance";

const egyptSchedule = {
  fixed_start_time: "08:00:00",
  fixed_end_time: "16:30:00",
  fixed_start_date: "2025-11-01",
  fixed_end_date: "2026-03-31",
  seasonal_start_date: "2026-04-01",
  seasonal_end_date: "2026-10-31",
  seasonal_start_time: "09:00:00",
  seasonal_end_time: "17:30:00",
  seasonal_is_recurring: false,
};

test("Egypt summer uses 09:00-17:30 during its effective range", () => {
  assert.deepEqual(resolveAttendanceSchedule(egyptSchedule, "2026-07-15"), {
    start: "09:00:00",
    end: "17:30:00",
    isSeasonal: true,
  });
});

test("Egypt winter uses 08:00-16:30 during its own effective range", () => {
  assert.deepEqual(resolveAttendanceSchedule(egyptSchedule, "2026-01-15"), {
    start: "08:00:00",
    end: "16:30:00",
    isSeasonal: false,
  });
});

test("both schedules include their effective start and end dates", () => {
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2025-11-01").start, "08:00:00");
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-03-31").start, "08:00:00");
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-04-01").start, "09:00:00");
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-10-31").start, "09:00:00");
});

test("a date outside both exact ranges has no scheduled hours", () => {
  assert.deepEqual(resolveAttendanceSchedule(egyptSchedule, "2026-11-01"), {
    start: null,
    end: null,
    isSeasonal: false,
  });
});

test("neither schedule repeats in another year", () => {
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2027-06-10").start, null);
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2027-01-10").start, null);
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2025-06-10").start, null);
});

test("seasonal hours take precedence if exact ranges overlap", () => {
  const overlap = { ...egyptSchedule, fixed_end_date: "2026-12-31" };
  assert.equal(resolveAttendanceSchedule(overlap, "2026-07-15").start, "09:00:00");
});

test("legacy fixed hours without effective dates remain unbounded", () => {
  const legacy = { ...egyptSchedule, fixed_start_date: null, fixed_end_date: null };
  assert.equal(resolveAttendanceSchedule(legacy, "2026-01-15").start, "08:00:00");
  assert.equal(resolveAttendanceSchedule(legacy, "2026-11-01").start, "08:00:00");
});

test("incomplete seasonal settings safely use an applicable fixed schedule", () => {
  const incomplete = {
    ...egyptSchedule,
    fixed_start_date: null,
    fixed_end_date: null,
    seasonal_end_time: null,
  };
  assert.equal(resolveAttendanceSchedule(incomplete, "2026-07-15").start, "08:00:00");
});
