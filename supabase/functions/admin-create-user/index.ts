import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sysadmin-session',
};

// Full list of menu items for admin permissions
const ALL_MENU_ITEMS = [
  "dashboard", "ticket_dashboard", "shift_dashboard", "task_dashboard", "user_dashboard",
  "api_documentation", "apiIntegrationStatus", "softwareLicenses", "reports", "transactions", "pivotTable",
  "loadData", "uploadLog", "clearData", "tickets", "admin_tickets", "softwareLicenseSetup",
  "shiftSession", "myShifts", "shiftFollowUp", "tawasoul", "companyNews", "reportsSetup",
  "customerSetup", "customerProfile", "customerTotals", "brandSetup", "brandType",
  "productSetup", "paymentMethodSetup", "department_management", "userSetup", "shiftSetup",
  "shiftCalendar", "currencySetup", "userGroupSetup", "projectsTasks", "companyHierarchy",
  "supplierSetup", "userLogins", "userEmails", "asusTawasoul", "emailManager", "mailSetup",
  "systemConfig", "closingTraining", "odooSetup", "excelSetup", "tableConfig", "pdfToExcel",
  "systemBackup", "systemRestore", "employeeSetup", "vacationSetup", "timesheetManagement",
  "deductionRulesSetup", "medicalInsuranceSetup", "shiftPlansSetup", "documentTypeSetup", "attendanceTypeSetup"
];

// Dashboard components
const ALL_DASHBOARD_COMPONENTS = [
  "sales_metrics", "total_profit", "points_sales", "transaction_count", "new_customers",
  "avg_order_metrics", "income_statement", "transaction_type_chart", "user_transaction_count_chart",
  "user_transaction_value_chart", "brand_sales_grid", "coins_by_brand", "sales_trend_chart",
  "top_brands_chart", "top_products_chart", "month_comparison_chart", "payment_methods_chart",
  "payment_brands_chart", "unused_payment_brands", "product_summary_table", "customer_purchases_table",
  "inactive_customers_section", "recent_transactions"
];

// Reports
const ALL_REPORTS = [
  "revenue-by-brand-type", "cost-by-brand-type", "tickets", "software-licenses",
  "shift-report", "shift-plan", "brand-balance", "api-documentation",
  "transaction-statistics", "order-payment", "data-loading-status", "coins-ledger", "bank-statement"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Admin create user function called');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check for sysadmin session (special header for initial setup)
    const sysadminSession = req.headers.get('x-sysadmin-session');
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    let isSysadminSetup = false;

    if (sysadminSession === 'true') {
      // Sysadmin session - check if no users exist (initial setup)
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (count === 0) {
        console.log('Sysadmin session authorized - no users exist, allowing first user creation');
        isAuthorized = true;
        isSysadminSetup = true;
      } else {
        console.log('Sysadmin session denied - users already exist');
        return new Response(
          JSON.stringify({ error: 'Users already exist. Use regular admin login.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (authHeader) {
      // Regular auth flow
      const token = authHeader.replace('Bearer ', '');
      console.log('Token extracted, length:', token.length);
      
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      console.log('Auth validation result:', { userId: user?.id, hasError: !!authError, errorMsg: authError?.message });

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has admin role
      console.log('Checking admin role for user:', user.id);
      const { data: hasAdminRole, error: roleError } = await supabaseAdmin
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      console.log('Role check result:', { hasAdminRole, roleError: roleError?.message });

      if (roleError || !hasAdminRole) {
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin access required', details: roleError?.message }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      isAuthorized = true;
    } else {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authorized, proceeding with user creation');

    const { email, user_name, mobile_number, is_active, password, job_position_id, is_admin } = await req.json();

    // Use provided password or default to "123456"
    const userPassword = password || '123456';

    // Create user with admin API (bypasses rate limiting)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        user_name,
      },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile (trigger already created it) with additional fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        user_name,
        mobile_number: mobile_number || null,
        is_active,
        must_change_password: true, // Force password change on first login
        job_position_id: job_position_id || null,
      })
      .eq('user_id', newUser.user.id);

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this is the first user (sysadmin setup) OR is_admin is true, assign admin role and all permissions
    const shouldMakeAdmin = isSysadminSetup || is_admin === true;
    
    if (shouldMakeAdmin) {
      console.log('Assigning admin role to user:', newUser.user.id);
      
      // Add admin role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'admin',
        });
      
      if (roleError) {
        console.error('Error assigning admin role:', roleError);
      }

      // If first user (sysadmin setup), grant all permissions
      if (isSysadminSetup) {
        console.log('First user - granting all permissions');
        
        // Grant all menu permissions
        const menuPermissions = ALL_MENU_ITEMS.map(menuItem => ({
          user_id: newUser.user.id,
          menu_item: menuItem,
          has_access: true,
          parent_menu: null,
        }));

        // Grant all dashboard component permissions
        const dashboardPermissions = ALL_DASHBOARD_COMPONENTS.map(component => ({
          user_id: newUser.user.id,
          menu_item: component,
          has_access: true,
          parent_menu: 'dashboard',
        }));

        // Grant all report permissions
        const reportPermissions = ALL_REPORTS.map(report => ({
          user_id: newUser.user.id,
          menu_item: report,
          has_access: true,
          parent_menu: 'reports',
        }));

        const allPermissions = [...menuPermissions, ...dashboardPermissions, ...reportPermissions];
        
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .insert(allPermissions);
        
        if (permError) {
          console.error('Error granting permissions:', permError);
        } else {
          console.log('All permissions granted successfully');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        },
        isFirstUser: isSysadminSetup,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
