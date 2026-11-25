export interface SeasonalAttendanceSchedule {
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  fixed_start_date?: string | null;
  fixed_end_date?: string | null;
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

function isFixedScheduleActive(
  attendanceType: SeasonalAttendanceSchedule,
  workDate: string,
): boolean {
  if (!attendanceType.fixed_start_time || !attendanceType.fixed_end_time) return false;

  const { fixed_start_date: startDate, fixed_end_date: endDate } = attendanceType;

  // Existing attendance types without effective dates retain their unbounded fixed schedule.
  if (!startDate || !endDate) return true;

  return workDate >= startDate && workDate <= endDate;
}

export function resolveAttendanceSchedule(
  attendanceType: SeasonalAttendanceSchedule | null | undefined,
  workDate: string,
): ResolvedAttendanceSchedule {
  if (!attendanceType || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { start: null, end: null, isSeasonal: false };
  }

  const isSeasonal = isSeasonalScheduleActive(attendanceType, workDate);

  if (isSeasonal) {
    return {
      start: attendanceType.seasonal_start_time || null,
      end: attendanceType.seasonal_end_time || null,
      isSeasonal: true,
    };
  }

  if (isFixedScheduleActive(attendanceType, workDate)) {
    return {
      start: attendanceType.fixed_start_time,
      end: attendanceType.fixed_end_time,
      isSeasonal: false,
    };
  }

  return { start: null, end: null, isSeasonal: false };
}
