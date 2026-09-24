import { authUrl, cookieValue, escapeHtml, nowSeconds, randomToken, sha256Base64Url, shareToken, validSnippet, webSessionCookie } from "./lib.mjs";
import { markdownToSafeHtml } from "../web/app/markdown.js";

const allowedOrigins = new Set(["https://linksaw.com", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:1420", "tauri://localhost", "http://tauri.localhost"]);
const profileSchemaReady = new WeakMap();
const apiKeySchemaReady = new WeakMap();
async function ensureProfileSchema(env) {
  if (!profileSchemaReady.has(env.DB)) {
    const ready = Promise.resolve()
      .then(() => env.DB.prepare("CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, avatar_url TEXT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run())
      .catch(() => null);
    profileSchemaReady.set(env.DB, ready);
  }
  await profileSchemaReady.get(env.DB);
}
async function ensureApiKeySchema(env) {
  if (!apiKeySchemaReady.has(env.DB)) {
    const ready = Promise.resolve()
      .then(() => env.DB.prepare("CREATE TABLE IF NOT EXISTS api_keys (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run());
    apiKeySchemaReady.set(env.DB, ready);
  }
  await apiKeySchemaReady.get(env.DB);
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
  const bearer = request.headers.get("Authorization")?.match(/^Bearer ((?:[A-Za-z0-9_-]{40,})|(?:lsw_[A-Za-z0-9_-]{10,}))$/);
  const cookie = cookieValue(request.headers.get("Cookie"), "linksaw_session");
  const token = bearer?.[1] || (/^[A-Za-z0-9_-]{40,}$/.test(cookie) ? cookie : "");
  if (!token) return null;
  const tokenHash = await sha256Base64Url(token);
  await ensureProfileSchema(env);
  let user;
  if (bearer?.[1].startsWith("lsw_")) {
    await ensureApiKeySchema(env);
    user = await env.DB.prepare("SELECT users.id, users.email, users.display_name, user_profiles.avatar_url FROM api_keys JOIN users ON users.id = api_keys.user_id LEFT JOIN user_profiles ON user_profiles.user_id = users.id WHERE api_keys.token_hash = ?")
      .bind(tokenHash).first();
    if (!user && env.SHORTCUT_API_KEY_HASH && tokenHash === env.SHORTCUT_API_KEY_HASH) {
      user = await env.DB.prepare("SELECT users.id, users.email, users.display_name, user_profiles.avatar_url FROM users LEFT JOIN user_profiles ON user_profiles.user_id = users.id ORDER BY users.created_at ASC LIMIT 1").first();
      if (user) {
        await env.DB.prepare("INSERT OR IGNORE INTO api_keys(token_hash, user_id, created_at) VALUES (?, ?, ?)")
          .bind(tokenHash, user.id, nowSeconds()).run();
      }
    }
  } else {
    user = await env.DB.prepare("SELECT users.id, users.email, users.display_name, user_profiles.avatar_url FROM sessions JOIN users ON users.id = sessions.user_id LEFT JOIN user_profiles ON user_profiles.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?")
      .bind(tokenHash, nowSeconds()).first();
  }
  return user ? { user, tokenHash, viaCookie: !bearer } : null;
}

async function listSnippets(env, userId) {
  const { results } = await env.DB.prepare("SELECT snippets.id, snippets.title, snippets.body, snippets.created_at, snippets.updated_at, snippets.version, snippet_shares.token AS share_token, EXISTS(SELECT 1 FROM snippet_revisions WHERE snippet_revisions.snippet_id = snippets.id AND snippet_revisions.version < snippets.version) AS can_undo, EXISTS(SELECT 1 FROM snippet_revisions WHERE snippet_revisions.snippet_id = snippets.id AND snippet_revisions.version > snippets.version) AS can_redo FROM snippets LEFT JOIN snippet_shares ON snippet_shares.snippet_id = snippets.id WHERE snippets.owner_id = ? ORDER BY snippets.updated_at DESC, snippets.id DESC LIMIT 2000")
    .bind(userId).all();
  // Keep an empty compatibility field during the desktop rollout. Details are
  // no longer accepted or returned as content.
  return results.map(row => ({ ...row, can_undo: Boolean(row.can_undo), can_redo: Boolean(row.can_redo), details: [] }));
}

async function storedSnippet(env, userId, snippetId) {
  const row = await env.DB.prepare("SELECT snippets.id, snippets.title, snippets.body, snippets.created_at, snippets.updated_at, snippets.version, snippet_shares.token AS share_token, EXISTS(SELECT 1 FROM snippet_revisions WHERE snippet_revisions.snippet_id = snippets.id AND snippet_revisions.version < snippets.version) AS can_undo, EXISTS(SELECT 1 FROM snippet_revisions WHERE snippet_revisions.snippet_id = snippets.id AND snippet_revisions.version > snippets.version) AS can_redo FROM snippets LEFT JOIN snippet_shares ON snippet_shares.snippet_id = snippets.id WHERE snippets.id = ? AND snippets.owner_id = ?")
    .bind(snippetId, userId).first();
  return row ? { ...row, can_undo: Boolean(row.can_undo), can_redo: Boolean(row.can_redo), details: [] } : null;
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

function publicSnippetPage(snippet) {
  const body = snippet.body;
  const heading = snippet.title.trim();
  const pageTitle = heading || body.trim().split(/\r?\n/, 1)[0].slice(0, 80) || "Shared snippet";
  const nonce = randomToken().slice(0, 24);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(pageTitle)} · Linksaw</title>
  <link rel="icon" href="/icon.png" type="image/png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <style nonce="${nonce}">
    :root{color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#fff}
    *{box-sizing:border-box}
    body{min-height:100vh;margin:0;background:#fff}
    .snippet{min-height:100vh;background:#fff}
    .topbar{min-height:72px;display:flex;align-items:center;justify-content:space-between;padding:12px 22px}
    .home,.copy{position:relative;width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border:0;border-radius:9px;background:transparent;color:#777;cursor:pointer}
    .home:hover,.home:focus-visible,.copy:hover,.copy:focus-visible{outline:0;background:#f4f4f5;color:#171717}
    .home img{display:block;width:28px;height:28px;object-fit:contain}
    .copy svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    [data-tooltip]::after{content:attr(data-tooltip);position:absolute;z-index:10;top:calc(100% + 8px);border:1px solid #e4e4e7;border-radius:7px;padding:6px 8px;background:#fff;color:#18181b;font-size:12px;font-weight:400;line-height:1.2;white-space:nowrap;opacity:0;pointer-events:none;box-shadow:0 4px 14px #0000001f;transition:opacity .08s;transition-delay:0s}
    [data-tooltip]:hover::after,[data-tooltip]:focus-visible::after{opacity:1;transition-delay:.45s}
    .home::after{left:0}.copy::after{right:0}
    .snippet-container{width:min(900px,100%);margin:0 auto;padding:8px 36px 48px}
    .title{margin:0 0 22px;overflow-wrap:anywhere;font-size:21px;font-weight:550;letter-spacing:-.025em}
    .content{margin:0;overflow-wrap:anywhere;font:inherit;font-size:16px;line-height:1.65}
    .content a{color:inherit;text-decoration:underline;text-decoration-thickness:1.2px;text-underline-offset:2px;text-decoration-skip-ink:none;-webkit-text-decoration-skip:none;cursor:pointer;word-break:break-word}
    .content a:hover,.content a:focus-visible{text-decoration-color:currentColor}
    .content>:first-child{margin-top:0}.content>:last-child{margin-bottom:0}.content p{margin:0 0 1em}
    .content h1,.content h2,.content h3,.content h4,.content h5,.content h6{margin:1.25em 0 .55em;line-height:1.28;letter-spacing:-.015em}
    .content h1{font-size:1.5em}.content h2{font-size:1.3em}.content h3{font-size:1.15em}.content h4,.content h5,.content h6{font-size:1em}
    .content ul,.content ol{margin:0 0 1em;padding-left:1.65em}.content li+li{margin-top:.25em}
    .content blockquote{margin:0 0 1em;padding-left:1em;border-left:2px solid #d4d4d8;color:#777}.content blockquote>:last-child{margin-bottom:0}
    .content code{border-radius:4px;padding:.12em .32em;background:#f4f4f5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
    .content pre{margin:0 0 1em;overflow-x:auto;border-radius:7px;padding:14px 16px;background:#f4f4f5;white-space:pre;line-height:1.5}.content pre code{padding:0;background:transparent;font-size:.875em}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .copy-error{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:9px 15px;border-radius:9px;background:#b42318;color:#fff;font-size:13px}
    @media(hover:none),(pointer:coarse){[data-tooltip]::after{display:none}}
    @media(max-width:700px){.topbar{min-height:64px;padding:10px 12px}.snippet-container{padding:8px 22px 40px}.title{font-size:19px}}
  </style>
</head>
<body>
  <main class="snippet">
    <header class="topbar">
      <a class="home" href="https://linksaw.com/" aria-label="Linksaw home" data-tooltip="Linksaw home"><img src="https://linksaw.com/icon.png" alt=""></a>
      <button id="copy" class="copy" type="button" aria-label="Copy snippet" data-tooltip="Copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg></button>
    </header>
    <article class="snippet-container"><h1 class="title"${heading ? "" : " hidden"}>${escapeHtml(heading)}</h1><div id="snippet-content" class="content"${body ? "" : " hidden"}>${markdownToSafeHtml(body)}</div><textarea id="snippet-source" hidden>${escapeHtml(body)}</textarea></article>
  </main>
  <div id="copy-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="copy-error" class="copy-error" role="alert" hidden></div>
  <script nonce="${nonce}">const b=document.getElementById("copy"),original=b.innerHTML,check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"></path></svg>';let timer;b.addEventListener("click",async()=>{const error=document.getElementById("copy-error");error.hidden=true;try{const content=document.getElementById("snippet-source").value;await navigator.clipboard.writeText(content);clearTimeout(timer);b.innerHTML=check;b.setAttribute("aria-label","Copied");b.dataset.tooltip="Copied";const live=document.getElementById("copy-announcement");live.textContent="";requestAnimationFrame(()=>live.textContent="Copied to clipboard");timer=setTimeout(()=>{b.innerHTML=original;b.setAttribute("aria-label","Copy snippet");b.dataset.tooltip="Copy"},1800)}catch{error.textContent="Could not copy to clipboard";error.hidden=false}})</script>
</body>
</html>`;
  return { html, nonce };
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const isWebHost = url.hostname === "linksaw.com";
  const appAssetPaths = new Set(["/app/app.css", "/app/app.js", "/app/linkify.js", "/app/markdown.js", "/app/transfers.js", "/app/site.webmanifest", "/app/favicon.png", "/app/icon-192.png", "/app/icon-512.png"]);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (!env.DB) return fail(request, "D1 database is not configured", 503);

  if (isWebHost && request.method === "GET" && url.pathname === "/") {
    const session = await currentSession(request, env);
    if (session && url.searchParams.get("website") !== "1") return Response.redirect("https://linksaw.com/home/", 302);
    const response = await env.ASSETS.fetch(new Request("https://linksaw.com/", request));
    if (!session) return response;
    const html = (await response.text())
      .replace('id="primary-cta" class="login" href="/login"', 'id="primary-cta" class="login" href="/home/"')
      .replace(/<svg class="google-g"[\s\S]*?<\/svg><span>Continue with Google<\/span>/, "<span>Open Linksaw</span>");
    return new Response(html, { status: response.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (isWebHost && ["GET", "HEAD"].includes(request.method) && url.pathname === "/privacy/") {
    return Response.redirect("https://linksaw.com/privacy", 308);
  }
  if (isWebHost && ["GET", "HEAD"].includes(request.method) && url.pathname === "/privacy") {
    return env.ASSETS.fetch(new Request("https://linksaw.com/privacy/", request));
  }
  if (isWebHost && ["GET", "HEAD"].includes(request.method) && url.pathname === "/terms/") {
    return Response.redirect("https://linksaw.com/terms", 308);
  }
  if (isWebHost && ["GET", "HEAD"].includes(request.method) && url.pathname === "/terms") {
    return env.ASSETS.fetch(new Request("https://linksaw.com/terms/", request));
  }
  if (isWebHost && request.method === "GET" && ["/favicon.ico", "/icon.png", "/apple-touch-icon.png", "/robots.txt", "/sitemap.xml"].includes(url.pathname)) {
    return env.ASSETS.fetch(request);
  }
  if (isWebHost && request.method === "GET" && appAssetPaths.has(url.pathname)) return env.ASSETS.fetch(request);
  if (isWebHost && request.method === "GET" && (url.pathname === "/login" || url.pathname === "/login/")) {
    const session = await currentSession(request, env);
    if (session) return Response.redirect("https://linksaw.com/home/", 302);
    return Response.redirect(`${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/web/start`, 302);
  }
  if (isWebHost && request.method === "GET" && url.pathname === "/home") {
    return Response.redirect(`https://linksaw.com/home/${url.search}`, 308);
  }
  if (isWebHost && request.method === "GET" && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) {
    const suffix = url.pathname === "/app" || url.pathname === "/app/" ? "/" : url.pathname.slice(4);
    const oldSnippet = suffix.match(/^\/snippets\/([a-f0-9-]{36})\/?$/)?.[1];
    const destination = oldSnippet ? `/home/?snippet=${oldSnippet}` : `/home${suffix}${url.search}`;
    return Response.redirect(`https://linksaw.com${destination}`, 308);
  }
  if (isWebHost && request.method === "GET" && (/^\/home\/s\/[a-f0-9-]{36}\/?$/.test(url.pathname) || url.pathname === "/home/new")) {
    const session = await currentSession(request, env);
    if (!session) return Response.redirect("https://linksaw.com/login", 302);
    // Resolve the app's directory index while preserving the deep link in the browser.
    return env.ASSETS.fetch(new Request("https://linksaw.com/app/", request));
  }
  if (isWebHost && request.method === "GET" && url.pathname === "/home/") {
    const session = await currentSession(request, env);
    if (!session) return Response.redirect("https://linksaw.com/login", 302);
    return env.ASSETS.fetch(new Request("https://linksaw.com/app/", request));
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
      return new Response(null, { status: 302, headers: { Location: "https://linksaw.com/home/", "Set-Cookie": webSessionCookie(token), "Cache-Control": "no-store" } });
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
      env.DB.prepare("DELETE FROM api_keys WHERE user_id = ?").bind(user.id),
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
      env.DB.prepare("INSERT INTO snippets(id, owner_id, title, body, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 0)").bind(id, user.id, value.title, value.body, timestamp, timestamp),
      env.DB.prepare("INSERT INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, 0, ?, ?, ?)").bind(id, user.id, value.title, value.body, timestamp),
    ]);
    return json(request, { id, snippet: { id, title: value.title, body: value.body, created_at: timestamp, updated_at: timestamp, version: 0, share_token: null, can_undo: false, can_redo: false, details: [] } }, 201);
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
  const restoreMatch = url.pathname.match(/^\/snippets\/([a-f0-9-]{36})\/restore$/);
  if (restoreMatch && request.method === "POST") {
    const input = await bodyJson(request);
    const value = validSnippet(input);
    const validTimestamps = Number.isSafeInteger(input?.created_at) && input.created_at > 0
      && Number.isSafeInteger(input?.updated_at) && input.updated_at > 0;
    const validShare = input?.share_token == null || /^[A-Za-z0-9_-]{16}$/.test(input.share_token);
    if (!value || input?.id !== restoreMatch[1] || !validTimestamps || !validShare) return fail(request, "Invalid deleted snippet");
    const exists = await env.DB.prepare("SELECT id FROM snippets WHERE id = ?").bind(restoreMatch[1]).first();
    if (exists) return fail(request, "Snippet already exists", 409);
    const statements = [
      env.DB.prepare("INSERT INTO snippets(id, owner_id, title, body, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(input.id, user.id, value.title, value.body, input.created_at, input.updated_at, Number.isSafeInteger(input.version) ? input.version : 0),
      env.DB.prepare("INSERT OR IGNORE INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(input.id, user.id, Number.isSafeInteger(input.version) ? input.version : 0, value.title, value.body, input.updated_at),
    ];
    if (input.share_token) {
      statements.push(env.DB.prepare("INSERT INTO snippet_shares(token, snippet_id, owner_id, created_at) VALUES (?, ?, ?, ?)")
        .bind(input.share_token, input.id, user.id, input.created_at));
    }
    await env.DB.batch(statements);
    return json(request, { ok: true });
  }
  const revisionMatch = url.pathname.match(/^\/snippets\/([a-f0-9-]{36})\/revisions\/(undo|redo)$/);
  if (revisionMatch && request.method === "POST") {
    const current = await env.DB.prepare("SELECT id, title, body, version FROM snippets WHERE id = ? AND owner_id = ?").bind(revisionMatch[1], user.id).first();
    if (!current) return fail(request, "Snippet not found", 404);
    await env.DB.prepare("INSERT OR IGNORE INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(current.id, user.id, current.version, current.title, current.body, nowSeconds()).run();
    const comparison = revisionMatch[2] === "undo" ? "<" : ">";
    const order = revisionMatch[2] === "undo" ? "DESC" : "ASC";
    const target = await env.DB.prepare(`SELECT version, title, body FROM snippet_revisions WHERE snippet_id = ? AND owner_id = ? AND version ${comparison} ? ORDER BY version ${order} LIMIT 1`)
      .bind(current.id, user.id, current.version).first();
    if (!target) return json(request, { snippet: await storedSnippet(env, user.id, current.id) });
    await env.DB.prepare("UPDATE snippets SET title = ?, body = ?, version = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .bind(target.title, target.body, target.version, nowSeconds(), current.id, user.id).run();
    return json(request, { snippet: await storedSnippet(env, user.id, current.id) });
  }
  const match = url.pathname.match(/^\/snippets\/([a-f0-9-]{36})$/);
  if (match && request.method === "PUT") {
    const existing = await env.DB.prepare("SELECT id, title, body, version FROM snippets WHERE id = ? AND owner_id = ?").bind(match[1], user.id).first();
    if (!existing) return fail(request, "Snippet not found", 404);
    const input = await bodyJson(request);
    const value = validSnippet(input);
    if (!value) return fail(request, "Enter content or a title");
    if (!Number.isSafeInteger(input?.version)) return fail(request, "A snippet version is required", 428);
    if (input.version !== existing.version) return json(request, { error: "Snippet changed elsewhere", conflict: true, snippet: await storedSnippet(env, user.id, existing.id) }, 409);
    if (existing.title === value.title && existing.body === value.body) return json(request, { snippet: await storedSnippet(env, user.id, existing.id) });
    const nextVersion = existing.version + 1;
    const timestamp = nowSeconds();
    const updated = await env.DB.prepare("UPDATE snippets SET title = ?, body = ?, updated_at = ?, version = ? WHERE id = ? AND owner_id = ? AND version = ?")
      .bind(value.title, value.body, timestamp, nextVersion, match[1], user.id, existing.version).run();
    if (!updated.meta?.changes) return json(request, { error: "Snippet changed elsewhere", conflict: true, snippet: await storedSnippet(env, user.id, existing.id) }, 409);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(existing.id, user.id, existing.version, existing.title, existing.body, timestamp),
      env.DB.prepare("DELETE FROM snippet_revisions WHERE snippet_id = ? AND owner_id = ? AND version > ?").bind(existing.id, user.id, existing.version),
      env.DB.prepare("INSERT INTO snippet_revisions(snippet_id, owner_id, version, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(existing.id, user.id, nextVersion, value.title, value.body, timestamp),
      env.DB.prepare("DELETE FROM details WHERE snippet_id = ?").bind(match[1]),
    ]);
    return json(request, { snippet: await storedSnippet(env, user.id, existing.id) });
  }
  if (match && request.method === "DELETE") {
    const deleted = await env.DB.prepare("SELECT snippets.id, snippets.title, snippets.body, snippets.created_at, snippets.updated_at, snippets.version, snippet_shares.token AS share_token FROM snippets LEFT JOIN snippet_shares ON snippet_shares.snippet_id = snippets.id WHERE snippets.id = ? AND snippets.owner_id = ?")
      .bind(match[1], user.id).first();
    if (!deleted) return fail(request, "Snippet not found", 404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM details WHERE snippet_id = ?").bind(match[1]),
      env.DB.prepare("DELETE FROM snippet_shares WHERE snippet_id = ? AND owner_id = ?").bind(match[1], user.id),
      env.DB.prepare("DELETE FROM snippets WHERE id = ? AND owner_id = ?").bind(match[1], user.id),
    ]);
    return json(request, { ok: true, deleted });
  }
  return fail(request, "Not found", 404);
}

export default { async fetch(request, env) {
  try { return await handle(request, env); }
  catch (error) { console.error("Worker request failed", error); return fail(request, "Internal server error", 500); }
} };
