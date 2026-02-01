import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShiftAssignment {
  id: string;
  user_id: string;
  assignment_date: string;
  shift_id: string;
  shifts: {
    shift_name: string;
    shift_start_time: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting shift attendance reminder check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current time in KSA timezone
    const now = new Date();
    const ksaOffset = 3 * 60; // KSA is UTC+3
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const ksaMinutes = (utcMinutes + ksaOffset) % (24 * 60);
    const ksaHours = Math.floor(ksaMinutes / 60);
    const ksaMins = ksaMinutes % 60;
    
    console.log(`Current KSA time: ${ksaHours.toString().padStart(2, '0')}:${ksaMins.toString().padStart(2, '0')}`);

    // Get today's date in KSA
    const ksaDate = new Date(now.getTime() + ksaOffset * 60 * 1000);
    const today = ksaDate.toISOString().split('T')[0];
    console.log(`Today's date (KSA): ${today}`);

    // Fetch today's shift assignments with shift info
    const { data: assignments, error: assignError } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        user_id,
        assignment_date,
        shift_id,
        shifts (
          shift_name,
          shift_start_time
        )
      `)
      .eq('assignment_date', today);

    if (assignError) {
      console.error('Error fetching assignments:', assignError);
      throw assignError;
    }

    if (!assignments || assignments.length === 0) {
      console.log('No shift assignments found for today');
      return new Response(
        JSON.stringify({ message: 'No assignments for today' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assignments.length} shift assignments for today`);

    let remindersSent = 0;

    for (const rawAssignment of assignments) {
      const shifts = Array.isArray(rawAssignment.shifts) 
        ? rawAssignment.shifts[0] 
        : rawAssignment.shifts;
      
      const assignment = {
        id: rawAssignment.id,
        user_id: rawAssignment.user_id,
        assignment_date: rawAssignment.assignment_date,
        shift_id: rawAssignment.shift_id,
        shifts: shifts as { shift_name: string; shift_start_time: string } | null,
      };
      if (!assignment.shifts) continue;

      const [startHours, startMinutes] = assignment.shifts.shift_start_time.split(':').map(Number);
      const shiftStartInMinutes = startHours * 60 + startMinutes;
      const currentTimeInMinutes = ksaHours * 60 + ksaMins;

      // Calculate minutes until shift starts
      const minutesUntilShift = shiftStartInMinutes - currentTimeInMinutes;

      console.log(`Assignment ${assignment.id}: Shift starts at ${assignment.shifts.shift_start_time}, ` +
        `minutes until shift: ${minutesUntilShift}`);

      // Check if we need to send 10min or 5min reminder
      let reminderType: '10min' | '5min' | null = null;

      if (minutesUntilShift >= 9 && minutesUntilShift <= 11) {
        reminderType = '10min';
      } else if (minutesUntilShift >= 4 && minutesUntilShift <= 6) {
        reminderType = '5min';
      }

      if (!reminderType) continue;

      // Check if attendance already recorded
      const { data: existingAttendance } = await supabase
        .from('shift_attendance')
        .select('id')
        .eq('user_id', assignment.user_id)
        .eq('shift_assignment_id', assignment.id)
        .maybeSingle();

      if (existingAttendance) {
        console.log(`Attendance already recorded for assignment ${assignment.id}`);
        continue;
      }

      // Check if reminder already sent
      const { data: existingReminder } = await supabase
        .from('shift_attendance_reminders')
        .select('id')
        .eq('user_id', assignment.user_id)
        .eq('shift_assignment_id', assignment.id)
        .eq('reminder_type', reminderType)
        .maybeSingle();

      if (existingReminder) {
        console.log(`${reminderType} reminder already sent for assignment ${assignment.id}`);
        continue;
      }

      // Send push notification
      const title = reminderType === '10min' 
        ? 'تذكير الحضور - 10 دقائق'
        : 'تذكير الحضور - 5 دقائق';
      
      const body = reminderType === '10min'
        ? `تبقى 10 دقائق على بدء وردية ${assignment.shifts.shift_name}. سجل حضورك الآن.`
        : `تبقى 5 دقائق على بدء وردية ${assignment.shifts.shift_name}! سجل حضورك فوراً.`;

      console.log(`Sending ${reminderType} reminder to user ${assignment.user_id}`);

      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: assignment.user_id,
            title,
            body,
            data: {
              url: '/shift-session',
              tag: `attendance-${assignment.id}`,
              assignmentId: assignment.id,
            },
          },
        });

        if (pushError) {
          console.error('Error sending push notification:', pushError);
        }

        // Record that reminder was sent
        await supabase
          .from('shift_attendance_reminders')
          .insert({
            user_id: assignment.user_id,
            shift_assignment_id: assignment.id,
            reminder_type: reminderType,
          });

        remindersSent++;
        console.log(`Successfully sent ${reminderType} reminder for assignment ${assignment.id}`);
      } catch (notifError) {
        console.error('Error in notification process:', notifError);
      }
    }

    console.log(`Completed. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent,
        message: `Sent ${remindersSent} attendance reminders` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-shift-attendance-reminder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
