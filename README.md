# Linksaw — desktop and web apps

A separate Mac/Windows desktop app inspired by Trigger Search's Electron launcher. The new app uses a Cloudflare Worker with D1 instead of Google Sheets. Snippets are private per Google account: no API route lists, reads, creates, edits, or deletes snippets without a valid session, and every query is scoped to the signed-in owner.

The responsive web app is served at `https://linksaw.com/app`, uses the same Worker and D1 database, and replaces the desktop app's native paste action with Copy. A standalone static marketing page is served at `https://linksaw.com`; `/login` starts the shared Google sign-in flow. Browser sessions use a Secure, HttpOnly cookie while desktop sessions continue to use the operating system credential vault.

For the product decisions, settled interaction model, repository transition, and platform roadmap, read [`docs/LINKSAW_HANDOFF.md`](docs/LINKSAW_HANDOFF.md). Recommended instructions for the fresh ChatGPT project are in [`docs/CHATGPT_PROJECT_INSTRUCTIONS.md`](docs/CHATGPT_PROJECT_INSTRUCTIONS.md).

## What works in the prototype

- Compact, fast launcher with global Command/Control–Shift–Space shortcut, arrow-key selection, Return **and click** with identical actions, and Escape to hide. The older Electron experiment must use a different shortcut while both apps are running.
- Each snippet has an optional title and primary content. Without a title, the first content line becomes the result name. Search covers title and content. Results follow latest-edit order unless a stronger text match ranks higher.
- Create, preview, edit, copy, paste, and delete snippets. The earlier nested Details feature has been removed; authenticated startup deletes any legacy detail records for that account.
- Ordinary text pastes into the previous app; a complete web link opens in the browser. A URL containing `$` enters search mode and substitutes the encoded query. The prior clipboard is restored after a successful paste when unchanged.
- Trigger Search-style `{clipboard}`, `{cursor}`, `{date}`, `{time}`, `{datetime}`, and `{day}` placeholders, including `format` and `offset` attributes. No arbitrary code execution.
- Google sign-in through a browser authorization-code flow. The desktop client proves possession of a random verifier before the Worker releases a one-time session. The session is stored in the macOS Keychain or Windows Credential Manager, not browser local storage.

## Launcher and editor actions

Icon controls use near-black, rounded tooltips with white labels after a short hover delay (350 ms), also available on keyboard focus. Tooltips include shortcuts where useful; clearing search retains focus in Search.

The editor is a sparse, single-column note with Title and Content, one scrolling content area, and a fixed footer for Delete and Save. Settings fills a moderately larger window, with narrower controls and preferences/account information on the left and always-visible shortcuts on the right. Back or Escape restores the launcher’s previous size and position. On smaller screens the layout stacks and scrolls.

On macOS the launcher joins all Spaces, including other apps’ full-screen Spaces, using AppKit collection behavior. The existing Right Command event tap, paste target capture, and session helper are preserved.

- Snippets refresh on launcher reopen/focus when the last successful fetch is at least 30 seconds old, or a previous refresh failed. Existing results remain available during loading and after connection errors; Retry fetches again. Command/Control–R forces a manual refresh. Saves, deletes, and CSV imports still refresh immediately, queuing a new read if another request began before the write.
- Command–N on macOS or Control–N on Windows opens a new snippet from the launcher.
- Right-click a result, or press Command/Control–K, for Preview, Edit, Copy, and Delete. Deletion still asks for confirmation.
- Right Arrow or Command/Control–P opens a full-window, read-only Preview of the selected snippet. Return or Command/Control–1 uses it; Command/Control–C copies it; Left Arrow or Escape returns to Search. Existing paste, URL, template, and dynamic-placeholder behavior applies.
- Command/Control–S saves the editor. Saving disables editing until the request finishes; a failed save leaves the draft intact.
- Closing a changed editor offers Save, Discard, or Keep editing. The same warning protects application Quit and window close. Save before quitting exits only after a successful save; failed saves keep the draft open.

## Current limits

- This is an unsigned experimental build, not a distributed release. Mac native compilation, the deployed D1 schema, unauthenticated API protection, and the start of the live Google sign-in flow were verified. Windows compilation, a completed sign-in, snippet editing against the live database, and real paste into third-party apps still need hands-on tests.
- The D1 database, Worker, and dedicated Google OAuth client are configured. The Worker now runs at `https://snippets-api.linksaw.com`; this hostname was unused before it was connected, and the existing `linksaw.com` website was not changed. The API and sign-in start endpoint respond over HTTPS. Chrome's automated test browser still reports `ERR_BLOCKED_BY_CLIENT` for this API hostname, so sign-in cannot yet be claimed to work end-to-end in that browser setup.
- No AI search, Google Sheets import/bulk editing, public sharing, categories, tab browsing, calculator, or offline storage. This intentionally keeps the first product focused on private snippets.

## Local development

Install Node.js and Rust, then run `npm install`. The Worker uses `wrangler.toml` and the remote D1 database is already configured. Run `npm run worker:migrate` for a new local test database. The remote tables were applied in Cloudflare's dashboard.

The deployed Google OAuth **Web application** client uses `https://snippets-api.linksaw.com/auth/callback` as its redirect URI. The old `workers.dev` URI remains on that client for now, but Wrangler disabled the old Worker URL when the custom domain was deployed. The Google client ID and secret are configured as Worker secrets, not stored in this repository. `PUBLIC_BASE_URL` and the custom domain route are configured in `wrangler.toml`. To reproduce this on another account, create a new client and set the two Worker secrets. For local testing, copy `.dev.vars.example` to `.dev.vars` and fill it in; never commit that file. For local sign-in, also register `http://127.0.0.1:8799/auth/callback` and set the local `PUBLIC_BASE_URL` accordingly.

Use `npm run tauri:dev` for day-to-day development. It starts Vite in the native app window: HTML, CSS, and JavaScript changes appear without making a new app bundle. Tauri watches Rust changes and recompiles/restarts the development app automatically. Quit the installed Linksaw copy first, since only one copy can own the global launcher shortcut. Use `npm test` for logic tests. Run `npm run tauri:build -- --bundles app` and replace the Applications copy only for a deliberate handoff or release, not for each edit. Windows builds need a Windows machine or CI runner and `npm run tauri:build -- --bundles nsis`.

The framework-free web client lives in `web/app`, and the static public homepage and crawl files live directly in `web`. `wrangler.toml` mounts the existing Worker at the required `linksaw.com` paths while preserving `snippets-api.linksaw.com`. A Worker deployment publishes the homepage, app, API, favicon, robots file, and sitemap together. The former `LINKSAW` Google Sheet homepage is retained only as an archive and is marked accordingly in its source cell.

**macOS session-helper limitation:** The current helper requires a signed `.app` parent. The standalone executable launched by `tauri:dev` cannot access the saved session and can report “Caller is not a Mac app.” A signed development bundle has not yet been configured. Until that is in place, use Vite for UI-only previews and the signed installed app for authenticated native testing.

### Starting a development session

Development mode does not start automatically. Quit the installed app, then run `npm run tauri:dev` from this project folder once per working session. Keep that command running while making changes. Start it again after stopping the command, quitting the development app, or restarting the computer. The installed app's **Launch at login** setting starts the production app, not development mode.

- **UI changes:** Vite updates CSS and supports hot reload. Some HTML or JavaScript changes reload the interface, but do not require rebuilding or replacing the installed app.
- **Native changes:** Rust changes, including pasting, Accessibility, Right Command, and Keychain behavior, require recompilation and a restart of the development app; Tauri's development watcher handles this.
- **Final testing:** At a stable checkpoint, deliberately make one signed production build with `npm run mac:build` and install it. Check Accessibility, session access, and real pasting in the signed installed app because the development app has a separate macOS identity. Preserve the existing session helper; do not regenerate it for routine updates.

The app's Settings button accepts a local Worker URL or a deployed HTTPS Worker URL. Use `npm run worker:dev` only when changing and testing the Worker locally; otherwise the desktop development app can talk to the existing deployed cloud API.

The OAuth callback, Worker and desktop API origin must agree. The built app defaults to the deployed HTTPS Worker. Production URLs must use HTTPS.

## Local Mac identity and diagnostics

Mac sign-in now uses a persistent `SessionHelper/linksaw-session-helper` executable in the app data directory. `npm run mac:build` builds and signs its source in `session-helper/` only when `src-tauri/helper-bin/linksaw-session-helper` does not exist. Preserve that generated file across routine updates: the legacy Keychain partition ACL uses executable hashes even for our locally signed app. The helper verifies its parent's Linksaw signing requirement, and the app checks the helper's exact bytes before invoking it. Tokens pass through private subprocess pipes, never command arguments or plaintext files. The helper migrates the old session once and writes a separate Keychain entry; signing out writes an empty sentinel so an old login cannot be restored. Do not rebuild or replace the helper without an explicit migration plan. This local prototype is tied to its local signing certificate; production distribution must supply its own verified identity.

For this Mac's installed test app, use `npm run mac:build` instead of distributing the raw ad-hoc build. It signs the bundle with the persistent Linksaw local certificate. The private signing material is outside the source tree in `~/Library/Application Support/Linksaw Snippets/Signing`, readable only by its owner. Never commit or upload that directory. The certificate is for local testing, not public distribution or notarization.

Quit the installed app before replacing `/Applications/Linksaw.app`. Do not create alternate `.app` backups: they can confuse macOS app registration and Accessibility Settings. The stable designated requirement is the bundle identifier plus the signing certificate, not a changing binary hash. Changing this certificate would require a fresh Accessibility grant. On a different Mac, local certificate approval must be completed explicitly; the signing script does not change trust settings.

`~/Library/Logs/com.linksaw.snippets/launcher.log` records startup, permission transitions, shortcut taps, focus changes and paste success/failure. It deliberately excludes snippet contents and authentication tokens. A development-mode executable is a separate identity; use the signed installed bundle for permission and end-to-end paste tests, and Vite for ordinary interface edits.

## Security notes

The Worker exchanges the Google authorization code with its server-side client secret and asks Google's userinfo endpoint for a verified account ID. D1 stores only a hash of each opaque session token. The desktop client stores the token in the OS credential vault. The API returns `Cache-Control: no-store`; private snippets are not persisted in the launcher cache. This is a prototype, not yet a production security review or penetration test. Before broad release, add request rate limiting, a session-management UI, sign-in failure auditing, and automated cross-platform security tests.
