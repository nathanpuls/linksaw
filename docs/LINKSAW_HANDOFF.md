# Linksaw handoff

Last verified: 2026-09-22

## Purpose of this handoff

This document carries the useful product and implementation context from the historical Trigger Search project into the current Linksaw codebase. It is intentionally narrower than the full conversation history. The repository and deployed systems remain the source of truth for implementation details; this file records the product direction and the decisions that should survive the transition.

## Repository identity

- `nathanpuls/linksaw` is the canonical repository for the current product: the Tauri desktop launcher and its Cloudflare Worker/D1 backend.
- `nathanpuls/trigger-search` is a historical predecessor. Preserve it. It contains the earlier Google Sheets, Hammerspoon/AutoHotkey, Electron, extension, and web experiments; it is not the current Linksaw implementation.
- `nathanpuls/linksaw-old` preserves the previous repository that used the `linksaw` name. Its latest verified state is the older Next.js/Supabase-era Linksaw application. Do not fold that history into the current app or treat it as current architecture.
- Other repositories with Linksaw-like names are experiments or adjacent projects unless the user explicitly says otherwise.

When code and this handoff disagree, inspect the current `nathanpuls/linksaw` repository, explain the discrepancy, and treat verified code as implementation truth. Do not silently revive behavior from Trigger Search or `linksaw-old`.

## Product philosophy

Linksaw is a private, fast way to retrieve and use small pieces of reusable text. Its core loop is deliberately short:

1. Open the launcher from anywhere.
2. Search a private snippet library.
3. Paste text into the previous app, open a link, preview, copy, or edit.

The product should feel lighter than a notes app and more durable than clipboard history. Optimize for speed, keyboard fluency, safety, and a small mental model. New capabilities should earn their place in that loop rather than turning the launcher into a general-purpose knowledge manager.

The Mac app is the current interaction reference, but not a pixel-for-pixel template for every platform. The responsive web app should preserve the data model, terminology, and core tasks while using natural web and touch patterns.

## Current architecture

### Desktop client

- Tauri 2 application.
- Vite-built, framework-free HTML/CSS/JavaScript interface.
- Rust handles native window behavior, paste/copy integration, paste-target capture, the macOS Right Command event tap, OS credential access through the session helper, and application quit protection.
- The desktop app targets macOS and Windows. macOS is the actively refined platform; Windows still needs hands-on compilation and behavior testing.
- The app is a compact, always-on-top launcher. On macOS it joins all Spaces, including full-screen Spaces.

### Backend and authentication

- Cloudflare Worker at `https://snippets-api.linksaw.com`.
- Cloudflare D1 database.
- Google browser sign-in uses an authorization-code flow. The desktop app creates a verifier/challenge pair; the Worker releases a one-time session only after the browser callback completes and the client proves the verifier.
- The Worker stores only a hash of each opaque session token. The desktop app stores the session in macOS Keychain or Windows Credential Manager, not browser local storage.
- Every snippet read and mutation requires a valid session and is scoped to the authenticated owner.
- Private API responses use `Cache-Control: no-store`, and the launcher does not persist a local snippet cache.

### Data model

The active product model is intentionally small:

- `users`: Google subject ID, email, display name, created timestamp.
- `sessions`: hashed session token, owner, creation and expiration timestamps. Current sessions expire after 30 days.
- `login_requests`: short-lived browser-sign-in state, proof challenge, resolved user, and consumed timestamp.
- `snippets`: UUID, owner ID, optional title, body/content, created timestamp, updated timestamp.

The database still has a legacy `details` table only for rollout cleanup. Details are not part of the product model: the client does not author them, the API does not return them as content, and authenticated startup deletes the signed-in user's old detail records.

Current server limits are a 160-character title, 100,000-character body, and up to 2,000 snippets returned in latest-edit order. Search runs in the client over title and content, preserving server order within equal match strength.

## Terminology and content behavior

- Product name in the app: **Linksaw**.
- The saved object is a **snippet**, not an item, link, card, record, or note.
- Its two fields are **Title** and **Content**.
- Title is optional. When absent, the first content line is the result label (trimmed to a compact display length).
- A title-only snippet is accepted and remains usable, although ordinary snippets center on content. CSV import currently requires a Content column.
- A complete URL opens in the browser. A URL containing `$` becomes a search template and substitutes the encoded query.
- Supported dynamic placeholders are `{clipboard}`, `{cursor}`, `{date}`, `{time}`, `{datetime}`, and `{day}`, including supported `format` and `offset` attributes. Arbitrary code execution is not a feature.

Avoid renaming established concepts without a concrete user need. In particular, do not reintroduce **Details** as a nested content type.

## Mac UX and visual language

### Launcher

- Compact, keyboard-first, frameless launcher with a search field and result list.
- The current top row keeps New snippet (`+`) and Settings beside the search field. Do not reopen their placement based only on abstract hierarchy; the current arrangement was retained for visual balance.
- Clicking a result and pressing Return perform the same primary action.
- Results show the title or first content line, plus a compact secondary preview when appropriate.
- Existing results remain usable while a background refresh is loading or has failed.
- The interface uses native system typography, restrained neutral surfaces, subtle separators, Lucide line icons, and system/light/dark appearance options.
- Tooltips are near-black with white text, appear after a short delay (currently 350 ms), work on keyboard focus, and include shortcuts when useful.

### Editor

- Sparse, single-column editing surface with Title and Content.
- Title is visually prominent and borderless; Content is the one main scrolling writing region.
- The editor's close control is an `X` at top right so the left edge remains free for the title.
- Delete and Save stay in a fixed footer. Delete requires confirmation.
- A save in progress locks editing. A failed save preserves the draft.
- Closing a changed draft, closing the window, or quitting offers Save, Discard, or Keep editing. Quit completes only after a successful requested save.

### Settings and preview

- Settings is a destination from the launcher, not an editor-style disposable draft. It uses a back arrow and restores the launcher's prior size and position when closed.
- On a sufficiently large window, Settings places preferences/account on the left and an always-visible shortcut reference on the right. Smaller layouts stack and scroll.
- Preview is full-window and read-only, with edit and copy actions. Left Arrow or Escape returns to search.
- Do not force every surface to use the same close glyph. The settled semantic rule is: back arrow means return/navigation; `X` dismisses a temporary editing or preview surface. Escape remains the universal keyboard way out, one layer at a time.

## Settled keyboard behavior

- On macOS, tapping and releasing Right Command by itself is the default launcher gesture. It must not interfere with ordinary Command shortcuts.
- The conventional default shortcut is Command/Control-Shift-Space and remains selectable; Windows uses the conventional shortcut rather than Right Command.
- Users can record a custom shortcut containing Command, Control, or Option/Alt plus a supported key.
- Command-N on macOS / Control-N on Windows opens a new snippet.
- Up/Down changes the selected result.
- Return uses the selected result: paste text, open a link, or enter a `$` search-template query.
- Right Arrow or Command/Control-P previews the selected snippet.
- Left Arrow returns from preview or search-template mode.
- Command/Control-E edits the selected snippet.
- Command/Control-C copies the selected or previewed snippet.
- Command/Control-K (and Shift-F10) opens the selected snippet's action menu.
- Command/Control-1 through 9 directly uses the corresponding visible result.
- Command/Control-S saves in the editor.
- Command/Control-R forces a refresh.
- `/` focuses Search; ordinary typing also returns focus to Search when no dialog is open.
- Escape closes only the topmost layer. From the bare launcher it hides the launcher.

Do not casually remap these shortcuts. They form the core learned behavior of the app.

## Refresh and offline behavior

- Reopening or focusing the launcher refreshes when the last successful fetch is at least 30 seconds old or the prior refresh failed.
- Manual refresh is always available.
- Saves, deletes, and CSV imports refresh immediately and queue a later read when needed to avoid stale responses winning a race.
- Existing in-memory results remain usable through loading and connection errors.
- Full offline storage/synchronization is intentionally not implemented. Do not describe the in-memory resilience above as offline support.

## Intentionally removed or deferred

These are not missing requirements for the current release:

- Nested Details: deliberately removed, with cleanup behavior retained during rollout.
- AI search.
- Live Google Sheets import or Sheets-based bulk editing. CSV import exists and is the current migration path.
- Public snippet sharing.
- Categories, folders, or tab browsing.
- Calculator behavior.
- Persistent offline storage/sync.
- Arbitrary executable snippet scripting.

Do not add one of these merely because it existed in Trigger Search or an older Linksaw experiment. Revisit it only when the user explicitly changes product scope and the feature can be reconciled with the focused launcher model.

## Verified state and open risks

Verified in the current source on 2026-09-22:

- The JavaScript test suite passes (22 tests).
- The Vite production build succeeds.
- The source implements owner-scoped authenticated snippet CRUD, CSV import with safe retry IDs, client search, preview/edit/copy/delete, placeholder expansion, shortcut preferences, refresh race handling, and draft/quit protection.
- The deployed Worker/D1 configuration and custom API hostname are present in the repository.

Do not overstate the following:

- This is still an experimental build, not a distributed production release.
- Complete Google sign-in, live snippet editing, and real paste into third-party apps still need hands-on end-to-end verification in the installed signed Mac app.
- Windows compilation, credential storage, shortcut behavior, and paste behavior still need hands-on testing.
- The local macOS session helper is tied to a persistent local signing identity. Development-mode executables are a different macOS identity and cannot stand in for installed-app permission testing.
- Production readiness still requires an intentional signing/notarization plan, rate limiting, session-management UI, sign-in failure auditing, and automated cross-platform security tests.

## Roadmap

1. **Preserve the current Mac v1 interaction model.** Treat it as design-complete enough to move forward; limit further work to real usability problems and release blockers rather than speculative rearrangement.
2. **Complete Mac end-to-end validation.** Verify live Google sign-in, snippet CRUD, actual paste/cursor behavior, Spaces behavior, draft protection, and upgrade behavior in the signed installed app.
3. **Build the responsive web app next.** Reuse the same private snippet model and core tasks—search, create, edit, preview/copy/use where the browser permits, import, settings/account—but design responsively for keyboard, pointer, and touch. Seek feature/model consistency, not a pixel copy of the desktop launcher.
4. **Validate and package Windows.** Compile and test credential storage, global shortcuts, paste behavior, installer output, and the Windows-specific interaction details on a real Windows environment or CI runner.
5. **Prepare for distribution.** Add production signing/notarization, security hardening, session controls, observability that excludes snippet contents/tokens, and release/upgrade testing.

Deferred features should follow evidence from real use rather than precede the responsive web and release-hardening work.

## Development guardrails

- Inspect the current repository before answering code-specific questions or making changes. Search for the relevant file; never guess a path or implementation.
- Read this handoff and `README.md` before broad product or architecture work.
- Preserve `nathanpuls/trigger-search` and `nathanpuls/linksaw-old`; do not rewrite, merge, or delete them as cleanup.
- Never commit OAuth secrets, session tokens, `.dev.vars`, macOS signing material, logs, build outputs, or generated credential-helper binaries.
- Preserve the existing generated macOS session helper across routine local builds. Replacing it requires an explicit credential-migration plan because Keychain access is sensitive to the signed executable identity.
- Use Vite/Tauri development mode for normal UI/native iteration, but use the signed installed app for Keychain, Accessibility, and real paste verification.
- Keep diagnostics free of snippet contents and authentication tokens.
- Update this handoff when a product decision is explicitly changed, and identify the evidence for that change.

