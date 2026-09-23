import { parseCSV, guessHeaders, suggestMapping, mapCSV, MAX_CSV_BYTES } from './csv.mjs';

export function setupImporter({ api, refresh, signedIn }) {
  const el = id => document.getElementById(id);
  const dialog = el('import-dialog');
  let data = null, mapping = [], plan = null, busy = false, queue = null, completed = 0, loadVersion = 0;
  const message = text => { el('import-status').textContent = text; };
  function controls() {
    el('csv-file').disabled = busy || Boolean(queue);
    el('csv-headers').disabled = busy || Boolean(queue);
    el('import-mapping').querySelectorAll('select').forEach(select => { select.disabled = busy || Boolean(queue); });
    el('import-close').disabled = busy;
    el('import-confirm').disabled = busy || !plan || Boolean(plan.errors.length) || (queue && completed === queue.length);
  }
  function preview() {
    plan = mapCSV(data, el('csv-headers').checked, mapping);
    const box = el('import-preview'); box.replaceChildren();
    message(plan.errors.length ? plan.errors.slice(0, 8).join('\n') + (plan.errors.length > 8 ? `\nAnd ${plan.errors.length - 8} more errors.` : '') : `${plan.items.length} snippets ready. ${plan.skipped} empty mapped records skipped. Preview of the first 5:`);
    for (const item of plan.items.slice(0, 5)) {
      const article = document.createElement('article');
      const heading = document.createElement('strong'); heading.textContent = item.title || '(No title)';
      const body = document.createElement('pre'); body.textContent = item.body;
      article.append(heading, body);
      box.append(article);
    }
    el('import-confirm').textContent = `Import ${plan.items.length} snippets`;
    controls();
  }
  function columns() {
    const box = el('import-mapping'); box.replaceChildren();
    for (let i = 0; i < data.width; i++) {
      const label = document.createElement('label');
      const name = el('csv-headers').checked ? data.rows[0].cells[i] : '';
      label.textContent = `Column ${i + 1}${name ? `: ${name}` : ''}`;
      const sample = document.createElement('small'); sample.textContent = (data.rows[el('csv-headers').checked ? 1 : 0]?.cells[i] || '(empty)').slice(0, 100);
      const select = document.createElement('select'); select.setAttribute('aria-label', `Map column ${i + 1}`);
      for (const value of ['ignore', 'title', 'content']) { const option = document.createElement('option'); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); select.append(option); }
      select.value = mapping[i]; select.addEventListener('change', () => { mapping[i] = select.value; preview(); });
      label.append(sample, select); box.append(label);
    }
    preview();
  }
  el('open-import').addEventListener('click', () => {
    if (!signedIn()) return;
    el('settings-dialog').close(); dialog.showModal();
  });
  el('csv-file').addEventListener('change', async () => {
    const version = ++loadVersion;
    const file = el('csv-file').files[0];
    data = null; plan = null; queue = null; completed = 0;
    el('import-mapping').replaceChildren(); el('import-preview').replaceChildren(); controls();
    if (!file) return;
    try {
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 5 MB.');
      const text = await file.text(); if (version !== loadVersion) return;
      data = parseCSV(text); el('csv-headers').checked = guessHeaders(data);
      mapping = suggestMapping(data, el('csv-headers').checked); columns();
    } catch (error) { message(error.message); }
  });
  el('csv-headers').addEventListener('change', () => { if (data) { mapping = suggestMapping(data, el('csv-headers').checked); columns(); } });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  el('import-close').addEventListener('click', () => {
    dialog.close();
    if (queue && completed === queue.length) {
      data = plan = queue = null; completed = 0; el('csv-file').value = '';
      el('import-mapping').replaceChildren(); el('import-preview').replaceChildren(); message(''); controls();
    }
  });
  el('import-confirm').addEventListener('click', async () => {
    if (busy || !plan || plan.errors.length || !signedIn()) return;
    queue ||= plan.items.map(({ record, ...item }) => ({ ...item, importId: crypto.randomUUID() }));
    busy = true; controls();
    try {
      for (; completed < queue.length; completed++) {
        message(`Importing ${completed + 1} of ${queue.length}…`);
        await api('/snippets', { method: 'POST', body: queue[completed] });
      }
      message(`Imported ${completed} snippets into your private library. Existing snippets were not changed.`);
      el('import-confirm').textContent = 'Imported';
    } catch (error) {
      message(`${completed} confirmed imported. Import paused: ${error.message || error}. Retry continues safely without duplicating confirmed rows. Keep this window open to resume.`);
      el('import-confirm').textContent = 'Retry remaining';
    } finally { busy = false; controls(); await refresh(); }
  });
  controls();
}
