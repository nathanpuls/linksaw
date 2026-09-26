# Chrome Web Store release

## Listing copy

**Name:** Linksaw

**Summary:** Search, paste, and save your Linksaw snippets from Chrome.

**Description:**

Linksaw keeps your reusable text and saved links close at hand. Search your private snippet library from the toolbar, paste text into the field you are using, or open saved websites without leaving your current workflow.

- Open Linksaw with a keyboard shortcut.
- Type your configured trigger in a webpage field for quick search.
- Paste text snippets or open saved links.
- Right-click selected text, a page, or a link to save it to Linksaw.
- Open any snippet in the Linksaw web app to read, edit, share, or delete it.

Linksaw uses the same Google sign-in and private library as the Linksaw web and desktop apps.

## Permission justifications

- **activeTab:** inserts the selected snippet into the field that was active when the Linksaw popup opened.
- **scripting:** performs that insertion in the active page after an explicit user action.
- **clipboardWrite:** copies the selected snippet when direct insertion is unavailable.
- **contextMenus:** adds explicit Save selection, Save page, and Save link commands to Chrome's right-click menu.
- **Host access to `https://snippets-api.linksaw.com/*`:** reads and saves the signed-in user's private Linksaw snippets. The extension does not request broad website host access for API calls.

The content script runs on ordinary HTTP and HTTPS pages only to recognize the user-configured autocomplete trigger and insert a chosen snippet into the focused field. It does not read or transmit unrelated page content.

## Release checklist

1. Run the complete test suite.
2. Confirm the version in `extension/manifest.json` is newer than the uploaded version.
3. Create a ZIP whose root contains `manifest.json` and only the extension runtime files.
4. Upload the ZIP in the Chrome Web Store developer dashboard.
5. Use `https://linksaw.com/privacy` for the privacy-policy URL and `https://linksaw.com` for the homepage.
6. Complete the data-use disclosure using the permission explanations above.
7. Verify the toolbar popup, both shortcut commands, all three context-menu saves, sign-in, paste fallback, and the web Settings link in the uploaded draft.
8. Submit the listing for review only after the uploaded draft passes those checks.

The default toolbar shortcut is `Command+Shift+L` on macOS and `Ctrl+Shift+L` on Windows/Linux. Chrome users can change it and assign a combination to the autocomplete overlay at `chrome://extensions/shortcuts`. The account-level trigger continues to support a single printable key such as `;`.
