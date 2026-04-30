import { createClient } from '@supabase/supabase-js';

const url = 'https://ysqqnkbgkrjoxrzlejxy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcXFua2Jna3Jqb3hyemxlanh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgwNzAsImV4cCI6MjA3NDgyNDA3MH0._x2rVaRxVwYBvxxbOFgRNClPWClIQkWH-4yi8c_UvAU';
const supabase = createClient(url, key);

const { data, error } = await supabase
  .from('shift_brand_balances')
  .select(`
    brand_id,
    closing_balance,
    shift_sessions!inner(
      id,
      closed_at,
      shift_assignments!inner(
        assignment_date,
        shifts(
          shift_name,
          shift_order,
          shift_types(type)
        )
      )
    )
  `)
  .limit(5);

if (error) {
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
