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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST and GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      console.log('No API key provided');
      return new Response(
        JSON.stringify({ success: false, error: 'API key is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key and check permission
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, is_active, allow_zk_attendance')
      .eq('api_key', apiKey)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.log('Invalid API key:', apiKeyError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyData.is_active) {
      console.log('API key is inactive');
      return new Response(
        JSON.stringify({ success: false, error: 'API key is inactive' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyData.allow_zk_attendance) {
      console.log('API key does not have ZK attendance permission');
      return new Response(
        JSON.stringify({ success: false, error: 'API key does not have ZK attendance permission' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch latest record', details: latestError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no records exist, return null values
      if (!latestRecord) {
        return new Response(
          JSON.stringify({
            success: true,
            last_date: null,
            last_time: null,
            last_employee_code: null,
            message: 'No attendance records found'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Returning latest attendance record:', latestRecord);
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
    
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'records array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        api_key_id: apiKeyData.id,
      });
    }

    if (validRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid records to insert',
          validation_errors: validationErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert records
    const { data: insertedData, error: insertError } = await supabase
      .from('zk_attendance_logs')
      .insert(validRecords)
      .select('id');

    if (insertError) {
      console.error('Error inserting records:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to insert records', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${insertedData.length} attendance records`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully received ${insertedData.length} attendance records`,
        inserted_count: insertedData.length,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
        skipped_count: validationErrors.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
