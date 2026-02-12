import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, tableName, offset = 0, limit = 1000, bucketId, filePath } = await req.json();
    console.log(`Migrate action: ${action}`);

    switch (action) {
      case 'list_tables': {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              t.tablename as name,
              COALESCE(s.n_live_tup, 0)::integer as row_count
            FROM pg_catalog.pg_tables t
            LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
            WHERE t.schemaname = 'public'
            ORDER BY t.tablename
          `
        });
        if (error) throw error;
        return jsonResponse({ success: true, tables: Array.isArray(data) ? data : [] });
      }

      case 'export_table_data': {
        if (!tableName) throw new Error('Missing tableName');
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `SELECT * FROM public."${tableName}" LIMIT ${limit} OFFSET ${offset}`
        });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : (data?.error ? [] : [data]);
        return jsonResponse({ success: true, rows, tableName });
      }

      case 'export_table_as_sql': {
        if (!tableName) throw new Error('Missing tableName');
        // Get column info
        const { data: colData, error: colErr } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' ORDER BY ordinal_position`
        });
        if (colErr) throw colErr;
        const columns = Array.isArray(colData) ? colData : [];
        
        // Get data
        const { data: rowData, error: rowErr } = await supabase.rpc('exec_sql', {
          sql: `SELECT * FROM public."${tableName}" LIMIT ${limit} OFFSET ${offset}`
        });
        if (rowErr) throw rowErr;
        const rows = Array.isArray(rowData) ? rowData : [];
        
        if (rows.length === 0) {
          return jsonResponse({ success: true, sql: '', rowCount: 0, tableName });
        }

        // Generate INSERT statements
        const colNames = columns.map((c: any) => `"${c.column_name}"`).join(', ');
        const insertStatements: string[] = [];
        
        for (const row of rows) {
          const values = columns.map((col: any) => {
            const val = row[col.column_name];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          insertStatements.push(`INSERT INTO public."${tableName}" (${colNames}) VALUES (${values});`);
        }

        return jsonResponse({ 
          success: true, 
          sql: insertStatements.join('\n'), 
          rowCount: rows.length, 
          tableName 
        });
      }

      case 'export_users': {
        // Export auth users using service role
        const { data: usersResult, error: usersErr } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              id, email, encrypted_password, email_confirmed_at, 
              raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
              phone, phone_confirmed_at, role, aud,
              confirmation_token, recovery_token, email_change_token_new,
              is_sso_user, deleted_at
            FROM auth.users 
            ORDER BY created_at
            LIMIT ${limit} OFFSET ${offset}
          `
        });
        if (usersErr) throw usersErr;
        const users = Array.isArray(usersResult) ? usersResult : [];
        
        // Get total count
        const { data: countResult } = await supabase.rpc('exec_sql', {
          sql: `SELECT COUNT(*)::integer as count FROM auth.users`
        });
        const totalCount = Array.isArray(countResult) ? countResult[0]?.count || 0 : 0;
        
        return jsonResponse({ success: true, users, totalCount });
      }

      case 'export_users_as_sql': {
        const { data: usersResult, error: usersErr } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              id, instance_id, aud, role, email, encrypted_password, 
              email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
              recovery_token, recovery_sent_at, email_change_token_new, email_change,
              email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
              is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
              phone_change, phone_change_token, phone_change_sent_at, 
              email_change_token_current, email_change_confirm_status,
              banned_until, reauthentication_token, reauthentication_sent_at,
              is_sso_user, deleted_at
            FROM auth.users 
            ORDER BY created_at
            LIMIT ${limit} OFFSET ${offset}
          `
        });
        if (usersErr) throw usersErr;
        const users = Array.isArray(usersResult) ? usersResult : [];
        
        if (users.length === 0) {
          return jsonResponse({ success: true, sql: '', rowCount: 0 });
        }

        const insertStatements: string[] = [];
        for (const user of users) {
          const cols: string[] = [];
          const vals: string[] = [];
          for (const [key, val] of Object.entries(user)) {
            cols.push(`"${key}"`);
            if (val === null || val === undefined) {
              vals.push('NULL');
            } else if (typeof val === 'number') {
              vals.push(String(val));
            } else if (typeof val === 'boolean') {
              vals.push(val ? 'TRUE' : 'FALSE');
            } else if (typeof val === 'object') {
              vals.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
            } else {
              vals.push(`'${String(val).replace(/'/g, "''")}'`);
            }
          }
          insertStatements.push(
            `INSERT INTO auth.users (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;`
          );
        }

        return jsonResponse({ success: true, sql: insertStatements.join('\n'), rowCount: users.length });
      }

      case 'list_storage_buckets': {
        const { data: buckets, error: bucketsErr } = await supabase.rpc('exec_sql', {
          sql: `SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at FROM storage.buckets ORDER BY name`
        });
        if (bucketsErr) throw bucketsErr;
        return jsonResponse({ success: true, buckets: Array.isArray(buckets) ? buckets : [] });
      }

      case 'list_storage_files': {
        if (!bucketId) throw new Error('Missing bucketId');
        const { data: files, error: filesErr } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT id, name, bucket_id, created_at, updated_at, metadata, 
                   COALESCE((metadata->>'size')::bigint, 0) as file_size
            FROM storage.objects 
            WHERE bucket_id = '${bucketId}'
            ORDER BY name
            LIMIT ${limit} OFFSET ${offset}
          `
        });
        if (filesErr) throw filesErr;
        
        const { data: countResult } = await supabase.rpc('exec_sql', {
          sql: `SELECT COUNT(*)::integer as count FROM storage.objects WHERE bucket_id = '${bucketId}'`
        });
        const totalCount = Array.isArray(countResult) ? countResult[0]?.count || 0 : 0;
        
        return jsonResponse({ success: true, files: Array.isArray(files) ? files : [], totalCount });
      }

      case 'get_storage_file_url': {
        if (!bucketId || !filePath) throw new Error('Missing bucketId or filePath');
        const { data: signedData } = await supabase.storage
          .from(bucketId)
          .createSignedUrl(filePath, 3600); // 1 hour
        
        return jsonResponse({ 
          success: true, 
          signedUrl: signedData?.signedUrl || null 
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Migrate error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function jsonResponse(data: any) {
  return new Response(
    JSON.stringify(data),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
