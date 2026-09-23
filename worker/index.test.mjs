import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "./index.mjs";

test("signed-in app route lets Cloudflare resolve its directory index without a redirect loop", async () => {
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
  const request = new Request("https://linksaw.com/app/", {
    headers: { Cookie: `linksaw_session=${"a".repeat(64)}` },
  });

  const response = await handle(request, env);

  assert.equal(response.status, 200);
  assert.equal(assetUrl, "https://linksaw.com/app/");
});

test("app route without a trailing slash has one canonical redirect", async () => {
  const response = await handle(new Request("https://linksaw.com/app"), { DB: {} });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "https://linksaw.com/app/");
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

  for (const path of ["/app/site.webmanifest", "/app/icon-192.png", "/app/icon-512.png"]) {
    const response = await handle(new Request(`https://linksaw.com${path}`), env);
    assert.equal(response.status, 200);
  }

  assert.deepEqual(requested, ["/app/site.webmanifest", "/app/icon-192.png", "/app/icon-512.png"]);
});

test("public share pages render without sign-in and escape snippet content", async () => {
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM snippet_shares JOIN snippets/);
        return {
          bind(token) {
            assert.equal(token, "Ab3k9Qx7Lm2N4pRs");
            return { first: async () => ({ title: "Example <title>", body: `<script>alert("no")</script>\n\`README.md\`\n\`https://example.com/docs\`.` }) };
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
  assert.match(html, /Example &lt;title&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /href="https:\/\/example\.com\/docs"/);
  assert.doesNotMatch(html, /href="https:\/\/README\.md"/);
  assert.doesNotMatch(html, /href="https:\/\/example\.com\/docs`"/);
});

test('private deep links serve the authenticated app and preserve the visible URL', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const assets = [];
  const env = {
    DB: { prepare() { return { bind() { return { first: async () => ({ id: 'user' }) }; } }; } },
    ASSETS: { async fetch(request) { assets.push(request.url); return new Response('app'); } },
  };
  for (const path of [`/app/s/${id}`, '/app/new']) {
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

test('old extension private link redirects to the canonical /app/s route', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const response = await handle(new Request(`https://linksaw.com/app/snippets/${id}`), { DB: {} });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), `https://linksaw.com/app/s/${id}`);
});

test('authenticated users can read and update their autocomplete trigger', async () => {
  let saved = ';';
  const env = {
    DB: {
      prepare(sql) {
        const statement = { bind(...values) {
          if (sql.includes('FROM sessions')) return { first: async () => ({ id: 'user', email: 'user@example.com' }) };
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
