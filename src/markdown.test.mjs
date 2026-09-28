import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { markdownToSafeHtml, renderMarkdown, sourceOffsetFromRenderedPoint } from "../web/app/markdown.js";

test("Markdown renders common structures as accessible semantic HTML", () => {
  const source = `# Heading

This is **bold**, *italic*, and \`inline code\`.

- First
- Second

1. One
2. Two

> A quoted thought

[Linksaw](https://linksaw.com)

\`\`\`js
const value = "<safe>";
\`\`\``;
  const dom = new JSDOM(`<main id="viewer"></main>`);
  const viewer = dom.window.document.getElementById("viewer");
  renderMarkdown(viewer, source);

  assert.equal(viewer.querySelector("h1")?.textContent, "Heading");
  assert.equal(viewer.querySelector("strong")?.textContent, "bold");
  assert.equal(viewer.querySelector("em")?.textContent, "italic");
  assert.equal(viewer.querySelector("p code")?.textContent, "inline code");
  assert.deepEqual([...viewer.querySelectorAll("ul li")].map(node => node.textContent), ["First", "Second"]);
  assert.deepEqual([...viewer.querySelectorAll("ol li")].map(node => node.textContent), ["One", "Two"]);
  assert.equal(viewer.querySelector("blockquote")?.textContent, "A quoted thought");
  assert.equal(viewer.querySelector('a[href="https://linksaw.com"]')?.textContent, "Linksaw");
  assert.equal(viewer.querySelector("pre code")?.textContent, 'const value = "<safe>";');
  assert.equal(source.includes("**bold**"), true, "rendering does not mutate the raw source");
});

test("Markdown rendering escapes raw HTML and rejects unsafe link destinations", () => {
  const output = markdownToSafeHtml(`<script>alert(1)</script>\n[unsafe](javascript:alert(1))\n<img src=x onerror=alert(1)>`);
  const dom = new JSDOM(`<main>${output}</main>`);
  const main = dom.window.document.querySelector("main");

  assert.equal(main.querySelector("script"), null);
  assert.equal(main.querySelector("img"), null);
  assert.equal(main.querySelector("a"), null);
  assert.match(main.textContent, /<script>alert\(1\)<\/script>/);
  assert.match(main.textContent, /unsafe/);
  assert.match(main.textContent, /<img src=x onerror=alert\(1\)>/);
});

test("plain text keeps its line breaks and automatic links", () => {
  const source = "Ordinary text\nCall (312) 555-1212\nVisit linksaw.com";
  const output = markdownToSafeHtml(source);
  const dom = new JSDOM(`<main>${output}</main>`);
  const main = dom.window.document.querySelector("main");

  assert.equal(main.querySelectorAll("p").length, 1);
  assert.equal(main.querySelectorAll("br").length, 2);
  assert.equal(main.querySelector('a[href="tel:3125551212"]')?.textContent, "(312) 555-1212");
  assert.equal(main.querySelector('a[href="https://linksaw.com"]')?.textContent, "linksaw.com");
  assert.equal(main.textContent, source.replaceAll("\n", ""));
});

test("rendered Markdown keeps source positions for editing without exposing link syntax", () => {
  const source = "Before [Linksaw](https://linksaw.com) after **bold**";
  const dom = new JSDOM(`<main id="viewer"></main>`);
  const viewer = dom.window.document.getElementById("viewer");
  renderMarkdown(viewer, source);

  const before = viewer.querySelector("span");
  assert.equal(sourceOffsetFromRenderedPoint(viewer, source, before.firstChild, 3), 3);

  const link = viewer.querySelector("a");
  link.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 20, width: 100, height: 20 });
  assert.equal(sourceOffsetFromRenderedPoint(viewer, source, link.firstChild.firstChild, 2, 20, 10), 7);
  assert.equal(sourceOffsetFromRenderedPoint(viewer, source, link.firstChild.firstChild, 2, 100, 10), 37);

  const after = [...viewer.querySelectorAll("span")].find(node => node.textContent.startsWith(" after"));
  assert.equal(sourceOffsetFromRenderedPoint(viewer, source, after.firstChild, 2), 39);
});

test("clicking to the right of rendered text places the caret at the line end", () => {
  const source = "Call 323-395-8384";
  const dom = new JSDOM(`<main id="viewer"></main>`);
  const viewer = dom.window.document.getElementById("viewer");
  renderMarkdown(viewer, source);
  const mapped = [...viewer.querySelectorAll("[data-source-start]")];
  mapped.forEach((element, index) => {
    element.getBoundingClientRect = () => ({ left: 10 + index * 70, right: 70 + index * 70, top: 10, bottom: 30, width: 60, height: 20 });
  });

  assert.equal(sourceOffsetFromRenderedPoint(viewer, source, viewer, 0, 300, 20), source.length);
});
