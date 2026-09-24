import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/app/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../web/app/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/app/app.css", import.meta.url), "utf8");

test("empty snippets are rejected before the saving state begins", () => {
  const submitHandler = source.match(/\$\("editor-form"\)\.addEventListener\("submit",[\s\S]*?\n\}\);/)?.[0];
  assert.ok(submitHandler, "editor submit handler is present");
  assert.match(submitHandler, /!payload\.title\.trim\(\) && !payload\.body\.trim\(\)/);
  assert.ok(submitHandler.indexOf("Enter content or a title") < submitHandler.indexOf("Saving…"));
});

test("save button is gray and disabled until the snippet has a value", () => {
  assert.match(html, /id="save-snippet" class="save-button" type="submit" disabled/);
  assert.match(css, /\.save-button:disabled \{[^}]*background: #9a9a9a;[^}]*color: #fff;[^}]*opacity: 1;[^}]*cursor: default;/);
  assert.match(source, /function syncSaveButton\(\)[\s\S]*?editorSaving \|\| !hasValue/);
  assert.match(source, /\$\("snippet-title"\)\.addEventListener\("input", syncSaveButton\)/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("input", syncSaveButton\)/);
});

test("default workspace tabs directly between search and title", () => {
  assert.match(source, /\$\("search"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && !event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("snippet-title"\)\.focus\(\)/);
  assert.match(source, /\$\("snippet-title"\)\.addEventListener\("keydown",[\s\S]*?event\.key === "Tab" && event\.shiftKey && defaultEditorOpen\(\)[\s\S]*?\$\("search"\)\.focus\(\)/);
});

test("editor treats title as optional metadata and paste as exact content", () => {
  assert.match(html, /id="snippet-title"[^>]*placeholder="Title \(optional\)"/);
  assert.match(html, /id="snippet-body"[^>]*placeholder="Type or paste a snippet"/);
  assert.match(source, /event\.key === "Enter" && !event\.isComposing[\s\S]*?\$\("snippet-body"\)\.focus\(\)/);
  assert.match(source, /event\.key !== "ArrowUp"[\s\S]*?if \(body\.value \|\| body\.selectionStart !== 0 \|\| body\.selectionEnd !== 0\) return;[\s\S]*?\$\("snippet-title"\)\.focus\(\)/);
  assert.match(source, /function routeEmptySnippetPaste\(event\)[\s\S]*?clipboardData\?\.getData\("text\/plain"\)[\s\S]*?\$\("snippet-body"\)\.value = text/);
  assert.match(source, /\$\("snippet-title"\)\.addEventListener\("paste", routeEmptySnippetPaste\)/);
  assert.match(source, /function snippetText\(snippet\) \{ return snippet\.body \|\| snippet\.title; \}/);
  assert.match(source, /return snippet\.title\.trim\(\) \|\| snippet\.body\.trim\(\)\.split/);
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

test("viewing and editing use the same text scale and vertical rhythm", () => {
  assert.match(css, /\.preview-title, \.title-input \{ font-size: 21px; font-weight: 550;/);
  assert.match(css, /\.preview-body \{[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.content-input \{[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.preview-title, \.title-input \{ font-size: 19px; \}/);
});

test("sidebar Linksaw mark links home before the account control", () => {
  assert.match(html, /<a class="identity-logo-link" href="https:\/\/linksaw\.com"[^>]*>[\s\S]*?<img class="identity-logo"[^>]*>[\s\S]*?<button id="settings"/);
  assert.match(css, /\.identity-logo \{ width: 28px; height: 28px;/);
});

test("viewer always preserves an explicit title", () => {
  const viewer = source.match(/function renderViewer\(snippet\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(viewer, "viewer renderer is present");
  assert.match(viewer, /const heading = snippet\.title\.trim\(\);/);
  assert.doesNotMatch(viewer, /snippet\.title\.trim\(\) !== snippet\.body\.trim\(\)/);
  assert.match(viewer, /\$\("preview-body"\)\.hidden = !snippet\.body;/);
  assert.match(viewer, /renderLinkedText\(\$\("preview-body"\), snippet\.body\);/);
});

test("settings offers working CSV and JSON transfer controls", () => {
  for (const label of ["Import CSV", "Import JSON", "Export CSV", "Export JSON"]) assert.match(html, new RegExp(`>${label}<`));
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
