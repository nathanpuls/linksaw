import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('./content.js', import.meta.url), 'utf8');
const insertSource = source.match(/function insert\(text\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(insertSource, 'insert implementation is present');
function run(html, selector, text = 'Linksaw text') {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { window } = dom;
  const field = window.document.querySelector(selector);
  field?.focus();
  if (field?.setSelectionRange && !field.disabled && field.type !== "number") field.setSelectionRange(field.value.length, field.value.length);
  const context = vm.createContext({ document: window.document, window, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement, InputEvent: window.InputEvent });
  const insert = vm.runInContext(`(${insertSource})`, context);
  return { window, field, result: insert(text) };
}

test('inserts into focused input at caret and emits input event', () => {
  const { field, result } = run('<input value="hello world">', 'input');
  assert.equal(result, true);
  assert.equal(field.value, 'hello worldLinksaw text');
});

test('inserts into textarea selection', () => {
  const dom = new JSDOM('<textarea>hello world</textarea>', { pretendToBeVisual: true });
  const field = dom.window.document.querySelector('textarea'); field.focus(); field.setSelectionRange(6, 11);
  const insert = vm.runInNewContext(`(${insertSource})`, { document: dom.window.document, window: dom.window, HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement, InputEvent: dom.window.InputEvent });
  assert.equal(insert('Nathan'), true); assert.equal(field.value, 'hello Nathan');
});

test('falls back for protected or unsupported target', () => {
  assert.equal(run('<input disabled>', 'input').result, false);
  assert.equal(run('<input type="number" value="42">', 'input').result, false);
  assert.equal(run('<p>plain text</p>', 'p').result, false);
});

test('manifest limits fetch permission to the API and installs the autocomplete listener', () => {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
  assert.deepEqual(manifest.host_permissions, ['https://snippets-api.linksaw.com/*']);
  assert.equal(manifest.permissions.includes('cookies'), false);
  assert.equal(manifest.permissions.includes('storage'), false);
  assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.match(contentSource, /pointerenter[\s\S]*selected = index/);
});
