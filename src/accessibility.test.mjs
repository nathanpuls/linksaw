import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");

test("Mac surfaces and fields expose stable accessible names", () => {
  assert.match(html, /<label class="visually-hidden" for="search">Search snippets<\/label>/);
  assert.match(html, /id="status" class="status" role="status" aria-live="polite"/);
  assert.match(html, /id="results" class="results" aria-label="Snippets"/);
  assert.match(html, /id="editor-dialog" aria-labelledby="editor-title"/);
});

test("Mac result actions announce their behavior and selection", () => {
  assert.match(source, /row\.setAttribute\("aria-current", index === state\.selected \? "true" : "false"\)/);
  assert.match(source, /item\.type === "search-query"[\s\S]*?row\.setAttribute\("aria-label", item\.label\)/);
  assert.match(source, /standaloneUrl\(item\.body\) \? `Open \$\{item\.label\} website` : `Paste \$\{item\.label\}`/);
  assert.match(source, /row\.addEventListener\("click", \(\) => act\(item\)\)/);
  assert.match(source, /event\.key === "Enter"[\s\S]*?await act\(items\[state\.selected\]\)/);
  assert.match(source, /event\.key === "ArrowRight"[\s\S]*?openPreview\(item\)/);
  assert.match(source, /view\.setAttribute\("aria-label", "View"\)/);
  assert.match(source, /key\.className = "result-key"[\s\S]*?navigator\.platform\.includes\("Mac"\) \? "⌘" : "Ctrl"/);
  assert.match(source, /row\.setAttribute\("aria-current", selected \? "true" : "false"\)/);
});
