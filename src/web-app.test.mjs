import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/app/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../web/app/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/app/app.css", import.meta.url), "utf8");
const linkifier = readFileSync(new URL("../web/app/linkify.js", import.meta.url), "utf8");

test("autosave waits for settled meaningful text and has no permanent save button", () => {
  assert.doesNotMatch(html, /id="save-snippet"/);
  assert.match(source, /autosaveTimer = setTimeout\(\(\) => \{ void saveEditorNow\(\); \}, 700\)/);
  assert.match(source, /if \(!state\.editing && !value\.body\.trim\(\)\) \{ setEditorStatus\(""\); return true; \}/);
  assert.match(source, /setEditorStatus\("Saving…"\)[\s\S]*?await api[\s\S]*?setEditorStatus\("Saved"\)/);
  assert.match(html, /id="editor-status-text"[\s\S]*id="editor-retry"[^>]*hidden>Retry/);
});

test("command save runs autosave immediately and suppresses browser save", () => {
  assert.match(source, /const saveShortcut = event\.key\.toLowerCase\(\) === "s"[\s\S]*?isMacPlatform \? event\.metaKey && !event\.ctrlKey : event\.ctrlKey && !event\.metaKey/);
  assert.match(source, /if \(saveShortcut\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?void saveEditorNow\(\)/);
  assert.match(html, /<dt>⌘\/Ctrl S<\/dt><dd>Save now<\/dd>/);
});

test("default workspace tabs directly between search and content", () => {
  assert.match(source, /\$\("search"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && !event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("snippet-body"\)\.focus\(\)/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("search"\)\.focus\(\)/);
});

test("editor label and content share one exact text gutter", () => {
  assert.match(css, /\.viewer-header \{[^}]*padding: 9px 22px;/);
  assert.match(css, /\.editor-name-action \{[^}]*margin-left: -11px;[^}]*border-radius: 6px;[^}]*padding: 7px 11px;[^}]*background: transparent;/);
  assert.match(css, /\.editor-name-input \{[^}]*margin-left: -12px;[^}]*border: 1px solid var\(--control\);[^}]*border-radius: 6px;[^}]*padding: 7px 11px;[^}]*background: var\(--hover\);[^}]*font-size: 16px;[^}]*font-weight: 550;[^}]*box-shadow: none;/);
  assert.match(css, /\.editor-name-input:focus \{ border-color: var\(--focus\); outline: 0; box-shadow: none; \}/);
  assert.match(css, /\.content-input \{[^}]*padding: 8px 36px 48px 74px;/);
});

test("primary editor is content-only and supports quiet inline custom names", () => {
  assert.doesNotMatch(html, /id="snippet-title"/);
  assert.match(html, /<textarea id="snippet-body" class="content-input" autocomplete="off"><\/textarea>/);
  assert.doesNotMatch(html, /<textarea[^>]*placeholder=/);
  assert.doesNotMatch(source, /routeEmptySnippetPaste/);
  assert.match(source, /function openEditor[\s\S]*?\$\("snippet-body"\)\.value = snippet\?\.body \|\| ""; editorCustomName = snippet\?\.title \|\| "";[\s\S]*?setSelectionRange\(0, 0\)/);
  assert.match(source, /function editorSnapshot\(\)[\s\S]*?JSON\.stringify\(\{ title, body: \$\("snippet-body"\)\.value \}\)/);
  assert.match(source, /function snippetText\(snippet\) \{ return snippet\.body \|\| ""; \}/);
  assert.match(source, /function derivedLabel\(body\)[\s\S]*?find\(line => line\.trim\(\)\)/);
  assert.match(source, /function label\(snippet\) \{ return snippet\.title\.trim\(\) \|\| derivedLabel\(snippet\.body\); \}/);
  assert.match(html, /id="editor-name" class="editor-name-action"[^>]*aria-label="Rename"[^>]*data-tooltip="Rename"/);
  assert.match(html, /id="editor-name-input" class="editor-name-input"[^>]*maxlength="160"[^>]*hidden/);
  assert.doesNotMatch(html, /id="rename-dialog"/);
  assert.match(source, /event\.key === "Enter"[\s\S]*?finishInlineRename\(\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?finishInlineRename\(\{ cancel: true \}\)/);
  assert.match(source, /const unchangedAutomaticName = !inlineRenameBaseline\.trim\(\) && enteredName === derivedLabel/);
  assert.match(source, /editorCustomName = cancel \? inlineRenameBaseline : unchangedAutomaticName \? "" : enteredName/);
});

test("rows provide one-click link, viewer, and edit actions", () => {
  assert.doesNotMatch(source, /row-open|icons\.externalLink/);
  assert.match(source, /function activateSnippet\(snippet\)[\s\S]*?if \(url\) openInNewTab\(url\);[\s\S]*?else openPreview\(snippet\);/);
  assert.match(source, /function runListActionAfterSave\(action\)[\s\S]*?navigateAfterSave[\s\S]*?closeSurface\("editor"\)[\s\S]*?action\(\)/);
  assert.match(source, /main\.ariaLabel = `Open \$\{label\(snippet\)\} website`/);
  assert.match(source, /main\.addEventListener\("click"[\s\S]*?runListActionAfterSave[\s\S]*?activateSnippet\(snippet\)/);
  assert.match(source, /edit\.ariaLabel = "Edit"; edit\.dataset\.tooltip = "Edit"/);
  assert.match(source, /edit\.addEventListener\("click", event => \{ event\.stopPropagation\(\);[\s\S]*?openEditor\(snippet\)/);
  assert.match(source, /event\.key === "Enter" && selected && document\.activeElement === \$\("search"\)[\s\S]*?runListActionAfterSave\(\(\) => activateSnippet\(selected\)\)/);
  assert.match(css, /\.result-link-text \{ text-decoration: underline;/);
  assert.match(css, /\.result-edit \{[^}]*visibility: hidden;[^}]*pointer-events: none;/);
  assert.match(css, /\.result-row:hover \.result-edit,[\s\S]*?\.results:not\(:has\(\.result-row:hover\)\) \.result-row\.selected \.result-edit,[\s\S]*?\.results:not\(:has\(\.result-row:hover\)\) \.result-edit:focus-visible \{ visibility: visible; pointer-events: auto; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.result-edit \{ width: 44px; height: 44px; visibility: visible; pointer-events: auto; \}/);
  assert.match(html, /id="preview-edit"[^>]*aria-label="Edit"[^>]*data-tooltip="Edit"/);
});

test("viewer delete is last, reversible, and restores stored metadata", () => {
  assert.match(html, /id="preview-copy"[\s\S]*id="preview-share"[\s\S]*id="preview-edit"[\s\S]*id="preview-delete" class="icon-button viewer-delete"[^>]*aria-label="Delete"[^>]*data-tooltip="Delete"/);
  assert.match(source, /icon\("preview-delete", "trash"\)/);
  assert.match(css, /\.viewer-delete \{ margin-left: 9px; \}/);
  assert.match(source, /\$\("preview-delete"\)\.addEventListener\("click", \(\) => deleteSnippet\(state\.previewing\)\)/);
  assert.match(source, /async function deleteSnippet\(snippet\)[\s\S]*?method: "DELETE"[\s\S]*?state\.snippets = state\.snippets\.filter[\s\S]*?showDeleteUndo\(deleted, viewerWasOpen\)/);
  assert.match(source, /"Snippet deleted ·"[\s\S]*?"Undo"[\s\S]*?}, 7000\)/);
  assert.match(source, /\/snippets\/\$\{undo\.deleted\.id\}\/restore[\s\S]*?method: "POST"[\s\S]*?JSON\.stringify\(undo\.deleted\)/);
  assert.match(html, /id="toast-message"[\s\S]*id="toast-action" class="toast-action"/);
  assert.doesNotMatch(css, /\.viewer-delete[^}]*red|\.toast-action[^}]*red/);
});

test("mobile editor keeps destructive and save actions inside the viewport", () => {
  assert.match(html, /id="delete" class="icon-button delete-action"[^>]*aria-label="Delete snippet"[^>]*data-tooltip="Delete snippet"/);
  assert.match(source, /trash: '<svg[\s\S]*?icon\("delete", "trash"\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?#editor \{ height: 100dvh; overflow: hidden; \}/);
  assert.match(css, /#editor \.surface-inner \{ height: 100%; min-height: 0; \}/);
  assert.match(css, /#editor \.surface-header, #editor \.surface-footer \{ flex: 0 0 auto; \}/);
  assert.match(css, /#editor \.content-input \{ min-height: 0; \}/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("destructive actions use branded cancellable dialogs", () => {
  assert.doesNotMatch(source, /\bconfirm\(/);
  assert.match(html, /id="action-confirm-dialog" class="confirm-dialog"/);
  assert.match(html, /id="action-confirm-button" class="confirm-action"/);
  assert.match(css, /\.confirm-action \{[^}]*background: #171717;[^}]*color: #fff;/);
  assert.match(source, /function cancelDialogOnBackdrop\(dialog\)[\s\S]*?event\.target === dialog[\s\S]*?dialog\.close\("cancel"\)/);
  assert.match(source, /requestConfirmation\(\{ title: "Stop sharing\?"/);
});

test("navigation flushes autosave and retry preserves the intended destination", () => {
  assert.doesNotMatch(html, /id="unsaved-dialog"/);
  assert.match(source, /async function navigateAfterSave\(destination\)[\s\S]*?pendingNavigation = destination[\s\S]*?await flushEditorSave\(\)[\s\S]*?destination\(\)/);
  assert.match(source, /\$\("close-editor"\)\.addEventListener\("click", \(\) => \{ void navigateAfterSave\(leaveRoutedView\); \}\)/);
  assert.match(source, /\$\("settings"\)\.addEventListener\("click", \(\) => \{ void navigateAfterSave\(\(\) => openSettings\(\)\); \}\)/);
  assert.match(source, /\$\("editor-retry"\)\.addEventListener[\s\S]*?saved && pendingNavigation[\s\S]*?destination\(\)/);
  assert.match(source, /addEventListener\("beforeunload"[\s\S]*?saveInFlight[\s\S]*?saveFailed/);
});

test("autosave queues newer edits behind active requests", () => {
  assert.match(source, /if \(saveInFlight\) \{[\s\S]*?saveAgain = true;[\s\S]*?await saveInFlight[\s\S]*?editorSnapshot\(\) !== editorBaseline[\s\S]*?saveEditorNow\(\)/);
  assert.match(source, /const snapshot = editorSnapshot\(\)[\s\S]*?editorBaseline = snapshot[\s\S]*?if \(editorSnapshot\(\) === editorBaseline\) setEditorStatus\("Saved"\)/);
});

test("new snippet creation is idempotent across a lost response", () => {
  assert.match(source, /editorCreateId = snippet \? "" : crypto\.randomUUID\(\)/);
  assert.match(source, /body: JSON\.stringify\(creating \? \{ \.\.\.value, importId: editorCreateId \} : value\)/);
  assert.match(source, /if \(!savedSnippet\) \{[\s\S]*?api\("\/snippets"\)[\s\S]*?snippet\.id === result\.id/);
});

test("editor provides local and persistent undo and redo", () => {
  assert.match(html, /id="editor-undo"[^>]*aria-label="Undo"[^>]*data-tooltip="Undo"[^>]*disabled/);
  assert.match(html, /id="editor-redo"[^>]*aria-label="Redo"[^>]*data-tooltip="Redo"[^>]*disabled/);
  assert.match(source, /undo: '<svg[\s\S]*?redo: '<svg/);
  assert.match(source, /function rememberLocalState[\s\S]*?localUndo\.push\(snapshot\)[\s\S]*?localRedo = \[\]/);
  assert.match(source, /async function performEditorHistory\(direction\)[\s\S]*?\/revisions\/\$\{direction\}/);
  assert.match(source, /const undoShortcut[\s\S]*?const redoShortcut[\s\S]*?performEditorHistory\(undoShortcut \? "undo" : "redo"\)/);
  assert.match(css, /\.icon-button:disabled \{ color: var\(--control\); cursor: default; \}/);
});

test("icon-only controls use delayed custom tooltips with shortcut badges", () => {
  assert.doesNotMatch(html, /\stitle=/);
  assert.match(html, /data-tooltip="Copy"/);
  assert.match(html, /<label id="search-icon" class="search-icon" for="search"/);
  assert.match(css, /\.search-icon \{[^}]*cursor: text;/);
  assert.match(html, /id="clear-search" class="search-clear"[^>]*data-shortcut="Esc"[^>]*hidden/);
  assert.match(html, /id="tooltip-shortcut"/);
  assert.match(source, /dataset\.shortcut = commandShortcut\("C"\)/);
  assert.match(source, /}, 450\);/);
  assert.match(source, /button\.dataset\.tooltip = "Copied"/);
  assert.match(source, /pointerout[\s\S]*?!target\.matches\(":hover"\)\) hideTooltip\(\)/);
  assert.match(source, /addEventListener\("blur", hideTooltip\)/);
  assert.match(source, /addEventListener\("pagehide", hideTooltip\)/);
  assert.match(source, /visibilitychange[\s\S]*?document\.hidden\) hideTooltip\(\)/);
  assert.match(source, /matchMedia\("\(hover: none\), \(pointer: coarse\)"\)/);
  assert.match(source, /function showTooltip\(target\) \{[\s\S]*?!tooltipsEnabled\(\)/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\) \{[\s\S]*?\.custom-tooltip \{ display: none !important; \}/);
  assert.match(source, /async function shareSnippet[\s\S]*?finally \{ hideTooltip\(\); \$\("preview-share"\)\.blur\(\); \}/);
  assert.match(source, /\$\("search"\)\.value = "";[\s\S]*?dispatchEvent\(new Event\("input"[\s\S]*?\$\("search"\)\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?else if \(\$\("search"\)\.value\) \{ event\.preventDefault\(\); clearSearch\(\); \}/);
});

test("content editing keeps the same plain-text scale and vertical rhythm", () => {
  assert.match(css, /\.preview-title \{ font-size: 16px; font-weight: 550;/);
  assert.match(css, /\.preview-body \{[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.content-input \{[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.preview-body, \.content-input \{ padding: 8px 22px 40px 16px; \}/);
});

test("sidebar Linksaw mark links home before the account control", () => {
  assert.match(html, /<a class="identity-logo-link" href="https:\/\/linksaw\.com"[^>]*>[\s\S]*?<img class="identity-logo"[^>]*>[\s\S]*?<button id="settings"/);
  assert.match(css, /\.identity-logo \{ width: 28px; height: 28px;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.list-pane \{ height: 100dvh; border-right: 0; \}/);
  assert.match(css, /\.sidebar-footer \{ z-index: 1; min-height: calc\(58px \+ env\(safe-area-inset-bottom\)\);[\s\S]*?background: var\(--paper\); \}/);
  assert.match(css, /\.viewer-pane \{[^}]*z-index: 10; height: 100dvh;/);
  assert.match(css, /\.viewer-content \{ height: 100dvh; \}/);
});

test("viewer shows only explicit custom names above exact content", () => {
  const viewer = source.match(/function renderViewer\(snippet\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(viewer, "viewer renderer is present");
  assert.match(viewer, /const heading = snippet\.title\.trim\(\);/);
  assert.doesNotMatch(viewer, /snippet\.title\.trim\(\) !== snippet\.body\.trim\(\)/);
  assert.doesNotMatch(viewer, /derivedLabel/);
  assert.match(viewer, /\$\("preview-body"\)\.hidden = !snippet\.body;/);
  assert.match(viewer, /renderLinkedText\(\$\("preview-body"\), snippet\.body\);/);
});

test("viewer uses shared QK-style linkification and underlined styling", () => {
  assert.match(source, /import \{ linkifyText \} from "\.\/linkify\.js\?v=20260924-1"/);
  assert.match(source, /function renderLinkedText[\s\S]*?linkifyText\(text\)/);
  assert.match(linkifier, /const EMAIL =/);
  assert.match(linkifier, /const PROTOCOL_URL =/);
  assert.match(linkifier, /const PHONE =/);
  assert.match(linkifier, /const STREET_ADDRESS =/);
  assert.match(css, /\.preview-body a \{[^}]*text-decoration-thickness: 1\.2px;[^}]*text-decoration-skip-ink: none;[^}]*word-break: break-word;/);
});

test("settings offers working CSV and JSON transfer controls", () => {
  for (const label of ["Import CSV", "Import JSON", "Export CSV", "Export JSON"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /<section id="import-export" class="transfer-settings" tabindex="-1">[\s\S]*?<h2>Import and export<\/h2>/);
  assert.match(css, /@media \(max-width: 700px\) \{\s*\.transfer-settings \{ display: none; \}\s*\}/);
  assert.match(source, /location\.hash === "#import-export"[\s\S]*?scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(source, /importLibrary\(event\.target, parseCsvSnippets\)/);
  assert.match(source, /importLibrary\(event\.target, parseJsonSnippets\)/);
  assert.match(source, /downloadLibrary\(snippetsToCsv\(state\.snippets\)/);
  assert.match(source, /downloadLibrary\(snippetsToJson\(state\.snippets\)/);
});

test("deep links wait to reveal the resolved view", () => {
  assert.ok(html.indexOf("route-pending") < html.indexOf('rel="stylesheet"'));
  assert.match(html, /html\.route-pending body \{ visibility: hidden; \}/);
  assert.match(source, /view === "settings"\) \{ openSettings\(false\); revealInitialView\(\); return;/);
  assert.match(source, /catch \(error\) \{ revealInitialView\(\); showError\(error\); \}/);
});
