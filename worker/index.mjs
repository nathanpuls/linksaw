import { authUrl, cookieValue, escapeHtml, nowSeconds, randomToken, sha256Base64Url, shareToken, validSnippet, webSessionCookie } from "./lib.mjs";

const allowedOrigins = new Set(["https://linksaw.com", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:1420", "tauri://localhost", "http://tauri.localhost"]);
const profileSchemaReady = new WeakMap();
async function ensureProfileSchema(env) {
  if (!profileSchemaReady.has(env.DB)) {
    const ready = Promise.resolve()
      .then(() => env.DB.prepare("CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, avatar_url TEXT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run())
      .catch(() => null);
    profileSchemaReady.set(env.DB, ready);
  }
  await profileSchemaReady.get(env.DB);
}
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
  await ensureProfileSchema(env);
  const user = await env.DB.prepare("SELECT users.id, users.email, users.display_name, user_profiles.avatar_url FROM sessions JOIN users ON users.id = sessions.user_id LEFT JOIN user_profiles ON user_profiles.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?")
    .bind(tokenHash, nowSeconds()).first();
  return user ? { user, tokenHash, viaCookie: !bearer } : null;
}

async function listSnippets(env, userId) {
  const { results } = await env.DB.prepare("SELECT snippets.id, snippets.title, snippets.body, snippets.created_at, snippets.updated_at, snippet_shares.token AS share_token FROM snippets LEFT JOIN snippet_shares ON snippet_shares.snippet_id = snippets.id WHERE snippets.owner_id = ? ORDER BY snippets.updated_at DESC, snippets.id DESC LIMIT 2000")
    .bind(userId).all();
  // Keep an empty compatibility field during the desktop rollout. Details are
  // no longer accepted or returned as content.
  return results.map(row => ({ ...row, details: [] }));
}

async function autocompleteTrigger(env, userId) {
  try {
    const row = await env.DB.prepare("SELECT autocomplete_trigger FROM user_preferences WHERE user_id = ?").bind(userId).first();
    return row?.autocomplete_trigger || ";";
  } catch {
    // Older deployments may not have created the additive preferences table yet.
    return ";";
  }
}

async function saveAutocompleteTrigger(env, userId, trigger) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS user_preferences (user_id TEXT PRIMARY KEY, autocomplete_trigger TEXT NOT NULL DEFAULT ';', updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await env.DB.prepare("INSERT INTO user_preferences(user_id, autocomplete_trigger, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET autocomplete_trigger = excluded.autocomplete_trigger, updated_at = excluded.updated_at")
    .bind(userId, trigger, nowSeconds()).run();
}

function publicLinkedHtml(value) {
  const text = String(value ?? "");
  const pattern = /https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s<>"'`]*)?/gi;
  let html = "", last = 0;
  for (const match of text.matchAll(pattern)) {
    const full = match[0]; let linkText = full;
    while (/[.,;:!?)}\]]$/.test(linkText)) linkText = linkText.slice(0, -1);
    html += escapeHtml(text.slice(last, match.index));
    const bareDomainInCode = !/^https?:\/\//i.test(linkText) && (text[match.index - 1] === "`" || text[match.index + full.length] === "`");
    if (text[match.index - 1] === "@" || bareDomainInCode || !linkText) html += escapeHtml(full);
    else {
      const href = /^https?:\/\//i.test(linkText) ? linkText : `https://${linkText}`;
      html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>${escapeHtml(full.slice(linkText.length))}`;
    }
    last = match.index + full.length;
  }
  return html + escapeHtml(text.slice(last));
}

function publicSnippetPage(snippet) {
  const body = snippet.body || snippet.title;
  const heading = snippet.body.trim() && snippet.title.trim() !== snippet.body.trim() ? snippet.title.trim() : "";
  const pageTitle = heading || body.trim().split(/\r?\n/, 1)[0].slice(0, 80) || "Shared snippet";
  const nonce = randomToken().slice(0, 24);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(pageTitle)} · Linksaw</title><link rel="icon" href="/icon.png" type="image/png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><style nonce="${nonce}">:root{color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#fff}*{box-sizing:border-box}body{min-height:100vh;margin:0;background:#fff}.snippet{min-height:100vh;background:#fff}.topbar{min-height:72px;display:flex;align-items:center;justify-content:space-between;padding:12px 22px}.home,.copy{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border:0;border-radius:9px;background:transparent;color:#777;cursor:pointer}.home:hover,.home:focus-visible,.copy:hover,.copy:focus-visible{outline:0;background:#f4f4f5;color:#171717}.home img{display:block;width:28px;height:28px;object-fit:contain}.copy svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.snippet-container{width:min(900px,100%);margin:0 auto;padding:8px 36px 48px}.title{margin:0 0 22px;overflow-wrap:anywhere;font-size:21px;font-weight:600;letter-spacing:-.025em}.content{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:16px;line-height:1.65}.content a{color:inherit;text-decoration-color:#d4d4d8;text-underline-offset:2px}.content a:hover,.content a:focus-visible{text-decoration-color:currentColor}.status{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:9px 15px;border-radius:9px;background:#171717;color:#fff;font-size:13px}@media(max-width:700px){.topbar{min-height:64px;padding:10px 12px}.snippet-container{padding:8px 22px 40px}.title{font-size:19px}}</style></head><body><main class="snippet"><header class="topbar"><a class="home" href="https://linksaw.com/" aria-label="Linksaw home"><img src="https://linksaw.com/icon.png" alt=""></a><button id="copy" class="copy" type="button" aria-label="Copy snippet" title="Copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg></button></header><article class="snippet-container"><h1 class="title"${heading ? "" : " hidden"}>${escapeHtml(heading)}</h1><pre id="snippet-content" class="content">${publicLinkedHtml(body)}</pre></article></main><div id="status" class="status" role="status" hidden>Copied</div><script nonce="${nonce}">document.getElementById("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(document.getElementById("snippet-content").textContent);const s=document.getElementById("status");s.hidden=false;setTimeout(()=>s.hidden=true,1400)}catch{}})</script></body></html>`;
  return { html, nonce };
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
  const oldPrivateLink = isWebHost && request.method === "GET" ? url.pathname.match(/^\/app\/snippets\/([a-f0-9-]{36})\/?$/) : null;
  if (oldPrivateLink) return Response.redirect(`https://linksaw.com/app/s/${oldPrivateLink[1]}`, 302);
  if (isWebHost && request.method === "GET" && (/^\/app\/s\/[a-f0-9-]{36}\/?$/.test(url.pathname) || url.pathname === "/app/new")) {
    const session = await currentSession(request, env);
    if (!session) return Response.redirect("https://linksaw.com/login", 302);
    // Resolve the app's directory index while preserving the deep link in the browser.
    return env.ASSETS.fetch(new Request("https://linksaw.com/app/", request));
  }
  if (isWebHost && request.method === "GET" && url.pathname === "/app/") {
    const session = await currentSession(request, env);
    if (!session) return Response.redirect("https://linksaw.com/login", 302);
    // Let the asset binding resolve the directory index itself. Requesting
    // /app/index.html makes Cloudflare canonicalize back to /app/, which would
    // otherwise create a signed-in redirect loop.
    return env.ASSETS.fetch(request);
  }
  if (isWebHost && request.method === "GET" && ["/app/app.css", "/app/app.js", "/app/site.webmanifest", "/app/favicon.png", "/app/icon-192.png", "/app/icon-512.png"].includes(url.pathname)) {
    return env.ASSETS.fetch(request);
  }
  const publicShare = isWebHost ? url.pathname.match(/^\/s\/([A-Za-z0-9_-]{16})\/?$/) : null;
  if (publicShare && request.method === "GET") {
    const snippet = await env.DB.prepare("SELECT snippets.title, snippets.body FROM snippet_shares JOIN snippets ON snippets.id = snippet_shares.snippet_id WHERE snippet_shares.token = ?").bind(publicShare[1]).first();
    if (!snippet) return new Response("Shared snippet not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    const page = publicSnippetPage(snippet);
    return new Response(page.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": `default-src 'none'; img-src https://linksaw.com; style-src 'nonce-${page.nonce}'; script-src 'nonce-${page.nonce}'; base-uri 'none'; frame-ancestors 'none'`, "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
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
    await ensureProfileSchema(env);
    await env.DB.prepare("INSERT INTO user_profiles(user_id, avatar_url) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET avatar_url=excluded.avatar_url")
      .bind(profile.sub, profile.picture || null).run();
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
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed in · Linksaw</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#171717;background:#fafafa}main{text-align:center;padding:32px}h1{font-size:28px;font-weight:500}p{color:#747474;line-height:1.6}.mark{display:block;width:96px;height:96px;object-fit:contain;margin:0 auto 24px}</style><main><img class="mark" src="https://linksaw.com/icon.png" alt="Linksaw"><h1>You're signed in</h1><p>Linksaw will open automatically.<br>You can close this tab.</p></main></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src https://linksaw.com; style-src 'unsafe-inline'" } });
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
  if (url.pathname === "/preferences" && request.method === "GET") {
    return json(request, { autocompleteTrigger: await autocompleteTrigger(env, user.id) });
  }
  if (url.pathname === "/preferences" && request.method === "PUT") {
    const input = await bodyJson(request);
    const trigger = typeof input?.autocompleteTrigger === "string" ? input.autocompleteTrigger : "";
    if (Array.from(trigger).length !== 1 || /\s|[\u0000-\u001f\u007f]/u.test(trigger)) {
      return fail(request, "Choose one visible character");
    }
    await saveAutocompleteTrigger(env, user.id, trigger);
    return json(request, { autocompleteTrigger: trigger });
  }
  if (url.pathname === "/me" && request.method === "DELETE") {
    const input = await bodyJson(request);
    if (input?.confirmation !== "delete") return fail(request, 'Type "delete" to confirm account deletion');
    await env.DB.batch([
      env.DB.prepare("DELETE FROM details WHERE snippet_id IN (SELECT id FROM snippets WHERE owner_id = ?)").bind(user.id),
      env.DB.prepare("DELETE FROM snippet_shares WHERE owner_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM snippets WHERE owner_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM user_preferences WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM login_requests WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    ]);
    return json(request, { ok: true }, 200, session.viaCookie ? { "Set-Cookie": webSessionCookie("", 0) } : {});
  }
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
  const shareMatch = url.pathname.match(/^\/snippets\/([a-f0-9-]{36})\/share$/);
  if (shareMatch && request.method === "POST") {
    const snippet = await env.DB.prepare("SELECT id FROM snippets WHERE id = ? AND owner_id = ?").bind(shareMatch[1], user.id).first();
    if (!snippet) return fail(request, "Snippet not found", 404);
    let share = await env.DB.prepare("SELECT token FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?").bind(shareMatch[1], user.id).first();
    for (let attempt = 0; !share && attempt < 3; attempt++) {
      await env.DB.prepare("INSERT OR IGNORE INTO snippet_shares(token, snippet_id, owner_id, created_at) VALUES (?, ?, ?, ?)")
        .bind(shareToken(), shareMatch[1], user.id, nowSeconds()).run();
      share = await env.DB.prepare("SELECT token FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?").bind(shareMatch[1], user.id).first();
    }
    if (!share) return fail(request, "Share link could not be created", 500);
    return json(request, { token: share.token, url: `https://linksaw.com/s/${share.token}` });
  }
  if (shareMatch && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?").bind(shareMatch[1], user.id).run();
    return json(request, { ok: true });
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
      env.DB.prepare("DELETE FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?").bind(match[1], user.id),
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
