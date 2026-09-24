import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setupEditorSafety } from './editor-safety.mjs';

test('quit waits for draft resolution and successful save, including an in-flight save', () => {
  const dom = new JSDOM('<dialog open><textarea id="snippet-body"></textarea><button id="cancel-editor"></button><div id="prompt" hidden><p></p><button data-keep></button><button data-discard></button></div></dialog>');
  const d = dom.window.document, dialog = d.querySelector('dialog'), prompt = d.getElementById('prompt');
  let draft = 'changed', busy = false, exits = 0, saves = 0, closes = 0;
  const safety = setupEditorSafety({ dialog, prompt, snapshot: () => draft, baseline: () => 'original', saving: () => busy, save: () => { saves++; }, close: () => { closes++; }, quit: () => { exits++; } });
  try {
    safety.requestQuit(); assert.equal(exits, 0); assert.equal(prompt.hidden, false);
    assert.equal(prompt.querySelector('p').textContent, 'Save before quitting?');
    prompt.querySelector('[data-keep]').click(); safety.completeSave(); assert.equal(exits, 0); assert.equal(closes, 1);
    safety.requestQuit(); dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); assert.equal(saves, 1); assert.equal(exits, 0, 'a save request alone cannot quit');
    safety.completeSave(); assert.equal(exits, 1);
    safety.reset(); busy = true; safety.requestQuit(); prompt.querySelector('[data-discard]').click(); assert.equal(exits, 1, 'cannot discard while saving');
    busy = false; safety.completeSave(); assert.equal(exits, 2);
    safety.reset(); safety.requestQuit(); prompt.querySelector('[data-discard]').click(); assert.equal(exits, 3);
    safety.reset(); draft = 'original'; safety.requestQuit(); assert.equal(exits, 4, 'clean editor quits without warning');
  } finally { dom.window.close(); }
});
