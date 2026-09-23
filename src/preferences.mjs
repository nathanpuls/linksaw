export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';
export function readPreferences(storage, mac) {
  let value = {};
  try { value = JSON.parse(storage.getItem('linksaw-preferences') || '{}') || {}; } catch {}
  return {
    shortcut: typeof value.shortcut === 'string' && value.shortcut ? (value.shortcut === 'right-command' && !mac ? DEFAULT_SHORTCUT : value.shortcut) : (mac ? 'right-command' : DEFAULT_SHORTCUT),
    theme: ['system', 'light', 'dark'].includes(value.theme) ? value.theme : 'system',
  };
}
export function shortcutFromEvent(event) {
  if (event.repeat || event.isComposing || ![event.metaKey, event.ctrlKey, event.altKey].some(Boolean)) return null;
  const key = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Space|Arrow(Up|Down|Left|Right))$/.test(event.code) ? event.code : null;
  if (!key) return null;
  return [event.metaKey && 'Super', event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', key].filter(Boolean).join('+');
}
export function shortcutLabel(value, mac) {
  if (value === 'right-command') return 'Right Command';
  return value.replaceAll('CommandOrControl', mac ? '⌘' : 'Ctrl').replaceAll('Super', mac ? '⌘' : 'Win').replaceAll('Control', 'Ctrl').replaceAll('Shift', mac ? '⇧' : 'Shift').replaceAll('Alt', mac ? '⌥' : 'Alt').replace(/Key(?=[A-Z])/g, '').replace(/Digit(?=\d)/g, '');
}
