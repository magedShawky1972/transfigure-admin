import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const KSA_OFFSET_HOURS = 3;

// Get current KSA date/time
function getKSADate(): Date {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
}

function getKSADateString(): string {
  const ksaDate = getKSADate();
  const year = ksaDate.getFullYear();
  const month = (ksaDate.getMonth() + 1).toString().padStart(2, '0');
  const day = ksaDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getKSATimeInMinutes(): number {
  const ksaDate = getKSADate();
  return ksaDate.getHours() * 60 + ksaDate.getMinutes();
}

// Convert time string (HH:MM or HH:MM:SS) to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = getKSADateString();
    const currentTimeInMinutes = getKSATimeInMinutes();
    
    console.log(`[Overdue Reminder] Running at KSA time: ${Math.floor(currentTimeInMinutes / 60)}:${currentTimeInMinutes % 60}`);
    console.log(`[Overdue Reminder] Today: ${today}`);

    // Get all open shift sessions for today's assignments
    const { data: openSessions, error: sessionsError } = await supabase
      .from('shift_sessions')
      .select(`
        id,
        opened_at,
        user_id,
        shift_assignment_id,
        shift_assignments!inner (
          id,
          assignment_date,
          shift_id,
          user_id,
          shifts (
            id,
            shift_name,
            shift_end_time
          )
        )
      `)
      .eq('status', 'open');

    if (sessionsError) {
      console.error('[Overdue Reminder] Error fetching open sessions:', sessionsError);
      throw sessionsError;
    }

    if (!openSessions || openSessions.length === 0) {
      console.log('[Overdue Reminder] No open sessions found');
      return new Response(
        JSON.stringify({ success: true, message: 'No open sessions found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Overdue Reminder] Found ${openSessions.length} open sessions`);

    let notificationsSent = 0;

    for (const session of openSessions) {
      const assignment = session.shift_assignments as any;
      const shift = assignment?.shifts as any;
      
      if (!shift) {
        console.log(`[Overdue Reminder] Session ${session.id} has no shift info, skipping`);
        continue;
      }

      const shiftEndTimeInMinutes = timeToMinutes(shift.shift_end_time);
      
      // Calculate overdue threshold (1 hour after shift end)
      let overdueThresholdInMinutes = shiftEndTimeInMinutes + 60;
      
      // Handle overnight shifts (shift end time is before start time, meaning it ends next day)
      // For simplicity, if end time is < 8:00, assume it's an overnight shift
      const isOvernightShift = shiftEndTimeInMinutes < 480; // 8:00 AM = 480 minutes
      
      // Check if shift is overdue
      let isOverdue = false;
      
      if (isOvernightShift) {
        // For overnight shifts: overdue if current time is between end+1hr and 12:00 (noon)
        // This prevents false positives in the evening
        if (currentTimeInMinutes > overdueThresholdInMinutes && currentTimeInMinutes < 720) {
          isOverdue = true;
        }
      } else {
        // For regular shifts: overdue if current time is past end+1hr
        if (currentTimeInMinutes > overdueThresholdInMinutes) {
          isOverdue = true;
        }
      }

      if (!isOverdue) {
        console.log(`[Overdue Reminder] Session ${session.id} for shift ${shift.shift_name} is not overdue yet`);
        continue;
      }

      console.log(`[Overdue Reminder] Session ${session.id} is OVERDUE! Shift: ${shift.shift_name}, End: ${shift.shift_end_time}`);

      // Check if we already sent a reminder for this session today
      const { data: existingReminder } = await supabase
        .from('shift_overdue_reminders')
        .select('id')
        .eq('shift_session_id', session.id)
        .gte('created_at', `${today}T00:00:00Z`)
        .maybeSingle();

      if (existingReminder) {
        console.log(`[Overdue Reminder] Already sent reminder for session ${session.id} today`);
        continue;
      }

      // Get user profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('user_name')
        .eq('user_id', session.user_id)
        .single();

      const userName = userProfile?.user_name || 'Unknown';

      // Get shift admins
      const { data: shiftAdmins } = await supabase
        .from('shift_admins')
        .select('user_id')
        .eq('shift_id', shift.id)
        .eq('is_active', true);

      if (!shiftAdmins || shiftAdmins.length === 0) {
        console.log(`[Overdue Reminder] No admins for shift ${shift.shift_name}`);
        continue;
      }

      // Calculate how long overdue
      const overdueMinutes = currentTimeInMinutes - shiftEndTimeInMinutes;
      const overdueHours = Math.floor(overdueMinutes / 60);
      const overdueRemainingMinutes = overdueMinutes % 60;
      const overdueText = overdueHours > 0 
        ? `${overdueHours} ساعة و ${overdueRemainingMinutes} دقيقة`
        : `${overdueRemainingMinutes} دقيقة`;

      // Send notification to each admin
      for (const admin of shiftAdmins) {
        // Create internal notification
        const { error: notifError } = await supabase
          .from('internal_messages')
          .insert({
            sender_id: session.user_id,
            recipient_id: admin.user_id,
            subject: `⚠️ وردية متأخرة - ${shift.shift_name}`,
            message_body: `الموظف/ة **${userName}** لم يغلق وردية **${shift.shift_name}** بعد.\n\nالوردية متأخرة منذ: **${overdueText}**\n\nيرجى المتابعة مع الموظف أو استخدام الإغلاق القسري من صفحة متابعة الورديات.`,
            message_type: 'alert',
            is_read: false,
          });

        if (notifError) {
          console.error(`[Overdue Reminder] Error sending notification to admin ${admin.user_id}:`, notifError);
        } else {
          console.log(`[Overdue Reminder] Sent notification to admin ${admin.user_id}`);
        }

        // Send push notification
        const { data: pushSubscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', admin.user_id);

        if (pushSubscriptions && pushSubscriptions.length > 0) {
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: admin.user_id,
                title: `⚠️ وردية متأخرة - ${shift.shift_name}`,
                body: `${userName} لم يغلق الوردية. متأخرة منذ ${overdueText}`,
                data: {
                  type: 'shift_overdue',
                  shiftSessionId: session.id,
                },
              },
            });
          } catch (pushError) {
            console.error(`[Overdue Reminder] Error sending push notification:`, pushError);
          }
        }

        notificationsSent++;
      }

      // Record that we sent reminders for this session
      const { error: recordError } = await supabase
        .from('shift_overdue_reminders')
        .insert({
          shift_session_id: session.id,
          shift_assignment_id: assignment.id,
          user_id: session.user_id,
          shift_name: shift.shift_name,
          overdue_minutes: overdueMinutes,
        });

      if (recordError) {
        console.error(`[Overdue Reminder] Error recording reminder:`, recordError);
      }
    }

    console.log(`[Overdue Reminder] Completed. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${openSessions.length} sessions, sent ${notificationsSent} notifications`,
        processed: openSessions.length,
        notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Overdue Reminder] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
