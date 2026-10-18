import { beforeEach, expect, mock, test } from 'bun:test';

let handler: (request: Request) => Promise<Response>;
let mode = 'production';
let write: { payload: Record<string, unknown>; onConflict: string } | undefined;
const client = {
  from(table: string) {
    const query = {
      select() { return query; },
      eq() { return query; },
      insert() { return Promise.resolve({ error: null }); },
      upsert(payload: Record<string, unknown>, options: { onConflict: string }) {
        write = { payload, ...options };
        return query;
      },
      single() {
        if (table === 'api_keys') return Promise.resolve({ data: { id: 'test-key', allow_product: true }, error: null });
        if (table === 'api_integration_settings') return Promise.resolve({ data: { setting_value: mode }, error: null });
        return Promise.resolve({ data: write?.payload, error: null });
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return query;
  },
};

mock.module('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => client }));
Object.assign(globalThis, { Deno: { env: { get: () => 'test' }, serve: (fn: typeof handler) => { handler = fn; } } });
await import('./index.ts');

beforeEach(() => { write = undefined; mode = 'production'; });

const send = (body: Record<string, unknown>) => handler(new Request('http://localhost/api-product', {
  method: 'POST', headers: { Authorization: 'test-key', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

test('production uses the unique product ID, not the nonunique SKU', async () => {
  const response = await send({ Product_id: 2375, SKU: 2375, Name: 'Product', Cost_price: '646.40000000', Sales_Price: 692.074 });
  expect(response.status).toBe(200);
  expect(write?.onConflict).toBe('product_id');
  expect(write?.payload.product_id).toBe('2375');
  expect(write?.payload.product_price).toBe('692.074');
});

test('test mode retains its unique SKU conflict target', async () => {
  mode = 'test';
  expect((await send({ SKU: 2375, Name: 'Product' })).status).toBe(200);
  expect(write?.onConflict).toBe('sku');
});

test('production rejects missing product identity before writing', async () => {
  const response = await send({ SKU: 2375, Name: 'Product' });
  expect(response.status).toBe(400);
  expect((await response.json()).missing).toContain('Product_id');
  expect(write).toBeUndefined();
});