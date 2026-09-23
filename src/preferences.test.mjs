import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences, shortcutFromEvent, DEFAULT_SHORTCUT, shortcutLabel } from './preferences.mjs';
const storage = value => ({ getItem: () => value });
test('preserves Mac right-command default and uses a combination on Windows', () => {
  assert.equal(readPreferences(storage(null), true).shortcut, 'right-command');
  assert.equal(readPreferences(storage(null), false).shortcut, DEFAULT_SHORTCUT);
  assert.equal(readPreferences(storage('{broken'), true).theme, 'system');
});
test('saved appearance and custom shortcuts survive loading', () => {
  assert.deepEqual(readPreferences(storage('{"theme":"dark","shortcut":"Super+KeyJ"}'), true), { theme: 'dark', shortcut: 'Super+KeyJ' });
});
test('recording requires modifiers and ignores repeats and composing text', () => {
  assert.equal(shortcutFromEvent({ code: 'KeyJ', metaKey: true }), 'Super+KeyJ');
  assert.equal(shortcutFromEvent({ code: 'Space', ctrlKey: true, shiftKey: true }), 'Control+Shift+Space');
  assert.equal(shortcutFromEvent({ code: 'KeyJ' }), null);
  assert.equal(shortcutFromEvent({ code: 'MetaRight', metaKey: true }), null);
  assert.equal(shortcutFromEvent({ code: 'KeyJ', metaKey: true, repeat: true }), null);
});
test('shortcut labels are readable', () => {
  assert.equal(shortcutLabel('Super+KeyJ', true), '⌘+J');
});
