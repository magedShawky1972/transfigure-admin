import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Entity configuration mapping with test and production tables
const ENTITY_CONFIG: Record<string, { 
  testTable: string;
  productionTable: string;
  idField: string; 
  permission: string;
  displayName: string;
}> = {
  'salesheader': { 
    testTable: 'testsalesheader',
    productionTable: 'sales_order_header',
    idField: 'order_number', 
    permission: 'allow_sales_header',
    displayName: 'Sales Order Header'
  },
  'salesline': { 
    testTable: 'testsalesline',
    productionTable: 'sales_order_line',
    idField: 'order_number', 
    permission: 'allow_sales_line',
    displayName: 'Sales Order Line'
  },
  'payment': { 
    testTable: 'testpayment',
    productionTable: 'payment_transactions',
    idField: 'order_number', 
    permission: 'allow_payment',
    displayName: 'Payment'
  },
  'customer': { 
    testTable: 'testcustomers',
    productionTable: 'customers',
    idField: 'customer_phone', 
    permission: 'allow_customer',
    displayName: 'Customer'
  },
  'supplier': { 
    testTable: 'testsuppliers',
    productionTable: 'suppliers',
    idField: 'supplier_code', 
    permission: 'allow_supplier',
    displayName: 'Supplier'
  },
  'supplierproduct': { 
    testTable: 'testsupplierproducts',
    productionTable: 'supplier_products',
    idField: 'supplier_code', 
    permission: 'allow_supplier_product',
    displayName: 'Supplier Product'
  },
  'brand': { 
    testTable: 'testbrands',
    productionTable: 'brands',
    idField: 'brand_code', 
    permission: 'allow_brand',
    displayName: 'Brand'
  },
  'product': { 
    testTable: 'testproducts',
    productionTable: 'products',
    idField: 'sku', 
    permission: 'allow_product',
    displayName: 'Product'
  },
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;
  let entityType = '';
  let lookupId = '';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const logApiCall = async () => {
    try {
      await supabase.from('api_consumption_logs').insert({
        endpoint: `api-lookup/${entityType}`,
        method: req.method,
        request_body: { entity: entityType, id: lookupId },
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

  // Only allow GET method
  if (req.method !== 'GET') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use GET.';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify API key
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey) {
      responseStatus = 403;
      responseMessage = 'Invalid API key';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch API mode from settings
    const { data: modeData } = await supabase
      .from('api_integration_settings')
      .select('setting_value')
      .eq('setting_key', 'api_mode')
      .single();

    const apiMode = (modeData?.setting_value === 'production') ? 'production' : 'test';
    console.log(`API Lookup Mode: ${apiMode}`);

    // Parse URL to get entity type and ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: /api-lookup?entity=salesheader&id=ORDER123
    entityType = url.searchParams.get('entity') || '';
    lookupId = url.searchParams.get('id') || '';

    console.log(`Lookup request - Entity: ${entityType}, ID: ${lookupId}, Mode: ${apiMode}`);

    if (!entityType || !lookupId) {
      responseStatus = 400;
      responseMessage = 'Missing required parameters: entity and id';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        usage: 'GET /api-lookup?entity=<entity_type>&id=<lookup_id>',
        available_entities: Object.keys(ENTITY_CONFIG),
        current_mode: apiMode
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate entity type
    const entityConfig = ENTITY_CONFIG[entityType.toLowerCase()];
    if (!entityConfig) {
      responseStatus = 400;
      responseMessage = `Invalid entity type: ${entityType}`;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        available_entities: Object.keys(ENTITY_CONFIG),
        current_mode: apiMode
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check permission for the entity
    if (!apiKey[entityConfig.permission]) {
      responseStatus = 403;
      responseMessage = `Permission denied for ${entityConfig.displayName}`;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Select the appropriate table based on mode
    const targetTable = apiMode === 'production' 
      ? entityConfig.productionTable 
      : entityConfig.testTable;

    console.log(`Looking up in table: ${targetTable}`);

    // Perform the lookup
    const { data, error } = await supabase
      .from(targetTable)
      .select('*')
      .eq(entityConfig.idField, lookupId);

    if (error) {
      console.error(`Error looking up ${entityType}:`, error);
      responseStatus = 500;
      responseMessage = error.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exists = data && data.length > 0;
    responseMessage = exists 
      ? `${entityConfig.displayName} found` 
      : `${entityConfig.displayName} not found`;

    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      exists,
      entity: entityType,
      id: lookupId,
      mode: apiMode,
      table: targetTable,
      count: data?.length || 0,
      data: data || [],
      message: responseMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in api-lookup:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
