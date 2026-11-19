// Only documented fields are relayed; incoming credentials are never forwarded.
declare const Deno: { env: { get(name: string): string | undefined } };
const FIELDS = {
  'api-salesheader': ['Order_Number', 'Customer_Phone', 'Order_date', 'Payment_Term', 'Sales_person', 'Transaction_Type', 'Media', 'Profit_Center', 'Company', 'Status', 'Status_Description', 'Customer_IP', 'Device_Fingerprint', 'Transaction_Location', 'Register_User_ID', 'Player_Id', 'Point_Value', 'Point', 'Customer_Name'],
  'api-salesline': ['Order_Number', 'Line_Number', 'Line_Status', 'Product_SKU', 'Product_Id', 'Quantity', 'Unit_price', 'Total', 'Coins_Number', 'Cost_Price', 'Total_Cost', 'Player_Id', 'Vendor_Name'],
  'api-payment': ['Order_number', 'Payment_method', 'Payment_brand', 'Payment_Amount', 'Payment_reference', 'Payment_Card_Number', 'Bank_Transaction_Id', 'Redemption_IP', 'Payment_Location'],
  'api-customer': ['Customer_Phone', 'Customer_name', 'Customer_email', 'Customer_group', 'Status', 'Is_blocked', 'Block_reason', 'Register_date', 'Last_transaction'],
  'api-brand': ['Brand_Code', 'Brand_Name', 'Brand_Parent', 'Status'],
  'api-product': ['Product_id', 'SKU', 'Name', 'UOM', 'Brand_Code', 'Reorder_Point', 'Minimum_order', 'Maximum_order', 'Cost_price', 'Sales_Price', 'AR_Meta_Title', 'AR_Meta_Keywords', 'AR_Meta_Description', 'ENG_Meta_Title', 'ENG_Meta_Keywords', 'ENG_Meta_Description'],
} as const;

export type KoonEndpoint = keyof typeof FIELDS;
type Body = Record<string, unknown>;
export type KoonResult = { success: boolean; status: number; response: unknown };

export function buildKoonBody(endpoint: KoonEndpoint, source: Body, saved: Body = {}): Body {
  const body: Body = {};
  for (const field of FIELDS[endpoint]) {
    const value = source[field] ?? source[field.toLowerCase()] ?? saved[field.toLowerCase()];
    if (value !== undefined) body[field] = value;
  }
  if (endpoint === 'api-salesheader') {
    body.Order_Number = source.Order_Number ?? source.ordernumber ?? saved.order_number;
    body.Order_date = saved.order_date ?? body.Order_date ?? source.created_at_date;
    body.Status = saved.status ?? body.Status;
    body.Sales_person = source.Sales_person ?? source.User_Name ?? saved.sales_person;
    body.Player_Id = source.Player_Id ?? source.Player_ID ?? saved.player_id;
    body.Point = source.Point ?? source.point ?? saved.is_point;
  }
  if (endpoint === 'api-salesline') body.Line_Number = saved.line_number ?? body.Line_Number;
  // Preserve the original master-data bit flags, not EDARA's active/suspended text.
  for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
  return body;
}

/** Called only after the incoming API's authentication, validation and local save.
 * Await delivery before replying. Never retry automatically: KOON payments insert
 * on every call, and a network timeout does not prove that insertion failed.
 */
export async function forwardToKoon(
  endpoint: KoonEndpoint,
  source: Body,
  saved: Body,
  client: { from: (table: string) => { insert: (row: Body) => PromiseLike<unknown> } },
): Promise<KoonResult> {
  const started = Date.now();
  const body = buildKoonBody(endpoint, source, saved);
  const gatewayKey = Deno.env.get('LOVABLE_API_KEY');
  const connectionKey = Deno.env.get('UDC_KOON_BRANCH_INTEGRATION_API_KEY');
  const redact = (text: string) => [gatewayKey, connectionKey].reduce(
    (safe, key) => key ? safe.split(key).join('[REDACTED]') : safe,
    text.replace(/\b(?:kbt|kbr)_[a-zA-Z0-9]+\b/g, '[REDACTED]'),
  );
  let result: KoonResult;
  try {
    if (!gatewayKey || !connectionKey) throw new Error('KOON connection is not configured');
    const response = await fetch(`https://connector-gateway.lovable.dev/udc_koon_branch_integration/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gatewayKey}`, 'X-Connection-Api-Key': connectionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const text = redact(await response.text());
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    result = { success: response.ok && typeof data === 'object' && data !== null && 'success' in data && data.success === true, status: response.status, response: data };
  } catch (error) {
    result = { success: false, status: 0, response: { error: redact(error instanceof Error ? error.message : 'KOON delivery failed'), delivery_unknown: true } };
  }
  try {
    await client.from('api_consumption_logs').insert({
      endpoint: `koon-${endpoint}`, method: 'POST', request_body: body,
      response_status: result.status || 502, response_message: JSON.stringify(result.response),
      success: result.success, execution_time_ms: Date.now() - started,
      api_key_description: 'KOON forwarding',
    });
  } catch { console.error('Could not record KOON delivery log'); }
  return result;
}