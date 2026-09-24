import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "./index.mjs";
import { sha256Base64Url } from "./lib.mjs";

test("signed-in home route resolves the app directory index without changing the visible route", async () => {
  let assetUrl = "";
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ id: "user", email: "user@example.com", display_name: "User" }) };
          },
        };
      },
    },
    ASSETS: {
      async fetch(request) {
        assetUrl = request.url;
        return new Response("app", { status: 200 });
      },
    },
  };
  const request = new Request("https://linksaw.com/home/", {
    headers: { Cookie: `linksaw_session=${"a".repeat(64)}` },
  });

  const response = await handle(request, env);

  assert.equal(response.status, 200);
  assert.equal(assetUrl, "https://linksaw.com/app/");
});

test("home route without a trailing slash has one canonical redirect", async () => {
  const response = await handle(new Request("https://linksaw.com/home"), { DB: {} });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "https://linksaw.com/home/");
});

test("signed-in root visits enter the app unless the website override is present", async () => {
  const user = { id: "user", email: "user@example.com" };
  const env = {
    DB: { prepare() { return { bind() { return { first: async () => user }; } }; } },
    ASSETS: { async fetch() { return new Response('<a id="primary-cta" class="primary-cta" href="/login"><svg class="google-g"></svg><span>Continue with Google</span></a>', { headers: { "Content-Type": "text/html" } }); } },
  };
  const headers = { Cookie: `linksaw_session=${"a".repeat(64)}` };
  const redirect = await handle(new Request("https://linksaw.com/", { headers }), env);
  assert.equal(redirect.headers.get("Location"), "https://linksaw.com/home/");
  const website = await handle(new Request("https://linksaw.com/?website=1", { headers }), env);
  const html = await website.text();
  assert.equal(website.status, 200);
  assert.match(html, /href="\/home\/"/);
  assert.match(html, />Open Linksaw</);
  assert.doesNotMatch(html, /Continue with Google/);
});

test("signed-out homepage is served directly as a static asset", async () => {
  let assetUrl = "";
  const env = {
    DB: {},
    ASSETS: {
      async fetch(request) {
        assetUrl = request.url;
        return new Response("homepage", { status: 200 });
      },
    },
  };

  const response = await handle(new Request("https://linksaw.com/"), env);

  assert.equal(response.status, 200);
  assert.equal(assetUrl, "https://linksaw.com/");
});

test("mobile install assets are public static assets", async () => {
  const requested = [];
  const env = {
    DB: {},
    ASSETS: {
      async fetch(request) {
        requested.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  };

  for (const path of ["/app/site.webmanifest", "/app/favicon.png", "/app/icon-192.png", "/app/icon-512.png"]) {
    const response = await handle(new Request(`https://linksaw.com${path}`), env);
    assert.equal(response.status, 200);
  }

  assert.deepEqual(requested, ["/app/site.webmanifest", "/app/favicon.png", "/app/icon-192.png", "/app/icon-512.png"]);
});

test("every browser module is served as a static asset", async () => {
  const requested = [];
  const env = {
    DB: {},
    ASSETS: { async fetch(request) { requested.push(new URL(request.url).pathname); return new Response("module", { status: 200 }); } },
  };

  for (const path of ["/app/app.js", "/app/linkify.js", "/app/transfers.js"]) {
    const response = await handle(new Request(`https://linksaw.com${path}`), env);
    assert.equal(response.status, 200);
  }

  assert.deepEqual(requested, ["/app/app.js", "/app/linkify.js", "/app/transfers.js"]);
});

test("public share pages render without sign-in and escape snippet content", async () => {
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM snippet_shares JOIN snippets/);
        return {
          bind(token) {
            assert.equal(token, "Ab3k9Qx7Lm2N4pRs");
        return { first: async () => ({ title: "Example <title>", body: `<script>alert("no")</script>\n\`README.md\`\nhttps://example.com/docs.\nhi@example.com\nCall (312) 555-1212 or +44 20 7946 0958.\n123 Main St, Suite 110,\nKingwood, TX 77339` }) };
          },
        };
      },
    },
  };

  const response = await handle(new Request("https://linksaw.com/s/Ab3k9Qx7Lm2N4pRs"), env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Security-Policy"), /script-src 'nonce-/);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.match(html, /<link rel="icon" href="\/icon\.png" type="image\/png">/);
  assert.match(html, /<a class="home" href="https:\/\/linksaw\.com\/" aria-label="Linksaw home" data-tooltip="Linksaw home">/);
  assert.match(html, /<header class="topbar">[\s\S]*id="copy"/);
  assert.match(html, /@media\(hover:none\),\(pointer:coarse\)\{\[data-tooltip\]::after\{display:none\}\}/);
  assert.match(html, /<article class="snippet-container"><h1 class="title"[\s\S]*<pre id="snippet-content" class="content">/);
  assert.match(html, /\.snippet-container\{width:min\(900px,100%\);margin:0 auto;padding:8px 36px 48px\}/);
  assert.doesNotMatch(html, /border-bottom/);
  assert.match(html, /aria-live="polite"[\s\S]*Copied to clipboard/);
  assert.match(html, /m20 6-11 11-5/);
  assert.match(html, /Could not copy to clipboard/);
  assert.doesNotMatch(html, />Copied<\/div>/);
  assert.doesNotMatch(html, /\stitle=/);
  assert.match(html, /transition-delay:\.45s/);
  assert.match(html, /Example &lt;title&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /href="https:\/\/example\.com\/docs"/);
  assert.doesNotMatch(html, /href="https:\/\/README\.md"/);
  assert.doesNotMatch(html, /href="https:\/\/example\.com\/docs`"/);
  assert.match(html, /href="tel:3125551212">\(312\) 555-1212<\/a>/);
  assert.match(html, /href="tel:\+442079460958">\+44 20 7946 0958<\/a>/);
  assert.match(html, /href="mailto:hi@example\.com">hi@example\.com<\/a>/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=123%20Main%20St%2C%20Suite%20110%20Kingwood%2C%20TX%2077339" target="_blank" rel="noopener noreferrer">123 Main St, Suite 110,\nKingwood, TX 77339<\/a>/);
  assert.match(html, /text-decoration-thickness:1\.2px[\s\S]*text-decoration-skip-ink:none[\s\S]*word-break:break-word/);
});

test("public share keeps a title that matches its content", async () => {
  const env = {
    DB: { prepare() { return { bind() { return { first: async () => ({ title: "Same", body: "Same" }) }; } }; } },
  };

  const response = await handle(new Request("https://linksaw.com/s/Ab3k9Qx7Lm2N4pRs"), env);
  const html = await response.text();

  assert.match(html, /<h1 class="title">Same<\/h1>/);
  assert.doesNotMatch(html, /<h1 class="title" hidden>/);
});

test("title-only public shares do not repeat the title as content", async () => {
  const env = {
    DB: { prepare() { return { bind() { return { first: async () => ({ title: "Only a title", body: "" }) }; } }; } },
  };

  const response = await handle(new Request("https://linksaw.com/s/Ab3k9Qx7Lm2N4pRs"), env);
  const html = await response.text();

  assert.match(html, /<h1 class="title">Only a title<\/h1>/);
  assert.match(html, /<pre id="snippet-content" class="content" hidden><\/pre>/);
  assert.match(html, /const content=document\.getElementById\("snippet-content"\)\.textContent;/);
  assert.doesNotMatch(html, /textContent\|\|document\.querySelector\("\.title"\)/);
});

test('private deep links serve the authenticated app and preserve the visible URL', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const assets = [];
  const env = {
    DB: { prepare() { return { bind() { return { first: async () => ({ id: 'user' }) }; } }; } },
    ASSETS: { async fetch(request) { assets.push(request.url); return new Response('app'); } },
  };
  for (const path of [`/home/s/${id}`, '/home/new']) {
    const signedOut = await handle(new Request(`https://linksaw.com${path}`), env);
    assert.equal(signedOut.status, 302);
    assert.equal(signedOut.headers.get('Location'), 'https://linksaw.com/login');
    const signedIn = await handle(new Request(`https://linksaw.com${path}`, {
      headers: { Cookie: `linksaw_session=${'a'.repeat(64)}` },
    }), env);
    assert.equal(signedIn.status, 200);
  }
  assert.deepEqual(assets, ['https://linksaw.com/app/', 'https://linksaw.com/app/']);
});

test('legacy app links redirect to canonical home routes', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const response = await handle(new Request(`https://linksaw.com/app/snippets/${id}`), { DB: {} });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), `https://linksaw.com/home/?snippet=${id}`);
});

test('authenticated users can read and update their autocomplete trigger', async () => {
  let saved = ';';
  const env = {
    DB: {
      prepare(sql) {
        const statement = { bind(...values) {
          if (sql.startsWith('SELECT') && sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
          if (sql.includes('SELECT autocomplete_trigger')) return { first: async () => ({ autocomplete_trigger: saved }) };
          if (sql.includes('INSERT INTO user_preferences')) return { run: async () => { saved = values[1]; } };
          throw new Error(`Unexpected SQL: ${sql}`);
        } };
        if (sql.includes('CREATE TABLE IF NOT EXISTS user_preferences')) statement.run = async () => ({});
        return statement;
      },
    },
  };
  const auth = { Authorization: `Bearer ${'a'.repeat(64)}` };
  const getResponse = await handle(new Request('https://snippets-api.linksaw.com/preferences', { headers: auth }), env);
  assert.deepEqual(await getResponse.json(), { autocompleteTrigger: ';' });
  const putResponse = await handle(new Request('https://snippets-api.linksaw.com/preferences', {
    method: 'PUT', headers: { ...auth, Origin: 'https://linksaw.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ autocompleteTrigger: '/' }),
  }), env);
  assert.equal(putResponse.status, 200);
  assert.deepEqual(await putResponse.json(), { autocompleteTrigger: '/' });
  assert.equal(saved, '/');
});

test('signed-in identity includes the display name and avatar', async () => {
  const user = { id: 'user', email: 'user@example.com', display_name: 'Example User', avatar_url: 'https://example.com/avatar.jpg' };
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /avatar_url/);
        return { bind() { return { first: async () => user }; } };
      },
    },
  };
  const response = await handle(new Request('https://snippets-api.linksaw.com/me', {
    headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user });
});

test('a configured Linksaw API key is stored by hash and attached to the existing owner', async () => {
  const token = 'lsw_examplekey1';
  const tokenHash = await sha256Base64Url(token);
  const user = { id: 'user', email: 'user@example.com', display_name: 'Example User', avatar_url: null };
  let storedKey;
  const env = {
    SHORTCUT_API_KEY_HASH: tokenHash,
    DB: {
      prepare(sql) {
        if (sql.startsWith('CREATE TABLE')) return { run: async () => ({}) };
        if (sql.includes('FROM api_keys JOIN users')) return { bind() { return { first: async () => null }; } };
        if (sql.includes('FROM users LEFT JOIN') && sql.includes('ORDER BY')) return { first: async () => user };
        if (sql.startsWith('INSERT OR IGNORE INTO api_keys')) {
          return { bind(...values) { storedKey = values; return { run: async () => ({}) }; } };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
  };
  const response = await handle(new Request('https://snippets-api.linksaw.com/me', {
    headers: { Authorization: `Bearer ${token}` },
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user });
  assert.equal(storedKey[0], tokenHash);
  assert.equal(storedKey[1], user.id);
  assert.equal(typeof storedKey[2], 'number');
});

test('account deletion requires typed confirmation and removes all owned data', async () => {
  let deleted = [];
  const env = {
    DB: {
      prepare(sql) {
        return { bind(...values) {
          if (sql.startsWith('SELECT') && sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
          return { sql, values };
        } };
      },
      async batch(statements) { deleted = statements; return statements.map(() => ({ success: true })); },
    },
  };
  const headers = {
    Cookie: `linksaw_session=${'a'.repeat(64)}`,
    Origin: 'https://linksaw.com',
    'Content-Type': 'application/json',
  };
  const rejected = await handle(new Request('https://linksaw.com/me', {
    method: 'DELETE', headers, body: JSON.stringify({ confirmation: 'DELETE' }),
  }), env);
  assert.equal(rejected.status, 400);
  assert.equal(deleted.length, 0);

  const response = await handle(new Request('https://linksaw.com/me', {
    method: 'DELETE', headers, body: JSON.stringify({ confirmation: 'delete' }),
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.deepEqual(deleted.map(statement => statement.sql), [
    'DELETE FROM details WHERE snippet_id IN (SELECT id FROM snippets WHERE owner_id = ?)',
    'DELETE FROM snippet_shares WHERE owner_id = ?',
    'DELETE FROM snippets WHERE owner_id = ?',
    'DELETE FROM user_preferences WHERE user_id = ?',
    'DELETE FROM user_profiles WHERE user_id = ?',
    'DELETE FROM api_keys WHERE user_id = ?',
    'DELETE FROM sessions WHERE user_id = ?',
    'DELETE FROM login_requests WHERE user_id = ?',
    'DELETE FROM users WHERE id = ?',
  ]);
  assert.ok(deleted.every(statement => statement.values[0] === 'user'));
});

test('snippet deletion returns the exact stored record needed for undo', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const stored = { id, title: 'Private name', body: 'Exact\ntext', created_at: 100, updated_at: 200, share_token: 'Ab3k9Qx7Lm2N4pRs' };
  let deletedStatements = [];
  const env = {
    DB: {
      prepare(sql) {
        if (sql.startsWith('CREATE TABLE')) return { run: async () => ({}) };
        return { bind(...values) {
          if (sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
          if (sql.includes('LEFT JOIN snippet_shares') && sql.includes('WHERE snippets.id')) return { first: async () => stored };
          return { sql, values };
        } };
      },
      async batch(statements) { deletedStatements = statements; return statements.map(() => ({ success: true })); },
    },
  };
  const response = await handle(new Request(`https://linksaw.com/snippets/${id}`, {
    method: 'DELETE',
    headers: { Cookie: `linksaw_session=${'a'.repeat(64)}`, Origin: 'https://linksaw.com' },
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: stored });
  assert.deepEqual(deletedStatements.map(statement => statement.sql), [
    'DELETE FROM details WHERE snippet_id = ?',
    'DELETE FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?',
    'DELETE FROM snippets WHERE id = ? AND owner_id = ?',
  ]);
});

test('undo restores identity, position timestamps, custom name, content, and share token', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const stored = { id, title: 'Private name', body: 'Exact\ntext', created_at: 100, updated_at: 200, share_token: 'Ab3k9Qx7Lm2N4pRs' };
  let restoredStatements = [];
  const env = {
    DB: {
      prepare(sql) {
        if (sql.startsWith('CREATE TABLE')) return { run: async () => ({}) };
        return { bind(...values) {
          if (sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
          if (sql === 'SELECT id FROM snippets WHERE id = ?') return { first: async () => null };
          return { sql, values };
        } };
      },
      async batch(statements) { restoredStatements = statements; return statements.map(() => ({ success: true })); },
    },
  };
  const response = await handle(new Request(`https://linksaw.com/snippets/${id}/restore`, {
    method: 'POST',
    headers: { Cookie: `linksaw_session=${'a'.repeat(64)}`, Origin: 'https://linksaw.com', 'Content-Type': 'application/json' },
    body: JSON.stringify(stored),
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(restoredStatements.map(statement => statement.sql), [
    'INSERT INTO snippets(id, owner_id, title, body, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'INSERT OR IGNORE INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    'INSERT INTO snippet_shares(token, snippet_id, owner_id, created_at) VALUES (?, ?, ?, ?)',
  ]);
  assert.deepEqual(restoredStatements[0].values, [id, 'user', stored.title, stored.body, stored.created_at, stored.updated_at, 0]);
  assert.deepEqual(restoredStatements[1].values, [id, 'user', 0, stored.title, stored.body, stored.updated_at]);
  assert.deepEqual(restoredStatements[2].values, [stored.share_token, id, 'user', stored.created_at]);
});

test('snippet updates require the current version and return the stored row on conflict', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const current = { id, title: 'Remote name', body: 'Remote text', created_at: 100, updated_at: 250, version: 4, share_token: null, can_undo: 1, can_redo: 0 };
  const env = {
    DB: {
      prepare(sql) {
        if (sql.startsWith('CREATE TABLE')) return { run: async () => ({}) };
        return { bind() {
          if (sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
          if (sql.startsWith('SELECT id, title, body, version FROM snippets')) return { first: async () => current };
          if (sql.includes('LEFT JOIN snippet_shares') && sql.includes('WHERE snippets.id')) return { first: async () => current };
          throw new Error(`Unexpected SQL: ${sql}`);
        } };
      },
    },
  };
  const headers = { Cookie: `linksaw_session=${'a'.repeat(64)}`, Origin: 'https://linksaw.com', 'Content-Type': 'application/json' };
  const missing = await handle(new Request(`https://linksaw.com/snippets/${id}`, {
    method: 'PUT', headers, body: JSON.stringify({ title: 'Local', body: 'Draft' }),
  }), env);
  assert.equal(missing.status, 428);

  const stale = await handle(new Request(`https://linksaw.com/snippets/${id}`, {
    method: 'PUT', headers, body: JSON.stringify({ title: 'Local', body: 'Draft', version: 3 }),
  }), env);
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'Snippet changed elsewhere', conflict: true, snippet: { ...current, can_undo: true, can_redo: false, details: [] } });
});
