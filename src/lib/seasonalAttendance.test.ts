import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveAttendanceSchedule } from "./seasonalAttendance";

const egyptSchedule = {
  fixed_start_time: "08:00:00",
  fixed_end_time: "16:30:00",
  seasonal_start_date: "2026-04-01",
  seasonal_end_date: "2026-10-31",
  seasonal_start_time: "09:00:00",
  seasonal_end_time: "17:30:00",
  seasonal_is_recurring: false,
};

test("Egypt summer uses 09:00-17:30 on an effective date", () => {
  assert.deepEqual(resolveAttendanceSchedule(egyptSchedule, "2026-07-15"), {
    start: "09:00:00",
    end: "17:30:00",
    isSeasonal: true,
  });
});

test("Egypt winter uses the default 08:00-16:30 outside the effective period", () => {
  assert.deepEqual(resolveAttendanceSchedule(egyptSchedule, "2026-01-15"), {
    start: "08:00:00",
    end: "16:30:00",
    isSeasonal: false,
  });
});

test("effective start and end dates are inclusive", () => {
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-04-01").isSeasonal, true);
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-10-31").isSeasonal, true);
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-03-31").isSeasonal, false);
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-11-01").isSeasonal, false);
});

test("the selected date range does not repeat in another year", () => {
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2026-06-10").start, "09:00:00");
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2027-06-10").start, "08:00:00");
  assert.equal(resolveAttendanceSchedule(egyptSchedule, "2025-06-10").start, "08:00:00");
});

test("one exact range can cross New Year", () => {
  const winter = {
    ...egyptSchedule,
    seasonal_start_date: "2026-11-01",
    seasonal_end_date: "2027-03-31",
    seasonal_start_time: "08:00:00",
    seasonal_end_time: "16:30:00",
  };
  assert.equal(resolveAttendanceSchedule(winter, "2027-01-10").isSeasonal, true);
  assert.equal(resolveAttendanceSchedule(winter, "2027-04-01").isSeasonal, false);
  assert.equal(resolveAttendanceSchedule(winter, "2028-01-10").isSeasonal, false);
});

test("incomplete seasonal settings safely use fixed hours", () => {
  const incomplete = { ...egyptSchedule, seasonal_end_time: null };
  assert.equal(resolveAttendanceSchedule(incomplete, "2026-07-15").start, "08:00:00");
});
