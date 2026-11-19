import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildKoonBody, forwardToKoon, getFailedKoonRetryEndpoint, type KoonEndpoint } from '../../supabase/functions/_shared/koon-forward';

const endpoints: KoonEndpoint[] = ['api-salesheader', 'api-salesline', 'api-payment', 'api-customer', 'api-brand', 'api-product'];
test('header aliases map to KOON fields and retain zero and false', () => {
  const body = buildKoonBody('api-salesheader', { order_number: 'ORDER-TEST', User_Name: 'Employee A', Player_ID: 'PLAYER-TEST', point: false }, { order_number: 'ORDER-TEST', status: 0, order_date: '2026-11-19' });
  assert.equal(body.Order_Number, 'ORDER-TEST'); assert.equal(body.Status, 0);
  assert.equal(body.Point, false); assert.equal(body.Player_Id, 'PLAYER-TEST'); assert.equal(body.Sales_person, 'Employee A');
});
test('KOON sales lines use EDARA assigned sequential line number', () => {
  assert.equal(buildKoonBody('api-salesline', { Line_Number: 867 }, { line_number: 2 }).Line_Number, 2);
});
test('relay excludes credentials and undocumented fields', () => {
  assert.deepEqual(buildKoonBody('api-brand', { Brand_Code: 'TEST', Brand_Name: 'Test Brand', Status: false, api_key: 'not-a-real-key' }), { Brand_Code: 'TEST', Brand_Name: 'Test Brand', Status: false });
});
for (const endpoint of endpoints) {
  test(`${endpoint} rejected local requests never forward`, async () => {
    const source = readFileSync(new URL(`../../supabase/functions/${endpoint}/index.ts`, import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
    let handler: ((req: Request) => Promise<Response>) | undefined;
    let sends = 0;
    runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      Deno: { env: { get: () => undefined }, serve: (fn: typeof handler) => { handler = fn; } },
      createClient: () => ({ from: () => ({ insert: async () => ({}) }) }),
      forwardToKoon: () => { sends++; }, corsHeaders: {}, Response, Date, console,
    });
    if (!handler) throw new Error('Missing handler');
    const res = await handler(new Request('https://example.test', { method: 'POST', body: '{}' }));
    assert.equal(res.status, 401); assert.equal(sends, 0);
  });
}
test('only failed KOON logs with a saved object body are retryable', () => {
  const failed = { endpoint: 'koon-api-payment', success: false, request_body: { Order_number: 'TEST-ORDER' } };
  assert.equal(getFailedKoonRetryEndpoint(failed), 'api-payment');
  assert.equal(getFailedKoonRetryEndpoint({ ...failed, success: true }), null);
  assert.equal(getFailedKoonRetryEndpoint({ ...failed, endpoint: 'api-payment' }), null);
  assert.equal(getFailedKoonRetryEndpoint({ ...failed, endpoint: 'koon-unknown' }), null);
  assert.equal(getFailedKoonRetryEndpoint({ ...failed, request_body: null }), null);
});
test('provider failure remains separate and insert-only payments are attempted exactly once', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0; const logs: unknown[] = [];
  Object.assign(globalThis, { Deno: { env: { get: () => 'fake-test-credential' } } });
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ success: false, error: 'Validation rejected' }), { status: 400 }); };
  try {
    const result = await forwardToKoon('api-payment', { Order_number: 'TEST-ORDER' }, {}, { from: () => ({ insert: async row => { logs.push(row); } }) });
    assert.equal(result.success, false); assert.equal(result.status, 400); assert.equal(calls, 1); assert.equal(logs.length, 1);
  } finally { globalThis.fetch = originalFetch; Reflect.deleteProperty(globalThis, 'Deno'); }
});
test('manual retry updates the original failed log and does not insert a duplicate audit row', async () => {
  const originalFetch = globalThis.fetch;
  const updates: any[] = []; const inserts: unknown[] = [];
  Object.assign(globalThis, { Deno: { env: { get: () => 'fake-test-credential' } } });
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  const client = { from: () => ({
    insert: async (row: unknown) => { inserts.push(row); },
    update: (row: unknown) => { updates.push(row); return { eq: () => ({ select: async () => ({ data: [{ id: 'retry-log' }], error: null }) }) }; },
  }) };
  try {
    const result = await forwardToKoon('api-brand', { Brand_Code: 'TEST', Brand_Name: 'Test Brand' }, {}, client, { retryLogId: 'retry-log' });
    assert.equal(result.success, true);
    assert.equal(inserts.length, 0);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].success, true);
    assert.equal(updates[0].retry_started_at, null);
    assert.equal(updates[0].api_key_description, 'KOON manual retry');
  } finally { globalThis.fetch = originalFetch; Reflect.deleteProperty(globalThis, 'Deno'); }
});