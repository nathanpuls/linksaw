import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const icons = readFileSync(new URL("./icons.mjs", import.meta.url), "utf8");

test("Mac settings delegates import and export to the anchored web settings section", () => {
  assert.match(html, /<h3 id="web-transfer-title">Import and export<\/h3>/);
  assert.match(html, /id="open-web-settings"[^>]*>Open web settings <span aria-hidden="true">↗<\/span>/);
  assert.doesNotMatch(html, /id="open-import"|id="import-dialog"|id="csv-file"/);
  assert.match(source, /WEB_TRANSFER_SETTINGS_URL = "https:\/\/linksaw\.com\/home\/\?view=settings#import-export"/);
  assert.match(source, /await openUrl\(WEB_TRANSFER_SETTINGS_URL\)/);
  assert.doesNotMatch(source, /setupImporter/);
});

test("Mac editing autosaves with version checks and avoids duplicate list text", () => {
  assert.match(source, /editorAutosaveTimer = setTimeout\(\(\) => \{ void saveEditor\(null, \{ closeAfter: false \}\); \}, 700\)/);
  assert.match(source, /state\.editing \? \{ version: state\.editing\.version \} : \{\}/);
  assert.match(source, /const STALE_AFTER_MS = 2_500/);
  assert.match(source, /const repeatsTitle = item\.type === 'snippet' && trim\(item\.title\) === trim\(item\.body\)/);
});

test("Mac editor provides local Undo and Redo without adding viewer actions", () => {
  assert.match(html, /id="editor-undo"[^>]*aria-label="Undo"[^>]*disabled[\s\S]*id="editor-redo"[^>]*aria-label="Redo"[^>]*disabled/);
  assert.match(source, /function moveEditorHistory\(direction\)[\s\S]*?scheduleEditorAutosave\(\)/);
  assert.match(source, /const undo = key === 'z'[\s\S]*?const redo = \(key === 'z' && event\.shiftKey\) \|\| \(key === 'y'/);
  assert.doesNotMatch(html, /class="preview-actions"[\s\S]*id="preview-undo"/);
});

test("Mac editor preserves an unsaved local draft across a crash", () => {
  assert.match(source, /LOCAL_EDITOR_DRAFT_KEY = "linksaw-mac-editor-draft-v1"/);
  assert.match(source, /function persistLocalEditorDraft\(\)[\s\S]*?localStorage\.setItem\(LOCAL_EDITOR_DRAFT_KEY/);
  assert.match(source, /function readLocalEditorDraft\(\)[\s\S]*?draft\.owner === state\.user\?\.email/);
  assert.match(source, /function recoverLocalEditorDraft\(\)[\s\S]*?openEditor\(snippet, \{ draft \}\)/);
  assert.match(source, /restoreSession\(\); recoverLocalEditorDraft\(\)/);
  assert.match(source, /if \(editorSnapshot\(\) === snapshot\) clearLocalEditorDraft\(\)/);
});

test("Mac refresh and autosave status never insert transient layout rows", () => {
  assert.doesNotMatch(source, /box\.textContent = state\.loading \? "Refreshing…"/);
  assert.match(source, /setTimeout\(\(\) => \{ if \(state\.loading\) \{ state\.refreshSlow = true; updateRefreshFeedback\(\); \} \}, 1600\)/);
  assert.match(css, /\.refresh-feedback \{ position: absolute;/);
  assert.doesNotMatch(html, /class="primary" data-tooltip="Save snippet"/);
  assert.match(css, /#editor-feedback \{ min-width: 72px;/);
});

test("Mac viewer actions are stable and icon semantics are literal", () => {
  assert.match(html, /id="preview-copy"[\s\S]*id="preview-share"[\s\S]*id="preview-edit"[\s\S]*id="preview-more"[\s\S]*id="preview-delete"/);
  assert.match(source, /getElementById\('preview-edit'\)\.onclick = \(\) => \{ previewDialog\.close\(\); openEditor\(previewItem\); \}/);
  assert.match(source, /getElementById\('preview-more'\)\.onclick = \(\) => openActions\(previewItem\)/);
  assert.match(source, /const actions = \[\['Rename', 'edit', \(\) => openRename\(editable\)\]\]/);
  assert.doesNotMatch(source, /\['Edit content',/);
  assert.match(icons, /'preview-more': 'more'/);
  assert.match(icons, /more: Ellipsis/);
  assert.match(css, /\.preview-actions \.viewer-delete \{ margin-left: 6px; \}/);
  assert.match(source, /showDeletedToast\(result\.deleted \|\| deleting\)/);
  assert.match(source, /setTimeout\(\(\) => \{ deletedUndo = null; toast\.hidden = true; \}, 7000\)/);
  assert.match(source, /\/snippets\/\$\{deleted\.id\}\/restore/);
});
