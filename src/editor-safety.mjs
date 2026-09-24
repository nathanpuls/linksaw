export function setupEditorSafety({ dialog, prompt, snapshot, baseline, saving, save, close, quit }) {
  let quitting = false;
  const warn = () => {
    prompt.hidden = false; dialog.classList.add('confirming-close');
    prompt.querySelector('p').textContent = quitting ? 'Save before quitting?' : 'Save your changes?';
    if (!saving()) prompt.querySelector('[data-keep]').focus();
  };
  const requestClose = () => {
    if (saving()) return;
    quitting = false;
    if (snapshot() === baseline()) close(); else warn();
  };
  const requestQuit = () => {
    if (!dialog.open || (!saving() && snapshot() === baseline())) { quit(); return; }
    quitting = true; warn();
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.querySelector('#cancel-editor').addEventListener('click', requestClose);
  prompt.querySelector('[data-keep]').addEventListener('click', () => { quitting = false; prompt.hidden = true; dialog.classList.remove('confirming-close'); dialog.querySelector('#snippet-body').focus(); });
  prompt.querySelector('[data-discard]').addEventListener('click', () => { if (!saving()) { if (quitting) quit(); else close(); } });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing || !(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); save(event); }
  });
  return { requestClose, requestQuit, reset: () => { quitting = false; prompt.hidden = true; dialog.classList.remove('confirming-close'); },
    completeSave: () => { if (quitting) { quit(); return true; } close(); return false; } };
}
