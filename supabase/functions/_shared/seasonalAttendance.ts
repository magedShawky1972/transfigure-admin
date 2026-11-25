export interface SeasonalAttendanceSchedule {
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  seasonal_start_date?: string | null;
  seasonal_end_date?: string | null;
  seasonal_start_time?: string | null;
  seasonal_end_time?: string | null;
  seasonal_is_recurring?: boolean | null;
}

export interface ResolvedAttendanceSchedule {
  start: string | null;
  end: string | null;
  isSeasonal: boolean;
}

export function isSeasonalScheduleActive(
  attendanceType: SeasonalAttendanceSchedule | null | undefined,
  workDate: string,
): boolean {
  if (!attendanceType || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;

  const {
    seasonal_start_date: startDate,
    seasonal_end_date: endDate,
    seasonal_start_time: startTime,
    seasonal_end_time: endTime,
  } = attendanceType;

  if (!startDate || !endDate || !startTime || !endTime) return false;

  if (attendanceType.seasonal_is_recurring === false) {
    return workDate >= startDate && workDate <= endDate;
  }

  const currentMonthDay = workDate.slice(5);
  const startMonthDay = startDate.slice(5);
  const endMonthDay = endDate.slice(5);

  return startMonthDay <= endMonthDay
    ? currentMonthDay >= startMonthDay && currentMonthDay <= endMonthDay
    : currentMonthDay >= startMonthDay || currentMonthDay <= endMonthDay;
}

export function resolveAttendanceSchedule(
  attendanceType: SeasonalAttendanceSchedule | null | undefined,
  workDate: string,
): ResolvedAttendanceSchedule {
  const isSeasonal = isSeasonalScheduleActive(attendanceType, workDate);

  return {
    start: isSeasonal
      ? attendanceType?.seasonal_start_time || null
      : attendanceType?.fixed_start_time || null,
    end: isSeasonal
      ? attendanceType?.seasonal_end_time || null
      : attendanceType?.fixed_end_time || null,
    isSeasonal,
  };
}
