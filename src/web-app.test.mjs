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

test("icon-only controls use delayed custom tooltips with shortcut badges", () => {
  assert.doesNotMatch(html, /\stitle=/);
  assert.match(html, /data-tooltip="Copy"/);
  assert.match(html, /id="search-icon" class="search-icon"/);
  assert.match(html, /id="clear-search" class="search-clear"[^>]*hidden/);
  assert.match(html, /id="tooltip-shortcut"/);
  assert.match(source, /dataset\.shortcut = commandShortcut\("C"\)/);
  assert.match(source, /}, 450\);/);
  assert.match(source, /button\.dataset\.tooltip = "Copied"/);
  assert.match(source, /pointerout[\s\S]*?!target\.matches\(":hover"\)\) hideTooltip\(\)/);
  assert.match(source, /\$\("search"\)\.value = "";[\s\S]*?dispatchEvent\(new Event\("input"[\s\S]*?\$\("search"\)\.focus\(\)/);
});

test("viewing and editing use the same text scale and vertical rhythm", () => {
  assert.match(css, /\.preview-title, \.title-input \{ font-size: 21px; font-weight: 550;/);
  assert.match(css, /\.preview-body \{[^}]*padding: 30px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.content-input \{[^}]*padding: 30px 36px 48px 74px;[^}]*font-size: 16px; line-height: 1\.65;/);
  assert.match(css, /\.preview-title, \.title-input \{ font-size: 19px; \}/);
});
