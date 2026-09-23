import { authUrl, cookieValue, nowSeconds, randomToken, sha256Base64Url, validSnippet, webSessionCookie } from "./lib.mjs";

const allowedOrigins = new Set(["https://linksaw.com", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:1420", "tauri://localhost", "http://tauri.localhost"]);
function responseHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    ...extra,
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers.Vary = "Origin";
  } else if (!origin) {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}
const json = (request, body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: responseHeaders(request, { "Content-Type": "application/json; charset=utf-8", ...extra }) });
const fail = (request, message, status = 400) => json(request, { error: message }, status);

async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function currentSession(request, env) {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  const cookie = cookieValue(request.headers.get("Cookie"), "linksaw_session");
  const token = bearer?.[1] || (/^[A-Za-z0-9_-]{40,}$/.test(cookie) ? cookie : "");
  if (!token) return null;
  const tokenHash = await sha256Base64Url(token);
  const user = await env.DB.prepare("SELECT users.id, users.email, users.display_name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?")
    .bind(tokenHash, nowSeconds()).first();
  return user ? { user, tokenHash, viaCookie: !bearer } : null;
}

async function listSnippets(env, userId) {
  const { results } = await env.DB.prepare("SELECT id, title, body, created_at, updated_at FROM snippets WHERE owner_id = ? ORDER BY updated_at DESC, id DESC LIMIT 2000")
    .bind(userId).all();
  // Keep an empty compatibility field during the desktop rollout. Details are
  // no longer accepted or returned as content.
  return results.map(row => ({ ...row, details: [] }));
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const isWebHost = url.hostname === "linksaw.com";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (!env.DB) return fail(request, "D1 database is not configured", 503);

  if (isWebHost && request.method === "GET" && url.pathname === "/") {
    const session = await currentSession(request, env);
    if (session) return Response.redirect("https://linksaw.com/app/", 302);
    return env.ASSETS.fetch(request);
  }
  if (isWebHost && request.method === "GET" && ["/favicon.ico", "/icon.png", "/apple-touch-icon.png", "/robots.txt", "/sitemap.xml"].includes(url.pathname)) {
    return env.ASSETS.fetch(request);
  }
  if (isWebHost && request.method === "GET" && (url.pathname === "/login" || url.pathname === "/login/")) {
    const session = await currentSession(request, env);
    if (session) return Response.redirect("https://linksaw.com/app/", 302);
    return Response.redirect(`${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/web/start`, 302);
  }
  if (isWebHost && request.method === "GET" && url.pathname === "/app") {
    return Response.redirect("https://linksaw.com/app/", 308);
  }
  if (isWebHost && request.method === "GET" && url.pathname === "/app/") {
    const session = await currentSession(request, env);
    if (!session) return Response.redirect("https://linksaw.com/login", 302);
    // Let the asset binding resolve the directory index itself. Requesting
    // /app/index.html makes Cloudflare canonicalize back to /app/, which would
    // otherwise create a signed-in redirect loop.
    return env.ASSETS.fetch(request);
  }
  if (isWebHost && request.method === "GET" && (url.pathname === "/app/app.css" || url.pathname === "/app/app.js")) {
    return env.ASSETS.fetch(request);
  }

  if (url.pathname === "/health" && request.method === "GET") return json(request, { ok: true });
  if (url.pathname === "/auth/web/start" && request.method === "GET") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.PUBLIC_BASE_URL) return fail(request, "Google sign-in is not configured", 503);
    const id = `web_${randomToken()}`;
    await env.DB.prepare("INSERT INTO login_requests(id, code_challenge, created_at) VALUES (?, ?, ?)").bind(id, await sha256Base64Url(randomToken()), nowSeconds()).run();
    const redirect = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/callback`;
    return Response.redirect(authUrl(env.GOOGLE_CLIENT_ID, redirect, id), 302);
  }
  if (url.pathname === "/auth/start" && request.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.PUBLIC_BASE_URL) return fail(request, "Google sign-in is not configured", 503);
    const input = await bodyJson(request);
    if (!/^[A-Za-z0-9_-]{43}$/.test(input?.codeChallenge || "")) return fail(request, "Invalid sign-in challenge");
    const id = randomToken();
    await env.DB.prepare("INSERT INTO login_requests(id, code_challenge, created_at) VALUES (?, ?, ?)").bind(id, input.codeChallenge, nowSeconds()).run();
    const redirect = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/callback`;
    return json(request, { requestId: id, url: authUrl(env.GOOGLE_CLIENT_ID, redirect, id) });
  }

  if (url.pathname === "/auth/callback" && request.method === "GET") {
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    const row = await env.DB.prepare("SELECT id FROM login_requests WHERE id = ? AND created_at > ? AND consumed_at IS NULL")
      .bind(state, nowSeconds() - 300).first();
    if (!row || !code) return new Response("Sign-in expired or cancelled. Return to the app and try again.", { status: 400, headers: { "Content-Type": "text/plain" } });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/callback`, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) return new Response("Google sign-in could not be completed. Return to the app and try again.", { status: 400 });
    const tokens = await tokenResponse.json();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) return new Response("Google identity could not be verified.", { status: 400 });
    const profile = await profileResponse.json();
    if (!profile.sub || !profile.email_verified) return new Response("A verified Google account is required.", { status: 403 });
    await env.DB.prepare("INSERT INTO users(id, email, display_name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name")
      .bind(profile.sub, profile.email || "", profile.name || profile.email || "Google user", nowSeconds()).run();
    if (state.startsWith("web_")) {
      const token = randomToken();
      const timestamp = nowSeconds();
      await env.DB.batch([
        env.DB.prepare("UPDATE login_requests SET user_id = ?, consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(profile.sub, timestamp, state),
        env.DB.prepare("INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await sha256Base64Url(token), profile.sub, timestamp, timestamp + 30 * 86400),
      ]);
      return new Response(null, { status: 302, headers: { Location: "https://linksaw.com/app/", "Set-Cookie": webSessionCookie(token), "Cache-Control": "no-store" } });
    }
    await env.DB.prepare("UPDATE login_requests SET user_id = ? WHERE id = ? AND consumed_at IS NULL").bind(profile.sub, state).run();
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed in · Linksaw</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#171717;background:#fafafa}main{text-align:center;padding:32px}h1{font-size:28px;font-weight:500}p{color:#747474;line-height:1.6}.mark{font-size:40px;font-weight:700}</style><main><div class="mark">L</div><h1>You're signed in</h1><p>Linksaw will open automatically.<br>You can close this tab.</p></main></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }

  if (url.pathname === "/auth/poll" && request.method === "POST") {
    const input = await bodyJson(request);
    if (!/^[A-Za-z0-9_-]{64}$/.test(input?.requestId || "") || !/^[A-Za-z0-9_-]{32,128}$/.test(input?.verifier || "")) return fail(request, "Invalid sign-in request");
    const row = await env.DB.prepare("SELECT user_id, code_challenge, created_at, consumed_at FROM login_requests WHERE id = ?").bind(input.requestId).first();
    if (!row || row.created_at < nowSeconds() - 300 || row.consumed_at) return fail(request, "Sign-in expired", 410);
    if ((await sha256Base64Url(input.verifier)) !== row.code_challenge) return fail(request, "Invalid sign-in verifier", 403);
    if (!row.user_id) return json(request, { pending: true }, 202);
    const token = randomToken();
    const tokenHash = await sha256Base64Url(token);
    const timestamp = nowSeconds();
    await env.DB.batch([
      env.DB.prepare("UPDATE login_requests SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(timestamp, input.requestId),
      env.DB.prepare("INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(tokenHash, row.user_id, timestamp, timestamp + 30 * 86400),
    ]);
    return json(request, { token, expiresAt: timestamp + 30 * 86400 });
  }

  const session = await currentSession(request, env);
  if (!session) return fail(request, "Sign in required", 401);
  if (session.viaCookie && !["GET", "HEAD"].includes(request.method) && request.headers.get("Origin") !== "https://linksaw.com") {
    return fail(request, "Request origin is not allowed", 403);
  }
  const user = session.user;
  if (url.pathname === "/me" && request.method === "GET") return json(request, { user });
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
    return json(request, { ok: true }, 200, session.viaCookie ? { "Set-Cookie": webSessionCookie("", 0) } : {});
  }
  if (url.pathname === "/snippets" && request.method === "GET") return json(request, { snippets: await listSnippets(env, user.id) });
  if (url.pathname === "/details" && request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM details WHERE snippet_id IN (SELECT id FROM snippets WHERE owner_id = ?)").bind(user.id).run();
    return json(request, { ok: true, deleted: result.meta?.changes || 0 });
  }
  if (url.pathname === "/snippets" && request.method === "POST") {
    const input = await bodyJson(request);
    const value = validSnippet(input);
    if (!value) return fail(request, "Enter content or a title");
    if (input.importId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.importId)) return fail(request, "Invalid import ID");
    // The client retains this per-row ID across retries, including lost responses.
    // A retry never overwrites an existing snippet or another user's data.
    if (input.importId) {
      const existing = await env.DB.prepare("SELECT id FROM snippets WHERE id = ? AND owner_id = ?").bind(input.importId, user.id).first();
      if (existing) return json(request, { id: existing.id }, 200);
    }
    const id = input.importId || crypto.randomUUID(), timestamp = nowSeconds();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO snippets(id, owner_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, user.id, value.title, value.body, timestamp, timestamp),
    ]);
    return json(request, { id }, 201);
  }
  const match = url.pathname.match(/^\/snippets\/([a-f0-9-]{36})$/);
  if (match && request.method === "PUT") {
    const exists = await env.DB.prepare("SELECT id FROM snippets WHERE id = ? AND owner_id = ?").bind(match[1], user.id).first();
    if (!exists) return fail(request, "Snippet not found", 404);
    const value = validSnippet(await bodyJson(request));
    if (!value) return fail(request, "Enter content or a title");
    await env.DB.batch([
      env.DB.prepare("UPDATE snippets SET title = ?, body = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(value.title, value.body, nowSeconds(), match[1], user.id),
      env.DB.prepare("DELETE FROM details WHERE snippet_id = ?").bind(match[1]),
    ]);
    return json(request, { ok: true });
  }
  if (match && request.method === "DELETE") {
    const exists = await env.DB.prepare("SELECT id FROM snippets WHERE id = ? AND owner_id = ?").bind(match[1], user.id).first();
    if (!exists) return fail(request, "Snippet not found", 404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM details WHERE snippet_id = ?").bind(match[1]),
      env.DB.prepare("DELETE FROM snippets WHERE id = ? AND owner_id = ?").bind(match[1], user.id),
    ]);
    return json(request, { ok: true });
  }
  return fail(request, "Not found", 404);
}

export default { async fetch(request, env) {
  try { return await handle(request, env); }
  catch (error) { console.error("Worker request failed", error); return fail(request, "Internal server error", 500); }
} };
