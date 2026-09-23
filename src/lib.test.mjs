import test from "node:test";
import assert from "node:assert/strict";
import { expandDynamic, rankedSnippets, searchTemplate, snippetLabel, standaloneUrl } from "./lib.mjs";

test("title is optional; first content line becomes the result name", () => {
  assert.equal(snippetLabel({ title: "", body: "First line\nSecond line" }), "First line");
});
test("search covers title and content while retaining server order", () => {
  const items = [{ title: "Zulu", body: "match" }, { title: "Alpha", body: "match" }, { title: "match exact", body: "other" }];
  assert.deepEqual(rankedSnippets(items, "match"), [items[2], items[0], items[1]]);
});
test("links open and dollar templates enter query mode", () => {
  assert.equal(standaloneUrl("example.com/path"), "https://example.com/path");
  assert.equal(searchTemplate("example.com/?q=$"), "https://example.com/?q=$");
});
test("dynamic placeholders preserve date, offset, clipboard and cursor behavior", () => {
  const now = new Date(2026, 0, 31, 13, 5);
  assert.deepEqual(expandDynamic("{date format=yyyy-MM-dd offset=+1M} {time} {clipboard} {cursor}done", { now, clipboard: "clip" }), { text: "2026-02-28 1:05 PM clip done", cursorLeft: 4 });
});
