import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface AttendanceRecord {
  employee_code: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS or HH:MM
  record_type?: 'entry' | 'exit' | 'unknown';
}

interface AttendancePayload {
  records: AttendanceRecord[];
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logApiCall = async () => {
    try {
      await supabase.from('api_consumption_logs').insert({
        endpoint: 'api-zk-attendance',
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

  // Only allow POST and GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    responseStatus = 405;
    responseMessage = 'Method not allowed';
    success = false;
    await logApiCall();
    return new Response(
      JSON.stringify({ success: false, error: responseMessage }),
      { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      console.log('No API key provided');
      responseStatus = 401;
      responseMessage = 'API key is required';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key and check permission
    const { data: keyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, description, is_active, allow_zk_attendance')
      .eq('api_key', apiKey)
      .single();

    apiKeyData = keyData;

    if (apiKeyError || !keyData) {
      console.log('Invalid API key:', apiKeyError?.message);
      responseStatus = 401;
      responseMessage = 'Invalid API key';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!keyData.is_active) {
      console.log('API key is inactive');
      responseStatus = 401;
      responseMessage = 'API key is inactive';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!keyData.allow_zk_attendance) {
      console.log('API key does not have ZK attendance permission');
      responseStatus = 403;
      responseMessage = 'API key does not have ZK attendance permission';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle GET request - return latest attendance date/time
    if (req.method === 'GET') {
      const { data: latestRecord, error: latestError } = await supabase
        .from('zk_attendance_logs')
        .select('attendance_date, attendance_time, employee_code')
        .order('attendance_date', { ascending: false })
        .order('attendance_time', { ascending: false })
        .limit(1)
        .single();

      if (latestError && latestError.code !== 'PGRST116') {
        console.error('Error fetching latest record:', latestError);
        responseStatus = 500;
        responseMessage = 'Failed to fetch latest record';
        success = false;
        await logApiCall();
        return new Response(
          JSON.stringify({ success: false, error: responseMessage, details: latestError.message }),
          { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no records exist, return null values
      if (!latestRecord) {
        responseMessage = 'No attendance records found';
        await logApiCall();
        return new Response(
          JSON.stringify({
            success: true,
            last_date: null,
            last_time: null,
            last_employee_code: null,
            message: responseMessage
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Returning latest attendance record:', latestRecord);
      responseMessage = 'Latest attendance record retrieved';
      await logApiCall();
      return new Response(
        JSON.stringify({
          success: true,
          last_date: latestRecord.attendance_date,
          last_time: latestRecord.attendance_time,
          last_employee_code: latestRecord.employee_code
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST request - insert attendance records
    const body: AttendancePayload = await req.json();
    requestBody = body;
    
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      responseStatus = 400;
      responseMessage = 'records array is required and must not be empty';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each record
    const validationErrors: string[] = [];
    const validRecords: any[] = [];

    for (let i = 0; i < body.records.length; i++) {
      const record = body.records[i];
      
      if (!record.employee_code) {
        validationErrors.push(`Record ${i + 1}: employee_code is required`);
        continue;
      }
      
      if (!record.date) {
        validationErrors.push(`Record ${i + 1}: date is required`);
        continue;
      }
      
      if (!record.time) {
        validationErrors.push(`Record ${i + 1}: time is required`);
        continue;
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(record.date)) {
        validationErrors.push(`Record ${i + 1}: date must be in YYYY-MM-DD format`);
        continue;
      }

      // Reject future dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recordDate = new Date(record.date);
      if (recordDate > today) {
        validationErrors.push(`Record ${i + 1}: future date (${record.date}) is not allowed`);
        continue;
      }

      // Validate time format (HH:MM or HH:MM:SS)
      const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
      if (!timeRegex.test(record.time)) {
        validationErrors.push(`Record ${i + 1}: time must be in HH:MM or HH:MM:SS format`);
        continue;
      }

      validRecords.push({
        employee_code: record.employee_code.trim(),
        attendance_date: record.date,
        attendance_time: record.time,
        record_type: record.record_type || 'unknown',
        raw_data: record,
        api_key_id: keyData.id,
      });
    }

    if (validRecords.length === 0) {
      responseStatus = 400;
      responseMessage = 'No valid records to insert';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseMessage,
          validation_errors: validationErrors 
        }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert records
    const { data: insertedData, error: insertError } = await supabase
      .from('zk_attendance_logs')
      .insert(validRecords)
      .select('id');

    if (insertError) {
      console.error('Error inserting records:', insertError);
      responseStatus = 500;
      responseMessage = 'Failed to insert records';
      success = false;
      await logApiCall();
      return new Response(
        JSON.stringify({ success: false, error: responseMessage, details: insertError.message }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${insertedData.length} attendance records`);
    responseMessage = `Successfully received ${insertedData.length} attendance records`;
    await logApiCall();

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        inserted_count: insertedData.length,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
        skipped_count: validationErrors.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: responseMessage }),
      { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
