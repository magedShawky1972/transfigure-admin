import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  zk_employee_code: string | null;
  employee_number: string;
  attendance_type_id: string | null;
  email: string | null;
  user_id: string | null;
  basic_salary: number | null;
}

interface AttendanceType {
  id: string;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  allow_late_minutes: number | null;
  allow_early_exit_minutes: number | null;
}

interface DeductionRule {
  id: string;
  rule_name: string;
  rule_name_ar: string | null;
  rule_type: string;
  min_minutes: number | null;
  max_minutes: number | null;
  deduction_type: string;
  deduction_value: number;
}

interface ZkLog {
  id: string;
  employee_code: string;
  attendance_date: string;
  attendance_time: string;
  record_type: string;
  is_processed: boolean;
}

interface ProcessingResult {
  employee_code: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  late_minutes: number;
  early_exit_minutes: number;
  deduction_amount: number;
  deduction_rule_id: string | null;
  has_issues: boolean;
  issue_type: string | null;
}

// Convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Calculate deduction based on rules
function calculateDeduction(
  lateMinutes: number,
  earlyExitMinutes: number,
  isAbsent: boolean,
  basicSalary: number | null,
  deductionRules: DeductionRule[]
): { amount: number; ruleId: string | null } {
  if (!basicSalary || basicSalary <= 0) {
    return { amount: 0, ruleId: null };
  }

  const dailySalary = basicSalary / 30;
  const hourlyRate = dailySalary / 8;
  let deductionAmount = 0;
  let appliedRuleId: string | null = null;

  // Check for absence first
  if (isAbsent) {
    const absenceRule = deductionRules.find(r => r.rule_type === 'absence');
    if (absenceRule) {
      if (absenceRule.deduction_type === 'percentage') {
        deductionAmount = dailySalary * absenceRule.deduction_value;
      } else if (absenceRule.deduction_type === 'fixed') {
        deductionAmount = absenceRule.deduction_value;
      }
      appliedRuleId = absenceRule.id;
    }
    return { amount: deductionAmount, ruleId: appliedRuleId };
  }

  // Calculate late arrival deduction
  if (lateMinutes > 0) {
    const lateRule = deductionRules
      .filter(r => r.rule_type === 'late_arrival')
      .find(r => {
        const min = r.min_minutes || 0;
        const max = r.max_minutes || Infinity;
        return lateMinutes >= min && lateMinutes <= max;
      });

    if (lateRule) {
      if (lateRule.deduction_type === 'percentage') {
        deductionAmount += dailySalary * lateRule.deduction_value;
      } else if (lateRule.deduction_type === 'fixed') {
        deductionAmount += lateRule.deduction_value;
      } else if (lateRule.deduction_type === 'hourly') {
        deductionAmount += hourlyRate * (lateMinutes / 60) * lateRule.deduction_value;
      }
      appliedRuleId = lateRule.id;
    }
  }

  // Calculate early exit deduction (if applicable)
  if (earlyExitMinutes > 0) {
    const earlyRule = deductionRules
      .filter(r => r.rule_type === 'early_exit')
      .find(r => {
        const min = r.min_minutes || 0;
        const max = r.max_minutes || Infinity;
        return earlyExitMinutes >= min && earlyExitMinutes <= max;
      });

    if (earlyRule) {
      if (earlyRule.deduction_type === 'percentage') {
        deductionAmount += dailySalary * earlyRule.deduction_value;
      } else if (earlyRule.deduction_type === 'fixed') {
        deductionAmount += earlyRule.deduction_value;
      }
      if (!appliedRuleId) appliedRuleId = earlyRule.id;
    }
  }

  return { amount: Math.round(deductionAmount * 100) / 100, ruleId: appliedRuleId };
}

// Calculate total worked hours
function calculateTotalHours(inTime: string | null, outTime: string | null): number | null {
  if (!inTime || !outTime) return null;
  
  const inMinutes = timeToMinutes(inTime);
  const outMinutes = timeToMinutes(outTime);
  
  if (outMinutes <= inMinutes) return null;
  
  return Math.round(((outMinutes - inMinutes) / 60) * 100) / 100;
}

// Calculate expected hours based on attendance type
function calculateExpectedHours(attendanceType: AttendanceType | null): number | null {
  if (!attendanceType?.fixed_start_time || !attendanceType?.fixed_end_time) return null;
  
  const startMinutes = timeToMinutes(attendanceType.fixed_start_time);
  const endMinutes = timeToMinutes(attendanceType.fixed_end_time);
  
  if (endMinutes <= startMinutes) return null;
  
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const processType = body.process_type || 'morning'; // 'morning' for in-time, 'evening' for out-time
    const targetDate = body.target_date || new Date().toISOString().split('T')[0];
    const sendNotifications = body.send_notifications !== false;

    console.log(`Processing ZK attendance: type=${processType}, date=${targetDate}`);

    // Fetch all employees with ZK codes
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, employee_number, attendance_type_id, email, user_id, basic_salary')
      .not('zk_employee_code', 'is', null)
      .eq('employment_status', 'active');

    if (empError) throw empError;

    // Fetch attendance types
    const { data: attendanceTypes, error: atError } = await supabase
      .from('attendance_types')
      .select('id, fixed_start_time, fixed_end_time, allow_late_minutes, allow_early_exit_minutes');

    if (atError) throw atError;

    // Fetch deduction rules
    const { data: deductionRules, error: drError } = await supabase
      .from('deduction_rules')
      .select('id, rule_name, rule_name_ar, rule_type, min_minutes, max_minutes, deduction_type, deduction_value')
      .eq('is_active', true);

    if (drError) throw drError;

    // Fetch unprocessed ZK logs for the target date
    const { data: zkLogs, error: zkError } = await supabase
      .from('zk_attendance_logs')
      .select('id, employee_code, attendance_date, attendance_time, record_type, is_processed')
      .eq('attendance_date', targetDate)
      .order('attendance_time', { ascending: true });

    if (zkError) throw zkError;

    console.log(`Found ${zkLogs?.length || 0} ZK logs for ${targetDate}`);

    // Group logs by employee
    const employeeLogs = new Map<string, ZkLog[]>();
    (zkLogs || []).forEach(log => {
      const existing = employeeLogs.get(log.employee_code) || [];
      existing.push(log);
      employeeLogs.set(log.employee_code, existing);
    });

    const results: ProcessingResult[] = [];
    const processedLogIds: string[] = [];
    const notificationsToSend: { userId: string; email: string | null; employeeName: string; data: any }[] = [];

    // Process each employee
    for (const employee of (employees || [])) {
      if (!employee.zk_employee_code) continue;

      const logs = employeeLogs.get(employee.zk_employee_code) || [];
      const attendanceType = (attendanceTypes || []).find(at => at.id === employee.attendance_type_id);

      // Determine in_time (first punch) and out_time (last punch between 14:00-23:00)
      let inTime: string | null = null;
      let outTime: string | null = null;

      if (logs.length > 0) {
        // First punch is always in_time
        inTime = logs[0].attendance_time;

        // Find last punch between 14:00 and 23:00 for out_time
        const outLogs = logs.filter(log => {
          const minutes = timeToMinutes(log.attendance_time);
          return minutes >= 14 * 60 && minutes <= 23 * 60; // 2PM to 11PM
        });

        if (outLogs.length > 0) {
          outTime = outLogs[outLogs.length - 1].attendance_time;
        }
      }

      // For morning processing, we only care about in_time
      // For evening processing, we update with out_time
      if (processType === 'morning' && !inTime) continue;

      // Calculate late minutes
      let lateMinutes = 0;
      let earlyExitMinutes = 0;
      const allowLate = attendanceType?.allow_late_minutes || 0;
      const allowEarly = attendanceType?.allow_early_exit_minutes || 0;

      if (inTime && attendanceType?.fixed_start_time) {
        const scheduledStart = timeToMinutes(attendanceType.fixed_start_time);
        const actualStart = timeToMinutes(inTime);
        const rawLate = actualStart - scheduledStart;
        lateMinutes = rawLate > allowLate ? rawLate - allowLate : 0;
      }

      if (outTime && attendanceType?.fixed_end_time) {
        const scheduledEnd = timeToMinutes(attendanceType.fixed_end_time);
        const actualEnd = timeToMinutes(outTime);
        const rawEarly = scheduledEnd - actualEnd;
        earlyExitMinutes = rawEarly > allowEarly ? rawEarly - allowEarly : 0;
      }

      // Calculate deduction
      const { amount: deductionAmount, ruleId: deductionRuleId } = calculateDeduction(
        lateMinutes,
        earlyExitMinutes,
        false,
        employee.basic_salary,
        deductionRules || []
      );

      // Calculate hours
      const totalHours = calculateTotalHours(inTime, outTime);
      const expectedHours = calculateExpectedHours(attendanceType || null);
      const differenceHours = totalHours !== null && expectedHours !== null 
        ? Math.round((totalHours - expectedHours) * 100) / 100 
        : null;

      // Determine if there are issues (deductions, late minutes, missing data, etc.)
      // Has issues if: has deduction, or late > 15 min, or missing times
      const hasIssues = deductionAmount > 0 || lateMinutes > 15 || earlyExitMinutes > 0 || !inTime || (processType === 'evening' && !outTime);
      let issueType: string | null = null;
      if (deductionAmount > 0) issueType = 'deduction';
      else if (lateMinutes > 15) issueType = 'late';
      else if (earlyExitMinutes > 0) issueType = 'early_exit';
      else if (!inTime) issueType = 'missing_in';
      else if (!outTime && processType === 'evening') issueType = 'missing_out';

      // Create or update saved_attendance record
      const attendanceRecord = {
        employee_code: employee.zk_employee_code,
        attendance_date: targetDate,
        in_time: inTime,
        out_time: processType === 'evening' ? outTime : null,
        total_hours: totalHours,
        expected_hours: expectedHours,
        difference_hours: differenceHours,
        record_status: 'normal',
        deduction_rule_id: deductionRuleId,
        deduction_amount: deductionAmount,
        auto_processed: true,
        processing_source: 'zk_auto',
        has_issues: hasIssues,
        is_confirmed: false,
        saved_by: '00000000-0000-0000-0000-000000000000', // System user
        saved_at: new Date().toISOString(),
        batch_id: null,
        filter_from_date: targetDate,
        filter_to_date: targetDate,
      };

      // Upsert the saved_attendance record
      const { error: upsertError } = await supabase
        .from('saved_attendance')
        .upsert(attendanceRecord, {
          onConflict: 'employee_code,attendance_date',
        });

      if (upsertError) {
        console.error(`Error upserting saved_attendance for ${employee.zk_employee_code}:`, upsertError);
      }

      // Also create/update timesheets record for Timesheet Management
      const scheduledStart = attendanceType?.fixed_start_time || null;
      const scheduledEnd = attendanceType?.fixed_end_time || null;
      
      const timesheetRecord = {
        employee_id: employee.id,
        work_date: targetDate,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        actual_start: inTime,
        actual_end: processType === 'evening' ? outTime : null,
        break_duration_minutes: 0,
        status: hasIssues ? 'pending' : 'pending',
        is_absent: !inTime && processType === 'evening',
        absence_reason: !inTime && processType === 'evening' ? 'No check-in recorded' : null,
        late_minutes: lateMinutes,
        early_leave_minutes: earlyExitMinutes,
        overtime_minutes: 0,
        total_work_minutes: totalHours ? Math.round(totalHours * 60) : 0,
        deduction_amount: deductionAmount,
        overtime_amount: 0,
        notes: `Auto-processed from ZK attendance (${processType})`,
      };

      const { error: timesheetError } = await supabase
        .from('timesheets')
        .upsert(timesheetRecord, {
          onConflict: 'employee_id,work_date',
        });

      if (timesheetError) {
        console.error(`Error upserting timesheet for ${employee.id}:`, timesheetError);
        continue;
      }

      // Mark logs as processed
      const logIds = logs.map(l => l.id);
      processedLogIds.push(...logIds);

      // Queue notification
      if (sendNotifications && employee.user_id) {
        const employeeName = employee.first_name + ' ' + employee.last_name;
        notificationsToSend.push({
          userId: employee.user_id,
          email: employee.email,
          employeeName,
          data: {
            date: targetDate,
            inTime,
            outTime,
            lateMinutes,
            earlyExitMinutes,
            deductionAmount,
            processType,
          },
        });
      }

      results.push({
        employee_code: employee.zk_employee_code,
        date: targetDate,
        in_time: inTime,
        out_time: outTime,
        late_minutes: lateMinutes,
        early_exit_minutes: earlyExitMinutes,
        deduction_amount: deductionAmount,
        deduction_rule_id: deductionRuleId,
        has_issues: hasIssues,
        issue_type: issueType,
      });
    }

    // Mark ZK logs as processed
    if (processedLogIds.length > 0) {
      const { error: updateError } = await supabase
        .from('zk_attendance_logs')
        .update({ is_processed: true, processed_at: new Date().toISOString() })
        .in('id', processedLogIds);

      if (updateError) {
        console.error('Error marking logs as processed:', updateError);
      }
    }

    // Send notifications
    if (sendNotifications && notificationsToSend.length > 0) {
      for (const notification of notificationsToSend) {
        try {
          // Create internal notification
          const notificationTitle = notification.data.processType === 'morning'
            ? 'تم تسجيل حضورك'
            : 'ملخص الحضور اليومي';

          let notificationBody = '';
          if (notification.data.processType === 'morning') {
            notificationBody = `تم تسجيل دخولك الساعة ${notification.data.inTime}`;
            if (notification.data.lateMinutes > 0) {
              notificationBody += ` - تأخير ${notification.data.lateMinutes} دقيقة`;
            }
          } else {
            notificationBody = `دخول: ${notification.data.inTime || 'غير مسجل'} - خروج: ${notification.data.outTime || 'غير مسجل'}`;
            if (notification.data.deductionAmount > 0) {
              notificationBody += ` - خصم: ${notification.data.deductionAmount.toFixed(2)} ر.س`;
            }
          }

          await supabase.from('notifications').insert({
            user_id: notification.userId,
            title: notificationTitle,
            body: notificationBody,
            type: 'attendance',
            is_read: false,
            data: notification.data,
          });

          // Update notification sent flags
          const updateFields = notification.data.processType === 'morning'
            ? { entry_notification_sent: true, entry_notification_sent_at: new Date().toISOString() }
            : { exit_notification_sent: true, exit_notification_sent_at: new Date().toISOString() };

          await supabase
            .from('saved_attendance')
            .update(updateFields)
            .eq('employee_code', notification.data.employee_code || '')
            .eq('attendance_date', notification.data.date);

          // Send email if configured
          if (notification.email) {
            try {
              await supabase.functions.invoke('send-email-smtp', {
                body: {
                  to: notification.email,
                  subject: notificationTitle,
                  html: `
                    <div dir="rtl" style="font-family: Arial, sans-serif;">
                      <h2>${notificationTitle}</h2>
                      <p>${notificationBody}</p>
                      <p>التاريخ: ${notification.data.date}</p>
                    </div>
                  `,
                },
              });
            } catch (emailError) {
              console.error('Error sending email:', emailError);
            }
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    }

    console.log(`Processed ${results.length} attendance records`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} attendance records`,
        processed_count: results.length,
        notifications_sent: notificationsToSend.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing ZK attendance:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
