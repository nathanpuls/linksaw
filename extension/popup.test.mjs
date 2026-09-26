import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('./content.js', import.meta.url), 'utf8');
const backgroundSource = readFileSync(new URL('./background.js', import.meta.url), 'utf8');
const popupHtml = readFileSync(new URL('./popup.html', import.meta.url), 'utf8');
const dynamicSource = readFileSync(new URL('./dynamic.js', import.meta.url), 'utf8');
const insertSource = source.match(/function insert\(text, cursorLeft = 0\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(insertSource, 'insert implementation is present');
function run(html, selector, text = 'Linksaw text', cursorLeft = 0) {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { window } = dom;
  const field = window.document.querySelector(selector);
  field?.focus();
  if (field?.setSelectionRange && !field.disabled && field.type !== "number") field.setSelectionRange(field.value.length, field.value.length);
  const context = vm.createContext({ document: window.document, window, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement, InputEvent: window.InputEvent });
  const insert = vm.runInContext(`(${insertSource})`, context);
  return { window, field, result: insert(text, cursorLeft) };
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

test('places the caret at the expanded cursor marker', () => {
  const { field, result } = run('<textarea>before </textarea>', 'textarea', 'Hey: \nThis is: Wednesday', 19);
  assert.equal(result, true);
  assert.equal(field.value, 'before Hey: \nThis is: Wednesday');
  assert.equal(field.selectionStart, 'before Hey: '.length);
  assert.equal(field.selectionEnd, 'before Hey: '.length);
});

test('expands dynamic day and removes the cursor marker', () => {
  const context = vm.createContext({ Date });
  vm.runInContext(dynamicSource, context);
  const result = context.LinksawDynamic.expandDynamic('Hey: {cursor}\nThis is: {day}', { now: new Date(2026, 8, 23, 16, 30) });
  assert.deepEqual({ ...result }, { text: 'Hey: \nThis is: Wednesday', cursorLeft: 19 });
});

test('falls back for protected or unsupported target', () => {
  assert.equal(run('<input disabled>', 'input').result, false);
  assert.equal(run('<input type="number" value="42">', 'input').result, false);
  assert.equal(run('<p>plain text</p>', 'p').result, false);
});

test('result row supplies the only pointer-hover background', () => {
  const css = readFileSync(new URL('./popup.css', import.meta.url), 'utf8');
  assert.match(css, /\.row \.primary:hover\{background:transparent\}/);
});

test('popup clips its content to rounded outer corners', () => {
  const css = readFileSync(new URL('./popup.css', import.meta.url), 'utf8');
  assert.match(css, /:root\{[^}]*border-radius:14px;overflow:hidden/);
  assert.match(css, /body\{[^}]*border-radius:inherit;overflow:hidden;background:#fff/);
});

test('manifest limits fetch permission to the API and installs the autocomplete listener', () => {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
  assert.deepEqual(manifest.host_permissions, ['https://snippets-api.linksaw.com/*']);
  assert.equal(manifest.permissions.includes('cookies'), false);
  assert.equal(manifest.permissions.includes('storage'), false);
  assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
  assert.deepEqual(manifest.content_scripts[0].js, ['dynamic.js', 'content.js']);
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.match(contentSource, /pointerenter[\s\S]*selected = index/);
});

test('website bridge opens links in an active tab and only accepts Linksaw requests', () => {
  assert.match(contentSource, /dataset\.linksawExtension = 'ready'/);
  assert.match(contentSource, /LINKSAW_OPEN_ACTIVE_TAB/);
  assert.match(contentSource, /LINKSAW_OPEN_SNIPPET/);
  assert.match(backgroundSource, /source\.hostname !== 'linksaw\.com'/);
  assert.match(backgroundSource, /chrome\.tabs\.create\(\{ url: destination\.href, active: true \}\)/);
  assert.match(backgroundSource, /https:\/\/linksaw\.com\/home\/\?snippet=/);
});

test('extension uses on click and Enter while its chevron and Right Arrow view the item', () => {
  assert.doesNotMatch(popupHtml, /\stitle=/);
  assert.match(popupHtml, /data-tooltip="New snippet"/);
  assert.match(popupHtml, /aria-label="Settings" data-tooltip="Settings"/);
  assert.match(source, /main\.ariaLabel = urlFor\(content\(snippet\)\) \? `Open \$\{label\(snippet\)\} website` : `Paste \$\{label\(snippet\)\}`/);
  assert.match(source, /viewButton\.dataset\.tooltip = 'View details'; viewButton\.ariaLabel = 'View details'/);
  assert.match(source, /icons\.open = svg\('<path d="m9 18 6-6-6-6"\/>/);
  assert.match(source, /main\.addEventListener\('click',[\s\S]*use\(snippet\)/);
  assert.match(source, /viewButton\.addEventListener\('click',[\s\S]*openInLinksaw\(snippet\)/);
  assert.match(source, /event\.key === 'Enter'[\s\S]*use\(found\[selected\]\)/);
  assert.match(source, /event\.key === 'ArrowRight'[\s\S]*openInLinksaw\(found\[selected\]\)/);
  assert.match(contentSource, /event\.key === 'Enter'[\s\S]*choose\(snippets\[selected\]\)/);
  assert.match(contentSource, /event\.key === 'ArrowRight'[\s\S]*openInLinksaw\(snippets\[selected\]\)/);
  assert.match(backgroundSource, /message\?\.type === 'LINKSAW_OPEN_URL'/);
  assert.match(source, /https:\/\/linksaw\.com\/home\/\?view=settings/);
  assert.match(source, /setTimeout\([\s\S]*450\)/);
});

test('autocomplete opens with recent snippets and uses Linksaw search controls', () => {
  assert.match(contentSource, /const rank = !query \? 0/);
  assert.match(contentSource, /refresh\(true\)\.then/);
  assert.match(contentSource, /aria-label="Recent snippets"/);
  assert.match(contentSource, /class="search-icon"[^>]*aria-label="Focus search"/);
  assert.match(contentSource, /class="clear"[^>]*aria-label="Clear search" hidden/);
  assert.match(contentSource, /search::-webkit-search-cancel-button\{-webkit-appearance:none;appearance:none;display:none\}/);
  assert.match(contentSource, /clearSearch\.hidden = !search\.value/);
  assert.match(contentSource, /clearSearch\.addEventListener\('click',[\s\S]*search\.value = ''[\s\S]*search\.focus\(\)/);
  assert.match(contentSource, /search\.addEventListener\('input',[\s\S]*render\(\)/);
  assert.match(contentSource, /loading \? 'Loading…' : data\.snippets\.length \? 'No matches' : 'No snippets yet'/);
});

test('autocomplete recent list filters and clears in the actual overlay', async () => {
  const dom = new JSDOM('<input id="target">', {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: 'https://example.com',
  });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const attachShadow = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function attachOpenShadow(options) {
    return attachShadow.call(this, { ...options, mode: 'open' });
  };
  window.LinksawDynamic = { expandDynamic: text => ({ text, cursorLeft: 0 }) };
  window.chrome = {
    runtime: {
      sendMessage: async message => message.type === 'LINKSAW_DATA'
        ? {
            ok: true,
            autocompleteTrigger: ';',
            snippets: [
              { id: '11111111-1111-1111-1111-111111111111', title: 'Alpha', body: 'First' },
              { id: '22222222-2222-2222-2222-222222222222', title: 'Beta', body: 'Second' },
            ],
          }
        : { ok: true },
    },
  };
  window.eval(contentSource);
  await new Promise(resolve => setTimeout(resolve, 0));

  const target = window.document.querySelector('#target');
  target.focus();
  target.setSelectionRange(0, 0);
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key: ';', bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));

  const root = window.document.querySelector('#linksaw-autocomplete-root').shadowRoot;
  assert.deepEqual([...root.querySelectorAll('.title')].map(node => node.textContent), ['Alpha', 'Beta']);
  const search = root.querySelector('.search');
  const clear = root.querySelector('.clear');
  search.value = 'bet';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.deepEqual([...root.querySelectorAll('.title')].map(node => node.textContent), ['Beta']);
  assert.equal(clear.hidden, false);
  clear.click();
  assert.equal(search.value, '');
  assert.equal(clear.hidden, true);
  assert.deepEqual([...root.querySelectorAll('.title')].map(node => node.textContent), ['Alpha', 'Beta']);
});

test('popup refreshes quietly while open without rebuilding unchanged Voice Control targets', () => {
  assert.match(source, /function libraryFingerprint\(items\)/);
  assert.match(source, /if \(refreshInFlight\) return;/);
  assert.match(source, /const changed = !hasLoaded \|\| libraryFingerprint\(snippets\) !== libraryFingerprint\(incoming\)/);
  assert.match(source, /if \(changed\) \{[\s\S]*?render\(\)/);
  assert.match(source, /setInterval\(\(\) => \{ if \(!document\.hidden\) void refresh\(\{ quiet: true \}\); \}, 3000\)/);
  assert.match(source, /visibilitychange/);
});
