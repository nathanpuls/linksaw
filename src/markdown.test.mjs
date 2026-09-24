import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { markdownToSafeHtml, renderMarkdown } from "../web/app/markdown.js";

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
  assert.equal(main.querySelector('a[href="http://linksaw.com"]')?.textContent, "linksaw.com");
  assert.equal(main.textContent, source.replaceAll("\n", ""));
});
