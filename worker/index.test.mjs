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
