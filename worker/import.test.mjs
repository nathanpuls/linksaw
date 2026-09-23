import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';

test('import retries do not create duplicate snippets and require authentication', async () => {
  let batches = 0; const saved = new Map();
  const env = { DB: {
    prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('JOIN users')) return { id: 'user-1' };
        if (sql.includes('SELECT id FROM snippets')) return saved.get(this.values[0]) || null;
        throw new Error('Unexpected query');
      } }; },
    async batch(statements) { batches++; const first = statements[0]; saved.set(first.values[0], { id: first.values[0] }); return []; },
  } };
  const body = { title: 'Test', body: 'Hello', importId: '12345678-1234-4123-8123-123456789abc' };
  const request = (authorized = true) => new Request('https://test/snippets', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${'a'.repeat(64)}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await worker.fetch(request(false), env)).status, 401);
  assert.equal((await worker.fetch(request(), env)).status, 201);
  assert.equal((await worker.fetch(request(), env)).status, 200);
  assert.equal(batches, 1);
});

test('legacy detail cleanup is authenticated and scoped to the signed-in owner', async () => {
  let deletedFor = null;
  const env = { DB: { prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; },
    async first() { if (sql.includes('JOIN users')) return { id: 'user-1' }; throw new Error('Unexpected query'); },
    async run() { deletedFor = this.values[0]; return { meta: { changes: 3 } }; } }; } } };
  const request = new Request('https://test/details', { method: 'DELETE', headers: { Authorization: `Bearer ${'a'.repeat(64)}` } });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  assert.equal(deletedFor, 'user-1');
  assert.deepEqual(await response.json(), { ok: true, deleted: 3 });
});
