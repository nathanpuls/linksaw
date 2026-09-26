# Linksaw Chrome extension

Load `extension/` in Chrome via `chrome://extensions` → Developer mode → Load unpacked. Sign in at `https://linksaw.com/login` in the same Chrome profile, then open the popup. It sends the existing Secure, HttpOnly, SameSite=Lax website cookie to `https://snippets-api.linksaw.com` with `credentials: include`; the cookie is scoped to `linksaw.com` and its subdomains. The popup does not read the cookie or hold its own token. Chrome treats requests to a permitted API host as same-site for cookie purposes. Browser settings that block these requests may require investigation in hands-on testing.

The account's autocomplete trigger is managed in Linksaw's web Settings. In a supported webpage field, type the trigger at the beginning of the field or after whitespace to open a centered search panel. Return inserts the selected snippet and Escape closes the panel. Clicking the toolbar icon continues to open the compact popup.

The toolbar popup ships with `Command+Shift+L` on macOS and `Ctrl+Shift+L` on Windows/Linux. Both shortcuts can be changed at `chrome://extensions/shortcuts`. The optional **Open Linksaw search in the current field** command can be assigned any Chrome-supported key combination there. The account-level autocomplete trigger still supports a single printable key such as `;`.

Right-click selected text, a page, or a link to save it directly to Linksaw. Page captures use the page title as the optional title and its URL as content. Selection text is preserved as content, and links are saved as their URL. A quiet badge on the toolbar icon confirms success or reports that sign-in is needed.

Permissions: `activeTab` and `scripting` insert from the toolbar popup; `clipboardWrite` supports Copy and insertion fallback; `contextMenus` adds the three explicit Save to Linksaw commands. A content script runs on ordinary HTTP and HTTPS pages so it can detect the configured trigger and insert into the focused field. The only host permission is the existing API origin. No `cookies` permission is used, and Chrome's protected pages remain unavailable.

Insertion supports standard text inputs, textarea, and focused contenteditable in the top document. Restricted pages, frames, closed shadow roots, and some rich editors use the copy fallback. Focus the webpage field before opening the popup. Live sign-in and actual Chrome field insertion still need hands-on testing.
