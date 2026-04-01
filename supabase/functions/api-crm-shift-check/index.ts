import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// KSA timezone offset (UTC+3)
const KSA_OFFSET_HOURS = 3;

const getKSADate = (): Date => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
};

const getKSADateString = (): string => {
  const ksa = getKSADate();
  return ksa.toISOString().split('T')[0];
};

const getKSAYesterdayDateString = (): string => {
  const ksa = getKSADate();
  ksa.setDate(ksa.getDate() - 1);
  return ksa.toISOString().split('T')[0];
};

const getKSATimeInMinutes = (): number => {
  const ksa = getKSADate();
  return ksa.getHours() * 60 + ksa.getMinutes();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const today = getKSADateString();
    const yesterday = getKSAYesterdayDateString();
    const currentTimeInMinutes = getKSATimeInMinutes();
    const BUFFER_MINUTES = 5;

    // Check if user already has an open shift session
    const { data: openSession } = await supabaseAdmin
      .from('shift_sessions')
      .select(`
        id, opened_at, status, first_order_number, salla_first_order_number,
        shift_assignments (
          id, assignment_date, shift_id,
          shifts (shift_name, shift_start_time, shift_end_time, shift_order,
            shift_types (type)
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openSession) {
      const assignment = openSession.shift_assignments as any;
      const shift = assignment?.shifts;
      return new Response(JSON.stringify({
        success: true,
        has_shift: true,
        shift_status: 'open',
        shift_session_id: openSession.id,
        shift_name: shift?.shift_name || null,
        shift_start_time: shift?.shift_start_time || null,
        shift_end_time: shift?.shift_end_time || null,
        shift_type: shift?.shift_types?.type || null,
        assignment_date: assignment?.assignment_date || null,
        first_order_number: openSession.first_order_number || null,
        salla_first_order_number: openSession.salla_first_order_number || null,
        message: 'User has an active open shift session'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check today's and yesterday's assignments
    const { data: assignments } = await supabaseAdmin
      .from('shift_assignments')
      .select(`
        id, shift_id, assignment_date,
        shifts (shift_name, shift_start_time, shift_end_time, shift_order,
          shift_types (type)
        )
      `)
      .eq('user_id', userId)
      .in('assignment_date', [today, yesterday])
      .order('assignment_date', { ascending: false });

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        has_shift: false,
        shift_status: 'no_assignment',
        message: 'No shift assignment found for today'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check each assignment with ±5 min buffer
    for (const assignment of assignments) {
      const shiftData = assignment.shifts as any;
      if (!shiftData) continue;

      const [startHours, startMinutes] = shiftData.shift_start_time.split(':').map(Number);
      const startTimeInMinutes = startHours * 60 + startMinutes;

      const [endHours, endMinutes] = shiftData.shift_end_time.split(':').map(Number);
      const endTimeInMinutes = endHours * 60 + endMinutes;

      const isOvernightShift = endTimeInMinutes < startTimeInMinutes;
      const effectiveStartTime = startTimeInMinutes - BUFFER_MINUTES;
      const effectiveEndTime = endTimeInMinutes + BUFFER_MINUTES;

      let isInShiftWindow = false;

      if (isOvernightShift) {
        if (assignment.assignment_date === today) {
          if (currentTimeInMinutes >= effectiveStartTime) {
            isInShiftWindow = true;
          }
        }
        if (assignment.assignment_date === yesterday) {
          if (currentTimeInMinutes <= effectiveEndTime) {
            isInShiftWindow = true;
          }
        }
      } else {
        if (currentTimeInMinutes >= effectiveStartTime && currentTimeInMinutes <= effectiveEndTime) {
          isInShiftWindow = true;
        }
      }

      if (isInShiftWindow) {
        // Check if shift session already exists (closed)
        const { data: closedSession } = await supabaseAdmin
          .from('shift_sessions')
          .select('id, status')
          .eq('shift_assignment_id', assignment.id)
          .eq('status', 'closed')
          .maybeSingle();

        return new Response(JSON.stringify({
          success: true,
          has_shift: true,
          shift_status: closedSession ? 'closed' : 'pending',
          shift_assignment_id: assignment.id,
          shift_name: shiftData.shift_name || null,
          shift_start_time: shiftData.shift_start_time || null,
          shift_end_time: shiftData.shift_end_time || null,
          shift_type: shiftData.shift_types?.type || null,
          assignment_date: assignment.assignment_date,
          message: closedSession 
            ? 'Shift has already been closed' 
            : 'User has a scheduled shift in this time window'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // No shift in current time window
    return new Response(JSON.stringify({
      success: true,
      has_shift: false,
      shift_status: 'outside_window',
      message: 'No shift scheduled within the current time window (±5 minutes)'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRM Shift Check error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
