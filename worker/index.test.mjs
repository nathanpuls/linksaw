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
            return { first: async () => ({ title: "Example <title>", body: `<script>alert("no")</script>` }) };
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
});
