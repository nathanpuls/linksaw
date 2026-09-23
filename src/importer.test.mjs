import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { setupImporter } from './importer.mjs';

test('import UI previews locally, maps columns, and safely resumes a failed row', async () => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  const priorDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const el = id => document.getElementById(id);
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    const calls = []; let fail = true;
    setupImporter({ signedIn: () => true, refresh: async () => {}, api: async (path, options) => {
      calls.push(options.body);
      if (options.body.title === 'Second' && fail) { fail = false; throw new Error('Simulated lost response'); }
      return { id: options.body.importId };
    } });
    el('open-import').click(); assert.equal(el('import-dialog').open, true);
    const csv = 'Title,Content,Unused\nFirst,"A, B",discard\nSecond,<b>literal</b>,discard';
    Object.defineProperty(el('csv-file'), 'files', { value: [{ size: csv.length, text: async () => csv }] });
    el('csv-file').dispatchEvent(new dom.window.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0, 'preview must not upload');
    assert.equal(el('import-preview').querySelector('b'), null, 'HTML is displayed as text');
    assert.equal(el('import-mapping').querySelectorAll('select').length, 3);
    el('import-confirm').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(el('import-status').textContent, /1 confirmed imported/);
    assert.equal(el('import-confirm').disabled, false);
    el('import-confirm').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 3);
    assert.equal(calls[1].importId, calls[2].importId, 'uncertain row reuses the same idempotency key');
    assert.equal('details' in calls[0], false);
    assert.match(el('import-status').textContent, /Imported 2 snippets/);
    assert.equal(el('import-confirm').disabled, true);
  } finally { globalThis.document = priorDocument; dom.window.close(); }
});
