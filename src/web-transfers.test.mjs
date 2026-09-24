import test from "node:test";
import assert from "node:assert/strict";
import { parseCsvSnippets, parseJsonSnippets, snippetsToCsv, snippetsToJson } from "../web/app/transfers.js";

test("web CSV transfer preserves quoted punctuation, newlines, and leading zeros", () => {
  const source = 'Title,Content\r\nCode,"001, two\nlines"\r\n"A ""quote""",Text';
  const items = parseCsvSnippets(source);
  assert.deepEqual(items, [
    { title: "Code", body: "001, two\nlines" },
    { title: 'A "quote"', body: "Text" },
  ]);
  assert.deepEqual(parseCsvSnippets(snippetsToCsv(items)), items);
});

test("web JSON transfer accepts the exported shape and content alias", () => {
  const items = [{ title: "Title", body: "Content" }, { title: "", body: "001" }];
  assert.deepEqual(parseJsonSnippets(snippetsToJson(items)), items);
  assert.deepEqual(parseJsonSnippets('[{"title":"Hi","content":"There"}]'), [{ title: "Hi", body: "There" }]);
});

test("web imports reject empty and oversized records", () => {
  assert.throws(() => parseJsonSnippets("[]"), /no snippets/);
  assert.throws(() => parseCsvSnippets("Title,Content\n,"), /no snippets|empty/);
  assert.throws(() => parseJsonSnippets(JSON.stringify([{ title: "x".repeat(161), body: "ok" }])), /limit/);
});
