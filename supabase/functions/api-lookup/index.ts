import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Entity configuration mapping
const ENTITY_CONFIG: Record<string, { 
  table: string; 
  idField: string; 
  permission: string;
  displayName: string;
}> = {
  'salesheader': { 
    table: 'testsalesheader', 
    idField: 'order_number', 
    permission: 'allow_sales_header',
    displayName: 'Sales Order Header'
  },
  'salesline': { 
    table: 'testsalesline', 
    idField: 'order_number', 
    permission: 'allow_sales_line',
    displayName: 'Sales Order Line'
  },
  'payment': { 
    table: 'testpayment', 
    idField: 'order_number', 
    permission: 'allow_payment',
    displayName: 'Payment'
  },
  'customer': { 
    table: 'testcustomers', 
    idField: 'customer_phone', 
    permission: 'allow_customer',
    displayName: 'Customer'
  },
  'supplier': { 
    table: 'testsuppliers', 
    idField: 'supplier_code', 
    permission: 'allow_supplier',
    displayName: 'Supplier'
  },
  'supplierproduct': { 
    table: 'testsupplierproducts', 
    idField: 'supplier_code', 
    permission: 'allow_supplier_product',
    displayName: 'Supplier Product'
  },
  'brand': { 
    table: 'testbrands', 
    idField: 'brand_code', 
    permission: 'allow_brand',
    displayName: 'Brand'
  },
  'product': { 
    table: 'testproducts', 
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

    // Parse URL to get entity type and ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: /api-lookup?entity=salesheader&id=ORDER123
    entityType = url.searchParams.get('entity') || '';
    lookupId = url.searchParams.get('id') || '';

    console.log(`Lookup request - Entity: ${entityType}, ID: ${lookupId}`);

    if (!entityType || !lookupId) {
      responseStatus = 400;
      responseMessage = 'Missing required parameters: entity and id';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        usage: 'GET /api-lookup?entity=<entity_type>&id=<lookup_id>',
        available_entities: Object.keys(ENTITY_CONFIG)
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
        available_entities: Object.keys(ENTITY_CONFIG)
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

    // Perform the lookup
    const { data, error } = await supabase
      .from(entityConfig.table)
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
