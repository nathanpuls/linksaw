import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/app/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../web/app/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/app/app.css", import.meta.url), "utf8");

test("empty snippets are rejected before the saving state begins", () => {
  const submitHandler = source.match(/\$\("editor-form"\)\.addEventListener\("submit",[\s\S]*?\n\}\);/)?.[0];
  assert.ok(submitHandler, "editor submit handler is present");
  assert.match(submitHandler, /!payload\.body\.trim\(\)/);
  assert.ok(submitHandler.indexOf("Enter snippet text") < submitHandler.indexOf("Saving…"));
});

test("save button is gray and disabled until the snippet has a value", () => {
  assert.match(html, /id="save-snippet" class="save-button" type="submit" data-tooltip="Save" disabled/);
  assert.match(css, /\.save-button:disabled \{[^}]*background: #9a9a9a;[^}]*color: #fff;[^}]*opacity: 1;[^}]*cursor: default;/);
  assert.match(source, /function syncSaveButton\(\)[\s\S]*?editorSaving \|\| !hasValue/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("input", \(\) => \{ syncSaveButton\(\);/);
});

test("command save reuses form validation and suppresses browser save", () => {
  assert.match(source, /\$\("save-snippet"\)\.dataset\.shortcut = commandShortcut\("S"\)/);
  assert.match(source, /const saveShortcut = event\.key\.toLowerCase\(\) === "s"[\s\S]*?isMacPlatform \? event\.metaKey && !event\.ctrlKey : event\.ctrlKey && !event\.metaKey/);
  assert.match(source, /if \(saveShortcut\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?!\$\("save-snippet"\)\.disabled[\s\S]*?\$\("editor-form"\)\.requestSubmit\(\)/);
  assert.match(source, /if \(editorSaving \|\| \$\("save-snippet"\)\.disabled\) return;/);
  assert.match(html, /<dt>⌘\/Ctrl S<\/dt><dd>Save snippet<\/dd>/);
});

test("default workspace tabs directly between search and content", () => {
  assert.match(source, /\$\("search"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && !event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("snippet-body"\)\.focus\(\)/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("search"\)\.focus\(\)/);
});

test("editor label and content share one exact text gutter", () => {
  assert.match(css, /\.viewer-header \{[^}]*padding: 9px 22px;/);
  assert.match(css, /\.editor-name-action \{[^}]*padding: 6px 0;/);
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
  assert.match(source, /const payload = \{ title: editorCustomName, body: \$\("snippet-body"\)\.value \}/);
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
  assert.match(source, /main\.ariaLabel = `Open \$\{label\(snippet\)\} website`/);
  assert.match(source, /main\.addEventListener\("click"[\s\S]*?activateSnippet\(snippet\)/);
  assert.match(source, /edit\.ariaLabel = "Edit"; edit\.dataset\.tooltip = "Edit"/);
  assert.match(source, /edit\.addEventListener\("click", event => \{ event\.stopPropagation\(\);[\s\S]*?openEditor\(snippet\)/);
  assert.match(source, /event\.key === "Enter" && selected && document\.activeElement === \$\("search"\)[\s\S]*?activateSnippet\(selected\)/);
  assert.match(css, /\.result-link-text \{ text-decoration: underline;/);
  assert.match(css, /\.result-edit \{[^}]*visibility: hidden;[^}]*pointer-events: none;/);
  assert.match(css, /\.result-row:hover \.result-edit,[\s\S]*?\.results:not\(:has\(\.result-row:hover\)\) \.result-row\.selected \.result-edit,[\s\S]*?\.results:not\(:has\(\.result-row:hover\)\) \.result-edit:focus-visible \{ visibility: visible; pointer-events: auto; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.result-edit \{ width: 44px; height: 44px; visibility: visible; pointer-events: auto; \}/);
  assert.match(html, /id="preview-edit"[^>]*aria-label="Edit"[^>]*data-tooltip="Edit"/);
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
  assert.match(source, /requestConfirmation\(\{ title: "Delete snippet\?"/);
  assert.match(source, /requestConfirmation\(\{ title: "Stop sharing\?"/);
});

test("closing a dirty editor offers save or discard", () => {
  assert.match(html, /id="unsaved-dialog" class="confirm-dialog"[\s\S]*?>Discard<\/button>[\s\S]*?>Save changes<\/button>/);
  assert.match(source, /function editorSnapshot\(\)[\s\S]*?JSON\.stringify\(\{ title, body:/);
  assert.match(source, /editorBaseline = editorSnapshot\(\)/);
  assert.match(source, /async function closeEditorWithWarning\(\)[\s\S]*?editorHasUnsavedChanges\(\)[\s\S]*?choice === "save"[\s\S]*?requestSubmit\(\)[\s\S]*?choice === "discard"[\s\S]*?leaveRoutedView\(\)/);
  assert.match(source, /\$\("close-editor"\)\.addEventListener\("click", closeEditorWithWarning\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?editing\) \{ event\.preventDefault\(\); void closeEditorWithWarning\(\); \}/);
  assert.match(source, /cancelDialogOnBackdrop\(\$\("unsaved-dialog"\)\)/);
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
