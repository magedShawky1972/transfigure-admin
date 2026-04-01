import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const KSA_OFFSET_HOURS = 3;

const getKSADate = (): Date => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
};

const getKSADateString = (): string => getKSADate().toISOString().split('T')[0];

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
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const logApiCall = async () => {
    try {
      await supabaseAdmin.from('api_consumption_logs').insert({
        endpoint: 'api-crm-shift-checkin',
        method: req.method,
        request_body: requestBody,
        response_status: responseStatus,
        response_message: responseMessage,
        success,
        execution_time_ms: Date.now() - startTime,
        api_key_id: apiKeyData?.id || null,
        api_key_description: apiKeyData?.description || null,
      });
    } catch (logError) {
      console.error('Error logging API call:', logError);
    }
  };

  if (req.method !== 'POST') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use POST.';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate API key from x-api-key header
    const apiKeyHeader = req.headers.get('x-api-key');
    if (!apiKeyHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key (x-api-key header)';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKey, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('api_key', apiKeyHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_crm) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or CRM permission denied';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate session token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      responseStatus = 401;
      responseMessage = 'Missing or invalid session token (Authorization: Bearer <session_id>)';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      responseStatus = 401;
      responseMessage = 'Invalid or expired session';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    requestBody = body;
    const { first_order_number, salla_first_order_number } = body;

    if (!first_order_number) {
      responseStatus = 400;
      responseMessage = 'first_order_number is required (Purple first order number)';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already has an open shift
    const { data: existingOpen } = await supabaseAdmin
      .from('shift_sessions')
      .select('id, shift_assignments(assignment_date, shifts(shift_name))')
      .eq('user_id', userId)
      .eq('status', 'open')
      .maybeSingle();

    if (existingOpen) {
      const assignment = existingOpen.shift_assignments as any;
      responseStatus = 409;
      responseMessage = 'User already has an open shift session';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({
        success: false,
        error: responseMessage,
        existing_shift_session_id: existingOpen.id,
        shift_name: assignment?.shifts?.shift_name || null,
        assignment_date: assignment?.assignment_date || null,
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find valid assignment for current time
    const today = getKSADateString();
    const yesterday = getKSAYesterdayDateString();
    const currentTimeInMinutes = getKSATimeInMinutes();
    const BUFFER_MINUTES = 10;

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
      responseStatus = 404;
      responseMessage = 'No shift assignment found for today';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let validAssignment: any = null;

    for (const assignment of assignments) {
      const shiftData = assignment.shifts as any;
      if (!shiftData) continue;

      const [startHours, startMinutes] = shiftData.shift_start_time.split(':').map(Number);
      const startTimeInMinutes = startHours * 60 + startMinutes;
      const [endHours, endMinutes] = shiftData.shift_end_time.split(':').map(Number);
      const endTimeInMinutes = endHours * 60 + endMinutes;
      const isOvernightShift = endTimeInMinutes < startTimeInMinutes;
      const effectiveStartTime = startTimeInMinutes - BUFFER_MINUTES;

      if (isOvernightShift) {
        if (assignment.assignment_date === today && currentTimeInMinutes >= effectiveStartTime) {
          validAssignment = assignment;
          break;
        }
        if (assignment.assignment_date === yesterday && currentTimeInMinutes <= endTimeInMinutes) {
          validAssignment = assignment;
          break;
        }
      } else {
        if (currentTimeInMinutes >= effectiveStartTime && currentTimeInMinutes <= endTimeInMinutes) {
          validAssignment = assignment;
          break;
        }
      }
    }

    if (!validAssignment) {
      responseStatus = 400;
      responseMessage = 'No valid shift found for current time';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record attendance if not already done
    const { data: existingAttendance } = await supabaseAdmin
      .from('shift_attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('shift_assignment_id', validAssignment.id)
      .maybeSingle();

    if (!existingAttendance) {
      const shiftData = validAssignment.shifts as any;
      const [startHours, startMinutes] = shiftData.shift_start_time.split(':').map(Number);
      const startTimeInMinutes = startHours * 60 + startMinutes;
      const status = currentTimeInMinutes > startTimeInMinutes ? 'late' : 'present';

      await supabaseAdmin
        .from('shift_attendance')
        .insert({
          user_id: userId,
          shift_assignment_id: validAssignment.id,
          attendance_date: today,
          status,
          notes: 'Auto check-in via CRM API',
          device_info: req.headers.get('User-Agent') || 'CRM External App',
        });
    }

    // Check for existing closed session
    const { data: closedSession } = await supabaseAdmin
      .from('shift_sessions')
      .select('id')
      .eq('shift_assignment_id', validAssignment.id)
      .eq('status', 'closed')
      .maybeSingle();

    if (closedSession) {
      responseStatus = 409;
      responseMessage = 'Shift has already been opened and closed for this assignment';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Open shift session
    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('shift_sessions')
      .insert({
        user_id: userId,
        shift_assignment_id: validAssignment.id,
        status: 'open',
        first_order_number: first_order_number || null,
        salla_first_order_number: salla_first_order_number || null,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Send shift open notification
    try {
      await supabaseAdmin.functions.invoke('send-shift-open-notification', {
        body: {
          shiftId: validAssignment.shift_id,
          userId,
          shiftSessionId: newSession.id,
        },
      });
    } catch (notifError) {
      console.error('Error sending shift open notification:', notifError);
    }

    const shiftData = validAssignment.shifts as any;
    responseMessage = 'Shift checked in successfully';
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      shift_session_id: newSession.id,
      shift_reference: newSession.id,
      shift_assignment_id: validAssignment.id,
      shift_name: shiftData?.shift_name || null,
      shift_start_time: shiftData?.shift_start_time || null,
      shift_end_time: shiftData?.shift_end_time || null,
      shift_type: shiftData?.shift_types?.type || null,
      assignment_date: validAssignment.assignment_date,
      first_order_number,
      salla_first_order_number: salla_first_order_number || null,
      opened_at: newSession.opened_at,
      message: responseMessage
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRM Shift Check-in error:', error);
    responseStatus = 500;
    responseMessage = 'Internal server error';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ success: false, error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
