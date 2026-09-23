(() => {
  if (window.top !== window || window.__linksawAutocomplete) return;
  window.__linksawAutocomplete = true;

  let data = { snippets: [], autocompleteTrigger: ';' };
  let loadedAt = 0;
  let host = null;
  let search = null;
  let results = null;
  let status = null;
  let selected = 0;
  let target = null;
  let inputSelection = null;
  let editableRange = null;

  const label = snippet => snippet.title?.trim() || snippet.body?.trim().split(/\r?\n/, 1)[0].slice(0, 80) || 'Untitled';
  const content = snippet => snippet.body || snippet.title || '';

  function editable(element) {
    if (!element || element.disabled || element.readOnly) return null;
    if (element instanceof HTMLTextAreaElement) return element;
    if (element instanceof HTMLInputElement && /^(text|search|url|email|tel|password)$/.test(element.type)) return element;
    return element.isContentEditable && element.getAttribute('contenteditable') !== 'false' ? element : null;
  }

  function beforeCaret(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value.slice(0, element.selectionStart ?? 0).slice(-1);
    }
    const selection = getSelection();
    if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return '';
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element); range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().slice(-1);
  }

  function atBoundary(element) {
    const previous = beforeCaret(element);
    return !previous || /\s/.test(previous);
  }

  async function refresh(force = false) {
    if (!force && Date.now() - loadedAt < 30000 && data.snippets.length) return data;
    const response = await chrome.runtime.sendMessage({ type: 'LINKSAW_DATA', force });
    if (!response?.ok) throw Error(response?.error || 'Could not load Linksaw');
    data = response; loadedAt = Date.now(); return data;
  }

  function found() {
    const query = search.value.trim().toLowerCase();
    return data.snippets.map((item, order) => {
      const name = label(item).toLowerCase();
      const rank = !query ? 0 : name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : (item.body || '').toLowerCase().includes(query) ? 3 : 99;
      return { item, order, rank };
    }).filter(result => result.rank < 99).sort((a, b) => a.rank - b.rank || a.order - b.order).map(result => result.item);
  }

  function render() {
    const snippets = found(); selected = Math.min(selected, Math.max(0, snippets.length - 1)); results.replaceChildren();
    if (!snippets.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = data.snippets.length ? 'No matches' : 'No snippets yet'; results.append(empty); return;
    }
    snippets.slice(0, 9).forEach((snippet, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `row${index === selected ? ' selected' : ''}`;
      const title = document.createElement('span'); title.className = 'title'; title.textContent = label(snippet); button.append(title);
      if (snippet.title?.trim() && snippet.body?.trim()) {
        const preview = document.createElement('span'); preview.className = 'preview'; preview.textContent = snippet.body.replace(/\s+/g, ' ').trim(); button.append(preview);
      }
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('pointerenter', () => {
        if (selected === index) return;
        results.querySelector('.selected')?.classList.remove('selected');
        selected = index;
        button.classList.add('selected');
      });
      button.addEventListener('click', () => choose(snippet)); results.append(button);
    });
    results.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }

  function captureTarget(element) {
    target = element; inputSelection = null; editableRange = null;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) inputSelection = [element.selectionStart, element.selectionEnd];
    else {
      const selection = getSelection();
      if (selection?.rangeCount && element.contains(selection.anchorNode)) editableRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function insert(text) {
    if (!target?.isConnected) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const [start, end] = inputSelection || [target.value.length, target.value.length];
      target.focus(); target.setRangeText(text, start ?? 0, end ?? start ?? 0, 'end');
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); return true;
    }
    if (target.isContentEditable && editableRange) {
      target.focus(); editableRange.deleteContents(); const node = document.createTextNode(text); editableRange.insertNode(node);
      editableRange.setStartAfter(node); editableRange.collapse(true); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(editableRange);
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); return true;
    }
    return false;
  }

  function close() { host?.remove(); host = search = results = status = null; target?.focus(); }
  function choose(snippet) { const text = content(snippet); close(); insert(text); }

  function open(element) {
    captureTarget(element); selected = 0;
    host = document.createElement('div'); host.id = 'linksaw-autocomplete-root'; const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#0002;display:grid;place-items:start center;padding:14vh 20px 40px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717}.panel{width:min(680px,calc(100vw - 40px));max-height:min(620px,72vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid #d8d8dc;border-radius:14px;background:#fff;box-shadow:0 22px 70px #0004}.search{width:100%;border:0;border-bottom:1px solid #e5e5e7;outline:0;padding:20px 22px;background:transparent;color:#171717;font:inherit;font-size:28px;letter-spacing:-.035em}.results{overflow:auto;padding:7px}.row{width:100%;min-height:58px;display:block;border:0;border-radius:10px;padding:9px 12px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.row:hover,.row.selected{background:#f1f1f2}.title,.preview{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title{font-size:14px;font-weight:650}.preview{margin-top:4px;color:#777;font-size:12px}.empty{padding:44px 18px;text-align:center;color:#777;font-size:13px}.status{padding:0 22px 14px;color:#777;font-size:12px}.status:empty{display:none}@media(prefers-color-scheme:dark){.panel{border-color:#454549;background:#242426;color:#f5f5f5}.search{border-color:#414145;color:#f5f5f5}.row:hover,.row.selected{background:#39393c}.preview,.status,.empty{color:#aaa}}</style><div class="backdrop"><section class="panel" role="dialog" aria-modal="true" aria-label="Linksaw autocomplete"><input class="search" type="search" placeholder="Search" autocomplete="off" aria-label="Search snippets"><div class="results" role="listbox"></div><div class="status" role="status"></div></section></div>`;
    search = root.querySelector('.search'); results = root.querySelector('.results'); status = root.querySelector('.status');
    root.querySelector('.backdrop').addEventListener('pointerdown', event => { if (event.target.classList.contains('backdrop')) close(); });
    search.addEventListener('input', () => { selected = 0; render(); });
    search.addEventListener('keydown', event => {
      const snippets = found().slice(0, 9);
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, Math.min(snippets.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1))); render(); }
      else if (event.key === 'Enter' && snippets[selected]) { event.preventDefault(); choose(snippets[selected]); }
    });
    document.documentElement.append(host); render(); search.focus();
  }

  document.addEventListener('keydown', event => {
    if (host || event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    const element = editable(event.target);
    if (!element || event.key !== data.autocompleteTrigger || !atBoundary(element)) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(element);
    refresh().then(render).catch(error => { if (status) status.textContent = error.message; });
  }, true);

  refresh().catch(() => {});
  addEventListener('focus', () => refresh().catch(() => {}));
})();
