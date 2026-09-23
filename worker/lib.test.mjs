import test from "node:test";
import assert from "node:assert/strict";
import { authUrl, cookieValue, escapeHtml, sha256Base64Url, shareToken, validSnippet, webSessionCookie } from "./lib.mjs";

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
test("web session cookies are private and scoped to Linksaw", () => {
  const cookie = webSessionCookie("opaque", 60);
  assert.match(cookie, /^linksaw_session=opaque;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Domain=linksaw\.com/);
  assert.equal(cookieValue("one=1; linksaw_session=opaque; two=2", "linksaw_session"), "opaque");
});
test("share IDs are compact and contain enough random data", () => {
  assert.match(shareToken(), /^[A-Za-z0-9_-]{16}$/);
});
test("public snippet text is escaped before rendering", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});
