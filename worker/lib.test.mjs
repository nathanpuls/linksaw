import test from "node:test";
import assert from "node:assert/strict";
import { authUrl, sha256Base64Url, validSnippet } from "./lib.mjs";

test("private write payload contains only title and content", () => {
  assert.deepEqual(validSnippet({ title: "Name", body: "", details: ["ignored legacy value"] }), { title: "Name", body: "" });
  assert.equal(validSnippet({ title: "", body: "" }), null);
});
test("sign-in URL uses authorization code and state", () => {
  const url = new URL(authUrl("client", "https://example.com/auth/callback", "state"));
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "state");
});
test("sign-in verifier hash is URL-safe", async () => {
  assert.match(await sha256Base64Url("sample"), /^[A-Za-z0-9_-]{43}$/);
});
