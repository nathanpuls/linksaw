import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/app/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../web/app/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/app/app.css", import.meta.url), "utf8");
const linkifier = readFileSync(new URL("../web/app/linkify.js", import.meta.url), "utf8");
const markdown = readFileSync(new URL("../web/app/markdown.js", import.meta.url), "utf8");

test("autosave waits for settled meaningful text and has no permanent save button", () => {
  assert.doesNotMatch(html, /id="save-snippet"/);
  assert.match(source, /autosaveTimer = setTimeout\(\(\) => \{ void saveEditorNow\(\); \}, 700\)/);
  assert.match(source, /if \(!state\.editing && !value\.body\.trim\(\)\) \{ setEditorStatus\(""\); return true; \}/);
  assert.match(source, /function beginEditorSaveFeedback\(\)[\s\S]*?setTimeout\(\(\) => setEditorStatus\("Saving…"\), 1600\)/);
  assert.match(source, /await api[\s\S]*?clearEditorSaveFeedback\(\)/);
  assert.doesNotMatch(source, /setEditorStatus\("Saved"\)/);
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
  assert.match(css, /\.content-input \{[^}]*width: min\(900px, 100%\);[^}]*padding: 8px 36px 48px 74px;/);
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
  assert.match(html, /<label class="sr-only" for="editor-name-input">Title<\/label>/);
  assert.match(html, /id="editor-name-input" class="editor-name-input"[^>]*maxlength="160"[^>]*hidden/);
  assert.doesNotMatch(html, /id="rename-dialog"/);
  assert.match(source, /event\.key === "Enter"[\s\S]*?finishInlineRename\(\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?finishInlineRename\(\{ cancel: true \}\)/);
  assert.match(source, /\$\("editor-name"\)\.textContent = editorCustomName\.trim\(\) \|\| "Title"/);
  assert.match(source, /\$\("editor-name-input"\)\.value = editorCustomName;/);
  assert.match(source, /editorCustomName = cancel \? inlineRenameBaseline : enteredName/);
  assert.doesNotMatch(source, /unchangedAutomaticName/);
});

test("web rows open cleanly while keyboard and mobile long press retain fast actions", () => {
  assert.doesNotMatch(source, /row-open|icons\.externalLink|icons\.chevronRight|className = "result-view/);
  assert.match(source, /function openSnippet\(snippet\) \{[\s\S]*?openPreview\(snippet\);/);
  assert.match(source, /async function useSnippet\(snippet\)[\s\S]*?if \(url\) \{ openInNewTab\(url\); return; \}[\s\S]*?navigator\.clipboard\.writeText/);
  assert.match(source, /function runListActionAfterSave\(action\)[\s\S]*?navigateAfterSave[\s\S]*?closeSurface\("editor"\)[\s\S]*?action\(\)/);
  assert.match(source, /main\.ariaLabel = `Open \$\{label\(snippet\)\} in Linksaw`/);
  assert.match(source, /main\.addEventListener\("click"[\s\S]*?runListActionAfterSave[\s\S]*?openSnippet\(snippet\)/);
  assert.match(source, /event\.key === "ArrowRight" && selected[\s\S]*?useSnippet\(selected\)/);
  assert.match(source, /event\.key === "Enter" && selected && document\.activeElement === \$\("search"\)[\s\S]*?openSnippet\(selected\)/);
  assert.match(source, /function installLongPress\(main, snippet\)[\s\S]*?setTimeout\([\s\S]*?openSnippetActionMenu\(snippet\)[\s\S]*?550/);
  assert.match(source, /contextmenu[\s\S]*?narrowLayout\(\)[\s\S]*?preventDefault/);
  assert.match(html, /id="snippet-action-menu" class="snippet-action-menu"[\s\S]*?Copy[\s\S]*?Share[\s\S]*?Edit[\s\S]*?Delete/);
  assert.match(css, /\.result-row \{ min-height: 44px; display: block;/);
  assert.doesNotMatch(css, /\.result-view/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.result-main \{ -webkit-touch-callout: none; user-select: none; \}/);
  assert.match(css, /\.result-link-text \{ text-decoration: underline;/);
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
  assert.match(html, /id="mobile-editor-status"[^>]*class="editor-status mobile-editor-status"[^>]*aria-live="polite"[^>]*hidden/);
  assert.match(html, /id="mobile-delete" class="icon-button delete-action mobile-delete"[^>]*aria-label="Delete snippet"[^>]*data-tooltip="Delete snippet"[^>]*hidden/);
  assert.match(source, /trash: '<svg[\s\S]*?icon\("delete", "trash"\); icon\("mobile-delete", "trash"\)/);
  assert.match(source, /function setEditorStatus\(status\)[\s\S]*?mobile-editor-status-text[\s\S]*?mobile-editor-status/);
  assert.match(source, /function setEditorDeleteVisible\(visible\)[\s\S]*?mobile-delete/);
  assert.match(source, /\$\("mobile-delete"\)\.addEventListener\("click", \(\) => deleteSnippet\(state\.editing\)\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?#editor \{ height: 100dvh; overflow: hidden; \}/);
  assert.match(css, /#editor \.surface-inner \{ height: 100%; min-height: 0; \}/);
  assert.match(css, /#editor \.surface-header \{ flex: 0 0 auto; \}/);
  assert.match(css, /#editor \.surface-footer \{ display: none; \}/);
  assert.match(css, /#editor\.mobile-unified \.mobile-editor-status \{[^}]*font-size: 12px;/);
  assert.match(css, /#editor\.mobile-unified \.mobile-delete \{ display: inline-grid;/);
  assert.match(css, /#editor \.content-input \{ min-height: 0; \}/);
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
  assert.match(source, /const snapshot = editorSnapshot\(\)[\s\S]*?editorBaseline = snapshot[\s\S]*?if \(editorSnapshot\(\) === editorBaseline\) clearEditorSaveFeedback\(\)/);
});

test("a lost save response is recognized when the stored conflict matches the draft", () => {
  assert.match(source, /conflict && conflict\.title === value\.title && conflict\.body === value\.body/);
  assert.match(source, /clearEditorDraft\(\);[\s\S]*?upsertSavedSnippet\(conflict\);[\s\S]*?clearEditorSaveFeedback\(\)/);
});

test("new snippet creation is idempotent across a lost response", () => {
  assert.match(source, /editorCreateId = snippet \? "" : crypto\.randomUUID\(\)/);
  assert.match(source, /body: JSON\.stringify\(creating \? \{ \.\.\.value, importId: editorCreateId \} : \{ \.\.\.value, version: state\.editing\.version \}\)/);
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
  assert.match(html, /<button id="search-icon" class="search-icon" type="button" tabindex="-1" aria-label="Focus search" data-tooltip="Focus search"><\/button>/);
  assert.match(css, /\.search-icon \{[^}]*cursor: text;/);
  assert.match(source, /\$\("search-icon"\)\.addEventListener\("click", \(\) => \$\("search"\)\.focus\(\)\)/);
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
  assert.match(source, /async function shareSnippet\(snippet, button = \$\("preview-share"\)\)[\s\S]*?finally \{ hideTooltip\(\); button\.blur\(\); \}/);
  assert.match(source, /\$\("search"\)\.value = "";[\s\S]*?dispatchEvent\(new Event\("input"[\s\S]*?\$\("search"\)\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?else if \(\$\("search"\)\.value\) \{ event\.preventDefault\(\); clearSearch\(\); \}/);
});

test("interactive web controls expose Voice Control names without changing the primary tab path", () => {
  assert.match(html, /id="search-icon"[^>]*tabindex="-1"[^>]*aria-label="Focus search"/);
  assert.match(html, /id="preview" class="viewer-pane" aria-label="Snippet viewer"/);
  assert.match(source, /main\.ariaLabel = `Open \$\{label\(snippet\)\} in Linksaw`/);
  assert.match(source, /main\.setAttribute\("aria-description", "Open snippet viewer"\)/);
  assert.match(source, /main\.setAttribute\("aria-current", index === state\.selected \? "true" : "false"\)/);
  assert.match(source, /row\.querySelector\("\.result-main"\)\?\.setAttribute\("aria-current", selected \? "true" : "false"\)/);
  assert.match(html, /id="results" class="results" role="list" aria-label="Snippets" tabindex="-1"/);
  assert.match(source, /row\.setAttribute\("role", "listitem"\)/);
  assert.match(html, /id="preview-title" class="preview-title" type="button" aria-label="Edit title"/);
  assert.match(html, /id="preview-body" class="preview-body markdown-body" role="region" tabindex="0" aria-label="Edit snippet content"/);
  assert.match(html, /class="viewer-scroll" role="region" aria-label="Snippet content" tabindex="-1"/);
  assert.match(source, /\$\("preview-title"\)\.addEventListener\("click"[\s\S]*?openEditor\(state\.previewing\)[\s\S]*?beginInlineRename/);
  assert.match(source, /\$\("preview-body"\)\.addEventListener\("keydown"[\s\S]*?event\.key !== "Enter"[\s\S]*?openEditor\(snippet/);
});

test("desktop viewer is the active Voice Control scroll region and rename stays compact", () => {
  assert.match(source, /if \(!narrowLayout\(\)\) \{[\s\S]*?requestAnimationFrame\(\(\) => \$\("preview-body"\)\.focus\(\{ preventScroll: true \}\)\)[\s\S]*?return;/);
  assert.match(css, /\.editor-name-input \{[^}]*width: min\(420px, 42vw\);[^}]*flex: 0 1 420px;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?#editor \.editor-name-input \{ width: auto; flex: 1; \}/);
});

test("unchanged background sync preserves Voice Control targets", () => {
  assert.match(source, /function libraryFingerprint\(snippets\)/);
  assert.match(source, /const libraryChanged = libraryFingerprint\(state\.snippets\) !== libraryFingerprint\(snippets\)/);
  assert.match(source, /if \(libraryChanged\) \{[\s\S]*?render\(\)/);
});

test("content editing keeps the same plain-text scale and vertical rhythm", () => {
  assert.match(css, /\.preview-title \{ font-size: 16px; font-weight: 550;/);
  assert.match(css, /\.preview-body \{ width: min\(900px, 100%\);[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.content-input \{[^}]*width: min\(900px, 100%\);[^}]*padding: 8px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.preview-body, \.content-input \{ padding: 8px 22px 40px 16px; \}/);
  assert.match(css, /\.markdown-body p \{ margin: 0 0 1em; white-space: pre-wrap; \}/);
  assert.match(css, /\.markdown-body li \{ white-space: pre-wrap; \}/);
});

test("mobile Back glyph aligns with the content gutter", () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.viewer-back \{ margin-left: -9px; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.viewer-back svg \{ transform: translateX\(-1px\); \}/);
});

test("mobile view and edit are distinct states on one stable visual surface", () => {
  assert.match(html, /id="editor-copy"[^>]*class="icon-button mobile-editor-action"[^>]*aria-label="Copy snippet"/);
  assert.match(html, /id="editor-share"[^>]*class="icon-button mobile-editor-action"[^>]*aria-label="Share"/);
  assert.match(html, /id="mobile-snippet-view" class="content-input mobile-snippet-view markdown-body" role="button" tabindex="0" aria-label="Edit snippet text" hidden/);
  assert.match(source, /function openPreview\(snippet, pushHistory = true\) \{[\s\S]*?if \(narrowLayout\(\)\) \{ openEditor\(snippet, pushHistory, \{ focus: false \}\); return; \}/);
  assert.match(source, /\$\("editor"\)\.classList\.toggle\("mobile-unified", mobileUnified\)/);
  assert.match(source, /\$\("close-editor"\)\.innerHTML = icons\[mobileUnified \? "back" : "close"\]/);
  assert.match(source, /function setMobileEditorState\(editing\)[\s\S]*?classList\.toggle\("is-editing", editing\)[\s\S]*?aria-hidden/);
  assert.match(source, /function enterMobileEdit\(offset[\s\S]*?setMobileEditorState\(true\)[\s\S]*?focus\(\{ preventScroll: true \}\)[\s\S]*?setSelectionRange\(offset, offset\)/);
  assert.match(source, /\$\("mobile-snippet-view"\)\.addEventListener\("click", event => \{[\s\S]*?!event\.target\.closest\?\.\("a"\)[\s\S]*?enterMobileEdit\(\)/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("focus"[\s\S]*?setMobileEditorState\(true\)/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("blur"[\s\S]*?setMobileEditorState\(false\)/);
  assert.match(source, /visualViewport\?\.addEventListener\("resize"[\s\S]*?document\.activeElement !== input[\s\S]*?input\.blur\(\)/);
  assert.match(source, /updateUrl\(\{ view: state\.editorContext === "mobile" \? null : "edit", snippet: savedSnippet\.id \}, false\)/);
  assert.match(css, /\.mobile-snippet-view \{[^}]*overflow: auto;[^}]*cursor: text;/);
  assert.match(css, /#editor\.mobile-unified \.surface-inner \{ display: grid; grid-template-rows: auto minmax\(0, 1fr\); \}/);
  assert.match(css, /#editor\.mobile-unified #snippet-body \{ z-index: 0; \}/);
  assert.match(css, /#editor\.mobile-unified \.mobile-snippet-view \{ z-index: 1; \}/);
  assert.match(css, /\.content-input \{[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere;[^}]*word-break: break-word;/);
  assert.match(css, /#editor\.mobile-unified:not\(\.is-editing\) #snippet-body \{ color: transparent; -webkit-text-fill-color: transparent; caret-color: transparent; \}/);
  assert.match(css, /#editor\.mobile-unified:not\(\.is-editing\) \.mobile-snippet-view \{ display: block; pointer-events: none; \}/);
  assert.match(css, /#editor\.mobile-unified:not\(\.is-editing\) \.mobile-snippet-view a \{ pointer-events: auto; \}/);
  assert.match(css, /#editor\.mobile-unified:not\(\.is-editing\) \.mobile-editor-action \{ display: inline-grid; \}/);
  assert.match(css, /#editor\.mobile-unified:not\(\.is-editing\) #editor-undo,[\s\S]*?#editor\.mobile-unified:not\(\.is-editing\) #editor-redo \{ display: none; \}/);
});

test("mobile view preserves safe automatic links without sacrificing one-tap editing", () => {
  assert.match(source, /renderMarkdown\(\$\("mobile-snippet-view"\), \$\("snippet-body"\)\.value\)/);
  assert.match(css, /\.preview-body a, \.mobile-snippet-view a \{[^}]*text-decoration: underline;/);
});

test("mobile rendered view follows the underlying editor scroll position", () => {
  assert.match(source, /function syncMobileScroll\(source, target\)[\s\S]*?source\.scrollHeight - source\.clientHeight[\s\S]*?target\.scrollTop = sourceRange && targetRange/);
  assert.match(source, /\$\("snippet-body"\)\.addEventListener\("scroll"[\s\S]*?syncMobileScroll\(\$\("snippet-body"\), \$\("mobile-snippet-view"\)\)/);
  assert.doesNotMatch(source, /\$\("mobile-snippet-view"\)\.addEventListener\("scroll"/);
  assert.match(source, /function enterMobileEdit[\s\S]*?syncMobileScroll\(\$\("mobile-snippet-view"\), input\)[\s\S]*?setMobileEditorState\(true\)/);
});

test("viewer text enters desktop editing at the clicked caret without hijacking links", () => {
  assert.match(source, /\$\("preview-body"\)\.addEventListener\("click"[\s\S]*?event\.target\.closest\?\.\("a"\)[\s\S]*?narrowLayout\(\)/);
  assert.match(source, /document\.caretPositionFromPoint[\s\S]*?document\.caretRangeFromPoint/);
  assert.match(source, /openEditor\(snippet, true, \{ focus: false \}\)[\s\S]*?\$\("snippet-body"\)\.focus\(\{ preventScroll: true \}\)[\s\S]*?setSelectionRange\(offset, offset\)/);
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
  assert.match(viewer, /renderMarkdown\(\$\("preview-body"\), snippet\.body\);/);
});

test("viewer uses safe Markdown plus shared QK-style linkification and underlined styling", () => {
  assert.match(source, /import \{ renderMarkdown \} from "\.\/markdown\.js\?v=20260924-1"/);
  assert.match(markdown, /import \{ linkifyText \} from "\.\/linkify\.js"/);
  assert.match(markdown, /export function markdownToSafeHtml/);
  assert.match(markdown, /element\.innerHTML = markdownToSafeHtml\(value\)/);
  assert.match(linkifier, /const EMAIL =/);
  assert.match(linkifier, /const PROTOCOL_URL =/);
  assert.match(linkifier, /const PHONE =/);
  assert.match(linkifier, /const STREET_ADDRESS =/);
  assert.match(css, /\.preview-body a, \.mobile-snippet-view a \{[^}]*text-decoration-thickness: 1\.2px;[^}]*text-decoration-skip-ink: none;[^}]*word-break: break-word;/);
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

test("settings exposes 30-day Recently Deleted recovery with confirmed permanent deletion", () => {
  assert.match(html, /id="recently-deleted"[\s\S]*?Deleted snippets remain available for 30 days\./);
  assert.match(html, /id="deleted-snippet-list"[^>]*role="list"/);
  assert.match(source, /api\("\/deleted-snippets"\)[\s\S]*?renderDeletedSnippets/);
  assert.match(source, /`\/deleted-snippets\/\$\{snippet\.id\}\/restore`[\s\S]*?method: "POST"/);
  assert.match(source, /requestConfirmation\(\{ title: "Delete permanently\?"[\s\S]*?api\(`\/deleted-snippets\/\$\{snippet\.id\}`[\s\S]*?method: "DELETE"/);
  assert.match(css, /\.deleted-snippet-row \{[^}]*display: flex;/);
});

test("deep links wait to reveal the resolved view", () => {
  assert.ok(html.indexOf("route-pending") < html.indexOf('rel="stylesheet"'));
  assert.match(html, /html\.route-pending body \{ visibility: hidden; \}/);
  assert.match(source, /view === "settings"\) \{ openSettings\(false\); revealInitialView\(\); return;/);
  assert.match(source, /catch \(error\) \{ revealInitialView\(\); showError\(error\); \}/);
});
