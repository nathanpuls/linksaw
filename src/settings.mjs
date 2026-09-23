import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DEFAULT_SHORTCUT, readPreferences, shortcutFromEvent, shortcutLabel } from './preferences.mjs';

const native = Boolean(window.__TAURI_INTERNALS__);
const mac = navigator.platform.includes('Mac');
const prefs = readPreferences(localStorage, mac);
const el = id => document.getElementById(id);
let activeShortcut = null, toggle, recording = false, changing = false;
const feedback = message => { el('settings-feedback').textContent = message; };
const save = () => localStorage.setItem('linksaw-preferences', JSON.stringify(prefs));
function theme() { document.documentElement.dataset.theme = prefs.theme; }
theme();

function display() {
  el('launch-shortcut').value = prefs.shortcut === 'right-command' ? 'right-command' : prefs.shortcut === DEFAULT_SHORTCUT ? 'default' : 'custom';
  el('shortcut-help').textContent = prefs.shortcut === 'right-command' ? 'Tap and release by itself. Other apps may also listen to this key.' : shortcutLabel(prefs.shortcut, mac);
  el('record-shortcut').hidden = el('launch-shortcut').value !== 'custom';
  el('appearance').value = prefs.theme;
}
async function bind(value) {
  const next = value === 'right-command' ? null : value;
  if (next === activeShortcut) return;
  if (next) {
    let held = false;
    await register(next, event => {
      if (event.state === 'Released') { held = false; return; }
      if (event.state !== 'Pressed' || held || recording) return;
      held = true; void toggle();
    });
  }
  try { if (activeShortcut) await unregister(activeShortcut); }
  catch (error) { if (next) await unregister(next); throw error; }
  activeShortcut = next;
}
async function changeShortcut(value) {
  if (changing) return;
  changing = true; el('launch-shortcut').disabled = true;
  try {
    if (native) await bind(value);
    prefs.shortcut = value; save(); feedback('Shortcut updated.');
  } catch { feedback('Shortcut unavailable. Your previous shortcut is unchanged; try another combination.'); }
  finally { changing = false; el('launch-shortcut').disabled = !native; display(); }
}
export async function updatePermission() {
  try {
    const allowed = !mac || (native && await invoke('paste_access_status'));
    el('permission-status').textContent = !native ? 'Automatic pasting requires the desktop app.' : allowed ? 'Pasting permission: Enabled' : 'Pasting permission: Needed';
    el('settings-permission').hidden = !native || !mac || allowed;
  } catch { el('permission-status').textContent = 'Could not check pasting permission.'; }
}
export function rightCommandEnabled() { return prefs.shortcut === 'right-command' && !recording; }
export async function setupSettings(toggleLauncher) {
  toggle = toggleLauncher;
  if (!mac) el('launch-shortcut').querySelector('[value="right-command"]').remove();
  el('launch-shortcut').disabled = !native;
  el('launch-shortcut').querySelector('[value="default"]').textContent = shortcutLabel(DEFAULT_SHORTCUT, mac);
  display();
  if (native) {
    try { await bind(prefs.shortcut); }
    catch { feedback('Your shortcut is unavailable. Choose another in Settings.'); }
    try { el('launch-login').checked = await isEnabled(); el('launch-login').disabled = false; }
    catch { feedback('Could not read launch-at-login status.'); }
  }
  el('launch-shortcut').addEventListener('change', () => {
    if (el('launch-shortcut').value === 'custom') {
      el('record-shortcut').hidden = false; el('record-shortcut').click();
    } else void changeShortcut(el('launch-shortcut').value === 'default' ? DEFAULT_SHORTCUT : 'right-command');
  });
  el('record-shortcut').addEventListener('click', () => {
    recording = true; el('record-shortcut').textContent = 'Press your shortcut…';
    el('record-shortcut').focus(); feedback('Use Command, Control, or Option with a key. Escape cancels.');
  });
  const stopRecording = () => { recording = false; el('record-shortcut').textContent = 'Record shortcut'; display(); };
  el('settings-dialog').addEventListener('close', stopRecording);
  document.addEventListener('keydown', event => {
    if (!recording) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') { stopRecording(); feedback('Unchanged.'); return; }
    const value = shortcutFromEvent(event);
    if (value) { stopRecording(); void changeShortcut(value); }
  }, true);
  el('appearance').addEventListener('change', () => { prefs.theme = el('appearance').value; theme(); save(); feedback('Appearance updated.'); });
  el('launch-login').addEventListener('change', async () => {
    const desired = el('launch-login').checked; el('launch-login').disabled = true;
    try { await (desired ? enable() : disable()); el('launch-login').checked = await isEnabled(); feedback('Launch at login updated.'); }
    catch { el('launch-login').checked = !desired; feedback('Could not change launch at login.'); }
    finally { el('launch-login').disabled = false; }
  });
  el('settings-permission').addEventListener('click', async () => {
    try { await getCurrentWindow().hide(); await invoke('open_paste_settings'); }
    catch { feedback('Could not open Mac Settings.'); }
  });
  await updatePermission();
}
