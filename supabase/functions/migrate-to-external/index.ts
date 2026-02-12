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
        const perPage = Math.min(limit, 1000);
        const page = Math.floor(offset / perPage) + 1;
        
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listErr) throw listErr;
        const users = (listData?.users || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          email_confirmed_at: u.email_confirmed_at,
          raw_user_meta_data: u.user_metadata,
          raw_app_meta_data: u.app_metadata,
          created_at: u.created_at,
          updated_at: u.updated_at,
          phone: u.phone,
          phone_confirmed_at: u.phone_confirmed_at,
          role: u.role,
          aud: u.aud,
          is_sso_user: false,
          deleted_at: null,
        }));
        
        const totalCount = listData?.total || users.length;
        
        return jsonResponse({ success: true, users, totalCount });
      }

      case 'export_users_as_sql': {
        // Use admin API to reliably list users instead of querying auth.users directly
        const perPage = Math.min(limit, 1000);
        const page = Math.floor(offset / perPage) + 1;
        
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listErr) throw listErr;
        const users = listData?.users || [];
        
        if (users.length === 0) {
          return jsonResponse({ success: true, sql: '', rowCount: 0 });
        }

        // Also get encrypted passwords via SQL since admin API doesn't return them
        const userIds = users.map(u => `'${u.id}'`).join(',');
        const { data: pwData } = await supabase.rpc('exec_sql', {
          sql: `SELECT id, encrypted_password FROM auth.users WHERE id IN (${userIds})`
        });
        const pwMap: Record<string, string> = {};
        if (Array.isArray(pwData)) {
          for (const row of pwData) {
            pwMap[row.id] = row.encrypted_password;
          }
        }

        const insertStatements: string[] = [];
        for (const user of users) {
          const encPw = pwMap[user.id] || '';
          const meta = user.user_metadata ? JSON.stringify(user.user_metadata).replace(/'/g, "''") : '{}';
          const appMeta = user.app_metadata ? JSON.stringify(user.app_metadata).replace(/'/g, "''") : '{}';
          
          const vals = [
            `'${user.id}'`,
            `'00000000-0000-0000-0000-000000000000'`, // instance_id
            `'authenticated'`, // aud
            `'authenticated'`, // role
            user.email ? `'${user.email.replace(/'/g, "''")}'` : 'NULL',
            encPw ? `'${encPw.replace(/'/g, "''")}'` : 'NULL',
            user.email_confirmed_at ? `'${user.email_confirmed_at}'` : 'NULL',
            'NULL', // invited_at
            `''`, // confirmation_token
            'NULL', // confirmation_sent_at
            `''`, // recovery_token
            'NULL', // recovery_sent_at
            `''`, // email_change_token_new
            `''`, // email_change
            'NULL', // email_change_sent_at
            user.last_sign_in_at ? `'${user.last_sign_in_at}'` : 'NULL',
            `'${appMeta}'::jsonb`,
            `'${meta}'::jsonb`,
            'FALSE', // is_super_admin
            `'${user.created_at}'`,
            `'${user.updated_at || user.created_at}'`,
            user.phone ? `'${user.phone}'` : 'NULL',
            user.phone_confirmed_at ? `'${user.phone_confirmed_at}'` : 'NULL',
            `''`, // phone_change
            `''`, // phone_change_token
            'NULL', // phone_change_sent_at
            `''`, // email_change_token_current
            '0', // email_change_confirm_status
            'NULL', // banned_until
            `''`, // reauthentication_token
            'NULL', // reauthentication_sent_at
            'FALSE', // is_sso_user
            'NULL', // deleted_at
          ];

          insertStatements.push(
            `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;`
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
