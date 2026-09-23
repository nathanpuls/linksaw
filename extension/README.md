# Linksaw Chrome extension

Load `extension/` in Chrome via `chrome://extensions` → Developer mode → Load unpacked. Sign in at `https://linksaw.com/login` in the same Chrome profile, then open the popup. It sends the existing Secure, HttpOnly, SameSite=Lax website cookie to `https://snippets-api.linksaw.com` with `credentials: include`; the cookie is scoped to `linksaw.com` and its subdomains. The popup does not read the cookie or hold its own token. Chrome treats requests to a permitted API host as same-site for cookie purposes. Browser settings that block these requests may require investigation in hands-on testing.

Permissions: `activeTab` and `scripting` insert into the current tab after the user invokes the popup; `clipboardWrite` supports Copy and insertion fallback. The only host permission is the existing API origin. No `cookies`, `storage`, broad site access, or permanent content script permission.

Insertion supports standard text inputs, textarea, and focused contenteditable in the top document. Restricted pages, frames, closed shadow roots, and some rich editors use the copy fallback. Focus the webpage field before opening the popup. Live sign-in and actual Chrome field insertion still need hands-on testing.
